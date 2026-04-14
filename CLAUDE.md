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
- `core_angles` is the retrieval contract. Every angle must produce ≥1 query per run — no silent drops.
- Configs are never mutated in place — every change creates a new version row (when persistence lands).

**Onboarding chat flow** (`src/app/api/onboarding-chat/route.ts` + `src/components/chat/ChatShell.tsx`):
1. Route handler calls `streamText` with `deepseek()` model, the `prompts/onboarding-system.md` system prompt, and the four tools from `buildOnboardingTools(sessionId)`.
2. Tools: `normalizeSchedule` (deterministic cron/tz resolver), `proposeAngles` (LLM `generateObject` call to DeepSeek), `corpusSanityCheck` (parallel OpenAlex searches, verdicts `healthy`/`sparse`/`empty`/`error`), `generateConfig` (Zod-validates and finalizes the config).
3. Client uses `useChat` with a `DefaultChatTransport`, persists `messages` to localStorage (`src/lib/storage/local.ts`), and scans `messages[].parts` for the `tool-generateConfig` success case to render the final summary.

**Type sharing without server leakage.** `src/lib/ai/chat-types.ts` defines `ResearchChatMessage = UIMessage<never, never, OnboardingUITools>` and is imported by both server and client. It uses `import type` from `onboarding-tools.ts` — the runtime module has `import 'server-only'` at the top, but the type import is erased so no server code ships to the client. Don't turn this into a runtime import.

**`server-only` and Vitest.** Server-gated modules (`onboarding-tools.ts`, `propose-angles.ts`, `openrouter.ts`) import `'server-only'`, which throws under Vitest's default condition. `vitest.config.ts` aliases `server-only` to the package's `empty.js` stub so tests can import these modules directly. Don't add `'server-only'` to files that must run in the browser.

**OpenAlex client** (`src/lib/openalex/client.ts`) enforces the polite pool (requires `OPENALEX_MAILTO`), has retry with exponential backoff on 429/5xx, and applies a fixed `type:` filter. All corpus lookups go through `searchByKeyword`.

**Schedule normalization** (`src/lib/schedule/cron.ts` + `timezone.ts`) is fully deterministic — it handles "every Monday at 9am", "weekdays", "first of each month", etc., resolves IANA timezone from a known city list, validates by round-tripping through `cron-parser`, and returns the next three fire times via `cronstrue`. It is *not* an LLM call — if you add new phrasings, extend the regex ladder and add a test.

## Directory map (non-obvious parts)

- `src/app/api/onboarding-chat/route.ts` — the only live API route; streams from AI SDK v6.
- `src/lib/ai/` — server-only LLM glue. `openrouter.ts` lazily initializes the provider so tests can mock it.
- `src/components/chat/` — the chat UI. `ChatShell` owns state + transport; `MessageList` dispatches on `part.type` to render tool cards.
- `prompts/` — system prompts loaded from disk at request time (cached). Editing these changes agent behavior without a code change.
- `test/` — Vitest tests; `test/helpers.ts` has `runTool` and `toolCtx` shims for invoking AI SDK tools directly.
- `iter/` — frozen Python/JSON iteration study that validated the angles-first approach. Read for context; do not import.
- `docs/2026-04-13-BRIEF.md`, `docs/2026-04-13-PRD.md` — product source of truth. `docs/superpowers/plans/` and `docs/superpowers/notes/` track in-flight plan + SDK corrections.
