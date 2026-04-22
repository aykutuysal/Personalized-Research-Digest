# openai/gpt-5.4 — v2b-run3

```json
{
  "ok": true,
  "label": "v2b",
  "run": 3,
  "ms": 23744,
  "cost": 0.0566375,
  "totalTokens": 16260,
  "inputTokens": 14981,
  "outputTokens": 1279,
  "referenceIds": [
    "W7154716487",
    "W7154458881",
    "W7154537784",
    "W7154789938",
    "W7154971597"
  ],
  "bodyChars": 6149
}
```

## body

## The big picture

The center of gravity is moving from “make the model reason harder” to **make the agent stack more structured, inspectable, and reusable**. The strongest papers here all push in that direction from different angles: planning becomes retrieval over distilled experience instead of fresh search every time [1], memory becomes an explicit graph with consolidation rules instead of a chat log [2], evaluation shifts toward production messiness instead of toy tasks [3], and workflow logic gets pulled out of Python glue into a typed execution layer [4].

## Where things are converging

A clear convergence is forming around *offline work to buy online reliability*. SGA-MCTS [1] does the heavy search upfront, compressing good trajectories into de-lexicalized State-Goal-Action atoms that can be retrieved as planning hints at runtime. CoEvolve [5] applies the same instinct to training: mine rollout failures, synthesize new tasks around those failure modes, then update the data distribution instead of hoping a static benchmark covers the edge cases. GAM [2] makes a parallel move for memory by separating event capture from consolidation into a topic graph, which is a much more usable pattern than dumping every turn into a single store and praying retrieval sorts it out.

Where they disagree is on *how much structure to impose*. AgentSPEX [4] bets on explicit typed control flow, branching, checkpointing, and state as first-class authoring primitives. AlphaEval [3] is effectively a warning that this extra structure only matters if you can test agents against real production requirements, hidden constraints, and expert judgment. The trend to bet on is **distilled structure with runtime flexibility**: retrieval-augmented planning [1], graph memory [2], and closed-loop data generation [5]. The trend to watch skeptically is any framework story that improves ergonomics without proving better failure visibility or benchmark performance in messy environments [3][4].

## What to steal

- **Turn search into a cache, not a tax.** If your agent solves recurring task families, store successful trajectories as abstract state-goal-action templates rather than full transcripts. At runtime, retrieve the nearest template and inject it as a soft planning hint before tool calls [1].
- **Split memory into write-fast and consolidate-later layers.** Keep a volatile event log for local interaction state, but only promote information into a stable associative structure when a semantic shift or repeated confirmation happens. That is the core anti-noise trick in GAM [2].
- **Mine your own failures to generate the next eval set.** CoEvolve’s practical pattern is simple: detect uncertainty, forgetting, or repeated dead-ends in rollouts, synthesize nearby tasks that stress the same weakness, then validate them in-environment before adding them to training or regression suites [5].
- **Define agent workflows in a typed graph, not just prompt text.** Explicit steps, loops, parallel branches, and state slots make it much easier to checkpoint, replay, and patch a failing path than debugging one giant orchestration prompt [4].
- **Test the product, not just the model.** AlphaEval’s takeaway is that the unit under evaluation should be the full agent system with its tools, UI behavior, and deliverable quality, using mixed judges and task-specific validators rather than a single scalar metric [3].

**The hook:** if an agent in your stack still relies on transcript memory, prompt-only planning, and model-level evals, the next meaningful upgrade is not a bigger model — it is a more explicit runtime substrate [1][2][3][4].

## The papers

- **SGA-MCTS** builds a planning system that does expensive Monte Carlo Tree Search offline, then distills discovered trajectories into reusable State-Goal-Action atoms that are symbolic enough to transfer but concrete enough to re-ground online [1]. The useful move is decoupling search from execution: unlike fresh inference-time tree search, you pay the planning cost once and then serve it as retrieval, which pairs naturally with AgentSPEX-style explicit workflow nodes [4].

- **GAM** replaces flat memory streams with a two-level graph: an event progression graph for recent interaction flow and a topic associative network for consolidated long-term knowledge [2]. The mechanism that matters is the consolidation gate on semantic shifts plus graph-guided retrieval, which makes it a practical complement to planning systems like SGA-MCTS [1] because both reduce runtime confusion by turning raw traces into structured artifacts.

- **AlphaEval** is one of the stronger signs that agent evaluation is finally being dragged into production reality: implicit constraints, multimodal inputs, long-horizon deliverables, and expert scoring that changes over time [3]. The key contribution is not just 94 tasks from real companies; it is the requirement-to-benchmark pipeline and mixed evaluation paradigms, which makes it a better north star for regression testing frameworks and workflow systems than another synthetic benchmark would be [4].

- **AgentSPEX** proposes an actual specification language for agents, with typed steps, loops, branches, parallelism, explicit state, checkpointing, verification hooks, and a visual editor [4]. For builders tired of orchestration logic dissolving into Python callbacks and prompt spaghetti, the real contribution is the separation of workflow definition from host code while still keeping enough execution machinery to inspect and replay failures — exactly the kind of substrate AlphaEval implies teams will need [3].

- **CoEvolve** closes the loop between agent behavior and training data by harvesting rollout signals like uncertainty and forgetting, synthesizing new tasks around those weak spots, validating them through environment interaction, and retraining on the shifted distribution [5]. Next to SGA-MCTS [1], it offers the complementary answer to the same scaling problem: one paper amortizes *reasoning* through retrieved experience, the other amortizes *improvement* through targeted environment-backed data generation.
