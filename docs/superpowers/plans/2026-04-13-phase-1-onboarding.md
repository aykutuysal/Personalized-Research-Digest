# Phase 1 — Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Next.js 16 app with a light-default, dark-emerald-accent UI where an anonymous user lands on a hero chat, smoothly morphs into a bottom-docked onboarding conversation, talks to a streaming DeepSeek agent that proposes angles, normalizes a cron schedule, runs an OpenAlex corpus-sanity check, and assembles a Zod-validated `DigestConfig` with a downloadable JSON.

**Architecture:** Greenfield Next.js 16 (App Router) scaffold at `/home/aykut/dev/workspace/ResearchDigest`. One `/api/onboarding-chat` Node-runtime route powered by Vercel AI SDK 6 + `@openrouter/ai-sdk-provider` → `deepseek/deepseek-v3.2`, with four tools (`proposeAngles`, `normalizeSchedule`, `corpusSanityCheck`, `generateConfig`). One `ChatShell` React component that owns both hero and docked modes via Framer Motion `layoutId` shared-element. Anonymous state in `rd_session` cookie + typed `rd:onboarding:v1` localStorage — no DB, no auth. All design tokens live as CSS custom properties wired into Tailwind 4 `@theme` so polish iterations edit tokens only. Pure-logic units (Zod schema, OpenAlex client, schedule normalizer, sanity-check math) get full Vitest TDD; UI components are verified manually per the spec's §7/§8.

**Tech Stack:** Next.js 16 (App Router, Node runtime), TypeScript 5 strict, Tailwind CSS 4, Vitest 4, Vercel AI SDK 6 (`ai` + `@ai-sdk/react`), `@openrouter/ai-sdk-provider`, Zod 4, Framer Motion, `cron-parser`, `cronstrue`, `lucide-react`, `next/font` (Instrument Serif + Inter + JetBrains Mono).

**Source spec:** `docs/superpowers/specs/2026-04-13-phase-1-onboarding-design.md`

**Source PRD:** `docs/2026-04-13-PRD.md` (§5.1 config schema, §7 onboarding agent, §10 frontend)

---

## Ground rules for the executor

- **Test-first for pure logic.** Zod schema, URL builder, schedule normalizer, sanity-check math, tool execute functions: write the failing test, run it red, implement, run it green, commit.
- **Manual verification for UI.** Phase 1 explicitly does not ship jsdom/RTL component tests (spec §7.2). UI tasks end with a browser smoke check and a commit.
- **Tokens only.** Components never reference hex literals or default Tailwind colors. Only the CSS custom properties mapped via `@theme`. A grep for `#[0-9a-fA-F]{3,6}` in `src/components/**` should return nothing by the end.
- **Portable.** No Vercel- or Cloudflare-specific APIs. The route is explicit `runtime = 'nodejs'`. Deployment target stays deferred.
- **Verify SDK surfaces with context7.** At the start of Task 22 (and again at any later AI-SDK-touching task if in doubt), use the `context7` MCP to pull current Vercel AI SDK 6 + `@ai-sdk/react` + `@openrouter/ai-sdk-provider` docs. The event/part names used in this plan (`toolCallStreaming`, `streamText`, `toDataStreamResponse`, tool-call parts) are intended as the semantic contract — confirm the exact API against current docs before writing code.
- **Commit per task.** Every task ends with a git commit. Commit messages follow the `<type>: <subject>` convention used here.
- **Greenfield project, no existing code.** The first task initializes git.

---

## File structure (final shape)

Matches spec §3. Grouped for reference so later tasks can point at exact paths.

```
ResearchDigest/
├── docs/                              # existing
├── prompts/
│   ├── onboarding-system.md
│   └── propose-angles-system.md
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                   # landing
│   │   ├── onboarding/page.tsx
│   │   └── api/onboarding-chat/route.ts
│   ├── components/
│   │   ├── chat/
│   │   │   ├── ChatShell.tsx
│   │   │   ├── Composer.tsx
│   │   │   ├── MessageList.tsx
│   │   │   ├── MessageBubble.tsx
│   │   │   ├── ThinkingIndicator.tsx
│   │   │   ├── ToolCallCard.tsx
│   │   │   ├── AngleProposalCard.tsx
│   │   │   ├── ScheduleCard.tsx
│   │   │   └── SanityCheckCard.tsx
│   │   ├── config/ConfigSummary.tsx
│   │   └── ui/
│   │       ├── Button.tsx
│   │       ├── Card.tsx
│   │       ├── Chip.tsx
│   │       └── ThemeToggle.tsx
│   ├── lib/
│   │   ├── config-schema.ts
│   │   ├── openalex/{client.ts,abstract.ts}
│   │   ├── ai/{openrouter.ts,onboarding-tools.ts,propose-angles.ts}
│   │   ├── schedule/{cron.ts,timezone.ts}
│   │   ├── session.ts
│   │   ├── theme.ts
│   │   └── storage/local.ts
│   └── styles/globals.css
├── test/
│   ├── fixtures/profiles/*.json
│   ├── config-schema.test.ts
│   ├── schedule.test.ts
│   ├── corpus-sanity.test.ts
│   ├── openalex-client.test.ts
│   └── tools.test.ts
├── .env.local.example
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── next.config.ts
```

---

## Task index

1. Scaffold Next.js 16 + git init
2. Install runtime + test dependencies
3. Configure Vitest 4 and TS path aliases
4. Design tokens + `@theme` in `globals.css`
5. Fonts + root layout
6. Theme system + `ThemeToggle`
7. Button primitive
8. Card + Chip primitives
9. `digestConfigSchema` (Zod) + port iter fixtures
10. OpenAlex client: URL builder + fetch with retries
11. OpenAlex abstract reconstruction
12. Schedule timezone helper (city → IANA)
13. Schedule cron normalizer (parse + describe + nextFires)
14. Session cookie helper
15. Typed localStorage helper
16. OpenRouter provider factory
17. `normalizeSchedule` tool
18. `generateConfig` tool
19. `propose-angles` inner call + prompt
20. `proposeAngles` tool
21. `corpusSanityCheck` tool
22. Verify AI SDK v6 surface via context7 + onboarding system prompt
23. `/api/onboarding-chat` route
24. `ChatShell` + `Composer` (hero mode wiring)
25. Landing page `/`
26. `MessageList` + `MessageBubble`
27. `ThinkingIndicator` (reading cursor)
28. Onboarding page `/onboarding` + hero→docked morph + top-anchored scroll
29. `ToolCallCard` generic shell
30. `AngleProposalCard` + `ScheduleCard`
31. `SanityCheckCard` (auto-expand on warning)
32. Wire tool parts into `MessageList` rendering
33. `ConfigSummary` + download JSON
34. End-to-end manual verification + cost check

---

## Task 1: Scaffold Next.js 16 + git init

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `src/app/layout.tsx`, `src/app/page.tsx`, `postcss.config.mjs`, `.gitignore`, `.env.local.example`, `src/styles/globals.css`

- [ ] **Step 1: Initialize git repo**

Run from project root:

```bash
cd /home/aykut/dev/workspace/ResearchDigest
git init
git add docs/
git commit -m "chore: initial commit with PRD and brief"
```

- [ ] **Step 2: Scaffold Next.js 16 in-place**

Run:

```bash
cd /home/aykut/dev/workspace/ResearchDigest
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --turbo --no-import-alias --use-npm
```

When prompted about overwriting `.gitignore` or existing files, accept. When asked for Turbopack and `src/` directory, accept. When asked to customize the import alias, say no (we'll set `@/*` explicitly in the next step).

Verify the scaffold:

```bash
ls src/app && ls src/
```

Expected: `layout.tsx  page.tsx  globals.css` under `src/app/`, and `src/app/` directory exists.

- [ ] **Step 3: Create `.env.local.example`**

```bash
cat > .env.local.example <<'EOF'
# Required — OpenRouter API key for DeepSeek v3.2
OPENROUTER_API_KEY=

# Required — your email for OpenAlex polite pool
OPENALEX_MAILTO=

# Optional — OpenAlex API key for higher rate limits
OPENALEX_API_KEY=
EOF
cp .env.local.example .env.local
```

Edit `.env.local` and fill in real values for `OPENROUTER_API_KEY` and `OPENALEX_MAILTO` before running `npm run dev` later.

- [ ] **Step 4: Set the `@/*` path alias**

Edit `tsconfig.json` — replace the `"paths"` block (or add one if missing):

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "src/**/*.ts", "src/**/*.tsx", "test/**/*.ts", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 5: Smoke test the scaffold**

```bash
npm run dev
```

Expected: server boots on `http://localhost:3000`, the default Next.js welcome page renders without type errors in the terminal. Stop the dev server (Ctrl+C).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js 16 app with TypeScript + Tailwind 4"
```

---

## Task 2: Install runtime + test dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install runtime dependencies**

```bash
npm install ai @ai-sdk/react @openrouter/ai-sdk-provider zod framer-motion cron-parser cronstrue lucide-react
```

- [ ] **Step 2: Install dev dependencies**

```bash
npm install -D vitest @vitest/ui @types/node
```

- [ ] **Step 3: Verify installs resolved**

```bash
npm ls ai @ai-sdk/react @openrouter/ai-sdk-provider zod framer-motion cron-parser cronstrue lucide-react vitest
```

Expected: every package listed without "missing" warnings. Note the installed versions so the rest of the plan can reference them.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add AI SDK, Zod, Framer Motion, schedule, and test deps"
```

---

## Task 3: Configure Vitest 4 and scripts

**Files:**
- Create: `vitest.config.ts`, `test/.gitkeep`
- Modify: `package.json`

- [ ] **Step 1: Create `vitest.config.ts`**

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    globals: false,
    clearMocks: true,
  },
})
```

- [ ] **Step 2: Add scripts to `package.json`**

Edit `package.json` `"scripts"` block to:

```json
{
  "scripts": {
    "dev": "next dev --turbo",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 3: Create the test directory stub**

```bash
mkdir -p test && touch test/.gitkeep
```

- [ ] **Step 4: Write a sanity test**

Create `test/sanity.test.ts`:

```ts
// test/sanity.test.ts
import { describe, it, expect } from 'vitest'

describe('vitest sanity', () => {
  it('adds', () => {
    expect(1 + 1).toBe(2)
  })
})
```

- [ ] **Step 5: Run the sanity test**

```bash
npm run test
```

Expected: `1 passed`. If it fails, fix the config before proceeding.

- [ ] **Step 6: Remove the sanity test and commit**

```bash
rm test/sanity.test.ts
git add -A
git commit -m "chore: configure Vitest 4 and npm scripts"
```

---

## Task 4: Design tokens + `@theme` wiring

**Files:**
- Modify: `src/app/globals.css` (replace contents entirely)

- [ ] **Step 1: Overwrite `src/app/globals.css` with the token contract**

```css
@import "tailwindcss";

/* =========================================================
   Design tokens — single source of truth.
   Polish iterations edit these only, never component markup.
   ========================================================= */

:root,
[data-theme="light"] {
  /* Surfaces — warm off-white, layered lightly */
  --bg:         oklch(0.985 0.008 85);
  --bg-elev-1:  oklch(0.965 0.010 85);
  --bg-elev-2:  oklch(0.935 0.012 85);
  --bg-overlay: oklch(0.98 0.008 85 / 0.80);

  /* Ink — warm near-black */
  --ink:        oklch(0.185 0.012 85);
  --ink-soft:   oklch(0.34 0.010 85);
  --ink-dim:    oklch(0.50 0.008 85);
  --ink-faint:  oklch(0.66 0.006 85);

  /* Accent — dark emerald */
  --accent:        oklch(0.38 0.13 155);
  --accent-hover:  oklch(0.44 0.14 155);
  --accent-ink:    oklch(0.985 0.012 155);
  --accent-soft:   oklch(0.38 0.13 155 / 0.10);
  --accent-ring:   oklch(0.52 0.15 155 / 0.40);

  /* Feedback */
  --warn:       oklch(0.66 0.15 72);
  --warn-soft:  oklch(0.66 0.15 72 / 0.14);
  --danger:     oklch(0.56 0.18 27);

  /* Borders */
  --line:         oklch(0.88 0.010 85);
  --line-strong:  oklch(0.80 0.012 85);
}

[data-theme="dark"] {
  --bg:         oklch(0.14 0.012 150);
  --bg-elev-1:  oklch(0.18 0.014 150);
  --bg-elev-2:  oklch(0.22 0.015 150);
  --bg-overlay: oklch(0.10 0.010 150 / 0.72);

  --ink:        oklch(0.96 0.015 85);
  --ink-soft:   oklch(0.84 0.012 85);
  --ink-dim:    oklch(0.62 0.010 85);
  --ink-faint:  oklch(0.42 0.008 85);

  --accent:        oklch(0.56 0.15 155);
  --accent-hover:  oklch(0.64 0.16 155);
  --accent-ink:    oklch(0.10 0.010 150);
  --accent-soft:   oklch(0.56 0.15 155 / 0.18);
  --accent-ring:   oklch(0.72 0.16 155 / 0.45);

  --warn:       oklch(0.74 0.13 75);
  --warn-soft:  oklch(0.74 0.13 75 / 0.15);
  --danger:     oklch(0.62 0.18 27);

  --line:         oklch(0.24 0.013 150);
  --line-strong:  oklch(0.32 0.014 150);
}

:root {
  /* Motion (theme-independent) */
  --ease-out:   cubic-bezier(0.2, 0.7, 0.2, 1);
  --ease-morph: cubic-bezier(0.22, 1, 0.36, 1);
  --dur-xs: 120ms;
  --dur-sm: 180ms;
  --dur-md: 280ms;
  --dur-lg: 450ms;

  /* Layout */
  --reading-width: 64ch;
  --header-h: 56px;
  --composer-h: 88px;
  --safe-bottom: env(safe-area-inset-bottom, 0px);
}

@theme {
  --color-bg:           var(--bg);
  --color-bg-elev-1:    var(--bg-elev-1);
  --color-bg-elev-2:    var(--bg-elev-2);
  --color-bg-overlay:   var(--bg-overlay);
  --color-ink:          var(--ink);
  --color-ink-soft:     var(--ink-soft);
  --color-ink-dim:      var(--ink-dim);
  --color-ink-faint:    var(--ink-faint);
  --color-accent:       var(--accent);
  --color-accent-hover: var(--accent-hover);
  --color-accent-ink:   var(--accent-ink);
  --color-accent-soft:  var(--accent-soft);
  --color-accent-ring:  var(--accent-ring);
  --color-warn:         var(--warn);
  --color-warn-soft:    var(--warn-soft);
  --color-danger:       var(--danger);
  --color-line:         var(--line);
  --color-line-strong:  var(--line-strong);
}

/* Base resets */
html, body {
  background: var(--bg);
  color: var(--ink);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0ms !important;
    transition-duration: 0ms !important;
  }
}

/* Reading-cursor thinking animation — consumed by ThinkingIndicator */
@keyframes rd-reading-cursor {
  0%   { transform: translateX(-4%); opacity: 0.7; }
  50%  { opacity: 1; }
  100% { transform: translateX(104%); opacity: 0.7; }
}
```

- [ ] **Step 2: Visual smoke test**

```bash
npm run dev
```

Open `http://localhost:3000`. Expected: page background is warm cream (not pure white), text is warm near-black. The default Next.js welcome page is still there but the colors have shifted. Stop the dev server.

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "feat(design): add light+dark token contract and Tailwind @theme wiring"
```

---

## Task 5: Fonts + root layout

**Files:**
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Rewrite `src/app/layout.tsx`**

```tsx
// src/app/layout.tsx
import type { Metadata } from 'next'
import { Instrument_Serif, Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'

const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-display',
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

const jetBrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Research Digest',
  description: 'A research digest, written for you.',
}

const themeInitScript = `
(function(){
  try {
    var t = localStorage.getItem('rd:theme');
    if (t !== 'dark' && t !== 'light') t = 'light';
    document.documentElement.setAttribute('data-theme', t);
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();
`

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${instrumentSerif.variable} ${inter.variable} ${jetBrainsMono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="font-sans bg-bg text-ink antialiased">
        {children}
      </body>
    </html>
  )
}
```

- [ ] **Step 2: Add the font-variable utility classes in `globals.css`**

Append to `src/app/globals.css`:

```css
@theme {
  --font-sans: var(--font-sans), ui-sans-serif, system-ui, sans-serif;
  --font-display: var(--font-display), ui-serif, Georgia, serif;
  --font-mono: var(--font-mono), ui-monospace, SFMono-Regular, Menlo, monospace;
}
```

- [ ] **Step 3: Smoke test**

```bash
npm run dev
```

Open `http://localhost:3000`. Expected: body text renders in Inter, not the system default. Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add src/app/layout.tsx src/app/globals.css
git commit -m "feat(design): load Instrument Serif + Inter + JetBrains Mono and FOUC-block theme"
```

---

## Task 6: Theme system + `ThemeToggle`

**Files:**
- Create: `src/lib/theme.ts`, `src/components/ui/ThemeToggle.tsx`

- [ ] **Step 1: Create `src/lib/theme.ts`**

```ts
// src/lib/theme.ts
export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'rd:theme'

export function getTheme(): Theme {
  if (typeof document === 'undefined') return 'light'
  const attr = document.documentElement.getAttribute('data-theme')
  return attr === 'dark' ? 'dark' : 'light'
}

export function setTheme(next: Theme): void {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute('data-theme', next)
  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch {
    /* storage blocked — ignore */
  }
}

export function toggleTheme(): Theme {
  const next: Theme = getTheme() === 'dark' ? 'light' : 'dark'
  setTheme(next)
  return next
}
```

- [ ] **Step 2: Create `src/components/ui/ThemeToggle.tsx`**

```tsx
// src/components/ui/ThemeToggle.tsx
'use client'

import { useEffect, useState } from 'react'
import { Sun, Moon } from 'lucide-react'
import { getTheme, toggleTheme, type Theme } from '@/lib/theme'

export function ThemeToggle() {
  const [theme, setLocalTheme] = useState<Theme>('light')

  useEffect(() => {
    setLocalTheme(getTheme())
  }, [])

  const onClick = () => {
    setLocalTheme(toggleTheme())
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      className="inline-flex h-9 w-9 items-center justify-center rounded-md text-ink-soft transition-colors duration-[var(--dur-sm)] hover:bg-accent-soft hover:text-ink focus:outline-none focus-visible:ring-4 focus-visible:ring-accent-ring"
    >
      {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  )
}
```

- [ ] **Step 3: Wire the toggle into the default landing page for smoke test**

Open `src/app/page.tsx` and replace its entire contents:

```tsx
// src/app/page.tsx
import { ThemeToggle } from '@/components/ui/ThemeToggle'

export default function Home() {
  return (
    <main className="min-h-dvh p-8">
      <div className="flex justify-end">
        <ThemeToggle />
      </div>
      <div className="mt-16 text-center">
        <p className="font-display text-5xl">Research Digest</p>
        <p className="mt-4 text-ink-soft">Theme toggle smoke test — Task 6.</p>
      </div>
    </main>
  )
}
```

- [ ] **Step 4: Manual smoke test**

```bash
npm run dev
```

Open `http://localhost:3000`. Click the toggle in the top-right. Expected:
- Background flips cream ↔ near-black, text flips accordingly.
- Refresh: the chosen theme persists.
- Initial load: no flash of the wrong theme (FOUC script works).
- DevTools > Application > Local Storage: `rd:theme` key shows `light` or `dark`.

Stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add src/lib/theme.ts src/components/ui/ThemeToggle.tsx src/app/page.tsx
git commit -m "feat(design): add theme toggle with localStorage persistence"
```

---

## Task 7: Button primitive

**Files:**
- Create: `src/components/ui/Button.tsx`

- [ ] **Step 1: Write `src/components/ui/Button.tsx`**

```tsx
// src/components/ui/Button.tsx
import { forwardRef, type ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'ghost'
type Size = 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

const base =
  'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-[background-color,color,transform] duration-[var(--dur-sm)] focus:outline-none focus-visible:ring-4 focus-visible:ring-accent-ring active:scale-[0.97] disabled:opacity-60 disabled:pointer-events-none'

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-accent-ink hover:bg-accent-hover',
  ghost: 'bg-transparent text-ink-soft hover:bg-accent-soft hover:text-ink',
}

const sizes: Record<Size, string> = {
  md: 'h-10 px-4 text-[15px]',
  lg: 'h-12 px-6 text-[16px]',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', className = '', ...rest }, ref) => {
    return (
      <button
        ref={ref}
        className={`${base} ${variants[variant]} ${sizes[size]} ${className}`.trim()}
        {...rest}
      />
    )
  },
)

Button.displayName = 'Button'
```

- [ ] **Step 2: Smoke test**

Temporarily add to `src/app/page.tsx` below the title:

```tsx
import { Button } from '@/components/ui/Button'

// ...inside the return, after the title <p>:
<div className="mt-8 flex justify-center gap-3">
  <Button variant="primary">Primary</Button>
  <Button variant="ghost">Ghost</Button>
</div>
```

Run `npm run dev`, open `/`. Expected: primary button is emerald with cream ink, ghost is transparent with subtle hover tint, press scales down briefly, Tab → focus ring appears. Stop the dev server.

- [ ] **Step 3: Revert the smoke-test changes to `src/app/page.tsx`**

Remove the Button import and the temporary `<div>` with the buttons. Leave the file as it was after Task 6.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/Button.tsx
git commit -m "feat(ui): add Button primitive (primary + ghost)"
```

---

## Task 8: Card + Chip primitives

**Files:**
- Create: `src/components/ui/Card.tsx`, `src/components/ui/Chip.tsx`

- [ ] **Step 1: Write `src/components/ui/Card.tsx`**

```tsx
// src/components/ui/Card.tsx
import type { HTMLAttributes } from 'react'

export function Card({ className = '', ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`bg-bg-elev-1 border border-line rounded-xl p-5 ${className}`.trim()}
      {...rest}
    />
  )
}
```

- [ ] **Step 2: Write `src/components/ui/Chip.tsx`**

```tsx
// src/components/ui/Chip.tsx
import type { HTMLAttributes } from 'react'

export function Chip({ className = '', ...rest }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={`inline-flex items-center rounded-md bg-bg-elev-2 px-2 py-1 text-[12px] font-medium uppercase tracking-wider text-ink-dim ${className}`.trim()}
      {...rest}
    />
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/Card.tsx src/components/ui/Chip.tsx
git commit -m "feat(ui): add Card and Chip primitives"
```

---

## Task 9: `digestConfigSchema` (Zod) + port iter fixtures

**Files:**
- Create: `src/lib/config-schema.ts`, `test/config-schema.test.ts`, `test/fixtures/profiles/{llm_agents,marketing,afib,adolescent_depression}.angles.json`

- [ ] **Step 1: Copy the 4 iter angle fixtures**

```bash
mkdir -p test/fixtures/profiles
cp /home/aykut/dev/workspace/actionbook-test/iter/profiles/llm_agents.angles.json test/fixtures/profiles/
cp /home/aykut/dev/workspace/actionbook-test/iter/profiles/marketing.angles.json test/fixtures/profiles/
cp /home/aykut/dev/workspace/actionbook-test/iter/profiles/afib.angles.json test/fixtures/profiles/
cp /home/aykut/dev/workspace/actionbook-test/iter/profiles/adolescent_depression.angles.json test/fixtures/profiles/
ls test/fixtures/profiles/
```

Expected: four `.angles.json` files listed.

- [ ] **Step 2: Write the failing test**

Create `test/config-schema.test.ts`:

```ts
// test/config-schema.test.ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { digestConfigSchema, angleSchema } from '@/lib/config-schema'

const now = '2026-04-13T12:00:00.000Z'

const validConfig = {
  subject: 'Atrial fibrillation',
  schedule: {
    cron: '0 9 * * 1',
    timezone: 'Europe/Istanbul',
    description: 'Every Monday at 9:00 AM',
  },
  volume_target: 15,
  profile: 'Clinical cardiologist tracking AF evidence. No basic science.',
  output_style: 'Clinical implications per paper, concise summaries, sections: Summary, Evidence Updates, Watch List.',
  core_angles: [
    { id: 1, text: 'Catheter ablation techniques and outcomes', status: 'core', priority: 'high' },
    { id: 2, text: 'Anticoagulation choices (DOAC selection, bleeding risk)', status: 'core', priority: 'normal' },
  ],
  search_queries: [],
  version: 1,
  created_at: now,
  updated_at: now,
}

describe('digestConfigSchema', () => {
  it('accepts a fully valid config', () => {
    const r = digestConfigSchema.safeParse(validConfig)
    expect(r.success).toBe(true)
  })

  it('rejects empty subject', () => {
    const r = digestConfigSchema.safeParse({ ...validConfig, subject: '' })
    expect(r.success).toBe(false)
  })

  it('rejects missing schedule', () => {
    const bad = { ...validConfig } as Record<string, unknown>
    delete bad.schedule
    const r = digestConfigSchema.safeParse(bad)
    expect(r.success).toBe(false)
  })

  it('rejects volume_target below 3', () => {
    const r = digestConfigSchema.safeParse({ ...validConfig, volume_target: 2 })
    expect(r.success).toBe(false)
  })

  it('rejects volume_target above 40', () => {
    const r = digestConfigSchema.safeParse({ ...validConfig, volume_target: 41 })
    expect(r.success).toBe(false)
  })

  it('rejects empty core_angles', () => {
    const r = digestConfigSchema.safeParse({ ...validConfig, core_angles: [] })
    expect(r.success).toBe(false)
  })

  it('rejects invalid angle status', () => {
    const r = angleSchema.safeParse({ id: 1, text: 'x', status: 'weird' })
    expect(r.success).toBe(false)
  })

  it('defaults angle status to core and priority to normal', () => {
    const r = angleSchema.parse({ id: 1, text: 'x' })
    expect(r.status).toBe('core')
    expect(r.priority).toBe('normal')
  })

  for (const profile of [
    'llm_agents',
    'marketing',
    'afib',
    'adolescent_depression',
  ] as const) {
    it(`validates ported ${profile} angles fixture shape`, () => {
      const raw = JSON.parse(
        readFileSync(
          resolve(__dirname, `fixtures/profiles/${profile}.angles.json`),
          'utf8',
        ),
      ) as unknown

      // The fixture is a raw angle list (the iter format) — we assert the
      // shape round-trips through angleSchema after normalization.
      const angles = Array.isArray(raw) ? raw : (raw as { angles?: unknown[] }).angles
      expect(Array.isArray(angles)).toBe(true)
      const normalized = (angles as Array<Record<string, unknown>>).map((a, i) => ({
        id: typeof a.id === 'number' ? a.id : i + 1,
        text: String(a.text ?? a.angle ?? ''),
        status: 'core' as const,
        priority: 'normal' as const,
      }))
      for (const a of normalized) {
        expect(angleSchema.safeParse(a).success).toBe(true)
      }
      expect(normalized.length).toBeGreaterThan(0)
    })
  }
})
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
npm run test -- test/config-schema.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/config-schema'`.

- [ ] **Step 4: Create `src/lib/config-schema.ts`**

```ts
// src/lib/config-schema.ts
import { z } from 'zod'

export const angleSchema = z.object({
  id: z.number().int().min(1),
  text: z.string().min(1),
  status: z.enum(['core', 'proposed', 'rejected']).default('core'),
  priority: z.enum(['high', 'normal', 'low']).default('normal'),
})

export const scheduleSchema = z.object({
  cron: z.string().min(1),
  timezone: z.string().min(1),
  description: z.string().min(1),
})

export const digestConfigSchema = z.object({
  // Structured — operational
  subject: z.string().min(1),
  schedule: scheduleSchema,
  volume_target: z.number().int().min(3).max(40),

  // Free text — used by LLMs
  profile: z.string().min(1),
  output_style: z.string().min(1),

  // Structured — retrieval contract
  core_angles: z.array(angleSchema).min(1),

  // Optional — power-user escape hatch
  search_queries: z.array(z.string()).default([]),

  // Metadata
  version: z.number().int().min(1),
  created_at: z.string().min(1),
  updated_at: z.string().min(1),
})

export type Angle = z.infer<typeof angleSchema>
export type Schedule = z.infer<typeof scheduleSchema>
export type DigestConfig = z.infer<typeof digestConfigSchema>
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
npm run test -- test/config-schema.test.ts
```

Expected: all tests pass (at least 12 passing — 8 direct + 4 fixture-parameterized).

- [ ] **Step 6: Commit**

```bash
git add src/lib/config-schema.ts test/config-schema.test.ts test/fixtures/profiles/
git commit -m "feat(schema): add digestConfigSchema and port iter angle fixtures"
```

---

## Task 10: OpenAlex client — URL builder + fetch with retries

**Files:**
- Create: `src/lib/openalex/client.ts`, `test/openalex-client.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/openalex-client.test.ts`:

```ts
// test/openalex-client.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { buildSearchUrl, searchByKeyword } from '@/lib/openalex/client'

const MAILTO = 'test@example.com'

beforeEach(() => {
  process.env.OPENALEX_MAILTO = MAILTO
  delete process.env.OPENALEX_API_KEY
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('buildSearchUrl', () => {
  it('includes search, filter, pagination, mailto, and type filter', () => {
    const url = buildSearchUrl({
      query: '"catheter ablation" AND afib',
      fromDate: '2026-03-14',
      toDate: '2026-04-13',
      perPage: 25,
      page: 1,
    })
    expect(url).toContain('https://api.openalex.org/works?')
    expect(url).toContain('search=%22catheter+ablation%22+AND+afib')
    expect(url).toContain('from_publication_date%3A2026-03-14')
    expect(url).toContain('to_publication_date%3A2026-04-13')
    expect(url).toContain('type%3Aarticle%7Creview%7Cbook-chapter%7Cpreprint%7Cdissertation%7Creport%7Cpeer-review')
    expect(url).toContain('per_page=25')
    expect(url).toContain('page=1')
    expect(url).toContain(`mailto=${encodeURIComponent(MAILTO)}`)
    expect(url).not.toContain('api_key=')
  })

  it('includes api_key when env var is set', () => {
    process.env.OPENALEX_API_KEY = 'SECRET'
    const url = buildSearchUrl({
      query: 'x',
      fromDate: '2026-01-01',
      toDate: '2026-01-31',
    })
    expect(url).toContain('api_key=SECRET')
  })
})

describe('searchByKeyword', () => {
  it('returns parsed meta and results on 200', async () => {
    const fetchSpy = vi
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ meta: { count: 2 }, results: [{ id: 'W1' }, { id: 'W2' }] }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
    const r = await searchByKeyword({
      query: 'x',
      fromDate: '2026-01-01',
      toDate: '2026-01-31',
    })
    expect(r.meta.count).toBe(2)
    expect(r.results).toHaveLength(2)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('retries on 429 then succeeds', async () => {
    const fetchSpy = vi
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response('rate', { status: 429 }))
      .mockResolvedValueOnce(new Response('rate', { status: 429 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ meta: { count: 0 }, results: [] }), {
          status: 200,
        }),
      )
    const r = await searchByKeyword({
      query: 'x',
      fromDate: '2026-01-01',
      toDate: '2026-01-31',
    })
    expect(r.meta.count).toBe(0)
    expect(fetchSpy).toHaveBeenCalledTimes(3)
  })

  it('throws after 3 failures', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response('nope', { status: 500 }))
    await expect(
      searchByKeyword({ query: 'x', fromDate: '2026-01-01', toDate: '2026-01-31' }),
    ).rejects.toThrow()
  })

  it('throws when OPENALEX_MAILTO is missing', async () => {
    delete process.env.OPENALEX_MAILTO
    await expect(
      searchByKeyword({ query: 'x', fromDate: '2026-01-01', toDate: '2026-01-31' }),
    ).rejects.toThrow(/OPENALEX_MAILTO/)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm run test -- test/openalex-client.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/lib/openalex/client.ts`**

```ts
// src/lib/openalex/client.ts
const OPENALEX_BASE = 'https://api.openalex.org/works'
const TYPE_FILTER = 'article|review|book-chapter|preprint|dissertation|report|peer-review'

export interface SearchOptions {
  query: string
  fromDate: string // YYYY-MM-DD
  toDate: string // YYYY-MM-DD
  perPage?: number
  page?: number
}

export interface OpenAlexWork {
  id: string
  doi?: string | null
  title?: string | null
  publication_date?: string | null
  abstract_inverted_index?: Record<string, number[]> | null
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
  params.set('search', opts.query)
  params.set(
    'filter',
    `from_publication_date:${opts.fromDate},to_publication_date:${opts.toDate},type:${TYPE_FILTER}`,
  )
  params.set('per_page', String(opts.perPage ?? 25))
  params.set('page', String(opts.page ?? 1))
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

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm run test -- test/openalex-client.test.ts
```

Expected: all 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/openalex/client.ts test/openalex-client.test.ts
git commit -m "feat(openalex): add URL builder and fetch with retry/timeout"
```

---

## Task 11: OpenAlex abstract reconstruction

**Files:**
- Create: `src/lib/openalex/abstract.ts`
- Modify: `test/openalex-client.test.ts` (append abstract tests)

- [ ] **Step 1: Append failing tests**

Add to the bottom of `test/openalex-client.test.ts`:

```ts
import { reconstructAbstract } from '@/lib/openalex/abstract'

describe('reconstructAbstract', () => {
  it('rebuilds a simple abstract from an inverted index', () => {
    // "hello world hello"
    const idx = { hello: [0, 2], world: [1] }
    expect(reconstructAbstract(idx)).toBe('hello world hello')
  })

  it('returns null for null input', () => {
    expect(reconstructAbstract(null)).toBeNull()
  })

  it('handles out-of-order tokens correctly', () => {
    const idx = { 'fibrillation,': [3], Atrial: [0], is: [2], fibrillation: [1] }
    expect(reconstructAbstract(idx)).toBe('Atrial fibrillation is fibrillation,')
  })
})
```

- [ ] **Step 2: Run — expect fail**

```bash
npm run test -- test/openalex-client.test.ts
```

Expected: FAIL — `reconstructAbstract` not found.

- [ ] **Step 3: Create `src/lib/openalex/abstract.ts`**

```ts
// src/lib/openalex/abstract.ts
export function reconstructAbstract(
  invertedIndex: Record<string, number[]> | null | undefined,
): string | null {
  if (!invertedIndex) return null
  const positions: Array<[number, string]> = []
  for (const [token, idxList] of Object.entries(invertedIndex)) {
    for (const pos of idxList) positions.push([pos, token])
  }
  positions.sort((a, b) => a[0] - b[0])
  return positions.map(([, token]) => token).join(' ')
}
```

- [ ] **Step 4: Run — expect pass**

```bash
npm run test -- test/openalex-client.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/openalex/abstract.ts test/openalex-client.test.ts
git commit -m "feat(openalex): add inverted-index abstract reconstruction"
```

---

## Task 12: Schedule timezone helper

**Files:**
- Create: `src/lib/schedule/timezone.ts`, `test/schedule.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/schedule.test.ts`:

```ts
// test/schedule.test.ts
import { describe, it, expect } from 'vitest'
import { resolveTimezone } from '@/lib/schedule/timezone'

describe('resolveTimezone', () => {
  it('resolves a known city to an IANA zone', () => {
    expect(resolveTimezone({ city: 'Istanbul' })).toBe('Europe/Istanbul')
    expect(resolveTimezone({ city: 'istanbul' })).toBe('Europe/Istanbul')
    expect(resolveTimezone({ city: 'New York' })).toBe('America/New_York')
  })

  it('returns the passed timezone when valid', () => {
    expect(resolveTimezone({ timezone: 'Europe/Berlin' })).toBe('Europe/Berlin')
  })

  it('prefers explicit timezone over city', () => {
    expect(
      resolveTimezone({ timezone: 'Europe/Paris', city: 'Istanbul' }),
    ).toBe('Europe/Paris')
  })

  it('returns null when neither resolves', () => {
    expect(resolveTimezone({ city: 'Atlantis' })).toBeNull()
    expect(resolveTimezone({})).toBeNull()
  })

  it('rejects an unknown timezone string', () => {
    expect(resolveTimezone({ timezone: 'Mars/Olympus' })).toBeNull()
  })
})
```

- [ ] **Step 2: Run — expect fail**

```bash
npm run test -- test/schedule.test.ts
```

Expected: FAIL — module missing.

- [ ] **Step 3: Create `src/lib/schedule/timezone.ts`**

```ts
// src/lib/schedule/timezone.ts
const CITY_TO_IANA: Record<string, string> = {
  istanbul: 'Europe/Istanbul',
  ankara: 'Europe/Istanbul',
  izmir: 'Europe/Istanbul',
  london: 'Europe/London',
  manchester: 'Europe/London',
  dublin: 'Europe/Dublin',
  paris: 'Europe/Paris',
  berlin: 'Europe/Berlin',
  munich: 'Europe/Berlin',
  amsterdam: 'Europe/Amsterdam',
  madrid: 'Europe/Madrid',
  barcelona: 'Europe/Madrid',
  lisbon: 'Europe/Lisbon',
  rome: 'Europe/Rome',
  milan: 'Europe/Rome',
  stockholm: 'Europe/Stockholm',
  copenhagen: 'Europe/Copenhagen',
  helsinki: 'Europe/Helsinki',
  athens: 'Europe/Athens',
  warsaw: 'Europe/Warsaw',
  'new york': 'America/New_York',
  nyc: 'America/New_York',
  boston: 'America/New_York',
  washington: 'America/New_York',
  'washington dc': 'America/New_York',
  toronto: 'America/Toronto',
  montreal: 'America/Toronto',
  chicago: 'America/Chicago',
  dallas: 'America/Chicago',
  houston: 'America/Chicago',
  'los angeles': 'America/Los_Angeles',
  la: 'America/Los_Angeles',
  'san francisco': 'America/Los_Angeles',
  seattle: 'America/Los_Angeles',
  vancouver: 'America/Vancouver',
  'mexico city': 'America/Mexico_City',
  'sao paulo': 'America/Sao_Paulo',
  'são paulo': 'America/Sao_Paulo',
  tokyo: 'Asia/Tokyo',
  osaka: 'Asia/Tokyo',
  seoul: 'Asia/Seoul',
  shanghai: 'Asia/Shanghai',
  beijing: 'Asia/Shanghai',
  'hong kong': 'Asia/Hong_Kong',
  singapore: 'Asia/Singapore',
  taipei: 'Asia/Taipei',
  dubai: 'Asia/Dubai',
  'tel aviv': 'Asia/Jerusalem',
  jerusalem: 'Asia/Jerusalem',
  mumbai: 'Asia/Kolkata',
  delhi: 'Asia/Kolkata',
  bangalore: 'Asia/Kolkata',
  sydney: 'Australia/Sydney',
  melbourne: 'Australia/Melbourne',
  auckland: 'Pacific/Auckland',
}

function isValidIanaZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone })
    return true
  } catch {
    return false
  }
}

export interface ResolveInput {
  city?: string
  timezone?: string
}

export function resolveTimezone(input: ResolveInput): string | null {
  if (input.timezone) {
    return isValidIanaZone(input.timezone) ? input.timezone : null
  }
  if (input.city) {
    const key = input.city.trim().toLowerCase()
    return CITY_TO_IANA[key] ?? null
  }
  return null
}
```

- [ ] **Step 4: Run — expect pass**

```bash
npm run test -- test/schedule.test.ts
```

Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/schedule/timezone.ts test/schedule.test.ts
git commit -m "feat(schedule): add city-to-IANA timezone resolver"
```

---

## Task 13: Schedule cron normalizer

**Files:**
- Create: `src/lib/schedule/cron.ts`
- Modify: `test/schedule.test.ts` (append cron tests)

- [ ] **Step 1: Append failing tests**

Add to `test/schedule.test.ts`:

```ts
import { normalizeSchedule } from '@/lib/schedule/cron'

describe('normalizeSchedule', () => {
  const now = new Date('2026-04-13T08:00:00.000Z') // Monday

  it('parses "every Monday at 9 AM Istanbul"', () => {
    const r = normalizeSchedule({ naturalLanguage: 'every Monday at 9 AM', city: 'Istanbul', now })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.cron).toBe('0 9 * * 1')
      expect(r.timezone).toBe('Europe/Istanbul')
      expect(r.description.toLowerCase()).toContain('monday')
      expect(r.nextThreeFires).toHaveLength(3)
    }
  })

  it('defaults time to 9 AM when unspecified', () => {
    const r = normalizeSchedule({ naturalLanguage: 'daily', timezone: 'UTC', now })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.cron).toBe('0 9 * * *')
  })

  it('handles "daily at 7am"', () => {
    const r = normalizeSchedule({ naturalLanguage: 'daily at 7am', timezone: 'UTC', now })
    expect(r.ok && r.cron).toBe('0 7 * * *')
  })

  it('handles "every other day"', () => {
    const r = normalizeSchedule({ naturalLanguage: 'every other day', timezone: 'UTC', now })
    expect(r.ok && r.cron).toBe('0 9 */2 * *')
  })

  it('handles "first of every month"', () => {
    const r = normalizeSchedule({
      naturalLanguage: 'first of every month at 10am',
      timezone: 'UTC',
      now,
    })
    expect(r.ok && r.cron).toBe('0 10 1 * *')
  })

  it('handles "weekdays at 8"', () => {
    const r = normalizeSchedule({ naturalLanguage: 'weekdays at 8am', timezone: 'UTC', now })
    expect(r.ok && r.cron).toBe('0 8 * * 1-5')
  })

  it('handles "twice a week Mon and Thu"', () => {
    const r = normalizeSchedule({
      naturalLanguage: 'twice a week Mon and Thu at 9am',
      timezone: 'UTC',
      now,
    })
    expect(r.ok && r.cron).toBe('0 9 * * 1,4')
  })

  it('returns needsTimezone when city is unknown', () => {
    const r = normalizeSchedule({ naturalLanguage: 'daily', now })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toBe('needsTimezone')
  })

  it('returns unparseable on gibberish', () => {
    const r = normalizeSchedule({
      naturalLanguage: 'qwerty asdf zxcv',
      timezone: 'UTC',
      now,
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toBe('unparseable')
  })
})
```

- [ ] **Step 2: Run — expect fail**

```bash
npm run test -- test/schedule.test.ts
```

Expected: FAIL — module missing.

- [ ] **Step 3: Create `src/lib/schedule/cron.ts`**

```ts
// src/lib/schedule/cron.ts
import { CronExpressionParser } from 'cron-parser'
import cronstrue from 'cronstrue'
import { resolveTimezone } from './timezone'

export interface NormalizeScheduleInput {
  naturalLanguage: string
  city?: string
  timezone?: string
  now?: Date
}

export type NormalizeScheduleResult =
  | {
      ok: true
      cron: string
      timezone: string
      description: string
      nextThreeFires: string[]
    }
  | {
      ok: false
      error: 'needsTimezone' | 'unparseable' | 'invalidCron'
      suggestion?: string
    }

const DAY_MAP: Record<string, number> = {
  sun: 0, sunday: 0,
  mon: 1, monday: 1,
  tue: 2, tues: 2, tuesday: 2,
  wed: 3, weds: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4,
  fri: 5, friday: 5,
  sat: 6, saturday: 6,
}

function parseTime(text: string): { hour: number; minute: number } | null {
  // "9am", "9 am", "9:30am", "9 AM", "21:00", "21.00"
  const amPm = text.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i)
  if (amPm) {
    let h = parseInt(amPm[1], 10)
    const m = amPm[2] ? parseInt(amPm[2], 10) : 0
    const suf = amPm[3].toLowerCase()
    if (suf === 'pm' && h < 12) h += 12
    if (suf === 'am' && h === 12) h = 0
    if (h < 0 || h > 23 || m < 0 || m > 59) return null
    return { hour: h, minute: m }
  }
  const h24 = text.match(/\b(\d{1,2}):(\d{2})\b/)
  if (h24) {
    const h = parseInt(h24[1], 10)
    const m = parseInt(h24[2], 10)
    if (h < 0 || h > 23 || m < 0 || m > 59) return null
    return { hour: h, minute: m }
  }
  const bareHour = text.match(/\bat\s+(\d{1,2})\b(?!\s*(am|pm))/i)
  if (bareHour) {
    const h = parseInt(bareHour[1], 10)
    if (h >= 0 && h <= 23) return { hour: h, minute: 0 }
  }
  return null
}

function parseDaysOfWeek(text: string): number[] | null {
  const found = new Set<number>()
  for (const [name, num] of Object.entries(DAY_MAP)) {
    const re = new RegExp(`\\b${name}\\b`, 'i')
    if (re.test(text)) found.add(num)
  }
  return found.size > 0 ? Array.from(found).sort((a, b) => a - b) : null
}

function buildCron(nl: string): string | null {
  const text = nl.toLowerCase().trim()
  const time = parseTime(text) ?? { hour: 9, minute: 0 }
  const h = time.hour
  const m = time.minute

  // first of every month
  if (/\bfirst of (every|each)?\s*month\b/.test(text) || /\b1st of (every|each)?\s*month\b/.test(text)) {
    return `${m} ${h} 1 * *`
  }

  // weekdays
  if (/\bweekdays?\b/.test(text)) {
    return `${m} ${h} * * 1-5`
  }

  // weekends
  if (/\bweekends?\b/.test(text)) {
    return `${m} ${h} * * 0,6`
  }

  // every other day / every 2 days
  if (/\bevery other day\b/.test(text) || /\bevery 2 days?\b/.test(text)) {
    return `${m} ${h} */2 * *`
  }
  const everyN = text.match(/\bevery\s+(\d+)\s+days?\b/)
  if (everyN) {
    return `${m} ${h} */${everyN[1]} * *`
  }

  // days of week
  const dows = parseDaysOfWeek(text)
  if (dows) {
    return `${m} ${h} * * ${dows.join(',')}`
  }

  // plain daily
  if (/\bdaily\b/.test(text) || /\bevery day\b/.test(text) || /\beach day\b/.test(text)) {
    return `${m} ${h} * * *`
  }

  return null
}

function roundTripCron(cron: string): boolean {
  try {
    CronExpressionParser.parse(cron)
    return true
  } catch {
    return false
  }
}

function computeNextThree(cron: string, timezone: string, now: Date): string[] {
  const iter = CronExpressionParser.parse(cron, { currentDate: now, tz: timezone })
  const out: string[] = []
  for (let i = 0; i < 3; i++) {
    out.push(iter.next().toDate().toISOString())
  }
  return out
}

export function normalizeSchedule(
  input: NormalizeScheduleInput,
): NormalizeScheduleResult {
  const tz = resolveTimezone({ city: input.city, timezone: input.timezone })
  if (!tz) {
    return { ok: false, error: 'needsTimezone', suggestion: 'Which city are you in?' }
  }

  const cron = buildCron(input.naturalLanguage)
  if (!cron) {
    return {
      ok: false,
      error: 'unparseable',
      suggestion: 'Try "every Monday at 9am" or "daily at 7am".',
    }
  }
  if (!roundTripCron(cron)) {
    return { ok: false, error: 'invalidCron' }
  }

  const description = cronstrue.toString(cron, { use24HourTimeFormat: false })
  const nextThreeFires = computeNextThree(cron, tz, input.now ?? new Date())

  return { ok: true, cron, timezone: tz, description, nextThreeFires }
}
```

- [ ] **Step 4: Run — expect pass**

```bash
npm run test -- test/schedule.test.ts
```

Expected: all 14 tests pass (5 timezone + 9 normalize).

- [ ] **Step 5: Commit**

```bash
git add src/lib/schedule/cron.ts test/schedule.test.ts
git commit -m "feat(schedule): add natural-language to cron normalizer"
```

---

## Task 14: Session cookie helper

**Files:**
- Create: `src/lib/session.ts`

- [ ] **Step 1: Write `src/lib/session.ts`**

```ts
// src/lib/session.ts
import { cookies } from 'next/headers'

const COOKIE_NAME = 'rd_session'
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365

function uuid(): string {
  // crypto.randomUUID is available in Node 19+ and the browser.
  return (globalThis.crypto?.randomUUID?.() ??
    // Fallback, ≈ v4 format, non-cryptographic.
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0
      const v = c === 'x' ? r : (r & 0x3) | 0x8
      return v.toString(16)
    }))
}

/** Server-side: read the session id, creating + setting it if absent. */
export async function getOrCreateSession(): Promise<string> {
  const store = await cookies()
  const existing = store.get(COOKIE_NAME)?.value
  if (existing) return existing
  const id = uuid()
  store.set(COOKIE_NAME, id, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: ONE_YEAR_SECONDS,
  })
  return id
}

/** Server-side: read the session id, or null if absent. */
export async function getSession(): Promise<string | null> {
  const store = await cookies()
  return store.get(COOKIE_NAME)?.value ?? null
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/session.ts
git commit -m "feat(session): add rd_session cookie helper"
```

---

## Task 15: Typed localStorage helper

**Files:**
- Create: `src/lib/storage/local.ts`

- [ ] **Step 1: Write `src/lib/storage/local.ts`**

```ts
// src/lib/storage/local.ts
import type { UIMessage } from '@ai-sdk/react'
import type { DigestConfig } from '@/lib/config-schema'

const KEY = 'rd:onboarding:v1'
const SCHEMA_VERSION = 1 as const

export interface OnboardingLocalState {
  schemaVersion: typeof SCHEMA_VERSION
  sessionId: string
  messages: UIMessage[]
  configDraft: Partial<DigestConfig>
  finalConfig?: DigestConfig
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

export function newOnboardingState(sessionId: string): OnboardingLocalState {
  return {
    schemaVersion: SCHEMA_VERSION,
    sessionId,
    messages: [],
    configDraft: {},
    lastUpdated: new Date().toISOString(),
  }
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/storage/local.ts
git commit -m "feat(storage): add typed localStorage helper for onboarding state"
```

---

## Task 16: OpenRouter provider factory

**Files:**
- Create: `src/lib/ai/openrouter.ts`

- [ ] **Step 1: Write the factory**

```ts
// src/lib/ai/openrouter.ts
import { createOpenRouter } from '@openrouter/ai-sdk-provider'

export const MODEL_ID = 'deepseek/deepseek-v3.2'

function getOpenRouter() {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY env var is required')
  }
  return createOpenRouter({ apiKey })
}

/**
 * Returns the configured DeepSeek v3.2 language model via OpenRouter.
 * Lazily initialized so tests can mock the provider without tripping the
 * env-var guard on import.
 */
export function deepseek() {
  return getOpenRouter()(MODEL_ID)
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors. If the `createOpenRouter` import signature differs in the installed version, adapt with the current API surface (confirm via `context7` `resolve-library-id` → `query-docs` for `@openrouter/ai-sdk-provider`).

- [ ] **Step 3: Commit**

```bash
git add src/lib/ai/openrouter.ts
git commit -m "feat(ai): add OpenRouter provider factory for deepseek v3.2"
```

---

## Task 17: `normalizeSchedule` tool

**Files:**
- Create: `src/lib/ai/onboarding-tools.ts`, `test/tools.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/tools.test.ts`:

```ts
// test/tools.test.ts
import { describe, it, expect } from 'vitest'
import { onboardingTools } from '@/lib/ai/onboarding-tools'

describe('normalizeSchedule tool', () => {
  it('exposes a tool named normalizeSchedule', () => {
    expect(onboardingTools.normalizeSchedule).toBeDefined()
  })

  it('round-trips "every Monday at 9 AM" with Istanbul', async () => {
    const r = await onboardingTools.normalizeSchedule.execute(
      {
        naturalLanguage: 'every Monday at 9 AM',
        city: 'Istanbul',
      },
      { toolCallId: 'test-1', messages: [] },
    )
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.cron).toBe('0 9 * * 1')
      expect(r.timezone).toBe('Europe/Istanbul')
      expect(r.nextThreeFires).toHaveLength(3)
    }
  })

  it('returns needsTimezone when city is missing', async () => {
    const r = await onboardingTools.normalizeSchedule.execute(
      { naturalLanguage: 'daily at 8am' },
      { toolCallId: 'test-2', messages: [] },
    )
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toBe('needsTimezone')
  })
})
```

- [ ] **Step 2: Run — expect fail**

```bash
npm run test -- test/tools.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/lib/ai/onboarding-tools.ts` with the first tool**

```ts
// src/lib/ai/onboarding-tools.ts
import { tool } from 'ai'
import { z } from 'zod'
import { normalizeSchedule as normalizeScheduleImpl } from '@/lib/schedule/cron'

const normalizeScheduleInput = z.object({
  naturalLanguage: z
    .string()
    .describe('The user\'s natural-language description of their schedule.'),
  city: z
    .string()
    .optional()
    .describe('The user\'s city, used to resolve timezone when timezone is not given.'),
  timezone: z
    .string()
    .optional()
    .describe('An explicit IANA timezone string. Takes precedence over city.'),
})

const normalizeScheduleTool = tool({
  description:
    'Convert a natural-language schedule ("every Monday at 9am") into a cron expression, IANA timezone, a human description, and the next three fire times. Call this after the user describes when they want their digest.',
  inputSchema: normalizeScheduleInput,
  execute: async (args) => {
    return normalizeScheduleImpl({
      naturalLanguage: args.naturalLanguage,
      city: args.city,
      timezone: args.timezone,
    })
  },
})

export const onboardingTools = {
  normalizeSchedule: normalizeScheduleTool,
}
```

- [ ] **Step 4: Run — expect pass**

```bash
npm run test -- test/tools.test.ts
```

Expected: 3 tests pass. If the `tool({ description, inputSchema, execute })` signature differs in the installed AI SDK version, consult the current docs via `context7` `query-docs` for `ai`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/onboarding-tools.ts test/tools.test.ts
git commit -m "feat(ai): add normalizeSchedule tool"
```

---

## Task 18: `generateConfig` tool

**Files:**
- Modify: `src/lib/ai/onboarding-tools.ts`, `test/tools.test.ts`

- [ ] **Step 1: Append failing tests**

Add to `test/tools.test.ts`:

```ts
describe('generateConfig tool', () => {
  const validConfig = {
    subject: 'Atrial fibrillation',
    schedule: {
      cron: '0 9 * * 1',
      timezone: 'Europe/Istanbul',
      description: 'Every Monday at 9:00 AM',
    },
    volume_target: 15,
    profile: 'Clinical cardiologist tracking AF evidence. No basic science.',
    output_style:
      'Sections: Summary, Evidence Updates, Watch List. Clinical implications per paper.',
    core_angles: [
      { id: 1, text: 'Catheter ablation techniques', status: 'core', priority: 'high' },
    ],
  }

  it('returns ok with a stamped config on valid input', async () => {
    const r = await onboardingTools.generateConfig.execute(
      { config: validConfig },
      { toolCallId: 'g-1', messages: [] },
    )
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.config.version).toBe(1)
      expect(typeof r.config.created_at).toBe('string')
      expect(typeof r.config.updated_at).toBe('string')
      expect(r.config.core_angles).toHaveLength(1)
    }
  })

  it('returns ok:false with errors on missing required field', async () => {
    const bad = { ...validConfig, profile: '' }
    const r = await onboardingTools.generateConfig.execute(
      { config: bad },
      { toolCallId: 'g-2', messages: [] },
    )
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run — expect fail**

```bash
npm run test -- test/tools.test.ts
```

Expected: FAIL — `generateConfig` not defined on `onboardingTools`.

- [ ] **Step 3: Extend `src/lib/ai/onboarding-tools.ts`**

Append these additions to the top imports:

```ts
import { digestConfigSchema } from '@/lib/config-schema'
```

Append below `normalizeScheduleTool`:

```ts
const generateConfigInput = z.object({
  config: z
    .record(z.string(), z.unknown())
    .describe('The assembled DigestConfig fields. Will be validated against the schema.'),
})

const generateConfigTool = tool({
  description:
    'Validate the assembled config against the DigestConfig schema and finalize it. Call this once subject, schedule, profile, output_style, volume_target, and core_angles are all ready. On failure, fix the named fields and retry.',
  inputSchema: generateConfigInput,
  execute: async (args) => {
    const now = new Date().toISOString()
    const stamped = {
      version: 1,
      created_at: now,
      updated_at: now,
      search_queries: [],
      ...args.config,
    }
    const parsed = digestConfigSchema.safeParse(stamped)
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
```

Update the exports at the bottom:

```ts
export const onboardingTools = {
  normalizeSchedule: normalizeScheduleTool,
  generateConfig: generateConfigTool,
}
```

- [ ] **Step 4: Run — expect pass**

```bash
npm run test -- test/tools.test.ts
```

Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/onboarding-tools.ts test/tools.test.ts
git commit -m "feat(ai): add generateConfig tool with schema validation"
```

---

## Task 19: `propose-angles` inner call + prompt

**Files:**
- Create: `prompts/propose-angles-system.md`, `src/lib/ai/propose-angles.ts`

- [ ] **Step 1: Write the prompt**

Create `prompts/propose-angles-system.md`:

```markdown
You generate a list of 6–12 specific research angles for a subject, given a short profile of the reader.

An angle is a stable sub-area the reader cares about, phrased specifically enough that a literature search can match it. Good angles name a method, a mechanism, a clinical target, a technique family, a tool, or a named trend — something with its own vocabulary in the field.

## Rules

1. Return **6–12** angles. Fewer than 6 is too thin; more than 12 overwhelms the user.
2. Prefer angles where the field publishes regularly and the canonical phrasing generalizes across papers. Avoid angles that are:
   - Too generic ("randomized trials", "machine learning")
   - Too narrow for typical publication volume (a single rare technique with few papers/year)
   - Methodology phrases that match every field ("systematic review", "meta-analysis")
3. Each angle gets a one-sentence `rationale` explaining why this angle specifically matters for this reader and why it publishes enough to be trackable.
4. Do not duplicate angles. Merge near-duplicates into the most specific phrasing.
5. Use the reader's vocabulary (clinical, technical, applied, academic) based on their profile.

## Output format

Return a JSON object exactly matching this shape:

```json
{
  "angles": [
    { "text": "...", "rationale": "..." },
    { "text": "...", "rationale": "..." }
  ]
}
```

No prose outside the JSON. No markdown fences around it.
```

- [ ] **Step 2: Write `src/lib/ai/propose-angles.ts`**

```ts
// src/lib/ai/propose-angles.ts
import { generateObject } from 'ai'
import { z } from 'zod'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { deepseek } from '@/lib/ai/openrouter'

export const proposeAnglesOutputSchema = z.object({
  angles: z
    .array(
      z.object({
        text: z.string().min(1),
        rationale: z.string().min(1),
      }),
    )
    .min(6)
    .max(12),
})

export type ProposeAnglesOutput = z.infer<typeof proposeAnglesOutputSchema>

let cachedPrompt: string | null = null

function getSystemPrompt(): string {
  if (cachedPrompt) return cachedPrompt
  cachedPrompt = readFileSync(
    resolve(process.cwd(), 'prompts/propose-angles-system.md'),
    'utf8',
  )
  return cachedPrompt
}

export async function proposeAngles(input: {
  subject: string
  profileSummary: string
  hints?: string
}): Promise<ProposeAnglesOutput> {
  const { object } = await generateObject({
    model: deepseek(),
    schema: proposeAnglesOutputSchema,
    system: getSystemPrompt(),
    prompt: [
      `SUBJECT: ${input.subject}`,
      '',
      `READER PROFILE:\n${input.profileSummary}`,
      input.hints ? `\nHINTS:\n${input.hints}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
    temperature: 0.7,
  })
  return object
}
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

Expected: no errors. If the `generateObject` signature differs in the installed AI SDK, consult `context7` `query-docs` for `ai`.

- [ ] **Step 4: Commit**

```bash
git add prompts/propose-angles-system.md src/lib/ai/propose-angles.ts
git commit -m "feat(ai): add propose-angles inner call and prompt"
```

---

## Task 20: `proposeAngles` tool

**Files:**
- Modify: `src/lib/ai/onboarding-tools.ts`, `test/tools.test.ts`

- [ ] **Step 1: Append the failing test**

Add to `test/tools.test.ts`:

```ts
import { vi } from 'vitest'
import * as proposeAnglesModule from '@/lib/ai/propose-angles'

describe('proposeAngles tool', () => {
  it('returns 6–12 angles for a subject/profile', async () => {
    vi.spyOn(proposeAnglesModule, 'proposeAngles').mockResolvedValueOnce({
      angles: [
        { text: 'Catheter ablation techniques', rationale: 'High publication volume; named techniques.' },
        { text: 'Anticoagulation choices', rationale: 'DOAC trials publish regularly.' },
        { text: 'Rate vs rhythm control', rationale: 'Active debate with landmark trials.' },
        { text: 'Stroke prevention', rationale: 'LAAC devices are a productive sub-area.' },
        { text: 'Guideline updates', rationale: 'ESC/ACC updates produce trackable news.' },
        { text: 'Wearable monitoring', rationale: 'Consumer-device trials are growing.' },
      ],
    })

    const r = await onboardingTools.proposeAngles.execute(
      {
        subject: 'Atrial fibrillation',
        profileSummary: 'Clinical cardiologist, no basic science.',
      },
      { toolCallId: 'a-1', messages: [] },
    )
    expect(r.angles.length).toBeGreaterThanOrEqual(6)
    expect(r.angles.length).toBeLessThanOrEqual(12)
    expect(r.angles[0]).toHaveProperty('text')
    expect(r.angles[0]).toHaveProperty('rationale')
  })
})
```

- [ ] **Step 2: Run — expect fail**

```bash
npm run test -- test/tools.test.ts
```

Expected: FAIL — `proposeAngles` not on `onboardingTools`.

- [ ] **Step 3: Extend `src/lib/ai/onboarding-tools.ts`**

Add to the top imports:

```ts
import { proposeAngles as proposeAnglesImpl } from '@/lib/ai/propose-angles'
```

Append below `generateConfigTool`:

```ts
const proposeAnglesInput = z.object({
  subject: z.string().describe('The subject the user wants a digest about.'),
  profileSummary: z
    .string()
    .describe('A short profile of the reader: role, intent, anti-interests.'),
  hints: z.string().optional().describe('Optional hints from the conversation so far.'),
})

const proposeAnglesTool = tool({
  description:
    'Generate 6–12 specific research angles for a subject given a reader profile. Call this once subject, role, and intent are clear. Narrate the result to the user in natural language — do not dump the raw list.',
  inputSchema: proposeAnglesInput,
  execute: async (args) => {
    return proposeAnglesImpl(args)
  },
})
```

Update the exports:

```ts
export const onboardingTools = {
  normalizeSchedule: normalizeScheduleTool,
  generateConfig: generateConfigTool,
  proposeAngles: proposeAnglesTool,
}
```

- [ ] **Step 4: Run — expect pass**

```bash
npm run test -- test/tools.test.ts
```

Expected: 6 tests pass (prior 5 + new 1).

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/onboarding-tools.ts test/tools.test.ts
git commit -m "feat(ai): add proposeAngles tool"
```

---

## Task 21: `corpusSanityCheck` tool

**Files:**
- Modify: `src/lib/ai/onboarding-tools.ts`
- Create: `test/corpus-sanity.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/corpus-sanity.test.ts`:

```ts
// test/corpus-sanity.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { onboardingTools } from '@/lib/ai/onboarding-tools'
import * as openalex from '@/lib/openalex/client'

const ctx = { toolCallId: 'c-1', messages: [] as unknown[] }

beforeEach(() => {
  process.env.OPENALEX_MAILTO = 'test@example.com'
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('corpusSanityCheck tool', () => {
  it('maps high counts to healthy', async () => {
    vi.spyOn(openalex, 'searchByKeyword').mockResolvedValue({
      meta: { count: 120 },
      results: [],
    })
    const r = await onboardingTools.corpusSanityCheck.execute(
      {
        subject: 'AF',
        cadenceDays: 7,
        angles: [{ text: 'ablation' }, { text: 'anticoagulation' }],
      },
      ctx,
    )
    expect(r.results).toHaveLength(2)
    for (const item of r.results) {
      expect(item.verdict).toBe('healthy')
      expect(item.papersPerRun).toBeCloseTo((120 / 30) * 7, 5)
    }
  })

  it('maps low counts to sparse', async () => {
    vi.spyOn(openalex, 'searchByKeyword').mockResolvedValue({
      meta: { count: 3 },
      results: [{ id: 'W1', title: 'Rare technique study' } as never],
    })
    const r = await onboardingTools.corpusSanityCheck.execute(
      { subject: 'x', cadenceDays: 7, angles: [{ text: 'rare technique' }] },
      ctx,
    )
    expect(r.results[0].verdict).toBe('sparse')
    expect(r.results[0].papersPerRun).toBeCloseTo((3 / 30) * 7, 5)
  })

  it('maps zero counts to empty', async () => {
    vi.spyOn(openalex, 'searchByKeyword').mockResolvedValue({
      meta: { count: 0 },
      results: [],
    })
    const r = await onboardingTools.corpusSanityCheck.execute(
      { subject: 'x', cadenceDays: 7, angles: [{ text: 'empty angle' }] },
      ctx,
    )
    expect(r.results[0].verdict).toBe('empty')
    expect(r.results[0].papersPerRun).toBe(0)
  })

  it('maps fetch failure to error verdict', async () => {
    vi.spyOn(openalex, 'searchByKeyword').mockRejectedValue(new Error('network'))
    const r = await onboardingTools.corpusSanityCheck.execute(
      { subject: 'x', cadenceDays: 7, angles: [{ text: 'boom' }] },
      ctx,
    )
    expect(r.results[0].verdict).toBe('error')
  })

  it('caps concurrency at 5', async () => {
    let inFlight = 0
    let peak = 0
    vi.spyOn(openalex, 'searchByKeyword').mockImplementation(async () => {
      inFlight += 1
      peak = Math.max(peak, inFlight)
      await new Promise((r) => setTimeout(r, 5))
      inFlight -= 1
      return { meta: { count: 50 }, results: [] }
    })
    const angles = Array.from({ length: 12 }, (_, i) => ({ text: `angle-${i}` }))
    await onboardingTools.corpusSanityCheck.execute(
      { subject: 'x', cadenceDays: 7, angles },
      ctx,
    )
    expect(peak).toBeLessThanOrEqual(5)
  })
})
```

- [ ] **Step 2: Run — expect fail**

```bash
npm run test -- test/corpus-sanity.test.ts
```

Expected: FAIL — tool not defined.

- [ ] **Step 3: Extend `src/lib/ai/onboarding-tools.ts`**

Add imports:

```ts
import { searchByKeyword } from '@/lib/openalex/client'
```

Append:

```ts
type Verdict = 'healthy' | 'sparse' | 'empty' | 'error'

function computeVerdict(count30d: number, papersPerRun: number): Verdict {
  if (count30d === 0) return 'empty'
  if (papersPerRun >= 2) return 'healthy'
  return 'sparse'
}

function todayUtc(): Date {
  return new Date()
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

async function withSemaphore<T>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<void>,
): Promise<void> {
  let cursor = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const i = cursor++
      await fn(items[i], i)
    }
  })
  await Promise.all(workers)
}

const corpusSanityInput = z.object({
  subject: z.string(),
  angles: z.array(z.object({ text: z.string() })).min(1),
  cadenceDays: z.number().int().positive(),
})

interface SanityResult {
  angleText: string
  count30d: number
  papersPerRun: number
  verdict: Verdict
  sampleTitles?: string[]
}

const corpusSanityCheckTool = tool({
  description:
    "For each angle, run one OpenAlex search over the last 30 days and estimate papers-per-run given the user's cadence. Call this after angles AND schedule are both settled. Surface sparse/empty angles to the user with cadence-aware language.",
  inputSchema: corpusSanityInput,
  execute: async (args) => {
    const to = todayUtc()
    const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000)
    const fromDate = formatDate(from)
    const toDate = formatDate(to)

    const out: SanityResult[] = new Array(args.angles.length)

    await withSemaphore(args.angles, 5, async (angle, i) => {
      const query = `"${angle.text}" AND ${args.subject}`
      try {
        const res = await searchByKeyword({
          query,
          fromDate,
          toDate,
          perPage: 3,
          page: 1,
        })
        const count30d = res.meta?.count ?? 0
        const papersPerRun = (count30d / 30) * args.cadenceDays
        const verdict = computeVerdict(count30d, papersPerRun)
        const sampleTitles =
          verdict === 'healthy'
            ? undefined
            : res.results
                .map((w) => (typeof w.title === 'string' ? w.title : null))
                .filter((t): t is string => !!t)
                .slice(0, 3)
        out[i] = {
          angleText: angle.text,
          count30d,
          papersPerRun,
          verdict,
          sampleTitles,
        }
      } catch {
        out[i] = {
          angleText: angle.text,
          count30d: 0,
          papersPerRun: 0,
          verdict: 'error',
        }
      }
    })

    return { results: out }
  },
})
```

Update exports:

```ts
export const onboardingTools = {
  normalizeSchedule: normalizeScheduleTool,
  generateConfig: generateConfigTool,
  proposeAngles: proposeAnglesTool,
  corpusSanityCheck: corpusSanityCheckTool,
}
```

- [ ] **Step 4: Run — expect pass**

```bash
npm run test -- test/corpus-sanity.test.ts test/tools.test.ts
```

Expected: 5 corpus-sanity tests pass + all prior tool tests still pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/onboarding-tools.ts test/corpus-sanity.test.ts
git commit -m "feat(ai): add corpusSanityCheck tool with semaphore and verdict mapping"
```

---

## Task 22: Verify AI SDK v6 surface + onboarding system prompt

**Files:**
- Create: `prompts/onboarding-system.md`

- [ ] **Step 1: Pull current Vercel AI SDK docs via context7**

Run (inside the agentic worker's tool loop):

1. `mcp__plugin_context7_context7__resolve-library-id` with query `ai` (Vercel AI SDK)
2. `mcp__plugin_context7_context7__query-docs` against the resolved id for:
   - "streamText with tools and toolCallStreaming"
   - "useChat hook tool-call parts"
   - "@ai-sdk/react UIMessage parts"
3. Same for `@openrouter/ai-sdk-provider` if the earlier factory needs adjustment.
4. Reconcile any differences with what Tasks 16–21 wrote; if the `tool()` signature, `streamText` parameters, or UI parts names have changed, update those files now and re-run `npm run test`. All tests should still pass.

- [ ] **Step 2: Write `prompts/onboarding-system.md`**

```markdown
You are a research companion who helps a new reader set up a personalized digest of academic papers. You are clever, sophisticated, and confident — never corporate, never gushing. You write like someone who reads papers for a living.

## Your job

Through a short conversation, learn enough about the reader to produce a complete setup for their digest. When everything is ready, finalize it.

Information you need (in any order, skipping anything the reader has already said):

- **Role + context.** Who they are and what they do.
- **Subject.** The main topic they want a digest about.
- **Intent.** What they want to *do* with the research — track a field, find practical takeaways, stay current for clinical practice, apply findings to work, keep an eye on a competing area.
- **Anti-interests.** What they don't want (no animal studies, no basic science, no preprints, etc.).
- **Style preferences.** Depth, technicality, tone. Often inferable without asking.
- **Schedule.** How often and when they want the digest. Always ask explicitly — never default silently. Accept anything natural ("every Monday at 9am", "daily at 7am", "first of every month"). If you don't know their timezone, ask which city they're in and I'll figure the rest.

## How you talk

- **One question per message. Never two.**
- **2–3 sentences per message.** Never long paragraphs.
- **Give before you ask.** After the first turn, every reply reflects or infers something that proves you understood, then asks the next question.
- **Suggest before they ask.** When you can infer sections, depth, or adjacent sub-areas from their role, propose them. Don't wait to be asked.
- **No system jargon.** Never say "config", "query", "schema", "topics", "OpenAlex", or "angle list". Talk about "your digest", "the specific things I'll track for you", "what I'll look for".
- **Don't ask what you can infer.** A marketing director who wants consumer-psychology research already implies accessible tone and practical takeaways — don't ask to confirm.
- **Aim for 4–6 exchanges.** Hard wrap at around 10.

## Your tools

You have four tools. Call them at the right moment; never name them to the user.

- **proposeAngles** — call once subject + role + intent are clear. It returns 6–12 specific areas. Narrate the result in natural language ("Based on what you've told me, here are the specific things I'll track…") — the UI renders the full card automatically. If the user refines the list verbally, incorporate their changes and remember the final list.
- **normalizeSchedule** — call after the user describes when they want the digest. It returns a structured schedule and the next three fire times. Confirm the schedule back to the user verbally before continuing ("Got it — every Monday at 9 AM Istanbul time. Next three would be April 20, April 27, May 4. Sound good?"). If it returns `needsTimezone`, ask which city they're in.
- **corpusSanityCheck** — call once angles AND schedule are both settled. It checks whether each area has enough publication volume for the chosen cadence. If any area is `sparse` or `empty`, surface that to the user with cadence-aware language ("Heads up — with your daily schedule, '[area]' will probably be empty most digests because the field publishes ~1 paper a week on it. Keep it, merge it with a broader area, or drop it?"). `healthy` areas don't need to be called out.
- **generateConfig** — call when all fields are ready. If it returns errors, name the specific missing or invalid fields in plain language and ask the user to clarify, then call it again.

## Fields you will assemble

- **subject** — one short phrase ("atrial fibrillation", "large language model agents")
- **profile** — free-text prose capturing who the reader is, what they want, what they don't want, and any scoring preferences. This is the only thing the downstream filter will see, so it has to be specific and self-contained.
- **output_style** — free-text prose capturing the sections, tone, depth, and language of the digest. Write it like an editor's brief.
- **volume_target** — an integer 3–40, the target number of papers per digest. Infer from intent/cadence if the user doesn't say.
- **core_angles** — 6–12 angles with an `id` starting at 1, the `text` from the final list, `status: 'core'`, and `priority` inferred from the conversation.
- **schedule** — the `{cron, timezone, description}` returned by `normalizeSchedule`.

When you call `generateConfig`, pass every field in a single `config` object.
```

- [ ] **Step 3: Commit**

```bash
git add prompts/onboarding-system.md
git commit -m "feat(ai): add onboarding system prompt"
```

---

## Task 23: `/api/onboarding-chat` route

**Files:**
- Create: `src/app/api/onboarding-chat/route.ts`

- [ ] **Step 1: Write the route**

```ts
// src/app/api/onboarding-chat/route.ts
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { streamText, convertToModelMessages, type UIMessage } from 'ai'
import { deepseek } from '@/lib/ai/openrouter'
import { onboardingTools } from '@/lib/ai/onboarding-tools'
import { getOrCreateSession } from '@/lib/session'

export const runtime = 'nodejs'
export const maxDuration = 60

let cachedSystem: string | null = null
function getSystemPrompt(): string {
  if (cachedSystem) return cachedSystem
  cachedSystem = readFileSync(
    resolve(process.cwd(), 'prompts/onboarding-system.md'),
    'utf8',
  )
  return cachedSystem
}

export async function POST(req: Request) {
  await getOrCreateSession()

  const body = (await req.json()) as { messages: UIMessage[] }

  const result = streamText({
    model: deepseek(),
    system: getSystemPrompt(),
    messages: convertToModelMessages(body.messages),
    tools: onboardingTools,
    temperature: 0.7,
  })

  return result.toUIMessageStreamResponse()
}
```

Note: `convertToModelMessages` and `toUIMessageStreamResponse` are the v6 names at the time of writing. If `context7` surfaces different names, replace with the current API (e.g., `toDataStreamResponse`) and keep the same semantics.

- [ ] **Step 2: Smoke test**

Start the dev server:

```bash
npm run dev
```

In a second terminal:

```bash
curl -N -X POST http://localhost:3000/api/onboarding-chat \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"id":"1","role":"user","parts":[{"type":"text","text":"Hi, I want to track research about atrial fibrillation. I am a clinical cardiologist."}]}]}'
```

Expected: streaming NDJSON/SSE response from DeepSeek; the assistant asks a follow-up question. If it errors, check `.env.local` for `OPENROUTER_API_KEY`. Stop the dev server.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/onboarding-chat/route.ts
git commit -m "feat(api): add streaming onboarding-chat route with tool wiring"
```

---

## Task 24: `ChatShell` + `Composer` (hero mode wiring)

**Files:**
- Create: `src/components/chat/ChatShell.tsx`, `src/components/chat/Composer.tsx`

- [ ] **Step 1: Write `src/components/chat/Composer.tsx`**

```tsx
// src/components/chat/Composer.tsx
'use client'

import { motion } from 'framer-motion'
import { SendHorizontal } from 'lucide-react'
import { forwardRef, useRef, type KeyboardEvent, type ChangeEvent } from 'react'

export interface ComposerProps {
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
  disabled?: boolean
  placeholder?: string
  size?: 'hero' | 'docked'
}

export const Composer = forwardRef<HTMLTextAreaElement, ComposerProps>(
  (
    { value, onChange, onSubmit, disabled = false, placeholder, size = 'hero' },
    ref,
  ) => {
    const innerRef = useRef<HTMLTextAreaElement | null>(null)

    const setRef = (node: HTMLTextAreaElement | null) => {
      innerRef.current = node
      if (typeof ref === 'function') ref(node)
      else if (ref) (ref as React.MutableRefObject<HTMLTextAreaElement | null>).current = node
    }

    const resize = () => {
      const el = innerRef.current
      if (!el) return
      el.style.height = 'auto'
      const max = 6 * 24 // ~6 rows
      el.style.height = `${Math.min(el.scrollHeight, max)}px`
    }

    const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
        e.preventDefault()
        if (!disabled && value.trim().length > 0) onSubmit()
      }
    }

    const onInput = (e: ChangeEvent<HTMLTextAreaElement>) => {
      onChange(e.target.value)
      resize()
    }

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
          <button
            type="button"
            onClick={() => !disabled && value.trim().length > 0 && onSubmit()}
            disabled={disabled || value.trim().length === 0}
            aria-label="Send"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-accent-ink transition-transform duration-[var(--dur-xs)] active:scale-[0.95] disabled:opacity-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-accent-ring"
          >
            <SendHorizontal size={18} />
          </button>
        </div>
      </motion.div>
    )
  },
)

Composer.displayName = 'Composer'
```

- [ ] **Step 2: Write `src/components/chat/ChatShell.tsx` (hero-mode-only for now)**

```tsx
// src/components/chat/ChatShell.tsx
'use client'

import { LayoutGroup, motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Composer } from './Composer'

export interface ChatShellProps {
  initialMode: 'hero' | 'docked'
}

export function ChatShell({ initialMode }: ChatShellProps) {
  const router = useRouter()
  const [input, setInput] = useState('')

  const onSubmit = () => {
    // Store the first message for the onboarding page to pick up.
    try {
      sessionStorage.setItem('rd:pending-first-message', input.trim())
    } catch {
      /* ignore */
    }
    router.push('/onboarding')
  }

  if (initialMode === 'hero') {
    return (
      <LayoutGroup>
        <div className="min-h-dvh flex flex-col items-center justify-center px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.2, 0.7, 0.2, 1] }}
          >
            <h1 className="font-display text-[56px] leading-[1.05] sm:text-[72px] tracking-[-0.5px] text-ink">
              A research digest, written for you.
            </h1>
            <p className="mt-4 text-[18px] text-ink-soft">
              Describe what you want to track. I&apos;ll do the reading.
            </p>
          </motion.div>

          <div className="mt-10 w-full">
            <Composer
              value={input}
              onChange={setInput}
              onSubmit={onSubmit}
              size="hero"
            />
          </div>
        </div>
      </LayoutGroup>
    )
  }

  // Docked mode is wired in Task 28.
  return <DockedPlaceholder />
}

function DockedPlaceholder() {
  return <div className="p-6 text-ink-soft">Docked chat wired in Task 28.</div>
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/chat/ChatShell.tsx src/components/chat/Composer.tsx
git commit -m "feat(chat): add ChatShell and Composer (hero mode)"
```

---

## Task 25: Landing page `/`

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Rewrite `src/app/page.tsx`**

```tsx
// src/app/page.tsx
import { ChatShell } from '@/components/chat/ChatShell'
import { ThemeToggle } from '@/components/ui/ThemeToggle'

export default function Home() {
  return (
    <main>
      <header className="fixed top-0 right-0 p-4 z-10">
        <ThemeToggle />
      </header>
      <ChatShell initialMode="hero" />
    </main>
  )
}
```

- [ ] **Step 2: Smoke test**

```bash
npm run dev
```

Open `http://localhost:3000`. Expected: hero title in Instrument Serif, cream background, emerald send button, theme toggle in the top-right. Typing a message + Enter navigates to `/onboarding` (currently placeholder text). Stop the dev server.

- [ ] **Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(ui): add landing page with hero ChatShell"
```

---

## Task 26: `MessageList` + `MessageBubble`

**Files:**
- Create: `src/components/chat/MessageList.tsx`, `src/components/chat/MessageBubble.tsx`

- [ ] **Step 1: Write `src/components/chat/MessageBubble.tsx`**

```tsx
// src/components/chat/MessageBubble.tsx
'use client'

import type { UIMessage } from '@ai-sdk/react'
import { motion } from 'framer-motion'

export interface MessageBubbleProps {
  message: UIMessage
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user'

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: [0.2, 0.7, 0.2, 1] }}
      className={isUser ? 'flex justify-end' : 'flex justify-start'}
    >
      <div
        className={
          isUser
            ? 'max-w-[80%] rounded-xl bg-accent-soft text-ink px-4 py-2 text-[16px] leading-[1.65]'
            : 'max-w-[85%] text-ink text-[16px] leading-[1.65] whitespace-pre-wrap'
        }
      >
        {message.parts?.map((part, idx) => {
          if (part.type === 'text') {
            return <span key={idx}>{part.text}</span>
          }
          // Tool parts are rendered in Task 32.
          return null
        })}
      </div>
    </motion.div>
  )
}
```

- [ ] **Step 2: Write `src/components/chat/MessageList.tsx`**

```tsx
// src/components/chat/MessageList.tsx
'use client'

import type { UIMessage } from '@ai-sdk/react'
import { useLayoutEffect, useRef } from 'react'
import { MessageBubble } from './MessageBubble'

export interface MessageListProps {
  messages: UIMessage[]
  isThinking: boolean
}

export function MessageList({ messages, isThinking }: MessageListProps) {
  const turnRefs = useRef<Array<HTMLElement | null>>([])

  // Group consecutive messages into "turns": each user message starts a new turn
  // and collects the immediately following assistant responses.
  const turns: Array<{ key: string; items: UIMessage[] }> = []
  for (const m of messages) {
    if (m.role === 'user' || turns.length === 0) {
      turns.push({ key: m.id, items: [m] })
    } else {
      turns[turns.length - 1].items.push(m)
    }
  }

  useLayoutEffect(() => {
    const last = turnRefs.current[turns.length - 1]
    if (!last) return
    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches
    last.scrollIntoView({
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
      block: 'start',
    })
  }, [turns.length])

  return (
    <div
      className="mx-auto w-full px-6 pt-6"
      style={{ maxWidth: 'var(--reading-width)' }}
    >
      <div className="flex flex-col gap-10">
        {turns.map((turn, idx) => (
          <section
            key={turn.key}
            ref={(el) => {
              turnRefs.current[idx] = el
            }}
            className="flex flex-col gap-4 scroll-mt-6"
            style={{
              minHeight:
                idx === turns.length - 1
                  ? 'calc(100dvh - var(--header-h) - var(--composer-h) - var(--safe-bottom) - 48px)'
                  : undefined,
            }}
          >
            {turn.items.map((m) => (
              <MessageBubble key={m.id} message={m} />
            ))}
            {idx === turns.length - 1 && isThinking ? (
              <ThinkingPlaceholder />
            ) : null}
          </section>
        ))}
      </div>
    </div>
  )
}

// Replaced by the real ThinkingIndicator in Task 27.
function ThinkingPlaceholder() {
  return <div className="text-ink-dim">Thinking…</div>
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/chat/MessageList.tsx src/components/chat/MessageBubble.tsx
git commit -m "feat(chat): add MessageList with top-anchored scroll and MessageBubble"
```

---

## Task 27: `ThinkingIndicator` (reading cursor)

**Files:**
- Create: `src/components/chat/ThinkingIndicator.tsx`
- Modify: `src/components/chat/MessageList.tsx`

- [ ] **Step 1: Write `src/components/chat/ThinkingIndicator.tsx`**

```tsx
// src/components/chat/ThinkingIndicator.tsx
'use client'

export function ThinkingIndicator() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Thinking"
      className="relative inline-flex items-center text-ink-dim text-[16px] leading-[1.65]"
    >
      <span className="relative inline-block overflow-hidden pr-0.5">
        Thinking
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 w-[2px] bg-accent rounded-full"
          style={{
            boxShadow: '0 0 6px 1px var(--accent)',
            animation: 'rd-reading-cursor 1.6s var(--ease-out) infinite',
          }}
        />
      </span>
      <span className="sr-only">Thinking</span>
    </div>
  )
}
```

- [ ] **Step 2: Wire it into `MessageList`**

Edit `src/components/chat/MessageList.tsx` — replace the `ThinkingPlaceholder` with the real indicator:

```tsx
import { ThinkingIndicator } from './ThinkingIndicator'

// ...in the JSX, replace <ThinkingPlaceholder /> with <ThinkingIndicator />
// ...and delete the ThinkingPlaceholder function.
```

Final shape of the conditional render inside `MessageList`:

```tsx
{idx === turns.length - 1 && isThinking ? <ThinkingIndicator /> : null}
```

Remove the `ThinkingPlaceholder` function definition at the bottom of the file.

- [ ] **Step 3: Commit**

```bash
git add src/components/chat/ThinkingIndicator.tsx src/components/chat/MessageList.tsx
git commit -m "feat(chat): add reading-cursor ThinkingIndicator"
```

---

## Task 28: Onboarding page + hero→docked morph + useChat wiring

**Files:**
- Create: `src/app/onboarding/page.tsx`
- Modify: `src/components/chat/ChatShell.tsx`

- [ ] **Step 1: Extend `ChatShell` with docked mode wiring**

Rewrite `src/components/chat/ChatShell.tsx`:

```tsx
// src/components/chat/ChatShell.tsx
'use client'

import { useChat } from '@ai-sdk/react'
import { LayoutGroup, motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Composer } from './Composer'
import { MessageList } from './MessageList'

export interface ChatShellProps {
  initialMode: 'hero' | 'docked'
}

export function ChatShell({ initialMode }: ChatShellProps) {
  const router = useRouter()
  const [input, setInput] = useState('')
  const { messages, sendMessage, status } = useChat({
    api: '/api/onboarding-chat',
  })

  const isThinking = status === 'submitted' || status === 'streaming'

  // When mounted in docked mode, pick up any pending first message from /.
  useEffect(() => {
    if (initialMode !== 'docked') return
    try {
      const pending = sessionStorage.getItem('rd:pending-first-message')
      if (pending && pending.length > 0) {
        sessionStorage.removeItem('rd:pending-first-message')
        sendMessage({ text: pending })
      }
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMode])

  const onSubmit = () => {
    if (input.trim().length === 0) return
    if (initialMode === 'hero') {
      try {
        sessionStorage.setItem('rd:pending-first-message', input.trim())
      } catch {
        /* ignore */
      }
      router.push('/onboarding')
    } else {
      const text = input.trim()
      setInput('')
      sendMessage({ text })
    }
  }

  if (initialMode === 'hero') {
    return (
      <LayoutGroup>
        <div className="min-h-dvh flex flex-col items-center justify-center px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.2, 0.7, 0.2, 1] }}
          >
            <h1 className="font-display text-[56px] leading-[1.05] sm:text-[72px] tracking-[-0.5px] text-ink">
              A research digest, written for you.
            </h1>
            <p className="mt-4 text-[18px] text-ink-soft">
              Describe what you want to track. I&apos;ll do the reading.
            </p>
          </motion.div>

          <div className="mt-10 w-full">
            <Composer
              value={input}
              onChange={setInput}
              onSubmit={onSubmit}
              size="hero"
            />
          </div>
        </div>
      </LayoutGroup>
    )
  }

  return (
    <LayoutGroup>
      <div className="min-h-dvh flex flex-col">
        <div className="flex-1 overflow-y-auto">
          <MessageList messages={messages} isThinking={isThinking} />
        </div>
        <div
          className="sticky bottom-0 w-full pb-[var(--safe-bottom)] pt-4 bg-gradient-to-t from-bg via-bg to-transparent"
          style={{ minHeight: 'var(--composer-h)' }}
        >
          <div className="px-6">
            <Composer
              value={input}
              onChange={setInput}
              onSubmit={onSubmit}
              size="docked"
              disabled={isThinking}
            />
          </div>
        </div>
      </div>
    </LayoutGroup>
  )
}
```

Note: if the installed `@ai-sdk/react` version uses a different `useChat` API surface (e.g., `append` instead of `sendMessage`, different status names), adapt to the current surface — consult `context7` `query-docs` for `@ai-sdk/react`.

- [ ] **Step 2: Create `src/app/onboarding/page.tsx`**

```tsx
// src/app/onboarding/page.tsx
import { ChatShell } from '@/components/chat/ChatShell'
import { ThemeToggle } from '@/components/ui/ThemeToggle'

export default function OnboardingPage() {
  return (
    <main>
      <header className="sticky top-0 z-10 flex h-[var(--header-h)] items-center justify-between border-b border-line bg-bg-overlay px-4 backdrop-blur">
        <span className="font-display text-[20px] text-ink">Research Digest</span>
        <ThemeToggle />
      </header>
      <ChatShell initialMode="docked" />
    </main>
  )
}
```

- [ ] **Step 3: Manual smoke test**

```bash
npm run dev
```

Open `http://localhost:3000`. Type "I'm a clinical cardiologist tracking atrial fibrillation evidence." and press Enter. Expected:
- Composer animates from hero-center to bottom-docked (via Framer `layoutId`).
- Route changes to `/onboarding` without visual jump.
- First user message pins near the top of the viewport with breathing room.
- Reading-cursor "Thinking" appears, then streams an assistant reply.
- Assistant asks a follow-up question in ≤ 3 sentences.
- Pressing Enter with an empty composer does nothing.

Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add src/components/chat/ChatShell.tsx src/app/onboarding/page.tsx
git commit -m "feat(chat): wire useChat, docked mode, and hero→docked morph"
```

---

## Task 29: `ToolCallCard` generic shell

**Files:**
- Create: `src/components/chat/ToolCallCard.tsx`

- [ ] **Step 1: Write `src/components/chat/ToolCallCard.tsx`**

```tsx
// src/components/chat/ToolCallCard.tsx
'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { useState, type ReactNode } from 'react'

export type ToolCallState = 'pending' | 'running' | 'completed'

export interface ToolCallCardProps {
  state: ToolCallState
  pendingLabel: string
  completedLabel: string
  autoExpand?: boolean
  detail?: ReactNode
}

export function ToolCallCard({
  state,
  pendingLabel,
  completedLabel,
  autoExpand = false,
  detail,
}: ToolCallCardProps) {
  const [open, setOpen] = useState(autoExpand)

  const isDone = state === 'completed'

  return (
    <motion.section
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: [0.2, 0.7, 0.2, 1] }}
      aria-live="polite"
      className={
        'relative rounded-xl border px-4 py-3 text-[14px] ' +
        (isDone
          ? 'border-line bg-bg-elev-1 text-ink-soft'
          : 'border-accent/30 bg-bg-elev-1 text-ink-dim')
      }
    >
      {!isDone ? (
        <span
          aria-hidden
          className="absolute top-0 left-0 h-[2px] w-1/3 bg-accent rounded-full"
          style={{ animation: 'rd-reading-cursor 1.2s var(--ease-out) infinite' }}
        />
      ) : null}

      <button
        type="button"
        className="flex w-full items-center justify-between gap-3"
        onClick={() => isDone && detail && setOpen((v) => !v)}
        aria-expanded={open}
        disabled={!isDone || !detail}
      >
        <span className="flex items-center gap-2">
          <span
            aria-hidden
            className={
              'inline-block h-1.5 w-1.5 rounded-full ' +
              (isDone ? 'bg-accent' : 'bg-accent animate-pulse')
            }
          />
          <h3 className="font-medium">
            {isDone ? completedLabel : pendingLabel}
          </h3>
        </span>
        {isDone && detail ? (
          <ChevronDown
            size={16}
            className={
              'transition-transform duration-[var(--dur-sm)] ' +
              (open ? 'rotate-180' : 'rotate-0')
            }
          />
        ) : null}
      </button>

      <AnimatePresence initial={false}>
        {open && detail ? (
          <motion.div
            key="detail"
            layout
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: [0.2, 0.7, 0.2, 1] }}
            className="mt-3 overflow-hidden"
          >
            {detail}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.section>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/chat/ToolCallCard.tsx
git commit -m "feat(chat): add ToolCallCard with 3-state pending/running/completed shell"
```

---

## Task 30: `AngleProposalCard` + `ScheduleCard`

**Files:**
- Create: `src/components/chat/AngleProposalCard.tsx`, `src/components/chat/ScheduleCard.tsx`

- [ ] **Step 1: Write `src/components/chat/AngleProposalCard.tsx`**

```tsx
// src/components/chat/AngleProposalCard.tsx
'use client'

import { ToolCallCard, type ToolCallState } from './ToolCallCard'

export interface AngleProposalCardProps {
  state: ToolCallState
  result?: { angles: Array<{ text: string; rationale: string }> }
}

export function AngleProposalCard({ state, result }: AngleProposalCardProps) {
  const count = result?.angles.length ?? 0

  const detail =
    result && count > 0 ? (
      <ul className="flex flex-col gap-3">
        {result.angles.map((a, i) => (
          <li key={i}>
            <div className="text-ink text-[15px]">{a.text}</div>
            <div className="text-ink-dim text-[13px]">{a.rationale}</div>
          </li>
        ))}
      </ul>
    ) : null

  return (
    <ToolCallCard
      state={state}
      pendingLabel="Sketching the things I'll track for you…"
      completedLabel={`${count} areas proposed`}
      detail={detail}
    />
  )
}
```

- [ ] **Step 2: Write `src/components/chat/ScheduleCard.tsx`**

```tsx
// src/components/chat/ScheduleCard.tsx
'use client'

import { Chip } from '@/components/ui/Chip'
import { ToolCallCard, type ToolCallState } from './ToolCallCard'

export interface ScheduleCardProps {
  state: ToolCallState
  result?:
    | {
        ok: true
        cron: string
        timezone: string
        description: string
        nextThreeFires: string[]
      }
    | { ok: false; error: string; suggestion?: string }
}

function formatFire(iso: string, timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

export function ScheduleCard({ state, result }: ScheduleCardProps) {
  let completedLabel = 'Schedule set'
  let detail: React.ReactNode = null

  if (result && result.ok) {
    completedLabel = result.description
    detail = (
      <div className="flex flex-wrap gap-2">
        {result.nextThreeFires.map((iso, i) => (
          <Chip key={i}>{formatFire(iso, result.timezone)}</Chip>
        ))}
      </div>
    )
  } else if (result && !result.ok) {
    completedLabel = 'Need a bit more info'
    detail = (
      <p className="text-ink-dim text-[14px]">
        {result.suggestion ?? 'Let me know the schedule again.'}
      </p>
    )
  }

  return (
    <ToolCallCard
      state={state}
      pendingLabel="Working out your schedule…"
      completedLabel={completedLabel}
      detail={detail}
    />
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/chat/AngleProposalCard.tsx src/components/chat/ScheduleCard.tsx
git commit -m "feat(chat): add AngleProposalCard and ScheduleCard"
```

---

## Task 31: `SanityCheckCard` (auto-expand on warning)

**Files:**
- Create: `src/components/chat/SanityCheckCard.tsx`

- [ ] **Step 1: Write `src/components/chat/SanityCheckCard.tsx`**

```tsx
// src/components/chat/SanityCheckCard.tsx
'use client'

import { ToolCallCard, type ToolCallState } from './ToolCallCard'

type Verdict = 'healthy' | 'sparse' | 'empty' | 'error'

export interface SanityCheckCardProps {
  state: ToolCallState
  result?: {
    results: Array<{
      angleText: string
      count30d: number
      papersPerRun: number
      verdict: Verdict
      sampleTitles?: string[]
    }>
  }
}

export function SanityCheckCard({ state, result }: SanityCheckCardProps) {
  const items = result?.results ?? []
  const nonHealthy = items.filter((r) => r.verdict !== 'healthy')
  const healthy = items.filter((r) => r.verdict === 'healthy')
  const hasWarnings = nonHealthy.length > 0

  const completedLabel = hasWarnings
    ? `${nonHealthy.length} area${nonHealthy.length === 1 ? '' : 's'} look sparse — take a look`
    : 'All areas look healthy'

  const detail =
    items.length > 0 ? (
      <div className="flex flex-col gap-3">
        {nonHealthy.map((r, i) => (
          <div
            key={i}
            className="rounded-lg border border-warn/40 bg-warn-soft px-3 py-2"
          >
            <div className="text-ink text-[14px] font-medium">{r.angleText}</div>
            <div className="text-ink-dim text-[12px]">
              ~{r.papersPerRun.toFixed(1)} papers/run · {r.verdict}
            </div>
            {r.sampleTitles && r.sampleTitles.length > 0 ? (
              <ul className="mt-1 list-disc pl-4 text-ink-dim text-[12px]">
                {r.sampleTitles.map((t, j) => (
                  <li key={j}>{t}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ))}
        {healthy.length > 0 ? (
          <p className="text-ink-dim text-[13px]">
            {healthy.length} other area{healthy.length === 1 ? '' : 's'} look good.
          </p>
        ) : null}
      </div>
    ) : null

  return (
    <ToolCallCard
      state={state}
      pendingLabel="Checking how active each area is…"
      completedLabel={completedLabel}
      autoExpand={hasWarnings}
      detail={detail}
    />
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/chat/SanityCheckCard.tsx
git commit -m "feat(chat): add SanityCheckCard with auto-expand on warnings"
```

---

## Task 32: Wire tool parts into `MessageList` rendering

**Files:**
- Modify: `src/components/chat/MessageBubble.tsx`

- [ ] **Step 1: Extend `MessageBubble.tsx` to render tool parts**

Replace the contents of `src/components/chat/MessageBubble.tsx`:

```tsx
// src/components/chat/MessageBubble.tsx
'use client'

import type { UIMessage } from '@ai-sdk/react'
import { motion } from 'framer-motion'
import { AngleProposalCard } from './AngleProposalCard'
import { ScheduleCard } from './ScheduleCard'
import { SanityCheckCard } from './SanityCheckCard'
import type { ToolCallState } from './ToolCallCard'

export interface MessageBubbleProps {
  message: UIMessage
}

type ToolPart = {
  type: string
  toolCallId?: string
  state?: string
  input?: unknown
  output?: unknown
}

function mapState(part: ToolPart): ToolCallState {
  // AI SDK v6 part state names; adjust if context7 shows different names.
  const s = part.state ?? ''
  if (s.includes('result') || s.includes('complete') || s.includes('output-available')) {
    return 'completed'
  }
  if (s.includes('call') || s.includes('running') || s.includes('input-available')) {
    return 'running'
  }
  return 'pending'
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user'

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: [0.2, 0.7, 0.2, 1] }}
      className={isUser ? 'flex justify-end' : 'flex flex-col gap-3'}
    >
      {isUser ? (
        <div className="max-w-[80%] rounded-xl bg-accent-soft text-ink px-4 py-2 text-[16px] leading-[1.65]">
          {message.parts?.map((part, idx) =>
            part.type === 'text' ? <span key={idx}>{part.text}</span> : null,
          )}
        </div>
      ) : (
        message.parts?.map((part, idx) => {
          if (part.type === 'text') {
            return (
              <div
                key={idx}
                className="max-w-[85%] text-ink text-[16px] leading-[1.65] whitespace-pre-wrap"
              >
                {part.text}
              </div>
            )
          }

          const typed = part as unknown as ToolPart
          if (typed.type === 'tool-proposeAngles') {
            return (
              <AngleProposalCard
                key={idx}
                state={mapState(typed)}
                result={typed.output as AngleProposalResult | undefined}
              />
            )
          }
          if (typed.type === 'tool-normalizeSchedule') {
            return (
              <ScheduleCard
                key={idx}
                state={mapState(typed)}
                result={typed.output as ScheduleResult | undefined}
              />
            )
          }
          if (typed.type === 'tool-corpusSanityCheck') {
            return (
              <SanityCheckCard
                key={idx}
                state={mapState(typed)}
                result={typed.output as SanityResult | undefined}
              />
            )
          }
          // generateConfig transitions the whole UI; handled in Task 33.
          return null
        })
      )}
    </motion.div>
  )
}

type AngleProposalResult = { angles: Array<{ text: string; rationale: string }> }
type ScheduleResult =
  | { ok: true; cron: string; timezone: string; description: string; nextThreeFires: string[] }
  | { ok: false; error: string; suggestion?: string }
type SanityResult = {
  results: Array<{
    angleText: string
    count30d: number
    papersPerRun: number
    verdict: 'healthy' | 'sparse' | 'empty' | 'error'
    sampleTitles?: string[]
  }>
}
```

Note: the exact part `type` strings for tool calls in AI SDK v6 may be `tool-<name>` or include an `output-available` state — confirm via `context7` `query-docs` for `@ai-sdk/react` and adjust the string matches if needed.

- [ ] **Step 2: Smoke test in the browser**

```bash
npm run dev
```

Run through an onboarding conversation until it fires `proposeAngles` → expect an inline card with pending → completed transition and an expand affordance. Continue to the schedule and sanity-check steps. Stop the dev server.

- [ ] **Step 3: Commit**

```bash
git add src/components/chat/MessageBubble.tsx
git commit -m "feat(chat): render tool parts as inline AngleProposal/Schedule/SanityCheck cards"
```

---

## Task 33: `ConfigSummary` + `generateConfig` handoff

**Files:**
- Create: `src/components/config/ConfigSummary.tsx`
- Modify: `src/components/chat/ChatShell.tsx`

- [ ] **Step 1: Write `src/components/config/ConfigSummary.tsx`**

```tsx
// src/components/config/ConfigSummary.tsx
'use client'

import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Chip } from '@/components/ui/Chip'
import type { DigestConfig } from '@/lib/config-schema'

export interface ConfigSummaryProps {
  config: DigestConfig
  onReset: () => void
}

function formatFire(iso: string, timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

export function ConfigSummary({ config, onReset }: ConfigSummaryProps) {
  const download = () => {
    const blob = new Blob([JSON.stringify(config, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'research-digest-config.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <main
      className="mx-auto flex flex-col gap-6 px-6 py-10"
      style={{ maxWidth: 'var(--reading-width)' }}
    >
      <h1 className="font-display text-[42px] leading-[1.15] text-ink">
        Your digest is ready to go.
      </h1>

      <Card>
        <h2 className="font-display text-[20px] text-ink">Subject</h2>
        <p className="mt-2 text-[18px] text-ink">{config.subject}</p>
      </Card>

      <Card>
        <h2 className="font-display text-[20px] text-ink">Schedule</h2>
        <p className="mt-2 text-[16px] text-ink">{config.schedule.description}</p>
        <p className="mt-1 text-[13px] text-ink-dim">
          Timezone: {config.schedule.timezone} · Volume: ~{config.volume_target} papers per digest
        </p>
      </Card>

      <Card>
        <h2 className="font-display text-[20px] text-ink">Areas I'll track</h2>
        <ul className="mt-3 flex flex-col gap-2">
          {config.core_angles.map((a) => (
            <li key={a.id} className="flex items-start gap-2 text-[15px] text-ink">
              <Chip>{a.priority}</Chip>
              <span>{a.text}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <h2 className="font-display text-[20px] text-ink">About you</h2>
        <p className="mt-2 whitespace-pre-wrap text-[15px] leading-[1.65] text-ink">
          {config.profile}
        </p>
      </Card>

      <Card>
        <h2 className="font-display text-[20px] text-ink">How I'll write it</h2>
        <p className="mt-2 whitespace-pre-wrap text-[15px] leading-[1.65] text-ink">
          {config.output_style}
        </p>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="primary" size="lg" onClick={download}>
          Download config (JSON)
        </Button>
        <Button variant="ghost" onClick={onReset}>
          Start a new digest
        </Button>
      </div>

      <p className="text-[13px] text-ink-faint">
        Saved in this browser for now. We&apos;ll hook it to your account in the next phase.
      </p>
    </main>
  )
}
```

- [ ] **Step 2: Extract the finalized config from tool parts in `ChatShell`**

Edit `src/components/chat/ChatShell.tsx` — at the top, add imports:

```tsx
import { ConfigSummary } from '@/components/config/ConfigSummary'
import type { DigestConfig } from '@/lib/config-schema'
```

Inside the `ChatShell` function body (docked branch), add a selector over `messages` that finds the most recent `generateConfig` completed tool part with an `ok: true` result:

```tsx
const finalConfig: DigestConfig | null = (() => {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (!m.parts) continue
    for (const p of m.parts) {
      const tp = p as unknown as { type: string; output?: { ok?: boolean; config?: DigestConfig } }
      if (tp.type === 'tool-generateConfig' && tp.output?.ok === true && tp.output.config) {
        return tp.output.config
      }
    }
  }
  return null
})()

const onReset = () => {
  try {
    localStorage.removeItem('rd:onboarding:v1')
    sessionStorage.removeItem('rd:pending-first-message')
  } catch {
    /* ignore */
  }
  router.push('/')
}
```

Then, in the docked branch, before returning the chat JSX, render `ConfigSummary` if `finalConfig` is set:

```tsx
if (finalConfig) {
  return <ConfigSummary config={finalConfig} onReset={onReset} />
}
```

- [ ] **Step 3: Manual smoke test**

```bash
npm run dev
```

Complete a full onboarding conversation from `/` all the way through schedule + sanity check + config assembly. Expected: when the agent calls `generateConfig` successfully, the chat replaces itself with the `ConfigSummary` screen. Click "Download config (JSON)" — a `research-digest-config.json` file saves. Re-import it and visually verify every field matches the spec. Click "Start a new digest" — returns to `/` with cleared state. Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add src/components/config/ConfigSummary.tsx src/components/chat/ChatShell.tsx
git commit -m "feat(chat): transition to ConfigSummary on generateConfig success"
```

---

## Task 34: End-to-end manual verification + cost check

**Files:** none (verification + optional fixes)

- [ ] **Step 1: Run all automated checks**

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

Expected: all four pass. Fix any type, lint, test, or build regressions before proceeding.

- [ ] **Step 2: Run the manual verification checklist from the spec**

Open `docs/superpowers/specs/2026-04-13-phase-1-onboarding-design.md` and walk through **every** checkbox in §8.2. Specifically:

- **Boot:** `/` loads, hero composer focused, theme toggle visible.
- **Hero → docked morph:** smooth, reduced-motion disables it, route change is clean.
- **Onboarding flow:** new user messages pin to the top with breathing room; reading-cursor indicator appears and dissolves on first token; word-by-word streaming; agent obeys the conversational discipline (no jargon leakage); all four tool cards behave (pending/running/completed, auto-expand on sparse warnings); `generateConfig` transitions to `ConfigSummary`.
- **Config summary:** shows subject, schedule sentence + 3 chips, angles with priority chips, profile + output_style prose. Download JSON produces a valid `DigestConfig`. "Start a new digest" clears state.
- **Design + motion:** verify with DevTools that no hex literals are in components:

  ```bash
  grep -RnE '#[0-9a-fA-F]{3,6}' src/components/ || echo 'no hex literals'
  ```

  Expected: `no hex literals`.
- **Anonymous state:** `rd_session` cookie set; `rd:onboarding:v1` survives refresh; refreshing `/onboarding` with `finalConfig` in localStorage lands on `ConfigSummary`; clearing localStorage resets cleanly.
- **Accessibility:** Tab order through composer → send → messages; `prefers-reduced-motion` disables morph/scroll/reading-cursor; screen reader announces tool-call state changes.

- [ ] **Step 3: Measure cost**

With `OPENROUTER_API_KEY` set, add a temporary `console.log` of `result.usage` (or the v6 equivalent) at the bottom of `src/app/api/onboarding-chat/route.ts`, then run a full onboarding conversation end-to-end. Read the cumulative token usage from the dev console. Confirm the full conversation cost stays ≤ $0.04 at current DeepSeek v3.2 pricing on OpenRouter.

Remove the temporary `console.log` after measuring.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: complete Phase 1 onboarding manual verification pass"
```

---

## Phase 1 complete — acceptance criteria summary

By the end of Task 34 the project should satisfy all of these (each maps to the spec):

- [x] Anonymous user can land on `/`, see the hero composer, type, watch the hero→docked morph, and run a 4–6 turn onboarding conversation with streaming replies.
- [x] Agent produces a schema-valid `DigestConfig` via the four tools (`proposeAngles`, `normalizeSchedule`, `corpusSanityCheck`, `generateConfig`).
- [x] `ConfigSummary` end-screen shows every field and downloads a valid JSON.
- [x] All automated tests pass (`config-schema`, `schedule`, `openalex-client`, `corpus-sanity`, `tools`).
- [x] Light-default design system with dark-mode toggle, no hex literals in components, Instrument Serif + Inter + JetBrains Mono typefaces.
- [x] Anonymous state persists across refresh (`rd_session` cookie + `rd:onboarding:v1` localStorage).
- [x] Full conversation cost ≤ $0.04 on DeepSeek v3.2.
- [x] Next.js app is portable (Node runtime, no Vercel- or Cloudflare-specific APIs) — deployment target remains open.

Phase 2 picks up from here: build the pipeline (planner/retriever/filter/curator) and wire a real preview digest into the end of onboarding, replacing the "we'll hook this up next phase" note on `ConfigSummary`.
