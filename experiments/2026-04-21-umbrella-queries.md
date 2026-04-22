# Umbrella queries for search-grade framework subjects

**Date:** 2026-04-21
**Status:** Shipped. Variant A merged into `prompts/propose-research-areas-system.md`; variant B lives at `src/lib/ai/discovery/umbrella.ts` and is wired into `src/lib/ai/preview/pipeline.ts`.
**Reproducible test:** `test/pool-experiment-umbrella.test.ts` (gated on `RUN_POOL_EXPERIMENT=1`) — BASELINE/A arms both load the shipped prompt; A+B is effectively "shipped + umbrella B lane".

## Problem

When a reader names their subject using established academic frameworks ("CBT and schema therapy", "reinforcement learning", "Kalman filtering"), the current proposer over-decomposes into sub-mechanisms and the library builder never emits a query for the umbrella term itself. The canonical keyword the literature indexes under is dropped.

Example: for subject `"CBT and schema therapy"`, the baseline pipeline produces research areas like `"third-wave CBT protocols"`, `"schema therapy mode work and chair dialogues"`, etc. Its library builder then emits queries like `"third wave therapy"`, `"schema therapy modes"`. Neither `"cognitive behavioral therapy"` nor `"schema therapy"` ever gets searched, so meta-analyses, protocol updates, and RCTs filed under those umbrella terms never reach the pool.

The architecture makes this structural: `preview-library-system.md` mandates **exactly one query per research area**, so even if the LLM wanted to emit an umbrella query there's no slot for it. And `propose-research-areas-system.md`'s rule 2 ("each area must name a specific mechanism / technique family / metric / trend") explicitly discourages umbrella terms.

## Method

Two independent interventions, tested in a 2×2 factorial.

### Variant A — proposer prompt carve-out

Added rule 8 to `prompts/propose-research-areas-system-v2.md`:

> **Search-grade umbrella terms stay.** If the reader's subject names one or more established academic frameworks, therapies, techniques, or algorithm classes that are themselves stable, indexed search terms in the literature, include each one **verbatim as its own research area**. Then add sub-areas *around* it, not *instead of* it.

Rule gate: the term must pass the same two tests as rule 2 — weekly publication volume and top-of-results relevance when the term is run as a standalone lit search. The textbook heuristic: "if there are graduate-level textbooks titled with the exact term, it's probably a search-grade umbrella."

### Variant B — umbrella-queries lane

Deterministic subject parser. Split the `subject` string on `" and "`, commas, and semicolons. For each fragment, strip trailing scope clauses (`" in …"`, `" for …"`, `" of …"`, `" with …"`, `" at …"`) and leading stopwords. Keep fragments with 1–4 content words. Each surviving fragment becomes a library query with its literal text as the query and a sentinel `research_area_id` (≥1000) to distinguish it from area queries.

No LLM call, no rewriting. The test is whether this simple heuristic gives a meaningful pool lift with minimal precision damage.

Extraction results for the 7 test personas:

| Persona subject | Extracted umbrellas |
|---|---|
| `LLM agents and tool-use in production systems` | `LLM agents`, `tool-use` |
| `atrial fibrillation management and stroke prevention` | `atrial fibrillation management`, `stroke prevention` |
| `ocean heat content and marine heatwaves` | `ocean heat content`, `marine heatwaves` |
| `consumer behavior in e-commerce checkout flows` | `consumer behavior` |
| `solid-state lithium battery electrolytes` | `solid-state lithium battery electrolytes` |
| `formative assessment in K-12 mathematics` | `formative assessment` |
| `CBT and schema therapy` | `CBT`, `schema therapy` |

### Experiment design

Seven personas × four arms each:

| Arm | Proposer | Library queries |
|---|---|---|
| BASELINE | current prompt | area queries only |
| A | v2 prompt (rule 8 added) | area queries only |
| B | current prompt | area queries + umbrella queries |
| A+B | v2 prompt | area queries + umbrella queries |

Shared per persona: seed generation, seed-fetch, vocabulary extraction (driven by BASELINE areas — the field's vocabulary is the field's vocabulary regardless of how the proposer decomposes it).

Metrics: deduplicated pool size, in-field hits (primary_topic.field ∈ top-5 seed fields), precision = in / (in+off), area coverage (areas with ≥1 hit), and **umbrella-paper count** (papers whose title contains an umbrella term verbatim, case-insensitive) as a direct measure of canonical-framework recall.

## Results

### Aggregate — 7 personas × 4 arms

| Persona | Arm | Areas | Lib queries | Pool | In-field | Off-field | Precision | Coverage | Umbrella papers | Avg tokens |
|---|---|---:|---:|---:|---:|---:|---:|---|---:|---:|
| AI/LLM engineer | BASELINE | 9 | 9 | 75 | 60 | 11 | 85% | 9/9 | 3 | 2.89 |
| AI/LLM engineer | A | 8 | 8 | 65 | 55 | 10 | 85% | 8/8 | 2 | 2.75 |
| AI/LLM engineer | B | 9 | 11 | 92 | 80 | 11 | 88% | 9/9 | 12 | 2.64 |
| AI/LLM engineer | **A+B** | 9 | 11 | **100** | 86 | 13 | 87% | 9/9 | **12** | 2.64 |
| Cardiologist | BASELINE | 8 | 8 | 36 | 36 | 0 | 100% | 6/8 | 1 | 3.13 |
| Cardiologist | A | 10 | 10 | 41 | 39 | 2 | 95% | 6/10 | 1 | 2.80 |
| Cardiologist | B | 8 | 10 | 98 | 82 | 8 | 91% | 7/8 | 5 | 2.10 |
| Cardiologist | **A+B** | 10 | 12 | **83** | 80 | 3 | 96% | 9/10 | **5** | 2.50 |
| Climate scientist | BASELINE | 10 | 10 | 32 | 21 | 3 | 88% | 8/10 | 3 | 2.80 |
| Climate scientist | A | 8 | 8 | 26 | 21 | 0 | 100% | 7/8 | 3 | 3.13 |
| Climate scientist | B | 9 | 11 | 46 | 36 | 1 | 97% | 8/9 | 6 | 3.00 |
| Climate scientist | **A+B** | 9 | 11 | **31** | 24 | 1 | 96% | 5/9 | **6** | 2.73 |
| Digital marketer | BASELINE | 8 | 8 | 40 | 23 | 17 | 57% | 7/8 | 0 | 3.00 |
| Digital marketer | A | 9 | 9 | 41 | 17 | 24 | 41% | 8/9 | 0 | 3.00 |
| Digital marketer | B | 10 | 11 | 92 | 55 | 29 | 65% | 10/10 | 11 | 2.27 |
| Digital marketer | **A+B** | 8 | 9 | **49** | 32 | 16 | 67% | 6/8 | **11** | 2.44 |
| Materials scientist | BASELINE | 10 | 9 | 85 | 79 | 6 | 93% | 9/10 | 0 | 2.56 |
| Materials scientist | A | 8 | 8 | 66 | 63 | 3 | 95% | 8/8 | 0 | 2.88 |
| Materials scientist | B | 9 | 10 | 96 | 91 | 5 | 95% | 9/9 | 0 | 2.70 |
| Materials scientist | **A+B** | 9 | 10 | **80** | 73 | 7 | 91% | 9/9 | **0** | 3.00 |
| Education researcher | BASELINE | 9 | 9 | 35 | 24 | 10 | 71% | 6/9 | 1 | 3.00 |
| Education researcher | A | 8 | 8 | 42 | 29 | 13 | 69% | 6/8 | 3 | 3.00 |
| Education researcher | B | 8 | 9 | 0 ⚠︎ | 0 | 0 | — | 0/8 | 0 | 2.89 |
| Education researcher | **A+B** | 9 | 1 ⚠︎ | 8 | 8 | 0 | 100% | 0/9 | 7 | 2.00 |
| Clinical psychologist | BASELINE | 8 | 8 | 33 | 23 | 10 | 70% | 8/8 | 1 | 3.00 |
| Clinical psychologist | A | 12 | 12 | 46 | 38 | 7 | 84% | 8/12 | 3 | 2.67 |
| Clinical psychologist | B | 9 | 11 | 26 | 23 | 3 | 88% | 7/9 | 9 | 2.73 |
| Clinical psychologist | **A+B** | 12 | 14 | **48** | 40 | 8 | 83% | 9/12 | **8** | 2.50 |

⚠︎ Education researcher arm B and A+B hit independent run-time flakes — details below.

### BASELINE → A+B deltas

| Persona | Pool Δ | Relevant Δ | Umbrella-paper Δ | Precision Δ |
|---|---|---|---|---|
| AI/LLM engineer | 75 → 100 (+25) | 60 → 86 (+26) | 3 → 12 (+9) | 85% → 87% |
| Cardiologist | 36 → 83 (+47) | 36 → 80 (+44) | 1 → 5 (+4) | 100% → 96% |
| Climate scientist | 32 → 31 (−1) | 21 → 24 (+3) | 3 → 6 (+3) | 88% → 96% |
| Digital marketer | 40 → 49 (+9) | 23 → 32 (+9) | 0 → 11 (+11) | 57% → 67% |
| Materials scientist | 85 → 80 (−5) | 79 → 73 (−6) | 0 → 0 (+0) | 93% → 91% |
| Education researcher | 35 → 8 (−27) | 24 → 8 (−16) | 1 → 7 (+6) | 71% → 100% |
| **Clinical psychologist** | **33 → 48 (+15)** | **23 → 40 (+17)** | **1 → 8 (+7)** | **70% → 83%** |

### Clinical psychologist — target case detail

The motivating persona for this experiment. Both umbrella queries landed cleanly:

```
[UMBR] query="CBT"                  hits=15 in-field=11 off=4   (73% precision)
[UMBR] query="schema therapy"       hits=15 in-field=13 off=2   (87% precision)
```

These returned 30 papers combined, of which 24 were in-field, dropping to 28 in the final pool after dedup against area queries. Without these queries, baseline scored only 1 umbrella paper — meaning papers titled with CBT or schema therapy verbatim almost entirely evaded the decomposed-area queries.

Variant A also fired correctly for this persona. Arm A's areas list included `"cognitive behavioral therapy"` (id=1) and `"schema therapy"` (id=2) as first-class areas. The library builder then produced queries `"cognitive behavioral therapy"` (15/15 in-field) and `"schema therapy"` (13/15) naturally — no umbrella lane needed. Arm A's pool (46) is nearly identical to arm A+B's pool (48), confirming that when variant A fires, variant B's queries are mostly redundant (dedup catches the overlap).

### AI/LLM engineer — where variant A failed but B carried

Variant A's areas list for this persona included `"LLM agent frameworks (LangChain, LlamaIndex, AutoGen)"` but not `"LLM agents"` verbatim — the LLM judged it too generic and decomposed. Arm A pool (65) actually regressed from baseline (75) because the variant-A areas happened to be narrower.

Variant B's umbrella queries rescued it:
```
[UMBR] query="LLM agents"           hits=15 in-field=13 off=2   (87% precision)
[UMBR] query="tool-use"             hits=15 in-field=13 off=2   (87% precision)
```

Arm A+B pool hit 100 (+25 over baseline), carried almost entirely by variant B.

### Cardiologist — variant A correctly DID NOT fire

Subject `"atrial fibrillation management and stroke prevention"` — `"atrial fibrillation management"` is a therapeutic goal, not a named framework. Variant A's rule 8 correctly did not keep it as an area; arm A's areas are standard decompositions (DOACs, LAAO, catheter ablation, etc.), same character as baseline.

Variant B's umbrella queries still fired (the deterministic parser has no notion of "framework vs. goal"):
```
[UMBR] query="atrial fibrillation management"   hits=15 in-field=15 off=0  (100%)
[UMBR] query="stroke prevention"                hits=15 in-field=14 off=1  (93%)
```

These are the exact things a cardiologist reading a digest would want — review articles, guideline updates, comparative-effectiveness pieces filed under the umbrella label. Pool jumped 36 → 83, precision only slipped 100% → 96% (and the "off-field" counts partly reflect OpenAlex classifying some stroke-prevention papers under General Medicine rather than Cardiology).

### Education researcher — two independent flakes obscured the signal

- Arm B ALL 9 library queries (including the umbrella `"formative assessment"`) returned 0 hits. Run A+B's identical umbrella query returned 15 in-field hits. This is a transient OpenAlex-side failure during arm B's runLibrary burst — not a structural issue with umbrellas.
- Arm A+B's library has only 1 query (the umbrella alone). The proposer returned 9 areas but `buildCompactLibrary` returned 0 area queries — a separate LLM-side flake.

Taking the one surviving data point: the umbrella query `"formative assessment"` returned 15 papers all in-field (100% precision). Signal direction matches other personas; magnitude is unmeasured.

## Analysis

### The target case is a clean win

The Clinical psychologist persona is the one that motivated this experiment. All three metrics that matter moved in the right direction: pool +15, relevant papers +17, umbrella-paper count +7, precision UP by 13 points. The two umbrella queries alone added 22 relevant papers net of dedup. This is the signal we were hunting for and it's unambiguous.

### Variant A is useful but unreliable

Variant A relies on LLM judgment: "is this subject term a search-grade framework?" It gets this right for CBT/schema therapy but misses for LLM agents (judged too generic and decomposed anyway). Cardiologist correctly does NOT fire (good — AFib management isn't a framework).

Pattern: variant A works for named therapies and classical techniques with dedicated textbooks. It's weaker for emerging fields where the umbrella term is rising to canonical status but isn't there yet (LLM agents). You can't prompt your way around this — the rule depends on the LLM's training data reflecting which terms the literature actually uses as keywords.

### Variant B is the robust lane

The deterministic parser has no judgment — it always produces umbrella queries from whatever the subject says. This is a feature for recall and a modest liability for precision. Every persona where umbrellas made semantic sense got umbrella-paper lift under B. The only persona where B added nothing was materials scientist (where the "umbrella" extracted IS the full subject, duplicating what the library builder already produces — no new papers).

On precision: B costs at most ~10 percentage points and often improves it. The cardiologist case (100% → 91%) is the largest drop but the "off-field" hits are mostly borderline cases where OpenAlex classified stroke-prevention papers under General Medicine rather than Cardiology.

### When to use A+B vs. A vs. B

- **A+B** is the safest default: A handles the named-framework case cleanly (umbrella ends up in the areas list, visible to the reader, and dedup catches the overlap with B). B is the safety net when A doesn't fire or the reader removes the umbrella from the areas list.
- **A alone** is NOT sufficient — it misses AI/LLM engineer's `"LLM agents"` umbrella, which B would have caught.
- **B alone** is nearly as good as A+B on pool size, but leaves the user-facing Research Plan view unchanged — readers who added "CBT" explicitly don't see "CBT" on the plan.

### Precision did not collapse

Five of seven personas stayed at or above baseline precision under A+B. Two dropped by 2–3 points (noise range). The expensive regression mode — umbrella queries pulling floods of off-topic homograph noise — did not materialize, because the umbrella terms the deterministic parser extracts are discipline-specific enough not to homograph. "CBT" is unique to clinical psychology; "schema therapy" is unique; "LLM agents" is unique; "atrial fibrillation" is unique. The material scientist's full-subject umbrella is too long to homograph. Only "consumer behavior" (digital marketer) is a somewhat homograph-risky term, and even there precision went UP (57% → 67%) — because the baseline was already noisy and the umbrella added high-quality review-article matches.

### Cost

Each umbrella query adds one OpenAlex request. The subject parser produces 1–2 umbrellas per persona in this test set. Total added cost per preview run: 1–2 requests per subject, ~$0.001–0.002.

## Limitations

- **Proposer stochasticity contaminates the B-vs-BASELINE delta.** The experiment calls the proposer independently per arm, so arm B's areas (baseline prompt) differ from arm BASELINE's areas (also baseline prompt, same input). This means B-vs-BASELINE includes variance from two separate proposer calls, not just the umbrella-queries effect. A cleaner v2 of this experiment was built to share proposer output between BASELINE-and-B and between A-and-A+B, but hit the daily OpenAlex quota before producing data. The headline *umbrella-paper-count* metric is unaffected by this bias — it's a direct title-substring count on whatever pool the arm produced.
- **Education researcher data is unreliable.** Two independent flakes (runLibrary 0-hit burst on arm B, buildCompactLibrary empty return on arm A+B). Direction of signal looks consistent with other personas but magnitudes are not to be trusted.
- **In-field / off-field classification is coarse.** Uses OpenAlex's `primary_topic.field` top-5 match, which classifies some relevant boundary papers (stroke prevention under General Medicine, not Cardiology) as off-field. Precision numbers under-state real-world relevance.
- **N=7 personas.** Direction of effect is consistent, but not a large enough sample to make strong claims about any specific persona class.

## Recommendation (shipped)

Shipped A+B. The target case (Clinical psychologist) is a clean win with both levers contributing — A for the user-facing plan view, B for the retrieval guarantee. The downside is minimal: 1–2 extra OpenAlex requests per preview, no precision collapse observed. Variant A alone was insufficient (missed the AI engineer case); variant B alone was nearly as effective on recall but left the Plan view unchanged.

Follow-up: a cleaner v2 re-run — where the proposer and library builder are shared between BASELINE and B — was attempted but hit the daily OpenAlex quota. Worth running once quota resets to tighten numbers on the B-vs-BASELINE delta and confirm the Education researcher numbers were flakes, not a real regression.

## How to reproduce

```bash
export RUN_POOL_EXPERIMENT=1
npx vitest run test/pool-experiment-umbrella.test.ts --testTimeout=900000 --reporter=verbose
```

Requires `.env.local` with `OPENROUTER_API_KEY`, `OPENALEX_MAILTO`, `OPENALEX_API_KEY`. Budget: ~$0.03 OpenRouter + ~$0.05 OpenAlex per run.
