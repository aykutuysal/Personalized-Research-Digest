# Composer Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle `src/components/chat/Composer.tsx` as a calm, typographic "smart librarian" input — fix vertical alignment, drop the loud emerald focus ring, move the librarian signal into typography, and make the send button ghost-at-rest.

**Architecture:** Single-file visual polish. No props, no behavior, no data flow changes. Both hero and docked modes are served by the existing `sizeCls` switch — only the class strings inside that switch change, plus the shared flex and focus classes on the container.

**Tech Stack:** Tailwind CSS v4 (with project tokens in `src/app/globals.css`), React 19, Framer Motion (the `motion.div` with `layoutId="rd-composer"` is kept so the hero → docked morph still animates).

**Spec:** `docs/superpowers/specs/2026-04-14-composer-polish-design.md`

---

## Note on testing

This is a visual-only change with no behavioral delta. There is nothing a unit test can assert that would catch "the focus ring is gone" or "the placeholder is serif italic" — those checks live in the browser and on the eye. The plan therefore does not add Vitest coverage. Verification consists of:

1. `npm run lint` — must pass.
2. `npm run typecheck` — must pass.
3. `npm test` — the existing suite must still pass (no regressions from the edit).
4. `npm run dev` and manually exercise both the hero (`/`) and docked (`/onboarding`) composer in a browser, against the acceptance checks in the spec.

Engineer: **do not** claim the task complete until the browser check has been done against a running dev server. Type-checks verify code correctness, not feature correctness.

---

## Task 1: Fix alignment and strip loud chrome

Removes the `focus-within:ring-4 focus-within:ring-accent-ring`, replaces the resting chrome with a soft neutral shadow, and switches `flex items-end` → `flex items-center` so single-line text sits on the true vertical center. No typography or send-button changes in this task — commit is isolated so the alignment/focus fix can be reverted independently if needed.

**Files:**
- Modify: `src/components/chat/Composer.tsx`

- [ ] **Step 1: Re-read the file to confirm the starting state**

Read `src/components/chat/Composer.tsx`. Confirm that lines 49–70 currently look like this (excerpt):

```tsx
    const sizeCls =
      size === 'hero'
        ? 'max-w-[640px] text-[18px] p-5'
        : 'max-w-[var(--reading-width)] text-[16px] p-4'

    return (
      <motion.div
        layoutId="rd-composer"
        className={`mx-auto w-full ${sizeCls} rounded-2xl bg-bg-elev-1 border border-line focus-within:border-accent/60 focus-within:ring-4 focus-within:ring-accent-ring transition-[border-color,box-shadow] duration-[var(--dur-sm)]`}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="flex items-end gap-3">
          <textarea
            ref={setRef}
            value={value}
            onChange={onInput}
            onKeyDown={onKeyDown}
            rows={1}
            disabled={disabled}
            placeholder={placeholder ?? 'Tell me what you want to track…'}
            className="flex-1 resize-none bg-transparent outline-none placeholder:text-ink-faint"
          />
```

If the file has drifted from this, stop and reconcile before continuing.

- [ ] **Step 2: Update `sizeCls` padding values**

Replace the `sizeCls` block with the new padding (`px-6 py-4` for hero, `px-5 py-3.5` for docked). Use Edit with this exact replacement:

Old:
```tsx
    const sizeCls =
      size === 'hero'
        ? 'max-w-[640px] text-[18px] p-5'
        : 'max-w-[var(--reading-width)] text-[16px] p-4'
```

New:
```tsx
    const sizeCls =
      size === 'hero'
        ? 'max-w-[640px] text-[18px] px-6 py-4'
        : 'max-w-[var(--reading-width)] text-[16px] px-5 py-3.5'
```

- [ ] **Step 3: Update the container className — remove ring, add soft shadow + neutral focus**

Replace the `motion.div` className. The new classes:

- `bg-bg-elev-1` is kept.
- `border border-line` → `border border-line-strong` (slightly firmer at rest).
- Drop `focus-within:border-accent/60` and `focus-within:ring-4 focus-within:ring-accent-ring` entirely.
- Add a resting shadow using arbitrary values (the tokens in `globals.css` don't expose shadow scales):
  `shadow-[0_1px_2px_oklch(0_0_0_/_0.04),_0_8px_24px_-12px_oklch(0_0_0_/_0.10)]`.
- Add a neutral focus state: `focus-within:border-ink-soft/50 focus-within:shadow-[0_0_0_1px_var(--line-strong)_inset,_0_8px_24px_-12px_oklch(0_0_0_/_0.14)]`.
- Extend the transition to include shadow: `transition-[border-color,box-shadow]` already covers it.

Use Edit:

Old:
```tsx
        className={`mx-auto w-full ${sizeCls} rounded-2xl bg-bg-elev-1 border border-line focus-within:border-accent/60 focus-within:ring-4 focus-within:ring-accent-ring transition-[border-color,box-shadow] duration-[var(--dur-sm)]`}
```

New:
```tsx
        className={`mx-auto w-full ${sizeCls} rounded-2xl bg-bg-elev-1 border border-line-strong shadow-[0_1px_2px_oklch(0_0_0_/_0.04),_0_8px_24px_-12px_oklch(0_0_0_/_0.10)] focus-within:border-ink-soft/50 focus-within:shadow-[0_0_0_1px_var(--line-strong)_inset,_0_8px_24px_-12px_oklch(0_0_0_/_0.14)] transition-[border-color,box-shadow] duration-[var(--dur-sm)]`}
```

- [ ] **Step 4: Switch the inner row from `items-end` to `items-center`**

Use Edit:

Old:
```tsx
        <div className="flex items-end gap-3">
```

New:
```tsx
        <div className="flex items-center gap-3">
```

- [ ] **Step 5: Run lint and typecheck**

Run in parallel:
```bash
npm run lint
npm run typecheck
```

Expected: both pass with no new warnings or errors.

If lint complains about the arbitrary-value Tailwind classes, check that the shadow values are wrapped correctly — Tailwind v4 requires underscores in place of spaces inside `[...]`, which the New strings above already use.

- [ ] **Step 6: Start the dev server and visually verify the alignment fix**

```bash
npm run dev
```

In a browser, open `http://localhost:3000/` (hero) and `http://localhost:3000/onboarding` (docked). Confirm:

- The placeholder text sits on the true vertical center of the input box — not below it.
- There is no 4px emerald halo around the input when it's focused.
- The input still has clear presence at rest (soft shadow, firm border).
- The hero → docked transition (click into the onboarding chat) still morphs smoothly via `layoutId="rd-composer"`.

If any of these fail, stop and fix before committing.

- [ ] **Step 7: Commit**

```bash
git add src/components/chat/Composer.tsx
git commit -m "$(cat <<'EOF'
fix(composer): center single-line text, drop loud focus ring

Switches the composer row from items-end to items-center so the
placeholder sits on the true vertical center of the padded box, and
replaces the 4px emerald focus ring with a neutral inset + soft
drop shadow. Padding tightened to px-6 py-4 (hero) / px-5 py-3.5
(docked).
EOF
)"
```

---

## Task 2: Typography and send button

Adds the "librarian" signal (serif italic placeholder, emerald caret) and turns the send button into a ghost-at-rest control that lights up when the user starts typing. This is the polish layer — separate commit so it can be reviewed or reverted independently of the alignment fix in Task 1.

**Files:**
- Modify: `src/components/chat/Composer.tsx`

- [ ] **Step 1: Update the textarea classes — serif italic placeholder, emerald caret**

Find the existing textarea className:

```tsx
            className="flex-1 resize-none bg-transparent outline-none placeholder:text-ink-faint"
```

Use Edit to replace it with:

```tsx
            className="flex-1 resize-none bg-transparent outline-none leading-[1.55] py-0 caret-accent placeholder:font-display placeholder:italic placeholder:tracking-[-0.005em] placeholder:text-ink-faint"
```

Notes for the engineer:
- `leading-[1.55]` and `py-0` make the textarea's own box height predictable so it plays nicely with `items-center` on the parent flex container.
- `caret-accent` relies on Tailwind v4 picking up `--color-accent` from the `@theme` block in `src/app/globals.css` (see lines 80–99 of that file). If the Tailwind build rejects `caret-accent`, substitute `caret-[var(--accent)]` — same effect.
- `placeholder:font-display` routes the placeholder through the `--font-display` token, which is the serif stack defined in `globals.css:179–182`. The typed input text itself stays sans because the default class chain doesn't touch `font-*`.

- [ ] **Step 2: Convert the send button to ghost-at-rest, filled-when-typed**

Locate the current button block (around lines 71–80 of the file before edits):

```tsx
          <button
            type="button"
            onClick={() => !disabled && value.trim().length > 0 && onSubmit()}
            disabled={disabled || value.trim().length === 0}
            aria-label="Send"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-accent-ink transition-transform duration-[var(--dur-xs)] active:scale-[0.95] disabled:opacity-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-accent-ring"
          >
            <SendHorizontal size={18} />
          </button>
```

Replace with a version that computes a `hasContent` flag locally and uses it to switch the background/text colors. Use Edit:

Old:
```tsx
          <button
            type="button"
            onClick={() => !disabled && value.trim().length > 0 && onSubmit()}
            disabled={disabled || value.trim().length === 0}
            aria-label="Send"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-accent-ink transition-transform duration-[var(--dur-xs)] active:scale-[0.95] disabled:opacity-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-accent-ring"
          >
            <SendHorizontal size={18} />
          </button>
```

New:
```tsx
          <button
            type="button"
            onClick={() => !disabled && value.trim().length > 0 && onSubmit()}
            disabled={disabled || value.trim().length === 0}
            aria-label="Send"
            className={`inline-flex h-9 w-9 items-center justify-center rounded-xl transition-[background-color,color,transform] duration-[var(--dur-sm)] active:scale-[0.95] disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring ${
              value.trim().length > 0
                ? 'bg-accent text-accent-ink'
                : 'bg-transparent text-ink-dim'
            }`}
          >
            <SendHorizontal size={18} />
          </button>
```

Notes:
- `h-10 w-10` → `h-9 w-9` so the button visually recedes at rest.
- The `focus-visible:ring-4` is softened to `ring-2` — the keyboard focus ring is kept (accessibility) but is no longer the same weight as the gone-now composer halo.
- `transition-transform` is widened to `transition-[background-color,color,transform]` so the fade-to-accent animates.
- The ternary deliberately uses `value.trim().length > 0`, matching the existing `onClick`/`disabled` logic. Do not refactor this into a `useMemo` — it's a trivial string check per render, not a bottleneck.

- [ ] **Step 3: Run lint, typecheck, and the test suite**

Run in parallel:
```bash
npm run lint
npm run typecheck
npm test
```

Expected: all three pass with no new failures. If `npm test` shows a pre-existing failure unrelated to `Composer.tsx`, note it but do not attempt to fix in this task — confirm by running `git stash && npm test && git stash pop` on a clean tree.

- [ ] **Step 4: Visual verification against the spec acceptance checks**

With the dev server running (`npm run dev`, still running from Task 1 if you left it up), check in the browser:

1. **Hero (`/`), empty state:** placeholder renders in serif italic; send button is transparent with an ink-dim glyph; caret is emerald when the textarea is focused.
2. **Hero, with content:** start typing. The send button fades to the accent fill. Typed text is sans, not italic.
3. **Docked (`/onboarding`), both states:** same checks.
4. **Keyboard focus:** tab to the send button — a 2px accent ring appears on the button itself (but not on the composer container).
5. **Thinking state:** send a message and while the assistant is streaming, confirm the composer is `disabled` and the send button shows `opacity-50` over its current (ghost or filled) state.
6. **Hero → docked morph:** navigate from `/` to `/onboarding` with a message pending. The `layoutId` animation still runs.

If any check fails, iterate in this task — do not commit until all six pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/chat/Composer.tsx
git commit -m "$(cat <<'EOF'
feat(composer): serif italic placeholder, ghost send button

The placeholder now renders with font-display italic to land the
"smart librarian" tone, the caret is emerald (the one place accent
shows at rest), and the send button is a ghost glyph when the input
is empty — it fills to the accent color only once the user starts
typing.
EOF
)"
```

---

## Task 3: Final verification and handoff

A short closing task to make sure nothing regressed and the working tree is clean.

- [ ] **Step 1: Full verification sweep**

Run in parallel:
```bash
npm run lint
npm run typecheck
npm test
```

All three must pass.

- [ ] **Step 2: Confirm the dev server is still healthy**

With `npm run dev` running, load `/` and `/onboarding` one more time and skim for regressions in surrounding UI (MessageList, ThinkingIndicator, ConfigSummary). If anything around the composer looks wrong, stop and investigate — do not hand off a polish task that broke a neighbor.

- [ ] **Step 3: Stop the dev server**

Ctrl-C the `npm run dev` process. No commit for this task.

- [ ] **Step 4: Report done**

Reply to the user with a one-sentence summary of what shipped and a pointer to the two commits created by Tasks 1 and 2. Do not claim success before the browser checks in Tasks 1 and 2 were actually done.
