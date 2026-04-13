# Research Digest — Phase 1: Onboarding (design spec)

**Project:** `/home/aykut/dev/workspace/ResearchDigest`
**Date:** 2026-04-13
**Source PRD:** `docs/2026-04-13-PRD.md` (especially §5, §7, §10, §11)
**Source brief:** `docs/2026-04-13-BRIEF.md`

---

## 1. Context

Research Digest is a personalized paper-tracker. The user describes their research interests once via a conversational onboarding agent and then receives scheduled digests of new papers — they never search. The PRD-defined architecture has onboarding producing a `DigestConfig` JSON (PRD §5.1), which downstream stages (planner / retriever / filter / curator) consume every run.

The PRD numbers phases as (1) Pipeline, (2) Onboarding agent + UI shell, (3) Persistence + auth, etc. — and insists that the pipeline hit the quality gate before anything else is built. This phase deliberately diverges from that order on the user's decision: **we build onboarding first, ending at a validated `DigestConfig`.** The trade-off: we cannot measure digest quality until Phase 2 builds the pipeline, but we get the highest-UX-leverage piece working first, exercise the trickiest external dependency (OpenAlex via the corpus-sanity check), and ship a smaller, cleaner milestone with a stable contract (the Zod-validated config) for Phase 2 to plug into.

The feel the user wants is distinct: light-mode default, warm cream surfaces, near-black ink, a single dark-emerald action color, serif display type — clever, clean, professional, "a smart new guy on the block" for readers who want science updates. The signature interaction is a hero chat input that smoothly morphs down into a bottom-docked composer on first message, then runs a top-anchored, streaming conversation with inline tool-call cards and a unique "reading cursor" thinking indicator.

Deployment target is deferred (user wasn't sure between Vercel and Cloudflare). Phase 1 runs locally via `npm run dev` and uses only portable Next.js patterns so either target stays open.

---

## 2. Scope & acceptance

### In scope

- Fresh Next.js 16 scaffold in-place at `/home/aykut/dev/workspace/ResearchDigest` (docs/ stays where it is).
- Stack: TypeScript 5 strict, Tailwind CSS 4, Vitest 4, Vercel AI SDK 6 + `@ai-sdk/react`, `@openrouter/ai-sdk-provider` targeting `deepseek/deepseek-v3.2`, Zod 4, Framer Motion (for the hero→docked shared-element morph + layout animations), `cron-parser` + `cronstrue` (for schedule normalization), `next/font` for typefaces, Lucide React for icons.
- `DigestConfig` Zod schema from PRD §5.1 as the single source of truth for onboarding output.
- Minimal OpenAlex client: keyword search (with `from_publication_date`/`to_publication_date`/`type` filter), paginated fetch, abstract reconstruction from inverted index. Enough to serve `corpusSanityCheck`; the full pipeline retriever is Phase 2.
- Streaming onboarding chat route (`/api/onboarding-chat`) powered by Vercel AI SDK, with four tools:
  - `proposeAngles` — inner LLM call that returns 6–12 candidate angles for a subject + profile.
  - `normalizeSchedule` — pure parser (no LLM) that converts natural-language schedules to `{cron, timezone, description, nextThreeFires}`.
  - `corpusSanityCheck` — real OpenAlex calls computing papers/run per angle with cadence-aware verdicts.
  - `generateConfig` — validates assembled config against `digestConfigSchema`, returns ok/errors.
- Landing page (`/`) with a hero chat input front-and-center.
- Onboarding chat page (`/onboarding`) with the bottom-docked composer, top-anchored message scroll, streaming assistant replies, inline tool-call cards, reading-cursor thinking animation, and an end-of-flow `ConfigSummary` screen with a download-JSON button.
- Anonymous state: `rd_session` HTTP-only cookie (UUID v4), plus typed localStorage (`rd:onboarding:v1`) mirroring the `useChat` messages + `configDraft`. No server-side store.
- Light-default design system (cream surfaces, warm near-black ink, dark emerald action), dark mode as a secondary toggle. All tokens live as CSS custom properties wired into Tailwind 4 `@theme` so polish iterations change tokens only.
- Vitest unit tests for pure logic (schema, schedule, sanity-check math, OpenAlex URL builder) + tool-execute smoke tests with stubbed providers.
- Manual verification checklist covering local dev, the onboarding flow, design/motion, and anonymous state.

### Out of scope (Phase 2+)

- Query planner, retriever, filter, curator (full pipeline).
- `/api/preview` route and live preview digest rendering.
- PRD §12.1 pipeline quality-gate fixture tests.
- Supabase setup, auth, DB persistence, session→user linking.
- Trigger.dev schedules, Resend email delivery, React Email templates.
- Update agent, feedback loop, version history, rollback UI.
- Payment, tier enforcement, rate limiting, observability.
- End-to-end Playwright tests (likely Phase 3+).
- UI component unit tests (manual verification covers Phase 1's surface).

### Acceptance criterion

An anonymous user can:

1. Land on `/` and see the hero composer front and center.
2. Type a message and watch the composer smoothly dock to the bottom of the viewport while routing to `/onboarding`.
3. Complete a 4–6 turn conversation covering role/context → subject → intent → angles → schedule → corpus-sanity check → config assembly.
4. See inline tool-call cards for each tool with `pending` → `running` → `completed` states, collapsed by default (sanity-check auto-expands on warnings).
5. Land on the `ConfigSummary` screen showing their subject, schedule sentence, angles, profile, and output-style prose.
6. Download a JSON file that validates cleanly against `digestConfigSchema`.

Automated tests pass, and the full conversation cost stays ≤ $0.04 on DeepSeek v3.2.

---

## 3. Architecture & directory layout

```
ResearchDigest/
├── docs/                              # existing: PRD, brief
├── prompts/
│   ├── onboarding-system.md           # main agent system prompt (PRD §7.2 discipline)
│   └── propose-angles-system.md       # inner LLM call for proposeAngles tool
├── src/
│   ├── app/
│   │   ├── layout.tsx                 # theme script injection, font loading, globals
│   │   ├── page.tsx                   # landing: hero ChatShell in 'hero' mode
│   │   ├── onboarding/page.tsx        # docked ChatShell in 'docked' mode
│   │   └── api/
│   │       └── onboarding-chat/route.ts  # POST: streamText + tools + session
│   ├── components/
│   │   ├── chat/
│   │   │   ├── ChatShell.tsx          # owns hero ↔ docked, mounts composer+list
│   │   │   ├── MessageList.tsx        # top-anchored scroll, renders UIMessage[]
│   │   │   ├── MessageBubble.tsx      # user/assistant rendering, stream cursor
│   │   │   ├── Composer.tsx           # autoresize textarea, Framer layoutId
│   │   │   ├── ThinkingIndicator.tsx  # reading-cursor animation
│   │   │   ├── ToolCallCard.tsx       # generic 3-state shell (pending/running/done)
│   │   │   ├── AngleProposalCard.tsx  # expanded view for proposeAngles result
│   │   │   ├── ScheduleCard.tsx       # expanded view for normalizeSchedule result
│   │   │   └── SanityCheckCard.tsx    # expanded view; auto-expands on warning
│   │   ├── config/
│   │   │   └── ConfigSummary.tsx      # end-of-flow screen + download JSON
│   │   └── ui/
│   │       ├── Button.tsx
│   │       ├── Card.tsx
│   │       ├── Chip.tsx
│   │       └── ThemeToggle.tsx        # sun/moon ghost button (top-right)
│   ├── lib/
│   │   ├── config-schema.ts           # Zod: digestConfigSchema (PRD §5.1)
│   │   ├── openalex/
│   │   │   ├── client.ts              # searchByKeyword, paginated, type filter, mailto
│   │   │   └── abstract.ts            # inverted-index → string
│   │   ├── ai/
│   │   │   ├── openrouter.ts          # shared model provider factory
│   │   │   ├── onboarding-tools.ts    # tool() definitions for the 4 tools
│   │   │   └── propose-angles.ts      # inner LLM call used by the tool
│   │   ├── schedule/
│   │   │   ├── cron.ts                # parse/validate/describe + nextFires
│   │   │   └── timezone.ts            # city→IANA helper (small built-in map)
│   │   ├── session.ts                 # rd_session cookie read/write
│   │   ├── theme.ts                   # data-theme toggle + localStorage
│   │   └── storage/
│   │       └── local.ts               # typed rd:onboarding:v1 state
│   └── styles/
│       └── globals.css                # Tailwind + tokens + @theme + keyframes
├── test/
│   ├── fixtures/
│   │   └── profiles/                  # 4 iter profiles ported as JSON
│   ├── config-schema.test.ts
│   ├── schedule.test.ts
│   ├── corpus-sanity.test.ts
│   ├── openalex-client.test.ts
│   └── tools.test.ts                  # smoke tests for each tool's execute()
├── .env.local.example                 # OPENROUTER_API_KEY, OPENALEX_MAILTO
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── next.config.ts
```

Portability notes: no Vercel-specific APIs (no `@vercel/kv`, `@vercel/edge-config`, etc.); no Cloudflare-specific bindings. The `/api/onboarding-chat` route is explicitly Node runtime (`export const runtime = 'nodejs'`) so OpenAlex fetches and the inner LLM call run without edge constraints.

---

## 4. Onboarding backend

### 4.1 `/api/onboarding-chat` route

- **Runtime:** `nodejs` (explicit).
- **Model:** `deepseek/deepseek-v3.2` via `@openrouter/ai-sdk-provider`.
- **Temperature:** 0.7.
- **SDK surface:** `streamText` from `ai` with `toolCallStreaming: true` (or the current equivalent per the latest Vercel AI SDK v6 docs — verify via context7 MCP at implementation time). Returns `toDataStreamResponse()` so the client's `useChat` hook consumes it.
- **Request body:** standard `UIMessage[]` from `useChat`. No server-side conversation store; chat state is client-owned.
- **System prompt:** loaded from `prompts/onboarding-system.md` at request start (fs read, not inlined) so prompt iteration doesn't require redeployment.
- **Tools:** the four defined in `src/lib/ai/onboarding-tools.ts` (§4.3).
- **Session:** reads/writes the `rd_session` cookie via `src/lib/session.ts`; passes the session id into `corpusSanityCheck.execute` for logging only.
- **Error handling:** attempts one repair on tool-call JSON parse failure via the SDK's repair hook; on catastrophic failure returns a user-facing `"Something went wrong, try again in a moment"` message in the stream.

### 4.2 System prompt (`prompts/onboarding-system.md`)

Structured around four blocks:

1. **Role + voice.** Single short paragraph defining the assistant as a clever, sophisticated research companion. No exclamation marks. No corporate filler. Confident but never arrogant. Writes as if it reads papers for a living.
2. **Conversational discipline (PRD §7.2 verbatim).**
   - One question per message. Never two.
   - 2–3 sentences per message. Never long paragraphs.
   - Give before you ask: after the first turn, every reply reflects/infers something that proves understanding, then asks the next question.
   - Suggest before they ask: when you can infer sections/depth/adjacent areas, propose them.
   - No system jargon ever: never say "config", "OpenAlex", "query", "topic", "schema", "angle list" (say "the specific things I'll track for you").
   - Don't ask about things you can infer.
   - Aim for a finalizable config in 4–6 exchanges. Hard wrap at ~10.
3. **Information goals (achievable in any order).**
   - Role + context
   - Subject
   - Intent (what they want to DO with the research)
   - Anti-interests (captured into profile prose)
   - Style preferences (often inferred)
   - Schedule (always asked explicitly; never defaulted silently)
4. **Tool use rules.**
   - Call `proposeAngles` once subject + role + intent are understood. Narrate the angles back in natural language, not as a raw list dump; the UI card renders the structured list.
   - Call `normalizeSchedule` after the user describes when they want the digest. Confirm the cron description + next three fire times verbally before continuing.
   - Call `corpusSanityCheck` after angles AND schedule are both settled. Surface `sparse`/`empty` verdicts with cadence-aware language and offer merge/flag/drop.
   - Call `generateConfig` when all fields are ready. If it returns errors, fix the specific fields named and retry.
   - Never describe a tool call to the user as a "tool call".

### 4.3 Tools (`src/lib/ai/onboarding-tools.ts`)

Every tool is a Vercel AI SDK v6 `tool({ description, inputSchema, execute })` with a Zod input schema and a typed return. Descriptions are written for the LLM (what the tool does, when to call it). Input schemas use Zod 4 with `.describe()` on every field for LLM clarity.

**`proposeAngles`**
- **Input:** `{ subject: string, profileSummary: string, hints?: string }`
- **Execute:** calls `src/lib/ai/propose-angles.ts`, which runs a single `generateObject` (or equivalent) against DeepSeek v3.2 with a dedicated prompt (`prompts/propose-angles-system.md`). That prompt instructs the model to return 6–12 angles preferring productive sub-areas with clear vocabulary, avoiding too-generic ("randomized trials") or too-narrow angles, and to attach a one-sentence rationale per angle.
- **Output (Zod):** `{ angles: Array<{ text: string, rationale: string }> }`
- **Cost:** ~$0.004 per call.
- **Validation:** asserts `6 ≤ angles.length ≤ 12`; on violation, retries once with a corrective system message.

**`normalizeSchedule`**
- **Input:** `{ naturalLanguage: string, city?: string, timezone?: string }`
- **Execute:** pure — no LLM. A tiny hand-rolled regex/keyword pipeline maps common English phrases ("every Monday at 9 AM", "daily at 7am", "every other day", "first of every month", "twice a week Mon and Thu", "weekdays at 8") to cron field sets. Default time 09:00 if unspecified. Resolves `city` via a small built-in `CITY_TO_IANA` map (Istanbul, Ankara, London, Berlin, Paris, NYC, LA, Tokyo, Sydney, Toronto, Amsterdam, Madrid, Lisbon, Rome — ~30 cities covering the most likely v1 users). If `timezone` is passed directly, uses it. If neither resolves, returns `{ error: 'needsTimezone', suggestion: '…' }` so the agent asks again.
- Uses `cron-parser` to compute the next three fire times in the resolved timezone.
- Uses `cronstrue` to generate a human sentence.
- **Output (Zod):**
  ```ts
  z.discriminatedUnion('ok', [
    z.object({
      ok: z.literal(true),
      cron: z.string(),
      timezone: z.string(),
      description: z.string(),
      nextThreeFires: z.array(z.string()).length(3), // ISO timestamps
    }),
    z.object({
      ok: z.literal(false),
      error: z.enum(['needsTimezone', 'unparseable', 'invalidCron']),
      suggestion: z.string().optional(),
    }),
  ])
  ```
- **Validation:** every output cron is round-tripped through `cron-parser` before returning to guarantee validity.

**`corpusSanityCheck`**
- **Input:** `{ subject: string, angles: Array<{ text: string }>, cadenceDays: number }`
- **Execute:** for each angle, constructs a simple planner-style query (`"<angle>" AND <subject>`), runs one OpenAlex `searchByKeyword` call scoped to the past 30 days via `from_publication_date`/`to_publication_date`, reads `meta.count`. Concurrency capped at 5 via a tiny in-file semaphore (no `p-limit` dep needed for Phase 1). Computes `papersPerRun = (count30d / 30) * cadenceDays`. Verdict: `healthy` if `papersPerRun >= 2`, `sparse` if `0 < papersPerRun < 2`, `empty` if `papersPerRun === 0` (or the query errors after backoff). Samples up to 3 top titles for `sparse`/`empty` cases so the agent can surface them.
- **Output (Zod):** `{ results: Array<{ angleText: string, count30d: number, papersPerRun: number, verdict: 'healthy'|'sparse'|'empty'|'error', sampleTitles?: string[] }> }`
- **Cost:** free (OpenAlex polite pool) + negligible bandwidth. Target: ≤ 10s total for a typical 8-angle check.
- **Error handling:** 429 → exponential backoff with 3 retries; 5xx → single retry; persistent failure → `verdict: 'error'` for that angle so the agent can finish the conversation.

**`generateConfig`**
- **Input:** `Partial<DigestConfig>` — all fields the agent has assembled (subject, schedule, profile, output_style, core_angles, volume_target, search_queries?).
- **Execute:** runs `digestConfigSchema.safeParse(input)`. On success, stamps `version: 1`, `created_at`, `updated_at`, and returns `{ ok: true, config }`. On failure, returns `{ ok: false, errors: ZodError.issues }` so the agent can name the specific missing/invalid field and ask the user to clarify.
- **Output (Zod):** discriminated union on `ok`.
- **Side effect:** on success, the client receives the final config in the tool result and transitions the UI from chat mode to `ConfigSummary`. No DB write.

### 4.4 OpenAlex client (`src/lib/openalex/`)

Minimal surface, just what Phase 1 needs. Defer the pipeline-retriever concerns (source tagging, dedupe-across-queries) to Phase 2.

```ts
// src/lib/openalex/client.ts
export async function searchByKeyword(opts: {
  query: string
  fromDate: string   // YYYY-MM-DD
  toDate: string     // YYYY-MM-DD
  perPage?: number   // default 25
  page?: number      // default 1
}): Promise<{ meta: { count: number }, results: OpenAlexWork[] }>
```

- Reads `OPENALEX_MAILTO` (required) and `OPENALEX_API_KEY` (optional) from env.
- Builds URL with `search=<query>`, `filter=from_publication_date:...,to_publication_date:...,type:article|review|book-chapter|preprint|dissertation|report|peer-review`, `per_page=<n>`, `page=<n>`, `mailto=<email>`, optional `api_key=<key>`.
- 10 s timeout per fetch (`AbortSignal.timeout`).
- Retries 429/5xx with exponential backoff (max 3 attempts, 500 ms base).
- Returns raw OpenAlex shape; `abstract.ts` has a standalone `reconstructAbstract(invertedIndex)` function for when Phase 2 needs it.

### 4.5 Anonymous state

- **Cookie (`rd_session`):** set on first GET to `/` if absent. UUID v4. HTTP-only, SameSite=Lax, Path=`/`, Max-Age=1 year. Read on `/api/onboarding-chat` for logging; not used for message storage in Phase 1.
- **localStorage (`rd:onboarding:v1`):** typed via `src/lib/storage/local.ts`. Mirrors:
  ```ts
  type OnboardingLocalState = {
    schemaVersion: 1
    sessionId: string                 // duplicated from cookie for client access
    messages: UIMessage[]              // from useChat
    configDraft: Partial<DigestConfig> // built up across tool calls
    finalConfig?: DigestConfig         // set on generateConfig success
    lastUpdated: string                // ISO timestamp
  }
  ```
- **Schema versioning:** if `schemaVersion` doesn't match, wipe and start fresh.
- **Rehydration:** on `/onboarding` mount, if localStorage has a `finalConfig`, skip straight to `ConfigSummary`. Otherwise restore `messages` + `configDraft` into `useChat`.

---

## 5. UI & motion

### 5.1 Landing (`/`)

- Full-viewport layout, vertical centering.
- Hero title: `Instrument Serif`, 72px, `text-ink`, something like *"A research digest, written for you."* (final copy to be tweaked in-file; the spec pins the typography and layout, not the exact words).
- One-line subtitle below it, `Inter` body-lg, `text-ink-soft`, ≤ 12 words.
- Below subtitle: the hero `<Composer>` (see 5.3), max-width 640px, centered, placeholder *"Tell me what you want to track…"*, focus state already active on mount.
- Below the fold (scroll only — not in the hero): a 3-step "how it works" strip in small type, followed by a minimal footer. Optional for v1; the spec requires the hero to stand alone, and the rest is space filler that can be added or removed without touching the chat.
- Theme toggle button (`ThemeToggle`) in the top-right corner.

### 5.2 Onboarding (`/onboarding`)

- Same `ChatShell` component as landing, mounted in `docked` mode.
- Three layout regions:
  - **Header (minimal):** small wordmark left, `ThemeToggle` right. Fixed, low-contrast border below.
  - **Message list:** scrollable region between header and composer. `MessageList` + `MessageBubble` + `ThinkingIndicator` + tool-call cards.
  - **Composer:** pinned to the bottom of the viewport with safe-area padding, `Framer layoutId="composer"` (shared element with the hero-mode composer).
- Max reading width 64ch, centered horizontally.
- `min-height: 100dvh` with flex layout so the list grows into available space.

### 5.3 `ChatShell` + composer morph

- `ChatShell.tsx` owns a `mode: 'hero' | 'docked'` state.
- Wraps children in a Framer Motion `<LayoutGroup>`. The `Composer` renders inside both modes with the same `layoutId`, so Framer Motion animates position/size between them automatically.
- First-submit flow:
  1. User presses Enter (or clicks send). The first user message is optimistically appended to `messages` via `useChat.append`.
  2. `ChatShell` flips `mode` to `docked` and triggers a 450ms `ease-morph` transition (token-driven).
  3. Simultaneously the hero title/subtitle fade out (150ms) and the chat message list fades in (180ms).
  4. After the animation settles, `router.push('/onboarding', { scroll: false })` runs; because `ChatShell` is mounted on both pages with the same `layoutId`, the transition is visually seamless.
- `prefers-reduced-motion`: the morph becomes a hard cut (route pushes immediately, no animation).

### 5.4 Top-anchored scroll (ChatGPT pattern)

- `MessageList` renders messages top-down inside a flex column.
- Each "turn" (user message + assistant response + any inline tool cards) is grouped into a `<section class="turn">` so we can target the latest turn for scroll anchoring.
- On user submit:
  1. Append the user message.
  2. In a `useLayoutEffect` that runs after the DOM update, call `latestTurnRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })` with a small `scroll-margin-top` (token-driven, ~24px) to leave breathing room.
  3. The `.turn` element has `min-height: calc(100dvh - var(--header-h) - var(--composer-h) - var(--safe-bottom) - 48px)`. This reserves vertical space so the assistant response streams *into* existing layout without pushing the scroll.
- Previous turns scroll up off the viewport; the user can scroll up to review them.
- When the assistant finishes, the viewport stays put.
- Reduced motion: `behavior: 'auto'` (instant jump instead of smooth).

### 5.5 Streaming + thinking indicator

- Assistant responses render via `useChat`'s streaming parts. Each assistant message is a composed sequence of text parts and tool-call parts.
- Before the first token arrives for a new assistant message, a `ThinkingIndicator` renders in the same slot where the bubble will appear.
- **Reading cursor animation:**
  - Label: `"Thinking"`, `text-ink-dim`, `body` size.
  - A pseudo-element 18px tall, 2px wide, `bg-accent`, with a 6px `box-shadow` emerald glow, animates `translateX(0 → 100%)` across the label on a 1.6 s `--ease-out` loop.
  - Behind the cursor, a thin fading gradient `linear-gradient(to right, transparent, var(--accent-soft))` trails across the already-scanned portion.
  - On first token, the indicator opacity fades to 0 over 120 ms and the first text part takes its place in the same slot.
  - Fallback (`prefers-reduced-motion`): static dim `"Thinking"` label, no animation.
  - Alternative keyframe we can swap in if the reading cursor reads finicky: a gradient shimmer wipe (skeleton-loader style) across the same label, emerald-tinted. Same interface.
- Word-by-word reveal for streamed text: newly-appended tokens animate `opacity: 0 → 1` over 60 ms; zero layout cost.

### 5.6 Tool-call cards

Every tool call renders as a `ToolCallCard` inside the current turn, between the assistant's prose parts. State comes from the AI SDK's streaming tool parts:

| AI SDK event | Card state | Visual |
|---|---|---|
| `tool-call-start` (or equivalent v6 event) | `pending` | Soft pulsing border ring (emerald at 20% opacity), verb-led label, no summary text |
| `tool-input-delta` / `tool-input-end` | `running` | Same as pending, plus a thin emerald progress line animating across the top edge (indeterminate) |
| `tool-result` | `completed` | Solid `border-line` + a tiny emerald dot, summary chip text, click-to-expand affordance |

> Implementation note: exact event names and hook surfaces should be confirmed against the current Vercel AI SDK v6 docs via `context7` MCP (`resolve-library-id` → `query-docs` for `ai` and `@ai-sdk/react`) at implementation time.

**Labels per tool (user-voice, never mentions the tool name):**

| Tool | Pending/running label | Completed summary |
|---|---|---|
| `proposeAngles` | "Sketching the things I'll track for you…" | "{N} areas proposed — show" |
| `normalizeSchedule` | "Working out your schedule…" | "{description} — show next runs" |
| `corpusSanityCheck` | "Checking how active each area is…" | "All areas look healthy" OR "{N} areas look sparse — take a look" |
| `generateConfig` | "Putting your setup together…" | (no chip — transitions the whole UI to ConfigSummary) |

**Expansion behavior:**

- Default: collapsed when `completed`. Click the chip to expand into the typed detail card (`AngleProposalCard` / `ScheduleCard` / `SanityCheckCard`).
- Auto-expand exception: `corpusSanityCheck` auto-expands if any verdict is `sparse`, `empty`, or `error` — the user needs to see it to make a decision.
- Card mount animation: 180 ms fade + 6px y slide, `--ease-out`.
- Card expand/collapse: Framer Motion `layout` so surrounding chat reflows smoothly without janking.
- Accessibility: each card is a `<section>` with a `<h3>` label and `aria-live="polite"` so state changes are announced; when collapsed, the expand trigger is a `<button aria-expanded={open}>`.

### 5.7 Typed cards

- **`AngleProposalCard`**: the 6–12 angles as a vertical bulleted list, each with a one-line rationale dimmed below it. No accept/reject buttons — the user refines verbally in chat. Closing the card collapses it back to the summary chip.
- **`ScheduleCard`**: the cron description as a `body-lg` sentence, plus three `Chip`s below showing `nextThreeFires` formatted as "Mon Apr 20", "Mon Apr 27", "Mon May 4" in the user's timezone.
- **`SanityCheckCard`**:
  - `healthy` angles collapsed into one line: "N other areas look good".
  - `sparse`/`empty`/`error` angles listed explicitly with their `papersPerRun` estimate and sample titles (if any), in the `--warn` amber tint.
  - Auto-expanded when mounted if any non-healthy verdict exists.

### 5.8 `ConfigSummary` end-screen

- Triggered when `generateConfig` returns `{ ok: true, config }`.
- Full-page takeover (replaces the chat area, keeps header + ThemeToggle).
- Sections:
  1. Title: *"Your digest is ready to go."* (Instrument Serif, h1)
  2. `Subject` block (`Card`, body-lg)
  3. `Schedule` block (`Card`, description sentence + next three chips)
  4. `Angles` block (`Card`, the final angle list)
  5. `Profile` block (`Card`, the free-text profile prose, Inter body, max-w-prose)
  6. `Output style` block (`Card`, same)
  7. `Actions` row:
     - **Primary** `Button`: "Download config (JSON)" — downloads the config as `research-digest-config.json`.
     - **Ghost** `Button`: "Start a new digest" — clears `rd:onboarding:v1` and routes back to `/`.
  8. Subtle note at the bottom: *"Saved in this browser for now. We'll hook it to your account in the next phase."*

### 5.9 Composer behavior (shared across modes)

- Autoresize textarea, min 1 row, max 6 rows.
- `Enter` sends; `Shift+Enter` inserts a newline.
- Send button disabled when input is empty or the assistant is streaming (shows an inline emerald spinner instead of graying out).
- `Escape` during streaming calls `useChat.stop()`.
- Focus ring: 2px `--accent-ring` with `--dur-sm` fade-in on focus.
- Respects IME composition (don't send while composing).

### 5.10 Accessibility baseline

- All interactive elements have visible focus states using `--accent-ring`.
- WCAG AA contrast checked for all token pairs (`ink`/`bg`, `accent-ink`/`accent`, `warn`/`warn-soft`, etc.).
- `prefers-reduced-motion` disables: hero→docked morph, scroll smoothness, reading-cursor, streaming word reveal, card expand transitions. State changes still happen; they just happen instantly.
- Tool-call cards are `<section>` with headings and `aria-live="polite"`.
- `ThinkingIndicator` is `aria-busy="true"` on its container.
- Landmark regions: `<header>`, `<main>` (containing the chat shell), `<footer>` (if landing-only).

---

## 6. Design system

### 6.1 Tokens (`src/styles/globals.css`)

Light mode is the default `:root`; dark mode lives under `[data-theme="dark"]`. Tailwind 4's `@theme` block maps each token to a utility namespace.

```css
:root,
[data-theme="light"] {
  /* Surfaces — warm off-white */
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
  --dur-xs: 120ms; --dur-sm: 180ms; --dur-md: 280ms; --dur-lg: 450ms;

  /* Layout */
  --reading-width: 64ch;
  --header-h: 56px;
  --composer-h: 88px;
  --safe-bottom: env(safe-area-inset-bottom, 0px);
}

@theme {
  --color-bg:          var(--bg);
  --color-bg-elev-1:   var(--bg-elev-1);
  --color-bg-elev-2:   var(--bg-elev-2);
  --color-ink:         var(--ink);
  --color-ink-soft:    var(--ink-soft);
  --color-ink-dim:     var(--ink-dim);
  --color-ink-faint:   var(--ink-faint);
  --color-accent:      var(--accent);
  --color-accent-hover:var(--accent-hover);
  --color-accent-ink:  var(--accent-ink);
  --color-accent-soft: var(--accent-soft);
  --color-warn:        var(--warn);
  --color-warn-soft:   var(--warn-soft);
  --color-line:        var(--line);
  --color-line-strong: var(--line-strong);
}
```

Rule: **components never reference hex literals or Tailwind's default palette.** Only these tokens. Polish iterations edit tokens only.

### 6.2 Typography

Loaded via `next/font/google` (Instrument Serif, Inter) and `next/font/local` or `next/font/google` (JetBrains Mono).

```
Display (Instrument Serif, 400):
  hero:  72px / 1.05 / -0.5px
  h1:    42px / 1.15 / -0.3px
  h2:    28px / 1.25 / -0.2px

Body (Inter, variable):
  h3:         20px / 1.35 / 0 / 600
  body-lg:    18px / 1.65 / 0 / 400
  body:       16px / 1.65 / 0 / 400
  small:      14px / 1.55 / 0 / 500
  micro:      12px / 1.45 / 0.4px / 500 / uppercase

Mono (JetBrains Mono, 400):
  code:       14px / 1.6
```

Reading width capped at `var(--reading-width)` = 64ch in the chat.

### 6.3 Spacing, radii

- Base unit: 4 px.
- Vertical rhythm: 1.5× Tailwind default.
- Radii: 6 px (inputs, chips), 12 px (cards), 20 px (composer, summary blocks).
- **No drop shadows in light mode** — shadows on cream surfaces read cheap. Use `border-line` for separation. Same restraint in dark mode.

### 6.4 Component primitives (`src/components/ui/`)

- **`Button`**:
  - `variant='primary'`: `bg-accent text-accent-ink`, 12 px radius, 80 ms scale-press + 150 ms color transition on hover, `ring-4 ring-accent-ring` on focus.
  - `variant='ghost'`: transparent, `text-ink-soft hover:text-ink hover:bg-accent-soft`.
  - `size='md'|'lg'`, sensible Tailwind spacing.
- **`Card`**: `bg-bg-elev-1 border border-line` + 12 px radius + 20 px inner padding. No shadow.
- **`Chip`**: inline pill, 6 px radius, `bg-bg-elev-2`, micro type, 4 px vertical / 8 px horizontal padding.
- **`ThemeToggle`**: `variant='ghost' Button` wrapping a Lucide `Sun`/`Moon` icon; click toggles `data-theme` on `<html>` and writes to localStorage.

### 6.5 Theme initialization (no-FOUC)

An inline blocking script in `src/app/layout.tsx` runs before hydration:

```html
<script dangerouslySetInnerHTML={{ __html: `
  (function(){
    try {
      var t = localStorage.getItem('rd:theme');
      if (t !== 'dark' && t !== 'light') t = 'light';
      document.documentElement.setAttribute('data-theme', t);
    } catch (e) {
      document.documentElement.setAttribute('data-theme', 'light');
    }
  })();
`}} />
```

`src/lib/theme.ts` exposes `getTheme()`, `setTheme(next)`, `toggleTheme()`. `ThemeToggle` calls `toggleTheme()`.

---

## 7. Testing

### 7.1 Automated (Vitest 4, no network)

| File | Covers |
|---|---|
| `test/config-schema.test.ts` | `digestConfigSchema` happy path (uses 4 ported iter profiles as fixtures), each required field missing, invalid cron round-tripped through cron-parser, invalid IANA tz, `angles.length ≥ 1`, `volume_target` bounds (3–40). |
| `test/schedule.test.ts` | `normalizeSchedule`: 10 common phrase → cron mappings, default-time 09:00, city → IANA resolution (all cities in the built-in map), `nextThreeFires` against a pinned injectable clock, `needsTimezone` path, `unparseable` path, `invalidCron` round-trip check. |
| `test/corpus-sanity.test.ts` | `papersPerRun` math, verdict mapping (healthy/sparse/empty/error), zero-count handling, negative cadence-days guard, semaphore cap (assert max 5 concurrent via a mock that tracks in-flight). |
| `test/openalex-client.test.ts` | URL builder (search, filter, mailto, type filter, date params, optional api_key), `reconstructAbstract` from a fixture inverted index, 429 backoff path (mocked fetch with 3-retry assertion), 5xx path, JSON parse error path, timeout path via `AbortSignal.timeout`. |
| `test/tools.test.ts` | Smoke tests for each tool's `execute()` with the OpenRouter provider stubbed: `proposeAngles` returns a Zod-valid angle list; `normalizeSchedule` round-trips "every Monday at 9 AM in Istanbul"; `corpusSanityCheck` maps a mocked OpenAlex response to the right verdicts; `generateConfig` accepts a valid partial and rejects a missing `profile`. |

**Test fixtures (`test/fixtures/profiles/`):** port the 4 iter profile angle JSON files from `/home/aykut/dev/workspace/actionbook-test/iter/profiles/{llm_agents,marketing,afib,adolescent_depression}.angles.json` as-is. These serve as schema-validation fixtures and realistic inputs for `corpus-sanity.test.ts`.

**Stubbing strategy:**
- OpenRouter / Vercel AI SDK: use `vi.mock('@openrouter/ai-sdk-provider')` + `vi.mock('ai')` to return canned streaming responses in tool tests. The exact mock approach should be confirmed against current Vercel AI SDK v6 testing guidance via context7 at implementation time.
- OpenAlex: `vi.spyOn(global, 'fetch')` with canned `Response` objects.

**Commands:**
```
npm run test         # vitest run
npm run test:watch   # vitest watch
```

**CI (local only in Phase 1):** no CI pipeline yet. Run tests manually before committing.

### 7.2 Not tested in Phase 1

- UI component rendering (no jsdom/RTL tests). Manual verification covers the small Phase 1 surface.
- End-to-end Playwright. Deferred to Phase 3 or later.
- LLM semantic output quality (digest relevance, precision). Deferred to Phase 2 pipeline quality gate per PRD §12.1.
- Real OpenAlex calls in CI. Only in manual verification.

---

## 8. Verification

All items must pass for Phase 1 to be considered complete.

### 8.1 Automated

- [ ] `npm run typecheck` (or `tsc --noEmit`) passes with strict mode.
- [ ] `npm run lint` passes.
- [ ] `npm run test` passes (all unit + tool smoke tests).
- [ ] `npm run build` (Next.js production build) succeeds.

### 8.2 Local dev manual checklist

**Boot:**
- [ ] `npm run dev` boots without type or runtime errors.
- [ ] `/` loads; hero composer is visible, centered, focused on mount.
- [ ] Theme toggle is visible in the top-right and switches `data-theme` on `<html>` with no FOUC.

**Hero → docked morph:**
- [ ] Typing a message and pressing Enter triggers the morph.
- [ ] The composer animates smoothly from hero-center to bottom-docked.
- [ ] The hero title/subtitle fade out as the chat list fades in.
- [ ] `prefers-reduced-motion` disables the animation (hard cut).
- [ ] Route changes to `/onboarding` without scroll jump or flash.

**Onboarding flow:**
- [ ] New user messages pin to the top of the viewport with ~24 px breathing room.
- [ ] Reading-cursor "Thinking" indicator shows before the first assistant token and dissolves on first token.
- [ ] Assistant replies stream word-by-word with no layout shift.
- [ ] Agent obeys conversational discipline: one question per message, 2–3 sentences, no jargon leakage ("config", "OpenAlex", "query", "topic", "schema").
- [ ] `proposeAngles` tool-call card shows pending → running → completed, collapsed, expands on click to show 6–12 angles with rationales.
- [ ] `normalizeSchedule` tool-call card shows cron description + next three fire times as chips.
- [ ] `corpusSanityCheck` tool-call card auto-expands on any sparse/empty/error verdict, agent surfaces a cadence-aware warning in the next assistant turn.
- [ ] `generateConfig` success transitions the UI to the `ConfigSummary` end-screen.
- [ ] Conversation stays within ~6 user turns for a typical case.

**Config summary:**
- [ ] Shows subject, schedule sentence + next three, angles, profile prose, output-style prose.
- [ ] "Download config (JSON)" produces a file.
- [ ] The downloaded file passes `digestConfigSchema.safeParse` when re-imported.
- [ ] "Start a new digest" clears localStorage and routes back to `/`.

**Design + motion:**
- [ ] All surface colors match tokens (no off-palette hex in components — grep `#[0-9a-f]{3,6}` in `src/components/**` returns nothing).
- [ ] Dark emerald is the only action color; amber appears only in sanity-check warnings.
- [ ] Instrument Serif renders on the hero/h1/h2, Inter on body, JetBrains Mono only on the JSON export block.
- [ ] Composer focus ring uses `--accent-ring`, not a default browser outline.
- [ ] No drop shadows anywhere.
- [ ] Theme toggle survives a page refresh (localStorage persistence).
- [ ] Dark mode: all text meets WCAG AA against the dark surfaces.

**Anonymous state:**
- [ ] `rd_session` cookie is set on first visit; persists across refresh.
- [ ] `rd:onboarding:v1` localStorage survives a refresh and restores the chat.
- [ ] If `finalConfig` exists in localStorage, refreshing `/onboarding` lands directly on `ConfigSummary`.
- [ ] Clearing localStorage resets the flow cleanly.

**Cost:**
- [ ] A full onboarding conversation (role → subject → intent → angles → schedule → sanity → config) costs ≤ $0.04 on DeepSeek v3.2. Log total `usage` tokens from each `streamText` to stdout during dev.
- [ ] `corpusSanityCheck` completes in ≤ 10 s for an 8-angle check on a healthy OpenAlex connection.

---

## 9. Implementation order

Strict sequencing. Each step lands before the next begins.

1. **Scaffold.** `npx create-next-app@latest` in-place at `/home/aykut/dev/workspace/ResearchDigest` (preserve `docs/`). Configure TS strict, Tailwind 4, Vitest 4, ESLint. Add `package.json` scripts (`dev`, `build`, `start`, `test`, `typecheck`, `lint`). Create `.env.local.example` + `.env.local` placeholders for `OPENROUTER_API_KEY` and `OPENALEX_MAILTO`. Verify `npm run dev` boots a default page.
2. **Design tokens + theme.** Write `src/styles/globals.css` with the token + `@theme` block from §6.1. Add `next/font` for Instrument Serif + Inter + JetBrains Mono in `src/app/layout.tsx`. Add the FOUC-blocking theme script. Build `src/lib/theme.ts` + `src/components/ui/ThemeToggle.tsx`. Smoke test in the browser that toggling works and survives a refresh.
3. **Component primitives.** `Button`, `Card`, `Chip` in `src/components/ui/`. Bare-minimum variants per §6.4.
4. **Zod schemas.** `src/lib/config-schema.ts` with `digestConfigSchema` exactly matching PRD §5.1 (angle schema, schedule object, volume/profile/output_style/core_angles/search_queries/version). Port the 4 iter profile angle JSONs to `test/fixtures/profiles/`. Write `test/config-schema.test.ts` and pass it.
5. **OpenAlex client.** `src/lib/openalex/client.ts` + `abstract.ts`. Write `test/openalex-client.test.ts` with mocked `fetch` and pass it.
6. **Schedule helpers.** `src/lib/schedule/cron.ts` + `timezone.ts`. Built-in city→IANA map. Write `test/schedule.test.ts` with an injectable clock and pass it.
7. **Session + storage.** `src/lib/session.ts` (cookie read/write) + `src/lib/storage/local.ts` (typed localStorage with schema versioning).
8. **OpenRouter provider.** `src/lib/ai/openrouter.ts` — thin factory that creates a configured `deepseek/deepseek-v3.2` model. At this step, use context7 MCP (`resolve-library-id` → `query-docs`) to pull current Vercel AI SDK v6 + OpenRouter provider docs so the code targets the current API surface.
9. **Tools — pure ones first.** `normalizeSchedule` + `generateConfig` in `src/lib/ai/onboarding-tools.ts`. Write `test/tools.test.ts` covering these two.
10. **Tools — `proposeAngles`.** Write `src/lib/ai/propose-angles.ts` + `prompts/propose-angles-system.md`. Extend `tools.test.ts` with a stubbed provider.
11. **Tools — `corpusSanityCheck`.** Semaphore + per-angle OpenAlex call + verdict mapping. Write `test/corpus-sanity.test.ts` and extend `tools.test.ts`.
12. **Onboarding system prompt.** `prompts/onboarding-system.md` per §4.2. Deliberate, careful copy pass.
13. **`/api/onboarding-chat` route.** Node runtime, `streamText`, tools wired, session cookie read. Verify against current v6 docs via context7.
14. **`ChatShell` + composer morph.** `ChatShell.tsx`, `Composer.tsx`, `MessageList.tsx`, `MessageBubble.tsx`, `ThinkingIndicator.tsx`. Wire Framer Motion `LayoutGroup` + `layoutId`. Get the hero page rendering + morph transitioning to docked.
15. **Landing page** (`src/app/page.tsx`) and **onboarding page** (`src/app/onboarding/page.tsx`). Shared `ChatShell` mounted in different modes.
16. **Message list + top-anchored scroll.** `useLayoutEffect` on new user message + `.turn` min-height reservation.
17. **Tool-call cards.** Generic `ToolCallCard.tsx` + `AngleProposalCard.tsx` + `ScheduleCard.tsx` + `SanityCheckCard.tsx`. Wire to the AI SDK tool-part streaming events (confirm event names via context7).
18. **`ConfigSummary`** (`src/components/config/ConfigSummary.tsx`) + download JSON action. Transition from chat mode on `generateConfig` success.
19. **Manual verification pass.** Run the §8.2 checklist end-to-end. Fix any regressions.
20. **Cost + latency check.** Log `usage` + measure a real conversation. Confirm ≤ $0.04 / ≤ 10 s sanity check.

---

## 10. Non-goals + open items

### Non-goals in Phase 1

- Pipeline (planner/retriever/filter/curator), `/api/preview`, preview digest rendering.
- DB persistence (Supabase), auth, session→user linking.
- Scheduler (Trigger.dev), email (Resend), React Email templates.
- Update agent, feedback loop, version history, rollback.
- Payment, rate limiting, observability, diagnostic mode.
- Landing-page copy polish beyond the hero title/subtitle stub.
- Illustrations, custom icons beyond Lucide (send, close, download, sun, moon).
- E2E Playwright tests, UI component unit tests.

### Open items (decide during implementation)

- **Exact hero copy.** The spec pins type + layout, not the final words. Decide during landing-page implementation. First draft: *"A research digest, written for you."* subtitle *"Describe what you want to track. I'll do the reading."*
- **Deployment target** (Vercel vs Cloudflare). Deferred. Phase 1 runs locally; revisit before Phase 3 (persistence + auth).
- **Rate limiting on `/api/onboarding-chat`.** Not in Phase 1. Per PRD §15, Vercel edge middleware is the preferred approach if shipping to Vercel. Revisit in Phase 6.
- **Update-agent prompt + tool surface.** Phase 5.
- **Dark-mode kerning on Instrument Serif.** Verify in manual verification; may need a small `letter-spacing` tweak if the glyphs feel tight on the dark background.
- **Vercel AI SDK v6 tool-part event names.** Confirm at step 17 via context7; the spec uses `tool-call-start` / `tool-input-delta` / `tool-result` as a semantic reference, not a pinned API contract.

---

## 11. Critical files to create

| File | Purpose |
|---|---|
| `src/app/layout.tsx` | Theme script, font loading, globals, layout landmarks |
| `src/app/page.tsx` | Landing — hero `ChatShell` |
| `src/app/onboarding/page.tsx` | Docked `ChatShell` |
| `src/app/api/onboarding-chat/route.ts` | Streaming chat route |
| `src/components/chat/ChatShell.tsx` | Hero ↔ docked owner, shared-element morph |
| `src/components/chat/Composer.tsx` | Autoresize textarea, Framer `layoutId` |
| `src/components/chat/MessageList.tsx` | Top-anchored scroll, turn grouping |
| `src/components/chat/MessageBubble.tsx` | User/assistant rendering, stream cursor |
| `src/components/chat/ThinkingIndicator.tsx` | Reading-cursor animation |
| `src/components/chat/ToolCallCard.tsx` | 3-state generic card |
| `src/components/chat/AngleProposalCard.tsx` | Expanded angle list card |
| `src/components/chat/ScheduleCard.tsx` | Expanded schedule card |
| `src/components/chat/SanityCheckCard.tsx` | Expanded sanity-check card (auto-expand on warning) |
| `src/components/config/ConfigSummary.tsx` | End-of-flow summary + download JSON |
| `src/components/ui/Button.tsx` | Primary/ghost button primitive |
| `src/components/ui/Card.tsx` | Surface primitive |
| `src/components/ui/Chip.tsx` | Small pill primitive |
| `src/components/ui/ThemeToggle.tsx` | Sun/moon ghost toggle |
| `src/lib/config-schema.ts` | `digestConfigSchema` (PRD §5.1) |
| `src/lib/openalex/client.ts` | Minimal keyword search |
| `src/lib/openalex/abstract.ts` | Inverted-index reconstruction |
| `src/lib/ai/openrouter.ts` | Provider factory |
| `src/lib/ai/onboarding-tools.ts` | Four tool definitions |
| `src/lib/ai/propose-angles.ts` | Inner LLM call for proposeAngles |
| `src/lib/schedule/cron.ts` | Parse/describe/nextFires |
| `src/lib/schedule/timezone.ts` | City→IANA helper |
| `src/lib/session.ts` | `rd_session` cookie helper |
| `src/lib/theme.ts` | Theme toggle + localStorage |
| `src/lib/storage/local.ts` | Typed `rd:onboarding:v1` state |
| `src/styles/globals.css` | Tokens, `@theme`, keyframes |
| `prompts/onboarding-system.md` | Main agent system prompt |
| `prompts/propose-angles-system.md` | Inner angle-proposal prompt |
| `test/fixtures/profiles/*.json` | 4 ported iter profile angle files |
| `test/config-schema.test.ts` | Schema validation tests |
| `test/schedule.test.ts` | Schedule normalization tests |
| `test/corpus-sanity.test.ts` | Sanity-check math tests |
| `test/openalex-client.test.ts` | OpenAlex URL + fetch tests |
| `test/tools.test.ts` | Tool execute smoke tests |
| `.env.local.example` | Required env keys |
| `package.json` | Dependencies + scripts |
| `vitest.config.ts` | Vitest config |
| `tsconfig.json` | TS strict config |
| `next.config.ts` | Next.js 16 config |

No pre-existing project code to modify — greenfield scaffold.

---

## 12. Reference materials

- `docs/2026-04-13-PRD.md` — full PRD (especially §5 data model, §7 onboarding agent, §10 frontend, §11 phases)
- `docs/2026-04-13-BRIEF.md` — project brief
- `/home/aykut/dev/workspace/actionbook-test/iter/profiles/*.angles.json` — 4 profile angle fixtures (port as-is)
- `/home/aykut/dev/workspace/actionbook-test/iter/profiles/*.md` — 4 profile descriptions (reference for realistic test `profile` strings)
- Vercel AI SDK v6 — fetch via context7 MCP at implementation time (`resolve-library-id` for `ai`, `@ai-sdk/react`, `@openrouter/ai-sdk-provider`)
- OpenAlex API docs — https://docs.openalex.org (search, filter, pagination)
