# openai/gpt-5.4 — builder-run1

```json
{
  "ok": true,
  "label": "builder",
  "run": 1,
  "ms": 21829,
  "cost": 0.022623,
  "totalTokens": 15997,
  "inputTokens": 14760,
  "outputTokens": 1237,
  "referenceIds": [
    "W7154716487",
    "W7154458881",
    "W7154971597",
    "W7154537784",
    "W7154789938"
  ],
  "bodyChars": 5878
}
```

## body

## The big picture

The move across these picks is away from “just give the model more context and hope” and toward **explicit external structure**: retrieved planning atoms, graph memory, production-grounded eval, executable workflow specs, and closed-loop data generation. The field is treating agent quality less as a prompting problem and more as a systems problem — what to cache, what to retrieve, what to formalize, and how to measure failure under conditions that actually look like deployment [1][2][3][4][5].

## Where things are converging

The clearest convergence is on *amortization*. Instead of paying full reasoning cost at runtime, two papers cache useful structure ahead of time: SGA-MCTS stores de-lexicalized **State-Goal-Action atoms** discovered by search and reuses them as soft hints at inference time [1], while GAM separates fast event capture from slower graph consolidation so long-horizon memory stays queryable without turning into a noisy append-only log [2]. CoEvolve pushes the same idea into training: rather than hand-curating tasks once, it harvests uncertainty and forgetting from rollouts to synthesize the next batch of useful failures [3].

There is also a strong shift from toy eval to *product eval*. AlphaEval is the best signal here: complete agent products are judged on messy, implicit, multi-source work from real companies, not clean benchmark prompts [4]. AgentSPEX tackles the adjacent engineering problem from the other side: if you want reproducible agent behavior, put control flow, state, loops, and checkpoints into a dedicated spec instead of burying them in Python callbacks and prompt text [5].

The disagreement to watch is where to put the intelligence. One camp bets on runtime search and adaptation, but the stronger signal in this set is to bet on **offline structure plus lightweight online retrieval**. SGA-MCTS argues you can get search-depth behavior from frozen models by retrieving reusable atoms rather than re-running search every time [1]. GAM makes a similar case for memory: structure first, retrieval second [2]. What to watch skeptically is any agent stack that still treats long-horizon reasoning as a single monolithic context window with a planner prompt on top; these papers keep showing that explicit representations outperform raw accumulation.

## What to steal

- **Cache planning traces as reusable primitives.** If your agent solves a class of tasks repeatedly, store trajectories as de-lexicalized state-goal-action chunks rather than full transcripts. Retrieve them with a hybrid symbolic + semantic matcher and inject them as hints, not hard constraints [1].
- **Split memory into write-fast and consolidate-slow layers.** Keep a temporary event graph for recent interactions, and only merge into a more stable topic graph when a semantic shift is detected. That reduces interference from transient junk while preserving long-run continuity [2].
- **Generate training tasks from rollout pain, not from imagination alone.** Track where the agent shows uncertainty, forgets prior facts, or loops. Use those traces to synthesize new tasks, validate them in-environment, then feed them back into training. That is a much better curriculum source than static benchmark leftovers [3].
- **Evaluate the whole product, not just the model.** Mix judge-based grading, reference metrics, UI testing, and formal checks against tasks with implicit requirements and fragmented inputs. If your internal evals are still single-turn and fully specified, they are probably overstating readiness [4].
- **Move orchestration out of ad hoc code.** Define loops, branches, parallel blocks, typed state, and verification steps in a workflow language or DSL-like layer. Even if you do not adopt AgentSPEX itself, the pattern is worth copying because it makes edits, inspection, and checkpointing much easier [5].

## The papers

- **SGA-MCTS** builds a retrieval-based alternative to online planning: use offline MCTS to mine high-quality trajectories, compress them into abstract SGA atoms, then retrieve and re-ground them during execution [1]. The useful idea is not just “MCTS helps,” but that search can be turned into a reusable artifact, which pairs naturally with the memory and workflow papers here instead of competing with them.

- **GAM** implements memory as two linked graphs: an event progression graph for ongoing interaction and a topic associative network for consolidated knowledge, with graph-guided retrieval over both [2]. Relative to SGA-MCTS, it does for long-term context what planning atoms do for reasoning — preserve reusable structure while filtering away local noise.

- **CoEvolve** closes the training loop by extracting failure signals from agent rollouts, synthesizing tasks that target those weak spots, validating them through environment interaction, and then updating the training distribution accordingly [3]. Next to AlphaEval, it suggests a practical recipe: production-like failures should not just be measured; they should become the source of the next curriculum.

- **AlphaEval** is valuable because it evaluates full agent systems on 94 tasks pulled from seven companies, with heterogeneous artifacts, implicit constraints, and expert-defined success criteria [4]. That makes it a good counterweight to papers that report clean benchmark wins: if your architecture gains do not survive this kind of evaluation, they are probably overfit to simplified tasks.

- **AgentSPEX** contributes an execution language and harness with typed steps, branching, loops, parallelism, explicit state, checkpointing, verification, logging, and a visual editor [5]. In this set, it is the “make it operable” paper: once you start using graph memory, planning retrieval, and richer eval, you need a workflow layer that exposes control flow instead of hiding it inside prompt spaghetti.
