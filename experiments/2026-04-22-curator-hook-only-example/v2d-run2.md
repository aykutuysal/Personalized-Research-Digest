# openai/gpt-5.4 — v2d-run2

```json
{
  "ok": true,
  "label": "v2d",
  "run": 2,
  "ms": 23549,
  "cost": 0.0348835,
  "totalTokens": 16344,
  "inputTokens": 15025,
  "outputTokens": 1319,
  "referenceIds": [
    "W7154458881",
    "W7154716487",
    "W7154537784",
    "W7154789938",
    "W7154971597"
  ],
  "bodyChars": 6473
}
```

## body

## The big picture

The center of gravity is moving away from bigger prompts and monolithic loops toward **agent infrastructure that externalizes cognition**: memory as a managed data structure, planning as reusable search artifacts, evaluation as a product-level discipline, and workflow logic as something you can author and inspect instead of burying in Python or chain prompts. The common bet across these picks is that agent quality now comes more from how you package state, control flow, and feedback than from squeezing one more clever instruction into the system prompt.

## Where things are converging

Three implementation trends show up repeatedly. First, *memory is being split into phases and representations* rather than treated as a raw append-only transcript: GAM separates event capture from consolidation into a topic graph, then retrieves with graph-guided signals instead of nearest-neighbor text search [1]. Second, *planning is being amortized*: SGA-MCTS pushes expensive search offline, stores de-lexicalized State-Goal-Action atoms, and uses retrieval to rehydrate those plans online at low latency [2]. Third, *evaluation is shifting from benchmarking models to benchmarking shipped systems*: AlphaEval measures complete agent products against messy requirements and mixed scoring regimes rather than tidy single-metric tasks [3].

The disagreement is about how much structure to impose up front. AgentSPEX argues for explicit typed workflows, branching, checkpoints, and a dedicated execution language [4]. CoEvolve makes the opposite move in training: let failures in rollouts drive task synthesis, then adapt the data distribution with the agent in a closed loop [5]. The practical read is to bet on **structured runtime scaffolding plus adaptive feedback loops**. Be skeptical of stacks that promise reliability from prompts alone, but also of rigid workflow systems that never learn from their own misses.

If only one thing sticks: treat memory, plans, and eval traces as first-class artifacts you can version and retrieve, not incidental byproducts of a chat loop [2].

## What to steal

- **Separate write-time memory from read-time memory.** Log fresh interaction state in one representation, then consolidate only on semantic shifts into a more stable store. GAM’s event-graph -> topic-network split is a good default when your agent keeps forgetting or over-indexing on recent noise [1].

- **Cache planning as reusable primitives, not full trajectories.** SGA-MCTS gets leverage by storing de-lexicalized State-Goal-Action atoms rather than raw transcripts. If you already have successful runs, extract slot-filled subplans like `state: dependency conflict / goal: restore tests / action: inspect lockfile diff` and retrieve them as hints during execution [2].

- **Generate new training tasks from failure signatures.** CoEvolve uses forgetting and uncertainty from rollouts to synthesize new tasks, validates them in-environment, then updates the training distribution. Even without full RL, you can mine production traces for repeated failure motifs and auto-generate adversarial or edge-case tasks around them [5].

- **Author control flow outside application code.** AgentSPEX’s value is not just readability; it gives you typed steps, loops, parallel branches, checkpointing, and verification as workflow primitives. If your current agent logic is tangled inside decorators and callback glue, moving state transitions into a declarative layer will make debugging and audits much easier [4].

- **Evaluate the assembled product, not the base model.** AlphaEval’s construction pipeline starts from real requirements, then turns them into executable tasks with mixed evaluators. Steal that method for internal evals: collect actual work requests, preserve implicit constraints, and score outputs with whatever fits the task—UI tests, rubrics, reference checks, formal validation—not one universal judge [3].

## The papers

- **GAM: Hierarchical Graph-based Agentic Memory** builds a two-layer memory system: an event progression graph for ongoing context and a topic associative network for consolidated long-term knowledge, with updates gated by semantic shifts rather than every turn [1]. The useful mechanism is the decoupling of encoding from consolidation plus graph-guided retrieval; it sits nicely next to SGA-MCTS because both replace flat text history with reusable structured artifacts.

- **SGA-MCTS** turns planning into retrieval by running MCTS offline, distilling discovered trajectories into de-lexicalized State-Goal-Action atoms, then fetching and re-grounding them online as soft hints [2]. This is the most actionable planning paper here because it offers a concrete way to trade search-time compute for a reusable plan library, and it pairs naturally with structured memory systems like GAM or declarative runtimes like AgentSPEX.

- **AlphaEval** is less about a new agent algorithm than a missing discipline: evaluating full agent products under production messiness, where tasks have hidden constraints, heterogeneous inputs, and evolving expert standards [3]. The strong contribution is the requirement-to-benchmark construction pipeline, which is more reusable than any one benchmark domain and complements the other papers by giving you a way to tell whether memory, planning, or orchestration changes actually survive contact with real workflows.

- **AgentSPEX** introduces a dedicated specification and execution language with typed steps, branching, loops, parallel execution, reusable modules, explicit state, and a harness that includes sandboxing, verification, logging, and checkpointing [4]. Relative to framework code in Python, the win is inspectability: you can see and edit the workflow itself, which makes it the cleanest control-plane companion to the more adaptive data-plane ideas in CoEvolve and SGA-MCTS.

- **CoEvolve** closes the loop between agent behavior and training data by extracting failure signals such as uncertainty and forgetting from rollouts, using them to synthesize new tasks, validating those tasks through environment interaction, and retraining on the updated distribution [5]. That makes it the most compelling pick for adaptation: instead of hoping a static benchmark covers future failures, it operationalizes a self-expanding curriculum that can feed the same eval pipeline AlphaEval calls for and improve the same structured runtimes the other papers propose.

