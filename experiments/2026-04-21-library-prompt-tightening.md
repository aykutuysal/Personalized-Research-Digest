# Library + proposer prompt tightening

**Date:** 2026-04-21
**Branch:** `fix/library-prompt-tighten` → merged to `master` at `0af52f1`
**Reproducible tests:** `test/pool-experiment*.test.ts` (gated on `RUN_POOL_EXPERIMENT=1`)

## Problem

A preview run for a therapist profile produced a nearly empty candidate pool (3 papers), forcing the curator to fall back to the "sad list" rendering. Raw log from 2026-04-21:

```
[preview ad0b6d46] [5]  BASELINE library run (7d): 6 of 9 queries returned 0 hits
[preview ad0b6d46]     filter: scoring 3 candidates
[preview ad0b6d46]     filter kept only 2/3 — using unfiltered pool
[preview ad0b6d46]     curator fallback used: Curator returned only 2 references.
```

## Root-cause analysis

The preview pipeline is:

```
seeds (LLM) → seed-fetch (OpenAlex, 180d) → vocab (code) → library (LLM) → run-library (OpenAlex, 7d)
```

Three structural issues with the library stage:

1. **Window mismatch.** Seeds fetch over 180 days with `per_page=50`; library runs over 7 days. The library-builder LLM sees seed counts like `"Schema therapy" → 262 results` and reasons *"too broad, must narrow."* It then emits 4-5 token queries that collapse to zero on the 7-day slice because OpenAlex's `title_and_abstract.search` ANDs every stemmed token.

2. **Population qualifier bleed.** Research-area text includes scoping tails like `"for depression/anxiety"`, `"in elderly patients"`. The LLM encoded those tails as query tokens (`"schema therapy modes depression anxiety"`), filtering out relevant papers whose abstracts happen to use a different population name. That filtering is the downstream relevance filter's job, not OpenAlex's.

3. **Homograph collapse at short lengths.** A naive fix of "use fewer tokens" without a discipline anchor makes things worse: `"third wave"` returns ocean physics and feminist theory, `"unified protocol"` returns networking and cryptography, `"process based"` returns manufacturing.

A separate problem surfaced later: the **proposer** (`proposeResearchAreas`) mirrored practitioner vocabulary verbatim. For the digital-marketer persona it generated areas like `"cart abandonment email and SMS remarketing"` and `"exit-intent popups and last-chance offers"` — valid practitioner taxonomy, but OpenAlex indexes the underlying construct (`"persuasive design"`, `"consumer retention"`), not the tactic.

## Method

### Experiment 1 — pool-size lift (post-hoc simulation)

File: `test/pool-experiment.test.ts`.

Replayed the therapist profile (9 research areas) against live OpenAlex. Ran the current pipeline end-to-end, then applied three candidate fixes as post-hoc transforms on the same LLM-generated queries:

- **Fix #1:** union library hits with seed-fetch results filtered to the last 7 days.
- **Fix #2:** strip `depression`/`anxiety` population qualifiers from each library query and re-run.
- **Fix #3:** truncate each library query to its first 3 tokens and re-run.
- **Combined:** all three.

Measured deduplicated pool size (by OpenAlex ID, then normalized title).

### Experiment 2 — prompt A/B (head-to-head)

File: `test/pool-experiment-prompt-ab.test.ts`.

Instead of post-hoc transforms, directly tested two versions of the library system prompt. Same seeds, same vocab, same 7-day window — only the system prompt changes. Both versions prompted in parallel to minimize API-state drift.

Added a subject-agnostic precision proxy: a paper is "in-field" if its `primary_topic.field` is among the top-5 fields extracted from the seed-fetch papers for that subject. No hand-coded keyword lists.

### Experiment 3 — precision audit

File: `test/pool-experiment-relevance.test.ts`.

Took the 2-token queries produced by an early (too-aggressive) version of the new prompt and inspected the titles + topic fields OpenAlex actually returned. This is what revealed the homograph problem and motivated the discipline-anchor rule.

### Experiment 4 — persona stress test

Files: `test/pool-experiment-personas.test.ts` (hand-authored areas), `test/pool-experiment-personas-full.test.ts` (full DeepSeek path from subject+profile only).

Six personas spanning fields with different homograph risks:

| Persona | Subject | Homograph trap terms |
|---|---|---|
| AI/LLM engineer | LLM agents and tool-use in production systems | agent, transformer, attention, tool, chain |
| Cardiologist | atrial fibrillation management and stroke prevention | screening, flow, block |
| Climate scientist | ocean heat content and marine heatwaves | heat, content, wave, current |
| Digital marketer | consumer behavior in e-commerce checkout flows | anchor, funnel, conversion, trust |
| Materials scientist | solid-state lithium battery electrolytes | interface, transport, conduction, metal |
| Education researcher | formative assessment in K-12 mathematics | assessment, feedback, gap, formative |

For the full-path test I provide only subject + profile text. DeepSeek runs `proposeResearchAreas` → `generateSeeds` → `buildCompactLibrary`. All 3 LLM stages use the actual production prompts.

## Changes shipped

### `prompts/preview-library-system.md`

1. **Explain AND-semantics** so the LLM understands every token is a required filter, not just a hint.
2. **Cap queries at 2–3 tokens** (was 2–6).
3. **Strip population/scoping tails** — rule 4.
4. **Discipline-binding anchor required** — rule 5, with field-agnostic examples (CBT, agent, atrial, electrolyte, campaign).
5. **Lower target density** from 10–300/wk to 3–50/wk. Adding qualifiers to reduce result count almost always drops to zero on a weekly window, not to a nicer number.

### `prompts/propose-research-areas-system.md`

1. **New anti-pattern: practitioner tactics as research area.** Explicit practitioner→academic translations: `exit-intent popups` → `persuasive design`; `cart abandonment email` → `consumer retention interventions`; `one-click checkout` → `purchase friction / choice architecture`.
2. **Vocabulary rule rewritten:** use the reader's own vocabulary only where it overlaps with the academic literature's vocabulary. For practitioner readers, name the underlying construct the literature actually indexes.
3. **Terminology unification:** "angle" → "research area" throughout the prose. JSON wire format stays `angles` for UI/query-planner back-compat.

## Results

### Experiment 1 — therapist profile, post-hoc simulation

| Variant | Pool size |
|---|---:|
| Baseline (pre-change) | 2 |
| + fix #1 (pool seed hits) | 9 |
| + fix #2 alone (strip qualifiers) | 12 |
| + fix #3 alone (cap 3 tokens) | 13 |
| Combined | 17 |

My earlier projection of "3 → 30+" was too high; honest post-hoc ceiling was 17.

### Experiment 2 — prompt A/B (same seeds, same vocab)

| Prompt | Pool | Areas covered | Avg tokens/query |
|---|---:|---|---:|
| OLD (2–6 tokens, no anchor rule) | 2 | 2/9 | 4.56 |
| NEW v1 (2–3 tokens, no anchor rule) | 65 | 9/9 | 2.11 |
| NEW v2 (2–3 tokens + anchor rule) | 11 | 7/9 | 3.00 |
| NEW v2 + fix #1 | 14 | 7/9 | 3.00 |

NEW v1 had dramatically more recall but collapsed precision — 51% of papers were off-topic homograph contamination. NEW v2 (the version shipped) trades some recall back for precision.

### Experiment 3 — precision audit on NEW v1 (over-aggressive)

Titles inspected manually per query, classified as relevant / maybe / off-topic:

| Query | Returned | Relevant | Off-topic |
|---|---:|---:|---:|
| `unified protocol` | 15 | 0 | 14 (linguistics, crypto, neutrinos) |
| `third wave` | 15 | 1 | 11 (ocean physics, feminism, COVID) |
| `process based` | 15 | 0 | 12 (manufacturing, engineering) |
| `schema modes` | 15 | 4 | 6 (data storage, ML) |
| `schema therapy` | 15 | 11 | 2 ✅ |
| `digital CBT` | 4 | 4 | 0 ✅ |
| `insomnia CBT` | 11 | 11 | 0 ✅ |
| `acceptance commitment CBT` | 2 | 2 | 0 ✅ |

Queries with ≥1 field-binding token (`CBT`, `therapy`, `rescripting`) were clean. Queries without one collapsed into homograph noise. This motivated the discipline-anchor rule in NEW v2.

### Experiment 4 — persona stress test (final prompts)

**Full path from subject + profile only** — DeepSeek does proposing, seeding, library:

| Persona | areas | pool | in-field | off-field | precision | coverage | avg tok |
|---|---:|---:|---:|---:|---:|---|---:|
| AI/LLM engineer | 8 | 74 | 61 | 13 | 82% | 8/8 | 2.63 |
| Cardiologist | 9 | 51 | 51 | 0 | 100% | 9/9 | 3.11 |
| Climate scientist | 9 | 48 | 33 | 5 | 87% | 9/9 | 3.00 |
| Digital marketer | 8 | 34 | 20 | 7 | 74% | 7/8 | 2.25 |
| Materials scientist | 9 | 74 | 64 | 10 | 86% | 9/9 | 2.67 |
| Education researcher | 8 | 29 | 26 | 3 | 90% | 6/8 | 3.25 |
| **Totals / avg** | 51 | **310** | **255** | **38** | **87%** | — | **2.82** |

Every persona now produces a functional pool (29–74 papers) above filter/curator thresholds. Average query length 2.82 tokens — on target.

### Marketer-specific journey (Tier 1 proposer fix impact)

| State | Pool | Coverage | Notes |
|---|---:|---|---|
| Before proposer fix | 1 | 1/8 | Areas like `"exit-intent popups and last-chance offers"` |
| After practitioner→academic rule | 13 | 6/8 | Areas like `"Persuasive Design and Dark Patterns"` |
| After `angle` → `research area` rename | 34 | 7/8 | Areas like `"Online field experiments for conversion optimization"` |

The terminology unification had a measurable second-order effect: "research area" carries a more academic register in LLM training data than "angle" (which has journalistic/marketing connotations). The proposer produced noticeably more paper-title-shaped labels after the rename.

## What didn't work

- **Post-hoc token truncation** dramatically underestimated what an LLM with a tighter prompt would do. The LLM picks the *right* 2–3 tokens (`"acceptance commitment CBT"`), not just the first 2–3 of the old query (`"ACT CBT integration"`).
- **2-token queries without anchor** (NEW v1) had a 50% off-topic rate. The anchor rule (NEW v2) was necessary.
- **Fix #1 (pool seed hits)** was less impactful than originally ranked — seed fetch returns the 50 most *relevant* results over 180 days, not a uniform time sample, so few happen to fall in the last 7 days. Still useful as a marginal safety net.

## Known residual failure modes

- **Weak-anchor judgment errors.** The LLM occasionally trusts a quasi-field term too much: `"price anchoring"` leaked behavioral-economics noise for the marketer; `"long-context transformer"` picked up some electrical engineering. These are LLM judgment margins, not structural prompt flaws.
- **Niche weekly flow.** Cardiologist areas like `DOAC dosing in elderly AFib patients` have genuinely thin weekly publication rate. No prompt fix invents papers that don't exist — only a longer preview window would help.
- **Practitioner subjects with thin academic coverage.** Digital marketing precision (74%) is lower than academic fields. The academic literature genuinely doesn't index every practitioner concern 1:1. A future fix would be to augment OpenAlex with non-academic sources.

## How to reproduce

```bash
# Set env
export RUN_POOL_EXPERIMENT=1

# Single-profile lift experiment
npx vitest run test/pool-experiment.test.ts

# OLD vs NEW prompt A/B
npx vitest run test/pool-experiment-prompt-ab.test.ts

# Precision audit (requires manual title inspection)
npx vitest run test/pool-experiment-relevance.test.ts

# Persona stress test — hand-authored areas
npx vitest run test/pool-experiment-personas.test.ts

# Persona stress test — full DeepSeek path
npx vitest run test/pool-experiment-personas-full.test.ts --testTimeout=600000
```

Requires `.env.local` with `OPENROUTER_API_KEY` and `OPENALEX_MAILTO`.

Each experiment reads the current prompts from `prompts/`, so to compare pre/post states against the committed change use `git show HEAD~1:prompts/preview-library-system.md` or equivalent.
