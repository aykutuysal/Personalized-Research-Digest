# v9.2 Onboarding Preview — Design

**Date:** 2026-04-20
**Status:** Ready for implementation planning
**Supersedes:** `docs/superpowers/specs/2026-04-14-onboarding-showcase-design.md` (showcase retired), `docs/superpowers/specs/2026-04-15-showcase-broadsheet-rows-design.md` (rolled into the new `PaperRow` component), and the cadence/generateConfig flow in `docs/superpowers/specs/2026-04-13-phase-1-onboarding-design.md`.

---

## 1. Problem

The onboarding flow ends with a streamed config but no evidence that the product will feel good for *this* reader. Today's `showcaseRecentPapers` card is a 3-paper editorial teaser — a confidence-builder during chat — but the user never sees a rendered sample of *their* digest before the agent asks them to commit. The preview digest described in the PRD (the big conversion moment) hasn't been built.

Separately, the `iter/` study landed on v9.2 as the right retrieval engine: seed→vocabulary-mine→library, with angle-seeded step 1 that closed v8's clinical-narrow gap. That engine needs a home in `src/`. This spec is the home.

## 2. Goal

Replace the current end of onboarding with a **Research Plan view + Preview digest**:

- Research Plan is a beautifully-rendered editorial view of the four fields the chat collected. It is fully editable and lives between the chat and subscription.
- Preview is the user's own digest template, rendered with 5 real papers chosen this week, behind a button that streams progress while v9.2 discovery + an editorial curator run server-side.
- Cadence and Subscribe are UI, not chat. No LLM calls.

The preview must feel like the product, not a demo. The user rendered *their* template with real papers in their voice. The subscription unlocks *more papers, deeper reading, matched voice over time, delivered on their cadence* — not a different product.

## 3. Scope

In scope:

- The onboarding chat shrinks to four fields (subject, profile, research_areas, output_style) and two tools.
- A new `ResearchPlanView` UI replaces `ConfigSummary`.
- A new `POST /api/preview-digest` route streams the v9.2 preview pipeline via SSE.
- New editorial curator prompt + component.
- Cadence picker UI.
- Subscribe button is a placeholder (toast only) — no auth, no persistence, no payment.
- Schema split: `DigestDraft` (chat output) vs `DigestConfig` (subscribe output).
- Full delete of showcase code, `ConfigSummary`, and the existing test suite.

Explicitly **out of scope** (future work):

- Full v9.2 build (steps 5–6, validation + reformulation, 12–16 queries) triggered post-subscribe.
- Persistent library storage (Supabase, etc.).
- Scheduled digest pipeline (the 4-stage pipeline proper).
- Auth, payment, subscription management.
- Email delivery.
- Unit / integration tests. The existing test suite is removed in this pass; testing returns later.

## 4. Terminology

Renaming `core_angles` → `research_areas` everywhere (schema, prompts, tool names, UI, comments). The word "angle" is retired. Reason: matches how users think about their own work ("these are my research areas"), and disambiguates from the iter study's historical usage of "angle" as a scoring abstraction.

## 5. End-to-end flow

**Chat phase (agent-driven, `/api/onboarding-chat`):**

1. Collect `subject`, `profile` (role + intent + anti-interests), and `output_style` (language + tone + sections — free-form prose the user owns) across 2–3 exchanges. System prompt alone — no dedicated tool.
2. Call `proposeResearchAreas` tool → `ResearchAreaProposalCard` renders an editable chip list. User refines verbally.
3. Call `handoffToPlan` tool with `{ subject, profile, research_areas, output_style }`. Tool validates against `digestDraftSchema`. On success, the UI transitions to the Research Plan view.

No cadence question. No in-chat preview. No `generateConfig` from chat.

**Research Plan phase (UI, no LLM while idle):**

4. Research Plan view renders. All four draft fields are editable inline (see §8).
5. User clicks **Preview your digest** → `POST /api/preview-digest` with the draft.
6. SSE stream drives a progress UI (§10).
7. When `done` lands, the preview renders below the plan: user's template populated with 5 papers + a numbered references list + a two-column "this first read / what your real digest does differently" block (§11).
8. Any edit to the draft invalidates `schedule` and transitions the preview to `stale`.

**Cadence + Subscribe phase (UI, no LLM):**

9. Cadence picker appears when preview is `ready`. Four-option segmented control + day-of-week + time + timezone (§12). Pure client-side cron construction.
10. Subscribe button enables once a valid schedule is set. Click: validate the full `digestConfigSchema`, show a toast, no persistence.

## 6. Schema

`src/lib/config-schema.ts`:

```ts
export const researchAreaSchema = z.object({
  id: z.number().int().min(1),
  text: z.string().min(1),
})

export const searchQuerySchema = z.object({
  query: z.string().min(1),
  research_area_id: z.number().int().min(1),
  source: z.enum(['preview', 'full', 'manual']),
  rationale: z.string().default(''),
})

export const digestDraftSchema = z.object({
  subject: z.string().min(1),
  profile: z.string().min(1),
  output_style: z.string().min(1),
  research_areas: z.array(researchAreaSchema).min(1),
  search_queries: z.array(searchQuerySchema).default([]),
})

export const scheduleSchema = z.object({   // unchanged from today
  cron: z.string().min(1),
  timezone: z.string().min(1),
  description: z.string().min(1),
})

export const digestConfigSchema = digestDraftSchema.extend({
  schedule: scheduleSchema,
  volume_target: z.number().int().min(3).max(40),
  version: z.number().int().min(1),
  created_at: z.string().min(1),
  updated_at: z.string().min(1),
})

export type ResearchArea = z.infer<typeof researchAreaSchema>
export type SearchQuery = z.infer<typeof searchQuerySchema>
export type DigestDraft = z.infer<typeof digestDraftSchema>
export type Schedule = z.infer<typeof scheduleSchema>
export type DigestConfig = z.infer<typeof digestConfigSchema>
```

Removed: `angleSchema`, the old `status`/`priority` fields. `search_queries` is upgraded from `string[]` to structured `SearchQuery[]` with provenance tracking.

Invariant: any edit to `research_areas`, `subject`, `profile`, or `output_style` clears `search_queries` (re-generated on next preview). Enforced in the `setDraft` action (§8).

## 7. Chat contract

Tools:

- `proposeResearchAreas` — renamed from `proposeAngles`. Same session-scoped factory pattern. Output schema still `{ text, rationale }[]`; orchestrator assigns 1-based `id`s. Hard cap 12. Model: DeepSeek v3.2 at temperature 0.7. Drives `ResearchAreaProposalCard`.
- `handoffToPlan` — zero-side-effect tool. Input is `digestDraftSchema`. On success, returns `{ ok: true, draft }` and the chat route's response downstream dispatches a `handoff` UI event. On validation failure, returns `{ ok: false, errors }` the way `generateConfig` does today.

Removed tools: `normalizeSchedule`, `showcaseRecentPapers`, `generateConfig`. Their prompt-level instructions disappear from `onboarding-system.md`.

`prompts/onboarding-system.md` is rewritten to:

- State the four-field contract explicitly.
- Instruct the agent to collect subject + profile + output_style conversationally across 2–3 exchanges, then call `proposeResearchAreas`, then finalize areas through verbal refinement, then call `handoffToPlan`.
- Drop all cadence / schedule guidance.
- Drop all showcase guidance.
- Keep the 4–6 exchanges target, hard cap 10.

## 8. Research Plan view

File: `src/components/plan/ResearchPlanView.tsx`.

**Layout (top to bottom):**

1. **Masthead** — emerald eyebrow `YOUR RESEARCH PLAN`, serif display headline rendering `subject` (click-to-edit).
2. **"Who this is for"** — label + `profile` in `font-display` reading-width (`max-w-prose`). Click-to-edit textarea.
3. **"Research areas"** — label + editable chip row. Chips: click to edit text inline, × to remove, trailing `+ Add area`. Reuses the typography of today's `AngleProposalCard` chips.
4. **"Voice & format"** — label + `output_style` in `font-display` italic. Click-to-edit textarea.
5. **Preview section** — state machine (§9). CTA when idle, progress when running, full rendered preview when ready, faded + banner when stale.
6. **Cadence section** — renders only when preview is `ready` (§12).
7. **Subscribe section** — renders only when preview is `ready` and `schedule` is set (§13).

**Visual language:** same tokens as the showcase broadsheet rows (`bg-bg-elev-1`, `border-line`, `text-ink`, `text-accent`, `font-display`). Chat thread collapses into a sticky ribbon at the top with an "expand to show the chat" affordance. No new URL route — inline transition on `/onboarding`.

**Hook: `usePlanState`**

```ts
type PreviewState =
  | { kind: 'idle' }
  | { kind: 'running'; events: ProgressEvent[] }
  | { kind: 'ready'; body: string; references: ReferencePaper[]; queries: SearchQuery[]; generatedAt: string }
  | { kind: 'stale'; previous: Extract<PreviewState, { kind: 'ready' }> }
  | { kind: 'error'; stage: string; message: string }

type PlanState = {
  draft: DigestDraft
  preview: PreviewState
  schedule?: Schedule
}

// Actions:
//   setDraftField(key, value)         — mutates draft, clears search_queries, transitions ready → stale, clears schedule
//   setResearchAreas(areas)           — same, plus re-ids areas 1..N
//   startPreview()                    — transitions to running, opens SSE
//   receivePreviewEvent(e)            — appends to events or transitions to ready/error
//   setSchedule(s)                    — only valid when preview is ready
//   reset()                           — for dev
```

State is persisted to `localStorage` under `research-plan-draft` so a reload mid-preview doesn't lose the user's work. Mirrors the existing chat persistence pattern in `src/lib/storage/local.ts`.

## 9. Preview state transitions

```
idle          → user clicks Preview                            → running
running       → SSE 'done' event                               → ready
running       → SSE 'error' event OR stream abort              → error
ready         → user edits any draft field                     → stale
stale         → user clicks Preview again                      → running
error         → user clicks Preview again                      → running
any           → user clicks "regenerate"                       → running
```

Only `ready` reveals the cadence picker and Subscribe. `stale` shows the previous preview visibly faded with a banner: *Your plan changed. This preview is from the previous version.*

## 10. Preview pipeline (`POST /api/preview-digest`)

Runtime: `export const runtime = 'nodejs'`, `export const maxDuration = 60`. Not Edge — we need parallel fetches + LLM calls summing to ~20–40s wall clock, and Edge's 50ms CPU cap doesn't cover us.

Request body: JSON matching `digestDraftSchema`.

Response: `text/event-stream` with `data: <ProgressEvent JSON>\n\n` frames.

**Progress event contract (`src/lib/ai/preview/progress-events.ts`):**

```ts
export type ReferencePaper = {
  id: string
  title: string
  authors: string        // short form e.g. "Smith et al."
  venue: string
  date: string           // ISO date
  url: string
}

export type ProgressEvent =
  | { kind: 'seeds'; seeds: string[] }
  | { kind: 'seed-fetch-done'; papersScanned: number; perSeed: Array<{ seed: string; count: number }> }
  | { kind: 'vocab'; topics: number; keywords: number; fields: string[] }
  | { kind: 'library'; queries: Array<{ query: string; research_area_id: number }> }
  | { kind: 'area-hit'; research_area_id: number; hits: number; sampleTitle: string | null }
  | { kind: 'curating' }
  | { kind: 'done'; body: string; references: ReferencePaper[]; queries: SearchQuery[] }
  | { kind: 'error'; stage: string; message: string }
```

**Pipeline (`src/lib/ai/preview/pipeline.ts`):**

```
runPreviewPipeline(draft, { emit }):
  // Step 1: seeds
  angleSeeds = angles_to_seeds(draft.research_areas)
  llmSeeds   = await generateSeeds(draft)           // LLM call 1 of 3
  seeds      = unique(llmSeeds ∪ angleSeeds)
  emit({ kind: 'seeds', seeds })

  // Step 2: fetch seed papers (6mo window, title_and_abstract.search, per_page=50)
  seedPapers = await fetchSeeds(seeds)              // parallel OpenAlex
  emit({ kind: 'seed-fetch-done', papersScanned, perSeed })

  // Step 3: extract vocabulary (pure code)
  vocab = extractVocabulary(seedPapers)
  emit({ kind: 'vocab', ... })

  // Step 4: build compact library
  //   MIN_PER_ANGLE=1, MAX_PER_ANGLE=1, QUERY_BUDGET=research_areas.length, no intersections/adjacents
  library = await buildLibrary(draft, vocab)        // LLM call 2 of 3
  emit({ kind: 'library', queries: library })

  // Step 5: run library (7d window, per_page=15, parallel)
  for each query in library, as it resolves:
    hits = await fetchQuery(query, lastWeek)
    emit({ kind: 'area-hit', research_area_id, hits: count, sampleTitle })
  pool = dedupe(all hits across queries)

  // Step 6: editorial curator
  emit({ kind: 'curating' })
  { body, referenceIds } = await curate(draft, pool)  // LLM call 3 of 3
  references = joinMetadata(referenceIds, pool)
  emit({ kind: 'done', body, references, queries: library })
```

Costs & timing (based on iter Python runs):

| Step | Wall | LLM $ |
|---|---:|---:|
| seeds (LLM + angle-derived) | 2–5s | $0.0002 |
| seed fetch (parallel) | 3–8s | — |
| vocab (code) | <50ms | — |
| library build (LLM) | 5–10s | $0.0008 |
| library fetch (parallel) | 2–5s | — |
| curator (LLM) | 8–15s | $0.0008 |
| **Total** | **~20–40s** | **~$0.003** |

Error handling per stage:

| Stage | Failure | Response |
|---|---|---|
| seeds LLM | parse error | retry once; on 2nd: `error` |
| seed fetch | all 0 results | fallback: single wildcard on raw `profile` text; if still 0: `error` |
| library LLM | parse error or fewer queries than areas | retry once; on 2nd: `error` |
| library fetch | one query 429/5xx | retry in client; continue with partial pool as long as ≥50% resolve |
| curator LLM | parse error or <3 referenceIds | retry once; on 2nd: fallback — render top 5 papers by recency with no editorial body, plus banner *"Your editor couldn't finish this first read. You'll see the full write-up after you subscribe."* |

Observability: one structured log per stage, prefixed `[preview <sessionSlice>]`, matching the existing `[showcase ...]` format. Includes per-stage cost + timing.

Client consumption: `PreviewRunningState` uses `fetch()` + `response.body.getReader()` (no `EventSource` dependency) to parse SSE frames, dispatching into `usePlanState`. On `done`, transitions to `ready`. On `error`, transitions to `error`.

## 11. Preview rendering (`PreviewReadyState`)

Layout (top to bottom):

1. **Eyebrow:**
   `YOUR DIGEST · FIRST READ` (emerald uppercase 10px).
   Subcopy: *Rendered in the format you asked for. Five papers this time — your real digest pulls from many more.*

2. **The rendered digest body.** Markdown, rendered with `react-markdown` + `remark-gfm`, no raw HTML. Styled to match the Research Plan's typography: `font-display` headings, reading-width (`max-w-prose`), serif body. This is the hero. Whatever shape the user's `output_style` implied — sections, bullets, prose — gets honored here.

3. **References list** — numbered 1 through 5 (or fewer if the curator selected fewer and the fallback triggered). Each row uses the new `PaperRow` component (extracted from `ShowcasePickCell`): dateline (venue · date · chip label showing the research_area), serif title, link to OpenAlex work. No per-paper "why for you" blurb — the body already did that work, keeping the list austere reinforces the body as the star.

4. **"What happened / what your real digest does differently"** — two-column block with the marketing copy:

   **Left (factual):**
   ```
   This first read.
   76 papers scanned · 8 research areas covered · 5 chosen for this sample

   Your curator worked across abstracts, venues, and publication dates
   from the last 7 days.
   ```
   Numbers come from the actual run (`papersScanned`, `research_areas.length`, `references.length`).

   **Right (subscription value):**
   ```
   What your real digest does differently.

   Picks more papers. Your sections fill in properly — not just one or
   two papers per section, but the real field's output for the cycle.

   Reads more carefully. Goes beyond abstracts, looks at who's citing
   whom, and notices threads that don't show up in a single pass.

   Matches your voice better. The more digests you read, the more your
   curator writes the way you actually read.

   Arrives on your cadence. In your inbox, when you asked for it.
   ```

5. **"Regenerate preview"** ghost button, top-right of the card (subtle). When the draft is stale, this button becomes prominent and the eyebrow banner states the plan changed.

Copy rules (enforced in code via constants, linted by eye):

- Avoid: *limited, partial, reduced, trial, demo, sample version, basic, weekly* (cadence-specific words).
- Use: *first read, opening pass, quick survey, cycle, your cadence, per digest*.

## 12. Curator (`prompts/preview-curator-system.md`)

Single LLM call. Inputs:

- `subject`
- `profile`
- `research_areas` (text + id)
- `output_style` verbatim as "THE READER'S DIGEST TEMPLATE"
- `pool`: 20–40 candidate papers (deduplicated across queries), each with `id`, `title`, `authors`, `venue`, `date`, first 500 chars of abstract, and the `research_area_id` it was retrieved for.

Output schema:

```ts
const curatorOutputSchema = z.object({
  body: z.string(),                                  // markdown honoring output_style
  referenceIds: z.array(z.string()).min(3).max(5),   // OpenAlex IDs, [1]..[5] in the body
})
```

System prompt hits these points (exact wording to be drafted during implementation):

- Role: editor writing in the reader's requested template for this specific reader.
- Job: pick 5 papers (or 3–4 if 5 aren't defensible), tie them together through 1–3 threads, write in the user's voice and format.
- Render `output_style` faithfully: if it implies sections, use those sections; if it implies bullets, use bullets; if it implies prose, write prose.
- Use `[n]` citations (1-indexed, matching `referenceIds` order). Every referenceId appears at least once.
- Anti-patterns: no generic praise ("this paper is highly relevant"), no scaffolding phrases ("in conclusion", "in summary"), no Introduction/Conclusion headers unless the user asked for them, no per-paper paragraphs (unless the user's template explicitly asks for that).
- If `output_style` asks for more sections than 5 papers can populate, populate the sections you can honestly and leave the rest out — don't pad.

Hallucination containment: the ranker-style pattern — curator returns only IDs + prose with `[n]`, server joins metadata from `pool` to render the references list. Curator cannot ship a fabricated title.

Model: DeepSeek v3.2 at temperature 0.5 (lower than angle proposal — we want stable editorial output). Strip min/max/length keywords before the provider call (see `propose-angles.ts` for the pattern; Anthropic model swap requires it).

## 13. Library builder (`prompts/preview-library-system.md`)

Derived from `iter/keyword_discovery.py:build_library`, slimmed for the preview profile:

- `MIN_PER_ANGLE = 1`, `MAX_PER_ANGLE = 1`, `QUERY_BUDGET = research_areas.length`.
- Dimensions allowed: `core` only (no `intersection`/`adjacent`/`serendipity`).
- Each query: 2–6 space-separated words, grounded in the extracted vocabulary, tagged with `research_area_id`.

Output schema:

```ts
const libraryOutputSchema = z.object({
  queries: z.array(
    z.object({
      query: z.string().min(1),
      research_area_id: z.number().int().min(1),
      rationale: z.string().default(''),
    }),
  ),
})
```

If the LLM returns fewer queries than research areas, the pipeline retries once; on second failure emits `error`.

Model: DeepSeek v3.2 at temperature 0.3. Same Anthropic-keyword strip as above.

## 14. Discovery modules

Direct TypeScript port of `iter/keyword_discovery.py`:

- `src/lib/ai/discovery/seeds.ts`:
  - `angles_to_seeds(areas: ResearchArea[]): string[]` — pure port of the Python helper. Strip parens, drop leading stopwords (`and / or / vs / the / for / of / with / to / on / in / by / as / at`), collapse adjacent dups, first 2 tokens.
  - `generateSeeds(draft: DigestDraft): Promise<string[]>` — LLM call against `preview-library-system.md` counterpart seed prompt. 3–5 literal seeds.
- `src/lib/ai/discovery/fetch-seeds.ts` — parallel OpenAlex fetches via extended `searchByKeyword` (see §15). 6-month window, per_page=50, select fields for vocabulary mining.
- `src/lib/ai/discovery/extract-vocab.ts` — pure-code port of the Python `extract_vocabulary` function. Returns `{ topics, subfields, fields, keywords, journals, sample_titles }` counters.
- `src/lib/ai/discovery/build-library.ts` — LLM call, prompt at `prompts/preview-library-system.md`, schema above.
- `src/lib/ai/discovery/run-library.ts` — parallel OpenAlex fetches for the generated queries against the last 7 days, per_page=15.

All modules are server-only (`import 'server-only'` at the top). Test harness alias in `vitest.config.ts` stays in place for future use even though tests are removed now (§18).

## 15. OpenAlex client changes

`src/lib/openalex/client.ts`:

- Add optional `filterMode?: 'search' | 'title_and_abstract.search'` (default `'search'` preserves current behavior). Preview uses `'title_and_abstract.search'`.
- Add optional `selectFields?: string[]`. When set, the client adds `&select=` to the URL. Preview seed fetch requests `['id','title','primary_topic','keywords','primary_location','publication_date','abstract_inverted_index']`.
- Existing polite-pool / retry / timeout behavior unchanged.

No other callers today — the one existing call in showcase is being deleted.

## 16. Cadence picker (`CadenceSection`)

Segmented control + conditional day-of-week + time + timezone.

Options:

| Choice | Cron (time = `HH:MM`) |
|---|---|
| Daily | `M H * * *` |
| Weekdays | `M H * * 1-5` |
| Weekly on `N` (0=Sun..6=Sat) | `M H * * N` |
| Monthly (1st) | `M H 1 * *` |

Timezone: defaults to `Intl.DateTimeFormat().resolvedOptions().timeZone`. Editable via a "Change" link that reveals an IANA searchable dropdown (reuse the existing IANA list in `src/lib/schedule/timezone.ts`).

Resolution: fully client-side in `src/lib/schedule/build-cron.ts`:

```ts
export function buildSchedule(input: {
  cadence: 'daily' | 'weekdays' | 'weekly' | 'monthly'
  dayOfWeek?: 0|1|2|3|4|5|6
  time: string                      // 'HH:MM'
  timezone: string                  // IANA
}): Schedule
```

`description` is built in the same file ("Every Monday at 08:00 (Europe/Istanbul)", etc.).

`src/lib/schedule/cron.ts` and `src/lib/schedule/timezone.ts` stay in place — still useful for a future update-chat agent; no current caller.

## 17. Subscribe (`SubscribeSection`)

Button disabled until preview is `ready` and `schedule` is set. On click:

1. Compose `DigestConfig` from draft + schedule + fixed `volume_target: 10` + `version: 1` + current ISO timestamps.
2. Validate against `digestConfigSchema`. On failure: inline error banner listing field paths; no submission.
3. On success: show a toast *"Subscription coming soon — your plan is saved for this session."*, no persistence, no auth.

Intentionally minimal. Auth + payment + persistence land in a later spec.

## 18. Deletions

**Code:**

- `src/lib/ai/showcase.ts`
- `src/lib/ai/showcase-planner.ts`
- `src/lib/ai/showcase-ranker.ts`
- `src/components/chat/showcase/` — all five files (`ShowcaseCard.tsx`, `ShowcaseLandedState.tsx`, `ShowcasePickCell.tsx` → migrated as `src/components/common/PaperRow.tsx`, `ShowcaseScanState.tsx`, `ShowcaseTrackingChips.tsx`)
- `src/components/config/ConfigSummary.tsx`
- `prompts/showcase-planner-system.md`
- `prompts/showcase-ranker-system.md`

**Tests:**

- All files under `test/`. `vitest.config.ts` is kept (still useful for the server-only alias, cheap to leave). `vitest` dev dependency stays in `package.json` for now.

**References:**

- `prompts/onboarding-system.md` — rewritten (not deleted).
- Any remaining `showcase*` imports across the tree — grep + remove.
- `CLAUDE.md` `corpusSanityCheck` references already retired; update architecture notes to mention Research Plan + preview pipeline.

## 19. Definition of done

1. `npm run typecheck` passes.
2. `npm run lint` passes.
3. Manual browser pass on the full flow against a real subject:
   - Chat collects the four fields in 4–6 exchanges.
   - Research Plan view renders with all fields editable.
   - Preview button fires; progress stream updates the UI with seeds → vocab → library → area-hit → curating.
   - Rendered digest honors a sectioned `output_style` (e.g. `"## Methods`, `## Clinical implications`, 1 paper per section").
   - Rendered digest honors a flowing `output_style` (e.g. "NYT op-ed, 200 words, one editorial").
   - References list shows 5 rows with working links.
   - Editing any field fades the preview, banner appears, Preview button re-enables.
   - Cadence form accepts all four cadence options, builds a valid cron string, description reads naturally.
   - Subscribe button shows a toast on success; shows a validation banner on malformed input.
4. `showcase*`, `ConfigSummary`, and all references are gone from the tree.
5. `test/` is empty.
6. Total per-preview spend measured against real OpenRouter usage ≈ $0.003 (±50%); logged at end of pipeline.

## 20. Open questions (resolve during plan-writing)

1. Markdown renderer: confirm `react-markdown` + `remark-gfm` is the right choice, or simpler hand-rolled since output is small (<300 words).
2. Should the chat ribbon remain expanded by default on small screens, or collapsed?
3. Where to put the "Preview your digest" CTA visually — below the output_style block inline, or in a sticky action bar at the bottom of the Research Plan card?
4. Rate limiting `/api/preview-digest` — for MVP we ship without; worth mentioning in the plan as a known gap.
5. `search_queries` in the draft: do we strip them from the Research Plan URL/localStorage snapshot to keep the persisted draft small, or keep them for the "re-preview reproducibility" value? Default: keep.

## 21. Supersedes / housekeeping

- `docs/superpowers/specs/2026-04-14-onboarding-showcase-design.md` — retire; link to this spec at the top.
- `docs/superpowers/specs/2026-04-15-showcase-broadsheet-rows-design.md` — retire; the broadsheet row pattern survives as `src/components/common/PaperRow.tsx`.
- `docs/superpowers/specs/2026-04-13-phase-1-onboarding-design.md` — partially superseded (cadence-in-chat + `generateConfig` paragraphs); retain otherwise for the pipeline/filter/curator architecture it still governs.
- `docs/2026-04-13-BRIEF.md` and `docs/2026-04-13-PRD.md` — product-truth docs; not edited here, but the preview-digest path in the PRD (lines 71, 885, 1040) is now implemented per this spec rather than as the 4-stage pipeline call.
