# Showcase Broadsheet Rows — Design

**Date:** 2026-04-15
**Status:** Approved (brainstorming complete, ready for plan-writing)
**Scope:** Visual redesign of the onboarding showcase's "landed" state. Replaces the 3-up card grid with a vertical stack of editorial broadsheet rows that promote venue + freshness out of the fine print and give "Why for you" its own visual identity.

---

## Motivation

In the current `ShowcaseLandedState` (`src/components/chat/showcase/ShowcaseLandedState.tsx`), each pick is rendered as a small card via `ShowcasePickCell` (`src/components/chat/showcase/ShowcasePickCell.tsx`). The card has three problems:

1. **"Why for you" is buried.** It sits at the bottom of the card in italic 12px under a 9px label — readable only on close inspection. The whole point of the personalized digest is that this line exists, and the card hides it.
2. **Venue and date are also buried.** Both live in a single 11px tabular-nums meta line: `NEJM · Published: 2d ago`. A clinical user's primary trust signal (the journal) and the freshness cue are demoted to fine print.
3. **The card aesthetic reads "search result," not "personalized digest."** The product is a curated, hand-picked editorial brief — the visual language should match.

The redesign elevates all three signals (venue, freshness, why-for-you) into co-equal heroes alongside the title, in a row layout that feels like a serious print broadsheet.

---

## Design

### Per-row anatomy

Each `ShowcasePick` becomes a full-width row with this vertical order:

1. **Dateline rule** — a horizontal flex bar across the top of the row, with a `border-bottom` of `border-line-strong` and 12px bottom padding before the title. From left to right:
   - **Venue** in `font-display`, 16px, weight 600, `text-ink`. Truncates with ellipsis if too long; full name in `title=` attribute for hover recovery.
   - **Em-dash separator** in `text-line-strong` (decorative).
   - **Freshness** in sans, 10px, weight 700, `text-accent`, `uppercase`, `tracking-[0.16em]`. Reads `TODAY` / `2 DAYS AGO` / `APR 9, 2026`.
   - **Right-aligned chip label** (`margin-left: auto`) in sans, 9px, weight 700, `text-ink-faint`, `uppercase`, `tracking-[0.16em]`. The angle's category, e.g. "ABLATION".

2. **Title** — `font-display`, 21px, weight 500, `leading-[1.22]`, `tracking-[-0.012em]`, `text-ink`. No truncation; wraps naturally. 14px top margin from the dateline.

3. **"Why for you" margin bracket** — a left-aligned block with a 3px-wide `bg-accent` vertical bar, content padded 16px to its right:
   - **Label** in sans, 10px, weight 700, `text-accent`, `uppercase`, `tracking-[0.16em]`, reading `Why for you` (rendered uppercase via CSS).
   - **Body** in `font-display italic`, 16px, `leading-[1.5]`, `text-ink-soft`. Bounded by the existing 240-char ranker schema cap.
   - 16px top margin from the title.

The whole row is a clickable `<a href={pick.url} target="_blank" rel="noopener noreferrer">` (preserves existing behavior). Visual frame: `bg-bg-elev-1`, `border border-line`, `rounded-2xl`, padding 22px top/bottom and 26px left/right. Hover lifts the row 1px (`hover:-translate-y-[1px]`) and switches border to `border-line-strong`. Transition uses the existing `--dur-sm` / `--ease-out` tokens.

### Empty-venue fallback

When `pick.venue === ''` (the locations-walk fallback in `extractVenue` returned no source), the dateline omits both the venue *and* the em-dash separator. The freshness label becomes the leftmost element. The right-side chip stays. The dateline reads `2 DAYS AGO ··· ABLATION` with no leading dash or "Unknown" string.

### Multi-row container

`ShowcaseLandedState` changes:

- **Drop the grid.** The current `gridCols = picks.length === 1 ? 'grid-cols-1' : ... 'grid-cols-1 md:grid-cols-3'` line is removed. The cells container becomes `flex flex-col gap-3` (12px between rows).
- **Header unchanged.** The "Fresh this week" eyebrow, `headline`, and "N papers scanned across M areas" counter at the top stay exactly as they are.
- **Tracking section unchanged.** The `<ShowcaseTrackingChips>` strip below the rows stays exactly as it is.
- **Stagger entrance animation.** Each row is wrapped in a `motion.div` that fades in (`opacity 0 → 1`) and slides up 4px (`y: 4 → 0`), staggered 80ms per row. Duration 280ms per row, total entrance time for 3 rows ≈ 440ms (160ms stagger + 280ms duration). Uses framer-motion (already a dependency in the file). Reduced motion is handled explicitly via framer-motion's `useReducedMotion()` hook: when it returns `true`, the `y` and `opacity` deltas collapse to zero and the rows appear immediately. Framer-motion does not auto-respect `prefers-reduced-motion` for variant-driven animations, so the global CSS rule in `globals.css:110` is not enough on its own.

### Date helper

`formatPublishedDate` in `ShowcasePickCell.tsx` is **replaced** by `formatPublishedDateline` (single consumer; no other caller of the short form remains after the cell rewrite). Same parsing strategy (UTC midnight comparison) but longer outputs:

- 0 days → `Today`
- 1 day → `Yesterday`
- 2–7 days → `${n} days ago`
- > 7 days, future dates, or non-parseable input → `${MMM} ${d}, ${yyyy}` (e.g. `Apr 9, 2026`)

Function lives inline in `ShowcasePickCell.tsx`, same place `formatPublishedDate` lives now. CSS does the uppercase transform — the function returns title case so the helper stays reusable for any future non-uppercased context.

### Color & typography mapping (real tokens, not the brainstorm rust palette)

| Element | Token / class |
|---|---|
| Row background | `bg-bg-elev-1` |
| Row border | `border-line` |
| Hover border | `border-line-strong` |
| Dateline rule (border-bottom) | `border-line-strong` |
| Venue text | `text-ink`, `font-display` |
| Em-dash separator | `text-line-strong` |
| Freshness text | `text-accent`, sans, uppercase, tracking-wide |
| Chip label (right) | `text-ink-faint`, sans, uppercase, tracking-wide |
| Title | `text-ink`, `font-display` |
| Margin bracket bar | `bg-accent`, 3px wide |
| Why-for-you label | `text-accent`, sans, uppercase, tracking-wide |
| Why-for-you body | `text-ink-soft`, `font-display`, italic |

The accent is **dark emerald** (`oklch(0.38 0.13 155)` in `globals.css`), not the rust I used in the brainstorm mockups. Single accent color story: every emphasis (rule color via the token, label, freshness, bracket, body italic) maps to either ink hierarchy or accent. No second accent.

Dark theme inherits automatically — every token used has both light and dark values defined in `globals.css`.

### Edge cases

- **Long venue name** (e.g. *Proceedings of the National Academy of Sciences of the United States of America*) — `truncate` on a `min-w-0` flex item ellipsizes before the chip is pushed off the row. `title={pick.venue}` exposes the full name on hover.
- **Long title** — no truncation; serif display wraps naturally.
- **Long "why for you"** — no truncation; bounded by the existing 240-char `showcaseRankerSchema` cap (showcase-ranker.ts:23).
- **Mobile / narrow widths** — the dateline is a flex row with `flex-wrap`. When the venue + freshness + chip don't fit horizontally, the right-side chip wraps to the next line via flex's natural wrapping. No media query and no fixed breakpoint — the wrap happens whenever the content needs the space.
- **Reduced motion** — explicit `useReducedMotion()` check from framer-motion in `ShowcaseLandedState.tsx` collapses the row entrance variants to zero deltas. See "Multi-row container" above.

---

## Files touched

- **`src/components/chat/showcase/ShowcasePickCell.tsx`** — full body rewrite. The exported `ShowcasePickCellProps` interface stays identical (`{ pick: ShowcasePick }`). The `formatPublishedDate` function is replaced by `formatPublishedDateline` with the longer outputs documented above. The JSX is fully rewritten to the broadsheet row layout.
- **`src/components/chat/showcase/ShowcaseLandedState.tsx`** — two small edits: (1) remove the `gridCols` constant and use `flex flex-col gap-3` on the cells wrapper; (2) wrap each `<ShowcasePickCell>` in a `motion.div` with the staggered entrance variants. Header, counter, and Tracking section stay untouched.

No data model changes. No new files. No prompt changes. No backend changes. `ShowcasePick` interface in `src/lib/ai/showcase.ts` is unchanged from its current state.

## Out of scope

- **No schema changes.** `ShowcasePick` already has every field the new layout needs.
- **No new tests.** The change is presentation-only. Existing showcase orchestrator tests in `test/showcase.test.ts` cover everything they need to and don't touch markup. Adding render snapshots for the new cell would be churn for marginal value.
- **No prompt changes.** The ranker still produces the same `whyForYou` strings; the schema cap (240 chars) remains the bound.
- **No new design tokens.** Everything maps to existing tokens in `globals.css`.
- **No animation framework swap.** Continues using framer-motion with the same `--ease-out` / `--dur-*` tokens already in use.

## Verification

- **Typecheck.** `npm run typecheck` must pass.
- **Existing tests.** `npm run test` (orchestrator + planner + ranker tests) must pass without modification — the rewrite is markup-only and doesn't touch the orchestrator surface.
- **Manual browser check.** Run `npm run dev`, complete the onboarding flow far enough to fire the showcase tool, and verify:
  - The row stack renders three rows (or however many picks the ranker returned), each with the dateline / title / margin-bracket structure described above.
  - The dateline shows real venue + freshness for typical works.
  - A pick with no venue (find one in the wild via the empty-string fallback, or temporarily force one) renders cleanly with no leading em-dash and no "Unknown venue" string.
  - The staggered entrance plays on first render.
  - Hover lifts each row 1px and swaps the border.
  - The Tracking section below the rows is unchanged.
  - Dark theme renders correctly (toggle via `data-theme="dark"` on the root).

## Open questions

None. The design is fully specified.
