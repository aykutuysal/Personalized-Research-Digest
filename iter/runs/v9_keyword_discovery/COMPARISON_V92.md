# v8 vs v9.1 vs v9.2 — abstract-aware comparison

Window: 2026-04-06 → 2026-04-13.  DeepSeek v3.2 on all LLM steps. Single run per profile.
v9.2 differs from v9.1 only in step 1: seeds = LLM seeds ∪ first-2-words-per-angle.

## Headline — useful-paper volume & precision (abstract-aware)

Per-query rows report total scored hits (after top-K trim) labeled YES / YES+PARTIAL, then union YES / YES+PARTIAL (deduped across queries).

| Profile | Variant | Queries | frac_healthy | strict prec | lenient prec | YES / total | YES+P / total | union YES | union YES+P |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| llm_agents | v8 | 14 | 0.64 | 0.51 | 0.671 | 25 / 70 | 47 / 70 | 24 | 40 |
| llm_agents | v9.1 | 12 | 0.58 | 0.53 | 0.7 | 44 / 120 | 84 / 120 | 43 | 74 |
| llm_agents | v9.2 | 12 | 0.25 | 0.56 | 0.7 | 51 / 120 | 84 / 120 | 47 | 76 |
| marketing | v8 | 15 | 0.6 | 0.38 | 0.614 | 10 / 66 | 39 / 66 | 10 | 38 |
| marketing | v9.1 | 13 | 0.77 | 0.25 | 0.369 | 16 / 124 | 42 / 124 | 12 | 30 |
| marketing | v9.2 | 12 | 0.92 | 0.35 | 0.542 | 18 / 120 | 65 / 120 | 18 | 61 |
| afib | v8 | 15 | 0.47 | 0.55 | 0.68 | 32 / 72 | 51 / 72 | 20 | 36 |
| afib | v9.1 | 12 | 0.58 | 0.44 | 0.525 | 42 / 120 | 63 / 120 | 29 | 45 |
| afib | v9.2 | 12 | 0.5 | 0.51 | 0.614 | 47 / 116 | 71 / 116 | 26 | 44 |
| adolescent_depression | v8 | 16 | 0.25 | 0.45 | 0.581 | 19 / 65 | 37 / 65 | 6 | 18 |
| adolescent_depression | v9.1 | 16 | 0.88 | 0.26 | 0.388 | 22 / 160 | 62 / 160 | 14 | 44 |
| adolescent_depression | v9.2 | 16 | 0.88 | 0.31 | 0.438 | 29 / 160 | 70 / 160 | 21 | 49 |

## Aggregate (4 profiles)

| Variant | mean frac_healthy | mean strict prec | mean lenient prec | mean unique papers | mean union YES | mean union YES+P |
|---|---:|---:|---:|---:|---:|---:|
| v8 | 0.49 | 0.473 | 0.637 | 54.25 | 15 | 33 |
| v9.1 | 0.703 | 0.37 | 0.495 | 96 | 24.5 | 48.25 |
| v9.2 | 0.637 | 0.432 | 0.574 | 99 | 28 | 57.5 |

## v9.1 vs v9.2 discovery internals

| Profile | Variant | Seeds (LLM+angle) | Vocab papers | Library | Buckets (zero/low/good/broad) | Reformulated? | Cost | Latency |
|---|---|---|---:|---:|---|:-:|---:|---:|
| llm_agents | v9.1 | 5 | 250 | 12 | 1/2/9/0 | yes | $0.001711 | 204.4s |
| llm_agents | v9.2 | 11 (5+6) | 550 | 12 | 1/0/11/0 | no | $0.002944 | 395.0s |
| marketing | v9.1 | 5 | 177 | 13 | 5/6/2/0 | yes | $0.003825 | 171.5s |
| marketing | v9.2 | 13 (7+6) | 598 | 12 | 0/5/7/0 | yes | $0.00312 | 69.2s |
| afib | v9.1 | 5 | 207 | 12 | 2/4/6/0 | yes | $0.001591 | 133.7s |
| afib | v9.2 | 13 (5+8) | 566 | 12 | 2/3/7/0 | yes | $0.001527 | 226.5s |
| adolescent_depression | v9.1 | 11 | 436 | 16 | 4/10/2/0 | yes | $0.003791 | 406.3s |
| adolescent_depression | v9.2 | 17 (5+12) | 755 | 16 | 4/8/4/0 | yes | $0.002754 | 180.7s |

## Delta table — v9.2 vs v9.1, v9.2 vs v8 (union YES+PARTIAL)

Positive = v9.2 wins.

| Profile | v9.2 − v9.1 | v9.2 − v8 |
|---|---:|---:|
| llm_agents | +2 | +36 |
| marketing | +31 | +23 |
| afib | -1 | +8 |
| adolescent_depression | +5 | +31 |
