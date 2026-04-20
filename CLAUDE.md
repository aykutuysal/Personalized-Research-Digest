@AGENTS.md

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — Next.js 16 dev server (Turbopack).
- `npm run build` / `npm run start` — production build and serve.
- `npm run lint` — ESLint via `eslint-config-next` (flat config).
- `npm run typecheck` — `tsc --noEmit`; strict mode is on.
- `npm test` — Vitest single run. `npm run test:watch` for watch mode. Run one file with `npx vitest run test/tools.test.ts`, one case with `-t "substring"`.

Required env vars (see `.env.local.example`): `OPENROUTER_API_KEY`, `OPENALEX_MAILTO`. Optional: `OPENALEX_API_KEY`.

## Stack notes that will bite you

- **Next.js 16 + React 19 + AI SDK v6 + Tailwind v4.** All four have breaking changes vs. training data. Before writing code against any of them, check `node_modules/next/dist/docs/` or pull current docs via the context7 MCP.
- **AI SDK v6 gotchas** (documented in `docs/superpowers/notes/2026-04-13-ai-sdk-v6-corrections.md`): `convertToModelMessages` is async — must be awaited. `useChat` takes a `transport: new DefaultChatTransport({ api })`, not a bare `api` field. Stream response method is `toUIMessageStreamResponse()`, not `toDataStreamResponse()`. Tool-call parts are typed `tool-<NAME>` and must guard on `part.state === 'output-available'` before reading `part.output` (use `part.errorText` on `output-error`).
- **`cookies()` and `headers()` are async** in Next 16 — see `src/lib/session.ts` for the pattern.

## Big-picture architecture

This is the clean rewrite of a research-digest pipeline. Context: `docs/2026-04-13-BRIEF.md` and `docs/2026-04-13-PRD.md` are the source of truth; `iter/` holds the prior iteration study that validated the approach — treat it as reference data, not importable code.

**The product is a 4-stage pipeline** (planner → retriever → filter → curator), where onboarding produces the config that drives every scheduled run. Current code implements Phase 2 (onboarding agent + UI shell); Phase 1 pipeline + persistence are not yet in the tree.

**Config is the contract.** `src/lib/config-schema.ts` defines `DigestConfig` — 7 user-facing fields plus version metadata. Key invariants from the brief:
- `profile` is the *only* input to the downstream filter; `output_style` is the *only* input to the curator. No cross-contamination.
- `research_areas` is the retrieval contract. Every area must produce ≥1 query per run — no silent drops.
- Configs are never mutated in place — every change creates a new version row (when persistence lands).

**Onboarding flow** (`src/app/api/onboarding-chat/route.ts` + `src/components/chat/ChatShell.tsx` + `src/components/plan/ResearchPlanView.tsx`):

1. Chat collects four fields (subject, profile, output_style, research_areas) via `proposeResearchAreas` + `handoffToPlan`. No cadence, no showcase.
2. `handoffToPlan` validates against `digestConfigSchema.omit({ schedule, version, created_at, updated_at, search_queries })`. On success, the UI transitions to `ResearchPlanView`.
3. Research Plan view is fully editable. Clicking "Preview your digest" opens an SSE connection to `/api/preview-digest`, which runs the v9.2 pipeline (seed→vocab→compact library→per-week retrieval→editorial curator).
4. After the preview lands, a cadence picker (`CadenceSection`) computes a `Schedule` client-side via `src/lib/schedule/build-cron.ts` — no LLM call.
5. `SubscribeSection` validates the whole config against `subscribableConfigSchema` and shows a placeholder toast (no persistence yet).

**Type sharing without server leakage.** `src/lib/ai/chat-types.ts` defines `ResearchChatMessage = UIMessage<never, never, OnboardingUITools>` and is imported by both server and client. It uses `import type` from `onboarding-tools.ts` — the runtime module has `import 'server-only'` at the top, but the type import is erased so no server code ships to the client. Don't turn this into a runtime import.

**`server-only` and Vitest.** Server-gated modules (`onboarding-tools.ts`, `propose-research-areas.ts`, `openrouter.ts`, and the preview/discovery modules) import `'server-only'`, which throws under Vitest's default condition. `vitest.config.ts` aliases `server-only` to the package's `empty.js` stub so tests can import these modules directly. Don't add `'server-only'` to files that must run in the browser.

**OpenAlex client** (`src/lib/openalex/client.ts`) enforces the polite pool (requires `OPENALEX_MAILTO`), has retry with exponential backoff on 429/5xx, and applies a fixed `type:` filter. All corpus lookups go through `searchByKeyword`.

**Schedule building** (`src/lib/schedule/build-cron.ts`) is a pure deterministic cadence→`Schedule` mapper driven by the `CadenceSection` UI (daily / weekdays / weekly / monthly + time + timezone). No LLM, no natural-language parsing.

## Directory map (non-obvious parts)

- `src/app/api/onboarding-chat/route.ts` — the only live API route; streams from AI SDK v6.
- `src/lib/ai/` — server-only LLM glue. `openrouter.ts` lazily initializes the provider so tests can mock it.
- `src/components/chat/` — the chat UI. `ChatShell` owns state + transport; `MessageList` dispatches on `part.type` to render tool cards.
- `prompts/` — system prompts loaded from disk at request time (cached). Editing these changes agent behavior without a code change.
- `test/` — Vitest tests; `test/helpers.ts` has `runTool` and `toolCtx` shims for invoking AI SDK tools directly.
- `iter/` — frozen Python/JSON iteration study that validated the angles-first approach. Read for context; do not import.
- `docs/2026-04-13-BRIEF.md`, `docs/2026-04-13-PRD.md` — product source of truth. `docs/superpowers/plans/` and `docs/superpowers/notes/` track in-flight plan + SDK corrections.
