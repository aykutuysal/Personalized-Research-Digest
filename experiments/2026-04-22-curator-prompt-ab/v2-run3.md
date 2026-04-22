# openai/gpt-5.4 — v2-run3

```json
{
  "ok": true,
  "label": "v2",
  "run": 3,
  "ms": 24878,
  "cost": 0.023349,
  "totalTokens": 16388,
  "inputTokens": 15102,
  "outputTokens": 1286,
  "referenceIds": [
    "W7154716487",
    "W7154458881",
    "W7154971597",
    "W7154537784",
    "W7155011363"
  ],
  "bodyChars": 6204
}
```

## body

## The big picture

The center of gravity is shifting from “can the model reason?” to **can the system keep good decisions stable over long horizons**. The strongest picks here all attack the same practical bottleneck from different sides: amortize expensive planning into reusable artifacts, make memory structured enough not to rot, and evaluate agents in settings that look more like production than toy tasks [1][2][3][4][5].

## Where things are converging

A clear pattern: teams are replacing raw context stuffing with **structured externalization**. In planning, that means distilling search into reusable primitives rather than re-running full inference-time search on every task; SGA atoms in SGA-MCTS are the cleanest version of this move [1]. In memory, GAM makes the same bet with a two-tier graph: transient event progression first, topic-level consolidation later, plus graph-guided retrieval instead of flat recall [2]. On the training side, CoEvolve closes the loop by mining rollout failures—forgetting and uncertainty—and generating new tasks from them, so the agent’s curriculum follows its actual failure surface instead of a frozen benchmark distribution [3].

The evaluation papers push the same lesson from the opposite direction. AlphaEval shows why many agent claims do not survive contact with messy requirements, multimodal inputs, and expert judgment in real deployments [4]. MemEvoBench adds a more specific warning: once you give agents persistent memory, the failure mode is no longer a single bad response but *behavioral drift* from contaminated updates over many rounds [5].

The trend to bet on is retrieval over trajectories, memory, and plans as **first-class system objects**—de-lexicalized action atoms, graph memories, failure-conditioned task synthesis. The trend to watch skeptically is any stack that still treats long-horizon competence as bigger prompts plus a vector store. This set does not support that shortcut.

## What to steal

- **Cache search as reusable atoms, not full traces.** If you already have successful trajectories from hard tasks, strip them into state-goal-action templates with slots for entities and values, then retrieve them as hints at runtime instead of replaying whole demonstrations [1]. This is a practical middle path between fine-tuning and expensive tree search.

- **Split memory into “working graph” and “consolidated graph.”** Keep fresh interaction state in a noisy, easily editable event layer, and only merge into long-term topic memory when a semantic shift is clear [2]. That one design choice directly targets the usual failure where short-term junk pollutes everything downstream.

- **Generate training tasks from failure signals you can already log.** CoEvolve uses forgetting and uncertainty from rollouts to synthesize new tasks [3]. If your agent platform records retries, tool-call reversals, or repeated dead ends, those are enough to start building a failure-driven data flywheel.

- **Test memory as an attack surface, not just a convenience feature.** Add adversarial notes, noisy tool returns, and subtly biased feedback into long-session evals, then watch whether the agent’s preferences or plans drift over time [5]. Static prompt hardening will miss this class of breakage.

- **Evaluate the whole product, not just the planner.** AlphaEval’s strongest point is methodological: tasks should include underspecified requirements, fragmented sources, and outputs that need expert review [4]. For an internal stack, that means scoring the orchestrator, retrieval, tool wrappers, and verification path together.

If only one thing sticks: **the reusable artifact is becoming the unit of progress**—not the prompt, not the model checkpoint, but the memory graph, action atom library, and failure-derived task bank you can carry from one run to the next [1][2][3].

## The papers

- **SGA-MCTS** turns planning into retrieval by doing heavy search offline, then compressing successful trajectories into de-lexicalized State-Goal-Action atoms that can be re-grounded online [1]. The useful mechanism is not MCTS by itself, but the decision to store causal action structure as reusable planning primitives; that makes it pair naturally with the memory-heavy papers here, which are also trying to move competence out of the prompt and into explicit system state.

- **GAM** builds memory as two connected graphs: an event progression graph for ongoing interaction and a topic associative network for consolidated knowledge, with promotion only after semantic shifts and retrieval guided by graph structure plus multiple factors [2]. Compared with MemEvoBench, it reads like a concrete architectural answer to memory drift; compared with SGA-MCTS, it is the same architectural instinct applied to recall rather than planning.

- **CoEvolve** is the most directly stealable learning loop in the set: mine rollout trajectories for forgetting and uncertainty, synthesize tasks that target those brittle spots, validate them by actual environment interaction, then update the training distribution [3]. The key idea is mutual evolution of agent and data rather than static RL on a fixed task pool, which makes it a strong complement to AlphaEval’s complaint that many benchmarks lag behind production reality.

- **AlphaEval** matters because it evaluates complete agent products on 94 real company tasks rather than isolated model abilities, mixing rubric grading, verification, UI testing, and judge-based assessment depending on the domain [4]. Mechanistically, its contribution is the requirement-to-benchmark pipeline: a way to convert real operating requirements into executable evals quickly enough that teams can keep pace with shipping systems.

- **MemEvoBench** gives persistent memory a proper failure model: long-horizon misbehavior caused by adversarial memory injection, noisy tool outputs, and biased feedback across both QA-style and workflow-style tasks [5]. The most actionable result is that prompt-only defenses do not hold up once bad information is allowed to accumulate, which puts pressure on memory architecture choices like GAM’s gated consolidation rather than just better system prompts.
