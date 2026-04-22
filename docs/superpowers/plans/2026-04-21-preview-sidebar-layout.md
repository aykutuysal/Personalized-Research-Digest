# Preview Sidebar Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the Preview stage so the sidebar sits next to the article as a centered group, uses `position: sticky` inside the page-level scroll (no internal scrollbar), and shows all four sidebar sections — intro, stats, 5 sell bullets, CTA — without scrolling at a 1280×800 floor.

**Architecture:** Two Tailwind-class edits in two files. `PreviewIssueView.tsx` gets a centered max-width wrapper on the grid. `PreviewSidebar.tsx` drops `overflow-y-auto` and tightens internal spacing (container padding, block gap, stat row padding/size, bullet top padding, block label margin) to fit ~696px of content height. No TypeScript, no new components, no behavioral changes — verification is manual (dev server + devtools viewport resize) plus `typecheck` and `lint`.

**Tech Stack:** Next.js 16, React 19, Tailwind v4 (flat config in `src/app/globals.css`).

Spec: `docs/superpowers/specs/2026-04-21-preview-sidebar-layout-design.md`.

---

## File Structure

**Modify only:**

- `src/components/stages/PreviewIssueView.tsx` — grid wrapper (1 class change on line 34).
- `src/components/stages/PreviewSidebar.tsx` — outer `<aside>` class (line 30), `StatRow` helper (line 80), bullet `<li>` (line 46), `Block` helper (line 72).

**Do not modify:**

- `src/components/stages/PreviewStage.tsx` — the `flex-1 overflow-y-auto overflow-x-hidden` scroll container is already correct; `position: sticky` on the sidebar resolves to it.
- Any CSS variables in `src/app/globals.css`.
- Any copy or the number of sidebar sections.

There are no unit tests for these components (`test/` has no coverage for `stages/`). Verification is visual at specific viewport sizes plus typecheck/lint.

---

### Task 1: Center the sidebar + article as a group

**Files:**
- Modify: `src/components/stages/PreviewIssueView.tsx:34`

- [ ] **Step 1: Read the file to confirm the current line**

Run: Read `src/components/stages/PreviewIssueView.tsx` and confirm line 34 reads:
```tsx
    <div className="grid grid-cols-[280px_1fr] max-[900px]:grid-cols-1">
```
If the text differs, stop and re-sync with the spec before editing.

- [ ] **Step 2: Replace the grid wrapper class**

Use Edit on `src/components/stages/PreviewIssueView.tsx`:

old_string:
```tsx
    <div className="grid grid-cols-[280px_1fr] max-[900px]:grid-cols-1">
```

new_string:
```tsx
    <div className="mx-auto grid max-w-[1040px] grid-cols-[280px_1fr] max-[900px]:max-w-none max-[900px]:grid-cols-1">
```

What this does:
- `mx-auto` centers the grid horizontally inside the scroll container.
- `max-w-[1040px]` caps the grid to the width of sidebar (280) + article column (~760). Wider viewports show equal whitespace on both sides.
- `max-[900px]:max-w-none` clears the cap when the layout collapses to a single stacked column, so the mobile/narrow layout isn't constrained.
- `max-[900px]:grid-cols-1` is preserved from the original.

- [ ] **Step 3: Quick typecheck gate**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/stages/PreviewIssueView.tsx
git commit -m "fix(preview): center sidebar + article as a grouped max-w-[1040px] layout"
```

---

### Task 2: Remove the sidebar's internal scroll and tighten its outer spacing

**Files:**
- Modify: `src/components/stages/PreviewSidebar.tsx:30`

- [ ] **Step 1: Read the file to confirm the current line**

Run: Read `src/components/stages/PreviewSidebar.tsx` and confirm line 30 reads:
```tsx
    <aside className="sticky top-0 flex h-[calc(100dvh-var(--header-h)-var(--breadcrumb-h))] flex-col gap-5 overflow-y-auto border-r border-line bg-bg-elev-1 p-7 pb-6 max-[900px]:static max-[900px]:h-auto">
```
If it differs, stop and re-sync.

- [ ] **Step 2: Replace the `<aside>` class**

Use Edit on `src/components/stages/PreviewSidebar.tsx`:

old_string:
```tsx
    <aside className="sticky top-0 flex h-[calc(100dvh-var(--header-h)-var(--breadcrumb-h))] flex-col gap-5 overflow-y-auto border-r border-line bg-bg-elev-1 p-7 pb-6 max-[900px]:static max-[900px]:h-auto">
```

new_string:
```tsx
    <aside className="sticky top-0 flex h-[calc(100dvh-var(--header-h)-var(--breadcrumb-h))] flex-col gap-4 border-r border-line bg-bg-elev-1 p-6 pb-5 max-[900px]:static max-[900px]:h-auto">
```

Three changes on that line:
- Remove `overflow-y-auto` — the page-level scroll container in `PreviewStage.tsx` is the only scroll now.
- `gap-5` → `gap-4` (20px → 16px between the three content blocks).
- `p-7 pb-6` → `p-6 pb-5` (28px → 24px top/sides; 24px → 20px bottom).

`sticky top-0` and the fixed `h-[calc(100dvh-var(--header-h)-var(--breadcrumb-h))]` are preserved. `mt-auto` on the CTA wrapper (line 56, unchanged) continues to anchor the CTA to the bottom of the sidebar's fixed-height box.

- [ ] **Step 3: Quick typecheck gate**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/stages/PreviewSidebar.tsx
git commit -m "fix(preview): drop sidebar internal scroll and tighten outer padding/gap"
```

---

### Task 3: Tighten the stat rows, bullets, and block labels

**Files:**
- Modify: `src/components/stages/PreviewSidebar.tsx:46` (bullet `<li>`)
- Modify: `src/components/stages/PreviewSidebar.tsx:72` (`Block` label)
- Modify: `src/components/stages/PreviewSidebar.tsx:80` (`StatRow`)

- [ ] **Step 1: Confirm each current line**

Run: Read `src/components/stages/PreviewSidebar.tsx`. Confirm:

- Line 46 contains:
  ```tsx
            <li key={b.lead} className="border-t border-line-strong pt-[10px] text-[12px] leading-[1.5] text-ink-soft first:border-t-0 first:pt-0">
  ```

- Line 72 contains:
  ```tsx
      <div className="mb-[10px] text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">{label}</div>
  ```

- Line 80 contains:
  ```tsx
    <div className="border-t border-line-strong py-[10px] first:border-t-0 first:pt-0">
  ```

- Line 81 contains:
  ```tsx
      <div className="font-display text-[26px] font-medium leading-none tabular-nums text-ink">{n}</div>
  ```

If any of these don't match, stop and re-sync.

- [ ] **Step 2: Trim the bullet top padding**

Use Edit on `src/components/stages/PreviewSidebar.tsx`:

old_string:
```tsx
            <li key={b.lead} className="border-t border-line-strong pt-[10px] text-[12px] leading-[1.5] text-ink-soft first:border-t-0 first:pt-0">
```

new_string:
```tsx
            <li key={b.lead} className="border-t border-line-strong pt-[8px] text-[12px] leading-[1.5] text-ink-soft first:border-t-0 first:pt-0">
```

Saves ~8px across the five bullets (10 → 8 on four top-borders; first bullet keeps `first:pt-0`).

- [ ] **Step 3: Trim the Block label margin**

Use Edit on `src/components/stages/PreviewSidebar.tsx`:

old_string:
```tsx
      <div className="mb-[10px] text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">{label}</div>
```

new_string:
```tsx
      <div className="mb-[8px] text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">{label}</div>
```

Saves ~6px across the three blocks.

- [ ] **Step 4: Trim StatRow vertical padding**

Use Edit on `src/components/stages/PreviewSidebar.tsx`:

old_string:
```tsx
    <div className="border-t border-line-strong py-[10px] first:border-t-0 first:pt-0">
```

new_string:
```tsx
    <div className="border-t border-line-strong py-[8px] first:border-t-0 first:pt-0">
```

- [ ] **Step 5: Shrink the StatRow number size**

Use Edit on `src/components/stages/PreviewSidebar.tsx`:

old_string:
```tsx
      <div className="font-display text-[26px] font-medium leading-none tabular-nums text-ink">{n}</div>
```

new_string:
```tsx
      <div className="font-display text-[24px] font-medium leading-none tabular-nums text-ink">{n}</div>
```

Combined Steps 4–5 save ~20px across the three stat rows while preserving the visual hierarchy (still the largest text in the sidebar by a wide margin).

- [ ] **Step 6: Quick typecheck gate**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/stages/PreviewSidebar.tsx
git commit -m "fix(preview): tighten sidebar stat rows, bullets, and block labels for 1280x800"
```

---

### Task 4: Manual visual verification

**Files:** none modified.

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`
Open: the URL it prints (typically `http://localhost:3000`).

- [ ] **Step 2: Reach the Preview stage**

Navigate to `/onboarding`, complete the chat steps enough to reach the Preview (or use the test harness/fixture path the team already uses). Wait for the preview to finish streaming in.

- [ ] **Step 3: Check 1280×800 (the target floor)**

In Chromium devtools, set the viewport to **1280×800** exactly.

Verify all of:
- Sidebar and article sit side-by-side, centered as a group. Whitespace flanks both sides of the group, not only the right.
- Sidebar shows, in order: the intro paragraph, three stat rows (700 / 10 / 5), all five sell-bullet items, and the green "Start my digest →" CTA with its italic helper line.
- No scrollbar on the `<aside>` itself. (Inspect: the `<aside>` has no `overflow-y-auto`.)
- Scrolling the mouse wheel scrolls the article; the sidebar stays pinned below the breadcrumb.

**If the CTA is clipped at the bottom of the sidebar at 1280×800:** apply the spec's fallback — drop the fifth sell bullet (`"In your inbox, on your schedule."`) from `SELL_BULLETS` in `src/components/stages/PreviewSidebar.tsx:13–19`. Commit separately:

```bash
git add src/components/stages/PreviewSidebar.tsx
git commit -m "fix(preview): drop fifth sell bullet to fit 1280x800 sidebar budget"
```

Do NOT re-introduce `overflow-y-auto` on the sidebar.

- [ ] **Step 4: Check 1440×900 and 1920×1080**

Resize the viewport to 1440×900, then 1920×1080. Confirm:
- Same structural behavior.
- The centered group stays at ~1040px wide; extra space appears as equal whitespace on both sides.
- The sidebar stays sticky while the article scrolls.

- [ ] **Step 5: Check the narrow breakpoint**

Resize the viewport width below 900px (e.g. 800×1000). Confirm:
- The grid collapses to a single stacked column (sidebar above the article).
- The mobile `StickyFooterCta` appears at the bottom of the viewport.
- The centered max-width does not constrain this stacked layout.

- [ ] **Step 6: Lint gate**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 7: Typecheck gate**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 8: Commit (only if the fallback in Step 3 was applied)**

If you already committed the fallback in Step 3, this step is a no-op. Otherwise nothing to commit here — Tasks 1–3 are the only commits required.

---

## Self-Review

Spec coverage check — each spec requirement maps to a task:

| Spec requirement | Task |
|---|---|
| Sidebar + article as a centered group (grid `max-w-[1040px]` + `mx-auto`) | Task 1 |
| `max-[900px]:max-w-none` so stacked layout isn't constrained | Task 1 |
| Remove `overflow-y-auto` on `<aside>` | Task 2 |
| Keep `sticky top-0` + fixed height | Task 2 (preserved, not removed) |
| `p-7 pb-6` → `p-6 pb-5`; `gap-5` → `gap-4` | Task 2 |
| `StatRow` `py-[10px]` → `py-[8px]`; `text-[26px]` → `text-[24px]` | Task 3 (Steps 4–5) |
| Bullet `pt-[10px]` → `pt-[8px]` | Task 3 (Step 2) |
| `Block` label `mb-[10px]` → `mb-[8px]` | Task 3 (Step 3) |
| Fallback: drop fifth bullet if viewport overflows | Task 4 (Step 3 conditional) |
| Visual verification at 1280×800 / 1440×900 / 1920×1080 / <900px | Task 4 |
| `npm run typecheck` and `npm run lint` pass | Task 4 (Steps 6–7); typecheck gates also in Tasks 1–3 |

No placeholders; every edit step shows exact old/new strings. Class names used in later tasks match the names they replace in earlier tasks. `PreviewStage.tsx` is intentionally untouched and the plan says so in the File Structure section.
