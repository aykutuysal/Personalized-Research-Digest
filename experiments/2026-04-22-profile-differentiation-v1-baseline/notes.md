# Profile differentiation — notes

**Setup.** Same pool (40 AI-agents papers), same subject, same areas, same template, same system prompt (current production `preview-curator-system.md`, no personalization rules added). Only the profile line changes between runs. Model: `openai/gpt-5.4`, temp 0.5, N=3 per profile.

- **Builder profile:** "Builder of various AI agents... Avoids pure theory... Interested in frameworks and tools."
- **Researcher profile:** "AI-agents researcher who cares about mechanisms and why things work... Avoids framework papers, tool-integration write-ups... Prefers papers that isolate a single mechanism."

## Picks per run

| profile | run | picks |
|---|---:|---|
| builder | 1 | SGA-MCTS, GAM, CoEvolve, AlphaEval, AgentSPEX |
| builder | 2 | SGA-MCTS, GAM, CoEvolve, AgentSPEX, AlphaEval |
| builder | 3 | SGA-MCTS, GAM, CoEvolve, AlphaEval, AgentSPEX |
| researcher | 1 | GAM, SGA-MCTS, WORC, SocialGrid, CoopEval |
| researcher | 2 | SGA-MCTS, GAM, CoEvolve, CoopEval, WORC |
| researcher | 3 | SGA-MCTS, CoEvolve, GAM, MemEvoBench, CoopEval |

## Per-paper profile split

| paper | builder | researcher |
|---|---:|---:|
| SGA-MCTS (planning atoms) | 3/3 | 3/3 |
| GAM (graph memory) | 3/3 | 3/3 |
| CoEvolve (agent-data co-training) | 3/3 | 2/3 |
| AlphaEval (production benchmark) | **3/3** | **0/3** |
| AgentSPEX (workflow *language*) | **3/3** | **0/3** |
| CoopEval (game-theoretic cooperation) | 0/3 | **3/3** |
| WORC (weak-link optimization mechanism) | 0/3 | **2/3** |
| SocialGrid (factoring social vs. planning) | 0/3 | 1/3 |
| MemEvoBench (memory failure modes) | 0/3 | 1/3 |

**The baseline curator is doing substantial profile-specific selection.** AgentSPEX and AlphaEval are consistently picked for builder and consistently skipped for researcher — exactly what "avoids framework papers" should produce. CoopEval, WORC, and SocialGrid are picked for researcher and consistently skipped for builder — exactly what "prefers mechanism papers" should produce. SGA-MCTS and GAM survive both profiles because they have strong mechanisms AND practical applicability.

Per-run pick overlap between profiles averages ~40% (Jaccard). The overlap is the core "mechanism-plus-practical" papers; the other ~60% of each profile's picks is genuinely reader-specific.

## Body framing also diverges

**Builder lede / what-to-steal register:**
- *"the field is treating agent quality less as a prompting problem and more as a systems problem — what to cache, what to retrieve, what to formalize"*
- Steal items: "Evaluate the whole product, not just the model", "Move orchestration out of ad hoc code"

**Researcher lede / what-to-steal register:**
- *"the common move is a shift away from treating agent ability as 'more chain-of-thought, more tools' and toward explicitly structuring the failure surface"*
- Steal items: "Debug multi-agent systems by finding the weakest agent first", "Separate capability axes in your evals", "Use incentive scaffolds, not just better prompts, for cooperation"

The researcher version is more analytical (mechanism design, measurement factoring, causality). The builder version is more operational (caching, evaluating, shipping). Different framings for the same pool.

## Verdict

My speculation from the previous conversation was wrong: the baseline curator is not templatized. **Without any personalization rules added, it already produces substantially different issues for different readers** — different papers emphasized, different framings, different take-aways. The profile is doing real work as an input, just through selection and emphasis rather than through surface-level "you" pronouns or hook lines.

Implications:

1. **The feels-templated concern is structural, not substantive.** The repetitive "If only one thing sticks" closings and `## The big picture` / `## Where things are converging` openings come from the *template* (the user's output_style) and from *structural rules I added*, not from the curator ignoring the profile. Remove the rules and the structural templatization I was introducing goes away.

2. **The pre-distill step is still the biggest lever for more personalization.** The researcher profile is already fuller than the builder one ("cares about mechanisms", "avoids framework papers", "prefers papers that isolate a single mechanism") — and that fuller profile produced more distinct picks. A brief-distiller that surfaces latent decisions and vocabulary would plausibly push the same dynamic further.

3. **My v2 personalization rules (lede, implication, hook) were solving a problem the base prompt doesn't have** — and were adding templated surface structure that makes pieces feel *less* individual. The correct next move is not "which version of v2", it's "do we actually need v2 at all".

## Recommendation

- **Don't land v2 / v2c / v2d.** The base curator already personalizes substantively. The rules I proposed trade substantive personalization (which the base does well) for structural predictability (hook in a fixed shape, lede in a fixed shape). That's a regression on the user's stated goal.
- **Keep the redundancy and duplication cleanups from v2** — merging the "you"/"reader-located" bullets, removing the duplicated citation rule. These are hygiene, not behavior changes.
- **Invest in pre-distill upstream.** The ceiling isn't the curator, it's the profile quality reaching it.
- **Add a differentiation guard to future curator evals.** When iterating on the curator, always run at least two profiles on the same pool and check that picks and framing diverge. If a prompt change reduces differentiation, roll it back.
