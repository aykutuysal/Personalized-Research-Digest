# openai/gpt-5.4 — v2c-run3

```json
{
  "ok": true,
  "label": "v2c",
  "run": 3,
  "ms": 27532,
  "cost": 0.054958,
  "totalTokens": 16521,
  "inputTokens": 15106,
  "outputTokens": 1415,
  "referenceIds": [
    "W7154716487",
    "W7154971597",
    "W7154458881",
    "W7155011363",
    "W7154789938"
  ],
  "bodyChars": 6812
}
```

## body

## The big picture

The move across these picks is away from “just give the model more context and more tools” and toward **explicit control surfaces for agent behavior**: structured memory instead of raw transcripts, retrieved planning atoms instead of fresh search every time, production-grounded evaluation instead of toy tasks, and workflow languages that make state and branching visible [1][2][3][4][5]. The field is still chasing generality, but the better systems are getting there by turning hidden agent internals into artifacts you can inspect, cache, test, and swap.

## Where things are converging

Two technique lines look especially real.

First: planning is getting *amortized*. SGA-MCTS does the expensive part offline, distilling MCTS rollouts into de-lexicalized State-Goal-Action atoms, then using hybrid symbolic-semantic retrieval online to re-ground those atoms as reasoning hints [1]. That is a cleaner bet than keeping full inference-time tree search in the hot path. CoEvolve pushes the same idea from the training side: instead of treating rollout failures as dead ends, it mines forgetting and uncertainty signals to synthesize new tasks and shift the data distribution toward the agent’s actual blind spots [2]. The shared thesis is that agent quality improves when trajectories become reusable assets.

Second: memory is moving from append-only logs to *selective consolidation*. GAM separates an event progression graph from a topic associative network, only folding events into longer-term memory when semantic shifts justify it [3]. That is exactly the opposite of “stuff everything into vector memory and hope retrieval sorts it out.” MemEvoBench is the warning shot here: once bad tool outputs, adversarial injections, or biased feedback get written into persistent memory, static prompt defenses do little to stop long-horizon drift [4].

The disagreement is mostly about where to put structure. AgentSPEX says put it in the workflow definition itself—typed steps, loops, branching, explicit state, checkpointing, verification [5]. GAM and SGA-MCTS put more of that structure into runtime assets—memory graphs and retrieved planning atoms [1][3]. The safe bet is to use both: explicit orchestration for control flow, retrieved artifacts for adaptability. The thing to watch skeptically is any stack that claims long-horizon reliability while keeping memory writes, planning state, and evaluation criteria implicit.

If only one thing sticks: **treat plans, memories, and eval cases as first-class build artifacts, not side effects of prompting** [1][2][3][4][5].

## What to steal

- **Replace transcript memory with a two-tier store.** Keep a short-lived event graph for current interaction state, and only promote nodes into a topic-level memory index when the conversation or task actually shifts domains. GAM’s retrieval gains come from this decoupling, not from bigger memory volume [3].
- **Precompute reusable planning fragments.** Run search or expensive exploration offline, distill successful trajectories into abstract state-goal-action templates, and retrieve them at runtime as soft hints. That gives you more planning depth without shipping latency spikes into production [1].
- **Turn failures into data generation triggers.** Instrument rollouts for uncertainty, repeated mistakes, and forgotten constraints; then synthesize new tasks around those failure patterns instead of hand-curating eval additions. CoEvolve’s loop is practical because data distribution updates are driven by actual agent behavior [2].
- **Add memory corruption tests to eval before shipping persistence.** Mix benign and misleading memory entries, noisy tool outputs, and biased feedback across long sessions; then measure behavioral drift, not just single-turn accuracy. MemEvoBench is a good template for testing whether your memory layer quietly poisons downstream decisions [4].
- **Pull control flow out of Python glue.** If your agent graph currently lives across prompt strings, callback code, and framework conventions, a typed workflow layer with explicit branching, state, and checkpointing makes debugging much easier. AgentSPEX is useful less as a language bet than as a reminder that orchestration should be inspectable [5].

## The papers

**SGA-MCTS** builds a planning system around reusable abstractions instead of repeated online search [1]. The key mechanism is offline MCTS distillation into de-lexicalized SGA atoms, then hybrid retrieval that re-grounds those atoms into the current task as soft reasoning scaffolds. Next to CoEvolve, it represents the inference-time side of the same larger pattern: invest compute once, reuse structure many times [2].

**CoEvolve** closes the loop between agent policy and training data by extracting failure signals from trajectories—especially forgetting and uncertainty—and using them to guide LLM-based task synthesis [2]. The important part is not just “more RL,” but the mutual update between rollout-derived weaknesses and the next training distribution, validated through environment interaction before inclusion. Beside SGA-MCTS, it suggests a stack where both training and runtime are fed by mined trajectory structure rather than static benchmarks [1].

**GAM** gives memory a concrete architecture: an event progression graph for fresh interaction state, a topic associative network for more stable knowledge, and graph-guided retrieval to connect them [3]. Its contribution is the consolidation policy—new experience is not treated as equally worthy of long-term storage—which is exactly the failure mode MemEvoBench exposes when systems write too eagerly [4]. For anyone building persistent agents, this is more actionable than generic “long-term memory” claims.

**MemEvoBench** is useful because it evaluates the thing most agent demos skip: how memory quality degrades across repeated mixed-signal interactions [4]. It combines adversarial memory injection, noisy tool returns, and biased feedback over multi-round sessions, then shows that prompt-only defenses fail to stop drift. Read it as the missing counterweight to memory architecture papers like GAM: if you persist experience, you need tests for contamination, not just retrieval accuracy [3].

**AgentSPEX** tackles a different bottleneck: orchestration logic that is too implicit to maintain [5]. It introduces a workflow language with typed steps, loops, parallel execution, reusable submodules, explicit state, and a harness for sandboxing, checkpointing, verification, and logging. Alongside GAM and SGA-MCTS, it points to a practical design rule: keep the model flexible, but make the agent system around it legible enough that you can inspect where memory entered, where a branch was taken, and which reusable artifact shaped the result [1][3].
