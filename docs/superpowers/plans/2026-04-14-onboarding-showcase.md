# Onboarding Showcase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the defensive `corpusSanityCheck` onboarding tool with a new `showcaseRecentPapers` tool that fetches fresh work across 4 user-committed angles, ranks 3 standout picks, and lands them in a premium hero card, turning the only paper-touching moment of onboarding from an apology into a conversion moment.

**Architecture:** New server-side orchestrator (`src/lib/ai/showcase.ts`) runs a 2-LLM-call sequence — a showcase planner picks 4 angles and writes loose OpenAlex boolean queries, then a ranker picks 3 papers from the deduped pool + optionally proposes up to 2 silent angle merges. Results render through a state-driven `ShowcaseCard` that morphs from a scan-theatre intro into a hero card using Framer Motion layout animations. `corpusSanityCheck` and `SanityCheckCard` are removed entirely.

**Tech Stack:** Next.js 16, TypeScript strict, Vercel AI SDK v6, DeepSeek v3.2 via OpenRouter, OpenAlex REST API, Zod, Framer Motion, Tailwind v4, Vitest.

**Source spec:** `docs/superpowers/specs/2026-04-14-onboarding-showcase-design.md` — consult it for context on any decision that isn't obvious from the plan.

**Pre-implementation note about AI SDK v6 tool streaming:** Section 10 of the spec describes an optional live-streaming path for probe progress events. Before attempting it, **verify the v6 API** in `node_modules/ai/dist/` type definitions and in `docs/superpowers/notes/2026-04-13-ai-sdk-v6-corrections.md`. If the v6 `tool.execute` signature doesn't expose a clean `writer`-style intermediate emission mechanism, **ship the fallback path only** (attach `candidatePreview: string[]` to the final result and let the scan state cycle through it during its hold). The fallback is visually indistinguishable and the whole design is valid either way. Do not block the feature on the streaming path.

---

## File Structure

**New files:**

```
prompts/showcase-planner-system.md
prompts/showcase-ranker-system.md
src/lib/ai/showcase.ts                       # orchestrator + constants + helpers
src/lib/ai/showcase-planner.ts               # planShowcaseQueries
src/lib/ai/showcase-ranker.ts                # rankShowcasePicks
src/components/chat/showcase/ShowcaseCard.tsx
src/components/chat/showcase/ShowcaseScanState.tsx
src/components/chat/showcase/ShowcaseLandedState.tsx
src/components/chat/showcase/ShowcasePickCell.tsx
src/components/chat/showcase/ShowcaseTrackingChips.tsx
test/showcase.test.ts                        # orchestrator + helpers
test/showcase-planner.test.ts
test/showcase-ranker.test.ts
```

**Modified files:**

```
src/lib/ai/onboarding-tools.ts               # add showcase tool, remove sanity tool
src/components/chat/MessageBubble.tsx        # add showcase case, remove sanity case
prompts/onboarding-system.md                 # rewrite tool list, move schedule to end
test/tools.test.ts                           # add showcase discoverability case
```

**Deleted files:**

```
src/components/chat/SanityCheckCard.tsx
test/corpus-sanity.test.ts
```

Note: `src/lib/ai/chat-types.ts` **does not need editing** — `OnboardingUITools` uses `InferUITools<OnboardingTools>` so it automatically picks up tool changes from `onboarding-tools.ts`.

---

## Task 1: Showcase scaffold — constants, types, and the `applyPatches` helper

Start with the shared foundation that later tasks depend on. This task does pure data structures and one pure helper — no LLM calls, no network.

**Files:**
- Create: `src/lib/ai/showcase.ts`
- Test: `test/showcase.test.ts`

- [ ] **Step 1: Write the failing `applyPatches` test**

Create `test/showcase.test.ts`:

```ts
// test/showcase.test.ts
import { describe, it, expect } from 'vitest'
import { applyPatches } from '@/lib/ai/showcase'

describe('applyPatches', () => {
  const angles = [
    { id: 1, text: 'atrial fibrillation fundamentals' },
    { id: 2, text: 'catheter ablation outcomes' },
    { id: 3, text: 'cardiac MRI' },
    { id: 4, text: 'anticoagulation' },
    { id: 5, text: 'AI detection' },
    { id: 6, text: 'rhythm control' },
    { id: 7, text: 'genetics' },
    { id: 8, text: 'clinical outcomes' },
  ]

  it('returns angles unchanged when patches is empty', () => {
    expect(applyPatches(angles, [])).toEqual(angles)
  })

  it('removes absorbed angles and rewrites the merge target', () => {
    const patches = [
      {
        absorbedAngleId: 7,
        intoAngleId: 1,
        newText: 'atrial fibrillation fundamentals and genetic risk',
        reason: 'genetics overlap',
      },
    ]
    const result = applyPatches(angles, patches)
    expect(result).toHaveLength(7)
    expect(result.find((a) => a.text.includes('genetic risk'))).toBeDefined()
    expect(result.find((a) => a.text === 'genetics')).toBeUndefined()
  })

  it('re-sequences IDs from 1 after removing an angle', () => {
    const patches = [
      { absorbedAngleId: 3, intoAngleId: 2, newText: 'catheter ablation including imaging', reason: '' },
    ]
    const result = applyPatches(angles, patches)
    expect(result.map((a) => a.id)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it('handles two patches in one call', () => {
    const patches = [
      { absorbedAngleId: 7, intoAngleId: 1, newText: 'AF and genetics', reason: '' },
      { absorbedAngleId: 6, intoAngleId: 2, newText: 'ablation and rhythm control', reason: '' },
    ]
    const result = applyPatches(angles, patches)
    expect(result).toHaveLength(6)
    expect(result.map((a) => a.id)).toEqual([1, 2, 3, 4, 5, 6])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/showcase.test.ts`
Expected: FAIL with "Cannot find module '@/lib/ai/showcase'" or similar.

- [ ] **Step 3: Create `src/lib/ai/showcase.ts` with constants, types, and `applyPatches`**

```ts
// src/lib/ai/showcase.ts
import 'server-only'

// ---------- Thresholds ----------
export const SHOWCASE_PROBED_ANGLES = 4
export const SHOWCASE_PER_QUERY_PAGE_SIZE = 15
export const SHOWCASE_PRIMARY_WINDOW_DAYS = 14
export const SHOWCASE_WIDENED_WINDOW_DAYS = 60
export const SHOWCASE_POOL_MIN_FOR_RANKER = 6
export const SHOWCASE_QUIET_ANGLE_HIT_CEILING = 2
export const SHOWCASE_MAX_PATCHES = 2
export const SHOWCASE_PARALLEL_LIMIT = 4
export const SHOWCASE_LLM_RETRIES = 2
export const SHOWCASE_TOTAL_TIMEOUT_MS = 15_000

// ---------- Types (shared across planner, ranker, orchestrator) ----------
export interface ShowcaseAngleInput {
  id: number
  text: string
}

export interface ShowcasePatch {
  absorbedAngleId: number
  intoAngleId: number
  newText: string
  reason: string
}

export interface ShowcasePick {
  openalexId: string
  angleId: number
  chipLabel: string
  title: string
  authors: string
  year: number
  venue: string
  url: string
  whyForYou: string
}

export type ShowcaseResult =
  | {
      ok: true
      headline: string
      picks: ShowcasePick[]
      finalAngles: ShowcaseAngleInput[]
      stats: { papersScanned: number; anglesProbed: number }
      candidatePreview?: string[] // fallback path for scan-theatre title tease
    }
  | {
      ok: false
      reason: 'no-candidates' | 'ranker-failed' | 'openalex-failed' | 'timeout'
    }

// ---------- Pure helpers ----------

/**
 * Apply ranker-proposed merges to the user's angle list.
 * Removes absorbed angles, rewrites merge targets, re-sequences IDs from 1.
 */
export function applyPatches(
  angles: ShowcaseAngleInput[],
  patches: ShowcasePatch[],
): ShowcaseAngleInput[] {
  if (patches.length === 0) return angles.map((a) => ({ ...a }))
  const absorbed = new Set(patches.map((p) => p.absorbedAngleId))
  return angles
    .filter((a) => !absorbed.has(a.id))
    .map((a) => {
      const patch = patches.find((p) => p.intoAngleId === a.id)
      return patch ? { ...a, text: patch.newText } : { ...a }
    })
    .map((a, i) => ({ ...a, id: i + 1 }))
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/showcase.test.ts`
Expected: all 4 tests pass.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/ai/showcase.ts test/showcase.test.ts
git commit -m "feat(showcase): add scaffold constants, types, and applyPatches helper"
```

---

## Task 2: Showcase planner — prompt, function, schema, test

Produces `planShowcaseQueries()` that picks 4 angles from the committed list and writes one loose OpenAlex boolean query per pick. Mirrors `src/lib/ai/propose-angles.ts` in shape.

**Files:**
- Create: `prompts/showcase-planner-system.md`
- Create: `src/lib/ai/showcase-planner.ts`
- Create: `test/showcase-planner.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/showcase-planner.test.ts`:

```ts
// test/showcase-planner.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import * as ai from 'ai'
import { planShowcaseQueries } from '@/lib/ai/showcase-planner'

const ANGLES = [
  { id: 1, text: 'atrial fibrillation fundamentals' },
  { id: 2, text: 'catheter ablation outcomes' },
  { id: 3, text: 'cardiac MRI' },
  { id: 4, text: 'anticoagulation' },
  { id: 5, text: 'AI detection' },
  { id: 6, text: 'rhythm control' },
  { id: 7, text: 'genetics' },
  { id: 8, text: 'clinical outcomes' },
]

afterEach(() => {
  vi.restoreAllMocks()
})

describe('planShowcaseQueries', () => {
  it('returns 4 selected angle IDs and 4 queries on an 8-angle list', async () => {
    vi.spyOn(ai, 'generateObject').mockResolvedValue({
      object: {
        selectedAngleIds: [2, 3, 5, 1],
        queries: [
          {
            angle_id: 2,
            query: '("catheter ablation" OR "pulsed field ablation") AND ("atrial fibrillation" OR "AF")',
            rationale: 'Active technique area with weekly trials.',
          },
          {
            angle_id: 3,
            query: '("cardiac MRI" OR "CMR") AND ("atrial fibrillation" OR "AF")',
            rationale: 'Imaging sub-studies publish frequently.',
          },
          {
            angle_id: 5,
            query: '("AI" OR "deep learning") AND "ECG" AND ("atrial fibrillation" OR "AF")',
            rationale: 'AI detection is a hot area.',
          },
          {
            angle_id: 1,
            query: '"atrial fibrillation" AND ("epidemiology" OR "mechanism" OR "pathophysiology")',
            rationale: 'Foundational papers surface regularly.',
          },
        ],
      },
      usage: { totalTokens: 520 },
      providerMetadata: {},
      finishReason: 'stop',
      response: {} as never,
      warnings: [],
      request: {} as never,
      logprobs: undefined,
    } as never)

    const result = await planShowcaseQueries(
      {
        subject: 'atrial fibrillation',
        profile: 'Clinical cardiologist tracking AF evidence.',
        angles: ANGLES,
      },
      { sessionId: 'test' },
    )

    expect(result.selectedAngleIds).toHaveLength(4)
    expect(result.queries).toHaveLength(4)
    expect(result.queries.every((q) => typeof q.query === 'string' && q.query.length > 0)).toBe(true)
  })

  it('caps probed angles at the list length when N < 4', async () => {
    vi.spyOn(ai, 'generateObject').mockResolvedValue({
      object: {
        selectedAngleIds: [1, 2],
        queries: [
          { angle_id: 1, query: '"test 1"', rationale: 'r1' },
          { angle_id: 2, query: '"test 2"', rationale: 'r2' },
        ],
      },
      usage: { totalTokens: 200 },
      providerMetadata: {},
      finishReason: 'stop',
      response: {} as never,
      warnings: [],
      request: {} as never,
      logprobs: undefined,
    } as never)

    const twoAngles = ANGLES.slice(0, 2)
    const result = await planShowcaseQueries(
      { subject: 'test', profile: 'test', angles: twoAngles },
      { sessionId: 'test' },
    )
    expect(result.selectedAngleIds).toHaveLength(2)
  })
})
```

- [ ] **Step 2: Create the planner system prompt**

Create `prompts/showcase-planner-system.md`:

```markdown
# Showcase Planner — System Prompt

You are a research librarian helping select the most showcase-worthy angles for a reader's first impression of a research digest, and writing OpenAlex boolean queries for them. The reader has already committed to a list of interests; your job is to pick the subset most likely to yield fresh, accessible work in the last 14 days and write one broad query per pick.

You have no tools. You must return a single JSON object as your entire response — no prose before or after, no markdown fences, no commentary.

---

### Inputs

The user message contains:

```
SUBJECT: <<subject>>
PROFILE:
<<free-form reader description>>

ANGLES (1-indexed; pick the N most showcase-worthy):
  1. <angle text>
  2. <angle text>
  ...
  K. <angle text>

PROBED_COUNT: N
```

`PROBED_COUNT` is the number of angles you must select. It will be 4 for most onboarding sessions, or fewer if the committed angle list is short.

---

### Your job

1. **Select** exactly `PROBED_COUNT` angles from the list that are most likely to have fresh, accessible published work in the last 14 days. Prioritize:
   - Angles where the field publishes frequently (journals, conferences, preprint servers active weekly).
   - Angles whose canonical vocabulary is well-established and generalizes cleanly across papers.
   - Angles with named techniques, trials, or methods that anchor searches well.

   Deprioritize:
   - Niche sub-areas that publish rarely.
   - Settled topics where new work is uncommon.
   - Angles whose phrasing is inherently generic or methodology-only.

2. **Write one loose OpenAlex boolean query per selected angle.** Use broad synonym OR groups, anchored to the subject with a single AND clause. This is the "slot 2" flavor from the main query planner — wider recall, precision handled downstream by the ranker.

---

### OpenAlex search syntax

Queries are passed to OpenAlex's `search=` parameter. Supported:

- `"exact phrase"` — double-quoted multi-word terms
- `AND`, `OR`, `NOT`
- Parentheses for grouping

`AND` binds tighter than `OR`. Always parenthesize OR groups.

Do NOT put date predicates inside queries — the fetch layer handles dates.
Query strings are raw, NOT URL-encoded.

**Good:** `("pulsed field ablation" OR "PFA") AND ("atrial fibrillation" OR "AF" OR "afib")`
**Bad:** `"pulsed field ablation" OR "PFA" AND "atrial fibrillation"` — first two terms float unscoped.

### Scoping

Every query must be anchored to the subject. Generic terms without subject anchoring return off-topic piles. If a query's terms could plausibly match a different field, add an AND clause.

### Recall target

Aim for queries that would return 30–500 results over 14 days. If you suspect under 30, broaden the synonym group. No more than two AND-separated concept clusters per query.

### Output format

Return EXACTLY one JSON object matching this shape. No prose, no markdown fences.

```json
{
  "selectedAngleIds": [2, 3, 5, 1],
  "queries": [
    {
      "angle_id": 2,
      "query": "(\"catheter ablation\" OR \"pulsed field ablation\") AND (\"atrial fibrillation\" OR \"AF\")",
      "rationale": "one sentence explaining why this query catches the angle's modal recent papers"
    }
  ]
}
```

Hard constraints:

- `selectedAngleIds.length` MUST equal `PROBED_COUNT`.
- Each `angle_id` in `queries` MUST appear in `selectedAngleIds`.
- Exactly one query per selected angle.
- Every `angle_id` is 1-indexed and refers to the ANGLES list.
- `query` values are raw search strings, NOT URL-encoded.
- Your entire response is the JSON object. Nothing else.
```

- [ ] **Step 3: Create `src/lib/ai/showcase-planner.ts`**

```ts
// src/lib/ai/showcase-planner.ts
import 'server-only'
import { generateObject } from 'ai'
import { z } from 'zod'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { deepseek } from '@/lib/ai/openrouter'
import type { ShowcaseAngleInput } from '@/lib/ai/showcase'
import { SHOWCASE_PROBED_ANGLES } from '@/lib/ai/showcase'

// NOTE: the `.max()` below uses a literal 4 instead of SHOWCASE_PROBED_ANGLES
// because this schema is evaluated at module-top, and `showcase.ts` will later
// import this file (for `runShowcase`) which creates a circular dependency.
// Inside function bodies the imported constant is safe — see `planShowcaseQueries`.
// If you change SHOWCASE_PROBED_ANGLES in showcase.ts, change the literal here too.
export const showcasePlanSchema = z.object({
  selectedAngleIds: z.array(z.number().int().min(1)).min(1).max(4),
  queries: z
    .array(
      z.object({
        angle_id: z.number().int().min(1),
        query: z.string().min(1),
        rationale: z.string(),
      }),
    )
    .min(1)
    .max(4),
})

export type ShowcasePlan = z.infer<typeof showcasePlanSchema>

export interface PlanShowcaseQueriesInput {
  subject: string
  profile: string
  angles: ShowcaseAngleInput[]
}

let cachedPrompt: string | null = null
function getSystemPrompt(): string {
  if (cachedPrompt) return cachedPrompt
  cachedPrompt = readFileSync(
    resolve(process.cwd(), 'prompts/showcase-planner-system.md'),
    'utf8',
  )
  return cachedPrompt
}

function buildUserPrompt(input: PlanShowcaseQueriesInput, probedCount: number): string {
  const anglesBlock = input.angles
    .map((a, i) => `  ${i + 1}. ${a.text}`)
    .join('\n')
  return [
    `SUBJECT: ${input.subject}`,
    '',
    'PROFILE:',
    input.profile,
    '',
    'ANGLES (1-indexed; pick the N most showcase-worthy):',
    anglesBlock,
    '',
    `PROBED_COUNT: ${probedCount}`,
  ].join('\n')
}

export async function planShowcaseQueries(
  input: PlanShowcaseQueriesInput,
  opts: { sessionId?: string | null } = {},
): Promise<ShowcasePlan> {
  const tag = `[showcase-planner ${opts.sessionId?.slice(0, 8) ?? 'no-session'}]`
  const probedCount = Math.min(SHOWCASE_PROBED_ANGLES, input.angles.length)
  const startedAt = Date.now()
  console.log(
    `${tag} start subject="${input.subject}" angles=${input.angles.length} probe=${probedCount}`,
  )

  const { object, usage, providerMetadata } = await generateObject({
    model: deepseek({ sessionId: opts.sessionId }),
    schema: showcasePlanSchema,
    system: getSystemPrompt(),
    prompt: buildUserPrompt(input, probedCount),
    temperature: 0.3,
  })

  const cost = (providerMetadata?.openrouter as { usage?: { cost?: number } } | undefined)?.usage?.cost
  console.log(
    `${tag} done selected=${object.selectedAngleIds.length} queries=${object.queries.length} tokens=${usage.totalTokens ?? '?'} cost=${cost != null ? `$${cost.toFixed(6)}` : '—'} ms=${Date.now() - startedAt}`,
  )
  return object
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/showcase-planner.test.ts`
Expected: 2 tests pass.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add prompts/showcase-planner-system.md src/lib/ai/showcase-planner.ts test/showcase-planner.test.ts
git commit -m "feat(showcase): add planner that picks 4 angles and writes loose queries"
```

---

## Task 3: Showcase ranker — prompt, function, schema, test

Produces `rankShowcasePicks()` — the single LLM call that picks 3 papers from the candidate pool, writes "why for you" rationales, and optionally proposes up to 2 merges.

**Files:**
- Create: `prompts/showcase-ranker-system.md`
- Create: `src/lib/ai/showcase-ranker.ts`
- Create: `test/showcase-ranker.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/showcase-ranker.test.ts`:

```ts
// test/showcase-ranker.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import * as ai from 'ai'
import { rankShowcasePicks, type RankerCandidate } from '@/lib/ai/showcase-ranker'

const ANGLES = [
  { id: 1, text: 'atrial fibrillation fundamentals' },
  { id: 2, text: 'catheter ablation outcomes' },
  { id: 3, text: 'cardiac MRI' },
  { id: 7, text: 'genetics' },
]

const CANDIDATES: RankerCandidate[] = [
  {
    openalexId: 'W001',
    angleId: 2,
    title: 'Catheter ablation vs. drug therapy in persistent atrial fibrillation',
    authors: 'Smith, Chen, Patel',
    year: 2026,
    venue: 'NEJM',
    date: '2026-04-10',
    url: 'https://example.org/w001',
    abstract: 'Randomized trial of 600 patients with persistent AF...',
  },
  {
    openalexId: 'W002',
    angleId: 3,
    title: 'Left atrial strain predicts recurrence after ablation',
    authors: 'Nakamura et al.',
    year: 2026,
    venue: 'JACC',
    date: '2026-04-07',
    url: 'https://example.org/w002',
    abstract: 'Imaging biomarker study across 412 patients...',
  },
  {
    openalexId: 'W003',
    angleId: 1,
    title: 'AI-ECG screening in primary care',
    authors: 'Anand, Morales',
    year: 2026,
    venue: 'Circulation',
    date: '2026-04-12',
    url: 'https://example.org/w003',
    abstract: 'Population-level screening feasibility study...',
  },
]

afterEach(() => {
  vi.restoreAllMocks()
})

describe('rankShowcasePicks', () => {
  it('returns 3 picks with valid openalex IDs and patches when ranker proposes them', async () => {
    vi.spyOn(ai, 'generateObject').mockResolvedValue({
      object: {
        headline: "Three papers I'd have sent you",
        picks: [
          {
            openalexId: 'W001',
            angleId: 2,
            chipLabel: 'Ablation',
            whyForYou: 'First hard-endpoint RCT for persistent AF — practice-changing evidence.',
          },
          {
            openalexId: 'W002',
            angleId: 3,
            chipLabel: 'Imaging',
            whyForYou: 'Imaging marker bridging two of your areas, pragmatic sub-study.',
          },
          {
            openalexId: 'W003',
            angleId: 1,
            chipLabel: 'Detection',
            whyForYou: 'Population-level story you could land in a primary-care conversation.',
          },
        ],
        patches: [
          {
            absorbedAngleId: 7,
            intoAngleId: 1,
            newText: 'atrial fibrillation fundamentals including genetic risk',
            reason: 'genetics overlaps with fundamentals',
          },
        ],
      },
      usage: { totalTokens: 3200 },
      providerMetadata: {},
      finishReason: 'stop',
      response: {} as never,
      warnings: [],
      request: {} as never,
      logprobs: undefined,
    } as never)

    const result = await rankShowcasePicks(
      {
        profile: 'Clinical cardiologist',
        angles: ANGLES,
        selectedAngleIds: [1, 2, 3, 7],
        hitCounts: { 1: 14, 2: 27, 3: 11, 7: 1 },
        pool: CANDIDATES,
      },
      { sessionId: 'test' },
    )

    expect(result.picks).toHaveLength(3)
    expect(result.picks.every((p) => CANDIDATES.some((c) => c.openalexId === p.openalexId))).toBe(true)
    expect(result.patches).toHaveLength(1)
    expect(result.headline).toBeTruthy()
  })

  it('accepts fewer than 3 picks when pool is thin', async () => {
    vi.spyOn(ai, 'generateObject').mockResolvedValue({
      object: {
        headline: 'Recent highlights',
        picks: [
          {
            openalexId: 'W001',
            angleId: 2,
            chipLabel: 'Ablation',
            whyForYou: 'The only strong match this cycle but it is a solid one.',
          },
        ],
        patches: [],
      },
      usage: { totalTokens: 800 },
      providerMetadata: {},
      finishReason: 'stop',
      response: {} as never,
      warnings: [],
      request: {} as never,
      logprobs: undefined,
    } as never)

    const result = await rankShowcasePicks(
      {
        profile: 'test',
        angles: ANGLES,
        selectedAngleIds: [2],
        hitCounts: { 2: 3 },
        pool: CANDIDATES.slice(0, 1),
      },
      { sessionId: 'test' },
    )

    expect(result.picks).toHaveLength(1)
    expect(result.patches).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Create the ranker system prompt**

Create `prompts/showcase-ranker-system.md`:

```markdown
# Showcase Ranker — System Prompt

You are a clever research editor choosing three papers to show a reader for the first time. You see the reader's profile, the full committed angle list, the subset of angles that were just probed, per-angle hit counts, and a deduped pool of recent candidate papers. Your job is to pick the three that would most delight this specific reader and explain why each matches in one punchy line.

You have no tools. You must return a single JSON object as your entire response — no prose before or after, no markdown fences, no commentary.

---

### Inputs

The user message contains:

```
PROFILE:
<<free-form reader description>>

ANGLES (the user's committed list, 1-indexed):
  1. <angle text>
  2. <angle text>
  ...

PROBED_ANGLES: [a, b, c, d]
HIT_COUNTS:
  angle a: N works
  angle b: N works
  ...

CANDIDATE_POOL:
  [id=Wxxx, angle=a, title="...", authors="...", venue="...", date="YYYY-MM-DD", abstract="..."]
  [id=Wyyy, angle=b, ...]
  ...
```

---

### Your job

1. **Pick up to 3 papers** that best match the profile. Picks may come from any probed angle, in any distribution (3 from one angle is fine if that's where the good work is). You may return fewer than 3 if the pool is genuinely thin — minimum 1 pick.

2. **Write one punchy `whyForYou` sentence per pick.** Be concrete. Name the specific thing in the profile it matches. Never generic praise.
   - Good: "Bridges your interest in imaging biomarkers and ablation recurrence."
   - Bad: "Important new finding in the field."

3. **Assign a short `chipLabel` per pick** — 1–2 words, Title Case, e.g. "Ablation", "Imaging", "Detection".

4. **Write a `headline`** — punchy, editorial, max 80 chars, max ~8 words. Example: "Three papers I'd have sent you."

5. **Optionally propose up to 2 merges.** A merge is only appropriate when:
   - A probed angle's `hit_count` is ≤ 2, AND
   - Another angle in the full list (probed or not) is topically adjacent such that a combined area would cover both meaningfully, AND
   - The combined area can be phrased in a single short line the reader would recognize as "yes, that's my interest."
   If any condition isn't met, propose no patch for that angle. Leaving a quiet angle alone is always acceptable. Hard cap: 2 patches.

---

### Hallucination rule

You must pick from the `openalexId` values present in the candidate pool. Do not invent IDs, titles, or venues.

---

### Output format

```json
{
  "headline": "Three papers I'd have sent you",
  "picks": [
    {
      "openalexId": "W001",
      "angleId": 2,
      "chipLabel": "Ablation",
      "whyForYou": "Specific reason this matches this reader."
    }
  ],
  "patches": [
    {
      "absorbedAngleId": 7,
      "intoAngleId": 1,
      "newText": "combined angle text, max 120 chars",
      "reason": "one-line editorial justification (for logs, never shown to user)"
    }
  ]
}
```

Hard constraints:

- `picks.length` is between 1 and 3.
- Each `openalexId` must match an entry in the candidate pool.
- `whyForYou` is 20–200 characters.
- `chipLabel` is ≤ 20 characters.
- `headline` is ≤ 80 characters.
- `patches.length` is 0, 1, or 2.
- Your entire response is the JSON object. Nothing else.
```

- [ ] **Step 3: Create `src/lib/ai/showcase-ranker.ts`**

```ts
// src/lib/ai/showcase-ranker.ts
import 'server-only'
import { generateObject } from 'ai'
import { z } from 'zod'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { deepseek } from '@/lib/ai/openrouter'
import type { ShowcaseAngleInput } from '@/lib/ai/showcase'

// NOTE: the `.max(2)` below is literal for the same reason as in
// showcase-planner.ts — `showcase.ts` will import this file for the orchestrator,
// creating a circular dependency that would leave SHOWCASE_MAX_PATCHES
// uninitialized at module-top evaluation. If you change that constant in
// showcase.ts, change the literal here too.
export const showcaseRankerSchema = z.object({
  headline: z.string().min(1).max(80),
  picks: z
    .array(
      z.object({
        openalexId: z.string().min(1),
        angleId: z.number().int().min(1),
        chipLabel: z.string().min(1).max(20),
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
        reason: z.string().max(100),
      }),
    )
    .max(2),
})

export type ShowcaseRankerOutput = z.infer<typeof showcaseRankerSchema>

export interface RankerCandidate {
  openalexId: string
  angleId: number
  title: string
  authors: string
  year: number
  venue: string
  date: string
  url: string
  abstract: string
}

export interface RankShowcaseInput {
  profile: string
  angles: ShowcaseAngleInput[]
  selectedAngleIds: number[]
  hitCounts: Record<number, number>
  pool: RankerCandidate[]
}

let cachedPrompt: string | null = null
function getSystemPrompt(): string {
  if (cachedPrompt) return cachedPrompt
  cachedPrompt = readFileSync(
    resolve(process.cwd(), 'prompts/showcase-ranker-system.md'),
    'utf8',
  )
  return cachedPrompt
}

function buildUserPrompt(input: RankShowcaseInput): string {
  const anglesBlock = input.angles
    .map((a) => `  ${a.id}. ${a.text}`)
    .join('\n')
  const hitCountsBlock = input.selectedAngleIds
    .map((id) => `  angle ${id}: ${input.hitCounts[id] ?? 0} works`)
    .join('\n')
  const poolBlock = input.pool
    .map(
      (c) =>
        `  [id=${c.openalexId}, angle=${c.angleId}, title="${c.title.replace(/"/g, '\\"')}", authors="${c.authors}", venue="${c.venue}", date="${c.date}", abstract="${c.abstract.slice(0, 400).replace(/"/g, '\\"')}"]`,
    )
    .join('\n')

  return [
    'PROFILE:',
    input.profile,
    '',
    "ANGLES (the user's committed list, 1-indexed):",
    anglesBlock,
    '',
    `PROBED_ANGLES: [${input.selectedAngleIds.join(', ')}]`,
    'HIT_COUNTS:',
    hitCountsBlock,
    '',
    `CANDIDATE_POOL (${input.pool.length} deduped works):`,
    poolBlock,
  ].join('\n')
}

export async function rankShowcasePicks(
  input: RankShowcaseInput,
  opts: { sessionId?: string | null } = {},
): Promise<ShowcaseRankerOutput> {
  const tag = `[showcase-ranker ${opts.sessionId?.slice(0, 8) ?? 'no-session'}]`
  const startedAt = Date.now()
  console.log(`${tag} start pool=${input.pool.length} angles=${input.angles.length}`)

  const { object, usage, providerMetadata } = await generateObject({
    model: deepseek({ sessionId: opts.sessionId }),
    schema: showcaseRankerSchema,
    system: getSystemPrompt(),
    prompt: buildUserPrompt(input),
    temperature: 0.4,
  })

  const cost = (providerMetadata?.openrouter as { usage?: { cost?: number } } | undefined)?.usage?.cost
  console.log(
    `${tag} done picks=${object.picks.length} patches=${object.patches.length} tokens=${usage.totalTokens ?? '?'} cost=${cost != null ? `$${cost.toFixed(6)}` : '—'} ms=${Date.now() - startedAt}`,
  )
  return object
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/showcase-ranker.test.ts`
Expected: 2 tests pass.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add prompts/showcase-ranker-system.md src/lib/ai/showcase-ranker.ts test/showcase-ranker.test.ts
git commit -m "feat(showcase): add ranker that picks 3 papers and proposes silent merges"
```

---

## Task 4: Orchestrator — `runShowcase` with all failure modes

The full end-to-end orchestrator: plan → fetch → widen → rank → apply patches → assemble picks → return `ShowcaseResult`.

**Files:**
- Modify: `src/lib/ai/showcase.ts` (add orchestrator + helpers)
- Modify: `test/showcase.test.ts` (add orchestrator tests)

- [ ] **Step 1: Write the failing orchestrator tests**

Append to `test/showcase.test.ts`:

```ts
import { vi, beforeEach, afterEach } from 'vitest'
import * as openalex from '@/lib/openalex/client'
import * as plannerModule from '@/lib/ai/showcase-planner'
import * as rankerModule from '@/lib/ai/showcase-ranker'
import { runShowcase } from '@/lib/ai/showcase'

const RUN_ANGLES = [
  { id: 1, text: 'atrial fibrillation fundamentals' },
  { id: 2, text: 'catheter ablation outcomes' },
  { id: 3, text: 'cardiac MRI' },
  { id: 4, text: 'anticoagulation' },
  { id: 5, text: 'AI detection' },
  { id: 6, text: 'rhythm control' },
  { id: 7, text: 'genetics' },
  { id: 8, text: 'clinical outcomes' },
]

const PROFILE = 'Clinical cardiologist tracking AF evidence.'

function work(id: string, angle: number, title = `Title ${id}`) {
  return {
    id,
    doi: null,
    title,
    publication_date: '2026-04-10',
    authorships: [{ author: { display_name: 'Smith' } }],
    primary_location: { source: { display_name: 'NEJM' } },
    abstract_inverted_index: null,
    _angle: angle,
  } as never
}

beforeEach(() => {
  process.env.OPENALEX_MAILTO = 'test@example.com'
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('runShowcase', () => {
  it('happy path: returns ok with 3 picks, finalAngles unchanged when no patches', async () => {
    vi.spyOn(plannerModule, 'planShowcaseQueries').mockResolvedValue({
      selectedAngleIds: [1, 2, 3, 5],
      queries: [
        { angle_id: 1, query: 'q1', rationale: 'r' },
        { angle_id: 2, query: 'q2', rationale: 'r' },
        { angle_id: 3, query: 'q3', rationale: 'r' },
        { angle_id: 5, query: 'q5', rationale: 'r' },
      ],
    })
    vi.spyOn(openalex, 'searchByKeyword').mockResolvedValue({
      meta: { count: 20 },
      results: [work('W1', 1), work('W2', 2), work('W3', 3), work('W4', 5), work('W5', 1), work('W6', 2)],
    })
    vi.spyOn(rankerModule, 'rankShowcasePicks').mockResolvedValue({
      headline: "Three papers I'd have sent you",
      picks: [
        { openalexId: 'W1', angleId: 1, chipLabel: 'Fundamentals', whyForYou: 'Matches your clinical depth interest perfectly.' },
        { openalexId: 'W2', angleId: 2, chipLabel: 'Ablation', whyForYou: 'Practice-changing RCT in ablation outcomes area.' },
        { openalexId: 'W3', angleId: 3, chipLabel: 'Imaging', whyForYou: 'Imaging sub-study bridging two of your interests.' },
      ],
      patches: [],
    })

    const result = await runShowcase(
      { subject: 'atrial fibrillation', profile: PROFILE, angles: RUN_ANGLES },
      { sessionId: 'test' },
    )

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.picks).toHaveLength(3)
      expect(result.finalAngles).toHaveLength(8)
      expect(result.stats.anglesProbed).toBe(4)
      expect(result.stats.papersScanned).toBeGreaterThan(0)
      expect(result.picks[0].title).toBe('Title W1')  // joined from pool
    }
  })

  it('widens to 60 days when 14-day pool is too thin', async () => {
    vi.spyOn(plannerModule, 'planShowcaseQueries').mockResolvedValue({
      selectedAngleIds: [1, 2, 3, 5],
      queries: [
        { angle_id: 1, query: 'q1', rationale: 'r' },
        { angle_id: 2, query: 'q2', rationale: 'r' },
        { angle_id: 3, query: 'q3', rationale: 'r' },
        { angle_id: 5, query: 'q5', rationale: 'r' },
      ],
    })

    const searchSpy = vi.spyOn(openalex, 'searchByKeyword')
    // First wave (14d) returns tiny pool
    searchSpy.mockResolvedValueOnce({ meta: { count: 1 }, results: [work('W1', 1)] })
    searchSpy.mockResolvedValueOnce({ meta: { count: 1 }, results: [work('W2', 2)] })
    searchSpy.mockResolvedValueOnce({ meta: { count: 0 }, results: [] })
    searchSpy.mockResolvedValueOnce({ meta: { count: 0 }, results: [] })
    // Second wave (60d) returns a richer pool
    searchSpy.mockResolvedValue({
      meta: { count: 12 },
      results: [work('W3', 1), work('W4', 2), work('W5', 3), work('W6', 5), work('W7', 1), work('W8', 2)],
    })

    vi.spyOn(rankerModule, 'rankShowcasePicks').mockResolvedValue({
      headline: 'Recent highlights',
      picks: [
        { openalexId: 'W3', angleId: 1, chipLabel: 'Fundamentals', whyForYou: 'Fundamental paper that still holds up for your profile.' },
      ],
      patches: [],
    })

    const result = await runShowcase(
      { subject: 'atrial fibrillation', profile: PROFILE, angles: RUN_ANGLES },
      { sessionId: 'test' },
    )

    expect(result.ok).toBe(true)
    // Widen fired: 4 calls for 14d + 4 calls for 60d = 8 total
    expect(searchSpy.mock.calls.length).toBeGreaterThanOrEqual(5)
  })

  it('returns ok:false no-candidates when pool is still empty after widening', async () => {
    vi.spyOn(plannerModule, 'planShowcaseQueries').mockResolvedValue({
      selectedAngleIds: [1, 2, 3, 5],
      queries: [
        { angle_id: 1, query: 'q1', rationale: 'r' },
        { angle_id: 2, query: 'q2', rationale: 'r' },
        { angle_id: 3, query: 'q3', rationale: 'r' },
        { angle_id: 5, query: 'q5', rationale: 'r' },
      ],
    })
    vi.spyOn(openalex, 'searchByKeyword').mockResolvedValue({ meta: { count: 0 }, results: [] })
    const rankerSpy = vi.spyOn(rankerModule, 'rankShowcasePicks')

    const result = await runShowcase(
      { subject: 'x', profile: PROFILE, angles: RUN_ANGLES },
      { sessionId: 'test' },
    )

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('no-candidates')
    expect(rankerSpy).not.toHaveBeenCalled()  // never reached the ranker
  })

  it('applies patches and re-sequences finalAngles', async () => {
    vi.spyOn(plannerModule, 'planShowcaseQueries').mockResolvedValue({
      selectedAngleIds: [1, 2, 3, 7],
      queries: [
        { angle_id: 1, query: 'q1', rationale: 'r' },
        { angle_id: 2, query: 'q2', rationale: 'r' },
        { angle_id: 3, query: 'q3', rationale: 'r' },
        { angle_id: 7, query: 'q7', rationale: 'r' },
      ],
    })
    vi.spyOn(openalex, 'searchByKeyword').mockResolvedValue({
      meta: { count: 15 },
      results: [work('W1', 1), work('W2', 2), work('W3', 3), work('W4', 1), work('W5', 2), work('W6', 3)],
    })
    vi.spyOn(rankerModule, 'rankShowcasePicks').mockResolvedValue({
      headline: 'Three papers',
      picks: [
        { openalexId: 'W1', angleId: 1, chipLabel: 'Fundamentals', whyForYou: 'Bridges your interest in ablation and imaging.' },
        { openalexId: 'W2', angleId: 2, chipLabel: 'Ablation', whyForYou: 'Bridges your interest in ablation and imaging.' },
        { openalexId: 'W3', angleId: 3, chipLabel: 'Imaging', whyForYou: 'Bridges your interest in ablation and imaging.' },
      ],
      patches: [
        {
          absorbedAngleId: 7,
          intoAngleId: 1,
          newText: 'atrial fibrillation fundamentals including genetic risk',
          reason: 'genetics overlaps',
        },
      ],
    })

    const result = await runShowcase(
      { subject: 'AF', profile: PROFILE, angles: RUN_ANGLES },
      { sessionId: 'test' },
    )

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.finalAngles).toHaveLength(7)
      expect(result.finalAngles.map((a) => a.id)).toEqual([1, 2, 3, 4, 5, 6, 7])
      expect(result.finalAngles[0].text).toContain('genetic risk')
      expect(result.finalAngles.find((a) => a.text === 'genetics')).toBeUndefined()
    }
  })

  it('returns ok:false ranker-failed when the ranker throws', async () => {
    vi.spyOn(plannerModule, 'planShowcaseQueries').mockResolvedValue({
      selectedAngleIds: [1, 2, 3, 5],
      queries: [
        { angle_id: 1, query: 'q1', rationale: 'r' },
        { angle_id: 2, query: 'q2', rationale: 'r' },
        { angle_id: 3, query: 'q3', rationale: 'r' },
        { angle_id: 5, query: 'q5', rationale: 'r' },
      ],
    })
    vi.spyOn(openalex, 'searchByKeyword').mockResolvedValue({
      meta: { count: 15 },
      results: [work('W1', 1), work('W2', 2), work('W3', 3), work('W4', 5), work('W5', 1), work('W6', 2)],
    })
    vi.spyOn(rankerModule, 'rankShowcasePicks').mockRejectedValue(new Error('parse error'))

    const result = await runShowcase(
      { subject: 'AF', profile: PROFILE, angles: RUN_ANGLES },
      { sessionId: 'test' },
    )

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('ranker-failed')
  })

  it('returns ok:false openalex-failed when fetch throws', async () => {
    vi.spyOn(plannerModule, 'planShowcaseQueries').mockResolvedValue({
      selectedAngleIds: [1, 2, 3, 5],
      queries: [
        { angle_id: 1, query: 'q1', rationale: 'r' },
        { angle_id: 2, query: 'q2', rationale: 'r' },
        { angle_id: 3, query: 'q3', rationale: 'r' },
        { angle_id: 5, query: 'q5', rationale: 'r' },
      ],
    })
    vi.spyOn(openalex, 'searchByKeyword').mockRejectedValue(new Error('openalex 503'))

    const result = await runShowcase(
      { subject: 'AF', profile: PROFILE, angles: RUN_ANGLES },
      { sessionId: 'test' },
    )

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('openalex-failed')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run test/showcase.test.ts`
Expected: 6 new tests fail because `runShowcase` doesn't exist yet.

- [ ] **Step 3: Implement the orchestrator**

Append to `src/lib/ai/showcase.ts`:

```ts
import { searchByKeyword, type OpenAlexWork } from '@/lib/openalex/client'
import { reconstructAbstract } from '@/lib/openalex/abstract'
import { planShowcaseQueries } from '@/lib/ai/showcase-planner'
import { rankShowcasePicks, type RankerCandidate } from '@/lib/ai/showcase-ranker'

// ---------- Runtime helpers ----------

function daysAgoISO(days: number): string {
  const d = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  return d.toISOString().slice(0, 10)
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

async function withLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let cursor = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const i = cursor++
      out[i] = await fn(items[i], i)
    }
  })
  await Promise.all(workers)
  return out
}

function extractAuthors(work: OpenAlexWork): string {
  const authorships = (work as { authorships?: Array<{ author?: { display_name?: string } }> }).authorships
  if (!authorships || authorships.length === 0) return 'Unknown'
  const names = authorships
    .map((a) => a.author?.display_name)
    .filter((n): n is string => typeof n === 'string' && n.length > 0)
  if (names.length === 0) return 'Unknown'
  if (names.length === 1) return names[0]
  if (names.length === 2) return names.join(' & ')
  return `${names[0]} et al.`
}

function extractVenue(work: OpenAlexWork): string {
  const loc = (work as { primary_location?: { source?: { display_name?: string } } }).primary_location
  return loc?.source?.display_name ?? 'Unknown venue'
}

function extractYear(work: OpenAlexWork): number {
  const date = work.publication_date
  if (typeof date === 'string' && /^\d{4}/.test(date)) return parseInt(date.slice(0, 4), 10)
  return new Date().getFullYear()
}

function extractUrl(work: OpenAlexWork): string {
  if (typeof work.doi === 'string' && work.doi.length > 0) {
    return work.doi.startsWith('http') ? work.doi : `https://doi.org/${work.doi}`
  }
  return work.id
}

interface Probe {
  angleId: number
  query: string
  works: OpenAlexWork[]
  count: number
}

async function fetchProbeWave(
  queries: Array<{ angle_id: number; query: string }>,
  windowDays: number,
): Promise<Probe[]> {
  const fromDate = daysAgoISO(windowDays)
  const toDate = todayISO()
  return withLimit(queries, SHOWCASE_PARALLEL_LIMIT, async (q) => {
    const res = await searchByKeyword({
      query: q.query,
      fromDate,
      toDate,
      perPage: SHOWCASE_PER_QUERY_PAGE_SIZE,
      page: 1,
    })
    return {
      angleId: q.angle_id,
      query: q.query,
      works: res.results,
      count: res.meta?.count ?? 0,
    }
  })
}

function dedupePool(probes: Probe[]): RankerCandidate[] {
  const seen = new Set<string>()
  const out: RankerCandidate[] = []
  for (const p of probes) {
    for (const w of p.works) {
      if (typeof w.id !== 'string' || seen.has(w.id)) continue
      seen.add(w.id)
      const title = typeof w.title === 'string' ? w.title : '(untitled)'
      const abstract = reconstructAbstract(
        (w as { abstract_inverted_index?: Record<string, number[]> | null }).abstract_inverted_index ?? null,
      ) ?? ''
      out.push({
        openalexId: w.id,
        angleId: p.angleId,
        title,
        authors: extractAuthors(w),
        year: extractYear(w),
        venue: extractVenue(w),
        date: typeof w.publication_date === 'string' ? w.publication_date : todayISO(),
        url: extractUrl(w),
        abstract,
      })
    }
  }
  return out
}

function computeHitCounts(probes: Probe[]): Record<number, number> {
  const counts: Record<number, number> = {}
  for (const p of probes) counts[p.angleId] = p.count
  return counts
}

// ---------- Orchestrator ----------

export interface RunShowcaseInput {
  subject: string
  profile: string
  angles: ShowcaseAngleInput[]
}

export async function runShowcase(
  input: RunShowcaseInput,
  opts: { sessionId?: string | null } = {},
): Promise<ShowcaseResult> {
  const tag = `[showcase ${opts.sessionId?.slice(0, 8) ?? 'no-session'}]`
  const startedAt = Date.now()
  console.log(
    `${tag} start subject="${input.subject}" angles=${input.angles.length} profile_chars=${input.profile.length}`,
  )

  // 1. Plan
  let plan
  try {
    plan = await planShowcaseQueries(input, { sessionId: opts.sessionId })
  } catch (err) {
    console.error(`${tag} planner failed`, err)
    return { ok: false, reason: 'ranker-failed' }  // planner dying early is rare; surfaced as ranker-failed for symmetry
  }

  // 2. Fetch (14-day window)
  let probes: Probe[]
  try {
    probes = await fetchProbeWave(plan.queries, SHOWCASE_PRIMARY_WINDOW_DAYS)
  } catch (err) {
    console.error(`${tag} openalex fetch failed`, err)
    return { ok: false, reason: 'openalex-failed' }
  }

  let pool = dedupePool(probes)
  for (const p of probes) {
    console.log(`${tag} probe angle=${p.angleId} hits=${p.count}`)
  }

  // 3. Widen if too thin
  if (pool.length < SHOWCASE_POOL_MIN_FOR_RANKER) {
    console.log(`${tag} widening pool=${pool.length} → ${SHOWCASE_WIDENED_WINDOW_DAYS}d`)
    try {
      probes = await fetchProbeWave(plan.queries, SHOWCASE_WIDENED_WINDOW_DAYS)
    } catch (err) {
      console.error(`${tag} openalex widen failed`, err)
      return { ok: false, reason: 'openalex-failed' }
    }
    pool = dedupePool(probes)
  }

  // 4. Silent skip if still empty
  if (pool.length === 0) {
    console.log(`${tag} done ok=false reason=no-candidates ms=${Date.now() - startedAt}`)
    return { ok: false, reason: 'no-candidates' }
  }

  // 5. Rank
  let ranked
  try {
    ranked = await rankShowcasePicks(
      {
        profile: input.profile,
        angles: input.angles,
        selectedAngleIds: plan.selectedAngleIds,
        hitCounts: computeHitCounts(probes),
        pool,
      },
      { sessionId: opts.sessionId },
    )
  } catch (err) {
    console.error(`${tag} ranker failed`, err)
    return { ok: false, reason: 'ranker-failed' }
  }

  // 6. Apply patches (logged for observability, stripped from public return)
  if (ranked.patches.length > 0) {
    console.log(`${tag} patches=${JSON.stringify(ranked.patches)}`)
  }
  const finalAngles = applyPatches(input.angles, ranked.patches)

  // 7. Assemble picks from pool metadata (hallucination containment)
  const poolById = new Map(pool.map((c) => [c.openalexId, c]))
  const picks: ShowcasePick[] = ranked.picks
    .map((p) => {
      const cand = poolById.get(p.openalexId)
      if (!cand) return null
      return {
        openalexId: cand.openalexId,
        angleId: p.angleId,
        chipLabel: p.chipLabel,
        title: cand.title,
        authors: cand.authors,
        year: cand.year,
        venue: cand.venue,
        url: cand.url,
        whyForYou: p.whyForYou,
      }
    })
    .filter((p): p is ShowcasePick => p !== null)

  if (picks.length === 0) {
    console.log(`${tag} done ok=false reason=ranker-failed (no picks matched pool IDs)`)
    return { ok: false, reason: 'ranker-failed' }
  }

  // 8. Fallback candidatePreview for scan theatre (first 6 titles from pool)
  const candidatePreview = pool.slice(0, 6).map((c) => c.title)

  console.log(
    `${tag} done ok=true picks=${picks.length} patches=${ranked.patches.length} total_ms=${Date.now() - startedAt}`,
  )

  return {
    ok: true,
    headline: ranked.headline,
    picks,
    finalAngles,
    stats: {
      papersScanned: pool.length,
      anglesProbed: plan.selectedAngleIds.length,
    },
    candidatePreview,
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/showcase.test.ts`
Expected: all 10 tests pass (4 from Task 1 + 6 new).

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/ai/showcase.ts test/showcase.test.ts
git commit -m "feat(showcase): add runShowcase orchestrator with widen + failure modes"
```

---

## Task 5: Wire the `showcaseRecentPapers` tool into `onboarding-tools.ts`

Add the new AI SDK tool that wraps `runShowcase` and register it in `buildOnboardingTools`. Also add a basic discoverability test in `test/tools.test.ts`. Do **not** remove `corpusSanityCheck` yet — that's the next task. This keeps each commit deployable.

**Files:**
- Modify: `src/lib/ai/onboarding-tools.ts`
- Modify: `test/tools.test.ts`

- [ ] **Step 1: Write the failing tool discoverability test**

Append to `test/tools.test.ts` (at the end, before any trailing code):

```ts
describe('showcaseRecentPapers tool', () => {
  it('is exposed in buildOnboardingTools', () => {
    expect(onboardingTools.showcaseRecentPapers).toBeDefined()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/tools.test.ts -t "showcaseRecentPapers"`
Expected: FAIL with "Cannot read properties of undefined" or similar.

- [ ] **Step 3: Add the tool definition and register it**

In `src/lib/ai/onboarding-tools.ts`, add these imports at the top (near the existing imports):

```ts
import { runShowcase } from '@/lib/ai/showcase'
```

Add the new tool factory and input schema alongside the existing ones:

```ts
const showcaseInput = z.object({
  subject: z.string(),
  profile: z
    .string()
    .describe(
      'Free-form prose capturing role, intent, and anti-interests — the same text you will pass to generateConfig as `profile`.',
    ),
  angles: z
    .array(z.object({ id: z.number().int().min(1), text: z.string() }))
    .min(1)
    .max(12)
    .describe(
      "The user's final committed angle list, after any verbal refinements from the proposeAngles step.",
    ),
})

function makeShowcaseRecentPapersTool(sessionId: string | null) {
  return tool({
    description:
      "Fetch fresh work from OpenAlex across the user's committed angles, pick 3 standout papers, and return them with short rationales. Call this AFTER angles are fully settled (post proposeAngles and any refinements) and BEFORE asking about cadence. Use the returned finalAngles when you eventually call generateConfig. Never mention tuning, merging, or sparse areas to the user under any circumstances.",
    inputSchema: showcaseInput,
    execute: async (args) => {
      return runShowcase(args, { sessionId })
    },
  })
}
```

Update the return object of `buildOnboardingTools`:

```ts
export function buildOnboardingTools(sessionId: string | null) {
  return {
    normalizeSchedule: normalizeScheduleTool,
    generateConfig: generateConfigTool,
    proposeAngles: makeProposeAnglesTool(sessionId),
    corpusSanityCheck: makeCorpusSanityCheckTool(sessionId),
    showcaseRecentPapers: makeShowcaseRecentPapersTool(sessionId),
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run test/tools.test.ts -t "showcaseRecentPapers"`
Expected: PASS.

- [ ] **Step 5: Run full test suite to catch regressions**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/ai/onboarding-tools.ts test/tools.test.ts
git commit -m "feat(showcase): register showcaseRecentPapers in onboarding tools"
```

---

## Task 6: Remove `corpusSanityCheck` and `SanityCheckCard`

With the new tool registered and tested, delete the old one. `chat-types.ts` auto-updates because it uses `InferUITools`.

**Files:**
- Modify: `src/lib/ai/onboarding-tools.ts` (remove corpus sanity code)
- Modify: `src/components/chat/MessageBubble.tsx` (remove dispatch case + import)
- Delete: `src/components/chat/SanityCheckCard.tsx`
- Delete: `test/corpus-sanity.test.ts`

- [ ] **Step 1: Delete the sanity check test file**

```bash
rm test/corpus-sanity.test.ts
```

- [ ] **Step 2: Remove the tool from `onboarding-tools.ts`**

In `src/lib/ai/onboarding-tools.ts`, delete:

- The `corpusSanityInput` schema
- The `computeVerdict` function
- The `SanityResult` interface
- The `Verdict` type
- The `todayUtc`, `formatDate`, `withSemaphore` helpers (verify they are not used elsewhere in the file; if the new tool's orchestrator imports a different `withLimit` from `showcase.ts`, this should be clean)
- The `makeCorpusSanityCheckTool` function
- The `import { planQueries } from '@/lib/ai/query-planner'` line (if it is no longer referenced — check first)
- The `import { searchByKeyword } from '@/lib/openalex/client'` line (if no longer referenced — check first)

Remove the `corpusSanityCheck: makeCorpusSanityCheckTool(sessionId),` entry from `buildOnboardingTools`'s returned object. Final return block:

```ts
export function buildOnboardingTools(sessionId: string | null) {
  return {
    normalizeSchedule: normalizeScheduleTool,
    generateConfig: generateConfigTool,
    proposeAngles: makeProposeAnglesTool(sessionId),
    showcaseRecentPapers: makeShowcaseRecentPapersTool(sessionId),
  }
}
```

- [ ] **Step 3: Delete `SanityCheckCard.tsx`**

```bash
rm src/components/chat/SanityCheckCard.tsx
```

- [ ] **Step 4: Remove the dispatch case and import from `MessageBubble.tsx`**

In `src/components/chat/MessageBubble.tsx`:

- Delete the `import { SanityCheckCard } from './SanityCheckCard'` line.
- Delete the entire `if (part.type === 'tool-corpusSanityCheck') { ... }` block.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no errors. If TypeScript complains about `tool-corpusSanityCheck` still being in a union, search for stray references and remove them.

- [ ] **Step 6: Run full test suite**

Run: `npm test`
Expected: all tests pass (fewer than before — corpus sanity tests are gone).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore(showcase): remove corpusSanityCheck tool, card, and tests"
```

---

## Task 7: `ShowcaseTrackingChips` and `ShowcasePickCell` components

The two smallest leaf components. Render pure data into styled DOM using existing Tailwind theme classes.

**Files:**
- Create: `src/components/chat/showcase/ShowcaseTrackingChips.tsx`
- Create: `src/components/chat/showcase/ShowcasePickCell.tsx`

No Vitest tests for these — they are purely presentational and will be exercised via the manual browser test in Task 12.

- [ ] **Step 1: Create `ShowcaseTrackingChips.tsx`**

```tsx
// src/components/chat/showcase/ShowcaseTrackingChips.tsx
'use client'

import { motion } from 'framer-motion'

export interface ShowcaseTrackingChipsProps {
  angles: Array<{ id: number; text: string }>
  /** During the scan state, these IDs animate; otherwise all render neutral. */
  litAngleIds?: number[]
  /** When true, the lit chips animate in a staggered sweep. */
  animating?: boolean
}

export function ShowcaseTrackingChips({
  angles,
  litAngleIds = [],
  animating = false,
}: ShowcaseTrackingChipsProps) {
  const lit = new Set(litAngleIds)
  return (
    <div className="flex flex-wrap gap-1.5">
      {angles.map((a, i) => {
        const isLit = lit.has(a.id) && animating
        return (
          <motion.span
            layout
            key={a.id}
            initial={false}
            className={
              'rounded-full border px-2.5 py-1 text-[11px] font-medium tabular-nums ' +
              (isLit
                ? 'border-accent/60 bg-accent-soft text-accent'
                : 'border-line bg-bg text-ink-soft')
            }
            style={
              isLit
                ? { animationDelay: `${i * 0.15}s`, animation: 'rd-chip-pulse 2.4s var(--ease-out) infinite' }
                : undefined
            }
          >
            {a.text}
          </motion.span>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Create `ShowcasePickCell.tsx`**

```tsx
// src/components/chat/showcase/ShowcasePickCell.tsx
'use client'

import type { ShowcasePick } from '@/lib/ai/showcase'

export interface ShowcasePickCellProps {
  pick: ShowcasePick
}

export function ShowcasePickCell({ pick }: ShowcasePickCellProps) {
  return (
    <a
      href={pick.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex min-h-full flex-col gap-2 rounded-xl border border-line bg-bg p-4 transition-[border-color,transform] duration-[var(--dur-sm)] hover:-translate-y-[1px] hover:border-line-strong"
    >
      <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-accent">
        {pick.chipLabel}
      </div>
      <div className="text-[14px] font-medium leading-[1.4] text-ink">{pick.title}</div>
      <div className="text-[11px] tabular-nums text-ink-faint">
        {pick.venue} · {pick.year}
      </div>
      <div className="mt-auto border-t border-dashed border-line pt-3">
        <div className="mb-1 text-[9px] font-medium uppercase tracking-[0.1em] text-ink-faint">
          Why for you
        </div>
        <div className="font-display text-[12px] italic leading-[1.5] text-ink-soft">
          {pick.whyForYou}
        </div>
      </div>
    </a>
  )
}
```

- [ ] **Step 3: Add the chip pulse keyframe to `globals.css`**

In `src/app/globals.css`, add alongside the existing `rd-reading-cursor` keyframe:

```css
@keyframes rd-chip-pulse {
  0%   { background: var(--bg);         border-color: var(--line);      color: var(--ink-soft); transform: translateY(0); }
  18%  { background: var(--accent-soft); border-color: var(--accent);   color: var(--accent);   transform: translateY(-1px); }
  42%  { background: var(--bg);         border-color: var(--line);      color: var(--ink-soft); transform: translateY(0); }
  100% { background: var(--bg);         border-color: var(--line);      color: var(--ink-soft); transform: translateY(0); }
}
```

- [ ] **Step 4: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/chat/showcase/ShowcaseTrackingChips.tsx src/components/chat/showcase/ShowcasePickCell.tsx src/app/globals.css
git commit -m "feat(showcase): add pick cell, tracking chips, and chip-pulse keyframe"
```

---

## Task 8: `ShowcaseScanState` component

The scan-theatre running state. Cycling serif status line, emerald eyebrow, ticker counter, chip sweep, and (fallback-path) title tease.

**Files:**
- Create: `src/components/chat/showcase/ShowcaseScanState.tsx`

- [ ] **Step 1: Create `ShowcaseScanState.tsx`**

```tsx
// src/components/chat/showcase/ShowcaseScanState.tsx
'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ShowcaseTrackingChips } from './ShowcaseTrackingChips'

const STATUS_LINES = [
  'Reading your angles…',
  'Pulling fresh work from OpenAlex…',
  'Weighing candidates against your profile…',
  'Picking the three that deserve your Monday…',
]

export interface ShowcaseScanStateProps {
  angles: Array<{ id: number; text: string }>
  /** The subset of angles being probed — these animate on top of the full list. */
  litAngleIds: number[]
  /** If the tool is emitting live titles via streaming, pass them here. Otherwise cycles local fallback. */
  liveTitles?: string[]
}

export function ShowcaseScanState({ angles, litAngleIds, liveTitles }: ShowcaseScanStateProps) {
  const [lineIdx, setLineIdx] = useState(0)
  const [titleIdx, setTitleIdx] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setLineIdx((i) => (i + 1) % STATUS_LINES.length), 2200)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!liveTitles || liveTitles.length === 0) return
    const id = setInterval(() => setTitleIdx((i) => (i + 1) % liveTitles.length), 1400)
    return () => clearInterval(id)
  }, [liveTitles])

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-line bg-bg-elev-1 p-6 shadow-[0_1px_2px_rgba(42,38,32,0.04),0_8px_32px_rgba(42,38,32,0.05)]"
      aria-live="polite"
      aria-busy="true"
    >
      {/* Top hairline — reuses the existing rd-reading-cursor keyframe */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[2px] overflow-hidden rounded-t-2xl"
      >
        <span
          className="absolute top-0 h-full w-1/3 rounded-full bg-accent"
          style={{ animation: 'rd-reading-cursor 1.6s var(--ease-out) infinite' }}
        />
      </span>

      <div className="flex items-center justify-between">
        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">
          Scanning fresh work
        </div>
        <div className="tabular-nums text-[11px] text-ink-faint">
          {litAngleIds.length} focus areas
        </div>
      </div>

      <div className="relative mt-3 min-h-[32px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={lineIdx}
            initial={{ y: 6, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -6, opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.2, 0.7, 0.2, 1] }}
            className="font-display text-[22px] leading-[1.35] tracking-[-0.005em] text-ink"
          >
            {STATUS_LINES[lineIdx]}
          </motion.div>
        </AnimatePresence>
      </div>

      {liveTitles && liveTitles.length > 0 ? (
        <div className="mt-4 border-t border-dashed border-line pt-4">
          <div className="mb-1 text-[9px] font-medium uppercase tracking-[0.12em] text-ink-faint">
            Just in
          </div>
          <div className="relative h-[20px]">
            <AnimatePresence mode="wait">
              <motion.span
                key={titleIdx}
                initial={{ y: 8, opacity: 0 }}
                animate={{ y: 0, opacity: 0.85 }}
                exit={{ y: -8, opacity: 0 }}
                transition={{ duration: 0.24, ease: [0.2, 0.7, 0.2, 1] }}
                className="font-display text-[13px] italic text-ink-soft"
              >
                {liveTitles[titleIdx]}
              </motion.span>
            </AnimatePresence>
          </div>
        </div>
      ) : null}

      <div className="mt-5">
        <ShowcaseTrackingChips angles={angles} litAngleIds={litAngleIds} animating />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/chat/showcase/ShowcaseScanState.tsx
git commit -m "feat(showcase): add scan theatre running state"
```

---

## Task 9: `ShowcaseLandedState` component

The resolved hero card — emerald eyebrow, serif headline, stats ticker, 3-pick grid, tracking footer.

**Files:**
- Create: `src/components/chat/showcase/ShowcaseLandedState.tsx`

- [ ] **Step 1: Create `ShowcaseLandedState.tsx`**

```tsx
// src/components/chat/showcase/ShowcaseLandedState.tsx
'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import type { ShowcasePick } from '@/lib/ai/showcase'
import { ShowcasePickCell } from './ShowcasePickCell'
import { ShowcaseTrackingChips } from './ShowcaseTrackingChips'

export interface ShowcaseLandedStateProps {
  headline: string
  picks: ShowcasePick[]
  finalAngles: Array<{ id: number; text: string }>
  stats: { papersScanned: number; anglesProbed: number }
}

function useCountUp(target: number, durationMs = 900): number {
  const [value, setValue] = useState(0)
  useEffect(() => {
    let raf = 0
    const startedAt = performance.now()
    const tick = (now: number) => {
      const elapsed = now - startedAt
      const t = Math.min(1, elapsed / durationMs)
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3)
      setValue(Math.round(target * eased))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, durationMs])
  return value
}

export function ShowcaseLandedState({
  headline,
  picks,
  finalAngles,
  stats,
}: ShowcaseLandedStateProps) {
  const count = useCountUp(stats.papersScanned)
  const gridCols =
    picks.length === 1 ? 'grid-cols-1' : picks.length === 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-3'

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.24, ease: [0.2, 0.7, 0.2, 1] }}
      className="rounded-2xl border border-line bg-bg-elev-1 p-6 shadow-[0_1px_2px_rgba(42,38,32,0.04),0_8px_32px_rgba(42,38,32,0.06)]"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">
            Fresh this week
          </div>
          <h3 className="mt-1 font-display text-[24px] leading-[1.2] tracking-[-0.005em] text-ink">
            {headline}
          </h3>
        </div>
        <div className="whitespace-nowrap text-right tabular-nums text-[11px] leading-[1.6] text-ink-faint">
          <strong className="font-medium text-ink-soft">{count.toLocaleString()}</strong> papers scanned
          <br />
          across <strong className="font-medium text-ink-soft">{stats.anglesProbed}</strong> areas
        </div>
      </div>

      <div className={`mt-5 grid gap-3 ${gridCols}`}>
        {picks.map((p) => (
          <ShowcasePickCell key={p.openalexId} pick={p} />
        ))}
      </div>

      <div className="mt-5 border-t border-line pt-4">
        <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.12em] text-ink-faint">
          Tracking
        </div>
        <ShowcaseTrackingChips angles={finalAngles} />
      </div>
    </motion.div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/chat/showcase/ShowcaseLandedState.tsx
git commit -m "feat(showcase): add landed hero card state"
```

---

## Task 10: `ShowcaseCard` orchestrator component

The component `MessageBubble` dispatches to. Reads the AI SDK tool-part and switches between scan and landed states, with Framer Motion layout morph.

**Files:**
- Create: `src/components/chat/showcase/ShowcaseCard.tsx`

- [ ] **Step 1: Create `ShowcaseCard.tsx`**

```tsx
// src/components/chat/showcase/ShowcaseCard.tsx
'use client'

import { AnimatePresence, motion } from 'framer-motion'
import type { ResearchChatMessage } from '@/lib/ai/chat-types'
import { ShowcaseScanState } from './ShowcaseScanState'
import { ShowcaseLandedState } from './ShowcaseLandedState'

type MessagePart = NonNullable<ResearchChatMessage['parts']>[number]
type ShowcasePart = Extract<MessagePart, { type: 'tool-showcaseRecentPapers' }>

export interface ShowcaseCardProps {
  part: ShowcasePart
}

export function ShowcaseCard({ part }: ShowcaseCardProps) {
  // Silent skip on error / denial — render nothing.
  if (part.state === 'output-error' || part.state === 'output-denied') {
    return null
  }

  // Input not yet streamed — render nothing (no flash of empty card).
  if (part.state === 'input-streaming' || part.state === 'approval-requested' || part.state === 'approval-responded') {
    return null
  }

  if (part.state === 'output-available') {
    const out = part.output
    if (out.ok === false) return null // silent skip
    return (
      <motion.div layout transition={{ layout: { duration: 0.32, ease: [0.2, 0.7, 0.2, 1] } }}>
        <AnimatePresence mode="wait">
          <motion.div key="landed">
            <ShowcaseLandedState
              headline={out.headline}
              picks={out.picks}
              finalAngles={out.finalAngles}
              stats={out.stats}
            />
          </motion.div>
        </AnimatePresence>
      </motion.div>
    )
  }

  // input-available → tool is running
  const anglesFromInput =
    (part.input as { angles?: Array<{ id: number; text: string }> } | undefined)?.angles ?? []
  const litAngleIds = anglesFromInput.slice(0, 4).map((a) => a.id)

  return (
    <motion.div layout transition={{ layout: { duration: 0.32, ease: [0.2, 0.7, 0.2, 1] } }}>
      <AnimatePresence mode="wait">
        <motion.div key="scanning">
          <ShowcaseScanState angles={anglesFromInput} litAngleIds={litAngleIds} />
        </motion.div>
      </AnimatePresence>
    </motion.div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/chat/showcase/ShowcaseCard.tsx
git commit -m "feat(showcase): add ShowcaseCard orchestrator with scan→land morph"
```

---

## Task 11: Wire `ShowcaseCard` into `MessageBubble` dispatch

**Files:**
- Modify: `src/components/chat/MessageBubble.tsx`

- [ ] **Step 1: Add import**

In `src/components/chat/MessageBubble.tsx`, add:

```ts
import { ShowcaseCard } from './showcase/ShowcaseCard'
```

- [ ] **Step 2: Add dispatch case**

Inside the assistant-part mapping block, add a new case (e.g., right after the `tool-proposeAngles` case):

```tsx
if (part.type === 'tool-showcaseRecentPapers') {
  return <ShowcaseCard key={idx} part={part} />
}
```

- [ ] **Step 3: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: no errors.

- [ ] **Step 4: Full test run**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/chat/MessageBubble.tsx
git commit -m "feat(showcase): dispatch ShowcaseCard from MessageBubble"
```

---

## Task 12: Update `prompts/onboarding-system.md`

Replace the `corpusSanityCheck` guidance with `showcaseRecentPapers` guidance, move the schedule section to the end of the flow, and add the cadence-framing templates.

**Files:**
- Modify: `prompts/onboarding-system.md`

- [ ] **Step 1: Read the current prompt to preserve existing structure**

Open `prompts/onboarding-system.md` and note the three major sections the plan edits:
1. The "Information you need" list (schedule currently appears mid-list).
2. The "Your tools" section (lists all four tools).
3. Any surrounding narration rules.

- [ ] **Step 2: Apply the edits**

Make these specific replacements:

**a.** In the "Information you need" list, leave the Schedule bullet but prefix it with a note that it is asked last:

```markdown
- **Schedule.** (Ask this last, after the showcase.) How often and when they want the digest. Always ask explicitly — never default silently. Accept anything natural ("every Monday at 9am", "daily at 7am", "first of every month"). If you don't know their timezone, ask which city they're in and I'll figure the rest.
```

**b.** Replace the `corpusSanityCheck` bullet in the "Your tools" section with:

```markdown
- **showcaseRecentPapers** — call once angles are fully settled (post proposeAngles and any verbal refinements) and BEFORE asking about cadence. Pass the subject, the profile prose you've assembled, and the final angle list. The tool returns a set of picks plus a `finalAngles` list — use `finalAngles` when you eventually call `generateConfig`. Narrate *around* the card, not at it: the UI shows the titles, venues, and "why for you" rationales — do not repeat them. In one sentence, name a concrete observation about the *field* (not the tool), then pivot to the cadence question in the same message. If the tool returns `ok: false`, say nothing about it and proceed directly to the cadence question. **Never mention tuning, merging, quiet areas, or any internal adjustment to angles under any circumstances.**
```

**c.** Immediately after the tool list, append a new "Cadence framing" subsection:

```markdown
## Cadence framing (based on showcase results)

After a successful showcase, read the picks to choose your cadence framing:

- **Hot field** — 3 picks, all <5 days old: *"This field's moving fast — daily or every-other-day both make sense. You tell me."*
- **Moderate field** — mixed ages: *"A couple of meaningful papers drop each week. Weekly or every-other-day would fit."*
- **Quieter field** — 1–2 picks, or all >7 days old: *"This area is more of a slow drumbeat. Weekly or monthly probably fits best."*

Pick one, pivot to asking about their preferred day/time. After they answer, call `normalizeSchedule`.

If the showcase returned `ok: false`, skip the framing and ask plainly: *"How often do you want to hear from me, and on what day?"*
```

**d.** In the "How you talk" section, add one line to the narration rules:

```markdown
- **Never apologize for the tool.** If something returned nothing, simply move on. Never say "let me try" or "sorry about that."
```

- [ ] **Step 3: Verify the prompt mentions the four current tools (not five)**

The tool list must contain exactly: `proposeAngles`, `normalizeSchedule`, `showcaseRecentPapers`, `generateConfig`. Grep the file to make sure no stale reference to `corpusSanityCheck` remains.

Run: `grep -n corpusSanity prompts/onboarding-system.md`
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add prompts/onboarding-system.md
git commit -m "docs(showcase): rewrite onboarding prompt around showcaseRecentPapers"
```

---

## Task 13: Update the brief's risk section

A minor cleanup so the top-level brief reflects the new mechanism.

**Files:**
- Modify: `docs/2026-04-13-BRIEF.md`

- [ ] **Step 1: Edit the risk line**

In `docs/2026-04-13-BRIEF.md`, find the risks section (currently around line 83):

```markdown
- **Bad angle lists** → corpus-sanity check at onboarding, cadence-aware thresholds, merge/flag/drop flow.
```

Replace with:

```markdown
- **Bad angle lists** → showcase at onboarding silently retries, merges, and verifies each angle before `generateConfig`; spec at `docs/superpowers/specs/2026-04-14-onboarding-showcase-design.md`.
```

- [ ] **Step 2: Commit**

```bash
git add docs/2026-04-13-BRIEF.md
git commit -m "docs(brief): update bad-angle-list risk mitigation to reference showcase"
```

---

## Task 14: Manual browser verification

Run the app end-to-end with real OpenAlex and a real DeepSeek key, walk through the onboarding flow, and confirm the showcase card lands with 3 picks and the correct theme.

**No code changes.**

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

Expected: Next.js 16 dev server boots. Open the printed URL (typically `http://localhost:3000`).

- [ ] **Step 2: Walk through onboarding with "atrial fibrillation"**

Use the in-app chat to provide a subject, role, and intent. Example:

- Subject: "atrial fibrillation"
- Role: "clinical cardiologist tracking evidence"
- Intent: "stay current for practice, no basic science, no animal studies"

When the agent shows the angles, accept them (or lightly refine).

- [ ] **Step 3: Verify the scan theatre appears**

Expected:

- A card appears with an emerald "Scanning fresh work" eyebrow.
- A serif status line cycles through 4 lines over ~8 seconds.
- Angle chips appear in a row below, with 4 of them pulsing.
- A top hairline runs continuously (the `rd-reading-cursor` animation).

- [ ] **Step 4: Verify the landed card**

Expected (within 3–5 seconds):

- The card morphs smoothly into a landed state with the serif headline "Three papers I'd have sent you" (or similar ranker-generated text).
- 3 pick cells in a row (or fewer if the field is thin), each with a chip label, title, venue · year, and an italic-serif "Why for you" line.
- A tracking footer below with all angle chips, styled neutrally (no visibly highlighted "tuned" chips — silent tuning is in force).
- Clicking a pick opens the paper in a new tab.

- [ ] **Step 5: Verify cadence flow**

Expected:

- The agent's next message references an observation about the *field* (e.g., "This area is moving fast") and asks about cadence in the same message.
- Answering triggers `normalizeSchedule`, which renders the existing `ScheduleCard`.

- [ ] **Step 6: Verify the reduced-motion path**

Open the browser's DevTools → Rendering panel → emulate `prefers-reduced-motion: reduce`. Re-run onboarding (or just refresh onto the same card via localStorage). The card should appear without animations. No errors in the console.

- [ ] **Step 7: Verify no stale references to corpus sanity**

Run: `grep -r corpusSanity src/ prompts/ docs/ test/`
Expected: no matches inside `src/`, `prompts/`, or `test/`. A historical reference inside `docs/` (e.g., in the PRD) is acceptable as long as nothing in the current implementation imports or renders it.

- [ ] **Step 8: Final checks**

Run in parallel:

```bash
npm run lint
npm run typecheck
npm test
```

Expected: all pass.

- [ ] **Step 9: Final commit (only if any fixes were needed during verification)**

If the manual test surfaced issues you needed to fix in the code, commit the fixes with a descriptive message. If nothing changed, skip this step — there is nothing to commit.

---

## Notes

**What is explicitly out of scope for this plan:**

- Preview-digest display-reuse (marking overlapping papers with a "you saw this during setup" badge) — Phase-1 territory.
- A `status: 'watching'` angle lifecycle — pipeline-side work.
- Visual regression tests for the morph animation — manual verification only.
- AI SDK v6 live-streaming of probe events — the fallback path (`candidatePreview` in the final result) is shipped unconditionally, and the live-streaming upgrade can be a separate plan once the v6 API is verified.

**If you hit a v6 API surprise mid-implementation:** the AI SDK corrections note lives at `docs/superpowers/notes/2026-04-13-ai-sdk-v6-corrections.md`. Add any new findings there.
