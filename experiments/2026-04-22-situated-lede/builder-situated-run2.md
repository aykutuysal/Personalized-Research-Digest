# openai/gpt-5.4 — builder-situated-run2

```json
{
  "ok": true,
  "label": "builder-situated",
  "run": 2,
  "ms": 26451,
  "cost": 0.053539,
  "totalTokens": 16519,
  "inputTokens": 15148,
  "outputTokens": 1371,
  "referenceIds": [
    "W7154789938",
    "W7154716487",
    "W7154458881",
    "W7154537784",
    "W7154971597"
  ],
  "bodyChars": 6309
}
```

## body

## The big picture

Right now the practical question is not whether to add more agent loops, tools, or collaborators. It is **which parts of the stack should become explicit system components instead of prompt text**. This set of papers matters because it gives you concrete answers at three layers: workflow definition and execution [1], retrieval and planning primitives you can reuse without retraining [2], memory structures that survive longer sessions without turning noisy [3], production-facing evaluation that looks more like shipped products than toy tasks [4], and a training loop that updates the task distribution as the agent changes [5].

## Where things are converging

The shared move here is away from monolithic “agent = one prompt + one model” design.

Instead, the picks converge on **factored agent systems**:

- explicit workflow control flow with typed steps, branching, loops, and checkpointing in AgentSPEX [1]
- offline search distilled into reusable *State-Goal-Action* atoms, then retrieved at runtime in SGA-MCTS [2]
- memory split into an event progression graph plus a topic associative network in GAM [3]
- evaluation composed from multiple judging modes against messy real tasks in AlphaEval [4]
- training driven by rollout-derived failure signals and LLM-generated replacement tasks in CoEvolve [5]

The bet to make is on architectures that separate fast online execution from slower offline structure-building. SGA-MCTS [2] does this by paying the MCTS cost offline and retrieving de-lexicalized plans online. GAM [3] does it by delaying consolidation until semantic shifts instead of dumping every turn into one stream. CoEvolve [5] applies the same pattern to learning: don’t keep training on a frozen benchmark; regenerate the task mix from the agent’s current failure modes.

The thing to watch with skepticism is broad agent evaluation that stops at static task scores. AlphaEval [4] is useful precisely because it evaluates complete products across 94 tasks from seven companies, with heterogeneous inputs, long-horizon outputs, and mixed evaluation modes. That is a better reality check than another benchmark where the requirement is perfectly specified and the metric is deterministic.

## What to steal

- **Move workflow logic out of Python glue and into a typed spec.** Copy AgentSPEX’s pattern: explicit steps, branching, loops, parallel execution, reusable submodules, and explicit state [1]. Do this before your next agent gets a second execution path. Hidden control flow is where maintainability goes to die.

- **Cache planning as reusable atoms, not full trajectories.** Distill successful traces into de-lexicalized State-Goal-Action units, then retrieve and re-ground them as soft hints at runtime [2]. This is the cleanest pattern in the pool for getting search-like reasoning without paying search latency on every request.

- **Split short-term event tracking from long-term knowledge.** Keep an event graph for what just happened; promote information into a topic graph only when the conversation actually changes topic [3]. This is a direct fix for the “one bad tool call pollutes memory forever” failure mode.

- **Instrument rollouts for forgetting and uncertainty, then generate tasks from the failures.** CoEvolve [5] uses those signals to synthesize new tasks, validate them in the environment, and shift the training distribution. Add this loop if your agent improves on the benchmark and still falls apart on new workflows.

- **Evaluate the shipped system, not just the base model.** Mix rubric grading, reference-based checks, formal verification where possible, and UI or execution tests the way AlphaEval [4] does. Build the eval around the deliverable your user actually sees.

## The papers

**AgentSPEX** is the strongest frameworks pick because it turns agent behavior into something you can inspect and edit as a workflow artifact, not a pile of orchestration code [1]. The mechanism is the point: typed steps, loops, branching, parallel execution, reusable modules, explicit state, plus a harness with tool access, sandboxing, checkpointing, verification, and logging. Next to the rest of the pool, it is the clearest answer to “how do I keep a growing agent system legible?”

**SGA-MCTS** has the most reusable planning idea here [2]. It runs Monte Carlo Tree Search offline, distills results into de-lexicalized State-Goal-Action atoms, and uses hybrid symbolic-semantic retrieval to inject those atoms back as runtime reasoning hints. Compared with AgentSPEX [1], which makes control flow explicit, SGA-MCTS makes tacit planning experience portable.

**GAM** is the memory paper to read if you have felt unified memory streams become self-sabotaging over long sessions [3]. The architecture decouples encoding from consolidation: an event progression graph handles ongoing dialogue, and a topic associative network stores stabilized knowledge only after semantic shifts, with graph-guided multi-factor retrieval on top. That sits neatly beside SGA-MCTS [2]: both are really about preserving reusable structure while filtering away transient noise.

**AlphaEval** is the evaluation pick because it stops pretending production tasks look like benchmark prompts [4]. The benchmark contains 94 tasks from seven companies across six O*NET domains and evaluates complete agent products using multiple paradigms, including LLM-as-a-Judge, reference-driven metrics, rubric-based assessment, formal verification, and automated UI testing. Read it next to AgentSPEX [1]: if you are going to make workflows explicit, you also need evals that can see failures at the system level.

**CoEvolve** is the learning pick because it closes the loop between agent behavior and the data used to improve it [5]. It extracts forgetting and uncertainty from rollout trajectories, uses those signals to drive LLM-based task synthesis, validates the tasks through environment interaction, and retrains on the updated distribution; on AppWorld and BFCL it reports absolute gains of 19.43%, 15.58%, and 18.14% across Qwen2.5-7B, Qwen3-4B, and Qwen3-30B-A3B. Paired with AlphaEval [4], it suggests a practical roadmap: use production-shaped evaluation to find failures, then regenerate training experience instead of hand-curating another static dataset.
