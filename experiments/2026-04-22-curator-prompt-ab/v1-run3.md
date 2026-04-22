# openai/gpt-5.4 — v1-run3

```json
{
  "ok": true,
  "label": "v1",
  "run": 3,
  "ms": 20443,
  "cost": 0.055635,
  "totalTokens": 16009,
  "inputTokens": 14760,
  "outputTokens": 1249,
  "referenceIds": [
    "W7154716487",
    "W7154458881",
    "W7154971597",
    "W7154537784",
    "W7155008820"
  ],
  "bodyChars": 6100
}
```

## body

## The big picture

The center of gravity is shifting from “make the model reason harder” to **make the agent system remember, retrieve, and adapt better under real constraints**. The strongest work here treats planning, memory, and learning as infrastructure problems: compress search into reusable atoms, separate volatile context from durable knowledge, generate new training tasks from failure traces, and evaluate agents in environments that look more like production than toy benchmarks [1][2][3][4][5].

## Where things are converging

Three techniques show up repeatedly. First, **amortized reasoning**: instead of paying full search cost at inference time, SGA-MCTS stores de-lexicalized *State-Goal-Action* atoms learned offline with MCTS, then retrieves and re-grounds them as hints online [1]. GAM makes the same move for memory by splitting live interaction into an event progression graph and consolidating only on semantic shifts into a topic graph, which is a cleaner answer to long-context drift than dumping everything into a transcript [2]. CoEvolve does it on the training side: rollout failures become task generators, so the data distribution moves with the agent rather than lagging behind it [3].

The disagreement is about where to place the control loop. SGA-MCTS bets on retrieval over inference-time planning; CoEvolve bets on continual data regeneration; GAM bets on memory architecture; AlphaEval argues that none of these matter much if you still evaluate with curated, fully specified tasks instead of messy work products and evolving human standards [4]. SocialGrid is the useful cold shower: even when you isolate planning with an oracle, agents still fail at deception detection and evidence accumulation, which means better planners alone will not fix social or multi-agent competence [5].

If you are betting on a trend, bet on **structured externalization**: graph memory, reusable planning atoms, failure-driven task synthesis, and production-grounded evals. Be skeptical of claims that raw reasoning scale or bigger base models will wash away coordination, memory contamination, or evaluation mismatch [3][4][5].

## What to steal

- **Cache plans as reusable abstractions, not full trajectories.** SGA-MCTS’s SGA atoms are a good pattern for any agent that repeats task shapes with different entities: store state-goal-action triples with slots, then re-ground at runtime instead of replaying chain-of-thought or rerunning search [1].
- **Split short-term event capture from long-term consolidation.** GAM’s “event graph now, topic graph later” pattern is better than a single memory stream. Only promote memory on semantic shifts, and retrieve with multiple signals instead of naive similarity search [2].
- **Turn failures into synthetic next tasks.** CoEvolve extracts forgetting and uncertainty from rollouts, then synthesizes new environment-validated tasks around those weak spots. If you already log trajectories, you can use the same loop to generate adversarial regression tasks automatically [3].
- **Evaluate the product, not just the model.** AlphaEval’s requirement-to-benchmark pipeline is the practical move: take real requests, hidden constraints, heterogeneous inputs, and expert scoring, then build executable tasks around those. That is much closer to what breaks deployed agents than benchmark-style prompts [4].
- **Separate navigation failure from social failure.** SocialGrid’s planning oracle is a smart design trick for your own evals: factor out one capability bottleneck so you can see whether the agent is actually bad at coordination, belief tracking, or deception handling rather than just pathing badly [5].

## The papers

- **SGA-MCTS** builds a retrieval-based planner by spending compute offline with Monte Carlo Tree Search, distilling successful trajectories into de-lexicalized State-Goal-Action atoms, and using hybrid symbolic-semantic retrieval to re-inject those atoms as soft reasoning hints at runtime [1]. Next to GAM, it is the clearest example of moving expensive cognition out of the hot path; next to CoEvolve, it shows a different route to adaptation that does not require updating model weights.

- **GAM** replaces flat memory with a two-level graph design: an event progression graph for local dialogue flow and a topic associative network for consolidated long-term knowledge, with consolidation triggered by semantic shifts and retrieval guided by graph structure plus other relevance factors [2]. It pairs naturally with SGA-MCTS: one stores reusable action logic, the other stores reusable world knowledge without letting transient noise poison everything.

- **CoEvolve** closes the training loop by mining rollout trajectories for uncertainty and forgetting signals, using those failure patterns to synthesize new tasks, validating them through environment interaction, and then retraining on the updated distribution [3]. Compared with the more static abstractions in SGA-MCTS and GAM, this is the pick that most directly answers how an agent stack keeps improving after deployment rather than after one benchmark run.

- **AlphaEval** matters because it evaluates complete agent products on 94 tasks sourced from real companies, where requirements are implicit, inputs are messy and multimodal, outputs are long-form deliverables, and success is judged through mixed paradigms including judges, rubrics, formal checks, and UI testing [4]. It is the strongest argument in the set that your internal eval harness should be assembled from production artifacts and human review paths, not just standard datasets.

- **SocialGrid** contributes an embodied multi-agent environment with adversarial league play, fine-grained failure analysis, and an optional planning oracle that cleanly separates social reasoning from navigation competence [5]. Its main signal is uncomfortable but useful: even after planning assistance, agents remain weak at deception detection and evidence accumulation, which should temper expectations for any stack that claims multi-agent intelligence from better planners alone.

