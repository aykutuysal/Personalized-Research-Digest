# openai/gpt-5.4 — old-run2

```json
{
  "ok": true,
  "label": "old",
  "run": 2,
  "ms": 22027,
  "cost": 0.023859,
  "totalTokens": 16502,
  "bodyChars": 5988
}
```

## body

## The big picture

The field is moving away from “just give the agent more context” toward **structured externalization of competence**: memory gets compressed into graphs or reusable planning atoms, workflows get written as explicit programs instead of prompt soup, and evaluation is shifting from toy tasks to production or embodied settings that expose where these systems actually break [1][2][3][4][5]. The common thread is simple: if you want agents that survive long horizons, tool sprawl, and real users, you need architectures that turn latent reasoning into inspectable state.

## Where things are converging

The strongest convergence is on **decoupling heavy cognition from online execution**.

GAM [1] does it for memory: keep fresh interaction state in an event progression graph, then consolidate into a topic associative network only when a semantic shift happens. SGA-MCTS [2] does the same for planning: pay the search cost offline with MCTS, distill trajectories into de-lexicalized State-Goal-Action atoms, then retrieve and re-ground them at runtime. AgentSPEX [3] pushes that logic into the framework layer by making control flow, loops, branches, state, and verification explicit rather than hidden in a giant system prompt.

The disagreement is about where adaptability should live. CoEvolve [4] bets on **closed-loop learning**: let rollout failures, uncertainty, and forgetting generate new training tasks, then update the agent and its data distribution together. AlphaEval [5] is a useful counterweight because it implies that a lot of “improvement” disappears once you test whole products on messy, expert-judged, long-horizon work instead of clean benchmark tasks. My bet: structured retrieval and explicit workflows are the near-term trend to build on; broad claims from synthetic training loops are worth watching, but only if they survive production-style evaluation.

## What to steal

- **Split working memory from consolidated memory.** Keep recent events in a short-lived interaction graph. Promote facts into longer-lived topical memory only on semantic shift, not every turn. This is the core anti-interference move in GAM [1].
- **Cache planning as reusable atoms.** Run search or expensive exploration offline, distill successful traces into de-lexicalized state-goal-action snippets, then retrieve them as hints at inference time. Copy the SGA-MCTS [2] pattern if your agent solves recurring task families.
- **Make workflow state first-class.** Write branches, loops, retries, checkpoints, and verification as explicit steps instead of burying them in prompt prose. AgentSPEX [3] is the cleanest articulation here, and the visual editor plus harness matters as much as the language.
- **Train on your failures, not just your benchmark.** Extract uncertainty, forgetting, and recurrent failure patterns from trajectories; synthesize tasks that hit those weak spots; validate them through environment interaction before adding them back into training. That is the actionable piece from CoEvolve [4].
- **Evaluate the product, not the model.** Mix LLM-as-a-judge, rubric scoring, formal checks, UI testing, and domain review. Build tasks from real requirements with implicit constraints. AlphaEval [5] is the reminder that agent quality is often hidden in orchestration and tooling, not base-model deltas.

## The papers

- **GAM** [1] is the memory-system pick because it does more than add a database behind the model. The mechanism is a two-layer graph: an event progression graph for live context and a topic associative network for stable knowledge, with consolidation triggered by semantic shifts and retrieval guided by graph structure plus multiple relevance factors. Next to SGA-MCTS [2], it shows the same architectural instinct: pre-structure experience so runtime reasoning can stay cheap and precise.

- **SGA-MCTS** [2] is the planning pick to read first if your agents repeatedly face the same shape of task. Its real contribution is to turn MCTS trajectories into reusable, de-lexicalized State-Goal-Action atoms and then use hybrid symbolic-semantic retrieval to re-ground those atoms as soft hints online, which is a much more deployable pattern than live tree search on every request. Paired with GAM [1], it points to a broader recipe: compile expensive cognition into retrievable artifacts.

- **AgentSPEX** [3] matters because it treats agent workflows as something you can author, inspect, and maintain independently of Python glue code. Typed steps, explicit branching and loops, parallel execution, reusable submodules, checkpointing, verification, logging, and a sandboxed harness together make agent behavior more debuggable than reactive prompting or framework-specific code graphs. Compared with GAM [1] and SGA-MCTS [2], this is the control-plane version of the same shift toward explicit state.

- **CoEvolve** [4] is the most useful learning paper here because it avoids the usual static-dataset trap. It uses rollout signals like forgetting and uncertainty to synthesize new tasks, validates those tasks in the environment, and then updates the training distribution in lockstep with the agent; on AppWorld and BFCL it reports absolute gains of **19.43%**, **15.58%**, and **18.14%** across Qwen2.5-7B, Qwen3-4B, and Qwen3-30B-A3B. Put beside AlphaEval [5], the key question is whether this kind of adaptive training improves the actual shipped system rather than just the lab loop.

- **AlphaEval** [5] is the benchmark pick because it evaluates complete agent products on **94 tasks** sourced from **seven companies** across **six O*NET domains**, instead of isolated model tasks with tidy metrics. The mechanism worth copying is the requirement-to-benchmark pipeline: start from real production requirements, preserve implicit constraints and heterogeneous inputs, and combine multiple evaluation paradigms rather than forcing everything into one scalar score. It is the paper that keeps the other four honest.

