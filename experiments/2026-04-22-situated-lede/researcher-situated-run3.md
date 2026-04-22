# openai/gpt-5.4 — researcher-situated-run3

```json
{
  "ok": true,
  "label": "researcher-situated",
  "run": 3,
  "ms": 28014,
  "cost": 0.054464,
  "totalTokens": 16609,
  "inputTokens": 15182,
  "outputTokens": 1427,
  "referenceIds": [
    "W7154716487",
    "W7154458881",
    "W7155019889",
    "W7154971597",
    "W7155008820"
  ],
  "bodyChars": 6766
}
```

## body

## The big picture

Right now the useful question is not whether agents can do more steps. It is **which mechanism actually buys reliable extra depth** without turning the system into an expensive, brittle pile of prompts. This set matters because the strongest papers here stop treating planning, memory, collaboration, and safety as generic “agent capabilities” and instead factor them into concrete objects: reusable planning atoms, delayed memory consolidation, weak-link compensation, and benchmarks that isolate failure sources rather than averaging them away [1][2][3][4][5].

## Where things are converging

Three of these papers are converging on the same bet: **separate expensive cognition from cheap execution**. SGA-MCTS does it by pushing search offline, then retrieving de-lexicalized State-Goal-Action atoms online as soft hints [1]. GAM does it by splitting fast event capture from slower topic-level consolidation, so fresh context does not immediately contaminate durable memory [2]. WORC makes a similar move in multi-agent collaboration: don’t globally scale everyone’s reasoning budget; identify the weak agent and spend extra samples there [3].

The disagreement is about what the reusable unit should be. SGA-MCTS says the right unit is a planning primitive abstracted enough to transfer across contexts [1]. GAM says it is a graph-structured memory state with explicit semantic shift boundaries [2]. CoEvolve pushes one layer earlier and says static data is the real bottleneck: the agent should generate new tasks from its own forgetting and uncertainty traces, then retrain on that evolving distribution [4]. If you are betting on a trend, bet on **amortization with explicit structure**. Be skeptical of anything that claims better agent reasoning from more orchestration alone, without showing what got cached, abstracted, or reweighted.

SocialGrid is the useful counterweight here [5]. It shows how easily “agent intelligence” gets confounded: below 60% on task completion and planning for the best open model, repetitive behaviors, basic navigation failures, and deception detection at near-random chance even when planning help is available [5]. That is a reminder to distrust benchmark wins unless the environment cleanly separates planning, execution, and social inference.

## What to steal

- **Cache search as abstractions, not transcripts.** Build a library of de-lexicalized state-goal-action fragments from successful trajectories, then retrieve and re-ground them at runtime instead of rerunning tree search on every task [1].
- **Delay consolidation until semantic shift.** Keep a short-lived event graph for ongoing interaction, and only merge into long-term topic memory when the conversation actually changes topic. Copy the separation, not necessarily the exact graph design [2].
- **Route extra compute to the weak link.** Score agent roles or submodules on the current task, identify the least reliable one, and allocate repeated sampling there instead of uniformly increasing budget across the whole team [3].
- **Use failure traces to generate the next training set.** Extract uncertainty and forgetting signals from rollouts, synthesize tasks that target those failure patterns, validate them in-environment, then update the training distribution. Do not keep training on a frozen task mix and expect new behavior to stay covered [4].
- **Instrument benchmarks so one failure mode does not hide another.** Add an oracle or controlled scaffold that peels apart navigation, planning, and social reasoning. If your eval cannot tell whether the model failed because it got lost or because it misread another agent, you are not measuring the mechanism you think you are [5].

## The papers

**SGA-MCTS** is the one to read first if you care about planning mechanisms rather than “reasoning” branding. The key move is to run MCTS offline, distill trajectories into de-lexicalized SGA atoms, and treat online planning as hybrid symbolic-semantic retrieval plus re-grounding; that is a much cleaner answer to the latency/generalization tradeoff than either raw search or task-specific fine-tuning. It sits next to GAM because both papers turn expensive sequential reasoning into reusable structure, but SGA-MCTS does it for action choice rather than memory [1].

**GAM** is a strong memory paper because it isolates the interference problem instead of just adding another retrieval layer. By decoupling memory encoding from consolidation, storing active interaction in an event progression graph, and only integrating into a topic associative network on semantic shifts, it proposes an actual mechanism for why long-term consistency should improve under noise. Read it against MemEvo-style concerns even though that paper is not in the final five: GAM is one of the few picks here that directly suggests how to reduce memory drift rather than merely measure it [2].

**WORC** makes a simple but underused claim about multi-agent systems: failures are often bottlenecked by the weakest role, not the average role. Its mechanism is two-stage—zero-shot weak-agent localization via a meta-learned weight predictor trained from swarm-optimized configurations, followed by uncertainty-driven extra sampling for that weak link—and that is more informative than generic “debate” or “more agents helps” stories. Beside SGA-MCTS and GAM, it extends the same amortization instinct from single-agent internals to collaboration budgets [3].

**CoEvolve** is the best learning paper in the pool because it operationalizes adaptation as a closed loop between the agent and its training distribution. Instead of RL on static tasks, it mines rollout traces for forgetting and uncertainty, uses those signals to guide task synthesis, validates synthesized tasks through interaction, and then updates the data distribution; the reported absolute gains—19.43%, 15.58%, and 18.14% across Qwen2.5-7B, Qwen3-4B, and Qwen3-30B-A3B—make the mechanism hard to ignore [4]. This pairs naturally with SGA-MCTS: one amortizes search into reusable planning atoms, the other amortizes failures into better future data.

**SocialGrid** earns its slot because it is unusually careful about disentangling what agents are bad at. The optional Planning Oracle is the important design choice: once basic execution deficits are partially removed, social reasoning is still the bottleneck, with deception detection near random chance and the strongest open model still below 60% on task completion and planning [5]. Use it as a sanity check on claims from planning-heavy agent papers, including the stronger ones above: better search or memory does not automatically buy social inference, and a benchmark that cannot isolate that gap will overstate progress [5].
