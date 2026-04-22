# openai/gpt-5.4 — v2c-run1

```json
{
  "ok": true,
  "label": "v2c",
  "run": 1,
  "ms": 23883,
  "cost": 0.024139,
  "totalTokens": 16444,
  "inputTokens": 15106,
  "outputTokens": 1338,
  "referenceIds": [
    "W7154716487",
    "W7154458881",
    "W7154537784",
    "W7154789938",
    "W7154971597"
  ],
  "bodyChars": 6422
}
```

## body

## The big picture

The center of gravity is shifting from “make the model reason harder” to **make the agent substrate more structured**. Across these picks, the gains come from turning fuzzy runtime behavior into explicit assets: reusable planning atoms instead of fresh search every step [1], graph memories instead of flat transcript stuffing [2], production-shaped evals instead of toy tasks [3], executable workflow specs instead of Python-only orchestration glue [4], and closed-loop data generation that follows the agent’s actual failure modes [5].

## Where things are converging

A clear bet is emerging around **amortization**: do the expensive work once, then reuse it at inference. SGA-MCTS pushes search offline and stores de-lexicalized State-Goal-Action atoms for retrieval-time planning hints [1]. GAM does the same move for memory by splitting fast event capture from slower consolidation into a topic graph, then retrieving with graph-guided signals rather than naive recency [2]. CoEvolve applies the pattern to training data: mine uncertainty and forgetting from rollouts, synthesize tasks that target those gaps, then re-train on the shifted distribution [5].

The disagreement is about where to put control. AgentSPEX argues for explicit workflow structure — typed steps, loops, branching, state, checkpoints — as the way to make agents editable and inspectable [4]. AlphaEval is a reminder that neat workflow abstractions still break against messy inputs, implicit requirements, and expert judgment in the wild [3]. That makes benchmark wins worth discounting unless the environment looks like deployment. If there’s one trend to lean into, it’s retrieval over repeated deliberation: planning memories [1] and graph memories [2] both point to cheaper, more stable agents than “just run more tokens.” The trend to watch skeptically is any framework story that improves authoring but says little about how the agent behaves under production ambiguity [3][4].

## What to steal

- **Cache planning as reusable atoms, not full traces.** Distill solved trajectories into de-lexicalized state-goal-action chunks and retrieve them as soft hints at runtime. This is the practical part of SGA-MCTS: you keep the causal skeleton and swap entities back in per task [1].
- **Split memory into write-fast and consolidate-slow paths.** Keep a transient event graph during interaction, then merge into a topic-level store only on semantic shifts. That should reduce contamination from noisy turns and stop every user message from polluting long-term state [2].
- **Drive synthetic task generation from rollout failures.** CoEvolve’s useful trick is not “generate more data,” but generate from measured uncertainty and forgetting signals pulled from environment traces [5]. If your eval logs already expose recurrent misses, they can become a curriculum generator.
- **Specify agent control flow outside raw prompts.** Typed steps, explicit branches, submodules, checkpoints, and verification hooks make it easier to patch workflows than to keep growing a giant system prompt. AgentSPEX is closest to “infra you can diff” rather than “prompt craft you can only inspect after the fact” [4].
- **Test on requirement mess, not benchmark cleanliness.** AlphaEval’s construction pipeline — start from real requirements, convert them into executable tasks, then score with multiple paradigms — is a pattern worth copying internally even if you never use the benchmark itself [3].

If only one thing sticks: **the strongest agent stacks are starting to look less like chat loops and more like systems that compile experience into reusable structure** [1][2][4][5].

## The papers

- **SGA-MCTS** replaces inference-time search with retrieval over offline-discovered planning primitives [1]. The mechanism is the key contribution: MCTS is used once to harvest high-fidelity trajectories, then those are compressed into de-lexicalized State-Goal-Action atoms that can be re-grounded in new contexts. Next to GAM, it makes the same argument from the planning side that reusable structure beats repeatedly reasoning from scratch [2].

- **GAM** builds a two-level memory system that separates ongoing event encoding from longer-term semantic consolidation [2]. Instead of one undifferentiated memory stream, it stores dialogue progression in an event graph and only folds information into a topic associative network when the narrative meaning actually shifts; retrieval then uses graph structure plus multiple relevance factors. Put beside MemEvo-style safety concerns in the broader field, this is the more actionable memory paper because it changes the write path, not just the diagnosis.

- **AlphaEval** is useful because it evaluates complete agent products under production conditions rather than isolated models on curated tasks [3]. The mechanism is the requirement-to-benchmark pipeline: authentic business requirements become executable tasks, and scoring mixes LLM judges, reference metrics, formal checks, rubrics, and UI testing depending on domain. Relative to the more algorithmic papers here, it is the reality check — the place where orchestration, memory, and planning ideas have to survive implicit constraints and expert review.

- **AgentSPEX** proposes a DSL and harness for agent workflows with explicit control flow, typed steps, state management, loops, parallelism, checkpointing, verification, and logging [4]. The practical point is not just another framework; it moves workflow logic out of ad hoc Python-plus-prompts into a representation that can be inspected, edited, and visualized directly. It pairs naturally with AlphaEval: if you need to debug why an agent failed a production-shaped task, explicit state and branch structure are far easier to interrogate than prompt spaghetti [3].

- **CoEvolve** closes the loop between agent behavior and the data used to improve it [5]. It extracts failure signals such as uncertainty and forgetting from rollout trajectories, uses those to guide LLM-based task synthesis, validates the synthesized tasks through environment interaction, and then retrains on the updated distribution. Among these picks, it is the clearest recipe for continuous improvement after deployment: planning assets [1], memory assets [2], and workflow specs [4] all get better when the training set follows the agent’s actual blind spots instead of a frozen benchmark mix.
