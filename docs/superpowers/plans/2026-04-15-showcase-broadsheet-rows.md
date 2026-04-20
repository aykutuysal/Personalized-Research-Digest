# Showcase Broadsheet Rows Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the showcase landed state's 3-up card grid with a vertical stack of editorial broadsheet rows that promote venue + freshness out of the fine print and give "Why for you" its own visual identity.

**Architecture:** Presentation-only refactor of two existing components. `ShowcasePickCell` gets a full body rewrite (new dateline / title / margin-bracket layout) and a replacement date helper that returns long-form strings. `ShowcaseLandedState` swaps the responsive grid for a `flex-col` stack and wraps each pick in a framer-motion stagger entrance that respects `prefers-reduced-motion` via the `useReducedMotion()` hook. No data model changes, no schema changes, no new tests — the existing `ShowcasePick` interface and showcase orchestrator tests cover everything.

**Tech Stack:** Next.js 16, React 19, Tailwind v4 (token classes only — `bg-bg-elev-1`, `text-accent`, etc.), framer-motion (already a dependency), TypeScript strict mode, Vitest for the unaffected orchestrator tests.

**Spec:** `docs/superpowers/specs/2026-04-15-showcase-broadsheet-rows-design.md`

**Note on commits:** This project is not a git repository (no `.git` directory). The plan therefore does not include `git commit` steps — checkpoints use `npm run typecheck` and `npm run test` instead, plus a manual browser pass at the end.

---

## File structure

| File | Action | Responsibility |
|---|---|---|
| `src/components/chat/showcase/ShowcasePickCell.tsx` | Full body rewrite | Renders one broadsheet row for one `ShowcasePick`. Owns the `formatPublishedDateline` helper inline (single consumer). |
| `src/components/chat/showcase/ShowcaseLandedState.tsx` | Targeted edits | Stacks rows vertically with `flex-col gap-3`, wraps each row in a `motion.div` with a staggered entrance gated on `useReducedMotion()`. Header and Tracking section unchanged. |

No new files. No deletions. `ShowcasePick` interface in `src/lib/ai/showcase.ts` is unchanged.

---

## Task 1: Rewrite `ShowcasePickCell.tsx`

**Files:**
- Modify: `src/components/chat/showcase/ShowcasePickCell.tsx` (full body rewrite, ~50 lines → ~70 lines)

This task replaces the entire body of the cell with the broadsheet-row layout described in the spec. The previous `formatPublishedDate` helper (returning `today` / `2d ago` / `Apr 9, 2026`) is removed; in its place is `formatPublishedDateline` (returning `Today` / `Yesterday` / `2 days ago` / `Apr 9, 2026`). The two helpers do not coexist — there is no other consumer of the short form after this rewrite.

- [ ] **Step 1: Read the current file to confirm starting state**

Run:
```bash
cat src/components/chat/showcase/ShowcasePickCell.tsx
```
Expected: a `'use client'` component that imports `ShowcasePick`, defines `MONTHS` + `formatPublishedDate`, exports `ShowcasePickCellProps`, and renders an `<a>` with chip / title / `{venue} · Published: {…}` meta line / "Why for you" footer. If the file looks substantially different from this, stop and re-read the spec — you may be on the wrong branch.

- [ ] **Step 2: Replace the entire file body with the new content**

Open `src/components/chat/showcase/ShowcasePickCell.tsx` and replace its full content with:

```tsx
'use client'

import type { ShowcasePick } from '@/lib/ai/showcase'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function formatPublishedDateline(dateStr: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr)
  if (!m) return dateStr
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

export interface ShowcasePickCellProps {
  pick: ShowcasePick
}

export function ShowcasePickCell({ pick }: ShowcasePickCellProps) {
  return (
    <a
      href={pick.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-2xl border border-line bg-bg-elev-1 px-[26px] py-[22px] transition-[border-color,transform] duration-[var(--dur-sm)] ease-[var(--ease-out)] hover:-translate-y-[1px] hover:border-line-strong"
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-line-strong pb-3">
        {pick.venue && (
          <>
            <span
              className="min-w-0 truncate font-display text-[16px] font-semibold text-ink"
              title={pick.venue}
            >
              {pick.venue}
            </span>
            <span className="text-line-strong" aria-hidden="true">—</span>
          </>
        )}
        <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-accent">
          {formatPublishedDateline(pick.date)}
        </span>
        <span className="ml-auto text-[9px] font-bold uppercase tracking-[0.16em] text-ink-faint">
          {pick.chipLabel}
        </span>
      </div>

      <div className="mt-[14px] font-display text-[21px] font-medium leading-[1.22] tracking-[-0.012em] text-ink">
        {pick.title}
      </div>

      <div className="mt-4 flex">
        <div className="w-[3px] flex-none rounded-full bg-accent" aria-hidden="true" />
        <div className="pl-4">
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-accent">
            Why for you
          </div>
          <div className="mt-[6px] font-display text-[16px] italic leading-[1.5] text-ink-soft">
            {pick.whyForYou}
          </div>
        </div>
      </div>
    </a>
  )
}
```

**Why each piece is shaped this way (read before editing):**
- `block rounded-2xl border border-line bg-bg-elev-1 px-[26px] py-[22px]` — matches the spec's row frame (22px top/bottom, 26px left/right padding, real project tokens, no leftover `flex flex-col gap-2 min-h-full` from the old grid-cell layout).
- `transition-[border-color,transform] duration-[var(--dur-sm)] ease-[var(--ease-out)]` — uses the existing motion tokens from `globals.css:64-78` rather than hard-coded values.
- `flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-line-strong pb-3` — the dateline is a horizontally-flowing baseline-aligned flex row that wraps gracefully on narrow screens (the spec's mobile fallback). `pb-3` = 12px below the rule before the title.
- `{pick.venue && (...)}` — empty-venue fallback. When `extractVenue` returned `''` (the locations-walk fallback) we render NO leading em-dash and NO "Unknown venue" string. The freshness label becomes the leftmost element naturally.
- `min-w-0 truncate ... title={pick.venue}` on the venue span — long venue names (e.g. *Proceedings of the National Academy of Sciences of the United States of America*) ellipsize before pushing the chip off the row, full name available on hover.
- `<span aria-hidden="true">—</span>` — the em-dash is decorative; screen readers don't need to announce it. `text-line-strong` color matches the rule.
- `ml-auto` on the right chip — flex spacer trick to push the chip to the right edge regardless of how much space the venue+freshness consume.
- `font-display` on title and "why for you" body — both pull the project's serif display family (`var(--font-display)` from `globals.css:134`).
- The bracket bar is a separate `<div w-[3px] bg-accent>` sibling of the content `<div pl-4>`. This produces a clean 3px vertical bar with 16px content padding and no border-collapsing surprises. The bar uses `flex-none` so it doesn't shrink, and `rounded-full` so the ends are soft.

- [ ] **Step 3: Run typecheck**

Run:
```bash
npm run typecheck
```
Expected: clean exit, no errors. If TypeScript complains about the `ShowcasePick` shape, stop — the data model fix from the previous task chain (`venue`, `date`, no `year`) must already be in place. Verify with `grep -n "year\|date" src/lib/ai/showcase.ts | head` — the `ShowcasePick` interface should have `date: string` and NOT `year: number`.

- [ ] **Step 4: Run the existing showcase test suite**

Run:
```bash
npx vitest run test/showcase.test.ts test/showcase-ranker.test.ts test/showcase-planner.test.ts
```
Expected: all tests pass (14 tests across 3 files). The cell rewrite touches no orchestrator behavior, so these tests should pass without modification. If any fail, the failure is in code other than the cell — investigate before proceeding.

---

## Task 2: Update `ShowcaseLandedState.tsx` for vertical stacking and staggered entrance

**Files:**
- Modify: `src/components/chat/showcase/ShowcaseLandedState.tsx` (3 targeted edits)

This task swaps the responsive grid for a vertical flex stack and wraps each rendered cell in a framer-motion `motion.div` with a staggered entrance. The animation is gated on `useReducedMotion()` from framer-motion — when the user prefers reduced motion, `initial` is set to `false`, which tells framer-motion to skip the entrance and use the `animate` value as the starting state.

The header (`Fresh this week` eyebrow, headline, count) and the Tracking section below the picks are NOT modified. Only the picks-container changes.

- [ ] **Step 1: Add `useReducedMotion` to the framer-motion import**

Find this line near the top of `src/components/chat/showcase/ShowcaseLandedState.tsx`:

```tsx
import { motion } from 'framer-motion'
```

Replace with:

```tsx
import { motion, useReducedMotion } from 'framer-motion'
```

- [ ] **Step 2: Replace the `gridCols` constant with a `reduceMotion` hook call**

Find this block inside `ShowcaseLandedState`:

```tsx
  const count = useCountUp(stats.papersScanned)
  const gridCols =
    picks.length === 1 ? 'grid-cols-1' : picks.length === 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-3'
```

Replace with:

```tsx
  const count = useCountUp(stats.papersScanned)
  const reduceMotion = useReducedMotion()
```

The `gridCols` variable is now dead and must be removed entirely (not commented out) — TypeScript strict mode will flag any unused locals.

- [ ] **Step 3: Replace the picks grid with a stacked column of motion-wrapped cells**

Find this block in the JSX:

```tsx
      <div className={`mt-5 grid gap-3 ${gridCols}`}>
        {picks.map((p) => (
          <ShowcasePickCell key={p.openalexId} pick={p} />
        ))}
      </div>
```

Replace with:

```tsx
      <div className="mt-5 flex flex-col gap-3">
        {picks.map((p, i) => (
          <motion.div
            key={p.openalexId}
            initial={reduceMotion ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, delay: reduceMotion ? 0 : i * 0.08, ease: [0.2, 0.7, 0.2, 1] }}
          >
            <ShowcasePickCell pick={p} />
          </motion.div>
        ))}
      </div>
```

**Why each piece:**
- `flex flex-col gap-3` — vertical stack with 12px between rows. Replaces `grid grid-cols-1 md:grid-cols-3`. No responsive variants — the row layout works at every width.
- `initial={reduceMotion ? false : { opacity: 0, y: 4 }}` — when reduced motion is preferred, framer-motion treats `initial: false` as "use the `animate` value as the starting state and skip the transition entirely." The row appears immediately. When normal motion is allowed, it fades in from `opacity 0` and slides up 4px from `y: 4`.
- `animate={{ opacity: 1, y: 0 }}` — the resting state. Same in both motion modes; what changes is whether there's an entrance from the `initial` state.
- `delay: reduceMotion ? 0 : i * 0.08` — 80ms stagger between rows in normal mode; collapsed to 0 under reduced motion so all rows appear simultaneously without the cascading delay.
- `duration: 0.28` and `ease: [0.2, 0.7, 0.2, 1]` — match the existing landed-state container's animation values (line 49 of the same file uses the same easing curve and the same general duration). Visual consistency with the rest of the component.

- [ ] **Step 4: Run typecheck**

Run:
```bash
npm run typecheck
```
Expected: clean exit. If you see "'gridCols' is declared but its value is never read", you forgot to delete the dead `gridCols` line in step 2 — remove it and re-run.

- [ ] **Step 5: Run the existing showcase test suite**

Run:
```bash
npx vitest run test/showcase.test.ts test/showcase-ranker.test.ts test/showcase-planner.test.ts
```
Expected: all 14 tests pass. The container changes don't touch orchestrator logic.

---

## Task 3: Manual browser verification

**Files:** none modified — verification only.

The previous tasks are presentation-only and the existing test suite covers no markup. This task confirms the new layout actually works in a browser, including the empty-venue fallback, the staggered entrance, the hover treatment, and the dark theme.

- [ ] **Step 1: Start the dev server**

Run:
```bash
npm run dev
```
Expected: the Next.js dev server starts and reports a local URL (typically `http://localhost:3000`). Leave this running in the background (or in a separate terminal) for the rest of the task.

- [ ] **Step 2: Trigger the showcase tool in a browser session**

Open `http://localhost:3000` and complete the onboarding flow far enough that the showcase tool fires. The exact path: enter a research subject, answer the assistant's prompts about your interests/profile, and let the agent commit the angles. The showcase tool runs after angle commitment; the chat will show first the scanning animation, then the landed state with the picks.

A subject that reliably yields populated results: **"atrial fibrillation"** with profile "Clinical cardiologist tracking AF outcomes." Other subjects work too; this is just a known-good seed.

Expected on the landed state:
- A vertical stack of rows (typically 3, possibly 1–2 if the pool was thin), not a horizontal grid.
- Each row has the dateline at top with venue, em-dash, freshness in accent emerald uppercase, and the chip label on the right edge.
- The title is in serif display font.
- Below the title: a 3px-wide accent vertical bar on the left, a "WHY FOR YOU" label in accent emerald uppercase, and the italic body in the warm soft ink color.
- The "Tracking" chips below the rows are unchanged from before.
- Header at the top (eyebrow, headline, "N papers scanned across M areas") is unchanged.

- [ ] **Step 3: Verify the staggered entrance**

Trigger the showcase a second time (refresh the page and re-run the flow, or close the chat and start a new one). Watch carefully as the landed state renders.

Expected: the rows fade in and slide up sequentially — first row immediately, second row ~80ms later, third row ~160ms later. The whole entrance completes in under half a second. If all three rows pop in simultaneously, framer-motion is not picking up the `motion.div` wrapping — recheck that the `motion.div` is wrapping each cell in `ShowcaseLandedState.tsx` and not somewhere else.

- [ ] **Step 4: Verify the hover treatment**

Move the mouse over one row. Expected: the row lifts 1px upward (subtle but visible) and the border darkens from `border-line` to `border-line-strong`. Move the mouse off — the row returns smoothly. The transition feels instant (under 200ms).

- [ ] **Step 5: Verify the empty-venue fallback (if you can find one in the wild, otherwise force one)**

Most works in the live OpenAlex pool will have a venue. To find an empty-venue case in the wild, scan multiple subjects and look for a row whose dateline starts directly with the freshness label (no leading em-dash, no venue). If you find one, confirm: no leading dash, no "Unknown venue" string, the freshness label is leftmost, the chip is still on the right.

If you can't find one quickly, force the case temporarily: open `src/lib/ai/showcase.ts`, find `extractVenue`, and at the top of the function add `return ''` as the first line. Save, watch the dev server reload, re-trigger the showcase, and confirm every row's dateline has no venue + no em-dash. Then **revert the change** before continuing.

- [ ] **Step 6: Verify reduced motion**

In Chrome/Edge: open DevTools → cmd-shift-P → search "Emulate CSS prefers-reduced-motion: reduce" → enable. In Firefox: about:config → `ui.prefersReducedMotion = 1`. In Safari: System Settings → Accessibility → Display → Reduce Motion.

With reduced motion enabled, re-trigger the showcase. Expected: all rows appear at once with no stagger, no fade, no slide. The hover lift on individual rows still works (it's a CSS transition, separate from the entrance animation).

Disable the reduced-motion override before moving on.

- [ ] **Step 7: Verify dark theme**

In DevTools, find the `<html>` element and add the attribute `data-theme="dark"`. Expected: the entire showcase re-skins to the dark palette defined in `globals.css:39-62`. The row background goes dark, the text inverts, the accent emerald shifts to the dark-theme variant. Nothing should look broken — every color used is a token, so the swap should be clean.

Remove the `data-theme="dark"` attribute when done.

- [ ] **Step 8: Stop the dev server**

In the terminal running `npm run dev`, press `Ctrl+C`.

---

## Self-review checklist (run before declaring complete)

- [ ] **Spec coverage:** All eight Section-by-section design decisions from the spec are implemented:
  - Per-row anatomy (Task 1 step 2)
  - Empty-venue fallback (Task 1 step 2, the `{pick.venue && (...)}` block)
  - Multi-row container (Task 2 step 3)
  - Stagger entrance with reduced-motion gating (Task 2 step 3)
  - Date helper replacement (Task 1 step 2, `formatPublishedDateline`)
  - Real color tokens, no rust placeholders (Task 1 step 2 className list)
  - Long-venue truncation with hover recovery (Task 1 step 2, `truncate ... title={pick.venue}`)
  - Reduced motion handled explicitly via `useReducedMotion()` (Task 2 step 3)

- [ ] **Type consistency:** `formatPublishedDateline` is the only date helper in `ShowcasePickCell.tsx` after the rewrite — no leftover `formatPublishedDate`. The `ShowcasePick` interface is referenced but not modified.

- [ ] **Commands present:** Every step that runs a command spells out the exact command and the expected output / pass condition.

- [ ] **No placeholders:** No "TBD", "TODO", "implement later", "similar to above", or "add appropriate handling" anywhere in this plan.
