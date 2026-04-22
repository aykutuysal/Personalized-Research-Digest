# openai/gpt-5.4 — researcher-run3

```json
{
  "ok": true,
  "label": "researcher",
  "run": 3,
  "ms": 21614,
  "cost": 0.0393295,
  "totalTokens": 16404,
  "inputTokens": 15133,
  "outputTokens": 1271,
  "referenceIds": [
    "W7154458881",
    "W7154716487",
    "W7154971597",
    "W7154738737",
    "W7155011363"
  ],
  "bodyChars": 6044
}
```

## body

## The big picture

The common move here is **turning fuzzy agent behavior into explicit structure**: structured memory instead of flat logs, retrieved planning atoms instead of fresh chain-of-thought every time, mechanisms for sustaining cooperation instead of hoping capability generalizes, and evaluations that isolate where agents actually break. The field is moving away from “make the model smarter” and toward “factor the problem so the failure mode has somewhere concrete to live” [1][2][3][4][5].

## Where things are converging

The strongest convergence is on **decoupling**. GAM splits online encoding from slower consolidation with an event graph plus a topic-associative network [1]. SGA-MCTS splits expensive search from deployment by distilling MCTS rollouts into reusable State-Goal-Action atoms [2]. CoEvolve splits learning from a fixed dataset by letting failure signals rewrite the training distribution itself [3]. Even the benchmarks are doing the same thing: SocialGrid adds a Planning Oracle to separate social reasoning from navigation failure [4], while MemEvoBench separates memory corruption from one-shot prompting and shows static prompt defenses are not enough [5].

Where they disagree is what the real bottleneck is. The retrieval-and-memory papers bet that the main problem is *representation*: preserve the right abstractions and the agent will act better [1][2]. The training paper bets it is *coverage*: the agent fails because the data distribution never follows it into its own blind spots [3]. The benchmark papers are more pessimistic. SocialGrid shows that even with planning help, deception detection stays near random chance [4]. MemEvoBench shows long-horizon drift from biased memory updates can swamp whatever your base policy was doing [5].

If you want one trend to bet on, bet on **offline compression of experience into reusable units** — graphs, atoms, or synthesized tasks — because that is the only pattern here that attacks latency, generalization, and long-horizon consistency at once [1][2][3]. The trend to watch skeptically: “just add more reasoning.” CoopEval is the warning shot there; stronger reasoning does not reliably buy cooperation, and single-shot social dilemmas still push capable models toward defection unless you add external mechanism design like contracts or mediation [4].

## What to steal

- **Split memory write-paths.** Keep a fast event log for fresh interaction state, and only consolidate into durable semantic memory on detected topic shifts. That is the practical pattern from GAM: stop letting transient noise write directly into long-term memory [1].
- **Retrieve abstractions, not transcripts.** Distill successful trajectories into de-lexicalized State-Goal-Action units, then re-ground them at inference time. Copy SGA-MCTS’s basic trick if you want search-like planning without paying search latency on every step [2].
- **Train on your agent’s own failure frontier.** Extract uncertainty and forgetting signals from rollouts, synthesize tasks targeting those patterns, validate them in-environment, then refresh the training mix. CoEvolve reports absolute gains of 19.43%, 15.58%, and 18.14% on three model settings by doing exactly this [3].
- **Add mechanism before you add alignment prose.** In mixed-motive settings, use contracts or mediator-style delegation rather than longer instructions about being cooperative. CoopEval finds contracting and mediation beat repetition, and repetition breaks badly when counterparties vary [4].
- **Red-team memory, not just prompts.** Run long-horizon tests with mixed benign and misleading memory pools, noisy tool returns, and biased feedback. MemEvoBench’s whole point is that prompt-only defenses miss the failure mode because the corruption accumulates over rounds [5].

## The papers

- **GAM** builds memory as two linked graph structures: an event progression graph for ongoing interaction and a topic associative network for consolidated knowledge [1]. The useful mechanism is the consolidation trigger on semantic shifts, which makes memory writes selective instead of continuous; next to MemEvoBench, it reads like a direct answer to interference and drift rather than a generic “better memory” claim [5].

- **SGA-MCTS** takes an unusually clean stance on planning: do the expensive Monte Carlo Tree Search offline, compress the resulting trajectories into reusable State-Goal-Action atoms, and treat online planning as retrieval plus re-grounding [2]. It sits nicely beside GAM because both papers are really about choosing the right unit of reuse; GAM reuses graph-structured experience, while SGA-MCTS reuses causal action templates.

- **CoEvolve** is the pick to read first if you care about adaptation. The mechanism is not merely synthetic data generation; it is a closed loop where forgetting and uncertainty from actual trajectories determine which tasks get synthesized next, then environment validation filters them before they enter training [3]. Compared with SGA-MCTS, this is less about compressing solved behavior and more about expanding coverage where the current policy is brittle.

- **CoopEval** is the surprise in the set because it reframes multi-agent reliability as mechanism design, not prompt design [4]. The result to remember is that stronger models still defect in single-shot dilemmas, while contracts and mediation sustain cooperation much more effectively; that puts a hard limit on the common assumption that better reasoning alone yields better collaboration.

- **MemEvoBench** matters because it nails a failure mode people hand-wave past: long-horizon behavior drift caused by contaminated memory updates [5]. The benchmark spans 7 domains and 36 risk types, plus workflow tasks adapted from 20 Agent-SafetyBench environments, and its main contribution is methodological: if your memory system cannot survive adversarial injection, noisy tools, and biased feedback over multiple rounds, your “agent reliability” story is probably measuring the wrong thing.

