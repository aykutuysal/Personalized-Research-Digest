# Onboarding stages redesign — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the onboarding tail as three distinct stages — Plan → Preview → Start — matching the locked design in `docs/superpowers/specs/2026-04-21-onboarding-stages-redesign-design.md`.

**Architecture:** `ChatShell` keeps its current role (chat + handoff) and then renders a new orchestrator (`OnboardingStages`) that holds the shared `DigestConfig` state and routes between three stage components (`PlanStage`, `PreviewStage`, `StartStage`). `PreviewStage` internally flips between loading and issue views. Navigation is linear forward via CTAs, backward via a small `StageBreadcrumb`. Schedule picking collapses into the `StartStage`; there is no separate `Schedule` step. Payment is a placeholder today: `StartStage`'s commit handler accepts the shape we'll send to Stripe later but currently just transitions to a simple "You're in" success state.

**Tech Stack:** Next.js 16 (App Router) · React 19 · Tailwind v4 · Zod · Vitest · AI SDK v6 · existing SSE preview pipeline.

---

## File structure

### Files to create

- `src/components/stages/OnboardingStages.tsx` — orchestrator, holds `stage` and `config` state, routes between the three stages.
- `src/components/stages/StageBreadcrumb.tsx` — shared top bar with `Plan › Preview › Start` and "Saved" indicator.
- `src/components/stages/PlanStage.tsx` — the Plan screen (eyebrow + subject + four sections + sticky footer CTA).
- `src/components/stages/RichMarkdownList.tsx` — contenteditable numbered-list editor for Format & Structure.
- `src/components/stages/PreviewStage.tsx` — loading + issue composite, owns SSE kickoff state.
- `src/components/stages/PreviewLoadingView.tsx` — "Going to press" masthead + stats + stepper.
- `src/components/stages/PreviewIssueView.tsx` — sidebar + editorial issue + end-of-article CTA + responsive shell.
- `src/components/stages/PreviewSidebar.tsx` — the sticky sidebar (desktop) that becomes the bottom sheet (mobile).
- `src/components/stages/CitationChip.tsx` — inline `[n]` chip that scrolls to source.
- `src/components/stages/SourceCard.tsx` — per-reference card in "Sources in this sample".
- `src/components/stages/StartStage.tsx` — final commit screen (When + Plan + Where + summary + sticky CTA).
- `src/components/stages/StartedView.tsx` — "You're in" success state rendered inline on StartStage.
- `src/components/stages/StickyFooterCta.tsx` — shared sticky bottom CTA bar (single button, uppercase, safe-area-aware).
- `src/lib/ui/markdown.ts` — tiny markdown renderer for numbered lists (parse + serialize) used by `RichMarkdownList`.
- `src/lib/ui/sentence-case.ts` — helper to sentence-case a research area string for display.
- `src/lib/ui/schedule-summary.ts` — builds the human-readable summary line (date + price + email) from `Cadence + time + tz + plan + email`.
- `src/lib/ai/preview/map-progress-to-stage.ts` — pure function mapping `ProgressEvent[]` to `{ stagesDone, running }` for the loading UI.
- `test/config-schema.test.ts` — covers schema change (see Task 1).
- `test/markdown.test.ts` — covers `parseMarkdownList` / `serializeMarkdownList`.
- `test/sentence-case.test.ts` — covers `sentenceCase`.
- `test/schedule-summary.test.ts` — covers the human summary builder.
- `test/map-progress-to-stage.test.ts` — covers the SSE-to-stage mapping.

### Files to modify

- `src/lib/config-schema.ts` — split `output_style` into `format_structure` + `voice_language`. Add `plan`, `email`. Keep `subscribableConfigSchema` helper but update downstream callers.
- `src/lib/ai/preview/progress-events.ts` — already has `filter-done`, `curating`. No shape change needed but re-confirm usage in Task 4.
- `src/components/chat/ChatShell.tsx` — swap the post-chat render from `ResearchPlanView` to `<OnboardingStages>`. Remove the old `onReset` → delete onboarding flow tied to the deprecated view.
- `src/components/plan/ResearchPlanView.tsx` — **delete.**
- `src/components/plan/PreviewSection.tsx` — **delete** (replaced by `PreviewStage`).
- `src/components/plan/PreviewRunningState.tsx` — **delete** (replaced by `PreviewLoadingView`).
- `src/components/plan/PreviewReadyState.tsx` — **delete** (replaced by `PreviewIssueView`).
- `src/components/plan/CadenceSection.tsx` — **delete** (absorbed into `StartStage`).
- `src/components/plan/SubscribeSection.tsx` — **delete** (absorbed into `StartStage`).
- `src/components/plan/MastheadEditor.tsx`, `ProfileEditor.tsx`, `ResearchAreaChips.tsx` — may be re-used by `PlanStage` if the API fits, otherwise inline into the new stage. Default: re-use `ResearchAreaChips` after the sentence-case display change; rebuild the others.
- `src/lib/ai/onboarding-tools.ts`, `prompts/preview-curator-system.md`, `prompts/preview-filter-system.md`, `prompts/preview-library-system.md`, `prompts/preview-seed-system.md`, `prompts/onboarding-system.md` — any reference to `output_style` must read `format_structure` + `voice_language` (combined at prompt-render time).
- `src/app/globals.css` — add a scrollbar utility class and a `--sticky-footer-shadow` token.
- `src/lib/storage/local.ts` — bump storage version (so stale `output_style`-shaped configs don't crash the new code); on load, migrate `output_style` forward into the new fields by duplicating the string into `format_structure` and leaving `voice_language` empty (user can fill it).

### Route structure

No new routes. All three stages render inside the existing `/onboarding` page below the chat. The `ChatShell` already transitions from chat → post-chat view based on whether `handoffToPlan` fired. We keep that same transition; we just render a different post-chat component.

---

## Task 1 — Schema split: `output_style` → `format_structure` + `voice_language`

**Files:**
- Modify: `src/lib/config-schema.ts`
- Create: `test/config-schema.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/config-schema.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { digestConfigSchema, subscribableConfigSchema } from '@/lib/config-schema'

const baseValid = {
  subject: 'AI agents',
  profile: 'Engineer interested in agent harnesses.',
  format_structure: '1. Picture. Paragraph.\n2. Shifts. Paragraph.',
  voice_language: 'Builder-to-builder, direct.',
  research_areas: [{ id: 1, text: 'tool-augmented language models' }],
  search_queries: [],
  plan: 'yearly' as const,
  email: 'alice@example.com',
  version: 1,
  created_at: '2026-04-21T00:00:00.000Z',
  updated_at: '2026-04-21T00:00:00.000Z',
}

describe('digestConfigSchema', () => {
  it('accepts the new split fields', () => {
    const r = digestConfigSchema.safeParse(baseValid)
    expect(r.success).toBe(true)
  })

  it('rejects when format_structure is missing', () => {
    const { format_structure: _, ...rest } = baseValid
    const r = digestConfigSchema.safeParse(rest)
    expect(r.success).toBe(false)
  })

  it('rejects when voice_language is missing', () => {
    const { voice_language: _, ...rest } = baseValid
    const r = digestConfigSchema.safeParse(rest)
    expect(r.success).toBe(false)
  })

  it('rejects when plan is not monthly or yearly', () => {
    const r = digestConfigSchema.safeParse({ ...baseValid, plan: 'weekly' })
    expect(r.success).toBe(false)
  })

  it('subscribableConfigSchema requires schedule', () => {
    const r = subscribableConfigSchema.safeParse(baseValid) // no schedule
    expect(r.success).toBe(false)
  })
})
```

- [ ] **Step 2: Run the test, confirm it fails**

Run: `npx vitest run test/config-schema.test.ts`
Expected: FAIL — the schema still has `output_style`, not the new fields.

- [ ] **Step 3: Update the schema**

Replace `src/lib/config-schema.ts` with:

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

export const planSchema = z.enum(['monthly', 'yearly'])

export const digestConfigSchema = z.object({
  subject: z.string().min(1),
  profile: z.string().min(1),
  // Split from the old `output_style`. Rendered separately in the UI.
  format_structure: z.string().min(1),
  voice_language: z.string().min(1),
  research_areas: z.array(researchAreaSchema).min(1),
  search_queries: z.array(searchQuerySchema).default([]),
  plan: planSchema.default('yearly'),
  email: z.string().email().optional(),
  schedule: scheduleSchema.optional(),
  version: z.number().int().min(1).default(1),
  created_at: z.string().min(1),
  updated_at: z.string().min(1),
})

export const subscribableConfigSchema = digestConfigSchema.required({
  schedule: true,
  email: true,
})

export type ResearchArea = z.infer<typeof researchAreaSchema>
export type SearchQuery = z.infer<typeof searchQuerySchema>
export type Schedule = z.infer<typeof scheduleSchema>
export type Plan = z.infer<typeof planSchema>
export type DigestConfig = z.infer<typeof digestConfigSchema>
export type SubscribableConfig = z.infer<typeof subscribableConfigSchema>
```

- [ ] **Step 4: Run the test, confirm it passes**

Run: `npx vitest run test/config-schema.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/config-schema.ts test/config-schema.test.ts
git commit -m "feat(schema): split output_style into format_structure + voice_language, add plan/email"
```

---

## Task 2 — Fix prompts and pipeline call sites that read `output_style`

**Files:**
- Modify: `src/lib/ai/preview/curator.ts`, `src/lib/ai/preview/filter.ts`, `src/lib/ai/preview/pipeline.ts`, `src/lib/ai/onboarding-tools.ts`, `prompts/preview-curator-system.md`, `prompts/preview-filter-system.md`, `prompts/preview-library-system.md`, `prompts/onboarding-system.md`

- [ ] **Step 1: Find every callsite**

Run: `npx rg -n "output_style" src prompts`

List every match. Expected hits include `curator.ts`, `filter.ts`, any pipeline stage that includes the field in a prompt render, plus the onboarding handoff tool schema.

- [ ] **Step 2: In code, replace reads of `config.output_style` with a combined string**

Wherever a prompt needs the old `output_style` paragraph, construct it at render time by joining the two fields with a blank line:

```ts
const outputStyle =
  `${config.format_structure}\n\n${config.voice_language}`.trim()
```

Use `outputStyle` to fill prompt placeholders. Do this at every call site from the rg output. Do not store the combined string on the config.

- [ ] **Step 3: In `src/lib/ai/onboarding-tools.ts`, update `handoffToPlan`'s validation**

The handoff tool validates its `input` against `digestConfigSchema.omit({ schedule, version, created_at, updated_at, search_queries })`. That still works after the schema change because the omit list didn't include `output_style`. But the tool parameters schema itself probably still names `output_style`. Change the tool's Zod parameters schema to require `format_structure` and `voice_language` (both `.min(1)`), rather than `output_style`. Then update the system prompt for the onboarding tool.

- [ ] **Step 4: Update `prompts/onboarding-system.md`**

Anywhere it asks the model to fill `output_style`, split into two sibling instructions:

1. `format_structure`: a markdown numbered list describing the sections of each issue. Each item is "Section name. Description." The curator treats each numbered item as one section.
2. `voice_language`: free prose describing voice, tone, depth, and language preferences for how each issue reads.

Keep the example in the prompt consistent with the split.

- [ ] **Step 5: Run typecheck**

Run: `npm run typecheck`
Expected: PASS, no references to `output_style` left.

- [ ] **Step 6: Run lint**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor(prompts): read format_structure + voice_language in place of output_style"
```

---

## Task 3 — Local storage migration for existing onboarding state

**Files:**
- Modify: `src/lib/storage/local.ts`

- [ ] **Step 1: Read the file to locate the version constant**

Run: `npx rg -n "version" src/lib/storage/local.ts`

Identify the stored shape's version number and the `loadOnboardingState` function.

- [ ] **Step 2: Bump the version and add a migrator**

Add a `migrateFromV1` function that, if the stored config has `output_style` but no `format_structure`/`voice_language`, copies `output_style` into `format_structure` and sets `voice_language` to an empty string (user will fill it on the Plan stage). Bump `STORAGE_VERSION` by 1. `loadOnboardingState` detects older-version payloads and runs the migrator, or clears the state if it's unrecoverable.

```ts
const STORAGE_VERSION = 2  // was 1

function migrateFromV1(raw: any): any {
  if (!raw || typeof raw !== 'object') return raw
  const cfg = raw.config
  if (cfg && typeof cfg.output_style === 'string' && !cfg.format_structure) {
    cfg.format_structure = cfg.output_style
    cfg.voice_language = ''
    delete cfg.output_style
  }
  raw.version = STORAGE_VERSION
  return raw
}

// In loadOnboardingState:
//   if (stored.version === 1) { migrated = migrateFromV1(stored); save; return migrated }
//   if (stored.version !== STORAGE_VERSION) { clear and return null }
```

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/storage/local.ts
git commit -m "feat(storage): migrate v1 onboarding state to split voice/format fields"
```

---

## Task 4 — Pure progress-to-stage mapper

**Files:**
- Create: `src/lib/ai/preview/map-progress-to-stage.ts`
- Create: `test/map-progress-to-stage.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// test/map-progress-to-stage.test.ts
import { describe, it, expect } from 'vitest'
import { mapProgressToStage, STAGE_LABELS } from '@/lib/ai/preview/map-progress-to-stage'
import type { ProgressEvent } from '@/lib/ai/preview/progress-events'

describe('mapProgressToStage', () => {
  it('starts with stage 0 running, 0 done', () => {
    const s = mapProgressToStage([], 10)
    expect(s).toEqual({ running: 0, done: 0, papersScanned: 0, areasDone: 0 })
  })

  it('marks stage 0 done and stage 1 running after seeds', () => {
    const events: ProgressEvent[] = [{ kind: 'seeds', seeds: ['a', 'b'] }]
    const s = mapProgressToStage(events, 10)
    expect(s.done).toBe(1)
    expect(s.running).toBe(1)
  })

  it('counts papers scanned from seed-fetch-done and area-hit', () => {
    const events: ProgressEvent[] = [
      { kind: 'seeds', seeds: [] },
      { kind: 'seed-fetch-done', papersScanned: 40, perSeed: [] },
      { kind: 'area-hit', research_area_id: 1, hits: 12, sampleTitle: null },
      { kind: 'area-hit', research_area_id: 2, hits: 8, sampleTitle: null },
    ]
    const s = mapProgressToStage(events, 10)
    expect(s.papersScanned).toBe(60) // 40 + 12 + 8
    expect(s.areasDone).toBe(2)
  })

  it('advances to filtering after all areas are hit', () => {
    const events: ProgressEvent[] = [
      { kind: 'seeds', seeds: [] },
      { kind: 'area-hit', research_area_id: 1, hits: 5, sampleTitle: null },
      { kind: 'area-hit', research_area_id: 2, hits: 5, sampleTitle: null },
    ]
    const s = mapProgressToStage(events, 2) // 2 total areas
    expect(s.done).toBe(2) // stages: mapping, looking
    expect(s.running).toBe(2) // finding
  })

  it('advances to reading the shortlist after filter-done', () => {
    const events: ProgressEvent[] = [
      { kind: 'seeds', seeds: [] },
      { kind: 'filter-done', kept: 10, dropped: 20 },
    ]
    const s = mapProgressToStage(events, 10)
    expect(s.done).toBeGreaterThanOrEqual(3)
    expect(s.running).toBe(3)
  })

  it('advances to writing after curating', () => {
    const events: ProgressEvent[] = [
      { kind: 'seeds', seeds: [] },
      { kind: 'filter-done', kept: 10, dropped: 20 },
      { kind: 'curating' },
    ]
    const s = mapProgressToStage(events, 10)
    expect(s.running).toBe(4)
    expect(s.done).toBe(4)
  })

  it('marks everything done on done event', () => {
    const events: ProgressEvent[] = [
      { kind: 'seeds', seeds: [] },
      { kind: 'done', body: '', references: [], queries: [] },
    ]
    const s = mapProgressToStage(events, 10)
    expect(s.done).toBe(5)
  })

  it('exposes five stage labels in benefit-framed order', () => {
    expect(STAGE_LABELS).toEqual([
      'Mapping your interests',
      'Looking across the whole field',
      'Finding what fits you',
      'Reading the shortlist',
      'Writing it in your voice',
    ])
  })
})
```

- [ ] **Step 2: Run the test, confirm it fails**

Run: `npx vitest run test/map-progress-to-stage.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement the mapper**

```ts
// src/lib/ai/preview/map-progress-to-stage.ts
import type { ProgressEvent } from './progress-events'

export const STAGE_LABELS = [
  'Mapping your interests',
  'Looking across the whole field',
  'Finding what fits you',
  'Reading the shortlist',
  'Writing it in your voice',
] as const

export interface ProgressState {
  running: number // index of the stage currently running
  done: number    // count of stages completed
  papersScanned: number
  areasDone: number
}

export function mapProgressToStage(
  events: ProgressEvent[],
  totalAreas: number,
): ProgressState {
  let running = 0
  let done = 0
  let papersScanned = 0
  let areasDone = 0

  for (const e of events) {
    switch (e.kind) {
      case 'seeds':
        if (done < 1) { done = 1; running = 1 }
        break
      case 'seed-fetch-done':
        papersScanned += e.papersScanned
        break
      case 'area-hit':
        papersScanned += e.hits
        areasDone += 1
        if (totalAreas > 0 && areasDone >= totalAreas) {
          if (done < 2) { done = 2 }
          if (running < 2) { running = 2 }
        }
        break
      case 'filtering':
        if (running < 2) { running = 2 }
        break
      case 'filter-done':
        if (done < 3) { done = 3 }
        if (running < 3) { running = 3 }
        break
      case 'curating':
        if (done < 4) { done = 4 }
        if (running < 4) { running = 4 }
        break
      case 'done':
        done = 5
        running = 5
        break
      case 'error':
        // leave current state; caller handles surfacing the error
        break
    }
  }
  return { running, done, papersScanned, areasDone }
}
```

- [ ] **Step 4: Run the test, confirm it passes**

Run: `npx vitest run test/map-progress-to-stage.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/preview/map-progress-to-stage.ts test/map-progress-to-stage.test.ts
git commit -m "feat(preview): pure mapper from SSE progress events to 5-stage UI state"
```

---

## Task 5 — Sentence-case helper for research area display

**Files:**
- Create: `src/lib/ui/sentence-case.ts`
- Create: `test/sentence-case.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// test/sentence-case.test.ts
import { describe, it, expect } from 'vitest'
import { sentenceCase } from '@/lib/ui/sentence-case'

describe('sentenceCase', () => {
  it('capitalizes the first letter only', () => {
    expect(sentenceCase('tool-augmented language models')).toBe(
      'Tool-augmented language models',
    )
  })
  it('preserves acronyms already in caps', () => {
    expect(sentenceCase('retrieval-augmented generation (RAG) for agents')).toBe(
      'Retrieval-augmented generation (RAG) for agents',
    )
  })
  it('passes through single-word strings', () => {
    expect(sentenceCase('agents')).toBe('Agents')
  })
  it('handles empty string', () => {
    expect(sentenceCase('')).toBe('')
  })
  it('is a no-op when already sentence-cased', () => {
    expect(sentenceCase('Agent evaluation')).toBe('Agent evaluation')
  })
})
```

- [ ] **Step 2: Run the test, confirm it fails**

Run: `npx vitest run test/sentence-case.test.ts`

- [ ] **Step 3: Implement**

```ts
// src/lib/ui/sentence-case.ts
export function sentenceCase(s: string): string {
  if (!s) return ''
  return s.charAt(0).toUpperCase() + s.slice(1)
}
```

- [ ] **Step 4: Run the test, confirm it passes**

- [ ] **Step 5: Commit**

```bash
git add src/lib/ui/sentence-case.ts test/sentence-case.test.ts
git commit -m "feat(ui): sentence-case helper for research area labels"
```

---

## Task 6 — Markdown numbered-list parse/serialize

**Files:**
- Create: `src/lib/ui/markdown.ts`
- Create: `test/markdown.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// test/markdown.test.ts
import { describe, it, expect } from 'vitest'
import { parseMarkdownList, serializeMarkdownList } from '@/lib/ui/markdown'

describe('parseMarkdownList', () => {
  it('parses a numbered list into items', () => {
    const md =
      '1. First. Body of first.\n2. Second. Body of second.\n3. Third. Body of third.'
    expect(parseMarkdownList(md)).toEqual([
      { lead: 'First.', body: 'Body of first.' },
      { lead: 'Second.', body: 'Body of second.' },
      { lead: 'Third.', body: 'Body of third.' },
    ])
  })
  it('treats the lead as the text before the first period (not including it in body)', () => {
    const md = '1. Hello. World.'
    expect(parseMarkdownList(md)).toEqual([{ lead: 'Hello.', body: 'World.' }])
  })
  it('tolerates extra blank lines between items', () => {
    const md = '1. A. B.\n\n2. C. D.'
    expect(parseMarkdownList(md)).toEqual([
      { lead: 'A.', body: 'B.' },
      { lead: 'C.', body: 'D.' },
    ])
  })
  it('falls back to a single item when there is no number prefix', () => {
    expect(parseMarkdownList('Just a sentence.')).toEqual([
      { lead: '', body: 'Just a sentence.' },
    ])
  })
  it('serializes a round-trip equal to the input', () => {
    const items = [
      { lead: 'First.', body: 'Body of first.' },
      { lead: 'Second.', body: 'Body of second.' },
    ]
    const md = serializeMarkdownList(items)
    expect(md).toBe('1. First. Body of first.\n2. Second. Body of second.')
    expect(parseMarkdownList(md)).toEqual(items)
  })
})
```

- [ ] **Step 2: Run the test, confirm it fails**

- [ ] **Step 3: Implement**

```ts
// src/lib/ui/markdown.ts
export interface NumberedItem {
  lead: string  // first sentence (with trailing period)
  body: string  // remainder of the item
}

const LINE_RE = /^\s*\d+\.\s+(.*)$/

export function parseMarkdownList(src: string): NumberedItem[] {
  const lines = src
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

  const items: NumberedItem[] = []
  let current: string | null = null
  for (const line of lines) {
    const m = LINE_RE.exec(line)
    if (m) {
      if (current != null) items.push(splitLead(current))
      current = m[1]
    } else if (current != null) {
      current = current + ' ' + line
    } else {
      current = line
    }
  }
  if (current != null) items.push(splitLead(current))
  return items
}

function splitLead(raw: string): NumberedItem {
  const idx = raw.indexOf('. ')
  if (idx === -1) return { lead: '', body: raw.trim() }
  return {
    lead: raw.slice(0, idx + 1).trim(),
    body: raw.slice(idx + 2).trim(),
  }
}

export function serializeMarkdownList(items: NumberedItem[]): string {
  return items
    .map((it, i) => {
      const lead = it.lead ? it.lead + ' ' : ''
      return `${i + 1}. ${lead}${it.body}`.trim()
    })
    .join('\n')
}
```

- [ ] **Step 4: Run the test, confirm it passes**

- [ ] **Step 5: Commit**

```bash
git add src/lib/ui/markdown.ts test/markdown.test.ts
git commit -m "feat(ui): parse/serialize numbered markdown lists for Format & Structure editor"
```

---

## Task 7 — Schedule + price summary builder

**Files:**
- Create: `src/lib/ui/schedule-summary.ts`
- Create: `test/schedule-summary.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// test/schedule-summary.test.ts
import { describe, it, expect } from 'vitest'
import { buildScheduleSummary, nextDeliveryDate } from '@/lib/ui/schedule-summary'

describe('nextDeliveryDate', () => {
  it('returns next Tuesday at 09:00 when today is Monday', () => {
    // 2026-04-20 is a Monday
    const d = nextDeliveryDate({
      cadence: 'weekly',
      dayOfWeek: 2, // Tue
      time: '09:00',
      timezone: 'UTC',
      now: new Date('2026-04-20T12:00:00Z'),
    })
    expect(d.toISOString().slice(0, 10)).toBe('2026-04-21')
    expect(d.toISOString().slice(11, 16)).toBe('09:00')
  })

  it('returns tomorrow for daily', () => {
    const d = nextDeliveryDate({
      cadence: 'daily',
      time: '09:00',
      timezone: 'UTC',
      now: new Date('2026-04-20T12:00:00Z'),
    })
    expect(d.toISOString().slice(0, 10)).toBe('2026-04-21')
  })
})

describe('buildScheduleSummary', () => {
  it('composes the human-readable line for weekly + yearly', () => {
    const line = buildScheduleSummary({
      cadence: 'weekly',
      dayOfWeek: 2,
      time: '09:00',
      timezone: 'Europe/Istanbul',
      plan: 'yearly',
      email: 'a@b.com',
      now: new Date('2026-04-20T12:00:00Z'),
    })
    expect(line).toMatch(/first issue lands .* at 09:00/)
    expect(line).toMatch(/in a@b\.com/)
    expect(line).toMatch(/\$149 a year/)
  })

  it('uses $19 a month for monthly plan', () => {
    const line = buildScheduleSummary({
      cadence: 'daily',
      time: '08:00',
      timezone: 'UTC',
      plan: 'monthly',
      email: 'a@b.com',
      now: new Date('2026-04-20T12:00:00Z'),
    })
    expect(line).toMatch(/\$19 a month/)
  })
})
```

- [ ] **Step 2: Run the test, confirm it fails**

- [ ] **Step 3: Implement**

```ts
// src/lib/ui/schedule-summary.ts
import type { Plan } from '@/lib/config-schema'
import type { Cadence } from '@/lib/schedule/build-cron'

export interface NextDeliveryInput {
  cadence: Cadence
  dayOfWeek?: number // 0=Sun ... 6=Sat, required if cadence === 'weekly'
  dayOfMonth?: number // 1..31, required if cadence === 'monthly'
  time: string // 'HH:MM'
  timezone: string
  now?: Date
}

export function nextDeliveryDate(i: NextDeliveryInput): Date {
  const now = i.now ?? new Date()
  const [hh, mm] = i.time.split(':').map((n) => parseInt(n, 10))
  const candidate = new Date(now)
  candidate.setUTCHours(hh, mm, 0, 0)

  if (i.cadence === 'daily') {
    if (candidate <= now) candidate.setUTCDate(candidate.getUTCDate() + 1)
  } else if (i.cadence === 'weekdays') {
    if (candidate <= now) candidate.setUTCDate(candidate.getUTCDate() + 1)
    while ([0, 6].includes(candidate.getUTCDay())) {
      candidate.setUTCDate(candidate.getUTCDate() + 1)
    }
  } else if (i.cadence === 'weekly') {
    const target = i.dayOfWeek ?? 1
    let delta = (target - candidate.getUTCDay() + 7) % 7
    if (delta === 0 && candidate <= now) delta = 7
    candidate.setUTCDate(candidate.getUTCDate() + delta)
  } else if (i.cadence === 'monthly') {
    const day = i.dayOfMonth ?? 1
    candidate.setUTCDate(day)
    if (candidate <= now) candidate.setUTCMonth(candidate.getUTCMonth() + 1)
  }
  return candidate
}

export interface ScheduleSummaryInput extends NextDeliveryInput {
  plan: Plan
  email: string
}

const PRICE_COPY: Record<Plan, string> = {
  monthly: '$19 a month',
  yearly: '$149 a year',
}

export function buildScheduleSummary(i: ScheduleSummaryInput): string {
  const d = nextDeliveryDate(i)
  const fmt = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: i.timezone,
  })
  const when = fmt.format(d)
  const time = i.time // already HH:MM
  return `Your first issue lands ${when} at ${time}, in ${i.email}. Then every ${readableCadence(i)} for ${PRICE_COPY[i.plan]}, until you change it.`
}

function readableCadence(i: NextDeliveryInput): string {
  if (i.cadence === 'daily') return 'day'
  if (i.cadence === 'weekdays') return 'weekday'
  if (i.cadence === 'weekly') {
    const names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    return names[i.dayOfWeek ?? 1]
  }
  return `month on the ${i.dayOfMonth ?? 1}`
}
```

- [ ] **Step 4: Run the test, confirm it passes**

- [ ] **Step 5: Commit**

```bash
git add src/lib/ui/schedule-summary.ts test/schedule-summary.test.ts
git commit -m "feat(ui): deterministic human-readable schedule summary with price"
```

---

## Task 8 — Design tokens: scrollbars + sticky-footer safe area

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Add a themed scrollbar utility class**

Append to `src/app/globals.css`:

```css
.rd-scroll,
textarea.rd-scroll,
[contenteditable].rd-scroll {
  scrollbar-width: thin;
  scrollbar-color: var(--line-strong) transparent;
}
.rd-scroll::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}
.rd-scroll::-webkit-scrollbar-track { background: transparent; }
.rd-scroll::-webkit-scrollbar-thumb {
  background: var(--line-strong);
  border-radius: 8px;
  border: 2px solid var(--bg);
}
.rd-scroll::-webkit-scrollbar-thumb:hover {
  background: var(--ink-faint);
}
```

- [ ] **Step 2: Add a sticky-footer utility that respects the iOS safe area**

Append:

```css
.rd-sticky-footer {
  position: sticky;
  bottom: 0;
  background: var(--bg-elev-1);
  border-top: 1px solid var(--line);
  box-shadow: 0 -6px 16px -8px rgba(31, 42, 34, 0.1);
  padding: 14px 24px calc(14px + var(--safe-bottom)) 24px;
  z-index: 30;
}
@media (max-width: 600px) {
  .rd-sticky-footer { padding-left: 16px; padding-right: 16px; }
}
```

Do not remove existing rules. These utilities are additive and used by the new components.

- [ ] **Step 3: Run typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css
git commit -m "chore(ui): add themed scrollbar + sticky-footer utility classes"
```

---

## Task 9 — Shared components: StickyFooterCta, StageBreadcrumb, CitationChip, SourceCard

**Files:**
- Create: `src/components/stages/StickyFooterCta.tsx`
- Create: `src/components/stages/StageBreadcrumb.tsx`
- Create: `src/components/stages/CitationChip.tsx`
- Create: `src/components/stages/SourceCard.tsx`

- [ ] **Step 1: Implement `StickyFooterCta`**

```tsx
// src/components/stages/StickyFooterCta.tsx
'use client'
import type { ReactNode, MouseEventHandler } from 'react'

export interface StickyFooterCtaProps {
  label: string
  onClick: MouseEventHandler<HTMLButtonElement>
  helper?: ReactNode
  disabled?: boolean
}

export function StickyFooterCta({ label, onClick, helper, disabled }: StickyFooterCtaProps) {
  return (
    <div className="rd-sticky-footer">
      <div className="mx-auto flex max-w-[820px] flex-col items-center gap-2">
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          className="w-full max-w-[420px] rounded-[3px] bg-accent px-10 py-[18px] text-[14px] font-semibold uppercase tracking-[0.14em] text-accent-ink hover:bg-accent-hover disabled:opacity-50"
        >
          {label}
        </button>
        {helper && (
          <div className="font-display italic text-[13px] text-ink-faint">{helper}</div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Implement `StageBreadcrumb`**

```tsx
// src/components/stages/StageBreadcrumb.tsx
'use client'

export type StageId = 'plan' | 'preview' | 'start'

const STAGES: Array<{ id: StageId; label: string }> = [
  { id: 'plan', label: 'Plan' },
  { id: 'preview', label: 'Preview' },
  { id: 'start', label: 'Start' },
]

export interface StageBreadcrumbProps {
  current: StageId
  onNavigate: (s: StageId) => void
  savedIndicator?: boolean
}

const ORDER: Record<StageId, number> = { plan: 0, preview: 1, start: 2 }

export function StageBreadcrumb({ current, onNavigate, savedIndicator }: StageBreadcrumbProps) {
  return (
    <div className="relative flex items-center justify-center border-b border-line bg-bg px-7 py-[14px]">
      <nav className="flex items-center gap-0 text-[11px] uppercase tracking-[0.08em] text-ink-faint">
        {STAGES.map((s, i) => {
          const idx = ORDER[s.id]
          const curIdx = ORDER[current]
          const isCurrent = s.id === current
          const reachable = idx < curIdx
          return (
            <span key={s.id} className="flex items-center">
              {reachable ? (
                <button
                  onClick={() => onNavigate(s.id)}
                  className="text-ink-faint hover:text-accent"
                >
                  {s.label}
                </button>
              ) : (
                <span className={isCurrent ? 'font-semibold text-accent' : 'text-ink-faint'}>
                  {s.label}
                </span>
              )}
              {i < STAGES.length - 1 && (
                <span className="mx-[10px] text-line-strong">›</span>
              )}
            </span>
          )
        })}
      </nav>
      {savedIndicator && (
        <span className="absolute right-7 top-1/2 -translate-y-1/2 font-display text-[10px] italic uppercase tracking-[0.1em] text-ink-faint">
          Saved
        </span>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Implement `CitationChip`**

```tsx
// src/components/stages/CitationChip.tsx
'use client'

export interface CitationChipProps {
  n: number
  onClick?: (n: number) => void
}

export function CitationChip({ n, onClick }: CitationChipProps) {
  return (
    <button
      type="button"
      onClick={() => onClick?.(n)}
      className="mx-[2px] inline-block rounded-[3px] bg-accent-soft px-[5px] py-[1px] align-baseline text-[10px] font-semibold text-accent hover:bg-accent-soft/70"
      aria-label={`Go to source ${n}`}
    >
      [{n}]
    </button>
  )
}
```

- [ ] **Step 4: Implement `SourceCard`**

```tsx
// src/components/stages/SourceCard.tsx
'use client'
import type { ReferencePaper } from '@/lib/ai/preview/progress-events'

export interface SourceCardProps {
  n: number
  paper: ReferencePaper
  highlighted?: boolean
}

export function SourceCard({ n, paper, highlighted }: SourceCardProps) {
  return (
    <div
      id={`source-${n}`}
      className={`mb-2 rounded border bg-bg-elev-1 p-[12px_14px] transition-colors ${
        highlighted ? 'border-accent' : 'border-line'
      }`}
    >
      <div className="flex items-baseline gap-3 text-[11px]">
        <span className="font-bold tracking-[0.04em] text-accent">[{n}]</span>
        <span className="text-ink-faint">
          {paper.venue} · {paper.date}
        </span>
      </div>
      <div className="mt-[2px] font-display text-[14px] font-medium leading-[1.3] text-ink">
        {paper.title}
      </div>
      <div className="text-[11px] text-ink-faint">{paper.authors}</div>
    </div>
  )
}
```

- [ ] **Step 5: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/stages/
git commit -m "feat(ui): shared components for StickyFooterCta, StageBreadcrumb, CitationChip, SourceCard"
```

---

## Task 10 — RichMarkdownList: contenteditable numbered-list editor

**Files:**
- Create: `src/components/stages/RichMarkdownList.tsx`

- [ ] **Step 1: Implement the component**

Contenteditable that renders `parseMarkdownList(value)` as a styled `<ol>` with italic lead words. On blur, reads back the DOM text content and calls `onChange(serializeMarkdownList(items))`. Keeps cursor focus while editing by not re-rendering on every keystroke. Fall back to a textarea-based editor when `value` does not parse to any items (i.e., user typed junk) so the user can recover.

```tsx
// src/components/stages/RichMarkdownList.tsx
'use client'
import { useRef, useEffect } from 'react'
import { parseMarkdownList, serializeMarkdownList, type NumberedItem } from '@/lib/ui/markdown'

export interface RichMarkdownListProps {
  value: string
  onChange: (next: string) => void
}

export function RichMarkdownList({ value, onChange }: RichMarkdownListProps) {
  const ref = useRef<HTMLOListElement>(null)
  const items = parseMarkdownList(value)

  // Re-render the ol contents when `value` changes from outside.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (el.matches(':focus-within')) return // don't clobber while user is typing
    el.innerHTML = items
      .map(
        (it) =>
          `<li><strong>${escapeHtml(it.lead)}</strong> ${escapeHtml(it.body)}</li>`,
      )
      .join('')
  }, [value])

  const handleBlur = () => {
    const el = ref.current
    if (!el) return
    const next: NumberedItem[] = Array.from(el.children).map((li) => {
      const strong = li.querySelector('strong')
      const lead = strong?.textContent?.trim() ?? ''
      const full = li.textContent?.trim() ?? ''
      const body = strong ? full.replace(lead, '').trim() : full
      return { lead, body }
    })
    onChange(serializeMarkdownList(next))
  }

  return (
    <ol
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      onBlur={handleBlur}
      className="rd-scroll cursor-text list-none pl-[22px] font-display text-[16px] leading-[1.7] text-ink outline-none"
      style={{ counterReset: 'sec' }}
    />
  )
}

function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}
```

Add to `src/app/globals.css` (append near other utility rules):

```css
.rd-mdlist > li { counter-increment: sec; position: relative; margin-bottom: 10px; }
.rd-mdlist > li::before {
  content: counter(sec) '.';
  position: absolute; left: -22px; top: 0;
  font-family: var(--font-display);
  font-weight: 500;
  color: var(--accent);
  width: 18px; text-align: right;
}
.rd-mdlist > li strong {
  font-style: italic; font-weight: 500;
}
```

Update the component to also apply `rd-mdlist` as a class to the `<ol>` so the counter CSS applies.

- [ ] **Step 2: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/stages/RichMarkdownList.tsx src/app/globals.css
git commit -m "feat(ui): RichMarkdownList — contenteditable numbered list for Format & Structure"
```

---

## Task 11 — PlanStage

**Files:**
- Create: `src/components/stages/PlanStage.tsx`
- Modify: `src/components/plan/ResearchAreaChips.tsx` — switch display to `sentenceCase(area.text)` while keeping stored value untouched.

- [ ] **Step 1: Update ResearchAreaChips to display sentence-cased labels**

In the render where the chip text is shown, wrap the label in `sentenceCase(area.text)`:

```tsx
import { sentenceCase } from '@/lib/ui/sentence-case'
// ...
<span className="...">{sentenceCase(area.text)}</span>
```

Leave the underlying model (`area.text`) untouched — this is a display transform only.

- [ ] **Step 2: Implement `PlanStage`**

```tsx
// src/components/stages/PlanStage.tsx
'use client'

import { useState } from 'react'
import type { DigestConfig, ResearchArea } from '@/lib/config-schema'
import { ResearchAreaChips } from '@/components/plan/ResearchAreaChips'
import { RichMarkdownList } from './RichMarkdownList'
import { StickyFooterCta } from './StickyFooterCta'

export interface PlanStageProps {
  config: DigestConfig
  onChange: (patch: Partial<DigestConfig>) => void
  onContinue: () => void
}

export function PlanStage({ config, onChange, onContinue }: PlanStageProps) {
  return (
    <div className="mx-auto flex min-h-0 max-w-[820px] flex-1 flex-col overflow-y-auto px-12 py-16 pb-40">
      <div className="font-sans text-[10px] font-semibold uppercase tracking-[0.22em] text-accent">
        Your research plan
      </div>

      <input
        value={config.subject}
        onChange={(e) => onChange({ subject: e.target.value })}
        className="my-[10px] w-full border-0 bg-transparent font-display text-[46px] font-medium leading-[1.1] tracking-[-0.015em] text-ink outline-none focus:bg-bg-elev-1"
      />

      <p className="mb-10 max-w-[600px] font-display text-[16px] italic leading-[1.55] text-ink-dim">
        This is how we&apos;ll pick and write each issue for you. Edit anything, then preview how one issue will read.
      </p>

      <PlanSection
        label="Who this is for"
        hint="Shapes which papers get picked."
      >
        <textarea
          rows={3}
          value={config.profile}
          onChange={(e) => onChange({ profile: e.target.value })}
          className="rd-scroll w-full resize-y border-0 bg-transparent p-0 font-display text-[16px] leading-[1.65] text-ink outline-none focus:bg-bg-elev-1 focus:outline-1 focus:outline-line focus:outline-offset-4"
        />
      </PlanSection>

      <PlanSection
        label="Research areas"
        hint="At least one paper candidate per area, every issue."
      >
        <ResearchAreaChips
          areas={config.research_areas}
          onChange={(areas: ResearchArea[]) => onChange({ research_areas: areas })}
        />
      </PlanSection>

      <PlanSection
        label="Format & Structure"
        hint="The shape of each issue. Uses a numbered list."
      >
        <RichMarkdownList
          value={config.format_structure}
          onChange={(format_structure) => onChange({ format_structure })}
        />
      </PlanSection>

      <PlanSection
        label="Voice & Language"
        hint="How each issue sounds."
      >
        <textarea
          rows={3}
          value={config.voice_language}
          onChange={(e) => onChange({ voice_language: e.target.value })}
          className="rd-scroll w-full resize-y border-0 bg-transparent p-0 font-display text-[16px] leading-[1.65] text-ink outline-none focus:bg-bg-elev-1 focus:outline-1 focus:outline-line focus:outline-offset-4"
        />
      </PlanSection>

      <StickyFooterCta
        label="Preview your digest"
        onClick={onContinue}
      />
    </div>
  )
}

function PlanSection({
  label,
  hint,
  children,
}: {
  label: string
  hint: string
  children: React.ReactNode
}) {
  return (
    <section className="border-t border-line-strong py-[26px]">
      <div className="mb-3 flex items-baseline justify-between gap-6">
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">{label}</span>
        <span className="text-[11px] italic text-ink-faint">{hint}</span>
      </div>
      {children}
    </section>
  )
}
```

- [ ] **Step 3: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/stages/PlanStage.tsx src/components/plan/ResearchAreaChips.tsx
git commit -m "feat(stages): PlanStage with inline editing for all four fields"
```

---

## Task 12 — PreviewLoadingView

**Files:**
- Create: `src/components/stages/PreviewLoadingView.tsx`

- [ ] **Step 1: Implement**

```tsx
// src/components/stages/PreviewLoadingView.tsx
'use client'
import type { ProgressState } from '@/lib/ai/preview/map-progress-to-stage'
import { STAGE_LABELS } from '@/lib/ai/preview/map-progress-to-stage'

export interface PreviewLoadingViewProps {
  subject: string
  totalAreas: number
  state: ProgressState
}

export function PreviewLoadingView({ subject, totalAreas, state }: PreviewLoadingViewProps) {
  const pct = Math.max(4, Math.min(100, (state.done / STAGE_LABELS.length) * 100))

  return (
    <div className="mx-auto max-w-[720px] px-12 py-16">
      <header className="mb-7 border-b border-ink pb-7 text-center">
        <div className="mb-[18px] flex items-center justify-center gap-[14px]">
          <span className="h-px flex-1 max-w-[80px] bg-line-strong" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-accent">
            Preview Issue · {subject}
          </span>
          <span className="h-px flex-1 max-w-[80px] bg-line-strong" />
        </div>
        <h1 className="font-display text-[38px] font-medium tracking-[-0.01em] text-ink">
          Going to press
          <span className="ml-1 inline-block h-[0.9em] w-[2px] animate-[rd-blink_1s_steps(2)_infinite] align-[-3px] bg-accent" />
        </h1>
        <p className="mx-auto mt-[14px] max-w-[500px] font-display text-[15.5px] italic leading-[1.55] text-ink-dim">
          We&apos;re pulling together a sample of how your digest will read. This usually takes about twenty seconds.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-6 py-2 pb-8 text-center">
        <Stat n={state.papersScanned} label="Papers scanned" />
        <Stat n={`${state.areasDone} / ${totalAreas}`} label="Areas checked" />
      </section>

      <div className="relative h-[2px] overflow-hidden rounded-[1px] bg-line">
        <div
          className="absolute left-0 top-0 bottom-0 rounded-[1px] bg-accent transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      <ol className="mt-0">
        {STAGE_LABELS.map((label, i) => {
          const st =
            i < state.done ? 'done' : i === state.running ? 'running' : 'pending'
          return <StageRow key={label} label={label} state={st} />
        })}
      </ol>

      <p className="mt-7 text-center font-display text-[13px] italic text-ink-faint">
        Leave this open. We&apos;ll land the preview right here when it&apos;s ready.
      </p>
    </div>
  )
}

function Stat({ n, label }: { n: number | string; label: string }) {
  return (
    <div>
      <div className="font-display text-[32px] font-medium leading-none tabular-nums text-ink">
        {n}
      </div>
      <div className="mt-[6px] text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
        {label}
      </div>
    </div>
  )
}

function StageRow({ label, state }: { label: string; state: 'done' | 'running' | 'pending' }) {
  const markClass =
    state === 'done'
      ? 'bg-accent border-accent after:content-["✓"] after:text-bg after:text-[10px]'
      : state === 'running'
        ? 'border-accent animate-[rd-pulse_1.2s_ease-in-out_infinite] bg-[radial-gradient(circle_at_center,var(--accent)_3px,transparent_4px)]'
        : 'border-line-strong bg-transparent'

  const labelClass =
    state === 'running'
      ? 'text-accent font-medium'
      : state === 'pending'
        ? 'text-ink-faint italic'
        : 'text-ink-soft'

  const meta = state === 'done' ? 'done' : state === 'running' ? 'in progress' : ''

  return (
    <li className="grid grid-cols-[20px_1fr_auto] items-center gap-3 border-t border-line px-0 py-[10px] font-display text-[15px] first:border-t-0 first:pt-[14px]">
      <span className={`flex h-4 w-4 items-center justify-center rounded-full border ${markClass}`} />
      <span className={labelClass}>{label}</span>
      <span className="text-[11px] tracking-[0.04em] tabular-nums text-ink-faint">{meta}</span>
    </li>
  )
}
```

Also append to `globals.css`:

```css
@keyframes rd-blink { 50% { opacity: 0; } }
@keyframes rd-pulse {
  0%, 100% { opacity: 0.4; }
  50%      { opacity: 1; }
}
```

- [ ] **Step 2: Typecheck and lint**

Run: `npm run typecheck && npm run lint`

- [ ] **Step 3: Commit**

```bash
git add src/components/stages/PreviewLoadingView.tsx src/app/globals.css
git commit -m "feat(stages): PreviewLoadingView with benefit-framed 5-stage timeline"
```

---

## Task 13 — PreviewSidebar and PreviewIssueView

**Files:**
- Create: `src/components/stages/PreviewSidebar.tsx`
- Create: `src/components/stages/PreviewIssueView.tsx`

- [ ] **Step 1: Implement `PreviewSidebar`**

```tsx
// src/components/stages/PreviewSidebar.tsx
'use client'
import type { ReactNode } from 'react'

export interface PreviewSidebarProps {
  papersScanned: number
  totalAreas: number
  papersSelected: number
  ctaLabel: string
  onCta: () => void
  ctaHelper?: ReactNode
}

const SELL_BULLETS: Array<{ lead: string; body: string }> = [
  { lead: 'The full field, scanned.', body: 'Thousands of papers across your areas, so nothing important slips through.' },
  { lead: 'As much as the field delivers.', body: 'Not a fixed 5. A quiet stretch brings fewer, a flood of new work brings more, right-sized for each issue.' },
  { lead: 'Deep reads, not skims.', body: 'Reads the full paper for every pick and sees how it connects to related work, so nothing important gets missed.' },
  { lead: 'Continuity across issues.', body: 'Remembers what you have already read. Threads build over time. Nothing repeats.' },
  { lead: 'In your inbox, on your schedule.', body: 'Daily, weekly, monthly, whenever you want it.' },
]

export function PreviewSidebar({
  papersScanned,
  totalAreas,
  papersSelected,
  ctaLabel,
  onCta,
  ctaHelper,
}: PreviewSidebarProps) {
  return (
    <aside className="sticky top-0 flex h-screen max-h-screen flex-col gap-5 overflow-y-auto border-r border-line bg-bg-elev-1 p-7 pb-6 max-[900px]:static max-[900px]:h-auto">
      <Block label="This is a preview">
        <p className="text-[12px] leading-[1.55] text-ink-soft">
          A short sample so you can feel the voice and paper-picking. Your real digest does much more.
        </p>
      </Block>

      <Block label="The sample">
        <StatRow n={papersScanned} k="Papers scanned" />
        <StatRow n={totalAreas} k="Areas covered" />
        <StatRow n={papersSelected} k="Selected for you" />
      </Block>

      <Block label="Your real digest does more">
        <ul className="m-0 list-none space-y-[10px] p-0">
          {SELL_BULLETS.map((b) => (
            <li key={b.lead} className="border-t border-line-strong pt-[10px] text-[12px] leading-[1.5] text-ink-soft first:border-t-0 first:pt-0">
              <strong className="mb-[3px] block font-display text-[14.5px] font-medium tracking-[-0.005em] text-ink">
                {b.lead}
              </strong>
              {b.body}
            </li>
          ))}
        </ul>
      </Block>

      <div className="mt-auto border-t border-line-strong pt-4">
        <button
          onClick={onCta}
          className="w-full rounded-[3px] bg-accent px-[14px] py-[13px] text-[12px] font-semibold uppercase tracking-[0.08em] text-accent-ink hover:bg-accent-hover"
        >
          {ctaLabel}
        </button>
        {ctaHelper && <div className="mt-2 text-center text-[11px] italic text-ink-faint">{ctaHelper}</div>}
      </div>
    </aside>
  )
}

function Block({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-[10px] text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">{label}</div>
      {children}
    </div>
  )
}

function StatRow({ n, k }: { n: number | string; k: string }) {
  return (
    <div className="border-t border-line-strong py-[10px] first:border-t-0 first:pt-0">
      <div className="font-display text-[26px] font-medium leading-none tabular-nums text-ink">{n}</div>
      <div className="mt-[4px] text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-faint">{k}</div>
    </div>
  )
}
```

- [ ] **Step 2: Implement `PreviewIssueView`**

```tsx
// src/components/stages/PreviewIssueView.tsx
'use client'
import { PreviewSidebar } from './PreviewSidebar'
import { SourceCard } from './SourceCard'
import { CitationChip } from './CitationChip'
import { MarkdownText } from '@/components/chat/MarkdownText'
import type { ReferencePaper } from '@/lib/ai/preview/progress-events'
import type { DigestConfig } from '@/lib/config-schema'
import { useCallback } from 'react'

export interface PreviewIssueViewProps {
  config: DigestConfig
  body: string
  references: ReferencePaper[]
  papersScanned: number
  onStart: () => void
}

export function PreviewIssueView({
  config,
  body,
  references,
  papersScanned,
  onStart,
}: PreviewIssueViewProps) {
  const onCite = useCallback((n: number) => {
    const el = document.getElementById(`source-${n}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.classList.add('!border-accent')
      setTimeout(() => el.classList.remove('!border-accent'), 1500)
    }
  }, [])

  return (
    <div className="grid min-h-screen grid-cols-[280px_1fr] max-[900px]:grid-cols-1">
      <PreviewSidebar
        papersScanned={papersScanned}
        totalAreas={config.research_areas.length}
        papersSelected={references.length}
        ctaLabel="Start my digest →"
        onCta={onStart}
        ctaHelper={<span>Set your schedule next. Change anything, anytime.</span>}
      />

      <article className="mx-auto max-w-[680px] px-12 py-11">
        <header className="mb-8 border-b border-ink pb-6 text-center">
          <div className="mb-[18px] flex items-center justify-center gap-[14px]">
            <span className="h-px flex-1 max-w-[80px] bg-line-strong" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-accent">
              Preview Issue · {config.subject} · {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
            <span className="h-px flex-1 max-w-[80px] bg-line-strong" />
          </div>
          <h1 className="font-display text-[36px] font-medium leading-[1.12] tracking-[-0.01em] text-ink">
            A sample issue,<br />in your voice.
          </h1>
          <p className="mx-auto mt-4 max-w-[460px] font-display text-[15.5px] italic leading-[1.55] text-ink-dim">
            How your {config.subject} digest would read: voice, structure, paper-picking, in a single issue.
          </p>
        </header>

        <div className="font-display text-[15px] leading-[1.65] text-ink">
          {/* Render markdown body with [n] replaced by CitationChip. See Step 3 below. */}
          <MarkdownWithCitations body={body} onCite={onCite} />
        </div>

        <section className="mt-9">
          <div className="mb-[10px] text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
            Sources in this sample
          </div>
          {references.map((p, i) => (
            <SourceCard key={p.id} n={i + 1} paper={p} />
          ))}
        </section>

        <section className="mt-11 rounded border border-line-strong bg-bg-elev-1 p-8 text-center">
          <h3 className="mb-1 font-display text-[22px] font-medium tracking-[-0.005em] text-ink">
            Ready for the real thing?
          </h3>
          <p className="mb-4 font-display text-[14px] italic text-ink-dim">
            Pick your schedule and your first full digest goes out on it.
          </p>
          <button
            onClick={onStart}
            className="rounded-[3px] bg-accent px-8 py-3 text-[12px] font-semibold uppercase tracking-[0.08em] text-accent-ink hover:bg-accent-hover"
          >
            Start my digest →
          </button>
        </section>
      </article>
    </div>
  )
}

function MarkdownWithCitations({ body, onCite }: { body: string; onCite: (n: number) => void }) {
  // Swap each literal `[n]` token in the rendered HTML for a CitationChip.
  // Simplest: render body via the existing MarkdownText, then post-process
  // DOM to wrap matches. Since MarkdownText is a React component, wrap it
  // and scan children on mount. To keep Task 13 self-contained we use a
  // lightweight approach: render <MarkdownText markdown={bodyWithPlaceholders}/>
  // where citations are substituted with unicode markers, then replace in
  // a `useEffect` scanning text nodes.
  //
  // Implementation detail is left to Task 14 where citations get tightened
  // across the whole article. For now, render plain markdown.
  return <MarkdownText markdown={body} />
}
```

- [ ] **Step 3: Typecheck and lint**

Run: `npm run typecheck && npm run lint`

- [ ] **Step 4: Commit**

```bash
git add src/components/stages/PreviewSidebar.tsx src/components/stages/PreviewIssueView.tsx
git commit -m "feat(stages): PreviewSidebar + PreviewIssueView with centered masthead and sources"
```

---

## Task 14 — Inline citation chips that scroll to sources

**Files:**
- Modify: `src/components/stages/PreviewIssueView.tsx`

- [ ] **Step 1: Add a DOM post-processor**

Replace the placeholder `MarkdownWithCitations` with a real implementation that renders `body` via `MarkdownText` inside a container, then, after render, walks text nodes and replaces every literal `[n]` match with a React-portal'd `CitationChip`. Keep it simple: use `useRef` + `useEffect` to walk child text nodes and wrap each match in a button element with click handler.

```tsx
// Inside PreviewIssueView.tsx
import { useEffect, useRef } from 'react'

function MarkdownWithCitations({ body, onCite }: { body: string; onCite: (n: number) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const root = ref.current
    if (!root) return
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    const nodes: Text[] = []
    while (walker.nextNode()) nodes.push(walker.currentNode as Text)
    const RE = /\[(\d+)\]/g
    for (const node of nodes) {
      const text = node.nodeValue ?? ''
      if (!RE.test(text)) continue
      RE.lastIndex = 0
      const frag = document.createDocumentFragment()
      let lastIdx = 0
      let m: RegExpExecArray | null
      while ((m = RE.exec(text)) !== null) {
        if (m.index > lastIdx) frag.appendChild(document.createTextNode(text.slice(lastIdx, m.index)))
        const btn = document.createElement('button')
        btn.type = 'button'
        btn.textContent = `[${m[1]}]`
        btn.className =
          'mx-[2px] inline-block rounded-[3px] bg-accent-soft px-[5px] py-[1px] align-baseline text-[10px] font-semibold text-accent hover:bg-accent-soft/70'
        btn.setAttribute('aria-label', `Go to source ${m[1]}`)
        const n = parseInt(m[1], 10)
        btn.addEventListener('click', () => onCite(n))
        frag.appendChild(btn)
        lastIdx = m.index + m[0].length
      }
      if (lastIdx < text.length) frag.appendChild(document.createTextNode(text.slice(lastIdx)))
      node.replaceWith(frag)
    }
  }, [body, onCite])

  return (
    <div ref={ref}>
      <MarkdownText markdown={body} />
    </div>
  )
}
```

- [ ] **Step 2: Verify visually**

Run: `npm run dev`
Open the app. Complete onboarding with a synthetic config (or fixture) to reach a preview with `[1]`…`[5]` citations in the body. Click a chip; confirm the matching source card scrolls into view and briefly highlights.

- [ ] **Step 3: Commit**

```bash
git add src/components/stages/PreviewIssueView.tsx
git commit -m "feat(preview): inline citation chips scroll to source cards"
```

---

## Task 15 — PreviewStage: kickoff + loading/issue composition + SSE

**Files:**
- Create: `src/components/stages/PreviewStage.tsx`

- [ ] **Step 1: Implement**

```tsx
// src/components/stages/PreviewStage.tsx
'use client'
import { useEffect, useRef, useState } from 'react'
import type { DigestConfig, SearchQuery } from '@/lib/config-schema'
import type { ProgressEvent, ReferencePaper } from '@/lib/ai/preview/progress-events'
import { mapProgressToStage, type ProgressState } from '@/lib/ai/preview/map-progress-to-stage'
import { PreviewLoadingView } from './PreviewLoadingView'
import { PreviewIssueView } from './PreviewIssueView'
import { StickyFooterCta } from './StickyFooterCta'

export interface PreviewStageProps {
  config: DigestConfig
  sessionId?: string | null
  onBack: () => void
  onStart: () => void
}

interface ReadyPayload {
  body: string
  references: ReferencePaper[]
  queries: SearchQuery[]
  papersScanned: number
}

export function PreviewStage({ config, sessionId, onBack, onStart }: PreviewStageProps) {
  const [events, setEvents] = useState<ProgressEvent[]>([])
  const [ready, setReady] = useState<ReadyPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const state: ProgressState = mapProgressToStage(events, config.research_areas.length)
  const startedRef = useRef(false)

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    const abort = new AbortController()
    ;(async () => {
      try {
        const res = await fetch('/api/preview-digest', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(sessionId ? { 'x-session-id': sessionId } : {}),
          },
          body: JSON.stringify(config),
          signal: abort.signal,
        })
        if (!res.ok || !res.body) {
          setError(`HTTP ${res.status}`)
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
            try { evt = JSON.parse(line.slice(5).trim()) } catch { continue }
            setEvents((prev) => prev.concat(evt))
            if (evt.kind === 'done') {
              setReady({
                body: evt.body,
                references: evt.references,
                queries: evt.queries,
                papersScanned: prev(evt, events).papersScanned,
              })
            }
            if (evt.kind === 'error') {
              setError(evt.message)
            }
          }
        }
      } catch (err) {
        if (abort.signal.aborted) return
        setError((err as Error).message ?? 'Network error')
      }
    })()
    return () => abort.abort()
  }, [config, sessionId])

  if (error && !ready) {
    return (
      <div className="mx-auto flex max-w-[680px] flex-col gap-4 px-12 py-20">
        <div className="text-[12px] uppercase tracking-[0.16em] text-accent">Couldn&apos;t finish</div>
        <p className="font-display text-[15px] text-ink-soft">{error}</p>
        <button
          onClick={onBack}
          className="self-start rounded border border-line-strong px-4 py-2 text-[12px] uppercase tracking-[0.1em] text-ink-soft hover:border-accent hover:text-accent"
        >
          ← Edit plan
        </button>
      </div>
    )
  }

  if (!ready) {
    return (
      <PreviewLoadingView
        subject={config.subject}
        totalAreas={config.research_areas.length}
        state={state}
      />
    )
  }

  return (
    <>
      <PreviewIssueView
        config={config}
        body={ready.body}
        references={ready.references}
        papersScanned={ready.papersScanned}
        onStart={onStart}
      />
      {/* Sticky footer CTA for mobile — desktop has sidebar CTA + end-of-article CTA */}
      <div className="hidden max-[900px]:block">
        <StickyFooterCta label="Start my digest" onClick={onStart} />
      </div>
    </>
  )
}

// Helper to compute the last known papersScanned at the moment of `done`.
function prev(evt: ProgressEvent, events: ProgressEvent[]): ProgressState {
  return mapProgressToStage(events.concat(evt), 10 /* unused for papers */)
}
```

Note: the `prev(...)` helper is a simplification that recomputes `papersScanned` on done; keep `totalAreas=10` placeholder — the value is not used for `papersScanned`. Confirm at review.

- [ ] **Step 2: Typecheck and lint**

Run: `npm run typecheck && npm run lint`

- [ ] **Step 3: Commit**

```bash
git add src/components/stages/PreviewStage.tsx
git commit -m "feat(stages): PreviewStage wires SSE to loading + issue views"
```

---

## Task 16 — StartStage + StartedView

**Files:**
- Create: `src/components/stages/StartStage.tsx`
- Create: `src/components/stages/StartedView.tsx`

- [ ] **Step 1: Implement `StartedView`**

```tsx
// src/components/stages/StartedView.tsx
'use client'
export interface StartedViewProps {
  email: string
  whenLabel: string
  priceLabel: string
}

export function StartedView({ email, whenLabel, priceLabel }: StartedViewProps) {
  return (
    <div className="mx-auto max-w-[680px] px-12 py-20 text-center">
      <div className="mb-[18px] flex items-center justify-center gap-[14px]">
        <span className="h-px flex-1 max-w-[80px] bg-line-strong" />
        <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-accent">You&apos;re in</span>
        <span className="h-px flex-1 max-w-[80px] bg-line-strong" />
      </div>
      <h1 className="font-display text-[40px] font-medium leading-[1.12] tracking-[-0.01em] text-ink">
        Your digest starts {whenLabel}.
      </h1>
      <p className="mx-auto mt-4 max-w-[500px] font-display text-[16px] italic leading-[1.55] text-ink-dim">
        First issue lands in <span className="font-medium not-italic text-accent">{email}</span>. Billing: <span className="font-medium not-italic text-accent">{priceLabel}</span>.
      </p>
    </div>
  )
}
```

- [ ] **Step 2: Implement `StartStage`**

Full screen with When section (cadence chips, day-of-week pills, time select, tz select), Plan section (monthly/yearly cards), Where section (email input), summary card with live preview, sticky footer CTA showing price, placeholder payment block. On click: compute schedule via `buildSchedule`, set config, transition to `StartedView`.

```tsx
// src/components/stages/StartStage.tsx
'use client'
import { useState } from 'react'
import type { DigestConfig, Plan, Schedule } from '@/lib/config-schema'
import { buildSchedule, type Cadence } from '@/lib/schedule/build-cron'
import { buildScheduleSummary, nextDeliveryDate } from '@/lib/ui/schedule-summary'
import { StickyFooterCta } from './StickyFooterCta'
import { StartedView } from './StartedView'

export interface StartStageProps {
  config: DigestConfig
  onChange: (patch: Partial<DigestConfig>) => void
  onCommit: (finalized: DigestConfig & { schedule: Schedule }) => void
}

const PRICE: Record<Plan, { display: string; cta: string; under: string }> = {
  monthly: { display: '$19 / month', cta: '$19 / MONTH', under: '$19 a month' },
  yearly:  { display: '$149 / year', cta: '$149 / YEAR', under: '$149 a year' },
}

export function StartStage({ config, onChange, onCommit }: StartStageProps) {
  const [cadence, setCadence] = useState<Cadence>('weekly')
  const [dayOfWeek, setDayOfWeek] = useState<number>(2) // Tue
  const [time, setTime] = useState('09:00')
  const [tz, setTz] = useState<string>(config.schedule?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone)
  const [email, setEmail] = useState<string>(config.email ?? '')
  const [plan, setPlan] = useState<Plan>(config.plan ?? 'yearly')
  const [started, setStarted] = useState<null | { when: string; price: string; email: string }>(null)

  const summary = buildScheduleSummary({
    cadence,
    dayOfWeek,
    time,
    timezone: tz,
    plan,
    email: email || 'your inbox',
  })

  const commit = () => {
    const s = buildSchedule({ cadence, dayOfWeek: dayOfWeek as 0 | 1 | 2 | 3 | 4 | 5 | 6, time, timezone: tz })
    const next: DigestConfig & { schedule: Schedule } = { ...config, plan, email, schedule: s }
    onChange({ plan, email, schedule: s })
    onCommit(next)
    const when = nextDeliveryDate({ cadence, dayOfWeek, time, timezone: tz }).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    setStarted({ when, price: PRICE[plan].under, email })
  }

  if (started) {
    return <StartedView email={started.email} whenLabel={started.when} priceLabel={started.price} />
  }

  const canCommit = !!email && /\S+@\S+\.\S+/.test(email)

  return (
    <div className="mx-auto flex min-h-0 max-w-[720px] flex-1 flex-col overflow-y-auto px-12 py-16 pb-40">
      <div className="font-sans text-[10px] font-semibold uppercase tracking-[0.22em] text-accent">Final step</div>
      <div className="my-[10px] font-display text-[46px] font-medium leading-[1.1] tracking-[-0.015em] text-ink">Start your digest.</div>
      <p className="mb-10 max-w-[540px] font-display text-[16px] italic leading-[1.55] text-ink-dim">
        Pick when, where, and your plan. You can change any of it anytime.
      </p>

      {/* When section */}
      <section className="border-t border-line-strong py-[26px]">
        <SectionHead label="When" hint="Daily, weekly, or monthly. You pick the time." />
        <div className="flex flex-wrap gap-2">
          {(['daily', 'weekdays', 'weekly', 'monthly'] as Cadence[]).map((c) => (
            <button
              key={c}
              onClick={() => setCadence(c)}
              className={`rounded-full border px-[18px] py-[10px] text-[13px] font-medium capitalize ${
                cadence === c
                  ? 'bg-accent border-accent text-accent-ink'
                  : 'border-line-strong text-ink-soft hover:border-accent hover:text-accent'
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="mt-[18px] flex flex-wrap gap-5 items-end">
          {cadence === 'weekly' && (
            <SubField label="Day">
              <div className="flex gap-[6px]">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => (
                  <button
                    key={d}
                    onClick={() => setDayOfWeek(i)}
                    className={`flex h-10 w-10 items-center justify-center rounded-full border text-[12px] font-medium ${
                      dayOfWeek === i ? 'bg-accent border-accent text-accent-ink' : 'border-line-strong text-ink-soft hover:border-accent hover:text-accent'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </SubField>
          )}
          <SubField label="Time">
            <select value={time} onChange={(e) => setTime(e.target.value)} className="rounded border border-line-strong bg-bg-elev-1 px-[14px] py-[9px] font-display text-[16px] text-ink outline-none focus:border-accent">
              {['07:00', '08:00', '09:00', '10:00', '18:00'].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </SubField>
          <SubField label="Timezone">
            <select value={tz} onChange={(e) => setTz(e.target.value)} className="rounded border border-line-strong bg-bg-elev-1 px-[14px] py-[9px] font-display text-[16px] text-ink outline-none focus:border-accent">
              <option value={tz}>{tz}</option>
              <option value="UTC">UTC</option>
              <option value="America/New_York">America/New_York</option>
              <option value="Europe/London">Europe/London</option>
              <option value="Asia/Tokyo">Asia/Tokyo</option>
            </select>
          </SubField>
        </div>
      </section>

      {/* Plan section */}
      <section className="border-t border-line-strong py-[26px]">
        <SectionHead label="Plan" hint="Switch between monthly and yearly anytime." />
        <div className="grid grid-cols-2 gap-3 max-[600px]:grid-cols-1">
          <PlanCard planKey="monthly" active={plan === 'monthly'} onClick={() => setPlan('monthly')} price="$19" per="/ month" sub="Billed every month." />
          <PlanCard planKey="yearly" active={plan === 'yearly'} onClick={() => setPlan('yearly')} price="$149" per="/ year" sub="Works out to $12.42/month, billed yearly." saveChip="Save 35%" />
        </div>
      </section>

      {/* Where section */}
      <section className="border-t border-line-strong py-[26px]">
        <SectionHead label="Where" hint="We'll send each issue here." />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full min-w-[280px] max-w-[460px] rounded border border-line-strong bg-bg-elev-1 px-[14px] py-[9px] font-display text-[16px] text-ink outline-none focus:border-accent"
        />
      </section>

      {/* Summary */}
      <div className="mt-10 rounded border border-line-strong bg-bg-elev-1 p-6">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">So that&apos;s</div>
        <p className="font-display text-[17px] leading-[1.55] text-ink">{summary}</p>
        <div className="mt-4 flex items-center gap-3 rounded border border-dashed border-line-strong bg-bg p-[10px_12px] text-[12px] italic text-ink-faint">
          <span className="h-2 w-2 rounded-full bg-line-strong" />
          Payment details collected on the next step. Cancel anytime, no questions.
        </div>
      </div>

      <StickyFooterCta
        label={`Start my digest · ${PRICE[plan].cta}`}
        onClick={commit}
        disabled={!canCommit}
        helper={<span>Cancel anytime in settings. Your plan and schedule stay editable.</span>}
      />
    </div>
  )
}

function SectionHead({ label, hint }: { label: string; hint: string }) {
  return (
    <div className="mb-4 flex items-baseline justify-between gap-6">
      <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">{label}</span>
      <span className="text-[11px] italic text-ink-faint">{hint}</span>
    </div>
  )
}

function SubField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-[6px]">
      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-faint">{label}</span>
      {children}
    </div>
  )
}

function PlanCard(props: {
  planKey: Plan
  active: boolean
  onClick: () => void
  price: string
  per: string
  sub: string
  saveChip?: string
}) {
  return (
    <button
      onClick={props.onClick}
      className={`relative rounded border p-[20px_22px] text-left ${
        props.active
          ? 'border-accent bg-bg-elev-1 shadow-[0_0_0_1px_var(--accent)]'
          : 'border-line-strong bg-bg-elev-1 hover:border-ink-faint'
      }`}
    >
      <span className={`absolute right-[22px] top-[20px] block h-[18px] w-[18px] rounded-full border ${props.active ? 'border-accent bg-[radial-gradient(circle_at_center,var(--accent)_5px,var(--bg)_6px)]' : 'border-line-strong bg-bg'}`} />
      <div className="flex items-baseline justify-between pr-6">
        <span className="font-display text-[20px] font-medium capitalize">{props.planKey}</span>
        {props.saveChip && (
          <span className="rounded bg-accent-soft px-2 py-[3px] text-[10px] font-semibold uppercase tracking-[0.12em] text-accent">{props.saveChip}</span>
        )}
      </div>
      <div className="mt-[10px] font-display text-[36px] font-medium leading-none text-ink">
        {props.price}<span className="ml-1 font-sans text-[14px] italic text-ink-faint">{props.per}</span>
      </div>
      <div className="mt-[6px] text-[11px] text-ink-faint">{props.sub}</div>
    </button>
  )
}
```

- [ ] **Step 3: Typecheck and lint**

Run: `npm run typecheck && npm run lint`

- [ ] **Step 4: Commit**

```bash
git add src/components/stages/StartStage.tsx src/components/stages/StartedView.tsx
git commit -m "feat(stages): StartStage with schedule + plan + email, payment placeholder"
```

---

## Task 17 — OnboardingStages orchestrator + ChatShell wiring

**Files:**
- Create: `src/components/stages/OnboardingStages.tsx`
- Modify: `src/components/chat/ChatShell.tsx`
- Delete: `src/components/plan/ResearchPlanView.tsx`, `src/components/plan/PreviewSection.tsx`, `src/components/plan/PreviewRunningState.tsx`, `src/components/plan/PreviewReadyState.tsx`, `src/components/plan/CadenceSection.tsx`, `src/components/plan/SubscribeSection.tsx`

- [ ] **Step 1: Implement `OnboardingStages`**

```tsx
// src/components/stages/OnboardingStages.tsx
'use client'
import { useState } from 'react'
import type { DigestConfig } from '@/lib/config-schema'
import { StageBreadcrumb, type StageId } from './StageBreadcrumb'
import { PlanStage } from './PlanStage'
import { PreviewStage } from './PreviewStage'
import { StartStage } from './StartStage'

export interface OnboardingStagesProps {
  initialConfig: DigestConfig
  sessionId?: string | null
}

export function OnboardingStages({ initialConfig, sessionId }: OnboardingStagesProps) {
  const [stage, setStage] = useState<StageId>('plan')
  const [config, setConfig] = useState<DigestConfig>(initialConfig)
  const [saved, setSaved] = useState(true)

  const patch = (partial: Partial<DigestConfig>) => {
    setConfig((c) => ({ ...c, ...partial, updated_at: new Date().toISOString() }))
    setSaved(false)
    queueMicrotask(() => setSaved(true)) // real save debounce is in storage layer
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <StageBreadcrumb current={stage} onNavigate={setStage} savedIndicator={stage === 'plan' && saved} />
      {stage === 'plan' && (
        <PlanStage config={config} onChange={patch} onContinue={() => setStage('preview')} />
      )}
      {stage === 'preview' && (
        <PreviewStage
          config={config}
          sessionId={sessionId}
          onBack={() => setStage('plan')}
          onStart={() => setStage('start')}
        />
      )}
      {stage === 'start' && (
        <StartStage
          config={config}
          onChange={patch}
          onCommit={() => {
            /* placeholder; real payment integration lives here later */
          }}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Wire `ChatShell` to render `OnboardingStages`**

Replace the existing `<ResearchPlanView .../>` render in `ChatShell.tsx` with `<OnboardingStages initialConfig={finalConfig} sessionId={conversationId} />`. Remove the `onReset` prop path; the breadcrumb handles navigation now. Delete imports of the old plan components.

- [ ] **Step 3: Delete the deprecated components**

```bash
rm src/components/plan/ResearchPlanView.tsx \
   src/components/plan/PreviewSection.tsx \
   src/components/plan/PreviewRunningState.tsx \
   src/components/plan/PreviewReadyState.tsx \
   src/components/plan/CadenceSection.tsx \
   src/components/plan/SubscribeSection.tsx
```

- [ ] **Step 4: Typecheck, lint, build**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(stages): wire OnboardingStages into ChatShell, remove old ResearchPlanView"
```

---

## Task 18 — End-to-end manual verification

**Files:** None (manual test).

- [ ] **Step 1: Boot dev server and exercise the flow**

Run: `npm run dev`

- [ ] **Step 2: Run through the onboarding at desktop width (≥ 900px)**

- Start from `/`. Go through chat until `handoffToPlan` fires.
- Verify transition to **Plan** stage. Confirm:
  - Breadcrumb is `Plan › Preview › Start` with `Plan` green.
  - Subject is large editable title.
  - Four sections with hairline rules.
  - Research area chips are sentence-cased in display (e.g., "Retrieval-augmented generation (RAG) for agents").
  - Format & Structure renders as a numbered list with green numerals and italic lead-words.
  - Voice & Language is a plain textarea.
  - Sticky `PREVIEW YOUR DIGEST` footer is centered, uppercase.
  - Scrollbars inside textareas are tan, not default OS.

- Click Preview. Confirm **Preview loading**:
  - Breadcrumb advances to Preview.
  - Masthead reads "Going to press" with blinking cursor.
  - Two stats tick up (papers scanned, areas checked).
  - Five-row timeline; running row pulses and has green label.
  - No repetition of the stage name between progress bar and timeline.

- Preview completes. Confirm **Preview issue**:
  - Centered masthead with date dateline.
  - Body has real `h2` section headings with top rule.
  - `[1]`–`[5]` citations are clickable chips; clicking scrolls to matching SourceCard and briefly highlights it.
  - Sidebar is sticky as you scroll (test by scrolling article area).
  - Sidebar shows three stats, five benefit bullets with Playfair lead-lines, primary CTA.
  - End-of-article CTA block appears after sources.

- Click Start my digest. Confirm **Start** stage:
  - Three sections in order: When, Plan, Where.
  - Weekly is default cadence; Tue is default day.
  - Plan cards: Monthly $19, Yearly $149 (Save 35% chip, $12.42/mo sub).
  - Summary card reads naturally with the current date + email + price.
  - CTA button shows `START MY DIGEST · $149 / YEAR`.
  - Toggle plan, confirm CTA and summary update live.
  - Click Start: transitions to "You're in" confirmation.

- [ ] **Step 3: Switch browser to tablet (~ 720px wide)**

Re-verify each stage works. Sidebar on preview narrows to ~200px; plan cards remain two-column. Sticky footer still pinned.

- [ ] **Step 4: Switch to mobile (< 600px)**

- Plan: sections stack, chips wrap, sticky footer remains.
- Preview loading: stats side-by-side but shrunk, h1 on two lines is fine.
- Preview issue: sidebar disappears, sticky top pill appears, hero stats row visible, article body tight, sticky footer CTA at bottom.
- Tap the top pill: bottom sheet opens with the full sidebar content including CTA.
- Start: plan cards stack, day-of-week pills wrap, CTA full-width.

- [ ] **Step 5: Keyboard overlap check (real device or devtools device mode)**

- On Start stage, tap the email input. Confirm the sticky footer does not cover the focused input. If it does, add `scroll-padding-bottom: 96px` to the scroll container.

- [ ] **Step 6: Commit any small fixes discovered during verification as fixups**

Commit with messages like:

```bash
git commit -m "fix(plan): correct chip wrap at < 360px"
```

---

## Task 19 — Full test + build green

**Files:** None.

- [ ] **Step 1: Full test suite**

Run: `npm test`
Expected: all tests pass (schema, markdown, sentence-case, schedule-summary, map-progress-to-stage, plus any pre-existing tests).

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 4: Production build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 5: Final commit if anything got touched**

```bash
git commit -m "chore: final build + lint green for onboarding stages redesign"
```

---

## Self-review

- **Spec coverage.** Walked through each section of the spec:
  - 3-stage flow → Tasks 11/15/16/17 (Plan / Preview / Start / orchestrator).
  - Breadcrumb → Task 9 + used by 17.
  - Schema split → Tasks 1, 2, 3.
  - Plan screen (four sections, inline editing, RichMarkdownList) → Tasks 5, 6, 10, 11.
  - Preview loading (masthead, stats, timeline, SSE-driven) → Tasks 4, 12, 15.
  - Preview issue (sidebar sticky, editorial body, citation chips, sources, end CTA, responsive) → Tasks 13, 14, 15.
  - Start step (When/Plan/Where, summary, pricing, payment placeholder, sticky CTA) → Tasks 7, 16.
  - Responsive + sticky footer contract → Task 8 (tokens) + Task 18 (verification) + specific classes in each stage.
  - Scrollbar theme + safe-area → Task 8.
- **Placeholder scan.** No TBDs or TODOs in steps. Code blocks are concrete. Only soft spot: Task 15 includes a `prev(...)` helper with an inline note acknowledging the total-areas placeholder — papers-scanned is reconstructed from events, not from `totalAreas`, so the value passed is inert. Reviewer should confirm during the task.
- **Type consistency.** `Plan = 'monthly' | 'yearly'`, `StageId = 'plan' | 'preview' | 'start'`, `DigestConfig` with `format_structure`, `voice_language`, `plan`, `email`, optional `schedule`, used consistently.
- **Missing from spec but added.** None — scope matches spec.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-21-onboarding-stages-redesign.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
