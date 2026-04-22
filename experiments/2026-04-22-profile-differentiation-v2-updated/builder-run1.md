# openai/gpt-5.4 — builder-run1

```json
{
  "ok": true,
  "label": "builder",
  "run": 1,
  "ms": 24361,
  "cost": 0.0588375,
  "totalTokens": 16505,
  "inputTokens": 15099,
  "outputTokens": 1406,
  "referenceIds": [
    "W7154716487",
    "W7154458881",
    "W7154971597",
    "W7154789938",
    "W7154537784"
  ],
  "bodyChars": 6463
}
```

## body

## The big picture

The field is moving away from “one giant prompt plus tools” and toward **explicit structure around experience, execution, and evaluation**. These picks all attack the same failure mode from different angles: agents break when planning, memory, or collaboration stays implicit. The fix showing up repeatedly is to externalize what the agent has learned into retrievable atoms, graphs, workflows, or production-grounded tests, then make runtime behavior easier to steer, measure, and harden [1][2][3][4][5].

## Where things are converging

The strongest convergence signal is on **amortizing reasoning** instead of paying full search cost at runtime every time. SGA-MCTS turns search traces into reusable State-Goal-Action atoms that a frozen model can retrieve as soft hints [1]. GAM does something similar for long-horizon interaction, but on the memory side: it separates fast event capture from slower topic-level consolidation in a hierarchical graph [2]. CoEvolve pushes the same idea into training, using rollout failures like forgetting and uncertainty to synthesize the next batch of tasks rather than learning from a fixed distribution [3].

The framework papers point in a compatible direction. AgentSPEX says the control flow itself should be first-class — typed steps, loops, branches, checkpointing, verification — instead of hiding orchestration in Python glue and prompt text [4]. AlphaEval makes the same argument for testing: benchmark the whole agent product on messy real tasks, not just the base model on clean academic tasks [5].

Where they disagree is *where to put the structure*. One camp bets on retrieval over distilled experience [1][2]. Another bets on explicit workflow languages and harnesses [4]. A third bets on closed-loop data generation to continuously reshape the task distribution [3]. If I had to bet on one trend now, it’s retrieval-plus-structure: reusable experience units backed by explicit execution graphs. The thing to watch with skepticism is any claim that better prompting alone fixes long-horizon planning or memory drift; the production and benchmark papers here cut against that pretty hard [2][5].

## What to steal

- **Split short-term traces from durable memory.** Keep raw interaction events in one store and only promote them into a topic/entity graph when a semantic shift is detected. That is the core move in GAM, and it is a practical antidote to context pollution in long-running agents [2].

- **Store reusable planning atoms, not just transcripts.** Distill successful trajectories into de-lexicalized State-Goal-Action templates, then retrieve and re-ground them at runtime. Copy this if your agent solves the same task family repeatedly and you are tired of paying search latency on every request [1].

- **Use failures to generate training data.** Mine rollouts for forgetting and uncertainty, synthesize tasks around those weak spots, and validate them through environment interaction before adding them back into training. CoEvolve reports absolute gains of 19.43%, 15.58%, and 18.14% on AppWorld and BFCL across Qwen2.5-7B, Qwen3-4B, and Qwen3-30B-A3B [3].

- **Make orchestration declarative.** Put loops, branches, parallel steps, state, and checkpoints into an explicit workflow spec instead of hiding them in framework code. This makes debugging and editing dramatically easier once an agent grows past a toy demo [4].

- **Evaluate the shipped system, not the model in isolation.** Build test cases from real requirements, heterogeneous inputs, and expert judgment criteria. AlphaEval’s 94 tasks from seven companies is a good pattern for replacing “benchmark green” with something closer to operational truth [5].

## The papers

**SGA-MCTS** [1] is the most useful planning paper in the set because it converts expensive search into a reusable asset. The mechanism is simple and strong: run MCTS offline, distill trajectories into de-lexicalized State-Goal-Action atoms, then do hybrid symbolic-semantic retrieval online so a frozen open model gets search-like guidance without task-specific fine-tuning. Next to GAM, it is the planning analogue of memory consolidation: compress experience into units that survive beyond the original episode [2].

**GAM** [2] is the memory paper I’d read first if you are building agents that have to survive more than one session. Its core design choice is to decouple encoding from consolidation: ongoing dialogue lives in an event progression graph, and only semantically stable material gets integrated into a topic associative network, with graph-guided multi-factor retrieval handling access. That sits nicely beside SGA-MCTS: both papers reject flat history buffers in favor of structured reusable state, just at different layers of the stack [1].

**CoEvolve** [3] is the strongest learning-and-adaptation pick because it closes the loop between agent behavior and training data. Instead of reinforcing on a static benchmark distribution, it extracts failure signals from real trajectories, uses them to drive LLM-based task synthesis, validates those tasks in the environment, and updates the data distribution as the agent changes. That pairs well with AlphaEval: once production eval tells you where the system is weak, CoEvolve gives you a concrete recipe for generating the next training workload [5].

**AgentSPEX** [4] matters because it treats agent workflows as something you can author, inspect, and maintain directly, rather than as an accident of prompts plus Python. Typed steps, loops, branching, parallel execution, reusable submodules, explicit state, sandboxing, verification, logging, and checkpointing are exactly the pieces most teams bolt on piecemeal after their first brittle agent launches. Relative to the learning and memory papers, this is the execution scaffold that makes those ideas operational instead of experimental [1][2][3].

**AlphaEval** [5] is the reality check. It evaluates complete agent products like Claude Code and Codex on 94 tasks from seven companies across six O*NET domains, with mixed evaluation modes including LLM-as-a-Judge, formal verification, rubric-based assessment, automated UI testing, and reference-driven metrics. Next to the other four papers, its value is not a new agent mechanism but a forcing function: if your memory scheme, planning retrieval, or orchestration language does not survive messy, implicit, long-horizon work, it is not ready yet [1][2][4].
