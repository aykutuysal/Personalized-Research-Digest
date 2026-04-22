# openai/gpt-5.4 — new-run1

```json
{
  "ok": true,
  "label": "new",
  "run": 1,
  "ms": 22852,
  "cost": 0.02402,
  "totalTokens": 16817,
  "bodyChars": 5895
}
```

## body

## The big picture

The move across these picks is **turning agent capability from one-shot prompting into explicit infrastructure**. The common problem is no longer “can the model reason?” but “what gets cached, retrieved, delegated, evaluated, and blocked as the agent runs for hours instead of one turn?” The strongest work here replaces raw chain-of-thought dependence with memory graphs, reusable planning fragments, production-grounded evals, adaptive training loops, and workflow languages that make the agent legible enough to improve [1][2][3][4][5].

## Where things are converging

The clearest convergence is on **amortization**: do expensive work once, then reuse it cheaply. GAM [1] amortizes long-horizon context into a two-layer memory graph. SGA-MCTS [2] amortizes offline tree search into reusable planning snippets with task-specific words stripped out. CoEvolve [3] amortizes failures into new training data by mining forgetting and uncertainty from rollouts and synthesizing follow-up tasks. AgentSPEX [5] does the software version of the same move: pull workflow logic out of prompts and into typed, inspectable control flow.

The bet to place: structured external state beats ever-larger prompts. The disagreement is about where structure should live. GAM [1] puts it in memory consolidation and retrieval. SGA-MCTS [2] puts it in a retrieval layer over search-derived action atoms. AgentSPEX [5] puts it in the workflow itself. I’d watch broad claims about benchmark wins with skepticism when the mechanism is underspecified; AlphaEval [4] is useful precisely because it pushes evaluation back toward messy products, implicit requirements, and expert judgment instead of tidy benchmark tasks.

## What to steal

- **Split short-term events from consolidated memory.** Keep an append-only event log for fresh interaction state, and only promote facts into a topic graph when the conversation actually shifts topics. That is the core pattern in GAM [1], and it is a practical fix for memory interference in agents that revisit the same user or task over time.
- **Precompute reusable planning fragments offline.** Run an offline tree search on representative tasks, strip entity-specific tokens into slots, and store state-goal-action fragments for retrieval at runtime. SGA-MCTS [2] is the cleanest recipe here: pay the search cost once, then use retrieval as soft planning hints instead of searching on every request.
- **Mine your own failure cases into new tasks.** Log uncertainty, repeated mistakes, and forgotten constraints from rollouts, then synthesize fresh tasks targeting those exact failure modes. CoEvolve [3] shows this loop can move real agent benchmarks by 19.43%, 15.58%, and 18.14% across three base models on AppWorld and BFCL [3].
- **Evaluate the product, not the model.** Build tasks from real requirements, leave implicit constraints in place, and score with the mix that fits the domain: rubric judging, automated UI tests, formal checks, expert review. AlphaEval [4] is a good reminder that agent regressions often live in orchestration, context handling, and deliverable quality, not just model choice.
- **Write the agent as a workflow, not a mega-prompt.** Use typed steps, explicit state, branches, loops, and checkpointing. AgentSPEX [5] adds a useful extra pattern: keep a graph editor and text spec in sync so debugging and iteration do not require spelunking through Python or prompt templates.

## The papers

**GAM** [1] builds memory as two connected layers: an event progression graph for fresh dialogue state and a topic associative network for consolidated knowledge. The key mechanism is delaying consolidation until semantic shifts occur, plus graph-guided retrieval using multiple signals, which is a more actionable design than “long-term memory” as a single vector store. Next to SGA-MCTS [2], it tackles the same scaling problem from the memory side rather than the planning side.

**SGA-MCTS** [2] turns planning into retrieval. Offline tree search explores trajectories, distills them into reusable State-Goal-Action atoms, then a runtime retriever pulls the closest atoms back in as soft hints for a frozen model. The practical idea is strong: instead of fine-tuning or paying search latency every time, cache reusable causal structure. It pairs naturally with GAM [1]: one stores what happened, the other stores how to act.

**CoEvolve** [3] is the pick to read first if you care about making agents better without hand-curating endless new datasets. It closes the loop between agent behavior and training data: failures in rollouts trigger task synthesis, synthesized tasks are validated in the environment, and the data distribution moves with the agent. The reported gains — 19.43%, 15.58%, and 18.14% on Qwen2.5-7B, Qwen3-4B, and Qwen3-30B-A3B — are big enough to matter because they come from a mechanism you can imitate in your own eval-and-retrain pipeline [3].

**AlphaEval** [4] matters because it evaluates complete agent products on 94 tasks from seven companies rather than pretending curated benchmark tasks are production. The useful contribution is the construction pipeline: turn real requirements into executable evals quickly, then mix scoring methods instead of forcing one metric onto everything. Keep this next to CoEvolve [3]: one tells you what to train on, the other tells you how to find what is actually broken.

**AgentSPEX** [5] is the most directly stealable tooling paper in the set. It gives you a workflow language with typed steps, branching, loops, parallel execution, explicit state, a sandboxed harness, checkpointing, verification, logging, and a visual editor. Compared with the other picks, it is the control-plane answer: if GAM [1] structures memory and SGA-MCTS [2] structures planning, AgentSPEX [5] structures the agent itself so those parts remain inspectable and maintainable.
