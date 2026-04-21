# Onboarding stages redesign

Date: 2026-04-21
Status: Design locked, ready for plan + implementation

## Overview

The current onboarding ends with a Research Plan view that nests the digest preview, schedule picker, and subscribe section into a single scroll. Users hit the preview as a small card buried inside a config page, then decide about cadence and subscription immediately after. The preview value ("812 papers scanned, 5 selected") lives at the bottom of the preview card where users don't see it until they've already formed an opinion, and the typographic hierarchy in the rendered digest is flat.

This redesign breaks the flow into three distinct stages — **Plan → Preview → Start** — each with its own page-level identity. The preview becomes an editorial issue with a centered masthead and a persistent sidebar that frames it as a sample. The Start step merges the previous schedule-picker and subscribe into a single commit moment with plan selection (monthly / yearly) and a payment placeholder ready for Stripe integration later.

No pipeline changes. No schema changes beyond splitting `output_style` into structured format + voice fields. Everything else is UI restructure and copy.

## The three stages

```
Plan ──► Preview (loading ── issue) ──► Start
  │                                       │
  └── edit anything ◄── breadcrumb ──┘    └── start my digest (today: no-op; later: Stripe)
```

Breadcrumb is present at the top of every stage, always reads `Plan › Preview › Start` with the current step in green. Earlier steps are clickable to go back; "Start" is not clickable ahead of time. The back-affordance is intentionally quiet — the product wants forward momentum, and the user can always edit later from settings.

## Stage 1 — Plan

**Purpose.** Show the user the shape of the digest we'll deliver. Lets them edit anything before committing.

**Layout.** Single column, left-aligned, max-width 820px (matches existing `ResearchPlanView`). Eyebrow label "Your research plan", large editable subject title (Playfair 46px), italic deck explaining the page. Four sections follow, each separated by a hairline rule, each with a small-caps label on the left and an italic one-line hint on the right describing what that field controls. Fields are flat — no boxy form chrome, just typography. Focus state shows a 1px outline plus cream fill so the user knows they're editing.

**Sections, in order:**

1. **Who this is for** — plain textarea. Hint: *"Shapes which papers get picked."*
2. **Research areas** — chips with × to remove and a dashed "+ Add area" chip. Sentence-case per chip (first letter capitalized, rest as written). Hint: *"At least one paper candidate per area, every issue."*
3. **Format & Structure** — rich inline editor (contenteditable) that live-renders a markdown numbered list. Green numerals, italic lead-word per item (*"The picture right now."*, *"What's shifting."*, *"What to steal."*). Click anywhere to edit in place. Hover shows the editable affordance (cream fill + hairline). Hint: *"The shape of each issue. Uses a numbered list."*
4. **Voice & Language** — free-text textarea, single paragraph. Hint: *"How each issue sounds."*

No "length" field. The curator infers length from voice and structure.

**Sticky footer CTA.** Single centered button, uppercase, no arrow: `PREVIEW YOUR DIGEST`. Big (18px Geist, 0.14em tracking, 18px vertical padding, min-width 320px). Sits in a cream-green bar with a 1px top border, pinned to the bottom of the viewport.

**Save state.** Top-right of the stage bar shows a quiet italic "Saved" after a change settles. Auto-save on every edit; no explicit save button.

**Scrollbars.** Themed: `scrollbar-width: thin`, `scrollbar-color: #C9BE9F transparent`. Webkit: `10px` wide, tan thumb (`#D4C9AE`) with 2px cream border, darkens to `#B8AE8F` on hover. Applied to all textareas and to any overflow container on the page.

**Data model change — Voice & format.** Split the current single `output_style: string` field into two:

```ts
// DigestConfig
format_structure: string        // markdown, typically a numbered list
voice_language: string          // free prose
```

The curator prompt reconstructs an `output_style` paragraph from these at request time. All existing references to `output_style` in prompts are updated to consume the split fields. Both strings are free-form editable; there is no structured form underneath.

## Stage 2 — Preview

Two states: loading, then the rendered issue. Both stay on the same breadcrumb step ("Preview"). The frame structure (centered masthead + italic deck + content area) is the same in both, so the transition from loading to ready feels like ink appearing rather than a page swap.

### 2a. Loading state — "Going to press"

**Purpose.** Make the ~20–30s pipeline wait feel intentional, not passive. Show real work happening, driven by the existing SSE events from `/api/preview-digest`.

**Layout.** Max-width 720px, centered. Reuses the masthead from the final preview:

- Dateline rule flanking the small-caps label *"Preview Issue · AI Agents"*
- Centered h1 *"Going to press"* with a blinking green cursor
- Italic deck: *"We're pulling together a sample of how your digest will read. This usually takes about twenty seconds."*
- A strong 1px bottom border closes the masthead.

Below the masthead, two elements in order:

**Stats block (no borders).** Two large serif numerals side by side, each with a small-caps label underneath. Live-driven:

- `Papers scanned` — ticks up from `area-hit` events, plus the initial `seed-fetch-done`
- `Areas checked` — `N / 10` from `area-hit` count

Uses `font-variant-numeric: tabular-nums` so the numbers don't shift width as they tick.

**Progress bar + timeline (coupled, no gap).** A 2px progress rule with a green fill (`#2D5A3D`), width driven by stage count (`stagesDone / 5 * 100%`). Directly below it, a vertical timeline with five stage rows, each with a 16px circular mark:

1. **Mapping your interests**
2. **Looking across the whole field**
3. **Finding what fits you**
4. **Reading the shortlist**
5. **Writing it in your voice**

Row states:
- `done`: filled green mark with a white ✓, label in soft ink, meta `done`
- `running`: ringed green mark with pulsing green center (1.2s ease-in-out), label in green Playfair weight-500, meta `in progress`
- `pending`: tan-ringed empty mark, italic muted label, no meta

No "Step N of 5" label, no stage name anywhere else. The running row is the single source of truth for what's happening.

Footer below the timeline: italic Playfair, centered, `#7A7566`: *"Leave this open. We'll land the preview right here when it's ready."*

**Wiring to existing events.** `PreviewRunningState` already receives the SSE stream. Replace the cycling status-lines timer with event-driven stage progression:

- `seed-fetch-done` → stage 1 done, stage 2 running, `papersScanned` seeded
- `area-hit` → increment papers scanned + areas done; at `areasDone === total`, mark stage 2 done and stage 3 running
- Stage transitions for "Finding what fits you" / "Reading the shortlist" / "Writing it in your voice" need matching events from the pipeline (`filter-done`, `curate-start`, `curate-writing`) — the event set is an internal detail, not a user-facing contract. The `pipeline.ts` emits the additional events as it reaches those phases; the UI just listens.

### 2b. Rendered preview — the issue

**Purpose.** Show the user an editorial sample issue in the voice and format they configured. Frame it clearly as a sample, surface the key numbers up front, and keep the forward action unambiguous.

**Layout.** Two-column on desktop, breadcrumb-only top bar, no duplicate dateline in the top bar.

```
┌─────────────────────────────────────────────────┐
│          Plan › Preview › Start                 │
├──────────┬──────────────────────────────────────┤
│ sidebar  │         ── preview issue ──          │
│ (sticky) │        A sample issue,               │
│          │         in your voice.               │
│          │                                      │
│  stats   │         [editorial body]             │
│  sell    │         [sources]                    │
│  cta     │         [end-of-article cta]         │
└──────────┴──────────────────────────────────────┘
```

**Sidebar (280px, sticky, pinned to viewport).** Contents in order:

1. *"This is a preview"* label + 2-line italic copy.
2. *"The sample"* label + three stat rows (hairline-ruled between):
   - `812` — Papers scanned
   - `10` — Areas covered
   - `5` — Selected for you
3. *"Your real digest does more"* label + five-item sell list. Each item is a bold Playfair lead-line + a short Geist explanation:
   - **The full field, scanned.** Thousands of papers across your areas, so nothing important slips through.
   - **As much as the field delivers.** Not a fixed 5. A quiet stretch brings fewer, a flood of new work brings more, right-sized for each issue.
   - **Deep reads, not skims.** Reads the full paper for every pick and sees how it connects to related work, so nothing important gets missed.
   - **Continuity across issues.** Remembers what you have already read. Threads build over time. Nothing repeats.
   - **In your inbox, on your schedule.** Daily, weekly, monthly, whenever you want it.
4. Primary CTA `Start my digest →` at the bottom of the rail (pushed down by `margin-top: auto`), with helper text *"Set your schedule next. Change anything, anytime."*

**Article column (680px, centered).** Centered editorial masthead:

- Dateline rule flanking *"Preview Issue · AI Agents · Apr 21, 2026"*
- Two-line h1 *"A sample issue,\nin your voice."* (Playfair 500, ~36px)
- Italic deck: *"How your AI agents digest would read: voice, structure, paper-picking, in a single issue."*
- Strong 1px bottom border closes the masthead.

Below the masthead, the rendered digest body. Section titles are real `h2` (Playfair 500, 22px, with 16px top padding + hairline rule above, except the first). No numbering in the heading — section names from the user's Format & Structure come through as-is. Body paragraphs are Playfair 15px, line-height 1.65. Inline citations `[1]`, `[2]`, ... are rendered as small tan chips (`#E8E0CB` bg, `#2D5A3D` text, 10px Geist weight-600). Each chip is a link that scrolls to and highlights the matching source card.

After the body, a **Sources in this sample** section. Small-caps label, then one card per reference: citation number in bold green, venue · age, paper title in Playfair, authors. The `[N]` is the dominant visual element on each card so the prose ↔ card mapping is obvious.

After sources, the **end-of-article CTA block**. A cream-green padded card, centered text: h3 *"Ready for the real thing?"* + italic deck *"Pick your schedule and your first full digest goes out on it."* + a primary `Start my digest →` button.

**Mobile (< 900px).** Sidebar collapses. At the top, a **sticky pill** with the framing: `● Preview · 5 of 812`. Below it, a **hero block** with the masthead + big stats (horizontal row). Then the article body. The *"your real digest does more"* sell list appears at the bottom of the article as a footer comparison. A **sticky footer CTA bar** pins `Start my digest →` to the bottom of the viewport. Tapping the pill opens a **bottom sheet** with the full sidebar content including the CTA.

**Tablet (600–900px).** Same layout as desktop, sidebar shrinks to ~200px, sell-list items tighten, article padding reduces.

**No regenerate button.** Re-running the pipeline is expensive. The only way to get a new preview is to edit the plan — the back-nav on the breadcrumb lets the user do that. This naturally bounds pipeline cost to "how much the user iterates on their plan," not "how many times they tap a button."

## Stage 3 — Start

**Purpose.** Commit action. Collect schedule + email + plan choice, kick off the subscription. Payment is a placeholder today; the shape of the screen and the call site are payment-ready.

**Layout.** Single column, max-width 720px. Same editorial pattern as Plan: eyebrow *"Final step"*, Playfair page title *"Start your digest."*, italic deck *"Pick when, where, and your plan. You can change any of it anytime."*

**Section 1 — When.** Hint: *"Daily, weekly, or monthly. You pick the time."*

- Cadence chips: `Daily` / `Weekdays` / `Weekly` / `Monthly`. Pill-shaped. Active chip uses filled green `#2D5A3D` with cream text; inactive chips use transparent bg with tan border.
- Sub-pickers revealed by selection:
  - `Weekly` → day-of-week row (seven circular 36px pills, Mon–Sun), plus Time select, plus Timezone select.
  - `Monthly` → day-of-month select (1–31), plus Time, plus Timezone.
  - `Daily` / `Weekdays` → Time + Timezone only.
- Selects use cream bg, tan border, custom chevron built from CSS gradients so native OS styling doesn't leak in.

**Section 2 — Plan.** Hint: *"Switch between monthly and yearly anytime."*

Two cards side by side (grid 1fr 1fr, 12px gap):

- **Monthly** — `$19 / month`, sub-price "Billed every month."
- **Yearly** — `$149 / year`, "Save 35%" chip in the card header, sub-price "Works out to $12.42/month, billed yearly." Default-selected.

Active card: green border `#2D5A3D`, extra 1px green glow, `#F0E9D6` bg, filled green radio dot. Inactive: tan border, cream bg, empty radio.

**Section 3 — Where.** Hint: *"We'll send each issue here."*

Single email input. Pre-filled from auth if available; editable otherwise. Same text-input treatment as Plan screen — cream bg, tan border, Playfair 16px.

**Summary card.** Cream-green block beneath the sections. Small-caps lead *"So that's"* then a Playfair 17px human-readable sentence with green italic accents:

> Your first issue lands **Tuesday, April 28 at 9:00 AM**, in **aykutuysal@gmail.com**. Then every Tuesday for **$149 a year**, until you change it.

All three accent spans are live-computed from current selections (next delivery date from cadence + day + time, email from the input, price from the active plan). Below the summary, a dashed-bordered payment slot: *"● Payment details collected on the next step. Cancel anytime, no questions."* This is the hook for Stripe later.

**Sticky footer CTA.** Single centered button, uppercase, no arrow, price in the label:

```
START MY DIGEST · $149 / YEAR
```

Price updates live when the plan toggle changes. Reassurance line under the button in italic Playfair: *"Cancel anytime in settings. Your plan and schedule stay editable."*

**Click behavior.**

- **Today (no payment):** the handler calls `onStart({ plan, schedule, email })` which, for now, persists the config via the existing local path and transitions the UI to an in-place "You're in" success state. No external roundtrip. The Plan + Preview + Start values are all frozen at this point; editing happens later from settings.
- **Later (with Stripe):** the same handler calls a new `/api/checkout-session` endpoint with the selected `priceId` (`price_monthly` or `price_yearly`) + config + email, receives a Stripe Checkout URL, and redirects. On return from Stripe, the post-checkout page completes subscription creation and shows the "You're in" state. The payment slot in the summary is also the insertion point for a Stripe Payment Element if we later choose inline over redirect.

**Data model additions.**

```ts
// DigestConfig
plan: 'monthly' | 'yearly'       // user-selected
email: string                     // collected at Start

// Subscription-side (new, populated after commit)
billing: {
  plan: 'monthly' | 'yearly'
  status: 'pending' | 'active' | 'cancelled'
  stripe_customer_id?: string
  stripe_subscription_id?: string
  next_billing_at?: string        // ISO
}
```

The `billing` block is out of scope for this design (it exists once real payment lands), but the Start screen's click handler signature is stable so it can be extended.

## Typography and theme

Project fonts only: **Playfair Display** for display/serif, **Geist** for sans, **JetBrains Mono** for code (not used in these screens). Font variables are already wired in `src/app/layout.tsx`.

**Palette (reusing existing tokens where possible):**

- Page bg: `#F7F2E8` (close to `var(--bg)`; keep mapping to the token)
- Sidebar bg: `#F0E9D6`
- Input bg: `#FCFAF4`
- Ink: `#1F2A22` primary, `#3A4A3E` soft, `#5A6A5D` dim, `#7A7566` faint, `#9A9383` fainter
- Accent (green): `#2D5A3D` primary, `#1F4A30` hover, `#E8E0CB` soft
- Lines: `#D4C9AE` hairline, `#C9BE9F` soft, `#E4DCC9` very soft
- Mastheads use a strong `#1F2A22` 1px bottom rule to separate header from body

All values should route through the existing `oklch` tokens in `globals.css` where an equivalent exists. The hex literals above describe intent, not final source-of-truth.

## Copy reference (for the prompt files and component strings)

- Plan page title: *Your research plan / `[subject]` / "This is how we'll pick and write each issue for you. Edit anything, then preview how one issue will read."*
- Plan CTA: `PREVIEW YOUR DIGEST`
- Loading title: *Going to press* (with blinking cursor)
- Loading deck: *"We're pulling together a sample of how your digest will read. This usually takes about twenty seconds."*
- Loading footnote: *"Leave this open. We'll land the preview right here when it's ready."*
- Loading stages (user-facing, benefit-framed): `Mapping your interests` / `Looking across the whole field` / `Finding what fits you` / `Reading the shortlist` / `Writing it in your voice`
- Preview masthead h1: *"A sample issue,\nin your voice."*
- Preview deck: *"How your [subject] digest would read: voice, structure, paper-picking, in a single issue."*
- Preview sidebar eyebrow: *"This is a preview"*
- Preview sidebar sell-list bullets: as enumerated above under Stage 2b.
- Preview end-of-article CTA h3: *"Ready for the real thing?"*
- Preview end-of-article CTA deck: *"Pick your schedule and your first full digest goes out on it."*
- Start page title: *"Start your digest."*
- Start deck: *"Pick when, where, and your plan. You can change any of it anytime."*
- Start reassurance: *"Cancel anytime in settings. Your plan and schedule stay editable."*

No em dashes anywhere in user-facing copy. Use commas, colons, or periods.

## Out of scope

- Email verification / magic link flow. Assumed resolved through whatever auth the user came in with.
- Paywall wiring. Stripe integration, webhook handling, receipt handling, tax.
- "Edit from settings" screens post-subscription.
- The backend pipeline itself. Only the UI adapts to new event types; the events are defined here as needs, not specified in the pipeline contract.
- Accessibility pass — this spec is about visuals and structure; an a11y review happens during implementation (keyboard nav on chips, tab order on Start inputs, `aria-live` on loading stages, focus management on stage transitions).
- Internationalization.
- Analytics instrumentation at stage boundaries.

## Mockups

All reference mockups are persisted in `.superpowers/brainstorm/1087383-1776727117/content/`:

- `plan-screen-v5.html` — Plan (final locked version, sticky centered CTA)
- `preview-loading-v4.html` — Loading state (final)
- `option-b-v6.html` + `option-b-v7-cta.html` — Preview issue (sidebar + sticky CTA coverage)
- `start-screen-v2.html` — Start (with $19 / $149 pricing)

These are visual references, not source of truth. The spec text above takes precedence when they disagree.
