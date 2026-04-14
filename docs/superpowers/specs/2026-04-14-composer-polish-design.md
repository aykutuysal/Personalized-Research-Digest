# Composer polish — the "smart librarian" input

## Problem

The onboarding text input (`src/components/chat/Composer.tsx`) has two visible problems:

1. **Loud focus state.** `focus-within:ring-4 focus-within:ring-accent-ring` produces a 4px emerald glow around the whole input whenever it's focused. Since the input is always focused on landing, the glow dominates the page and makes the UI feel alarmed, not clever.
2. **Vertical misalignment.** The flex row uses `items-end` and the container uses `p-5` / `p-4`. A single-line textarea with `rows={1}` therefore sits pinned to the bottom of the padded box, so the placeholder appears visually *below* the box's center.

The brief is to make the input feel like "a smart librarian who knows everything" — restrained, typographic, confident.

## Scope

Visual polish only. No behavior changes, no prop changes, no data-flow changes. The file `src/components/chat/Composer.tsx` is the only file touched. No new dependencies.

## Design

### Chrome and focus state

- **Resting:** `border border-line-strong` on `bg-bg-elev-1`. Soft shadow for presence without glow:
  `shadow-[0_1px_2px_oklch(0_0_0_/_0.04),_0_8px_24px_-12px_oklch(0_0_0_/_0.10)]`.
- **Focused:** border darkens to `border-ink-soft/50`, and an inset 1px neutral line appears via inset shadow. **No colored ring.** The emerald reserves itself for the caret only.
- **Removed:** `focus-within:ring-4 focus-within:ring-accent-ring` and `focus-within:border-accent/60`.

### Alignment fix

- `flex items-end` → `flex items-center`. Single-line text now sits on the true vertical center of the padded box.
- Textarea gets `leading-[1.55] py-0` so its own height is predictable and doesn't fight the flex container.
- Trade-off: when the textarea auto-grows past several lines, the send button stays centered relative to the full text block rather than aligning to the last line. This is acceptable for this product — research interests rarely span more than 2–3 lines. If this ever looks wrong in practice, switch to `items-end` conditionally on `rows > 1`. Not doing that today.

### Typography — the librarian signal

- **Placeholder:** `font-display italic tracking-[-0.005em] text-ink-faint`. The serif italic is the entire "literary" cue; nothing else is added.
- **Input text:** stays `font-sans` and non-italic. Typed content must be legible.
- **Caret:** `caret-accent` — the quiet emerald tick is the one place accent shows at rest.

### Send button

Two states driven by whether the input has content (`value.trim().length > 0`):

- **Empty / disabled:** transparent background, `text-ink-dim`, `h-9 w-9 rounded-xl`. Reads as a glyph hint, not a CTA.
- **Has content:** `bg-accent text-accent-ink`. Lights up to signal "ready to send".
- **Disabled while thinking:** keeps ghost look, plus `opacity-50`.
- Transitions on both `background-color` and `color` with `duration-[var(--dur-sm)]`.
- Icon sizing stays at `SendHorizontal size={18}`.

### Padding

- Hero: `px-6 py-4` (was `p-5`).
- Docked: `px-5 py-3.5` (was `p-4`).

### What stays

- `rounded-2xl`.
- `motion.div` with `layoutId="rd-composer"` — the hero → docked morph keeps working.
- `autosize` logic, Enter-to-submit, Shift+Enter newline, IME composition guard.
- `size="hero" | "docked"` prop and the existing `sizeCls` pattern. Only the values inside `sizeCls` change.
- All props and the component's public contract.

### What is explicitly rejected

- No keyboard-hint chip next to the input (was in the mockup; reads as clutter).
- No leading icon glyph.
- No gradient or background texture.
- No conditional `items-end`-when-multi-line logic in v1.
- No changes to `ChatShell` or any other component.

## Acceptance

Manual checks in both hero and docked modes, light theme:

1. Focused single-line composer: the placeholder sits on the true vertical center of the box. No colored ring is visible.
2. Serif italic placeholder renders with `font-display`.
3. Caret color is emerald (`var(--accent)`).
4. Send button is transparent + `text-ink-dim` when empty, fills to accent when typing begins, transitions smoothly.
5. `npm run lint`, `npm run typecheck`, and `npm test` all pass.
6. Spot-check the hero → docked morph animation: the `layoutId` transition still works.
