# v8 baseline vs v9 keyword-discovery — comparison

Window: 2026-04-06 → 2026-04-13.  All LLM calls use deepseek/deepseek-v3.2.

**Primary precision numbers are abstract-aware** (judge sees title + first 500 chars of abstract). Title-only numbers are kept in the appendix for reference but should not be trusted in isolation.

v8 here is the run1 plan from each profile, re-scored once with the abstract-aware judge — single-run, no variance bars.


## Headline (abstract-aware judge)

| Profile | Variant | Queries | frac_healthy | precision (strict) | precision (lenient) | Unique papers |
|---|---|---:|---:|---:|---:|---:|
| llm_agents | v8 (search) | 14 | 0.64 | 0.51 | 0.671 | 60 |
| llm_agents | v9 / search | 15 | 0.8 | 0.57 | 0.707 | 63 |
| llm_agents | v9 hybrid (Gemini Pro on step 4) | 14 | 0.86 | 0.45 | 0.657 | 60 |
| llm_agents | v9.1 (slot-filled, no serendipity) | 12 | 0.58 | 0.53 | 0.7 | 108 |
| llm_agents | v9 / tiab.search | 15 | 0.33 | 0.51 | 0.639 | 57 |
| marketing | v8 (search) | 15 | 0.6 | 0.38 | 0.614 | 63 |
| marketing | v9 / search | 15 | 0.8 | 0.52 | 0.683 | 72 |
| marketing | v9 hybrid (Gemini Pro on step 4) | 13 | 0.77 | 0.48 | 0.662 | 60 |
| marketing | v9.1 (slot-filled, no serendipity) | 13 | 0.77 | 0.25 | 0.369 | 94 |
| marketing | v9 / tiab.search | 15 | 0.13 | 0.4 | 0.696 | 38 |
| afib | v8 (search) | 15 | 0.47 | 0.55 | 0.68 | 52 |
| afib | v9 / search | 16 | 0.25 | 0.46 | 0.513 | 59 |
| afib | v9 hybrid (Gemini Pro on step 4) | 13 | 0.38 | 0.57 | 0.633 | 49 |
| afib | v9.1 (slot-filled, no serendipity) | 12 | 0.58 | 0.44 | 0.525 | 93 |
| afib | v9 / tiab.search | 16 | 0.0 | 0.38 | 0.467 | 19 |
| adolescent_depression | v8 (search) | 16 | 0.25 | 0.45 | 0.581 | 42 |
| adolescent_depression | v9 / search | 16 | 0.94 | 0.23 | 0.338 | 48 |
| adolescent_depression | v9 hybrid (Gemini Pro on step 4) | 14 | 0.43 | 0.38 | 0.578 | 40 |
| adolescent_depression | v9.1 (slot-filled, no serendipity) | 16 | 0.88 | 0.26 | 0.388 | 89 |
| adolescent_depression | v9 / tiab.search | 16 | 0.0 | 0.37 | 0.585 | 19 |

## Aggregate (4 profiles, abstract-aware)

| Variant | mean frac_healthy | mean precision (strict) | mean precision (lenient YES+PARTIAL) | mean unique papers |
|---|---:|---:|---:|---:|
| v8 (search) | 0.49 | 0.473 | 0.637 | 54.25 |
| v9 / search | 0.698 | 0.445 | 0.56 | 60.5 |
| v9 hybrid (Gemini Pro on step 4) | 0.61 | 0.47 | 0.633 | 52.25 |
| v9.1 (slot-filled, no serendipity) | 0.703 | 0.37 | 0.495 | 96 |
| v9 / tiab.search | 0.115 | 0.415 | 0.597 | 33.25 |

## Cost & latency

| Profile | v8 (avg 2-3 runs) | v9 / search (DeepSeek) | v9 hybrid (Gemini Pro on step 4) |
|---|---:|---:|---:|
| llm_agents | $0.002 | $0.000984 (85.9s) | $0.051579 (222.2s) |
| marketing | $0.002 | $0.001538 (96.0s) | $0.038953 (150.1s) |
| afib | $0.002 | $0.001614 (249.6s) | $0.047444 (263.3s) |
| adolescent_depression | $0.002 | $0.001459 (221.4s) | $0.04522 (106.3s) |

## Band distribution (queries per band, abstract-aware)

| Profile | Variant | zero | low | healthy | recall_safety | too_broad |
|---|---|---:|---:|---:|---:|---:|
| llm_agents | v8 (search) | 0 | 0 | 9 | 3 | 2 |
| llm_agents | v9 / search | 0 | 0 | 12 | 3 | 0 |
| llm_agents | v9 hybrid | 0 | 0 | 12 | 2 | 0 |
| llm_agents | v9 / tiab.search | 1 | 9 | 5 | 0 | 0 |
| marketing | v8 (search) | 1 | 5 | 9 | 0 | 0 |
| marketing | v9 / search | 0 | 1 | 12 | 2 | 0 |
| marketing | v9 hybrid | 0 | 1 | 10 | 2 | 0 |
| marketing | v9 / tiab.search | 3 | 10 | 2 | 0 | 0 |
| afib | v8 (search) | 0 | 8 | 7 | 0 | 0 |
| afib | v9 / search | 0 | 11 | 4 | 1 | 0 |
| afib | v9 hybrid | 0 | 7 | 5 | 0 | 0 |
| afib | v9 / tiab.search | 6 | 10 | 0 | 0 | 0 |
| adolescent_depression | v8 (search) | 2 | 9 | 4 | 1 | 0 |
| adolescent_depression | v9 / search | 0 | 1 | 15 | 0 | 0 |
| adolescent_depression | v9 hybrid | 0 | 2 | 6 | 1 | 0 |
| adolescent_depression | v9 / tiab.search | 6 | 10 | 0 | 0 | 0 |

## v9 discovery internals

| Profile | Variant | Seeds | Vocab papers | Library queries | Validation (zero/low/good/broad+too) | Reformulated? |
|---|---|---:|---:|---:|---|:-:|
| llm_agents | v9 (DeepSeek) | 5 | 250 | 15 | 1/3/11/0 | no |
| llm_agents | v9 hybrid (Gemini Pro) | 5 | 250 | 14 | 0/6/8/0 | yes |
| marketing | v9 (DeepSeek) | 7 | 191 | 15 | 3/6/6/0 | yes |
| marketing | v9 hybrid (Gemini Pro) | 5 | 123 | 13 | 3/4/6/0 | yes |
| afib | v9 (DeepSeek) | 5 | 207 | 16 | 6/9/1/0 | yes |
| afib | v9 hybrid (Gemini Pro) | 5 | 207 | 13 | 4/7/2/0 | yes |
| adolescent_depression | v9 (DeepSeek) | 5 | 180 | 16 | 6/7/3/0 | yes |
| adolescent_depression | v9 hybrid (Gemini Pro) | 5 | 160 | 14 | 4/4/6/0 | yes |

---

## Appendix: title-only judge (legacy)

Original numbers, with judge seeing only the title. **Lower confidence** — titles are vague, especially for clinical work — but useful for tracking the size of the scoring-method effect.


| Profile | Variant | frac_healthy | mean_precision (title-only) | mean_precision (abstract) | Δ |
|---|---|---:|---:|---:|---:|
| llm_agents | v8 (avg of 3) | 0.743 | 0.737 | 0.51 | -0.227 |
| llm_agents | v9 / search | 0.8 | 0.59 | 0.57 | -0.02 |
| llm_agents | v9 / tiab.search | 0.33 | 0.65 | 0.51 | -0.14 |
| marketing | v8 (avg of 3) | 0.49 | 0.477 | 0.38 | -0.097 |
| marketing | v9 / search | 0.8 | 0.41 | 0.52 | +0.11 |
| marketing | v9 / tiab.search | 0.13 | 0.47 | 0.4 | -0.07 |
| afib | v8 (avg of 2) | 0.235 | 0.575 | 0.55 | -0.025 |
| afib | v9 / search | 0.25 | 0.41 | 0.46 | +0.05 |
| afib | v9 / tiab.search | 0.0 | 0.33 | 0.38 | +0.05 |
| adolescent_depression | v8 (avg of 2) | 0.3 | 0.585 | 0.45 | -0.135 |
| adolescent_depression | v9 / search | 0.94 | 0.5 | 0.23 | -0.27 |
| adolescent_depression | v9 / tiab.search | 0.0 | 0.68 | 0.37 | -0.31 |

## Notes

- `frac_healthy` is deterministic (OpenAlex result counts); it doesn't change between scoring methods.
- `unique_papers` counts distinct OpenAlex IDs across the top-5 hits returned per query (after dedup). Union of small samples, not the full match set.
- Abstract-aware judge: title (≤300 chars) + first 500 chars of abstract. Single DeepSeek call per profile, temperature 0.
- v8 plan cost is per single LLM call. v9 cost includes seed + library + reformulate (when triggered) but excludes per-query OpenAlex calls (free) and the scoring DeepSeek call (incurred by both).
