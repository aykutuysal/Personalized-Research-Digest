# openai/gpt-5.4 — v2c-run2

```json
{
  "ok": true,
  "label": "v2c",
  "run": 2,
  "ms": 23033,
  "cost": 0.057415,
  "totalTokens": 16416,
  "inputTokens": 15106,
  "outputTokens": 1310,
  "referenceIds": [
    "W7154716487",
    "W7154458881",
    "W7154971597",
    "W7154537784",
    "W7155011363"
  ],
  "bodyChars": 6268
}
```

## body

## The big picture

The center of gravity is shifting from “make the agent reason harder” to **make the agent externalize structure**: explicit memory layouts, reusable planning atoms, typed workflow definitions, production-grounded evals, and closed-loop data generation. Across these picks, the common move is to stop treating agent behavior as one long prompt and instead break it into artifacts you can inspect, retrieve, benchmark, and improve [1][2][3][4][5].

## Where things are converging

The strongest convergence is on **amortization**. *SGA-MCTS* turns expensive search into reusable State-Goal-Action atoms that can be retrieved at runtime instead of recomputed [1]. *GAM* does the same for long-horizon context by splitting fast-changing event traces from slower topic-level consolidation, then retrieving with graph guidance rather than flat memory recall [2]. *CoEvolve* applies the pattern to training: use rollout failures like uncertainty and forgetting to synthesize the next batch of tasks, instead of waiting for a static benchmark to tell you where the agent is weak [3].

The disagreement is about where the bottleneck really is. One camp says planning is the issue, so cache better reasoning primitives and retrieve them fast [1]. Another says the real failure mode is memory contamination and drift over time, which won’t be fixed by clever prompts or static retrieval alone [2][5]. A third says neither matters if your eval is still toy-grade; production agents fail because requirements are implicit, multimodal, and judged by moving human standards [4].

If there’s one trend to bet on, it’s **structured intermediate representations that survive across runs**: graphs, planning atoms, requirement-to-benchmark pipelines, and failure-derived task synthesis. The trend to watch skeptically is anything that claims reliability from prompt-only control; the memory-safety results here argue that long-horizon drift punches through static defenses pretty quickly [5].

## What to steal

- **Cache search as reusable planning units, not full trajectories.** Distill successful runs into de-lexicalized state-goal-action triples, then retrieve and re-ground them as hints during execution. This is a practical way to get some of the upside of MCTS without paying search latency on every request [1].
- **Split short-term interaction memory from consolidated knowledge.** Keep a high-churn event log separate from a slower-updating semantic/topic graph, and only consolidate on meaningful shifts. That reduces interference from transient noise and gives retrieval a cleaner target [2].
- **Turn rollout failures into synthetic training demand.** Log uncertainty spikes, repeated mistakes, and forgetting events, then generate new tasks specifically around those failure patterns. That gives you a lightweight self-play/data-engineering loop for agents using tools or operating in environments [3].
- **Build evals from real requirements, not benchmark templates.** Start with the artifacts your team already has—tickets, SOPs, acceptance criteria, UI tests, expert rubrics—and convert them into executable tasks with mixed scoring methods. That catches product-level failures model benchmarks miss [4].
- **Test memory as an attack surface, not just a feature.** Add adversarial memory injection, biased feedback, and noisy tool returns to your harness. If the agent’s memory persists across sessions, you need regression tests for drift, not just one-shot jailbreak tests [5].

If only one thing sticks: **the durable edge now comes from what your agent can remember, retrieve, and re-use outside the prompt window** [1][2][3][5].

## The papers

**SGA-MCTS** builds an offline-to-online planning pipeline: use Monte Carlo Tree Search offline to explore solution space, compress good trajectories into de-lexicalized State-Goal-Action atoms, then retrieve those atoms online with hybrid symbolic-semantic matching and re-ground them into the current task [1]. Next to *GAM*, it makes the same architectural bet from the planning side rather than the memory side: explicit structure beats raw token history when you need depth without runtime bloat [2].

**GAM** proposes a hierarchical graph memory with two distinct stores: an event progression graph for ongoing dialogue and a topic associative network for consolidated knowledge, with updates gated by semantic shifts rather than every turn [2]. The useful mechanism here is the decoupling of encoding from consolidation, plus graph-guided retrieval with multiple relevance factors; read alongside *MemEvoBench*, it also hints at a cleaner place to insert memory validation before bad context gets promoted into long-term state [5].

**CoEvolve** replaces static agent training data with a closed loop where rollout traces are mined for failure signals—especially uncertainty and forgetting—and those signals drive LLM-based task synthesis for the next training round [3]. That’s the most directly stealable learning pattern in the set: paired with *AlphaEval*, it suggests a cycle where production failures become benchmark tasks and then become training data, instead of living in three disconnected systems [4].

**AlphaEval** is valuable because it evaluates complete agent products on 94 tasks drawn from seven companies, not isolated model capabilities on cleanly specified prompts [4]. The mechanism that matters is the requirement-to-benchmark construction pipeline plus multi-paradigm scoring—LLM judges, formal verification, rubrics, UI testing—so you can actually reproduce production pressure in an internal harness; it complements *CoEvolve* by giving a realistic source of failure distributions worth training against [3].

**MemEvoBench** targets a failure mode a lot of stacks still barely test: persistent memory gradually drifting under adversarial injection, biased feedback, and noisy tool outputs across multi-round interactions [5]. The key result is not just that performance degrades, but that static prompt defenses are insufficient; alongside *GAM*, it argues for memory architectures with explicit consolidation boundaries, and alongside *AlphaEval*, it argues that long-horizon memory corruption should be part of routine eval, not a security afterthought [2][4].
