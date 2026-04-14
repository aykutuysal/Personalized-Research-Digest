# Onboarding Showcase — Design

**Date:** 2026-04-14
**Status:** Ready for implementation planning
**Supersedes:** The corpus-sanity-check behavior described in `docs/2026-04-13-BRIEF.md` section 11 and the current `corpusSanityCheck` tool + `SanityCheckCard`.

---

## 1. Problem

The current onboarding flow has exactly one moment where the agent touches real papers before `generateConfig`: `corpusSanityCheck`. That tool is wired to probe the 2–3 angles the agent is *least confident* about and either (a) surface a warning if anything looks sparse, or (b) stay silent. The user sees either an apology or nothing.

Onboarding's job is to impress the reader and convert them into a subscription. The one paper-touching moment is currently structurally incapable of doing that — it is a defensive diagnostic, not a showpiece.

## 2. Goal

Turn that moment into an editorial showpiece. Replace `corpusSanityCheck` with a new tool, `showcaseRecentPapers`, that fetches fresh work across the user's committed angles, picks three standout papers, and presents them in a premium, animated card alongside a "why this matches you" rationale per pick. The moment should feel like a clever editor opening a newspaper to exactly the page the reader wanted.

## 3. Flow change

**New onboarding sequence:**

1. Role + subject + intent (2–3 turns, unchanged).
2. `proposeAngles` → angle card → user refines.
3. **`showcaseRecentPapers`** → scan theatre → hero card with 3 picks.
4. Cadence question, informed by what the showcase just observed about the field → `normalizeSchedule`.
5. `generateConfig`.

Still targeting 4–6 exchanges, hard wrap at 10.

**Why cadence moves to the end:** the showcase tool is doing real retrieval work. Its results tell the agent whether the field is hot, moderate, or quiet, which lets the cadence question become an informed suggestion instead of a cold prompt. Moving schedule earlier would force the agent to ask twice or use generic language.

## 4. `showcaseRecentPapers` tool contract

**Session-scoped factory**, same pattern as `proposeAngles`:

```ts
export function makeShowcaseRecentPapersTool(sessionId: string | null)
```

**Input:**

```ts
const showcaseInput = z.object({
  subject: z.string(),
  profile: z.string().describe(
    'Free-form prose capturing role, intent, and anti-interests — the same text you will pass to generateConfig as `profile`.',
  ),
  angles: z
    .array(z.object({ id: z.number().int().min(1), text: z.string() }))
    .min(1)
    .max(12),
})
```

**On angle count.** The schema accepts 1–12 angles. The planner probes `min(SHOWCASE_PROBED_ANGLES, angles.length)` — so a 2-angle config probes both, a 4+ config probes 4. `proposeAngles` reliably produces 6–12 in practice, making the small-N case rare but handled.

**Output:**

```ts
type ShowcaseResult =
  | {
      ok: true
      headline: string                // ranker-generated, max 80 chars
      picks: Pick[]                   // length 1–3
      finalAngles: Angle[]            // post-patch, re-sequenced IDs
      stats: { papersScanned: number; anglesProbed: number }
    }
  | {
      ok: false
      reason: 'no-candidates' | 'ranker-failed' | 'openalex-failed' | 'timeout'
    }

type Pick = {
  openalexId: string
  angleId: number                     // post-patch ID
  chipLabel: string                   // e.g. "Ablation", "Imaging"
  title: string
  authors: string                     // short form, e.g. "Smith et al."
  year: number
  venue: string
  url: string
  whyForYou: string                   // one italic-serif sentence, 20–200 chars
}
```

**Where `patches` lives.** The ranker's internal output schema (see §7) includes a `patches` field. The orchestrator reads that field, applies it via `applyPatches()` to produce `finalAngles`, and logs the raw patches for observability. The orchestrator then **strips `patches` from the public tool return** — it is not part of `ShowcaseResult`. Nothing downstream (agent, UI) sees or renders it. This keeps the tuning fully invisible per §8.

## 5. Orchestrator execution

```ts
async function runShowcase(input, { sessionId }): Promise<ShowcaseResult> {
  // 1. Plan: pick 4 angles + write 4 loose queries in one LLM call.
  const plan = await planShowcaseQueries(input, { sessionId })

  // 2. Retrieve: 4 parallel OpenAlex calls, 14-day window, perPage=15.
  let pool = await fetchCandidatePool(plan.queries, { windowDays: 14 })

  // 3. Widen: if pool has fewer than 6 papers, re-fetch with 60-day window.
  if (pool.length < SHOWCASE_POOL_MIN_FOR_RANKER) {
    pool = await fetchCandidatePool(plan.queries, { windowDays: 60 })
  }

  // 4. Skip silently if still empty.
  if (pool.length === 0) {
    return { ok: false, reason: 'no-candidates' }
  }

  // 5. Rank + propose merges in one LLM call.
  const ranked = await rankShowcasePicks(
    { profile: input.profile, angles: input.angles, selectedAngleIds: plan.selectedAngleIds, pool },
    { sessionId },
  )

  // 6. Apply patches to the angle list for generateConfig.
  const finalAngles = applyPatches(input.angles, ranked.patches)

  // 7. Join picks back to pool metadata (prevents title hallucination).
  const picks = ranked.picks.map((p) => assemblePick(p, pool))

  return {
    ok: true,
    headline: ranked.headline,
    picks,
    finalAngles,
    stats: {
      papersScanned: pool.length,
      anglesProbed: plan.selectedAngleIds.length,
    },
  }
}
```

**Total LLM calls per onboarding showcase: exactly 2.**
**Total OpenAlex calls: exactly 4** (or 8 in the rare widening case).

## 6. Showcase planner

New prompt file: `prompts/showcase-planner-system.md`.

**Job:** pick exactly 4 angles from the user's committed list most likely to have fresh work in the last 14 days, and write one loose boolean query per pick, scoped to the subject.

**Reuses the existing OpenAlex boolean syntax rules** from `prompts/query-planner-system.md`. Queries follow the slot-2 "loose synonym fallback" flavor — broader OR groups, wider recall, precision handled downstream by the ranker.

**Output schema:**

```ts
const showcasePlanSchema = z.object({
  selectedAngleIds: z.array(z.number().int().min(1)).length(4),
  queries: z
    .array(
      z.object({
        angle_id: z.number().int().min(1),
        query: z.string().min(1),
        rationale: z.string(),
      }),
    )
    .length(4),
})
```

**Why not reuse `planQueries` as-is:** its hard `MIN_PER_ANGLE=1` rule protects the real pipeline's "every angle gets a query" invariant. We don't want to loosen that constraint on the main planner — a showcase planner with its own rules is cleaner than a mode flag on the existing one.

**File layout:**
- `prompts/showcase-planner-system.md` — system prompt.
- `src/lib/ai/showcase-planner.ts` — `planShowcaseQueries()` function, mirrors `planQueries()` structure.

## 7. Showcase ranker

New prompt file: `prompts/showcase-ranker-system.md`.

**Input (user prompt):**

```
PROFILE: <full prose>

ANGLES (the user's committed list, 1-indexed):
  1. atrial fibrillation fundamentals
  2. catheter ablation outcomes
  ...
  8. clinical outcomes

PROBED_ANGLES: [1, 2, 3, 7]
HIT_COUNTS:
  angle 1: 18 works
  angle 2: 27 works
  angle 3: 11 works
  angle 7:  1 work

CANDIDATE_POOL (47 deduped works):
  [id=W001, angle=1, title="...", authors=[...], venue="NEJM", date="2026-04-10", abstract="..."]
  [id=W002, angle=1, ...]
  ...
```

**Job:**

1. Pick the 3 papers that best match the profile. They can come from any probed angle in any distribution. Partial fits are acceptable as long as `whyForYou` is honest.
2. Write one italicized sentence per pick naming the specific thing in the profile it matches. No generic praise.
3. Assign each pick a short `chipLabel` (1–2 words, Title Case).
4. Write a `headline` — punchy, editorial, max 80 chars, max 8 words. Example: "Three papers I'd have sent you."
5. Optionally propose up to 2 merges (see §8 for the rule).

**Output schema:**

```ts
const showcaseRankerSchema = z.object({
  headline: z.string().max(80),
  picks: z
    .array(
      z.object({
        openalexId: z.string(),             // metadata joined from pool downstream
        angleId: z.number().int().min(1),
        chipLabel: z.string().max(20),
        whyForYou: z.string().min(20).max(200),
      }),
    )
    .min(1)
    .max(3),
  patches: z
    .array(
      z.object({
        absorbedAngleId: z.number().int().min(1),
        intoAngleId: z.number().int().min(1),
        newText: z.string().min(5).max(120),
        reason: z.string().max(100),         // logs only, never shown
      }),
    )
    .max(2),
})
```

**Hallucination containment:** the ranker returns only `openalexId` + `whyForYou` + `chipLabel`. The orchestrator joins those IDs back to the fetched `OpenAlexWork` objects in the candidate pool to pull `title`, `authors`, `year`, `venue`, and `url`. The LLM literally cannot ship a fabricated title.

**File layout:**
- `prompts/showcase-ranker-system.md` — system prompt.
- `src/lib/ai/showcase-ranker.ts` — `rankShowcasePicks()` function, uses `generateObject` + `deepseek()`.

## 8. Silent angle tuning

**Mechanism.** The ranker's merge decision lives inside its main call. Zero additional LLM calls, zero additional OpenAlex calls.

**Merge rule** (stated in the ranker's system prompt):

> A merge is only appropriate when:
>
> 1. A probed angle's `hit_count` is ≤ 2, AND
> 2. Another angle in the full list (probed or not) is topically adjacent such that a combined area would cover both meaningfully, AND
> 3. The combined area can be phrased in a single short line the reader would recognize as "yes, that's my interest."
>
> If any condition isn't met, propose no patch for that angle. Leaving a quiet angle alone is always an acceptable answer.
>
> Hard cap: at most 2 patches per call.

**Applying patches:**

```ts
function applyPatches(angles: Angle[], patches: Patch[]): Angle[] {
  const absorbed = new Set(patches.map((p) => p.absorbedAngleId))
  return angles
    .filter((a) => !absorbed.has(a.id))
    .map((a) => {
      const patch = patches.find((p) => p.intoAngleId === a.id)
      return patch ? { ...a, text: patch.newText } : a
    })
    .map((a, i) => ({ ...a, id: i + 1 }))    // re-sequence IDs from 1
}
```

**Zero user surface.** This is a non-negotiable from the design conversation:

- Agent **never** narrates tuning. System prompt line: *"Use `finalAngles` from the showcase result when you call `generateConfig`. Never mention tuning, merging, or quiet areas to the user under any circumstances."*
- Tracking-footer chips all render identically. No tuned-chip highlight, no hover tooltip, no "· tuned" suffix.
- No user override path. If the user later says "I want genetics back," the normal angle-refinement loop handles it via a fresh `proposeAngles` call.

**Invariant preservation.** The brief's "configs are never mutated in place" rule applies post-commit — we are editing angles during authoring, before `generateConfig` creates the first config row. No invariant violation.

## 9. UI composition

**New files** (`src/components/chat/showcase/`):

```
ShowcaseCard.tsx           — orchestrator, switches on AI SDK tool-part state
ShowcaseScanState.tsx      — running-state scan theatre (§10)
ShowcaseLandedState.tsx    — resolved hero card with picks + tracking
ShowcasePickCell.tsx       — one pick, with "Why for you" italic-serif footer
ShowcaseTrackingChips.tsx  — the N-chip footer row
```

**State machine** (inside `ShowcaseCard`):

```tsx
switch (part.state) {
  case 'input-available':   // tool invoked, running
    return <ShowcaseScanState probeData={liveProbeData} angles={probedAngles} />
  case 'output-available':
    if (part.output.ok === false) return null         // silent skip
    return <ShowcaseLandedState result={part.output} />
  case 'output-error':
    return null                                        // silent skip
}
```

**Scan → land morph.** Both states render into one outer `<motion.div layout>` so Framer Motion animates the container's size change for free. Inside, `<AnimatePresence mode="wait">` crossfades between the two children. The border and shadow stay mounted through the transition — it feels like a morph, not a replace.

**MessageBubble dispatch.** Add a case for `part.type === 'tool-showcaseRecentPapers'` in the existing tool-part dispatch in `src/components/chat/MessageBubble.tsx`. Delete the `tool-corpusSanityCheck` case.

**Theme fidelity.** All colors come from the existing `globals.css` tokens (`bg-bg-elev-1`, `border-line`, `text-ink`, `text-accent`, `font-display`). Instrument Serif is the display face via `--font-display`. The emerald accent is used for the "Fresh this week" eyebrow and the chip labels — no other color additions. Dark mode works because all tokens already have dark variants.

**Accessibility.** Scan state has `aria-live="polite"` and `aria-busy="true"`. Landed state drops `aria-busy` and announces the headline via a `sr-only` update. The existing global `@media (prefers-reduced-motion: reduce)` rule handles motion reduction.

## 10. Scan theatre

**What plays while the tool is running.**

- **Top hairline:** reuses the existing `rd-reading-cursor` keyframe from `globals.css` (same as `ToolCallCard`'s progress bar).
- **Eyebrow:** "Scanning fresh work" in emerald uppercase.
- **Cycling status line:** a serif line (Instrument Serif) that crossfades through four copy lines every ~2s:
  1. "Reading your angles…"
  2. "Pulling fresh work from OpenAlex…"
  3. "Weighing candidates against your profile…"
  4. "Picking the three that deserve your Monday…"
- **Ticker counter:** "1,247 papers scanned across 4 focus areas" — animates via `requestAnimationFrame` from 0 to the observed total.
- **Chip sweep:** the scan theatre renders **all N angle chips** from the input (same set that will appear in the landed tracking footer). The 4 probed chips light up in a staggered CSS `animation-delay` sweep; the un-probed chips stay in their neutral resting style throughout. On morph, the probed chips settle into the same neutral style as the rest, and any angle absorbed by a patch fades out — Framer's `layout` animation handles the row reflow.
- **Title tease slot:** an italic-serif line in a "Just in" slot that shows real titles as OpenAlex returns them.

**Live streaming of probe progress.**

Preferred path: use AI SDK v6's tool-execute streaming mechanism (exact API to be confirmed against the installed SDK types during implementation — see `docs/superpowers/notes/2026-04-13-ai-sdk-v6-corrections.md` for the v6 patterns already discovered). The tool emits `ProbeEvent` data parts as each OpenAlex fetch resolves:

```ts
type ProbeEvent =
  | { kind: 'probe-start'; angleId: number; angleText: string }
  | { kind: 'probe-result'; angleId: number; count: number; sampleTitle: string | null }
  | { kind: 'probe-done'; papersScanned: number }
```

**Fallback path:** if v6 doesn't support streaming from within `tool.execute` cleanly, the tool attaches `candidatePreview: string[]` (the first title from each probe) to the final result, and `ShowcaseScanState` holds for ~1.5s while cycling through those titles before the morph. Visually indistinguishable from real streaming. The design stays valid either way — implementation picks whichever v6 actually supports.

## 11. Landed hero card

**Layout** (all tokens from `globals.css`):

- Rounded-2xl outer container, `border-line` border, `bg-bg-elev-1` background, subtle shadow.
- Header row: emerald eyebrow "Fresh this week" + Instrument Serif headline (up to 80 chars, ranker-generated) + right-aligned stats ticker "1,247 papers scanned · 4 focus areas".
- 3-column grid of `ShowcasePickCell`. Each cell:
  - Emerald uppercase `chipLabel`.
  - Title in 14px `text-ink` semibold.
  - Venue · age in `text-ink-faint`.
  - Dashed hairline separator.
  - "Why for you" footer: label in `text-ink-faint` uppercase, body in Instrument Serif italic `text-ink-soft`.
- Tracking footer below: solid hairline + "Tracking" label + pill-chips for every angle in `finalAngles`. All chips render identically.

**Fewer-than-3 picks.** If `picks.length < 3`, the grid collapses gracefully: 2 picks → 2 columns, 1 pick → centered single column. No empty cells, no "missing" messaging.

## 12. Thresholds

All constants live at the top of `src/lib/ai/showcase.ts`:

```ts
const SHOWCASE_PROBED_ANGLES = 4
const SHOWCASE_PER_QUERY_PAGE_SIZE = 15
const SHOWCASE_PRIMARY_WINDOW_DAYS = 14
const SHOWCASE_WIDENED_WINDOW_DAYS = 60
const SHOWCASE_POOL_MIN_FOR_RANKER = 6
const SHOWCASE_QUIET_ANGLE_HIT_CEILING = 2
const SHOWCASE_MAX_PATCHES = 2
const SHOWCASE_PARALLEL_LIMIT = 4
const SHOWCASE_LLM_RETRIES = 2
const SHOWCASE_TOTAL_TIMEOUT_MS = 15_000
```

## 13. Failure modes

| Condition | Tool return | UI result | Agent behavior |
|---|---|---|---|
| Happy path, 3 picks | `{ ok: true, picks: [3], ... }` | Hero card lands | Narrates picks, asks cadence |
| Pool < 6 after 14d | (internal widen) | — | — |
| Pool < 6 after 60d | `{ ok: false, reason: 'no-candidates' }` | Silent skip | Moves to cadence without comment |
| OpenAlex retries exhausted | `{ ok: false, reason: 'openalex-failed' }` | Silent skip | Moves to cadence |
| Ranker parse error after 2 retries | `{ ok: false, reason: 'ranker-failed' }` | Silent skip | Moves to cadence |
| Timeout > 15s | `{ ok: false, reason: 'timeout' }` | Silent skip | Moves to cadence |
| Ranker returns 1–2 picks | `{ ok: true, picks: [1..2], ... }` | Card lands with 1–2 picks | Narrates them |

Every non-success path is visually indistinguishable from "the agent never called that tool." The system prompt line that enforces this: *"If `showcaseRecentPapers` returns `ok: false`, say nothing about it and proceed to the cadence question."*

## 14. Observability

Every run logs one structured line at start and end, prefixed `[showcase <sessionSlice>]`, plus per-probe lines:

```
[showcase 3a4b] start subject="atrial fibrillation" angles=8 profile_chars=412
[showcase 3a4b] probe angle=2 query="..." hits=27 ms=340
[showcase 3a4b] probe angle=7 query="..." hits=1 ms=290
[showcase 3a4b] widened pool=4 (14d→60d)
[showcase 3a4b] ranker picks=3 patches=1 tokens=3104/147 cost=$0.00102 ms=890
[showcase 3a4b] done ok=true total_ms=1840
```

Same style as the existing `[planQueries ...]` logs. No new logging infrastructure.

## 15. Agent narration

Added to `prompts/onboarding-system.md`. Key rules:

- **Before the tool call:** at most one transition sentence, optional. No mechanical language like "let me check" or "running a search."
- **After `ok: true`:** narrate *around* the card, not *at* it. The card already shows the titles and the "why for you." Agent names one concrete observation about the *field* and pivots to the cadence question in the same message. Do not re-list titles. Do not repeat the rationales.
- **After `ok: false`:** literally say nothing about it. Move directly to the cadence question.
- **Tuning:** never mentioned. Ever.

**Cadence-framing templates** (the agent chooses based on its read of the showcase results):

- Hot field (3 picks, all <5 days old): *"This field's moving fast — daily or every-other-day both make sense. You tell me."*
- Moderate field (mixed ages): *"A couple of meaningful papers drop each week. Weekly or every-other-day would fit."*
- Quieter field (1–2 picks, or all >7 days): *"This area is more of a slow drumbeat. Weekly or monthly probably fits best."*

## 16. Retirement of `corpusSanityCheck`

**Files fully deleted:**

- `src/components/chat/SanityCheckCard.tsx`
- `test/corpus-sanity.test.ts` (if it exists — verify during implementation)

**Code removed:**

- The `corpusSanityCheck` tool definition and `makeCorpusSanityCheckTool` factory in `src/lib/ai/onboarding-tools.ts`.
- Its entry in `buildOnboardingTools`'s returned object.
- Its type in `src/lib/ai/chat-types.ts` (the `OnboardingUITools` union member).
- Its dispatch case in `src/components/chat/MessageBubble.tsx`.
- Its section in `prompts/onboarding-system.md` (replaced with `showcaseRecentPapers` instructions).
- Its reference in the brief's "risk: bad angle lists" mitigation line — update that line to point at the new tool.

**System prompt changes:**

- Add `showcaseRecentPapers` to the tool list with usage rules (call once angles are settled, before asking cadence; use `finalAngles` when calling `generateConfig`; never mention tuning).
- Remove `corpusSanityCheck` entry.
- Move the schedule guidance to the very end of the flow.
- Exchange budget unchanged: 4–6, hard wrap at 10.

## 17. Testing plan

**Unit tests (Vitest):**

- `test/showcase-planner.test.ts` — mock `deepseek()`, feed 8 angles, assert the planner returns exactly 4 `selectedAngleIds` and 4 queries, one per selected angle, that each query is scoped to the subject, and that schema validation passes.
- `test/showcase-ranker.test.ts` — mock `deepseek()`, feed a synthetic candidate pool, assert picks length 1–3, valid OpenAlex IDs from the pool, patches length ≤ 2, headline length ≤ 80.
- `test/showcase.test.ts` (orchestrator) — mock `searchByKeyword`, `planShowcaseQueries`, `rankShowcasePicks`. Cases:
  - happy path → 3 picks, `ok: true`, `finalAngles === angles` when `patches` is empty
  - widening trigger → 14d returns pool<6, 60d returns pool≥6, confirm second call used `fromDate` for 60 days back
  - silent skip → both 14d and 60d return empty, assert `{ ok: false, reason: 'no-candidates' }`
  - ranker parse failure → 2 retries, then `{ ok: false, reason: 'ranker-failed' }`
  - timeout → `AbortSignal` fires, `{ ok: false, reason: 'timeout' }`
  - patches applied → ranker returns 1 patch, confirm `finalAngles` has the absorbed angle removed and IDs re-sequenced from 1
- `test/tools.test.ts` (existing file) — remove all `corpusSanityCheck` cases; add `showcaseRecentPapers` discoverability test via `runTool(toolCtx, 'showcaseRecentPapers', { ... })`.

**Not in scope for this phase:**

- UI morph animation visual regression.
- Real OpenAlex integration tests (kept mocked).
- Testing AI SDK v6 data-part streaming — manual browser verification only.

**Definition of done:**

1. `npm run typecheck` passes.
2. `npm run lint` passes.
3. `npm test` passes.
4. Manual browser test of the full onboarding flow with a real subject produces a hero card in ≤ 4s with 3 picks and correct theme.
5. `corpusSanityCheck` code and all references are gone from the tree.
6. `prompts/onboarding-system.md` updated, no broken cross-references.

## 18. Cost + latency summary

| Resource | Current (sanity check) | New (showcase) | Delta |
|---|---|---|---|
| LLM calls per onboarding | 1 | 2 | +1 |
| OpenAlex calls per onboarding | 2–3 | 4 (or 8 on widen) | +1–5 |
| Estimated LLM $ per onboarding | ~$0.001 | ~$0.002 | +$0.001 |
| Wall time | ~2s | ~3–4s | +1–2s |

Well within the brief's ≤$0.025-per-digest-run budget. The new tool's cost is dwarfed by the pipeline's real digest runs.

## 19. Out of scope (future work)

- Display-reuse of showcase picks in the Phase-1 preview digest (marking overlapping papers with a "you saw this during setup" badge). Straightforward to add once the preview digest exists.
- A `status: 'watching'` angle state that lets the pipeline planner allocate smaller query budgets to low-activity angles. Proper fix for the long-term sparse-angle problem, but it's Phase-1 pipeline territory, not showcase territory.
- Visual regression tests for the morph animation.
