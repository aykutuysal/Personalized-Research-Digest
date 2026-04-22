# Preview stage sidebar layout fix

Date: 2026-04-21
Status: Design approved, ready for implementation plan

## Problem

The Preview stage renders a 2-column grid (`grid-cols-[280px_1fr]`) where the sidebar occupies the first column at the viewport's far-left edge and the article centers itself inside the flexible second column. Three resulting issues:

1. **Visual detachment.** On any wide viewport the sidebar hugs the left edge while the article floats in the middle, leaving a large whitespace gap between them. The two read as separate page regions rather than a pair.
2. **Internal sidebar scroll.** The `<aside>` fixes its own height to `calc(100dvh - headers)` and sets `overflow-y-auto`, so the sidebar has its own scrollbar independent of the page. Only the page's scroll container (the `flex-1 overflow-y-auto` wrapper in `PreviewStage`) should scroll.
3. **CTA below the fold at short viewports.** Because the sidebar scrolls internally, the "Start my digest →" CTA anchored at the bottom of the sidebar falls out of view at shorter laptop heights, defeating its role as the primary conversion affordance on the stage.

## Goal

Sidebar and article render as a single centered group on the page. The sidebar is `position: sticky` inside the page-level scroll container. No internal scrollbar on the sidebar. All four sidebar sections — the preview note, the stats, the 5 sell bullets, and the CTA — fit entirely in the available viewport height at a 1280×800 floor (most desktop users are at 1080+ height; 1280×800 covers the practical minimum without forcing aggressive content cuts).

Viewport height budget at the 1280×800 floor: `800 − 56 (header) − 48 (breadcrumb) = 696px` available for sidebar content.

## Approach

Two files change. `PreviewStage.tsx` is untouched — its `<div className="flex-1 overflow-y-auto overflow-x-hidden">` wrapper is already the right scroll container and `position: sticky` resolves to it.

### `src/components/stages/PreviewIssueView.tsx` (line 34)

Replace
```tsx
<div className="grid grid-cols-[280px_1fr] max-[900px]:grid-cols-1">
```
with
```tsx
<div className="mx-auto grid max-w-[1040px] grid-cols-[280px_1fr] max-[900px]:max-w-none max-[900px]:grid-cols-1">
```

Effect: the grid is capped at 1040px (matches 280px sidebar + the article's 680px `max-w` + its 96px horizontal padding, with a small gutter). `mx-auto` centers the pair on wide viewports. The `max-[900px]` breakpoint still collapses to a single stacked column on narrow screens; resetting `max-w-none` at that breakpoint prevents the cap from constraining the stacked layout. The article's existing `mx-auto max-w-[680px] px-12 py-11` at line 44 stays as-is.

### `src/components/stages/PreviewSidebar.tsx`

**Line 30 — remove internal scroll, keep sticky and the fixed height anchor:**
```tsx
<aside className="sticky top-0 flex h-[calc(100dvh-var(--header-h)-var(--breadcrumb-h))] flex-col gap-4 border-r border-line bg-bg-elev-1 p-6 pb-5 max-[900px]:static max-[900px]:h-auto">
```

Changes: drop `overflow-y-auto`; `p-7 pb-6` → `p-6 pb-5`; `gap-5` → `gap-4`. `sticky top-0` combined with the fixed height keeps the sidebar pinned inside the page scroll. `mt-auto` on the CTA wrapper (line 56) continues to anchor the CTA to the bottom of the sidebar's fixed-height box.

**Tighten internal spacing so content fits the 696px budget:**

- `StatRow` (line 80): `py-[10px]` → `py-[8px]`; `text-[26px]` → `text-[24px]`. Preserves the visual hierarchy while trimming ~20px across the three stat rows.
- Bullet `<li>` (line 46): `pt-[10px]` → `pt-[8px]`. Saves another ~8px across the five bullets.
- `Block` label (line 72): `mb-[10px]` → `mb-[8px]`. Saves ~6px across the three blocks.

Combined savings ≈ 55px. The current sidebar measures ~750–820px depending on how the five sell bullets wrap at the 224px content width (280 sidebar − 2 × 28 padding); after the trim it should land in the 695–765px range. The 1280×800 target fits the shorter end of that range.

### Fallback behavior

The five sell bullets include one short line ("Daily, weekly, monthly, whenever you want it.") and several 2–3 line bullets. Worst-case wrap — every bullet at 3 lines plus maximum padding — still overflows the 696px budget by ~70px.

If real-viewport testing shows overflow at 1280×800, drop the lowest-priority bullet ("In your inbox, on your schedule."). This frees ~60–70px and is the cleanest recovery, since the cadence story already gets its own real-estate on the Start stage. Do *not* re-introduce `overflow-y-auto` on the sidebar; the internal scrollbar is exactly what this design removes.

## What does not change

- `PreviewStage.tsx` scroll container — already correct.
- `StickyFooterCta` and the `max-[900px]` mobile stacked layout — untouched.
- Copy, number of sidebar sections, and sidebar visual identity (green accent labels, stat typography) — preserved.
- No new CSS variables, no Tailwind config changes.

## Verification

1. `npm run dev`; reach the Preview stage via the onboarding flow.
2. At **1280×800**: all four sidebar sections (intro, stats, five bullets, CTA with helper) are visible without any scroll on the `<aside>`. The CTA sits flush at the bottom of the sidebar. Sidebar and article sit next to each other as a centered group with equal whitespace flanking the left and right.
3. At **1440×900** and **1920×1080**: same structural behavior with more whitespace at the sides of the 1040px centered group.
4. Scrolling the mouse wheel over the article scrolls the page; the sidebar stays pinned (visible below the breadcrumb).
5. Below **900px wide**: layout collapses to the single-column mobile stack; `StickyFooterCta` appears; no regression.
6. `npm run typecheck` and `npm run lint` pass.
