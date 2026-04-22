# openai/gpt-5.4 — v1-run1

```json
{
  "ok": true,
  "label": "v1",
  "run": 1,
  "ms": 21493,
  "cost": 0.023388,
  "totalTokens": 16048,
  "inputTokens": 14760,
  "outputTokens": 1288,
  "referenceIds": [
    "W7154458881",
    "W7154716487",
    "W7154971597",
    "W7154537784",
    "W7154789938"
  ],
  "bodyChars": 6225
}
```

## body

## The big picture

The field is moving away from “just give the model more context and let it think” toward **explicitly structured agent state**: memory that consolidates instead of accumulates, planning that retrieves reusable search traces instead of recomputing them, evaluation that reflects production messiness, and workflow definitions that make control flow inspectable rather than hidden in prompts [1][2][3][4][5]. The shared problem is no longer whether agents can act at all; it is whether they can stay coherent, fast, and debuggable once they run for many steps with tools, memory, and real users in the loop.

## Where things are converging

The strongest convergence is on *amortization*: do expensive reasoning or search once, then reuse the result in a form the runtime agent can cheaply consume. SGA-MCTS turns Monte Carlo Tree Search rollouts into de-lexicalized State-Goal-Action atoms for retrieval-time planning hints [2]. CoEvolve uses rollout failures, uncertainty, and forgetting signals to synthesize new tasks and keep the training distribution moving with the agent [3]. GAM does the same move for memory, splitting fast event capture from slower graph consolidation so transient noise does not poison durable state [1].

Where they disagree is the abstraction layer to bet on. AgentSPEX says the missing piece is **workflow as code-like specification**: typed steps, branching, loops, explicit state, checkpointing, and verification [5]. AlphaEval argues the bigger gap is evaluation realism, because benchmark wins often disappear once requirements are implicit, documents are heterogeneous, and judges are human or rubric hybrids instead of exact-match metrics [4]. The practical bet is to favor systems that expose named intermediate artifacts — memory graphs, retrieval atoms, executable workflows, production tasks — because those are what let you improve and audit an agent stack. The trend to watch skeptically is any approach that promises general agent gains without showing the reusable representation that carries those gains across tasks.

## What to steal

- **Separate write-time memory from read-time memory.** Store raw interaction traces as event-level state, but only promote them into durable semantic structures when a topic shift or consolidation trigger fires. That is the core GAM pattern, and it is a direct way to cut long-session contamination and retrieval noise [1].
- **Cache reasoning as reusable primitives, not just examples.** SGA-MCTS gets mileage by abstracting trajectories into de-lexicalized State-Goal-Action atoms rather than replaying full demonstrations. If your agent already solves some tasks well, distill the causal skeleton into slot-filled templates and retrieve those at runtime as soft hints [2].
- **Train on failures your current agent actually produces.** CoEvolve treats uncertainty and forgetting in rollouts as a data engine. A practical version: log failure traces, cluster them, synthesize nearby tasks, validate by rerunning in the environment, then add only the validated cases back into training or eval [3].
- **Benchmark the whole product, not the model.** AlphaEval’s construction pipeline starts from real requirements and turns them into executable tasks with mixed grading modes. If you are shipping agents, build evals around artifacts your users already care about — deliverables, UI actions, review outcomes, policy checks — instead of only QA-style success labels [4].
- **Move orchestration out of prompt soup.** AgentSPEX’s typed steps, loops, parallel blocks, explicit state, and checkpointing are a useful design checklist even if you never adopt the language itself. When an agent fails, you want a graph you can inspect, rerun, and patch — not one mega-prompt plus logs [5].

## The papers

- **GAM: Hierarchical Graph-based Agentic Memory** builds a two-tier memory system: an event progression graph for fresh dialogue state and a topic associative network for consolidated knowledge, with promotion happening on semantic shifts rather than every turn [1]. That mechanism matters because it treats memory corruption as an architectural problem, not just a retrieval problem, and it pairs naturally with the representation-first trend in SGA-MCTS and AgentSPEX.

- **SGA-MCTS** turns planning into retrieval by running heavy MCTS offline, compressing useful trajectories into de-lexicalized State-Goal-Action atoms, then re-grounding retrieved atoms online as hints for a frozen model [2]. The important move is the abstraction boundary: it preserves causal structure while dropping task-specific surface form, which makes it a stronger reusable planning substrate than plain trajectory replay.

- **CoEvolve** closes the loop between the agent and its data by mining rollout traces for uncertainty and forgetting, using those signals to drive LLM-based task synthesis, and validating the synthesized tasks through environment interaction before training on them [3]. Compared with SGA-MCTS’s offline planning cache, this is the learning-time analogue: both amortize expensive search, but CoEvolve keeps the task distribution adaptive instead of fixed.

- **AlphaEval** is useful because it evaluates deployed agent products under production-style requirements rather than sanitized benchmark tasks, combining multiple judging modes including rubric assessment, formal verification, UI testing, and LLM judges [4]. For anyone shipping agents, the mechanism to notice is the requirement-to-benchmark pipeline: it gives you a way to convert messy specs into repeatable evals, which is exactly what the more structured runtime stacks in the other picks need.

- **AgentSPEX** proposes a specification language for agent workflows with typed steps, branching, loops, parallel execution, reusable submodules, explicit state, and an execution harness that adds sandboxing, checkpointing, verification, and logging [5]. Next to the other picks, it is the control-plane answer: if GAM structures memory, SGA-MCTS structures planning priors, and CoEvolve structures learning signals, AgentSPEX structures the workflow itself so those components can be inspected and swapped without rewriting the whole stack in Python glue.

