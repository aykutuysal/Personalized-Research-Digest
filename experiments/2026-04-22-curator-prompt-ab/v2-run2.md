# openai/gpt-5.4 — v2-run2

```json
{
  "ok": true,
  "label": "v2",
  "run": 2,
  "ms": 26985,
  "cost": 0.05889,
  "totalTokens": 16511,
  "inputTokens": 15102,
  "outputTokens": 1409,
  "referenceIds": [
    "W7154716487",
    "W7154458881",
    "W7154971597",
    "W7154537784",
    "W7154789938"
  ],
  "bodyChars": 6845
}
```

## body

## The big picture

The center of gravity is moving away from “make the model reason harder at runtime” toward **building agent systems that externalize competence into retrievable structure**: memories, workflow specs, production evals, and training data that co-evolve with failures. Across these picks, the useful question is less whether an agent can plan in one shot, and more whether you can cache, inspect, replay, and systematically improve the pieces that made planning work in the first place [1][2][3][4][5].

## Where things are converging

A clear convergence shows up around **amortization**. SGA-MCTS turns expensive search into reusable State-Goal-Action atoms that can be retrieved as soft hints at inference time [1]. GAM does something similar for long-horizon interaction, but on the memory side: it separates fast event capture from slower graph consolidation so transient junk does not overwrite stable context [2]. CoEvolve pushes the same idea into training, using uncertainty and forgetting from rollouts to synthesize the next data the agent should learn from instead of training forever on a frozen task set [3].

The disagreement is about where the bottleneck really sits. AlphaEval argues that many lab benchmarks still miss the messiest part of deployment: underspecified requirements, multimodal inputs, and success criteria that only become clear when a domain expert sees the output [4]. AgentSPEX takes the opposite flank and says a lot of brittleness is self-inflicted by workflow logic living implicitly in prompts; make control flow, state, branching, and verification explicit, and maintenance gets easier before model capability changes at all [5].

If betting on one trend, bet on **structured reuse with explicit interfaces**: retrievable planning primitives, graph memory, declarative workflows, and evals tied to real production tasks. Watch with skepticism anything that claims stronger agents mainly by adding more hidden reasoning budget without making the intermediate artifacts inspectable or reusable. If one thing changes this week, it is this: the durable gains are coming from turning agent behavior into infrastructure, not from one more clever prompt.

## What to steal

- **Cache successful trajectories as abstractions, not transcripts.** SGA-MCTS’s useful move is de-lexicalizing trajectories into State-Goal-Action atoms, then retrieving them as hints instead of replaying raw examples [1]. If you already log traces, try extracting entity-agnostic plan chunks like `state: missing dependency -> goal: run tests -> action: inspect lockfile` and inject only the top 1–3 matching chunks.
- **Split short-term capture from long-term memory writes.** GAM keeps an event progression graph for fresh interaction state and only merges into a topic-level associative network on semantic shifts [2]. That is a practical pattern for agents with persistent memory: don’t write every turn into canonical memory; gate consolidation on topic change, confidence, or repeated mention.
- **Mine failure traces to generate the next training tasks.** CoEvolve uses forgetting and uncertainty from rollouts to propose new tasks, validates them in the environment, then updates the training distribution [3]. A lightweight version: cluster failed episodes by tool error, planning stall, or missing knowledge; synthesize new task variants around those clusters instead of sampling more of what the agent already solves.
- **Make workflow logic a first-class artifact.** AgentSPEX’s typed steps, branching, loops, explicit state, checkpointing, and verification are the parts worth copying even if you never use the language itself [5]. For any agent that matters, move the control skeleton out of giant prompts and into something diffable.
- **Evaluate the product, not just the model.** AlphaEval’s construction pipeline starts from real requirements and turns them into executable tasks with mixed evaluation modes [4]. The practical takeaway is to build evals from incoming tickets, human QA rubrics, and UI tests together, because model-only benchmarks will miss orchestration failures and hidden constraints.

## The papers

- **SGA-MCTS** [1] replaces online search with offline search distillation. It uses MCTS to discover high-quality trajectories, compresses them into de-lexicalized State-Goal-Action atoms, and retrieves those atoms later through a symbolic-semantic matching layer so a frozen model gets planning hints without paying the search cost every run. Next to AgentSPEX [5], it suggests a strong split of concerns: workflow control can stay explicit while hard-won planning patterns become a reusable retrieval layer.

- **GAM** [2] is a memory architecture built around separation of duties: an event progression graph captures what is happening now, and a topic associative network stores more stable knowledge only after semantic shifts signal that consolidation is warranted. The mechanism matters because it reduces interference from transient noise while improving retrieval precision with graph-guided, multi-factor lookup. Read beside MemEvo-style concerns that are surfacing elsewhere in the field, it is a concrete design for making persistent memory less eager and less fragile.

- **CoEvolve** [3] treats agent training as a closed loop between behavior and data rather than RL over a fixed benchmark. It extracts failure signals from trajectories — especially uncertainty and forgetting — uses them to synthesize new tasks, validates those tasks through environment interaction, and then retrains on the updated distribution. Compared with SGA-MCTS [1], which amortizes search into reusable atoms, CoEvolve amortizes deployment failures into better future curricula.

- **AlphaEval** [4] is useful because it evaluates complete agent products on real work from seven companies instead of toy tasks with clean specs. The contribution is the requirement-to-benchmark pipeline: authentic business requirements get transformed into executable tasks evaluated by a mix of judges, references, formal checks, rubrics, and UI tests. Put next to CoEvolve [3], it gives a better source of failure signals; put next to AgentSPEX [5], it gives a way to see whether explicit workflow engineering actually survives production messiness.

- **AgentSPEX** [5] is the most directly stealable tooling paper here. It defines an agent specification language with typed steps, branching, loops, parallelism, reusable modules, and explicit state, plus a harness with sandboxing, checkpointing, verification, and logging, so workflow behavior stops being hidden in Python-plus-prompts glue. In the context of the other picks, it is the orchestration substrate that makes retrieved planning units [1], memory policies [2], and production eval feedback [4] easier to wire into a maintainable system.
