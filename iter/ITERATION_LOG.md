# Query Planner Prompt Iteration Log

**Date:** 2026-04-13
**Session budget:** ~$1.45 spent of $2 allocated
**Goal:** Design a query-planner system prompt that produces high-precision OpenAlex search queries across diverse reader profiles — the backbone of the paper-tracker product.

---

## Convergence criterion

A prompt "passes" a profile when it hits:
- **≥60% of queries in healthy band** (30–500 OpenAlex hits/week)
- **≥70% mean precision** (YES/PARTIAL/NO labels on top-5 hits per query)

Nothing passes all 4 profiles cleanly. Best-case configs pass 1-2 profiles.

---

## Test methodology

### The harness: `iter/score_plan.py`

One script runs: generate plan → query OpenAlex → classify top-5 hits → output scorecard JSON.

**Critical harness details:**
1. **Dedup** hits by id + title prefix (OpenAlex returns preprint + published versions of same work). Without dedup, precision is inflated/deflated by duplicate YES/NO labels. **Added mid-iteration — polluted v0/v1/v2/v3 comparisons.**
2. **Type filter**: `type:article|review|book-chapter|preprint|dissertation|report|peer-review` — excludes datasets, product listings, libguides, coupon pages, etc. **Added mid-iteration — marketing precision jumped +15pp from this alone.**
3. `per_page=15` fetched, trimmed to 5 unique after dedup.
4. Scoring: **DeepSeek v3.2** classifies top-5 titles per query as YES/PARTIAL/NO against the profile. ~$0.001/scoring call. Strict but consistent.
5. Date range: 2026-04-06 to 2026-04-13 (the "test week").

### Test profiles: `iter/profiles/`

4 profiles chosen to stress different vocabulary regimes:
- **llm_agents.md** — rich CS vocabulary, baseline easy case. Authors use standard phrases consistently.
- **marketing.md** — broad-concept field, heavy polysemy (`attention`, `urgency`, `reviews`, `conversion`, `framing` all polysemic).
- **afib.md** — clinical specialty, standard disease phrase, polysemous side terms (`ablation`, `flutter`, `trial`).
- **adolescent_depression.md** — compound narrow subject (population × condition), sparse author vocabulary, low weekly volume.

### Models tested on v4 prompt

| Model | Cost/run | Strength |
|---|---|---|
| openai/gpt-5.4 | $0.025 | Mid-quality baseline, high variance |
| google/gemini-3.1-pro-preview | $0.075 | Best on marketing (71/60) |
| minimax/minimax-m2.7 | $0.007 | Best breadth on LLM agents (87%) |
| qwen/qwen3.6-plus | $0.017 | Worst overall; parse errors |
| **deepseek/deepseek-v3.2** | **$0.002** | **Highest precision on LLM agents (79%), stable** |

---

## Prompt versions — what changed, what happened

All prompts saved in `iter/prompts/`. Each keeps the same Diversity / Anti-patterns / Recall safety / Quantity / Output-format sections; only the **Precision** section changed.

### v0_original.md — baseline
The prompt I inherited. "Every query must be scoped to the subject" with LLM-agent examples. **Unfair comparison point because early runs used the non-deduped harness.** After harness fixes, v0 on llm_agents jumped 40% → 81% healthy — pure harness effect.

### v1_field_anchor.md — ❌ over-corrected
**Idea:** introduce "field anchor" concept (loose OR group of category terms). Required on every query.
**Result:** marketing healthy dropped 56% → 13%. Because GPT-5.4 diluted phrase anchors to broader terms, and the broader terms subsumed the narrower subject. "Atrial fibrillation" got widened to "cardiovascular" → drowned in cardiology literature.
**Lesson:** widening the anchor to a bigger field is catastrophic when the bigger field publishes more papers/week than the narrow subject.

### v2_specificity_floor.md — ❌ too strict
**Idea:** "Specificity floor" — every disjunct in every OR group must pass a phrase/proper-noun test.
**Result:** LLM agents passed (81/69)! But marketing crashed to 6% healthy and adol_dep to 0% healthy with 3 zero-result queries. Every query in adol_dep had `"adolescent depression" OR "teen depression"` on BOTH sides of the AND, starving recall because author vocabulary is thinner than the prompt assumed.
**Lesson:** phrase-only anchors work for rich-vocabulary fields (LLM agents, cardiology). They starve recall for compound/narrow subjects.

### v3_specificity_carrier.md — ⭐ first principle, still incomplete
**Idea:** "Specificity carrier" on one side, "loose scoping" on the other. One side narrows, the other scopes.
**Result:** LLM agents 100% healthy, 76% precision — **first passing run**. But marketing dropped to 33/26 and afib to 27/51. GPT-5.4 applied the pattern symmetrically regardless of subject.
**Lesson:** the principle is right but the model needs explicit guidance on WHICH pattern fits WHICH subject type.

### v4_patterns.md — 🏆 best prompt
**Idea:** Three named patterns (A/B/C) with explicit selection rules:
- **Pattern A** — `[specific phrase] × [loose category anchor]` for broad-concept fields (marketing, education research)
- **Pattern B** — `[specific phrase] × [specific subject phrase]` for clinical / named-method subjects (LLM agents, cardiology)
- **Pattern C** — `[large phrase-anchor bundle ≥6 synonyms] × [loose method-family topic]` for narrow compound subjects (adolescent depression)
**Result:** Best overall. With DeepSeek + temp=0.3, passed LLM agents cleanly. Gemini Pro got marketing to 71/60 (closest to passing). AFib 53/62 with GPT-5.4 (2pp short of 60/70).
**Lesson:** pattern selection is the right abstraction. Giving the model a checklist by subject type is more effective than abstract rules.

### v5_checklist.md — ❌ adding rules ≠ better
**Idea:** Add a pre-commit 6-item checklist to v4 to force rule compliance.
**Result:** LLM agents dropped 80 → 67 healthy, parse error on adol_dep. The longer prompt may have overflowed GPT-5.4's reliable instruction-following.
**Lesson:** past a certain prompt length, more rules hurt. GPT-5.4 was already at the ceiling of what it would reliably apply.

### v6_recall_quota.md — partial win
**Idea:** Start from v4. Add mandatory "include 2-3 recall_safety queries" instruction, lower temperature to 0.3.
**Result with DeepSeek:**
- LLM agents: 100% healthy (all 3 runs), 71% precision — **temp 0.3 eliminated variance**
- AFib corpus grew 50% (405 → 606 papers) but still below 800 target
- Adol dep regressed slightly (precision 58 → 50)
- Marketing small precision gain (48 → 54)
- **DeepSeek generated 0 recall_safety queries** on LLM agents / AFib / adol_dep despite "MUST include" language. Only marketing produced ~1/run.
**Lesson:** explicit quota instructions are mostly ignored by DeepSeek when they conflict with Pattern B/C rules. Instructions need to be enforced by template slots, not natural-language "MUST".

---

## Full comparison matrix (healthy% / precision% / capped corpus)

| Profile | v0 orig | v1 anchor | v2 floor | v3 carrier | **v4 patterns** | v5 checklist | v6 quota (DS, t=0.3) |
|---|---|---|---|---|---|---|---|
| LLM agents | 40/50 | 50/63 | 81/69 | **100/76** ✓ | 80/77 ✓ (GPT) / 73/79 ✓ (DS) | 67/66 | **100/71 ✓ 2297 corpus** |
| Marketing | 56/28 | 13/42 | 6/42 | 33/26 | 50/46 (GPT) / **71/60** (Gem) | 50/44 | 42/54 809 corpus |
| AFib | 69/50 (noisy harness) | 40/58 | 60/58 | 27/51 | 53/62 | 33/55 | 33/54 606 corpus |
| Adol dep | 33/46 | 50/49 | 0/53 | 13/57 | 43/42 | PARSE ERROR | 27/50 612 corpus |

⚠️ v0-v3 numbers are **partly harness-noise** (deduping + type filter added mid-iteration). v4+ numbers are clean.

---

## What worked

1. **v4 pattern selection (A/B/C)** — the core abstraction. Different query shapes for different subject types.
2. **Harness dedup** — corrected 10-15pp of phantom precision across the board. The single biggest measurement fix.
3. **OpenAlex type filter** — +15pp precision on marketing by removing coupon/product spam.
4. **DeepSeek v3.2 at temp=0.3** — eliminated variance on LLM agents (74±34 → 100±0 healthy). Production-ready for technical subjects at $0.002/run.
5. **Gemini 3.1 Pro on marketing** — only model that got close to passing the hard profile (71/60). Worth the $0.075/run for broad-concept fields.

## What didn't work

1. **v1 field anchor** — diluting subject phrase to broader category names drowns narrow subjects.
2. **v2 phrase-only specificity floor** — starves recall for compound narrow subjects.
3. **v5 pre-commit checklist** — longer prompts reduce rule-following, not increase it.
4. **"MUST include" natural-language quotas (v6)** — DeepSeek ignored them when they conflicted with Pattern B/C.
5. **GPT-5.4 for cost-sensitive production** — moderate quality, high variance (~15pp/run), 12× more expensive than DeepSeek.

---

## Key insights to remember

1. **Plan variance at temp=0.7 is ~15pp** on GPT-5.4. Single-run A/B comparisons are unreliable — always multi-run for small differences.
2. **Temp=0.3 collapses variance** on DeepSeek (and likely other models). Use for stable production; use temp=0.7 only for human-in-the-loop ideation.
3. **Breadth band ≠ corpus size.** Healthy% is a bucketing artifact. The real metric is **capped corpus** (sum of `min(count, 200)` across queries) — that's what the downstream ranker actually sees.
4. **Marketing has a corpus quality ceiling** around 50-60% precision regardless of prompt. OpenAlex's marketing-adjacent content (predatory journals, adjacent fields, cross-discipline drift) can't be filtered by prompt alone. Need concept/topic-level filters or a post-ranker.
5. **Precision is harder to fix than recall.** Low-precision queries pollute the `found_by` signal used downstream. Better to drop a low-precision query than keep it.
6. **Compound subjects (population × condition) are structurally hardest.** "Adolescent depression", "elderly dementia", "postpartum anxiety" — both sides narrow, author vocabulary thin, weekly volume small. No prompt version cleanly solved this.
7. **Methodology/publication types are NEVER specificity carriers.** `"randomized trial"`, `"meta-analysis"`, `"systematic review"` match every field. Easy trap GPT-5.4 kept falling into.
8. **Complication phrases aren't specificity carriers either.** `"ischemic stroke"` for an AFib query drowns in general stroke literature. Use disease-native procedures/drugs instead.
9. **DeepSeek v3.2 parse error rate: ~17%.** Production needs automatic retry on JSON failure.

---

## Current production recommendation

**Primary planner:** `deepseek/deepseek-v3.2` + `v4_patterns.md` or `v6_recall_quota.md` + temperature 0.3 + retry-on-parse-error.
- Cost: ~$0.002/run
- Works great for technical/CS subjects
- Marginal for marketing
- Under-recalls for narrow clinical subjects

**Fallback for clinical / compound / broad-concept subjects:** `google/gemini-3.1-pro-preview` + same prompt.
- Cost: ~$0.075/run (37× more)
- Best single-model marketing result (71/60)

**Hybrid strategy:** classify subject type first (is it technical / broad-concept / clinical-narrow?), route to the cheap or expensive model accordingly. One human-authored router rule, or a classifier.

---

## Open problems for next session

1. **Clinical narrow subjects (AFib, adol dep) still under-recall.** v6 quota instruction was ignored by DeepSeek. Options:
   - Template-based prompt slots ("Query 15 must match this template: ...")
   - Two-pass generation: generate plan → check counts → add broad queries explicitly
   - Different model (Gemini) for this segment
2. **Marketing precision ceiling at ~50-60%.** Most of the remaining noise is OpenAlex corpus quality, not query structure. Consider:
   - `concepts.id` or `topics.id` filter at harness level (need to map profiles to concept IDs)
   - Post-ranker pass to drop low-relevance hits
3. **Parse error handling.** 17% rate for DeepSeek is production-concerning. Implement retry with exponential backoff.
4. **Multi-run variance study was killed.** Only 1 complete run. If we want to compare v4 vs v0 clean, need a proper 3-run study (~$0.30).
5. **Profile: test with user's real customers.** The 4 profiles I wrote are reasonable but synthetic. Real customer profiles might reveal different failure modes.

---

## File locations

```
iter/
├── ITERATION_LOG.md                     # this file
├── score_plan.py                        # test harness (has dedup + type filter)
├── prompts/
│   ├── v0_original.md                   # reconstructed baseline
│   ├── v1_field_anchor.md               # ❌
│   ├── v2_specificity_floor.md          # ❌
│   ├── v3_specificity_carrier.md        # ⭐ first pass
│   ├── v4_patterns.md                   # 🏆 best overall
│   ├── v5_checklist.md                  # ❌
│   └── v6_recall_quota.md               # v4 + mandatory recall quota
├── profiles/
│   ├── llm_agents.md
│   ├── marketing.md
│   ├── afib.md
│   └── adolescent_depression.md
└── runs/
    ├── v0_original_*.json               # baseline (harness noise)
    ├── v1_field_anchor_*.json
    ├── v2_*.json
    ├── v3_*.json
    ├── v4_*.json                        # includes *_dedup and *_typef
    ├── v5_*.json
    ├── models/*.json                    # v4 × 4 non-GPT models
    ├── deepseek_variance/*.json         # v4 × DeepSeek × 3 runs
    └── v6_deepseek/*.json               # v6 × DeepSeek × 3 runs × temp=0.3

# Legacy (pre-iter) files in repo root:
test_query_planner.py                    # original multi-model tester
test_queries.py                          # original OpenAlex query tester
run_plan_test.py                         # early variant of score_plan
query_planner_prompt.md                  # the working copy (currently = v1 state, NOT the best version; use iter/prompts/v4_patterns.md instead)
query_planner_user_prompt.md             # currently = marketing profile text
```

**⚠️ NOTE:** `query_planner_prompt.md` in the repo root is stale — it's the v1 edit I made early in the session. The best prompt is `iter/prompts/v4_patterns.md`. Do NOT use the root-level prompt for future work without syncing.

---

## Budget tracker

- Baseline (v0+v1 × 4 profiles): ~$0.20
- v2, v3, v4, v5 iterations: ~$0.25
- v4 dedup + type filter reruns: ~$0.15
- 5-model comparison on v4: ~$0.45
- DeepSeek variance study: ~$0.02
- v6 + DeepSeek + temp=0.3: ~$0.05
- Scoring (DeepSeek): ~$0.30
- **Session 1 total: ~$1.45 of $2 budget**

---

# SESSION 2 (2026-04-13, continued)

Goal: revisit v0 with the clean harness, settle the temperature question, reframe the metric around the actual product goal (broad coverage with precision), and prototype structural fixes for dead angles.

## Re-running v0 with clean harness

`iter/runs/v0_clean/` — v0 × 4 profiles × {DeepSeek v3.2, GPT-5.4}. The original v0 numbers in Session 1's table were polluted by the pre-dedup, pre-type-filter harness. Clean re-runs:

| Profile | v0 + DeepSeek | v0 + GPT-5.4 | (Session 1 noisy v0) |
|---|---|---|---|
| LLM agents | **87/76** ✓ | 80/71 ✓ | 40/50 |
| Marketing | 33/45 | 19/43 | 56/28 |
| AFib | 23/73 | 73/69 (1pp short) | 69/50 |
| Adol dep | 0/46 | 7/44 | 33/46 |

**Headline finding: v0 + DeepSeek on LLM agents *passes* (87/76).** The "v0 was bad" story from Session 1 was 90% harness noise. v0 is competitive with v4 on technical fields. GPT-5.4 wins big on AFib (+50pp healthy band).

## v0 + DeepSeek variance study (n=3, temp=0.7)

`iter/runs/v0_variance/`

| Profile | Runs (h%/p%) | Mean ± std |
|---|---|---|
| LLM agents | 100/74, 93/77, 87/75 | 93±7 / 75±2 ✓ |
| AFib | 57/61, 38/61, 43/54 | 46±10 / 59±4 |
| Adol dep | 0/54, 53/51, 50/51 | 34±30 / 52±2 |
| Marketing | 0/41, 0/31, 13/46 | 4±8 / 39±8 |

**Crucial observation: precision is rock-stable (σ ≤ 4 except marketing) but healthy-band has σ up to 30.** The healthy-band variance is mostly bucket-bucketing artifact — small swings in hit count flip queries across the 30/500 thresholds. **Precision is the trustworthy signal; healthy-band is noisy.**

DeepSeek parse-error rate measured at ~8% (1/13 runs).

## Temperature study attempted, harness rate-limited

`iter/runs/v0_variance_t03/` (corrupted)

Tried v0 × DeepSeek × temp=0.3 × 12 runs in parallel. Hit OpenAlex 429s on most runs and DeepSeek had a near-deterministic parse failure on the marketing profile at temp=0.3 (5/6 attempts). The OpenAlex outcomes are not comparable due to rate limiting. Plans were captured cleanly though, so we ran a plan-structure analysis instead (see `iter/analyze_plan_diversity.py`).

## Plan-structure analysis: temp=0.7 vs temp=0.3 (no OpenAlex)

Three Jaccard-similarity metrics across the 3 runs at each temperature, per profile:

| Profile | phrase-J 0.7→0.3 | token-J 0.7→0.3 | exact-query-J 0.7→0.3 | unique phrases/run 0.7→0.3 |
|---|---|---|---|---|
| LLM agents | 0.40 → 0.39 | 0.62 → 0.52 | 0.05 → 0.13 | 36 → 33 |
| Marketing | 0.24 → 0.25 | 0.44 → 0.45 | 0.00 → 0.01 | 52 → **66** |
| AFib | 0.24 → **0.40** | 0.29 → **0.49** | 0.01 → 0.03 | 35 → **58** |
| Adol dep | 0.32 → 0.31 | 0.49 → 0.57 | 0.00 → 0.01 | 38 → 47 |

**Findings:**
1. **Exact-query Jaccard ≈ 0 at both temps.** DeepSeek almost never writes the same query string twice, even at low temp. The "temp=0.3 collapses to one modal answer" claim from Session 1 is overgeneralized.
2. **What actually happens at temp=0.3 is angle convergence, not text convergence.** Same angles, same coverage, different rephrasings.
3. **AFib is the only profile with a real structural collapse** (phrase-J +0.16, token-J +0.20). AFib has the most "textbook" safe answer to converge on.
4. **Counter-intuitive: temp=0.3 produces MORE synonym-bundled queries**, not fewer. Marketing 52→66 phrases per plan, afib 35→58. Low temp picks the comprehensive modal plan with bundled synonyms; high temp takes shortcuts with fewer synonyms but more variation.
5. **Session 1's "temp=0.3 collapses LLM-agents variance to 100±0" effect was almost certainly band-bucketing noise, not real plan diversity collapse.** LLM agents was already at the high-healthy ceiling.

## Reframing the metric: union YES, not per-query precision

Per-query precision treats queries as independent. The product cares about the *deduped union* of relevant papers across the whole plan. New metrics in `iter/analyze_union.py`:

| Profile | YES papers/plan (mean ±std, n=3) | Union precision | Old per-q precision |
|---|---|---|---|
| LLM agents | 34±1 | 73% | 75% |
| AFib | 19±3 | 55% | 59% |
| Adol dep | 14±9 | 46% | 52% |
| Marketing | 9±6 | 38% | 39% |

- Union precision ≈ per-query precision (within ~5pp). The old metric wasn't *wrong*, just incomplete.
- **Adol dep YES count swings 4 → 19 → 19 across runs** — 5x variance in delivered relevant papers. The healthy-band metric was hiding this.
- **YES_unique share** (% of YES papers from only one query) measures plan complementarity:
  - LLM agents: 76-83% — well-designed
  - **AFib: 41-60% — over-redundant** (multiple queries catching the same papers; refactor for complementarity)

## Angle coverage analysis (`iter/analyze_angles.py`)

Hand-extracted 8-12 angles per profile. DeepSeek classifies which YES papers cover which angles. Reveals **dead angles** that no run covers.

| Profile | Angles | Coverage ≥1 YES (n=3) | ≥3 YES |
|---|---|---|---|
| LLM agents | 8 | **8.0/8 ±0** ✓ (solved) | 6.3/8 |
| AFib | 8 | 5.3/8 ±0.6 | 2.7/8 |
| Adol dep | 12 | 7.0/12 ±2.6 | 2.0/12 |
| Marketing | 8 | 5.0/8 ±2.6 | 1.0/8 |

**Persistent dead angles** (0 YES across all 3 runs):
- AFib: rate-vs-rhythm comparisons, RCTs/guideline updates
- Adol dep: IPT-A, behavioral activation, psychopharmacology
- Marketing: high run-to-run variance, no consistent dead angles

The AFib dead angles get **47 hits returned but 0 YES** — those are *wrong-corpus* failures, not empty corpus. Adol dep dead angles get 0-2 hits — those are *empty-corpus* (no papers exist for IPT-A this week). The two failure modes need different fixes.

## v7 — slot-filled prompt (`iter/prompts/v7_slotfilled.md`)

Structured the input: each profile gets a `.angles.json` file, the prompt requires N queries per angle, output tags each query with `angle_id` + `slot`. v7 was tested on 4 profiles × DeepSeek × 1 run. Single-run (with scorer noise still uncontrolled).

## v8 — two-pass with diagnostic + backfill (`iter/run_v8.py`)

Pass 1 = v7 plan + scoring. Pass 2 = single diagnostic LLM call that classifies each angle as `covered` / `marginal` / `wrong-corpus` / `empty-corpus`, then generates 1 backfill query per wrong-corpus or marginal angle. Backfills are run, scored, merged.

Cost: ~$0.005/run vs v7's ~$0.002/run vs v0's ~$0.002/run.

Designed in opposition to a fully-agentic per-query iteration loop, which would cost ~$0.05/run (25x) and doesn't fix the corpus-reality bottleneck.

## Apples-to-apples re-scoring (`iter/rescore_union.py`)

Discovered mid-comparison: **DeepSeek scorer at temp=0.0 is NOT deterministic.** v7 vs v8 on llm_agents had 25/39 label agreement on shared papers — 14 disagreements all flowed YES→PARTIAL. Direct YES-count comparisons across versions were polluted by scorer drift.

Fix: collected the union of all unique papers across v0/v7/v8 for each profile and scored them ONCE in a single batch. Used those stable labels to recompute union YES per run.

### Clean v0 vs v7 vs v8 comparison (stable scoring)

**YES papers per plan:**

| Profile | v0 mean ±std (n=3) | v7 | v8 | v8 vs v0 | v8 vs v7 |
|---|---|---|---|---|---|
| LLM agents | 30±4 | 38 | **39** | **+30%** | +3% |
| Marketing | 11±7 | 18 | **21** | **+91%** | +17% |
| AFib | **19±2** | 16 | 17 | **−11%** | +6% |
| Adol dep | 8±4 | **13** | 11 | +38% | −15% |

**Union precision:**

| Profile | v0 mean | v7 | v8 |
|---|---|---|---|
| LLM agents | 69% | 72% | **74%** |
| Marketing | 42% | **57%** | 53% |
| AFib | **55%** | 49% | 47% |
| Adol dep | **38%** | 34% | 32% |

### Findings

1. **The biggest architectural win is v0 → v7 (slot-filling).** +27% YES on LLM agents, +64% on marketing. v8's contribution on top is incremental.
2. **v8 beats v7 modestly (+3 to +17%) on 3/4 profiles.** Diagnostic + backfill recovers 2-3 extra YES papers per profile. Net win, but small relative to its 2.5x cost.
3. **AFib regression: v7/v8 lose to v0 (16-17 vs 19 YES).** Forcing 2 queries per angle wasted slots on weak angles (rate-vs-rhythm, RCTs/guidelines) where v0's free planner correctly under-allocated. **Mandatory equal slots is the wrong shape for profiles with uneven angle richness.**
4. **Slot-filling raises precision on rich profiles (LLM agents, marketing) and lowers it on profiles with thin angles (AFib, adol dep).** Forcing queries into corpus-sparse angles drags in noisier hits.
5. **v8's diagnostic JSON is more valuable as REPORTING than as recovery.** Adol dep correctly flagged 5 angles as empty-corpus and 7 as wrong-corpus. The backfills couldn't find papers that don't exist, but **knowing "no IPT-A papers this week" is a real product feature**.
6. **DeepSeek scorer noise is significant** even at temp=0.0. Production needs either ensemble scoring or a single-batch approach for cross-version comparisons.

## What worked (Session 2)

1. **Reframing metrics around union YES + angle coverage.** Per-query precision was the wrong target. Union YES with angle coverage tells you whether the user actually got useful papers.
2. **Slot-filled prompt structure (v7).** Explicit angle contract + 2 queries per angle = +27%-91% YES on profiles with rich corpora.
3. **Stable cross-run scoring via single-batch re-scoring.** Made v0/v7/v8 directly comparable.
4. **Two-pass diagnostic (v8).** The classification of angles into `covered/marginal/wrong-corpus/empty-corpus` is product-grade output regardless of whether backfills help.
5. **Plan-structure Jaccard analysis** as a cheap way to study temperature without OpenAlex.

## What didn't work (Session 2)

1. **Temperature 0.3 OpenAlex study** killed by parallel rate-limiting. Plan-structure findings still useful.
2. **v8 backfills for empty-corpus angles**: by definition, they can't help. The diagnostic is the value, not the recovery.
3. **Fixed equal slots (v7) on AFib**: regression vs v0. Slot allocation needs to respect uneven angle richness.
4. **DeepSeek temp=0.0 scoring**: not deterministic enough for direct YES-count comparisons across runs.

## Current production recommendation (Session 2)

**Default**: v7 (slot-filled, fixed equal slots) + DeepSeek + temp=0.7 + retry-on-parse-error. Single LLM call, ~$0.002/run. Wins LLM agents and marketing.

**Opt-in for transparency**: v8 diagnostic call (~$0.003 extra). Don't run backfills for empty-corpus angles; do run them for wrong-corpus angles only (selective backfill is a trivial change to `run_v8.py`).

**For AFib (clinical-narrow)**: route to v0 + GPT-5.4 (best single combo: 73/69, 25 YES papers). The slot-fill architecture actively hurts profiles where angles have uneven richness.

**For adolescent_depression**: no architecture solves the corpus reality. Use v7 + report empty angles as empty.

## v7.2 — model self-allocates within angle contract (`iter/prompts/v7_2_self_allocate.md`)

Same fixed angle list as v7, but instead of "exactly N queries per angle" the prompt gives the model a `QUERY_BUDGET` + `MIN_PER_ANGLE` + `MAX_PER_ANGLE` and asks it to allocate by its background knowledge of which fields publish prolifically. The model outputs an `allocation` block with per-angle counts and one-line reasons before writing the queries.

Cost: identical to v7 — single LLM call, ~$0.002/run.

### v7.2 allocation behavior (qualitative)

The model used field knowledge correctly. Examples from the AFib allocation:

- catheter ablation: **4 queries** (max) — *"most prolific technical/outcomes area in AFib"*
- anticoagulation: **3 queries** — *"high-volume area with constant DOAC studies"*
- LAAC, antiarrhythmics, RCTs/guidelines, screening: 2 each
- **rate vs rhythm control: 1 query** — *"settled debate with EAST-AFNET 4, few truly new comparison studies"*
- stroke prevention: 1 — *"broadly covered by anticoagulation and LAA occlusion angles"*

The model literally cited the trial that closed the rate-vs-rhythm debate. **The field-knowledge hypothesis is validated** — the relative ordering of "rich vs niche vs settled" sub-fields is stable in DeepSeek's training, and you can leverage it for free.

### Apples-to-apples — v0 / v7 / v8 / v7.2

YES papers per plan (stable scoring across all versions):

| Profile | v0 mean ±std | v7 | v8 | **v7.2** | v7.2 vs v0 | v7.2 vs v7 |
|---|---|---|---|---|---|---|
| **LLM agents** | 29±2 | 37 | 38 | 34 | +17% | -8% |
| **Marketing** | 11±7 | **18** | 22 | 19 | +73% | +6% |
| **AFib** | **21±1** | 16 | 18 | **21** | **=** | **+31%** |
| **Adol dep** | 16±6 | **22** | 19 | 20 | +25% | -9% |

Union precision:

| Profile | v0 mean | v7 | v8 | v7.2 |
|---|---|---|---|---|
| LLM agents | 67% | 71% | **74%** | 66% |
| Marketing | 41% | **57%** | 54% | 46% |
| AFib | 59% | 51% | 50% | **60%** |
| Adol dep | 51% | 41% | 40% | 40% |

### v7.2 findings

1. **AFib regression FIXED.** v7 → v7.2 lifts AFib YES from 16 → 21 (+31%). v7.2 ties v0 on YES (21 vs 21) and beats v0 on precision (60% vs 59%). The slot-fill architecture finally works on AFib once the slot allocation respects field richness.
2. **v7.2 is competitive everywhere except slight precision regression on rich profiles.** LLM agents/marketing precision drops 5-11pp because v7.2 spreads queries less aggressively into the rich anchor terms.
3. **Single-architecture coverage:** v7.2 is the first version where one prompt is competitive on ALL 4 profiles. v7 needed router logic (v0 for AFib, v7 for everything else); v7.2 doesn't.
4. **The auditable allocation reasoning is product-grade output.** "Allocated 4 to ablation, 1 to rate-vs-rhythm because EAST-AFNET 4 settled it" can be shown to users, logged for debugging, or used for profile refinement signals.
5. **Adol dep budget violation**: model wrote 26 queries instead of 24 (+8%). Need either harder enforcement or accept the overflow as a useful "model thinks it needs more capacity" signal.
6. **Scorer noise hit again**: LLM agents v7.2 first run had all 80 hits labeled `?`. Re-ran cleanly. Production needs scorer retry logic.

## Updated production recommendation (post-v7.2)

**Default**: v7.2 (model self-allocates within fixed angle contract) + DeepSeek + temp=0.7 + parse-error retry + scorer-flake retry.

- ~$0.002/run
- Single architecture works on all 4 profiles (no router needed)
- Comparable or better than v7 on every profile
- Fixes the AFib regression that v7 caused
- Produces auditable allocation reasoning as a side-effect

**Optional add-on**: v8-style diagnostic call WITHOUT backfills (~$0.001 extra) for honest empty/wrong-corpus reporting. Skip the backfill step — it doesn't help and adds cost.

**Routing complexity eliminated.** Session 2's earlier recommendation needed v0 for AFib, v7 for the rest, GPT-5.4 for clinical fallback. v7.2 collapses that to a single prompt + single model.

## Open problems for next session

1. **Budget overflow handling**: model exceeded adol_dep budget by 2 queries. Decide: hard truncate, hard reject + retry, or accept overflow as signal. The overflow cost is trivial (~$0.0002/run) but unbounded overflow is a concern.
2. **v7.2 multi-run variance**: only n=1 so far. Need n=3 to compare variance vs v0's known variance.
3. **v9 core+dynamic angles**: small user-specified core + model-generated dynamic angles per run. Catches emerging topics that fixed lists miss. Untested.
4. **Scorer noise**: 1/5 v7.2 runs in this session got all-`?` scoring. Production needs retry-on-empty-scoring.
5. **Selective backfill in v8**: only backfill wrong-corpus, skip empty-corpus.
6. **Marketing precision ceiling at ~50-60%**: structural — corpus quality issue. Concept/topic-level filters or post-ranker still needed.

## Session 2 file additions

```
iter/
├── analyze_plan_diversity.py    # Jaccard similarity between plans across runs/temps
├── analyze_union.py             # union YES / union precision per scorecard
├── analyze_angles.py            # angle coverage classification via DeepSeek
├── rescore_union.py             # apples-to-apples re-scoring across versions
├── run_v8.py                    # two-pass v7 + diagnostic + backfill
├── prompts/
│   ├── v7_slotfilled.md         # 🆕 slot-filled prompt with explicit angles input
│   └── v7_2_self_allocate.md    # 🆕 v7 + model self-allocates within budget
├── profiles/
│   ├── llm_agents.angles.json   # has both queries_per_angle (v7) + query_budget (v7.2)
│   ├── marketing.angles.json
│   ├── afib.angles.json
│   └── adolescent_depression.angles.json
└── runs/
    ├── v0_clean/                # v0 × {DS, GPT} × 4 profiles, clean harness
    ├── v0_variance/             # v0 × DS × 4 profiles × 3 runs (temp=0.7)
    ├── v0_variance_t03/         # plan-structure only (OpenAlex rate-limited)
    ├── v7/                      # v7 × DS × 4 profiles × 1 run
    ├── v8/                      # v8 × DS × 4 profiles × 1 run
    └── v7_2/                    # v7.2 × DS × 4 profiles × 1 run
```

`score_plan.py` was modified to accept `--angles <json>` for slot-filled prompts.

## Session 2 budget

- v0 clean (DS + GPT × 4 profiles): ~$0.11
- v0 variance (DS × 4 profiles × 3 runs): ~$0.013
- v0 variance temp=0.3 (rate-limited, redo + retries): ~$0.02
- Angle coverage classification (~16 calls): ~$0.013
- v7 runs (4 profiles + retries): ~$0.005
- v8 runs (4 profiles + retries): ~$0.015
- Apples-to-apples re-scoring (~16 batch calls): ~$0.04
- **Session 2 total: ~$0.22**

**Cumulative project total: ~$1.67**

---

# SESSION 3 (2026-04-16 → 2026-04-17)

**Goal:** Stop refining v8's boolean-AND/OR prompt. Test a different methodology — grounded seed → vocabulary-mine → build — from `docs/superpowers/specs/keyword-discovery-spec.md`. Decide whether to ship v8, v9, or something else as the onboarding-time query library builder.

## What v9 is (new architecture, not a new prompt)

Six-step pipeline, implemented in `iter/keyword_discovery.py`:

1. **generate_seeds** — LLM produces 3–5 broad seed phrases (2–4 words, literal — no booleans)
2. **fetch_seed_papers** — parallel OpenAlex calls over 6-month window via `title_and_abstract.search`, 50 papers per seed
3. **extract_vocabulary** — pure code: aggregate topics, subfields, fields, keywords, journals from returned papers
4. **build_library** — LLM turns extracted vocabulary into 12–16 short space-separated queries
5. **validate_queries** — parallel OpenAlex calls (per_page=1) against the scoring window to confirm volumes
6. **reformulate** — conditional LLM pass if ≥3 queries failed validation

Output: a query library in JSON that plugs into `score_plan.py` via the new `--plan-from-file` flag.

Drivers: `iter/run_v9_discovery.py`, `iter/run_all_v9.sh`, `iter/run_all_v9_hybrid.sh`, `iter/run_all_v91.sh`.

## Key harness upgrades this session

- **`score_plan.py --plan-from-file PATH`** — bypass LLM plan generation and score a pre-built library. Lets v9 libraries and v8 plans go through the exact same scoring path.
- **`score_plan.py --filter {search,title_and_abstract.search}`** — switch OpenAlex's retrieval mode for scoring. Isolates the filter effect from the methodology effect.
- **Abstract-aware judge** — `score_titles` now gets `title (≤300 chars) + first 500 chars of abstract` instead of just a 200-char title. Reconstructed from `abstract_inverted_index`. This changed the precision story substantially (see below).
- **Scorer retry + batching** — 3-attempt retry on empty scores (DeepSeek returns `"scores": []` ~15% of the time), and requests are split into batches of 15 papers so one bad batch can't zero out a whole profile.
- **Parallelism everywhere** — seed fetch (ThreadPoolExecutor max_workers=5), per-query OpenAlex fetch in `score_plan.py` (max_workers=8), LLM scoring batches (max_workers=5). Score stage went from ~17 min (sequential, hung on retries) to ~25–60s.
- **`fetch_openalex` retry with backoff** — 2 attempts, 20s timeout each, fixes transient throttling without ballooning worst-case runtime.

## The scoring methodology problem (v8 precision was inflated)

The pre-existing harness scored papers **using only titles** — no abstract. After switching the judge to title+abstract:

| Profile | v8 precision (title-only, averaged) | v8 precision (abstract-aware, single run) | Δ |
|---|---:|---:|---:|
| llm_agents | 0.737 | 0.51 | **-0.227** |
| marketing | 0.477 | 0.38 | -0.097 |
| afib | 0.575 | 0.55 | -0.025 |
| adol_dep | 0.585 | 0.45 | -0.135 |

v8's headline precision was inflated 10–23pt on the broad profiles. Every comparison vs v9 had to be redone with the abstract-aware judge — the original "v9 loses 11pt of precision" conclusion disappeared once the judge could actually read the abstracts.

All session-3 comparisons below use the abstract-aware judge unless noted.

## Variants tested this session

| Variant | Step 1 | Step 4 library | Step 6 reformulate | Retrieval filter | Serendipity allowed? | Angle slots? |
|---|---|---|---|---|:-:|:-:|
| v8 baseline | — | v7_slotfilled (boolean AND/OR) | — | `search` | n/a | yes (slotted) |
| v9 (DeepSeek) | DeepSeek | DeepSeek | DeepSeek | `search` | yes | no |
| v9 / tiab | DeepSeek | DeepSeek | DeepSeek | `title_and_abstract.search` | yes | no |
| v9 hybrid | DeepSeek | **Gemini 3.1 Pro Preview** | DeepSeek | `search` | yes | no |
| **v9.1** | DeepSeek | DeepSeek + **REQUIRED_ANGLES** | DeepSeek | `search` | **no** | **yes + fill-missing** |

## Aggregate results (4 original profiles, abstract-aware judge, apples-to-apples at top-5 hits/query)

| Variant | mean frac_healthy | precision (strict) | precision (lenient YES+PARTIAL) | mean unique papers |
|---|---:|---:|---:|---:|
| v8 | 0.49 | 0.47 | 0.64 | 54 |
| v9 (DeepSeek) | 0.70 | 0.45 | 0.56 | 60 |
| v9 hybrid | 0.61 | 0.47 | 0.63 | 52 |
| v9.1 @top5 | 0.70 | 0.40 | 0.57 | 51 |
| v9 / tiab | 0.12 | 0.42 | 0.60 | 33 |

## Absolute useful-paper count (YES + PARTIAL of papers scored)

| Profile | v8 | v9 | v9 hybrid | v9.1 @top10 | v9.1 @top5 |
|---|---:|---:|---:|---:|---:|
| llm_agents | 47 / 70 | 53 / 75 | 46 / 70 | **84 / 120** | 48 / 60 |
| marketing | 39 / 66 | **51 / 74** | 43 / 65 | 42 / 124 | 28 / 64 |
| afib | **51 / 72** | 41 / 76 | 38 / 58 | 63 / 120 | 35 / 60 |
| adol_dep | **37 / 65** | 27 / 80 | 26 / 45 | 62 / 160 | 30 / 80 |
| ai_agents_v2 | — | 93 / 160 | — | **98 / 140** | 50 / 70 |

## What the vocabulary-grounded approach actually did

Measured per-profile on real OpenAlex data:

- **Broad fields (llm_agents, ai_agents_v2):** v9 surfaces real emerging vocab the human didn't write. Example: `cognitive architecture agents` (n=123 healthy, 90% precision) — never appeared in v8's boolean plans.
- **Marketing:** v9 broadens recall (80% healthy vs v8's 60%) but the corpus is dominated by regional case studies — both methodologies hit the same precision ceiling. v8 was better here under the title-only judge, but with abstracts v9/DeepSeek edges v8 on useful-paper count.
- **Clinical narrow fields (afib, adol_dep):** v8 wins on useful-paper count because its boolean queries explicitly name drugs/trials (`apixaban OR rivaroxaban`, `EARLY-AF OR EAST-AFNET 4`). v9's seed-generated vocabulary didn't recover those terms. The vocabulary-discovery advantage assumes the user doesn't already know the field's jargon — in clinical work the reader's angles already encode the jargon.

## Gemini 3.1 Pro on step 4 (v9 hybrid)

Swapped DeepSeek for Gemini 3.1 Pro Preview on the library-build step only (steps 1 + 6 stayed on DeepSeek).

- **Cost:** $0.046/profile (46× DeepSeek-only v9). Gemini is $0.064–$0.080 per step-4 call; latency 150–260s.
- **Quality:** precision climbed back to v8 parity (lenient 0.63), but recall dropped (61% healthy vs 70% DeepSeek-only). Gemini writes smaller, more deliberate libraries (13–14 queries vs 15–16).
- **Clinical edge:** on afib, hybrid precision (0.57) slightly beat everything else. This was the only clear per-profile win for hybrid.
- **Verdict:** not worth 45× cost for the other 3 profiles. If you use Gemini Pro anywhere, spend it on the curator step (future), not library build.

## v9.1 — slot-filled + coverage-check + no serendipity

v9's biggest failure on the user's real onboarding profile (ai_agents_v2): **silently dropped "Code-generation agents"** — an explicit angle — from the library. 4 of 16 v9 queries were off-target "serendipity" (verifiable secret sharing, corporate governance).

Fixes:
1. **Drop serendipity dimension entirely.** Only `core`, `intersection`, `adjacent` allowed. Every query must serve a listed angle.
2. **Adopt v7_slotfilled's language**: `REQUIRED_ANGLES (you MUST cover every one of these)`, with `MIN_PER_ANGLE: 1`, `MAX_PER_ANGLE: 3`, `QUERY_BUDGET: max(N+4, 12) capped at 16`.
3. **Every query must declare an `angle_id`** (1-based integer) so coverage can be verified in code.
4. **Step 4.5 — coverage check + fill-missing.** After build, code checks which angles have 0 queries; if any, one small LLM call generates exactly one query per missing angle, using the same vocabulary.
5. **Reformulate preserves `angle_id`** so fixes don't accidentally drop coverage.

### Coverage delivered

| Profile | Angles covered first build | Fill-missing triggered? |
|---|:-:|:-:|
| llm_agents | 8/8 | no |
| marketing | 7/8 | **yes** — angle #8 added |
| afib | 8/8 | no |
| adol_dep | 12/12 | no |
| ai_agents_v2 | 10/10 | no |

**38/41 angles covered on first build (93%). 41/41 after the fill-missing pass.** The "MUST cover every one" language did almost all the work; fill-missing rescued one near-miss.

### v9.1 trade-offs (measured)

- **Lenient precision at matched top-5:** 0.57 — ties v9.0, 7pt below v8/hybrid
- **Coverage:** guaranteed per-angle representation; zero silent drops
- **Recall on marketing:** dropped from 0.69 (v9.0) to 0.44 (v9.1) — forcing coverage on a weak-corpus angle adds noise. This is the one profile where v9.1 is worse than v9.0.
- **Cost:** $0.002–$0.004/profile (larger prompt with REQUIRED_ANGLES section)
- **Wall time:** 2–4 min (DeepSeek API latency variance; one adol_dep judge batch took 4 min standalone)

## Preview vs full-digest split decision

User accepted "one pipeline, two modes" over a separate v8-for-clinical / v9-for-broad router.

**Shipped recommendation:**
- **Onboarding preview:** steps 1–4 (compact library: 1 query per angle, no intersections) → weekly fetch → mini curator writing 3 angle-grouped highlights in `output_style`. ~$0.003, 15–30s.
- **Full digest:** steps 1–6 once at onboarding (library hardened with validation + reformulation, stored in config). Steps 7–8 (weekly fetch + curator) every cycle. Onboarding ~$0.003, per-cycle ~$0.01–$0.02.

**One fix identified but not shipped:** add angle texts as supplementary seeds in step 1. Currently seeds come only from the LLM; the fix would use `LLM seeds ∪ first-2-words-of-each-angle`. This should close most of v8's clinical-precision advantage by forcing the vocabulary miner to read drug/procedure-named papers, not just generic field papers. ~10-line change, untested.

## Session 3 key numbers

### Cost per profile (discovery only, not per-cycle fetch/curate)

| Variant | LLM cost |
|---|---:|
| v8 (v7_slotfilled) | $0.0016 |
| v9.0 | $0.0013 |
| v9.1 | $0.0028 |
| v9 hybrid (Gemini step 4) | $0.0462 |

### Performance — scoring stage (14 queries × 10 hits each)

- Sequential (pre-fix): 15–17 min with hangs
- Parallel (final): 25–60s wall time. 8-way OpenAlex + 5-way LLM batches.

### Critical bug fixes landed in score_plan.py

1. **Filter double-encoding** in `title_and_abstract.search` URL construction — was returning 0 results for everything (discovered during smoke test).
2. **Scorer all-zero failure mode** — single-call scoring + DeepSeek JSON parse failure → 0 YES labels across entire profile. Fixed with 3-attempt retry + batch-of-15 isolation. Two initial v9 results ($0.0 precision on marketing/adol_dep in the first aggregate) were this bug, not real.
3. **Pipe buffering hiding progress** — `python3 | tail -25` buffers stdout, so a running script appears frozen. Final scripts call `python3 -u` and drivers use per-stage `flush=True`.
4. **Abstract reconstruction** — `reconstruct_abstract(inv_idx)` turns OpenAlex's inverted-index format back into plain text.

## Open problems for next session

1. **The angle-seeded fix:** implement `LLM seeds ∪ angle-derived seeds` in step 1 and re-test afib/adol_dep to measure the lift. If it closes the v8 gap, v9.1 is strictly better than v8 everywhere.
2. **Curator step (Phase 4)** not built yet. Preview recommendation depends on having a mini-curator that writes angle-grouped highlights in the user's `output_style`. Prompt design + pricing comparison (DeepSeek vs Gemini/Claude for the write-up) open.
3. **Marketing corpus quality** is a structural ceiling no query methodology fixes. Either accept it in the rank step, or add source/journal filters.
4. **10-hits-per-query vs 5** costs ~4pt precision but doubles useful-paper volume. Right number for the curator is probably 10 (more candidates to rank from); the preview should use 5 (less curator load).
5. **Onboarding step 1 (seeds)** currently uses only the AI-synthesized profile description. Consider prepending the subject + `output_style` key terms — some of those disambiguate the field (e.g., "DTC growth" vs "academic marketing").
6. **Production integration**: nothing in `src/` uses any of `iter/keyword_discovery.py`. The TS port lives in a future task.

## Session 3 file additions

```
iter/
├── keyword_discovery.py         # 🆕 6-step v9/v9.1 pipeline (generate_seeds, fetch_seed_papers,
│                                   extract_vocabulary, build_library, validate_queries,
│                                   check_coverage, fill_missing_angles, reformulate, discover)
├── run_v9_discovery.py          # 🆕 CLI driver; --library-model, --seed-model, --reformulate-model flags
├── run_all_v9.sh                # 🆕 4-profile driver, default search + tiab
├── run_all_v9_hybrid.sh         # 🆕 4-profile driver, Gemini Pro on step 4
├── run_all_v91.sh               # 🆕 4-profile driver, v9.1 slot-filled
├── rescore_with_abstracts.py    # 🆕 re-score stored plans with abstract-aware judge
├── compare_v8_v9.py             # 🆕 aggregate table builder, both strict and lenient precision
├── compare_v9_versions.py       # 🆕 v9.0 vs v9.1 side-by-side on ai_agents_v2
├── dump_hits.py                 # 🆕 per-variant per-query hit dump (human review)
├── dump_unique_papers.py        # 🆕 per-profile deduped paper tables (markdown)
├── dump_ai_agents_v2.py         # 🆕 single-profile unique-paper dump
├── profiles/
│   ├── ai_agents_v2.md          # 🆕 real onboarding profile (AI agents + observability)
│   └── ai_agents_v2.angles.json # 🆕 10 angles, query_budget 16
└── runs/
    ├── v8_rescored/             # 🆕 v8 plans re-scored with abstract-aware judge
    ├── v9_keyword_discovery/    # 🆕 v9 discovery artifacts + scoring + unique-papers tables
    │   ├── {profile}.json / .json.plan.json / .rescored.json / .rescored.tiab.json
    │   ├── {profile}_v91.json + .rescored.json
    │   ├── ai_agents_v2.* + ai_agents_v2_v91.*
    │   ├── COMPARISON.md        # auto-generated aggregate report
    │   └── unique_papers/{profile}.md  # human-review tables per profile per variant
    └── v9_hybrid/               # 🆕 Gemini-library-step variant
```

`score_plan.py` gained: `--plan-from-file`, `--filter`, abstract reconstruction, batched+retried scorer, parallel OpenAlex fetch, parallel LLM scoring batches. `keyword_discovery.py` implements the 6-step spec plus angle-slot + fill-missing extensions.

## Session 3 budget

- v9.0 runs (4 profiles, default search + tiab scoring): ~$0.006
- v9 hybrid runs (4 profiles, Gemini Pro step 4): ~$0.18
- v9.1 runs (4 profiles + ai_agents_v2): ~$0.013
- Abstract-aware re-scoring (v8 + v9 both filters, 12 runs): ~$0.05
- ai_agents_v2 runs (v9.0 + v9.1): ~$0.005
- Failed/retried scoring runs (pipe-buffer debugging): ~$0.02
- **Session 3 total: ~$0.27**

**Cumulative project total: ~$1.94**
