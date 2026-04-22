# openai/gpt-5.4 — builder-run2

```json
{
  "ok": true,
  "label": "builder",
  "run": 2,
  "ms": 23265,
  "cost": 0.0577125,
  "totalTokens": 16430,
  "inputTokens": 15099,
  "outputTokens": 1331,
  "referenceIds": [
    "W7154458881",
    "W7154716487",
    "W7154971597",
    "W7154537784",
    "W7154789938"
  ],
  "bodyChars": 6136
}
```

## body

## The big picture

The field is moving away from “just let the model reason longer” and toward **agent systems that externalize competence into structure**: explicit memory layouts, retrieved planning atoms, production-grounded evals, and workflow languages you can actually inspect. Across these picks, the common move is to stop treating the agent as a monolith and instead make planning, memory, orchestration, and evaluation first-class system components [1][2][3][4][5].

## Where things are converging

The strongest convergence is on **amortization**. Instead of paying the full reasoning cost on every run, systems are starting to cache or compile useful experience into reusable forms: GAM splits short-term event tracking from consolidated topic memory [1]; SGA-MCTS distills search trajectories into de-lexicalized State-Goal-Action atoms that get retrieved as soft hints at runtime [2]; CoEvolve closes the loop by synthesizing new tasks from failure signals like forgetting and uncertainty, then retraining on those hard cases [3]. The shared bet: if you can preserve structure from prior interaction, you can get better long-horizon behavior without brute-forcing inference every time.

The second convergence is on **making the agent stack legible enough to engineer**. AlphaEval is valuable precisely because it scores complete products on 94 real tasks from seven companies rather than toy prompts [4]. AgentSPEX makes the same point from the build side: typed steps, branching, loops, parallel execution, explicit state, checkpointing, verification, and logging [5]. The disagreement to watch is where the reusable structure should live. GAM says “in memory graphs” [1]. SGA-MCTS says “in retrieved planning primitives” [2]. CoEvolve says “in the data curriculum” [3]. My bet: planning atoms plus explicit workflow control are the safest near-term bet; fully autonomous self-improving loops are promising, but they need production eval like AlphaEval before you trust the gains [2][3][4][5].

## What to steal

- **Separate event memory from consolidated memory.** Keep raw interaction traces in a short-lived event store, and only merge into a durable semantic graph when a topic shift or stable fact threshold is crossed. That is the core design move in GAM, and it is a better default than dumping every turn into one vector store [1].

- **Retrieve plans, not just documents.** Store successful trajectories as abstract State-Goal-Action templates with slots, then re-ground them into the current task. SGA-MCTS treats retrieval as a planning primitive, not a knowledge primitive. If your agent keeps solving the same shape of problem from scratch, copy this [2].

- **Generate training tasks from failure traces.** Log uncertainty spikes, forgotten constraints, and repeated dead ends. Turn those into new synthetic tasks, validate them in the real environment, then add them back into training. CoEvolve reports absolute gains of 19.43%, 15.58%, and 18.14% on AppWorld and BFCL across Qwen2.5-7B, Qwen3-4B, and Qwen3-30B-A3B using exactly this loop [3].

- **Evaluate the product, not the model.** Build task suites from actual requirements with mixed scoring modes: judge models, reference checks, formal verification, UI tests, and rubrics. AlphaEval’s framing is the useful part here: benchmark the whole agent system where hidden constraints and long-form deliverables show up, not just model skill in isolation [4].

- **Move orchestration logic out of Python glue.** Put control flow in a typed workflow layer with explicit state, branching, loops, parallel steps, sandboxing, checkpointing, and verification hooks. AgentSPEX is worth attention because this is how you make agents maintainable once the prototype turns into infrastructure [5].

## The papers

**GAM** [1] builds memory as two linked graph structures: an event progression graph for what is happening now, and a topic associative network for what deserves consolidation later. The mechanism that matters is the decoupling of encoding from consolidation plus graph-guided multi-factor retrieval; it sits nicely beside SGA-MCTS because both reject flat-context accumulation in favor of reusable structured state.

**SGA-MCTS** [2] does the expensive part offline. It uses Monte Carlo Tree Search to explore solution paths, compresses those paths into de-lexicalized State-Goal-Action atoms, and then retrieves the relevant atoms online with a symbolic-semantic matcher to provide soft reasoning hints. Compared with GAM’s memory graph, this is less about remembering facts and more about remembering how to act.

**CoEvolve** [3] is the most interesting learning-system pick here because it does not freeze the training distribution. It mines rollout traces for forgetting and uncertainty, uses those signals to drive LLM-based task synthesis, validates the synthesized tasks through environment interaction, and then updates the data distribution in a closed loop. Relative to SGA-MCTS, which compiles search into runtime retrieval, CoEvolve compiles failure into new training data.

**AlphaEval** [4] is the one to read first if you ship agents into actual workflows. Its contribution is not another benchmark leaderboard but a requirement-to-benchmark construction pipeline that turns real production requirements into executable tasks, then evaluates complete agent products across multiple scoring paradigms. Next to CoEvolve, this gives you the missing reality check: gains only matter if they survive messy inputs, implicit constraints, and expert judgment.

**AgentSPEX** [5] attacks the framework problem directly with a workflow language instead of more prompt scaffolding. Typed steps, loops, branching, parallel execution, reusable submodules, explicit state management, sandboxed execution, checkpointing, verification, logging, and a visual editor together make agent behavior inspectable and editable in a way Python-heavy orchestration often is not. Beside AlphaEval, it looks like the authoring counterpart to production eval: one helps you build legible agents, the other tells you whether those agents hold up in the wild.
