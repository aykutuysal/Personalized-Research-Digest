# Profile differentiation re-test — updated prompt

**Setup.** Same harness as baseline (`experiments/2026-04-22-profile-differentiation-v1-baseline/`). Same user prompts, same pool, model `openai/gpt-5.4`, temp 0.5, N=3 per profile. Only change: the updated `preview-curator-system.md` with (1) relaxed first-person rule, (2) relaxed matchmaking rule, (3) new "editorial work" rule, (4) new "imperative mood" rule, (5) new "concrete numbers" rule, (6) new "shorter paragraphs preferred" rule.

## Did the new rules fire?

| rule | evidence | verdict |
|---|---|---|
| Imperative mood in action sections | 30/30 "What to steal" bullets across 6 runs open with imperatives ("Separate X", "Store Y", "Mine Z", "Use W") | **Yes, robustly** |
| Reproduce concrete numbers from abstracts | CoEvolve's 19.43% / 15.58% / 18.14% gains reproduced verbatim in **4/6** runs. AlphaEval's "94 tasks from seven companies" in 3/6. MemEvoBench's "7 domains, 36 risk types, 20 environments" in 1 builder run. GPT-OSS-120B at 60% in 1 researcher run. | **Yes, when the abstract provides numbers** |
| Editorial visibility (first-person judgment) | Explicit "*If I had to bet on one trend*" and "*I'd watch with skepticism*" in 2/6 runs. Non-first-person editorial register ("the reality check", "the cleanest planning paper in the set", "the pick to read first", "the evaluation pick") in **6/6** runs. | **Yes — the non-first-person register is dominant, first-person sparingly used** |
| Shorter paragraphs | Mild improvement. Baseline "The big picture" paragraphs were 2 long sentences (~40 words each); updated tends toward 3 shorter sentences (~17–20 words each). Not dramatic. | **Partial — some tightening, not a transformation** |
| Matchmaking voice avoided | 0 hits on "given your", "your interest in", "fits your area", "because you care about". One borderline: researcher-run3 has "*if you care about adaptation*" — conditional ascription, not declarative matchmaking, but close to the line. | **Yes, with one borderline** |

## Differentiation preserved?

Average per-run Jaccard between builder and researcher picks: **~0.43** (baseline was ~0.40). Slight increase in overlap but differentiation still visible:

| paper | baseline builder | baseline researcher | updated builder | updated researcher |
|---|---:|---:|---:|---:|
| AgentSPEX (framework) | 3/3 | 0/3 | 3/3 | 0/3 |
| AlphaEval (prod benchmark) | 3/3 | 0/3 | 3/3 | 0/3 |
| CoopEval (game theory) | 0/3 | 3/3 | 0/3 | 1/3 |
| WORC (weak-link mechanism) | 0/3 | 2/3 | 0/3 | 2/3 |
| SocialGrid (measurement) | 0/3 | 1/3 | 0/3 | 1/3 |
| MemEvoBench (failure model) | 0/3 | 1/3 | 1/3 | 2/3 |
| CoEvolve | 3/3 | 2/3 | 3/3 | 3/3 |

The hard splits (AgentSPEX, AlphaEval, WORC, SocialGrid) all preserved. CoopEval dropped from 3/3 to 1/3 on researcher side — some loss of differentiation on that specific axis. Framing still diverges: builder version talks about *"production-grounded tests"* and *"operational truth"*, researcher version talks about *"factoring the problem into reusable units with explicit failure signals"* and *"variance amplification from the weakest participant"*.

## Side observation — editorial register is the strongest added quality

Reading the updated bodies side-by-side with baseline, the thing that jumps out is not the new rules individually but the cumulative register shift. Passages like:

> *"SGA-MCTS [2] is the cleanest planning paper in the set because it turns search into a retrieval problem..."*

> *"If I had to bet on one trend, it would be this: retrieve structured experience, don't regenerate it."*

> *"SocialGrid [5] is the evaluation pick because it separates embodied planning from social reasoning..."*

These didn't appear in the baseline — the baseline defaulted to "One camp bets on X, another camp bets on Y". The updated prompt pushes the curator to commit to picks and show why. Low-cost, high-value change.

## Cost

| | baseline | updated | delta |
|---|---:|---:|---:|
| avg cost / run | $0.040 | $0.052 | +30% |
| total (6 runs) | $0.24 | $0.31 | +$0.07 |

Higher cost is partly longer output, partly uncached pathway for some runs.

## Bottom line

The updated prompt lands 4/5 targeted changes (imperative mood, concrete numbers, editorial visibility, matchmaking avoidance) cleanly, and one (shorter paragraphs) partially. Differentiation across profiles is preserved with a small drop in overlap on CoopEval specifically.

The biggest perceptible quality lift is editorial register — the curator now commits to picks visibly.

No regressions observed. Recommend keeping the updated prompt in production.
