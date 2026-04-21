# v9.2 Onboarding Preview — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the in-chat showcase/corpusSanityCheck flow with a Research Plan view + SSE-streamed preview digest driven by a TypeScript port of `iter/keyword_discovery.py` v9.2. End state: user finishes a short chat (4 fields), lands on a beautifully-rendered Research Plan view, clicks Preview, sees streamed progress, reads an editorial digest rendered in their own `output_style` with 5 real papers, picks cadence from a UI form, and clicks a placeholder Subscribe button.

**Architecture:** Chat shrinks to two tools (`proposeResearchAreas`, `handoffToPlan`). Preview runs server-side via `POST /api/preview-digest` as a `text/event-stream` SSE handler. The pipeline is a direct TS port of the validated Python v9.2: seed generation (LLM + angle-derived), parallel seed fetch, pure-code vocabulary mining, compact library build, parallel per-week retrieval, editorial curator. Client state machine in `usePlanState` coordinates research-plan editing, preview lifecycle (idle → running → ready → stale), cadence selection, and subscribe gate. Single `DigestConfig` schema with optional `schedule`; `subscribableConfigSchema` derived via `.required({ schedule: true })` for the subscribe check. All existing showcase code, `ConfigSummary`, `ScheduleCard`, `normalizeSchedule` tool, `generateConfig` tool, and the entire `test/` directory are deleted. No new tests in this pass.

**Tech Stack:**
- Next.js 16 route handlers (Node runtime, `maxDuration = 60`)
- React 19 + Vercel AI SDK v6 (`streamText`, `tool()`, `generateObject`, `InferUITools`)
- Tailwind v4 (token classes: `bg-bg-elev-1`, `border-line`, `text-ink`, `text-accent`, `font-display`)
- framer-motion (staggered entrance, scan theatre reuse)
- `react-markdown` + `remark-gfm` (new dep) for rendering the editorial body
- DeepSeek v3.2 via OpenRouter for all LLM calls
- OpenAlex `title_and_abstract.search` filter
- `zod@4` for schema
- TypeScript strict mode
- No test framework used in this plan (tests deleted, reintroduced later)

**Spec:** `docs/superpowers/specs/2026-04-20-v92-onboarding-preview-design.md`

---

## Before you start

1. Read the spec in full — it is the source of truth for types, prompts, copy, and behavior.
2. Skim `docs/superpowers/notes/2026-04-13-ai-sdk-v6-corrections.md` — it documents the v6 patterns you must use.
3. Skim `iter/keyword_discovery.py` — the TypeScript discovery modules are a direct port. Keep this file open while writing steps 8–9.
4. Skim `iter/ITERATION_LOG.md` sessions 2–3 to ground the v9.2 intuition.
5. The existing showcase code (`src/lib/ai/showcase.ts`, `showcase-planner.ts`, `showcase-ranker.ts`) is the closest reference for error handling, observability logging, OpenAlex fetch parallelism, and hallucination containment. Read it before porting; delete it in Task 21.
6. At any time, if an AI SDK v6 or Next.js 16 API detail is unclear, check `node_modules/next/dist/docs/` or pull docs via `context7` MCP — do NOT rely on training data.
7. **Commit policy.** Every task ends with `git commit`. Never `git commit --no-verify`. Never `git add .` — list files explicitly. Never run `rm -rf` outside of files listed in a task.

---

## File structure summary

| Directory | Change | Purpose |
|---|---|---|
| `test/` | **DELETE ALL** | User-approved; tests return later |
| `src/lib/config-schema.ts` | MODIFY | Single `DigestConfig`; rename, add `search_queries`, add `SubscribableConfig` |
| `src/lib/openalex/client.ts` | MODIFY | Add `filterMode` + `selectFields` options |
| `src/lib/ai/propose-angles.ts` | RENAME → `propose-research-areas.ts` | Function + types renamed |
| `prompts/propose-angles-system.md` | RENAME → `propose-research-areas-system.md` | No content change |
| `src/lib/ai/onboarding-tools.ts` | REWRITE | 2 tools only; delete `showcase`/`normalize`/`generateConfig` |
| `prompts/onboarding-system.md` | REWRITE | Four-field contract, no cadence, no showcase |
| `src/lib/ai/chat-types.ts` | AUTO-UPDATES | Type derives from `OnboardingTools` |
| `src/lib/ai/discovery/` | CREATE (5 files) | TS port of v9.2 steps 1–5 |
| `src/lib/ai/preview/` | CREATE (3 files) | Pipeline orchestrator + curator + progress events |
| `prompts/preview-library-system.md` | CREATE | Step-4 compact library prompt |
| `prompts/preview-curator-system.md` | CREATE | Editorial curator prompt |
| `src/app/api/preview-digest/route.ts` | CREATE | SSE POST handler |
| `src/lib/schedule/build-cron.ts` | CREATE | Pure cadence→cron builder |
| `src/lib/storage/local.ts` | MODIFY | Replace `configDraft/finalConfig` with `config` + `preview` + `schedule` |
| `src/components/common/PaperRow.tsx` | CREATE | Broadsheet row, extracted from `ShowcasePickCell` |
| `src/components/chat/MessageBubble.tsx` | MODIFY | Switch tool-part dispatch to new tools |
| `src/components/chat/ChatShell.tsx` | MODIFY | Transition on `handoffToPlan` instead of `generateConfig` |
| `src/components/chat/AngleProposalCard.tsx` | RENAME → `ResearchAreaProposalCard.tsx` | Rename + type update |
| `src/components/plan/*` | CREATE (10 files) | Research Plan UI |
| `src/components/chat/showcase/` | DELETE | 5 files |
| `src/lib/ai/showcase.ts`, `showcase-planner.ts`, `showcase-ranker.ts` | DELETE | |
| `prompts/showcase-planner-system.md`, `showcase-ranker-system.md` | DELETE | |
| `src/components/config/ConfigSummary.tsx` | DELETE | |
| `src/components/chat/ScheduleCard.tsx` | DELETE | |
| `CLAUDE.md` | MODIFY | Update architecture note to reference new flow |
| `package.json` | MODIFY | Add `react-markdown` + `remark-gfm` |

---

## Task 1: Delete the existing test suite

**Files:**
- Delete: `test/` directory (all files, recursive)

The user approved removing all tests; they return later when the product is more settled. `vitest.config.ts` stays (it sets up the `server-only` alias that we still want available when tests return).

- [ ] **Step 1: Confirm which test files exist**

Run:
```bash
ls test/
```
Expected: sees `config-schema.test.ts`, `fixtures/`, `helpers.ts`, `openalex-client.test.ts`, `schedule.test.ts`, `showcase-planner.test.ts`, `showcase-ranker.test.ts`, `showcase.test.ts`, `tools.test.ts`.

- [ ] **Step 2: Delete the directory**

Run:
```bash
git rm -r test/
```
Expected: git stages deletions for all files under `test/`.

- [ ] **Step 3: Verify nothing else references test helpers**

Run:
```bash
grep -rn "from '@/test\|from '../test\|from './test" src/ || true
```
Expected: no output. If output appears, delete the offending imports too.

- [ ] **Step 4: Typecheck**

Run:
```bash
npm run typecheck
```
Expected: clean exit. If `test/` was included in the `tsconfig.json` `include` array, edit it to remove that entry, then re-run.

- [ ] **Step 5: Commit**

```bash
git commit -m "chore(test): remove existing test suite (returns later)"
```

---

## Task 2: Update `src/lib/config-schema.ts` to the new shape

**Files:**
- Modify: `src/lib/config-schema.ts` (full rewrite)

Rewrites the schema per §6 of the spec: single `DigestConfig` with optional `schedule`, derived `subscribableConfigSchema`, structured `search_queries`, `ResearchArea` replaces `Angle`, drops `status`/`priority`/`volume_target`.

- [ ] **Step 1: Replace the file body**

Open `src/lib/config-schema.ts` and replace its full content with:

```ts
// src/lib/config-schema.ts
import { z } from 'zod'

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

export const scheduleSchema = z.object({
  cron: z.string().min(1),
  timezone: z.string().min(1),
  description: z.string().min(1),
})

// Single source of truth. `schedule` is optional so the same object covers
// the post-chat state (no schedule yet) and the subscribe-ready state.
export const digestConfigSchema = z.object({
  subject: z.string().min(1),
  profile: z.string().min(1),
  output_style: z.string().min(1),
  research_areas: z.array(researchAreaSchema).min(1),
  search_queries: z.array(searchQuerySchema).default([]),
  schedule: scheduleSchema.optional(),
  version: z.number().int().min(1).default(1),
  created_at: z.string().min(1),
  updated_at: z.string().min(1),
})

// Used by Subscribe — enforces schedule is set.
export const subscribableConfigSchema = digestConfigSchema.required({ schedule: true })

export type ResearchArea = z.infer<typeof researchAreaSchema>
export type SearchQuery = z.infer<typeof searchQuerySchema>
export type Schedule = z.infer<typeof scheduleSchema>
export type DigestConfig = z.infer<typeof digestConfigSchema>
export type SubscribableConfig = z.infer<typeof subscribableConfigSchema>
```

- [ ] **Step 2: Typecheck**

Run:
```bash
npm run typecheck
```
Expected: errors in callers that reference the removed `angleSchema`, `Angle`, `core_angles`, `volume_target`, or the old `status`/`priority` fields. **This is expected** — we'll chase them in Tasks 3–5. Do not fix them here.

- [ ] **Step 3: Capture the list of broken files**

Run:
```bash
npm run typecheck 2>&1 | grep -E "error TS" | cut -d'(' -f1 | sort -u > /tmp/ts-errors-task2.txt
cat /tmp/ts-errors-task2.txt
```
Expected: sees files from `src/lib/ai/onboarding-tools.ts`, `src/lib/storage/local.ts`, `src/components/chat/ChatShell.tsx`, `src/components/chat/AngleProposalCard.tsx`, `src/components/config/ConfigSummary.tsx`, `src/lib/ai/propose-angles.ts`, `src/lib/ai/showcase*.ts`. Note the list; tasks 3–5 close most of them, and tasks 19–21 close the rest via deletion.

- [ ] **Step 4: Commit the schema update (codebase does not typecheck yet)**

```bash
git add src/lib/config-schema.ts
git commit -m "feat(schema): single DigestConfig with optional schedule, research_areas rename"
```

---

## Task 3: Rename `propose-angles` → `propose-research-areas`

**Files:**
- Rename: `src/lib/ai/propose-angles.ts` → `src/lib/ai/propose-research-areas.ts`
- Rename: `prompts/propose-angles-system.md` → `prompts/propose-research-areas-system.md`

Pure rename — function body unchanged except for identifier and prompt path.

- [ ] **Step 1: Rename the prompt file**

Run:
```bash
git mv prompts/propose-angles-system.md prompts/propose-research-areas-system.md
```

- [ ] **Step 2: Rename the source file**

Run:
```bash
git mv src/lib/ai/propose-angles.ts src/lib/ai/propose-research-areas.ts
```

- [ ] **Step 3: Update the renamed source file**

Open `src/lib/ai/propose-research-areas.ts`. Replace:

- Every `proposeAngles` (function name) with `proposeResearchAreas`.
- Every `ProposeAnglesOutput` type with `ProposeResearchAreasOutput`.
- Every `proposeAnglesOutputSchema` with `proposeResearchAreasOutputSchema`.
- Every `PROPOSE_ANGLES_HARD_CAP` with `PROPOSE_RESEARCH_AREAS_HARD_CAP`.
- The log tag `[proposeAngles ...]` with `[proposeResearchAreas ...]`.
- The `readFileSync` path `'prompts/propose-angles-system.md'` with `'prompts/propose-research-areas-system.md'`.

Keep the existing Anthropic-schema-strip comment block intact — it's still relevant.

- [ ] **Step 4: Commit**

```bash
git add src/lib/ai/propose-research-areas.ts prompts/propose-research-areas-system.md
git commit -m "refactor(ai): rename propose-angles → propose-research-areas"
```

---

## Task 4: Rewrite `src/lib/ai/onboarding-tools.ts` — two tools only

**Files:**
- Modify: `src/lib/ai/onboarding-tools.ts` (full rewrite)

New tool surface: `proposeResearchAreas` (renamed) + `handoffToPlan` (new). Drop `showcaseRecentPapers`, `normalizeSchedule`, `generateConfig`, and the `corpusSanityCheck` legacy import.

- [ ] **Step 1: Replace the file body**

Open `src/lib/ai/onboarding-tools.ts`. Replace its full content with:

```ts
// src/lib/ai/onboarding-tools.ts
import 'server-only'
import { tool } from 'ai'
import { z } from 'zod'
import { digestConfigSchema } from '@/lib/config-schema'
import { proposeResearchAreas as proposeResearchAreasImpl } from '@/lib/ai/propose-research-areas'

const proposeResearchAreasInput = z.object({
  subject: z.string().describe('The subject the user wants a digest about.'),
  profileSummary: z
    .string()
    .describe('A short profile of the reader: role, intent, anti-interests.'),
  hints: z.string().optional().describe('Optional hints from the conversation so far.'),
})

function makeProposeResearchAreasTool(sessionId: string | null) {
  return tool({
    description:
      'Generate 6–12 specific research areas for a subject given a reader profile. Call this once subject, role, and intent are clear. Narrate the result to the user in natural language — do not dump the raw list.',
    inputSchema: proposeResearchAreasInput,
    execute: async (args) => {
      return proposeResearchAreasImpl(args, { sessionId })
    },
  })
}

// Pre-schedule subset of DigestConfig. Chat never sets schedule or metadata.
const handoffDraftSchema = digestConfigSchema.omit({
  schedule: true,
  version: true,
  created_at: true,
  updated_at: true,
  search_queries: true,
})

const handoffToPlanInput = z.object({
  config: z
    .record(z.string(), z.unknown())
    .describe(
      'The assembled fields: subject, profile, output_style, research_areas. Will be validated.',
    ),
})

const handoffToPlanTool = tool({
  description:
    'Finalize the four-field plan draft (subject, profile, output_style, research_areas) once they are all ready. The UI transitions to the Research Plan view on success. On failure, fix the named fields and retry.',
  inputSchema: handoffToPlanInput,
  execute: async (args) => {
    const parsed = handoffDraftSchema.safeParse(args.config)
    if (parsed.success) {
      return { ok: true as const, config: parsed.data }
    }
    return {
      ok: false as const,
      errors: parsed.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      })),
    }
  },
})

export type OnboardingTools = ReturnType<typeof buildOnboardingTools>

export function buildOnboardingTools(sessionId: string | null) {
  return {
    proposeResearchAreas: makeProposeResearchAreasTool(sessionId),
    handoffToPlan: handoffToPlanTool,
  }
}
```

- [ ] **Step 2: Typecheck**

Run:
```bash
npm run typecheck
```
Expected: errors now concentrate in `ChatShell.tsx` (references `tool-generateConfig`), `MessageBubble.tsx` (references `tool-showcaseRecentPapers`, `tool-normalizeSchedule`, `tool-proposeAngles`), and `showcase*` files. These are addressed in later tasks.

- [ ] **Step 3: Commit**

```bash
git add src/lib/ai/onboarding-tools.ts
git commit -m "feat(ai): shrink onboarding to proposeResearchAreas + handoffToPlan"
```

---

## Task 5: Extend `src/lib/openalex/client.ts` with `filterMode` + `selectFields`

**Files:**
- Modify: `src/lib/openalex/client.ts`

Adds two optional fields to `SearchOptions`. Default behavior is unchanged — existing callers still work (and there are none after Task 21).

- [ ] **Step 1: Read current contents**

Run:
```bash
cat src/lib/openalex/client.ts
```

- [ ] **Step 2: Replace the file body**

```ts
// src/lib/openalex/client.ts
const OPENALEX_BASE = 'https://api.openalex.org/works'
const TYPE_FILTER = 'article|review|book-chapter|preprint|dissertation|report|peer-review'

export type FilterMode = 'search' | 'title_and_abstract.search'

export interface SearchOptions {
  query: string
  fromDate: string        // YYYY-MM-DD
  toDate: string          // YYYY-MM-DD
  perPage?: number
  page?: number
  filterMode?: FilterMode
  selectFields?: string[]
}

export interface OpenAlexWork {
  id: string
  doi?: string | null
  title?: string | null
  publication_date?: string | null
  abstract_inverted_index?: Record<string, number[]> | null
  primary_topic?: {
    display_name?: string
    subfield?: { display_name?: string }
    field?: { display_name?: string }
  } | null
  keywords?: Array<{ display_name?: string }>
  primary_location?: {
    source?: { display_name?: string }
  } | null
  authorships?: Array<{ author?: { display_name?: string } }>
  [k: string]: unknown
}

export interface SearchResponse {
  meta: { count: number; [k: string]: unknown }
  results: OpenAlexWork[]
}

export function buildSearchUrl(opts: SearchOptions): string {
  const mailto = process.env.OPENALEX_MAILTO
  const apiKey = process.env.OPENALEX_API_KEY

  const params = new URLSearchParams()
  const filterMode: FilterMode = opts.filterMode ?? 'search'

  if (filterMode === 'search') {
    params.set('search', opts.query)
    params.set(
      'filter',
      `from_publication_date:${opts.fromDate},to_publication_date:${opts.toDate},type:${TYPE_FILTER}`,
    )
  } else {
    // title_and_abstract.search goes inside the filter clause.
    params.set(
      'filter',
      `title_and_abstract.search:${opts.query},from_publication_date:${opts.fromDate},to_publication_date:${opts.toDate},type:${TYPE_FILTER}`,
    )
  }

  params.set('per_page', String(opts.perPage ?? 25))
  params.set('page', String(opts.page ?? 1))
  if (opts.selectFields && opts.selectFields.length > 0) {
    params.set('select', opts.selectFields.join(','))
  }
  if (mailto) params.set('mailto', mailto)
  if (apiKey) params.set('api_key', apiKey)

  return `${OPENALEX_BASE}?${params.toString()}`
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

const MAX_RETRIES = 3
const BASE_DELAY_MS = 500
const TIMEOUT_MS = 10_000

export async function searchByKeyword(opts: SearchOptions): Promise<SearchResponse> {
  if (!process.env.OPENALEX_MAILTO) {
    throw new Error('OPENALEX_MAILTO env var is required for the polite pool')
  }

  const url = buildSearchUrl(opts)

  let lastErr: unknown
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { Accept: 'application/json' },
      })
      if (res.ok) {
        const body = (await res.json()) as SearchResponse
        return body
      }
      if (res.status === 429 || res.status >= 500) {
        lastErr = new Error(`openalex ${res.status}`)
        await sleep(BASE_DELAY_MS * Math.pow(2, attempt))
        continue
      }
      throw new Error(`openalex ${res.status}`)
    } catch (err) {
      lastErr = err
      if (attempt < MAX_RETRIES - 1) {
        await sleep(BASE_DELAY_MS * Math.pow(2, attempt))
        continue
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('openalex unknown error')
}
```

- [ ] **Step 3: Typecheck**

Run:
```bash
npm run typecheck
```
Expected: same set of errors as before this task (showcase references). This change should not introduce new errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/openalex/client.ts
git commit -m "feat(openalex): add filterMode + selectFields options"
```

---

## Task 6: Install `react-markdown` and `remark-gfm`

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add the packages**

Run:
```bash
npm install react-markdown remark-gfm
```
Expected: `package.json` and `package-lock.json` update; no errors.

- [ ] **Step 2: Verify install**

Run:
```bash
node -e "console.log(require('react-markdown/package.json').version); console.log(require('remark-gfm/package.json').version)"
```
Expected: two version strings print, no errors.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add react-markdown + remark-gfm for editorial rendering"
```

---

## Task 7: Port `angles_to_seeds` — `src/lib/ai/discovery/seeds.ts`

**Files:**
- Create: `src/lib/ai/discovery/seeds.ts`
- Create: `prompts/preview-seed-system.md`

TypeScript port of the pure `angles_to_seeds` helper plus an LLM-driven `generateSeeds` function. The Python reference is `iter/keyword_discovery.py` lines for `angles_to_seeds` and `generate_seeds`.

- [ ] **Step 1: Write the seed system prompt**

Create `prompts/preview-seed-system.md`:

```markdown
You generate broad SEED search queries for an academic paper database (OpenAlex).
The user's profile follows. Your seeds are nets, not scalpels — they retrieve a sample of real papers
so we can mine vocabulary from them in a later step.

Rules:
1. Use the user's OWN terminology from their profile. Do not introduce jargon they didn't mention.
2. Keep each query simple: 2-4 words, space-separated. No boolean operators, no quotes, no special syntax.
3. Do NOT get creative. Each query represents one clean angle of their interest.
4. Prefer noun phrases over descriptions ("consumer psychology" beats "how consumers make decisions").

Respond with ONLY a JSON object: {"seeds": ["query 1", "query 2", "query 3"]}
No prose.
```

- [ ] **Step 2: Write `seeds.ts`**

```ts
// src/lib/ai/discovery/seeds.ts
import 'server-only'
import { generateObject } from 'ai'
import { z } from 'zod'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { deepseek } from '@/lib/ai/openrouter'
import type { DigestConfig, ResearchArea } from '@/lib/config-schema'

// Connective / stopword tokens we never lead a seed with.
const ANGLE_SEED_STOPWORDS = new Set([
  'and', 'or', 'vs', 'versus', 'the', 'a', 'an', 'for', 'of', 'with', 'to',
  'on', 'in', 'by', 'as', 'at',
])

/**
 * Derive compact seed phrases from each research area's text. Strips
 * parenthesized clarifications, drops leading stopwords/connectives,
 * collapses adjacent duplicates, takes the first N content tokens.
 * Returns one seed per area, in input order. Empty strings are filtered.
 */
export function researchAreasToSeeds(areas: ResearchArea[], maxWords = 2): string[] {
  const out: string[] = []
  for (const area of areas) {
    const cleaned = area.text.replace(/\([^)]*\)/g, ' ')
    const tokens = cleaned.match(/[A-Za-z0-9][A-Za-z0-9\-/]*/g) ?? []
    const filtered = tokens.filter((t) => !ANGLE_SEED_STOPWORDS.has(t.toLowerCase()))
    const deduped: string[] = []
    for (const w of filtered) {
      if (deduped.length === 0 || deduped[deduped.length - 1].toLowerCase() !== w.toLowerCase()) {
        deduped.push(w)
      }
    }
    if (deduped.length >= 1) {
      out.push(deduped.slice(0, maxWords).join(' '))
    }
  }
  return out.filter((s) => s.length > 0)
}

let cachedSystem: string | null = null
function getSeedSystemPrompt(): string {
  if (cachedSystem) return cachedSystem
  cachedSystem = readFileSync(resolve(process.cwd(), 'prompts/preview-seed-system.md'), 'utf8')
  return cachedSystem
}

// Anthropic-schema-strip: use plain z.array(z.string()) — no .min()/.max()/.length().
// See src/lib/ai/propose-research-areas.ts for the full rationale.
const seedOutputSchema = z.object({
  seeds: z.array(z.string()),
})

export async function generateSeeds(
  config: Pick<DigestConfig, 'subject' | 'profile' | 'research_areas'>,
  opts: { sessionId?: string | null } = {},
): Promise<{ seeds: string[]; cost?: number; totalTokens?: number }> {
  const tag = `[preview-seeds ${opts.sessionId?.slice(0, 8) ?? 'no-session'}]`
  const started = Date.now()

  const userPrompt = [
    `USER PROFILE:\n${config.profile}`,
    '',
    `SUBJECT (one phrase summarising what they care about):\n${config.subject}`,
    '',
    `RESEARCH AREAS THEY WANT COVERED:`,
    ...config.research_areas.map((a) => `  - ${a.text}`),
    '',
    `Generate 3-5 seed queries.`,
  ].join('\n')

  const { object, usage, providerMetadata } = await generateObject({
    model: deepseek({ sessionId: opts.sessionId ?? null }),
    schema: seedOutputSchema,
    system: getSeedSystemPrompt(),
    prompt: userPrompt,
    temperature: 0.3,
  })

  const cost = (providerMetadata?.openrouter as { usage?: { cost?: number } } | undefined)?.usage?.cost
  const seeds = object.seeds.map((s) => s.trim()).filter((s) => s.length > 0)

  console.log(
    `${tag} done seeds=${seeds.length} tokens=${usage.totalTokens ?? '?'} cost=${cost != null ? `$${cost.toFixed(6)}` : '—'} ms=${Date.now() - started}`,
  )
  return { seeds, cost, totalTokens: usage.totalTokens }
}

/**
 * Combine LLM seeds with angle-derived seeds. LLM seeds first (they add
 * cross-angle framings); angle-derived added if not already present
 * (case-insensitive). This is the v9.2 core fix — forces the vocabulary
 * miner to read papers that name the user's drugs/procedures/frameworks.
 */
export function combineSeeds(llmSeeds: string[], angleSeeds: string[]): string[] {
  const seen = new Set(llmSeeds.map((s) => s.toLowerCase()))
  const out = [...llmSeeds]
  for (const s of angleSeeds) {
    if (!seen.has(s.toLowerCase())) {
      out.push(s)
      seen.add(s.toLowerCase())
    }
  }
  return out
}
```

- [ ] **Step 3: Typecheck**

Run:
```bash
npm run typecheck
```
Expected: no new errors from this file. Preexisting errors (from earlier tasks) still present; that's fine.

- [ ] **Step 4: Commit**

```bash
git add src/lib/ai/discovery/seeds.ts prompts/preview-seed-system.md
git commit -m "feat(discovery): port v9.2 seed generation (LLM + angle-derived)"
```

---

## Task 8: Port seed fetch + vocabulary extraction

**Files:**
- Create: `src/lib/ai/discovery/fetch-seeds.ts`
- Create: `src/lib/ai/discovery/extract-vocab.ts`

Port of Python `fetch_seed_papers` and `extract_vocabulary`. Pure mechanical code; no LLM.

- [ ] **Step 1: Write `fetch-seeds.ts`**

```ts
// src/lib/ai/discovery/fetch-seeds.ts
import 'server-only'
import { searchByKeyword } from '@/lib/openalex/client'
import type { OpenAlexWork } from '@/lib/openalex/client'

const SELECT_FIELDS = [
  'id',
  'title',
  'primary_topic',
  'keywords',
  'primary_location',
  'publication_date',
  'abstract_inverted_index',
  'authorships',
]

export interface SeedFetchResult {
  seed: string
  count: number
  results: OpenAlexWork[]
}

/**
 * Fetch up to `perPage` papers per seed in parallel, using
 * `title_and_abstract.search` against the last `windowDays` days.
 * Returns one entry per seed in input order.
 */
export async function fetchSeedPapers(
  seeds: string[],
  opts: { windowDays?: number; perPage?: number } = {},
): Promise<SeedFetchResult[]> {
  const windowDays = opts.windowDays ?? 180 // 6 months
  const perPage = opts.perPage ?? 50
  const toDate = new Date().toISOString().slice(0, 10)
  const fromDate = new Date(Date.now() - windowDays * 86_400_000).toISOString().slice(0, 10)

  const tasks = seeds.map(async (seed): Promise<SeedFetchResult> => {
    try {
      const res = await searchByKeyword({
        query: seed,
        fromDate,
        toDate,
        perPage,
        filterMode: 'title_and_abstract.search',
        selectFields: SELECT_FIELDS,
      })
      return { seed, count: res.meta.count, results: res.results }
    } catch {
      return { seed, count: -1, results: [] }
    }
  })

  return Promise.all(tasks)
}
```

- [ ] **Step 2: Write `extract-vocab.ts`**

```ts
// src/lib/ai/discovery/extract-vocab.ts
import type { OpenAlexWork } from '@/lib/openalex/client'
import type { SeedFetchResult } from './fetch-seeds'

const GENERIC_KEYWORDS = new Set(['study', 'research', 'analysis', 'method', 'result'])

function isValidKeyword(name: string): boolean {
  if (!name || name.length < 3) return false
  if (name.includes('(') || name.includes(')')) return false
  if (GENERIC_KEYWORDS.has(name.toLowerCase())) return false
  return true
}

function topN<K>(counter: Map<K, number>, n: number): Array<[K, number]> {
  return [...counter.entries()].sort((a, b) => b[1] - a[1]).slice(0, n)
}

export interface Vocabulary {
  totalPapers: number
  topics: Array<[string, number]>
  subfields: Array<[string, number]>
  fields: Array<[string, number]>
  keywords: Array<[string, number]>
  journals: Array<[string, number]>
  sampleTitles: string[]
}

/**
 * Mine the returned papers' metadata to discover real vocabulary that
 * indexes papers in the user's area.
 */
export function extractVocabulary(seedResults: SeedFetchResult[]): Vocabulary {
  const topics = new Map<string, number>()
  const subfields = new Map<string, number>()
  const fields = new Map<string, number>()
  const keywords = new Map<string, number>()
  const journals = new Map<string, number>()
  const sampleTitles: string[] = []
  let totalPapers = 0

  for (const sr of seedResults) {
    for (const paper of sr.results) {
      totalPapers++
      if (paper.title && sampleTitles.length < 15) sampleTitles.push(paper.title)
      const topic = paper.primary_topic ?? null
      if (topic?.display_name) topics.set(topic.display_name, (topics.get(topic.display_name) ?? 0) + 1)
      const sub = topic?.subfield?.display_name
      if (sub) subfields.set(sub, (subfields.get(sub) ?? 0) + 1)
      const fld = topic?.field?.display_name
      if (fld) fields.set(fld, (fields.get(fld) ?? 0) + 1)
      for (const kw of paper.keywords ?? []) {
        const name = kw.display_name ?? ''
        if (isValidKeyword(name)) keywords.set(name, (keywords.get(name) ?? 0) + 1)
      }
      const src = paper.primary_location?.source?.display_name
      if (src) journals.set(src, (journals.get(src) ?? 0) + 1)
    }
  }

  return {
    totalPapers,
    topics: topN(topics, 15),
    subfields: topN(subfields, 10),
    fields: topN(fields, 5),
    keywords: topN(keywords, 25),
    journals: topN(journals, 10),
    sampleTitles,
  }
}

/** Reconstruct abstract text from OpenAlex's inverted-index format. */
export function reconstructAbstract(invIdx?: Record<string, number[]> | null): string {
  if (!invIdx) return ''
  const entries: Array<[number, string]> = []
  for (const [word, positions] of Object.entries(invIdx)) {
    for (const pos of positions) entries.push([pos, word])
  }
  entries.sort((a, b) => a[0] - b[0])
  return entries.map(([, w]) => w).join(' ')
}
```

- [ ] **Step 3: Typecheck**

Run:
```bash
npm run typecheck
```
Expected: no new errors from these files.

- [ ] **Step 4: Commit**

```bash
git add src/lib/ai/discovery/fetch-seeds.ts src/lib/ai/discovery/extract-vocab.ts
git commit -m "feat(discovery): port seed fetch + vocabulary extraction"
```

---

## Task 9: Port compact library builder

**Files:**
- Create: `prompts/preview-library-system.md`
- Create: `src/lib/ai/discovery/build-library.ts`

The step-4 LLM call. Preview-specific: `MIN_PER_ANGLE = 1`, `MAX_PER_ANGLE = 1`, `QUERY_BUDGET = research_areas.length`, dimension `core` only.

- [ ] **Step 1: Write the library system prompt**

Create `prompts/preview-library-system.md`:

```markdown
You build a COMPACT search query library for a research digest PREVIEW. The user's profile is below,
along with the REQUIRED_RESEARCH_AREAS (a fixed list — every area is a hard slot you MUST cover with
EXACTLY one query) and REAL vocabulary extracted from papers retrieved by seed queries.

Output a library of search queries for OpenAlex's title_and_abstract.search filter. This filter
supports only space-separated keywords — no AND, OR, NOT, or quotes.

HARD CONSTRAINTS (failures here invalidate the whole library):
- You MUST produce EXACTLY one query per research area. No skips, no extras.
- Each query must declare its `research_area_id` (1-based, matching REQUIRED_RESEARCH_AREAS order).
- Dimension is always `core`. No intersections, no adjacents, no serendipity.

RULES:
1. USE VOCABULARY FROM THE EXTRACTED DATA, not your own assumptions. These terms actually appear in
   the papers this user would want.
2. Filter out noise. A topic appearing in the data does not mean it serves this user's goal.
3. Each query: 2-6 space-separated words. Prefer specific noun phrases over generic descriptions.
4. Target result count: 10-300 papers per query per week. Too few = loosen. Too many = add a qualifier.
5. For each query, write a short rationale that references the USER'S GOAL, the area it serves,
   and the vocabulary evidence.

Respond with ONLY a JSON object:
{
  "queries": [
    {"query": "...", "research_area_id": 1, "rationale": "..."}
  ]
}
No prose.
```

- [ ] **Step 2: Write `build-library.ts`**

```ts
// src/lib/ai/discovery/build-library.ts
import 'server-only'
import { generateObject } from 'ai'
import { z } from 'zod'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { deepseek } from '@/lib/ai/openrouter'
import type { DigestConfig, ResearchArea, SearchQuery } from '@/lib/config-schema'
import type { Vocabulary } from './extract-vocab'

const librarySchema = z.object({
  queries: z.array(
    z.object({
      query: z.string(),
      research_area_id: z.number(),
      rationale: z.string(),
    }),
  ),
})

let cachedSystem: string | null = null
function getLibrarySystemPrompt(): string {
  if (cachedSystem) return cachedSystem
  cachedSystem = readFileSync(
    resolve(process.cwd(), 'prompts/preview-library-system.md'),
    'utf8',
  )
  return cachedSystem
}

function formatCounter(items: Array<[string, number]>, limit?: number): string {
  const slice = typeof limit === 'number' ? items.slice(0, limit) : items
  return slice.map(([name, count]) => `  - ${name}  (${count}x)`).join('\n')
}

function stripOperators(text: string): string {
  return text
    .replace(/ AND /g, ' ')
    .replace(/ OR /g, ' ')
    .replace(/ NOT /g, ' ')
    .replace(/"/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .join(' ')
}

/**
 * Build a compact library — exactly one query per research area. Order of
 * returned queries follows research_area_id. Strips unsupported boolean
 * operators if the LLM ignores the rule.
 */
export async function buildCompactLibrary(
  config: Pick<DigestConfig, 'subject' | 'profile' | 'research_areas'>,
  seedsWithCounts: Array<{ seed: string; count: number }>,
  vocab: Vocabulary,
  opts: { sessionId?: string | null } = {},
): Promise<{ queries: SearchQuery[]; cost?: number; totalTokens?: number }> {
  const tag = `[preview-library ${opts.sessionId?.slice(0, 8) ?? 'no-session'}]`
  const started = Date.now()

  const areaLines = config.research_areas
    .map((a: ResearchArea, i) => `  ${i + 1}. ${a.text}`)
    .join('\n')
  const seedLines = seedsWithCounts
    .map((s) => `  - "${s.seed}" → ${s.count} results`)
    .join('\n')

  const userPrompt = [
    `USER PROFILE:\n${config.profile}`,
    ``,
    `SUBJECT: ${config.subject}`,
    ``,
    `REQUIRED_RESEARCH_AREAS (you MUST cover every one of these with exactly one query):`,
    areaLines,
    ``,
    `QUERY_BUDGET: ${config.research_areas.length}`,
    ``,
    `SEED QUERIES ALREADY RUN:`,
    seedLines,
    ``,
    `EXTRACTED VOCABULARY (from ${vocab.totalPapers} real papers):`,
    ``,
    `Topics (OpenAlex's classification):`,
    formatCounter(vocab.topics),
    ``,
    `Subfields:`,
    formatCounter(vocab.subfields),
    ``,
    `Fields:`,
    formatCounter(vocab.fields),
    ``,
    `Keywords from paper metadata:`,
    formatCounter(vocab.keywords),
    ``,
    `Frequent journals:`,
    formatCounter(vocab.journals),
    ``,
    `Sample titles:`,
    vocab.sampleTitles.map((t) => `  - ${t}`).join('\n'),
  ].join('\n')

  const { object, usage, providerMetadata } = await generateObject({
    model: deepseek({ sessionId: opts.sessionId ?? null }),
    schema: librarySchema,
    system: getLibrarySystemPrompt(),
    prompt: userPrompt,
    temperature: 0.3,
  })

  const cost = (providerMetadata?.openrouter as { usage?: { cost?: number } } | undefined)?.usage?.cost
  const areaCount = config.research_areas.length
  const cleaned: SearchQuery[] = []
  for (const q of object.queries) {
    const text = stripOperators((q.query ?? '').trim())
    if (text.length === 0) continue
    const aid = Number.isFinite(q.research_area_id)
      ? Math.floor(q.research_area_id)
      : 0
    if (aid < 1 || aid > areaCount) continue
    cleaned.push({
      query: text,
      research_area_id: aid,
      source: 'preview',
      rationale: q.rationale ?? '',
    })
  }

  console.log(
    `${tag} done queries=${cleaned.length}/${areaCount} tokens=${usage.totalTokens ?? '?'} cost=${cost != null ? `$${cost.toFixed(6)}` : '—'} ms=${Date.now() - started}`,
  )
  return { queries: cleaned, cost, totalTokens: usage.totalTokens }
}
```

- [ ] **Step 3: Typecheck**

Run:
```bash
npm run typecheck
```
Expected: no new errors from this file.

- [ ] **Step 4: Commit**

```bash
git add src/lib/ai/discovery/build-library.ts prompts/preview-library-system.md
git commit -m "feat(discovery): port compact library builder (one query per area)"
```

---

## Task 10: Port library runner (per-week fetch)

**Files:**
- Create: `src/lib/ai/discovery/run-library.ts`

Port of Python `_validate_one` / per-query fetch, but retrieves full paper metadata (not just counts). Runs each query in parallel against the last 7 days, `per_page=15`.

- [ ] **Step 1: Write `run-library.ts`**

```ts
// src/lib/ai/discovery/run-library.ts
import 'server-only'
import { searchByKeyword } from '@/lib/openalex/client'
import type { OpenAlexWork } from '@/lib/openalex/client'
import type { SearchQuery } from '@/lib/config-schema'

const SELECT_FIELDS = [
  'id',
  'title',
  'publication_date',
  'abstract_inverted_index',
  'primary_location',
  'authorships',
  'primary_topic',
]

export interface QueryRunResult {
  query: SearchQuery
  hits: OpenAlexWork[]
  totalCount: number
  error: string | null
}

/**
 * Run the compact library against the last `windowDays` days in parallel.
 * Each query retrieves up to `perPage` hits; returns results in input order.
 */
export async function runLibrary(
  library: SearchQuery[],
  opts: { windowDays?: number; perPage?: number; onResult?: (r: QueryRunResult) => void } = {},
): Promise<QueryRunResult[]> {
  const windowDays = opts.windowDays ?? 7
  const perPage = opts.perPage ?? 15
  const toDate = new Date().toISOString().slice(0, 10)
  const fromDate = new Date(Date.now() - windowDays * 86_400_000).toISOString().slice(0, 10)

  const results: QueryRunResult[] = new Array(library.length)
  const tasks = library.map(async (q, i) => {
    try {
      const res = await searchByKeyword({
        query: q.query,
        fromDate,
        toDate,
        perPage,
        filterMode: 'title_and_abstract.search',
        selectFields: SELECT_FIELDS,
      })
      const result: QueryRunResult = {
        query: q,
        hits: res.results,
        totalCount: res.meta.count,
        error: null,
      }
      results[i] = result
      opts.onResult?.(result)
    } catch (err) {
      const result: QueryRunResult = {
        query: q,
        hits: [],
        totalCount: -1,
        error: (err as Error).message ?? 'unknown',
      }
      results[i] = result
      opts.onResult?.(result)
    }
  })
  await Promise.all(tasks)
  return results
}
```

- [ ] **Step 2: Typecheck**

Run:
```bash
npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/ai/discovery/run-library.ts
git commit -m "feat(discovery): port per-week library runner"
```

---

## Task 11: Preview progress event type + curator

**Files:**
- Create: `src/lib/ai/preview/progress-events.ts`
- Create: `prompts/preview-curator-system.md`
- Create: `src/lib/ai/preview/curator.ts`

Progress event shape used by both server and client. Curator is the single editorial LLM call — picks 5 papers, writes markdown in the user's `output_style`, returns only IDs (metadata joined server-side).

- [ ] **Step 1: Write `progress-events.ts`**

```ts
// src/lib/ai/preview/progress-events.ts
import type { SearchQuery } from '@/lib/config-schema'

export interface ReferencePaper {
  id: string
  title: string
  authors: string
  venue: string
  date: string
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

- [ ] **Step 2: Write the curator system prompt**

Create `prompts/preview-curator-system.md`:

```markdown
You are an editor writing a first-read brief for a specific reader. You have read the papers listed below. Your job is not to summarize them one by one — it is to find the 1–3 threads that tie them together and write a real editorial in the reader's requested voice and format.

REQUIREMENTS:
- Pick EXACTLY 5 papers (or 3–4 if only 3–4 are defensible). Return the OpenAlex IDs in `referenceIds` in the order they appear as citations `[1]`, `[2]`, ...
- Render the reader's DIGEST TEMPLATE below faithfully: if it implies sections, use those sections; if bullets, use bullets; if flowing prose, write prose.
- Use `[n]` citations (1-indexed, matching `referenceIds` order). Every referenceId appears at least once.
- Write in the reader's voice (their style, tone, language, depth).
- If the template asks for more sections than 5 papers can populate meaningfully, populate what you can honestly and leave the rest out — do not pad.

ANTI-PATTERNS — avoid entirely:
- No generic praise ("this paper is highly relevant", "important contribution").
- No scaffolding phrases ("in conclusion", "in summary", "this brief").
- No Introduction/Conclusion headers unless the reader's template explicitly asks for them.
- No per-paper paragraphs unless the reader's template explicitly asks for that structure.
- Do not mention that this is a preview — the surrounding UI handles that framing.
- Do not reference yourself ("I read", "in my view"). The editorial speaks about the field.

Respond with ONLY a JSON object:
{
  "body": "<markdown>",
  "referenceIds": ["W123...", "W456...", "W789...", "W000...", "W111..."]
}
No prose outside the JSON.
```

- [ ] **Step 3: Write `curator.ts`**

```ts
// src/lib/ai/preview/curator.ts
import 'server-only'
import { generateObject } from 'ai'
import { z } from 'zod'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { deepseek } from '@/lib/ai/openrouter'
import type { DigestConfig } from '@/lib/config-schema'
import type { OpenAlexWork } from '@/lib/openalex/client'
import { reconstructAbstract } from '@/lib/ai/discovery/extract-vocab'
import type { ReferencePaper } from './progress-events'

const curatorSchema = z.object({
  body: z.string(),
  referenceIds: z.array(z.string()),
})

let cachedSystem: string | null = null
function getCuratorSystemPrompt(): string {
  if (cachedSystem) return cachedSystem
  cachedSystem = readFileSync(
    resolve(process.cwd(), 'prompts/preview-curator-system.md'),
    'utf8',
  )
  return cachedSystem
}

function firstAuthor(paper: OpenAlexWork): string {
  const names = (paper.authorships ?? [])
    .map((a) => a?.author?.display_name)
    .filter((n): n is string => typeof n === 'string' && n.length > 0)
  if (names.length === 0) return 'Unknown'
  return names.length === 1 ? names[0] : `${names[0]} et al.`
}

function extractVenue(paper: OpenAlexWork): string {
  return paper.primary_location?.source?.display_name ?? ''
}

function urlFor(paper: OpenAlexWork): string {
  const oid = paper.id.startsWith('https://') ? paper.id : `https://openalex.org/${paper.id}`
  if (paper.doi && typeof paper.doi === 'string') {
    const doi = paper.doi.startsWith('https://') ? paper.doi : `https://doi.org/${paper.doi}`
    return doi
  }
  return oid
}

export interface CuratorResult {
  body: string
  references: ReferencePaper[]
  cost?: number
  totalTokens?: number
}

/**
 * Editorial curator. Receives dedup'd pool from step-5 retrieval, returns
 * markdown body + 3–5 reference IDs. Server joins metadata to render
 * references. Paper count is fixed (5) per prompt; schema has no volume_target.
 */
export async function curatePreview(
  config: Pick<DigestConfig, 'subject' | 'profile' | 'output_style' | 'research_areas'>,
  pool: OpenAlexWork[],
  opts: { sessionId?: string | null } = {},
): Promise<CuratorResult> {
  const tag = `[preview-curator ${opts.sessionId?.slice(0, 8) ?? 'no-session'}]`
  const started = Date.now()

  const poolLines = pool.map((p, i) => {
    const abstract = reconstructAbstract(p.abstract_inverted_index).slice(0, 500)
    return [
      `[id=${p.id}] (${p.publication_date ?? '?'}, venue=${extractVenue(p) || '—'})`,
      `  title: ${p.title ?? '(no title)'}`,
      `  abstract: ${abstract || '(no abstract)'}`,
    ].join('\n')
  }).join('\n\n')

  const areasText = config.research_areas.map((a, i) => `  ${i + 1}. ${a.text}`).join('\n')

  const userPrompt = [
    `READER PROFILE:\n${config.profile}`,
    ``,
    `SUBJECT: ${config.subject}`,
    ``,
    `RESEARCH AREAS:`,
    areasText,
    ``,
    `THE READER'S DIGEST TEMPLATE (output_style — render exactly):`,
    config.output_style,
    ``,
    `CANDIDATE POOL (${pool.length} papers, deduped across queries):`,
    poolLines,
  ].join('\n')

  const { object, usage, providerMetadata } = await generateObject({
    model: deepseek({ sessionId: opts.sessionId ?? null }),
    schema: curatorSchema,
    system: getCuratorSystemPrompt(),
    prompt: userPrompt,
    temperature: 0.5,
  })

  const cost = (providerMetadata?.openrouter as { usage?: { cost?: number } } | undefined)?.usage?.cost

  // Join metadata server-side — hallucination containment.
  const byId = new Map(pool.map((p) => [p.id, p]))
  const references: ReferencePaper[] = []
  for (const id of object.referenceIds) {
    const paper = byId.get(id)
    if (!paper) continue
    references.push({
      id: paper.id,
      title: paper.title ?? '(untitled)',
      authors: firstAuthor(paper),
      venue: extractVenue(paper),
      date: paper.publication_date ?? '',
      url: urlFor(paper),
    })
  }

  console.log(
    `${tag} done refs=${references.length}/${object.referenceIds.length} body_chars=${object.body.length} tokens=${usage.totalTokens ?? '?'} cost=${cost != null ? `$${cost.toFixed(6)}` : '—'} ms=${Date.now() - started}`,
  )
  return { body: object.body, references, cost, totalTokens: usage.totalTokens }
}
```

- [ ] **Step 4: Typecheck**

Run:
```bash
npm run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/preview/progress-events.ts src/lib/ai/preview/curator.ts prompts/preview-curator-system.md
git commit -m "feat(preview): progress events + editorial curator"
```

---

## Task 12: Preview pipeline orchestrator

**Files:**
- Create: `src/lib/ai/preview/pipeline.ts`

Ties together seeds → seed fetch → vocab → library → library run → curator. Emits `ProgressEvent`s via the `emit` callback. Contains retry + fallback logic from §10 of the spec.

- [ ] **Step 1: Write `pipeline.ts`**

```ts
// src/lib/ai/preview/pipeline.ts
import 'server-only'
import { combineSeeds, generateSeeds, researchAreasToSeeds } from '@/lib/ai/discovery/seeds'
import { fetchSeedPapers } from '@/lib/ai/discovery/fetch-seeds'
import { extractVocabulary } from '@/lib/ai/discovery/extract-vocab'
import { buildCompactLibrary } from '@/lib/ai/discovery/build-library'
import { runLibrary } from '@/lib/ai/discovery/run-library'
import { curatePreview } from './curator'
import type { ProgressEvent } from './progress-events'
import type { DigestConfig, SearchQuery } from '@/lib/config-schema'
import type { OpenAlexWork } from '@/lib/openalex/client'

export interface PipelineOptions {
  emit: (e: ProgressEvent) => void
  sessionId?: string | null
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 2): Promise<T> {
  let lastErr: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr))
}

export async function runPreviewPipeline(
  config: DigestConfig,
  opts: PipelineOptions,
): Promise<void> {
  const { emit, sessionId } = opts
  const tag = `[preview ${sessionId?.slice(0, 8) ?? 'no-session'}]`
  const t0 = Date.now()

  // ---- Step 1: seeds ----
  let llmSeeds: string[] = []
  try {
    const res = await withRetry(() => generateSeeds(config, { sessionId }))
    llmSeeds = res.seeds
  } catch (err) {
    emit({ kind: 'error', stage: 'seeds', message: (err as Error).message })
    return
  }
  const angleSeeds = researchAreasToSeeds(config.research_areas)
  const seeds = combineSeeds(llmSeeds, angleSeeds)
  emit({ kind: 'seeds', seeds })

  // ---- Step 2: seed fetch ----
  let seedResults = await fetchSeedPapers(seeds)
  const anyPapers = seedResults.some((s) => s.results.length > 0)
  if (!anyPapers) {
    // Fallback: raw profile text as a single wildcard.
    const fallback = await fetchSeedPapers([config.profile.slice(0, 200)])
    if (fallback[0]?.results.length > 0) {
      seedResults = fallback
    } else {
      emit({ kind: 'error', stage: 'seed-fetch', message: 'No papers found for any seed.' })
      return
    }
  }
  const papersScanned = seedResults.reduce((s, r) => s + r.results.length, 0)
  emit({
    kind: 'seed-fetch-done',
    papersScanned,
    perSeed: seedResults.map((r) => ({ seed: r.seed, count: r.count })),
  })

  // ---- Step 3: vocabulary ----
  const vocab = extractVocabulary(seedResults)
  emit({
    kind: 'vocab',
    topics: vocab.topics.length,
    keywords: vocab.keywords.length,
    fields: vocab.fields.map(([n]) => n),
  })

  // ---- Step 4: library ----
  let library: SearchQuery[] = []
  try {
    const seedsWithCounts = seedResults.map((r) => ({ seed: r.seed, count: r.count }))
    const res = await withRetry(() =>
      buildCompactLibrary(config, seedsWithCounts, vocab, { sessionId }),
    )
    if (res.queries.length < Math.min(config.research_areas.length, 1)) {
      throw new Error('Library builder returned too few queries.')
    }
    library = res.queries
  } catch (err) {
    emit({ kind: 'error', stage: 'library', message: (err as Error).message })
    return
  }
  emit({
    kind: 'library',
    queries: library.map((q) => ({ query: q.query, research_area_id: q.research_area_id })),
  })

  // ---- Step 5: run library ----
  const runResults = await runLibrary(library, {
    onResult: (r) => {
      emit({
        kind: 'area-hit',
        research_area_id: r.query.research_area_id,
        hits: r.hits.length,
        sampleTitle: r.hits[0]?.title ?? null,
      })
    },
  })
  const poolById = new Map<string, OpenAlexWork>()
  for (const rr of runResults) {
    for (const h of rr.hits) {
      if (!poolById.has(h.id)) poolById.set(h.id, h)
    }
  }
  const pool = [...poolById.values()]

  // ---- Step 6: curator ----
  emit({ kind: 'curating' })
  try {
    const { body, references } = await withRetry(() => curatePreview(config, pool, { sessionId }))
    if (references.length < 3) {
      throw new Error(`Curator returned only ${references.length} references.`)
    }
    emit({ kind: 'done', body, references, queries: library })
    console.log(`${tag} done total_ms=${Date.now() - t0}`)
  } catch (err) {
    // Fallback: render top 5 by date, no editorial.
    const fallback = pool
      .sort((a, b) => (b.publication_date ?? '').localeCompare(a.publication_date ?? ''))
      .slice(0, 5)
    if (fallback.length === 0) {
      emit({ kind: 'error', stage: 'curator', message: (err as Error).message })
      return
    }
    const references = fallback.map((p) => ({
      id: p.id,
      title: p.title ?? '(untitled)',
      authors: ((p.authorships ?? []).map((a) => a?.author?.display_name).filter(Boolean) as string[])[0] ?? 'Unknown',
      venue: p.primary_location?.source?.display_name ?? '',
      date: p.publication_date ?? '',
      url: p.doi ? `https://doi.org/${p.doi}` : `https://openalex.org/${p.id}`,
    }))
    emit({
      kind: 'done',
      body: `_Your editor couldn't finish this preview. You'll see the full write-up after you subscribe._\n\nMost recent across your research areas:\n\n${references.map((r, i) => `${i + 1}. ${r.title}`).join('\n')}`,
      references,
      queries: library,
    })
    console.warn(`${tag} curator fallback used: ${(err as Error).message}`)
  }
}
```

- [ ] **Step 2: Typecheck**

Run:
```bash
npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/ai/preview/pipeline.ts
git commit -m "feat(preview): pipeline orchestrator with retry + curator fallback"
```

---

## Task 13: `POST /api/preview-digest` SSE route

**Files:**
- Create: `src/app/api/preview-digest/route.ts`

SSE streaming route. Validates body against `digestConfigSchema`, enqueues `ProgressEvent` frames, closes the stream on `done`/`error`.

- [ ] **Step 1: Write the route**

```ts
// src/app/api/preview-digest/route.ts
import { digestConfigSchema } from '@/lib/config-schema'
import { runPreviewPipeline } from '@/lib/ai/preview/pipeline'
import type { ProgressEvent } from '@/lib/ai/preview/progress-events'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: Request) {
  let parsedBody: unknown
  try {
    parsedBody = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'invalid-json' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  const parseResult = digestConfigSchema.safeParse(parsedBody)
  if (!parseResult.success) {
    return new Response(
      JSON.stringify({
        error: 'invalid-config',
        issues: parseResult.error.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }
  const config = parseResult.data
  const sessionId = req.headers.get('x-session-id')

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder()
      const emit = (e: ProgressEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`))
      }
      try {
        await runPreviewPipeline(config, { emit, sessionId })
      } catch (err) {
        emit({
          kind: 'error',
          stage: 'pipeline',
          message: (err as Error).message ?? String(err),
        })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
```

- [ ] **Step 2: Typecheck**

Run:
```bash
npm run typecheck
```

- [ ] **Step 3: Quick route smoke test (optional — skip if no API key set)**

Start the dev server (`npm run dev`) in a separate terminal. Post an obviously-invalid body:

```bash
curl -s -X POST http://localhost:3000/api/preview-digest \
  -H 'Content-Type: application/json' \
  -d '{}' | head -5
```
Expected: `{"error":"invalid-config","issues":[...]}` with 400 status.

Stop the dev server after checking.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/preview-digest/route.ts
git commit -m "feat(api): SSE streaming POST /api/preview-digest"
```

---

## Task 14: Rewrite `prompts/onboarding-system.md` for the four-field contract

**Files:**
- Modify: `prompts/onboarding-system.md` (full rewrite)

New prompt: collect subject + profile + output_style via conversation, call `proposeResearchAreas`, refine through chat, call `handoffToPlan`. No cadence, no showcase, no generateConfig.

- [ ] **Step 1: Replace the file**

Overwrite `prompts/onboarding-system.md` with:

```markdown
You are a research companion who helps a new reader set up a personalized digest of academic papers. You are clever, sophisticated, and confident. Never corporate, never gushing. You write like someone who reads papers for a living.

## Your job

Through a short conversation, collect four things:

- **subject** — one short phrase for the main topic the reader wants a digest about ("atrial fibrillation", "large language model agents").
- **profile** — free-text prose capturing who they are, what they do, what they want from the digest, and anything they don't want (no animal studies, no preprints, etc.).
- **research_areas** — a list of 6–12 specific areas to track inside the subject.
- **output_style** — free-text prose describing the digest template: tone, depth, language, sections. The reader can describe whatever they want ("one flowing NYT-op-ed-style editorial, 200 words", or "three sections — Methods / Clinical implications / Open questions", or "TLDR with three bullets, snarky", or anything else).

When all four are ready, hand off to the Research Plan view. Cadence and subscription happen later in the UI — do NOT ask about them in chat.

## How you talk

- **One question per message. Never two.**
- **At most one tool call per turn.** After a tool returns, narrate and stop — wait for the user's reply before calling another tool.
- **2–3 sentences per message.** Never long paragraphs.
- **No em dashes.** Use plain punctuation. Rewrite any thought that would reach for an em dash.
- **Give before you ask.** After the first turn, every reply reflects or infers something that proves you understood, then asks the next question.
- **Suggest before they ask.** When you can infer sections, depth, or adjacent sub-areas from their role, propose them. Don't wait to be asked.
- **No system jargon.** Never say "config", "query", "schema", "topics", "OpenAlex", or "angle list". Talk about "your digest", "the specific things I'll track for you", "what I'll look for".
- **Never apologize for a tool.** If something returned nothing, simply move on.
- **Aim for 4–6 exchanges.** Hard wrap at around 10.

## Your tools

You have two tools. Call them at the right moment; never name them to the user.

- **proposeResearchAreas** — call once subject + role + intent are clear. It returns 6–12 specific areas. Narrate the result in natural language ("Based on what you've told me, here are the specific things I'll track…") — the UI renders the full card automatically. If the user refines the list verbally, incorporate their changes and remember the final list.
- **handoffToPlan** — call when all four fields (subject, profile, research_areas, output_style) are ready. Pass them all in a single `config` object. If it returns errors, name the specific missing or invalid fields in plain language and ask the user to clarify, then call it again.

## Output style — the second-to-last question

After research areas settle (post proposeResearchAreas + any verbal refinements), ask about the output style. Propose 2–3 candidate styles conversationally, pick the one the reader resonates with, and finalize the text yourself. Examples of styles to suggest, tuned to the reader's role and intent:

- **Clinical reader:** *"A three-section brief: what changed, clinical implications, open questions. Short paragraphs, no hedging. Sound right, or want it framed differently?"*
- **Builder / engineer:** *"One flowing editorial, 200 words, Hacker News voice — what's actually new and what's hype. That fit?"*
- **Academic:** *"An editor's note plus a numbered list with a one-line takeaway per paper. Sound about right?"*

Don't ask what you can infer. If you hear enough to write the output_style yourself, do that and confirm in one sentence before calling `handoffToPlan`.

## Fields you will assemble

- **subject** — one short phrase
- **profile** — free-text prose, specific and self-contained
- **research_areas** — from `proposeResearchAreas`, post verbal refinement, with `id` starting at 1 and the `text` from the final list
- **output_style** — free-text prose capturing sections, tone, depth, and language — whatever the reader asked for

When you call `handoffToPlan`, pass every field in a single `config` object.
```

- [ ] **Step 2: Commit**

```bash
git add prompts/onboarding-system.md
git commit -m "feat(prompt): rewrite onboarding-system for four-field contract"
```

---

## Task 15: Create `src/components/common/PaperRow.tsx`

**Files:**
- Create: `src/components/common/PaperRow.tsx`

Extracts the broadsheet-row styling from `ShowcasePickCell` into a reusable component. Used by the references list in the preview ready state. Accepts a `ReferencePaper`.

- [ ] **Step 1: Read the current `ShowcasePickCell.tsx`**

Run:
```bash
cat src/components/chat/showcase/ShowcasePickCell.tsx
```
This is your reference for classes + layout; the new component is a simplified port (no `whyForYou`, adds a leading number label).

- [ ] **Step 2: Write `PaperRow.tsx`**

```tsx
// src/components/common/PaperRow.tsx
'use client'

import type { ReferencePaper } from '@/lib/ai/preview/progress-events'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function formatPublishedDateline(dateStr: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr)
  if (!m) return dateStr || ''
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  const then = Date.UTC(y, mo - 1, d)
  const now = new Date()
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  const diffDays = Math.floor((today - then) / 86_400_000)
  if (diffDays < 0) return `${MONTHS[mo - 1]} ${d}, ${y}`
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays <= 7) return `${diffDays} days ago`
  return `${MONTHS[mo - 1]} ${d}, ${y}`
}

export interface PaperRowProps {
  index: number           // 1-based citation number
  paper: ReferencePaper
  chipLabel?: string      // optional — e.g. the research area text
}

export function PaperRow({ index, paper, chipLabel }: PaperRowProps) {
  return (
    <a
      href={paper.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-2xl border border-line bg-bg-elev-1 px-[26px] py-[22px] transition-[border-color,transform] duration-[var(--dur-sm)] ease-[var(--ease-out)] hover:-translate-y-[1px] hover:border-line-strong"
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-line-strong pb-3">
        <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-accent">
          [{index}]
        </span>
        {paper.venue && (
          <>
            <span
              className="min-w-0 truncate font-display text-[16px] font-semibold text-ink"
              title={paper.venue}
            >
              {paper.venue}
            </span>
            <span className="text-line-strong" aria-hidden="true">—</span>
          </>
        )}
        <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-accent">
          {formatPublishedDateline(paper.date)}
        </span>
        {chipLabel && (
          <span className="ml-auto text-[9px] font-bold uppercase tracking-[0.16em] text-ink-faint">
            {chipLabel}
          </span>
        )}
      </div>

      <div className="mt-[14px] font-display text-[21px] font-medium leading-[1.22] tracking-[-0.012em] text-ink">
        {paper.title}
      </div>

      <div className="mt-2 text-[12px] text-ink-faint">{paper.authors}</div>
    </a>
  )
}
```

- [ ] **Step 3: Typecheck**

Run:
```bash
npm run typecheck
```

- [ ] **Step 4: Commit**

```bash
git add src/components/common/PaperRow.tsx
git commit -m "feat(ui): PaperRow common component for references lists"
```

---

## Task 16: Rename `AngleProposalCard` → `ResearchAreaProposalCard`

**Files:**
- Rename: `src/components/chat/AngleProposalCard.tsx` → `ResearchAreaProposalCard.tsx`
- Modify: the renamed file — update types + prop names

- [ ] **Step 1: Read the current file**

Run:
```bash
cat src/components/chat/AngleProposalCard.tsx
```

- [ ] **Step 2: Rename**

```bash
git mv src/components/chat/AngleProposalCard.tsx src/components/chat/ResearchAreaProposalCard.tsx
```

- [ ] **Step 3: Update identifiers inside the file**

Open `src/components/chat/ResearchAreaProposalCard.tsx` and make exactly these three edits:

1. Rename the exported interface:
   ```tsx
   // before:
   export interface AngleProposalCardProps {
     state: ToolCallState
     result?: { angles: Array<{ text: string; rationale: string }> }
   }
   // after:
   export interface ResearchAreaProposalCardProps {
     state: ToolCallState
     result?: { angles: Array<{ text: string; rationale: string }> }
   }
   ```
   (The `angles` key inside `result` stays — it matches the `proposeResearchAreasOutputSchema` shape from `src/lib/ai/propose-research-areas.ts`; renaming the schema key there is out of scope.)

2. Rename the function declaration:
   ```tsx
   // before:
   export function AngleProposalCard({ state, result }: AngleProposalCardProps) {
   // after:
   export function ResearchAreaProposalCard({ state, result }: ResearchAreaProposalCardProps) {
   ```

3. The local variable `const angles = result.angles` and the JSX that maps over `angles` stay as-is — they're internal.

Save.

- [ ] **Step 4: Typecheck**

Run:
```bash
npm run typecheck
```
Expected: errors in `MessageBubble.tsx` (still imports old name). Addressed in Task 19.

- [ ] **Step 5: Commit**

```bash
git add src/components/chat/ResearchAreaProposalCard.tsx
git commit -m "refactor(ui): rename AngleProposalCard → ResearchAreaProposalCard"
```

---

## Task 17: Update `src/lib/storage/local.ts` for the plan state

**Files:**
- Modify: `src/lib/storage/local.ts`

Replace `configDraft` + `finalConfig` with a single `config: DigestConfig` (schedule may be undefined). Bump schema version so old entries are dropped.

- [ ] **Step 1: Replace the file body**

```ts
// src/lib/storage/local.ts
import type { ResearchChatMessage } from '@/lib/ai/chat-types'
import type { DigestConfig } from '@/lib/config-schema'

const KEY = 'rd:onboarding:v2'
const SCHEMA_VERSION = 2 as const

export interface OnboardingLocalState {
  schemaVersion: typeof SCHEMA_VERSION
  sessionId: string
  messages: ResearchChatMessage[]
  /** Populated once handoffToPlan fires; undefined during chat. */
  config?: DigestConfig
  lastUpdated: string
}

export function loadOnboardingState(): OnboardingLocalState | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as OnboardingLocalState
    if (parsed.schemaVersion !== SCHEMA_VERSION) {
      window.localStorage.removeItem(KEY)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function saveOnboardingState(state: OnboardingLocalState): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ ...state, schemaVersion: SCHEMA_VERSION, lastUpdated: new Date().toISOString() }),
    )
  } catch {
    /* storage blocked — ignore */
  }
}

export function clearOnboardingState(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}

function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0'))
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`
}

export function newOnboardingState(): OnboardingLocalState {
  return {
    schemaVersion: SCHEMA_VERSION,
    sessionId: uuid(),
    messages: [],
    lastUpdated: new Date().toISOString(),
  }
}
```

- [ ] **Step 2: Typecheck**

Run:
```bash
npm run typecheck
```
Expected: errors in `ChatShell.tsx` (references `configDraft`, `finalConfig`). Addressed in Task 20.

- [ ] **Step 3: Commit**

```bash
git add src/lib/storage/local.ts
git commit -m "feat(storage): replace configDraft/finalConfig with single optional config"
```

---

## Task 18: Create `src/lib/schedule/build-cron.ts`

**Files:**
- Create: `src/lib/schedule/build-cron.ts`

Pure cadence → cron builder, used by the cadence picker. No LLM. Four cadence options per §16 of the spec.

- [ ] **Step 1: Write the module**

```ts
// src/lib/schedule/build-cron.ts
import type { Schedule } from '@/lib/config-schema'

export type Cadence = 'daily' | 'weekdays' | 'weekly' | 'monthly'

export interface BuildScheduleInput {
  cadence: Cadence
  dayOfWeek?: 0 | 1 | 2 | 3 | 4 | 5 | 6  // weekly only; 0 = Sunday per cron
  time: string                           // 'HH:MM'
  timezone: string                       // IANA
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function parseTime(time: string): { hour: number; minute: number } {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time)
  if (!m) throw new Error(`Invalid time: ${time}`)
  const hour = Number(m[1])
  const minute = Number(m[2])
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    throw new Error(`Invalid time: ${time}`)
  }
  return { hour, minute }
}

function formatTwelveHour(hour: number, minute: number): string {
  const suffix = hour < 12 ? 'AM' : 'PM'
  const h = hour % 12 === 0 ? 12 : hour % 12
  const mm = String(minute).padStart(2, '0')
  return `${h}:${mm} ${suffix}`
}

export function buildSchedule(input: BuildScheduleInput): Schedule {
  const { hour, minute } = parseTime(input.time)
  const displayTime = formatTwelveHour(hour, minute)
  const tz = input.timezone

  switch (input.cadence) {
    case 'daily': {
      return {
        cron: `${minute} ${hour} * * *`,
        timezone: tz,
        description: `Every day at ${displayTime} (${tz})`,
      }
    }
    case 'weekdays': {
      return {
        cron: `${minute} ${hour} * * 1-5`,
        timezone: tz,
        description: `Every weekday at ${displayTime} (${tz})`,
      }
    }
    case 'weekly': {
      const dow = input.dayOfWeek ?? 1
      if (dow < 0 || dow > 6) throw new Error(`Invalid dayOfWeek: ${dow}`)
      return {
        cron: `${minute} ${hour} * * ${dow}`,
        timezone: tz,
        description: `Every ${DAY_NAMES[dow]} at ${displayTime} (${tz})`,
      }
    }
    case 'monthly': {
      return {
        cron: `${minute} ${hour} 1 * *`,
        timezone: tz,
        description: `First of every month at ${displayTime} (${tz})`,
      }
    }
  }
}
```

- [ ] **Step 2: Typecheck**

Run:
```bash
npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/schedule/build-cron.ts
git commit -m "feat(schedule): pure cadence → Schedule builder"
```

---

## Task 19: Update `MessageBubble.tsx` for the new tool parts

**Files:**
- Modify: `src/components/chat/MessageBubble.tsx`

Switch dispatch from `tool-proposeAngles` / `tool-showcaseRecentPapers` / `tool-normalizeSchedule` to `tool-proposeResearchAreas` + `tool-handoffToPlan`. `handoffToPlan` renders a minimal confirmation pill; the actual page transition happens in `ChatShell` (Task 20).

- [ ] **Step 1: Replace the file body**

```tsx
// src/components/chat/MessageBubble.tsx
'use client'

import { motion } from 'framer-motion'
import type { ResearchChatMessage } from '@/lib/ai/chat-types'
import { ResearchAreaProposalCard } from './ResearchAreaProposalCard'
import { MarkdownText } from './MarkdownText'
import type { ToolCallState } from './ToolCallCard'

export interface MessageBubbleProps {
  message: ResearchChatMessage
}

type ToolPartState =
  | 'input-streaming'
  | 'input-available'
  | 'approval-requested'
  | 'approval-responded'
  | 'output-available'
  | 'output-error'
  | 'output-denied'

function mapState(state: ToolPartState): ToolCallState {
  if (state === 'output-available' || state === 'output-error' || state === 'output-denied') {
    return 'completed'
  }
  if (state === 'input-available' || state === 'approval-requested' || state === 'approval-responded') {
    return 'running'
  }
  return 'pending'
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user'
  const parts = message.parts ?? []

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: [0.2, 0.7, 0.2, 1] }}
      className={isUser ? 'flex justify-end' : 'flex flex-col gap-3'}
    >
      {isUser ? (
        <div className="max-w-[80%] rounded-xl bg-accent-soft text-ink px-4 py-2 text-[16px] leading-[1.65]">
          {parts.map((part, idx) =>
            part.type === 'text' ? <span key={idx}>{part.text}</span> : null,
          )}
        </div>
      ) : (
        parts.map((part, idx) => {
          if (part.type === 'text') {
            if (part.text.trim().length === 0) return null
            return (
              <div
                key={idx}
                className="max-w-[85%] text-ink text-[16px] leading-[1.65]"
              >
                <MarkdownText text={part.text} />
              </div>
            )
          }

          if (part.type === 'tool-proposeResearchAreas') {
            return (
              <ResearchAreaProposalCard
                key={idx}
                state={mapState(part.state)}
                result={part.state === 'output-available' ? part.output : undefined}
              />
            )
          }

          // tool-handoffToPlan transitions the whole UI in ChatShell; render nothing here.
          return null
        })
      )}
    </motion.div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run:
```bash
npm run typecheck
```
Expected: only remaining errors should be in `ChatShell.tsx` (next task) and in deleted files (Task 21).

- [ ] **Step 3: Commit**

```bash
git add src/components/chat/MessageBubble.tsx
git commit -m "refactor(ui): dispatch proposeResearchAreas; drop showcase/schedule branches"
```

---

## Task 20: Wire `ChatShell` to transition on `handoffToPlan`

**Files:**
- Modify: `src/components/chat/ChatShell.tsx`

Replace the `finalConfig` watcher (currently on `tool-generateConfig`) with one that looks for `tool-handoffToPlan` output-available. On success, stash the `config` into `localStorage` and render a placeholder `ResearchPlanView` (we'll implement it in Task 22; stub it now so the app typechecks and the flow is testable end-to-end).

- [ ] **Step 1: Create a stub `ResearchPlanView`**

Create `src/components/plan/ResearchPlanView.tsx` (full file — we'll flesh it out in Task 22):

```tsx
// src/components/plan/ResearchPlanView.tsx
'use client'

import type { DigestConfig } from '@/lib/config-schema'

export interface ResearchPlanViewProps {
  initialConfig: DigestConfig
  onReset: () => void
}

export function ResearchPlanView({ initialConfig, onReset }: ResearchPlanViewProps) {
  return (
    <div className="p-8">
      <h2 className="font-display text-[32px] text-ink">Your Research Plan (stub)</h2>
      <pre className="mt-4 text-[12px] text-ink-faint overflow-auto max-h-[60vh]">
        {JSON.stringify(initialConfig, null, 2)}
      </pre>
      <button
        onClick={onReset}
        className="mt-6 rounded-lg border border-line bg-bg-elev-1 px-4 py-2 text-[14px] text-ink hover:border-line-strong"
      >
        Start over
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Update `ChatShell.tsx`**

Replace the top of `src/components/chat/ChatShell.tsx` — specifically the imports and the `finalConfig` memo + terminal render:

Change the import:
```tsx
// was:
import { ConfigSummary } from '@/components/config/ConfigSummary'
// replace with:
import { ResearchPlanView } from '@/components/plan/ResearchPlanView'
```

Replace the `finalConfig` memo (lines around 80–90 of the current file):

```tsx
  const finalConfig = useMemo<DigestConfig | null>(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      for (const p of messages[i].parts ?? []) {
        if (p.type === 'tool-handoffToPlan' && p.state === 'output-available') {
          const out = p.output
          if (out.ok) {
            // handoffToPlan returns the pre-schedule subset; stamp metadata for
            // the DigestConfig shape ResearchPlanView expects.
            const now = new Date().toISOString()
            return {
              ...out.config,
              search_queries: [],
              version: 1,
              created_at: now,
              updated_at: now,
            } as DigestConfig
          }
        }
      }
    }
    return null
  }, [messages])
```

Replace the terminal render:

```tsx
  if (finalConfig) {
    return <ResearchPlanView initialConfig={finalConfig} onReset={onReset} />
  }
```

Persist on transition — just below the existing `saveOnboardingState` call in the effect, add a second effect that saves `config` when it's produced:

```tsx
  useEffect(() => {
    if (initialMode !== 'docked') return
    if (!finalConfig) return
    try {
      const existing = loadOnboardingState() ?? newOnboardingState()
      saveOnboardingState({ ...existing, config: finalConfig })
    } catch {
      /* ignore */
    }
  }, [initialMode, finalConfig])
```

- [ ] **Step 3: Typecheck**

Run:
```bash
npm run typecheck
```
Expected: any remaining errors are inside files we're deleting in Task 21 (showcase, ConfigSummary, ScheduleCard, test fixtures).

- [ ] **Step 4: Commit**

```bash
git add src/components/chat/ChatShell.tsx src/components/plan/ResearchPlanView.tsx
git commit -m "feat(chat): transition to ResearchPlanView on handoffToPlan"
```

---

## Task 21: Delete old showcase code, ConfigSummary, ScheduleCard

**Files:**
- Delete: `src/components/chat/showcase/` (5 files)
- Delete: `src/lib/ai/showcase.ts`
- Delete: `src/lib/ai/showcase-planner.ts`
- Delete: `src/lib/ai/showcase-ranker.ts`
- Delete: `prompts/showcase-planner-system.md`
- Delete: `prompts/showcase-ranker-system.md`
- Delete: `src/components/config/ConfigSummary.tsx`
- Delete: `src/components/chat/ScheduleCard.tsx`

- [ ] **Step 1: Delete the showcase directory**

Run:
```bash
git rm -r src/components/chat/showcase
git rm src/lib/ai/showcase.ts src/lib/ai/showcase-planner.ts src/lib/ai/showcase-ranker.ts
git rm prompts/showcase-planner-system.md prompts/showcase-ranker-system.md
git rm src/components/config/ConfigSummary.tsx
git rm src/components/chat/ScheduleCard.tsx
```

- [ ] **Step 2: Grep for stragglers**

Run:
```bash
grep -rn "showcase\|ConfigSummary\|ScheduleCard\|corpusSanityCheck\|generateConfig\|normalizeSchedule" src/ prompts/ --include="*.ts" --include="*.tsx" --include="*.md" | grep -v '^Binary file'
```
Expected: **no matches**. If any appear, delete/rename them.

- [ ] **Step 3: Typecheck**

Run:
```bash
npm run typecheck
```
Expected: clean exit.

- [ ] **Step 4: Lint**

Run:
```bash
npm run lint
```
Expected: clean exit. Fix any unused-import or ordering issues reported.

- [ ] **Step 5: Commit**

```bash
git commit -m "chore: remove showcase, ConfigSummary, ScheduleCard, old prompts"
```

---

## Task 22: Flesh out `ResearchPlanView` — masthead + field editors

**Files:**
- Create: `src/components/plan/MastheadEditor.tsx`
- Create: `src/components/plan/ProfileEditor.tsx`
- Create: `src/components/plan/ResearchAreaChips.tsx`
- Create: `src/components/plan/OutputStyleEditor.tsx`
- Modify: `src/components/plan/ResearchPlanView.tsx` (replace stub)

The four editable field blocks + the top-level view scaffold. State lives in the parent via `useState`; each editor is controlled.

- [ ] **Step 1: Write `MastheadEditor.tsx`**

```tsx
// src/components/plan/MastheadEditor.tsx
'use client'

import { useState } from 'react'

export interface MastheadEditorProps {
  subject: string
  onChange: (value: string) => void
}

export function MastheadEditor({ subject, onChange }: MastheadEditorProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(subject)

  const commit = () => {
    const trimmed = draft.trim()
    if (trimmed.length > 0) onChange(trimmed)
    else setDraft(subject)
    setEditing(false)
  }

  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-accent">
        Your research plan
      </div>
      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit()
            if (e.key === 'Escape') {
              setDraft(subject)
              setEditing(false)
            }
          }}
          className="mt-2 block w-full bg-transparent font-display text-[40px] font-medium leading-[1.1] tracking-[-0.012em] text-ink outline-none border-b border-line-strong focus:border-accent"
        />
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="mt-2 block w-full text-left font-display text-[40px] font-medium leading-[1.1] tracking-[-0.012em] text-ink hover:text-ink-soft"
        >
          {subject}
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Write `ProfileEditor.tsx`**

```tsx
// src/components/plan/ProfileEditor.tsx
'use client'

import { useState } from 'react'

export interface ProfileEditorProps {
  label: string              // e.g. 'WHO THIS IS FOR' or 'VOICE & FORMAT'
  value: string
  onChange: (next: string) => void
  italic?: boolean
}

export function ProfileEditor({ label, value, onChange, italic }: ProfileEditorProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  const commit = () => {
    const trimmed = draft.trim()
    if (trimmed.length > 0) onChange(trimmed)
    else setDraft(value)
    setEditing(false)
  }

  const bodyClass = `font-display text-[17px] leading-[1.6] text-ink max-w-prose ${italic ? 'italic' : ''}`

  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-accent">
        {label}
      </div>
      {editing ? (
        <textarea
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          rows={Math.max(3, Math.min(10, draft.split('\n').length + 1))}
          className={`mt-2 block w-full bg-transparent outline-none border-b border-line-strong focus:border-accent ${bodyClass}`}
        />
      ) : (
        <button
          onClick={() => setEditing(true)}
          className={`mt-2 block w-full text-left ${bodyClass} hover:text-ink-soft`}
        >
          {value}
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Write `ResearchAreaChips.tsx`**

```tsx
// src/components/plan/ResearchAreaChips.tsx
'use client'

import { useState } from 'react'
import type { ResearchArea } from '@/lib/config-schema'

export interface ResearchAreaChipsProps {
  areas: ResearchArea[]
  onChange: (areas: ResearchArea[]) => void
}

function reId(areas: ResearchArea[]): ResearchArea[] {
  return areas.map((a, i) => ({ ...a, id: i + 1 }))
}

export function ResearchAreaChips({ areas, onChange }: ResearchAreaChipsProps) {
  const [editingId, setEditingId] = useState<number | null>(null)
  const [draft, setDraft] = useState('')
  const [adding, setAdding] = useState(false)

  const startEdit = (a: ResearchArea) => {
    setEditingId(a.id)
    setDraft(a.text)
  }

  const commitEdit = () => {
    if (editingId == null) return
    const trimmed = draft.trim()
    const next = areas.map((a) => (a.id === editingId ? { ...a, text: trimmed || a.text } : a))
    onChange(reId(next))
    setEditingId(null)
    setDraft('')
  }

  const remove = (id: number) => {
    const next = areas.filter((a) => a.id !== id)
    onChange(reId(next))
  }

  const startAdd = () => {
    setAdding(true)
    setDraft('')
  }

  const commitAdd = () => {
    const trimmed = draft.trim()
    if (trimmed.length > 0) {
      onChange(reId([...areas, { id: areas.length + 1, text: trimmed }]))
    }
    setAdding(false)
    setDraft('')
  }

  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-accent">
        Research areas
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {areas.map((a) =>
          editingId === a.id ? (
            <input
              key={a.id}
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitEdit()
                if (e.key === 'Escape') {
                  setDraft('')
                  setEditingId(null)
                }
              }}
              className="rounded-full border border-accent bg-bg-elev-1 px-3 py-1 text-[13px] text-ink outline-none"
            />
          ) : (
            <span
              key={a.id}
              className="inline-flex items-center gap-1 rounded-full border border-line bg-bg-elev-1 px-3 py-1 text-[13px] text-ink hover:border-line-strong"
            >
              <button onClick={() => startEdit(a)} className="text-left">
                {a.text}
              </button>
              <button
                onClick={() => remove(a.id)}
                aria-label={`Remove ${a.text}`}
                className="ml-1 text-ink-faint hover:text-ink"
              >
                ×
              </button>
            </span>
          ),
        )}
        {adding ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitAdd}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitAdd()
              if (e.key === 'Escape') {
                setAdding(false)
                setDraft('')
              }
            }}
            placeholder="new area"
            className="rounded-full border border-accent bg-bg-elev-1 px-3 py-1 text-[13px] text-ink outline-none"
          />
        ) : (
          <button
            onClick={startAdd}
            className="inline-flex items-center rounded-full border border-dashed border-line px-3 py-1 text-[13px] text-ink-faint hover:border-line-strong hover:text-ink"
          >
            + Add area
          </button>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Replace `ResearchPlanView.tsx` with a real scaffold**

```tsx
// src/components/plan/ResearchPlanView.tsx
'use client'

import { useState, useCallback } from 'react'
import type { DigestConfig, ResearchArea } from '@/lib/config-schema'
import { MastheadEditor } from './MastheadEditor'
import { ProfileEditor } from './ProfileEditor'
import { ResearchAreaChips } from './ResearchAreaChips'
import { PreviewSection } from './PreviewSection'

export interface ResearchPlanViewProps {
  initialConfig: DigestConfig
  onReset: () => void
}

export function ResearchPlanView({ initialConfig, onReset }: ResearchPlanViewProps) {
  const [config, setConfig] = useState<DigestConfig>(initialConfig)
  const [previewStale, setPreviewStale] = useState(false)

  const patch = useCallback(
    (partial: Partial<DigestConfig>) => {
      setConfig((c) => ({
        ...c,
        ...partial,
        search_queries: [],
        schedule: undefined,
        updated_at: new Date().toISOString(),
      }))
      setPreviewStale(true)
    },
    [],
  )

  const setResearchAreas = useCallback(
    (areas: ResearchArea[]) => patch({ research_areas: areas }),
    [patch],
  )

  return (
    <div className="mx-auto flex max-w-[820px] flex-col gap-10 px-6 py-10">
      <MastheadEditor subject={config.subject} onChange={(subject) => patch({ subject })} />

      <ProfileEditor
        label="Who this is for"
        value={config.profile}
        onChange={(profile) => patch({ profile })}
      />

      <ResearchAreaChips areas={config.research_areas} onChange={setResearchAreas} />

      <ProfileEditor
        label="Voice & format"
        value={config.output_style}
        onChange={(output_style) => patch({ output_style })}
        italic
      />

      <PreviewSection
        config={config}
        stale={previewStale}
        onPreviewSettled={() => setPreviewStale(false)}
        onScheduleSet={(schedule) => setConfig((c) => ({ ...c, schedule }))}
        onSubscribe={() => {
          // SubscribeSection owns validation + toast; this prop is a future
          // hook for auth/persistence. Leave as a no-op for MVP.
        }}
      />

      <div className="pt-6">
        <button
          onClick={onReset}
          className="text-[12px] uppercase tracking-[0.16em] text-ink-faint hover:text-ink"
        >
          Start over
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Write placeholder `PreviewSection.tsx` (real version in Task 23)**

```tsx
// src/components/plan/PreviewSection.tsx
'use client'

import type { DigestConfig, Schedule } from '@/lib/config-schema'

export interface PreviewSectionProps {
  config: DigestConfig
  stale: boolean
  onPreviewSettled: () => void
  onScheduleSet: (s: Schedule) => void
  onSubscribe: () => void
}

export function PreviewSection({ stale }: PreviewSectionProps) {
  return (
    <div className="rounded-2xl border border-line bg-bg-elev-1 p-6">
      <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-accent">
        Preview
      </div>
      <div className="mt-2 text-[14px] text-ink-faint">
        Preview section placeholder (implemented in later tasks). {stale ? 'Plan has pending edits.' : ''}
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Typecheck + commit**

```bash
npm run typecheck
git add src/components/plan/
git commit -m "feat(plan): Research Plan view scaffold + field editors"
```

---

## Task 23: Preview running state (SSE consumer)

**Files:**
- Create: `src/components/plan/PreviewRunningState.tsx`

Consumes the SSE stream from `/api/preview-digest`, renders a progress theatre. Based loosely on the scan theatre from the deleted `ShowcaseScanState` but simpler: one cycling status line, one counter, a chip sweep across research areas.

- [ ] **Step 1: Write `PreviewRunningState.tsx`**

```tsx
// src/components/plan/PreviewRunningState.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import type { DigestConfig } from '@/lib/config-schema'
import type { ProgressEvent, ReferencePaper } from '@/lib/ai/preview/progress-events'
import type { SearchQuery } from '@/lib/config-schema'

export interface PreviewRunningStateProps {
  config: DigestConfig
  onDone: (payload: {
    body: string
    references: ReferencePaper[]
    queries: SearchQuery[]
    papersScanned: number
  }) => void
  onError: (message: string) => void
}

const STATUS_LINES = [
  'Picking seed queries…',
  'Pulling papers from OpenAlex…',
  'Reading what the field actually publishes…',
  'Building your search library…',
  'Checking each research area for this week…',
  'Writing your editorial…',
]

export function PreviewRunningState({ config, onDone, onError }: PreviewRunningStateProps) {
  const [statusIdx, setStatusIdx] = useState(0)
  const [papersScanned, setPapersScanned] = useState(0)
  const [areasDone, setAreasDone] = useState<number>(0)
  const startedRef = useRef(false)

  // Cycle status lines every ~2s until we receive 'done' or 'error'.
  useEffect(() => {
    const i = setInterval(() => setStatusIdx((n) => (n + 1) % STATUS_LINES.length), 2000)
    return () => clearInterval(i)
  }, [])

  // Open the SSE connection once per mount.
  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true

    const abort = new AbortController()
    ;(async () => {
      // Local counter — closure-stable, unlike `papersScanned` state.
      let scanned = 0
      try {
        const res = await fetch('/api/preview-digest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(config),
          signal: abort.signal,
        })
        if (!res.ok || !res.body) {
          const text = await res.text().catch(() => '')
          onError(`HTTP ${res.status}${text ? `: ${text.slice(0, 200)}` : ''}`)
          return
        }
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffered = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffered += decoder.decode(value, { stream: true })
          const frames = buffered.split('\n\n')
          buffered = frames.pop() ?? ''
          for (const frame of frames) {
            const line = frame.trim()
            if (!line.startsWith('data:')) continue
            let evt: ProgressEvent
            try {
              evt = JSON.parse(line.slice(5).trim())
            } catch {
              continue
            }
            switch (evt.kind) {
              case 'seed-fetch-done':
                scanned = evt.papersScanned
                setPapersScanned(scanned)
                break
              case 'area-hit':
                scanned += evt.hits
                setAreasDone((n) => n + 1)
                setPapersScanned(scanned)
                break
              case 'done':
                onDone({
                  body: evt.body,
                  references: evt.references,
                  queries: evt.queries,
                  papersScanned: scanned,
                })
                return
              case 'error':
                onError(evt.message)
                return
            }
          }
        }
      } catch (err) {
        onError((err as Error).message ?? 'Network error')
      }
    })()

    return () => abort.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="rounded-2xl border border-line bg-bg-elev-1 p-6">
      <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-accent">
        First read in progress
      </div>
      <div className="mt-3 font-display text-[18px] italic text-ink">
        {STATUS_LINES[statusIdx]}
      </div>
      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-[12px] text-ink-faint">
        <span>{papersScanned.toLocaleString()} papers scanned</span>
        <span>
          {areasDone} / {config.research_areas.length} research areas checked
        </span>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
npm run typecheck
git add src/components/plan/PreviewRunningState.tsx
git commit -m "feat(plan): PreviewRunningState SSE consumer + progress UI"
```

---

## Task 24: Preview ready state (editorial + references + marketing)

**Files:**
- Create: `src/components/plan/PreviewReadyState.tsx`

Renders the editorial markdown, the numbered references list using `PaperRow`, and the two-column "what happened / what your real digest does differently" marketing block.

- [ ] **Step 1: Write `PreviewReadyState.tsx`**

```tsx
// src/components/plan/PreviewReadyState.tsx
'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { DigestConfig } from '@/lib/config-schema'
import type { ReferencePaper } from '@/lib/ai/preview/progress-events'
import { PaperRow } from '@/components/common/PaperRow'

export interface PreviewReadyStateProps {
  config: DigestConfig
  body: string
  references: ReferencePaper[]
  papersScanned: number
  stale: boolean
  onRegenerate: () => void
}

export function PreviewReadyState({
  config,
  body,
  references,
  papersScanned,
  stale,
  onRegenerate,
}: PreviewReadyStateProps) {
  const chipLabelFor = (ref: ReferencePaper, idx: number): string => {
    // Best-effort: map the reference to a research area by index-into-references.
    // References come back in citation order from the curator; we don't track
    // per-paper research_area_id reliably. Use a generic label.
    void ref
    void idx
    return 'THIS WEEK'
  }

  return (
    <div className={`rounded-2xl border border-line bg-bg-elev-1 p-6 ${stale ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-6">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-accent">
            Your digest · First read
          </div>
          <p className="mt-1 max-w-prose font-display text-[14px] italic text-ink-soft">
            Rendered in the format you asked for. Five papers this time — your real digest pulls from many more.
          </p>
        </div>
        <button
          onClick={onRegenerate}
          className={`shrink-0 rounded-lg border px-3 py-1.5 text-[12px] uppercase tracking-[0.16em] ${stale ? 'border-accent text-accent' : 'border-line text-ink-faint hover:border-line-strong hover:text-ink'}`}
        >
          {stale ? 'Preview again' : 'Regenerate'}
        </button>
      </div>

      {stale && (
        <div className="mt-4 rounded-lg border border-dashed border-accent bg-accent-soft/30 px-4 py-2 text-[13px] text-ink-soft">
          Your plan changed. This preview is from the previous version.
        </div>
      )}

      <article className="prose prose-neutral dark:prose-invert mt-6 max-w-prose font-display text-ink">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
      </article>

      <div className="mt-10">
        <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-accent">
          References
        </div>
        <div className="mt-4 flex flex-col gap-3">
          {references.map((ref, i) => (
            <PaperRow key={ref.id} index={i + 1} paper={ref} chipLabel={chipLabelFor(ref, i)} />
          ))}
        </div>
      </div>

      <div className="mt-10 grid gap-8 md:grid-cols-2">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-accent">
            This preview
          </div>
          <p className="mt-2 font-display text-[14px] leading-[1.6] text-ink">
            {papersScanned.toLocaleString()} papers scanned · {config.research_areas.length} research areas covered · {references.length} chosen for this sample
          </p>
          <p className="mt-2 font-display text-[13px] italic text-ink-soft">
            Your curator worked across abstracts, venues, and publication dates from the last 7 days.
          </p>
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-accent">
            What your real digest does differently
          </div>
          <ul className="mt-2 space-y-3 text-[14px] leading-[1.6] text-ink">
            <li>
              <strong className="font-display">Picks more papers.</strong> Your sections fill in properly — not just one or two papers per section, but the real field's output for the cycle.
            </li>
            <li>
              <strong className="font-display">Reads more carefully.</strong> Goes beyond abstracts, looks at who's citing whom, and notices threads that don't show up in a single pass.
            </li>
            <li>
              <strong className="font-display">Matches your voice better.</strong> The more digests you read, the more your curator writes the way you actually read.
            </li>
            <li>
              <strong className="font-display">Arrives on your cadence.</strong> In your inbox, when you asked for it.
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
npm run typecheck
git add src/components/plan/PreviewReadyState.tsx
git commit -m "feat(plan): PreviewReadyState with editorial + references + marketing"
```

---

## Task 25: Wire PreviewSection to coordinate states

**Files:**
- Modify: `src/components/plan/PreviewSection.tsx`

Replace the placeholder from Task 22 with the real state machine: `idle → running → ready → stale`. Owns the in-flight SSE response, holds the last rendered preview, manages regenerate.

- [ ] **Step 1: Replace `PreviewSection.tsx`**

```tsx
// src/components/plan/PreviewSection.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import type { DigestConfig, Schedule, SearchQuery } from '@/lib/config-schema'
import type { ReferencePaper } from '@/lib/ai/preview/progress-events'
import { PreviewRunningState } from './PreviewRunningState'
import { PreviewReadyState } from './PreviewReadyState'
import { CadenceSection } from './CadenceSection'
import { SubscribeSection } from './SubscribeSection'

interface ReadyPayload {
  body: string
  references: ReferencePaper[]
  queries: SearchQuery[]
  papersScanned: number
  generatedAt: string
}

export interface PreviewSectionProps {
  config: DigestConfig
  stale: boolean                               // parent toggles this when any field edits
  onPreviewSettled: () => void                 // parent clears stale flag when preview arrives
  onScheduleSet: (s: Schedule) => void
  onSubscribe: () => void
}

export function PreviewSection({
  config,
  stale,
  onPreviewSettled,
  onScheduleSet,
  onSubscribe,
}: PreviewSectionProps) {
  const [running, setRunning] = useState(false)
  const [ready, setReady] = useState<ReadyPayload | null>(null)
  const [error, setError] = useState<string | null>(null)

  // If parent marks stale, surface the previous preview as stale.
  const effectiveStale = stale && !!ready

  const handleDone = (p: {
    body: string
    references: ReferencePaper[]
    queries: SearchQuery[]
    papersScanned: number
  }) => {
    setRunning(false)
    setReady({
      body: p.body,
      references: p.references,
      queries: p.queries,
      papersScanned: p.papersScanned,
      generatedAt: new Date().toISOString(),
    })
    onPreviewSettled()
  }

  const handleError = (message: string) => {
    setRunning(false)
    setError(message)
  }

  const kickoff = () => {
    setError(null)
    setRunning(true)
  }

  // Only show cadence + subscribe once preview is ready AND not stale.
  const showCadence = !!ready && !effectiveStale && !running && !error

  return (
    <div className="flex flex-col gap-6">
      {!ready && !running && !error && (
        <button
          onClick={kickoff}
          className="rounded-2xl border border-accent bg-accent px-8 py-4 text-center font-display text-[18px] text-bg hover:bg-accent/90"
        >
          Preview your digest
        </button>
      )}

      {running && (
        <PreviewRunningState
          config={config}
          onDone={handleDone}
          onError={handleError}
        />
      )}

      {error && !running && (
        <div className="rounded-2xl border border-line bg-bg-elev-1 p-6">
          <div className="text-[12px] uppercase tracking-[0.16em] text-accent">Couldn't finish</div>
          <p className="mt-2 max-w-prose text-[14px] text-ink-soft">{error}</p>
          <button
            onClick={kickoff}
            className="mt-4 rounded-lg border border-accent px-3 py-1.5 text-[12px] uppercase tracking-[0.16em] text-accent hover:bg-accent-soft"
          >
            Try again
          </button>
        </div>
      )}

      {ready && !running && (
        <PreviewReadyState
          config={config}
          body={ready.body}
          references={ready.references}
          papersScanned={ready.papersScanned}
          stale={effectiveStale}
          onRegenerate={kickoff}
        />
      )}

      {showCadence && (
        <CadenceSection
          timezoneDefault={Intl.DateTimeFormat().resolvedOptions().timeZone}
          schedule={config.schedule}
          onScheduleSet={onScheduleSet}
        />
      )}

      {showCadence && config.schedule && (
        <SubscribeSection config={config} onSubscribe={onSubscribe} />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run:
```bash
npm run typecheck
```
Expected: errors about missing `CadenceSection` / `SubscribeSection` — those components exist in Tasks 26 + 27. Keep moving.

- [ ] **Step 3: Commit**

```bash
git add src/components/plan/PreviewSection.tsx
git commit -m "feat(plan): PreviewSection state machine (idle/running/ready/stale)"
```

---

## Task 26: Cadence section

**Files:**
- Create: `src/components/plan/CadenceSection.tsx`

UI wrapper around `buildSchedule`. Four cadence choices, conditional day-of-week, time, timezone.

- [ ] **Step 1: Write `CadenceSection.tsx`**

```tsx
// src/components/plan/CadenceSection.tsx
'use client'

import { useState } from 'react'
import type { Schedule } from '@/lib/config-schema'
import { buildSchedule, type Cadence } from '@/lib/schedule/build-cron'

const CADENCE_OPTIONS: Array<{ value: Cadence; label: string }> = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekdays', label: 'Weekdays' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
]
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export interface CadenceSectionProps {
  timezoneDefault: string
  schedule?: Schedule
  onScheduleSet: (s: Schedule) => void
}

export function CadenceSection({ timezoneDefault, schedule, onScheduleSet }: CadenceSectionProps) {
  const [cadence, setCadence] = useState<Cadence | null>(null)
  const [dayOfWeek, setDayOfWeek] = useState<0 | 1 | 2 | 3 | 4 | 5 | 6>(1)
  const [time, setTime] = useState('08:00')
  const [tz, setTz] = useState(schedule?.timezone ?? timezoneDefault)

  const canSubmit = !!cadence && /^\d{1,2}:\d{2}$/.test(time) && tz.length > 0

  const save = () => {
    if (!cadence) return
    try {
      const s = buildSchedule({ cadence, dayOfWeek, time, timezone: tz })
      onScheduleSet(s)
    } catch {
      // time parse errors bubble up; keep the form open
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-bg-elev-1 p-6">
      <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-accent">Delivery</div>

      <div className="mt-4">
        <div className="text-[12px] uppercase tracking-[0.16em] text-ink-faint">Cadence</div>
        <div role="radiogroup" className="mt-2 flex flex-wrap gap-2">
          {CADENCE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              role="radio"
              aria-checked={cadence === opt.value}
              onClick={() => setCadence(opt.value)}
              className={`rounded-full border px-4 py-1.5 text-[13px] ${cadence === opt.value ? 'border-accent bg-accent-soft text-ink' : 'border-line text-ink-faint hover:text-ink hover:border-line-strong'}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {cadence === 'weekly' && (
        <div className="mt-4">
          <div className="text-[12px] uppercase tracking-[0.16em] text-ink-faint">Day of week</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {DAYS.map((d, i) => (
              <button
                key={d}
                onClick={() => setDayOfWeek(i as 0 | 1 | 2 | 3 | 4 | 5 | 6)}
                className={`rounded-full border px-3 py-1 text-[13px] ${dayOfWeek === i ? 'border-accent bg-accent-soft text-ink' : 'border-line text-ink-faint hover:text-ink hover:border-line-strong'}`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-end gap-6">
        <label className="flex flex-col">
          <span className="text-[12px] uppercase tracking-[0.16em] text-ink-faint">Time</span>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="mt-1 rounded-lg border border-line bg-bg-elev-1 px-3 py-1.5 text-[14px] text-ink"
          />
        </label>
        <label className="flex flex-col">
          <span className="text-[12px] uppercase tracking-[0.16em] text-ink-faint">Timezone</span>
          <input
            type="text"
            value={tz}
            onChange={(e) => setTz(e.target.value)}
            className="mt-1 rounded-lg border border-line bg-bg-elev-1 px-3 py-1.5 text-[14px] text-ink min-w-[220px]"
          />
        </label>
        <button
          disabled={!canSubmit}
          onClick={save}
          className="rounded-lg border border-accent bg-accent px-4 py-2 text-[13px] uppercase tracking-[0.16em] text-bg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Set schedule
        </button>
      </div>

      {schedule && (
        <p className="mt-4 font-display text-[14px] italic text-ink">{schedule.description}</p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
npm run typecheck
git add src/components/plan/CadenceSection.tsx
git commit -m "feat(plan): CadenceSection — four options + time + timezone"
```

---

## Task 27: Subscribe section

**Files:**
- Create: `src/components/plan/SubscribeSection.tsx`

Validates the full `SubscribableConfig`, shows a toast on success, shows field errors on failure.

- [ ] **Step 1: Write `SubscribeSection.tsx`**

```tsx
// src/components/plan/SubscribeSection.tsx
'use client'

import { useState } from 'react'
import { subscribableConfigSchema, type DigestConfig } from '@/lib/config-schema'

export interface SubscribeSectionProps {
  config: DigestConfig
  onSubscribe: () => void
}

export function SubscribeSection({ config, onSubscribe }: SubscribeSectionProps) {
  const [errors, setErrors] = useState<Array<{ path: string; message: string }> | null>(null)
  const [saved, setSaved] = useState(false)

  const click = () => {
    const now = new Date().toISOString()
    const candidate = {
      ...config,
      created_at: config.created_at || now,
      updated_at: now,
    }
    const parsed = subscribableConfigSchema.safeParse(candidate)
    if (!parsed.success) {
      setErrors(
        parsed.error.issues.map((i) => ({
          path: i.path.join('.') || '(root)',
          message: i.message,
        })),
      )
      return
    }
    setErrors(null)
    setSaved(true)
    onSubscribe()
    // Placeholder: no persistence, no auth. Toast for 4s.
    setTimeout(() => setSaved(false), 4000)
  }

  return (
    <div className="rounded-2xl border border-line bg-bg-elev-1 p-6">
      <button
        onClick={click}
        className="w-full rounded-xl border border-accent bg-accent px-6 py-3 font-display text-[18px] text-bg hover:bg-accent/90"
      >
        Subscribe to get this on your cadence
      </button>

      {errors && (
        <ul className="mt-4 space-y-1 text-[13px] text-accent">
          {errors.map((e, i) => (
            <li key={i}>
              <strong>{e.path}:</strong> {e.message}
            </li>
          ))}
        </ul>
      )}

      {saved && (
        <p className="mt-4 text-[14px] text-ink-soft">
          Subscription coming soon — your plan is saved for this session.
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run:
```bash
npm run typecheck
```
Expected: clean.

- [ ] **Step 3: Lint**

Run:
```bash
npm run lint
```
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/plan/SubscribeSection.tsx
git commit -m "feat(plan): Subscribe section with validated placeholder toast"
```

---

## Task 28: Update CLAUDE.md architecture notes

**Files:**
- Modify: `CLAUDE.md`

Replace the "Onboarding chat flow" paragraph to reflect the new flow. Remove references to showcase + cadence in chat.

- [ ] **Step 1: Read current content**

Run:
```bash
grep -n "showcase\|corpusSanity\|normalizeSchedule\|generateConfig\|core_angles\|showcaseRecentPapers" CLAUDE.md
```

- [ ] **Step 2: Edit the file**

Replace the **Onboarding chat flow** section (around the paragraph that mentions `normalizeSchedule`, `proposeAngles`, `corpusSanityCheck`, `generateConfig`, and the `ChatShell` watcher for `tool-generateConfig`) with:

```markdown
**Onboarding flow** (`src/app/api/onboarding-chat/route.ts` + `src/components/chat/ChatShell.tsx` + `src/components/plan/ResearchPlanView.tsx`):

1. Chat collects four fields (subject, profile, output_style, research_areas) via `proposeResearchAreas` + `handoffToPlan`. No cadence, no showcase.
2. `handoffToPlan` validates against `digestConfigSchema.omit({ schedule, version, created_at, updated_at, search_queries })`. On success, the UI transitions to `ResearchPlanView`.
3. Research Plan view is fully editable. Clicking "Preview your digest" opens an SSE connection to `/api/preview-digest`, which runs the v9.2 pipeline (seed→vocab→compact library→per-week retrieval→editorial curator).
4. After the preview lands, a cadence picker (`CadenceSection`) computes a `Schedule` client-side via `src/lib/schedule/build-cron.ts` — no LLM call.
5. `SubscribeSection` validates the whole config against `subscribableConfigSchema` and shows a placeholder toast (no persistence yet).
```

Also update the **Config is the contract** section's bullet list — replace `core_angles` with `research_areas` and remove the `volume_target` mention if present.

- [ ] **Step 3: Verify no stale references remain**

Run:
```bash
grep -n "showcase\|corpusSanity\|normalizeSchedule\|generateConfig\|core_angles" CLAUDE.md
```
Expected: no matches (or only matches inside historical sections that are deliberately preserved).

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md for Research Plan + preview flow"
```

---

## Task 29: Manual browser verification

**Files:** none modified — verification only.

- [ ] **Step 1: Start dev server**

Run:
```bash
npm run dev
```
Expected: server starts on `http://localhost:3000`. Leave it running.

- [ ] **Step 2: Verify typecheck + lint are clean**

In a second terminal:
```bash
npm run typecheck && npm run lint
```
Expected: both exit 0.

- [ ] **Step 3: Walk the flow with a real subject**

Open `http://localhost:3000` in a browser. Enter a seed sentence like *"Track new research on atrial fibrillation treatment, for a clinical cardiologist."* Submit.

Expected behavior:
1. Chat opens with the assistant responding.
2. After 1–2 exchanges, the assistant calls `proposeResearchAreas` — the AngleProposalCard equivalent renders (now `ResearchAreaProposalCard`).
3. After research areas settle and a style conversation, assistant calls `handoffToPlan`.
4. UI transitions to `ResearchPlanView`.
5. Research Plan shows subject, profile, research areas, output_style — all editable.
6. Click **Preview your digest**. Running state appears, status line cycles, papers-scanned counter climbs, area counter advances.
7. Within 20–60s, the ready state renders: editorial body in markdown (formatted per output_style), 5 reference rows, two-column marketing block.
8. Cadence section appears. Pick **Weekly**, day Monday, time 08:00, default timezone.
9. Click **Set schedule** — description line appears.
10. Click **Subscribe** — toast appears.

- [ ] **Step 4: Verify edit-invalidates-preview**

After the preview is ready, edit any field (click the subject headline, change it, commit). Expected:
- Preview fades (`opacity-60`).
- Banner appears: *"Your plan changed. This preview is from the previous version."*
- Cadence + Subscribe sections disappear.
- **Preview again** button is prominent.

Click **Preview again** — a fresh running state appears, then a fresh ready state lands.

- [ ] **Step 5: Verify error fallback**

Temporarily introduce a failure: stop the dev server, then restart with an invalid `OPENROUTER_API_KEY` (edit `.env.local` to corrupt it). Restart `npm run dev`. Click **Preview your digest** again. Expected:
- Running state appears, then the error card: *"Couldn't finish — <message>"* with a **Try again** button.

Restore `.env.local` to the original value and re-test once to confirm normal flow resumes.

- [ ] **Step 6: Verify output_style takes shape**

Start a fresh session. When the assistant asks about output style, answer with something structural like *"Three sections: What changed, Clinical implications, Open questions. Short paragraphs, no hedging."*. Complete the flow. Expected: the rendered editorial has three `##` section headers matching what the user asked for.

- [ ] **Step 7: Stop the server**

`Ctrl+C` in the dev-server terminal.

- [ ] **Step 8: Final commit (nothing to commit if all walked clean)**

No commit required unless you had to adjust prompts / copy during testing. If you did, amend the relevant task's commit or create a small `chore:` commit.

---

## Self-review checklist

- [ ] **Spec §5 flow implemented** — Tasks 14 (prompt), 20 (ChatShell transition), 22 (plan scaffold), 25 (PreviewSection), 26 (CadenceSection), 27 (SubscribeSection).
- [ ] **Spec §6 schema implemented** — Task 2.
- [ ] **Spec §7 chat contract implemented** — Tasks 3, 4, 14.
- [ ] **Spec §8 Research Plan view implemented** — Task 22.
- [ ] **Spec §9 preview state transitions implemented** — Task 25.
- [ ] **Spec §10 pipeline + SSE implemented** — Tasks 7, 8, 9, 10, 11, 12, 13.
- [ ] **Spec §11 preview rendering implemented** — Tasks 15 (PaperRow), 24 (PreviewReadyState).
- [ ] **Spec §12 curator implemented** — Task 11.
- [ ] **Spec §13 library builder implemented** — Task 9.
- [ ] **Spec §14 discovery modules implemented** — Tasks 7, 8, 9, 10.
- [ ] **Spec §15 OpenAlex client extension implemented** — Task 5.
- [ ] **Spec §16 cadence picker implemented** — Tasks 18, 26.
- [ ] **Spec §17 Subscribe implemented** — Task 27.
- [ ] **Spec §18 deletions executed** — Tasks 1, 21.
- [ ] **Spec §19 definition of done met** — Tasks 28 (CLAUDE.md), 29 (manual pass).
- [ ] **No placeholders** — every code step shows complete code.
- [ ] **Type consistency** — `DigestConfig`, `ResearchArea`, `SearchQuery`, `Schedule`, `ProgressEvent`, `ReferencePaper`, `Cadence` used consistently across tasks.
- [ ] **Every task ends with `git commit`.**

---

Plan complete and saved to `docs/superpowers/plans/2026-04-20-v92-onboarding-preview.md`.

Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — Execute tasks in this session using `superpowers:executing-plans`, batch execution with checkpoints.

Which approach?
