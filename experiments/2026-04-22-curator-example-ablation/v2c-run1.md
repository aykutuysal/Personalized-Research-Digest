# openai/gpt-5.4 — v2c-run1

```json
{
  "ok": true,
  "label": "v2c",
  "run": 1,
  "ms": 29274,
  "cost": 0.040291,
  "totalTokens": 16580,
  "inputTokens": 15106,
  "outputTokens": 1474,
  "referenceIds": [
    "W7154716487",
    "W7154458881",
    "W7154971597",
    "W7154537784",
    "W7154789938"
  ],
  "bodyChars": 7117
}
```

## body

## The big picture

The center of gravity is moving from “make the model reason harder” to **make the agent system carry reusable structure**. The strongest picks all externalize something the model would otherwise improvise at runtime: memory into graphs, planning into retrieved action atoms, evaluation into production-shaped tasks, training into a loop that mutates the task distribution, and workflow logic into an explicit agent language [1][2][3][4][5]. That shift matters because raw model gains are no longer enough to fix the failure modes builders actually see in long-horizon runs: drift, brittle plans, unclear regressions, and orchestration that only exists inside prompts.

## Where things are converging

Three techniques keep showing up.

First, **offline structure plus lightweight online adaptation** is beating end-to-end improvisation. SGA-MCTS does the heavy search work once, distills trajectories into de-lexicalized State-Goal-Action atoms, then retrieves and re-grounds them at inference time instead of running expensive search live [1]. GAM does something similar for memory: it separates fast event capture from slower consolidation into a topic graph, so transient noise does not immediately pollute durable memory [2]. CoEvolve applies the same pattern to learning, mining rollouts for failure signals and then using those signals to synthesize new training tasks rather than trusting a fixed benchmark distribution [3].

Second, the field is converging on **typed, inspectable intermediate representations**. In these picks that takes different forms—SGA atoms [1], event and topic graphs [2], requirement-derived evaluation tasks [4], and explicit workflow steps with branching, loops, and state in AgentSPEX [5]. The common bet is that agents become easier to debug once planning, memory, and control flow exist as artifacts you can inspect, cache, version, and swap.

Where the papers disagree is where to spend complexity. AgentSPEX says put it in the orchestration layer and make workflows explicit [5]. SGA-MCTS says put it in offline search and retrieval instead [1]. GAM argues some of your instability is really a memory layout problem, not a planner problem [2]. The safer bet right now is on **artifact-producing systems**—retrieval memories, workflow specs, benchmark tasks—because they compose with existing stacks. The trend to watch with skepticism is anything that claims robustness from prompting alone; both the memory and evaluation papers point the other direction, toward system design and environment-shaped tests [2][4].

If one thing changes this week: stop treating agent quality as a property of the base model alone; treat it as a property of the artifacts your system can accumulate and reuse [1][2][3][5].

## What to steal

- **Cache plans as reusable atoms, not full traces.** If you already run search, tree-of-thought, or expensive planner passes offline, distill successful trajectories into de-lexicalized state-goal-action snippets and retrieve them as soft hints at runtime instead of replaying whole examples [1]. This is a cleaner pattern than few-shot trace stuffing because it preserves causal structure while dropping task-specific clutter.

- **Split memory into write-fast and consolidate-slow paths.** Keep a volatile event log for current interaction state, but only merge into durable topic memory on semantic shifts or after consistency checks [2]. That is a practical guard against the “one bad tool output poisoned the next ten turns” failure mode.

- **Turn rollout failures into new tasks automatically.** CoEvolve’s useful move is not just RL; it is the loop of extracting uncertainty and forgetting signals from trajectories, synthesizing tasks around those weak spots, validating them in-environment, then retraining on the updated distribution [3]. Even without full RL, that pattern can drive synthetic regression generation for your eval suite.

- **Write workflows as data, not Python glue.** AgentSPEX’s value is explicit control flow: typed steps, branching, parallel blocks, checkpointing, and reusable submodules [5]. If your current agents are mostly prompt templates wrapped in imperative code, moving logic into a declarative spec will make diffing, review, and failure replay much easier.

- **Evaluate the shipped product, not the isolated model.** AlphaEval is worth copying for its construction method: start from real requirements, preserve hidden constraints and heterogeneous inputs, and score with multiple paradigms instead of a single judge [4]. That is the right antidote to agents that look great on canned tasks and fall apart in messy workflows.

## The papers

- **SGA-MCTS** builds a planning system around retrieval rather than online search: MCTS is used offline to harvest strong trajectories, which are compressed into de-lexicalized State-Goal-Action atoms, then fetched with hybrid symbolic-semantic retrieval and re-grounded as reasoning hints during execution [1]. Next to AgentSPEX, it is the strongest case here for making reasoning reusable; next to GAM, it shows that not all long-horizon competence needs to live in memory if you can store reusable decision primitives.

- **GAM** introduces a two-layer memory design: an event progression graph for recent interaction flow and a topic associative network for more stable knowledge, with consolidation triggered by semantic shifts rather than continuous stream updates [2]. The mechanism matters more than the benchmark win: it is a direct answer to interference in long-running agents, and it pairs naturally with SGA-MCTS if you want memory to track context while retrieved atoms handle decision structure.

- **CoEvolve** closes the loop between agent behavior and training data by reading rollout traces for signals like uncertainty and forgetting, using those to drive LLM-based task synthesis, validating synthesized tasks through environment interaction, and then retraining on the refreshed distribution [3]. Among these papers, it is the clearest recipe for continuous improvement that does not depend on waiting for humans to author better tasks.

- **AlphaEval** contributes both a benchmark and a construction pipeline: 94 production-grounded tasks from deployed agent products, evaluated with mixed methods including LLM judges, reference metrics, formal verification, rubric scoring, and UI tests [4]. What makes it useful beside CoEvolve is that it gives you a target shape for “real” failures; what makes it useful beside AgentSPEX is that explicit workflows become much easier to test once requirements are converted into executable eval tasks.

- **AgentSPEX** turns agent orchestration into a specification language with typed steps, loops, branches, parallel execution, explicit state, checkpointing, verification, and logging, plus a visual editor for inspection [5]. It sits at the opposite end of the stack from AlphaEval but solves the same practical problem: once workflow logic is no longer hidden in prompts and Python callbacks, you can actually version it, review it, and run meaningful regressions against it.

