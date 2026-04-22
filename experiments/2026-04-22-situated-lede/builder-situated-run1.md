# openai/gpt-5.4 — builder-situated-run1

```json
{
  "ok": true,
  "label": "builder-situated",
  "run": 1,
  "ms": 28176,
  "cost": 0.054709,
  "totalTokens": 16597,
  "inputTokens": 15148,
  "outputTokens": 1449,
  "referenceIds": [
    "W7154716487",
    "W7154458881",
    "W7154789938",
    "W7154537784",
    "W7154971597"
  ],
  "bodyChars": 6770
}
```

## body

## The big picture

The practical question underneath this pool is not whether agents can do more, but **which parts of the stack are finally becoming reusable** instead of bespoke: planning, memory, evaluation, and workflow control. If you're deciding what to harden in an agent system this month, these picks point to a concrete direction: stop baking intelligence into one giant prompt, and start externalizing it into retrievable planning atoms, structured memory, explicit workflow specs, and production-shaped evals [1][2][3][4][5].

## Where things are converging

The common move across the strongest papers is **amortization**. Instead of asking the model to solve every hard step from scratch at inference time, they precompute or structure something reusable: SGA-MCTS stores de-lexicalized State-Goal-Action atoms discovered by MCTS and retrieves them online as soft reasoning hints [1]; GAM splits short-term event flow from consolidated topic memory in a hierarchical graph [2]; AgentSPEX turns agent control flow into an explicit language with typed steps, loops, branching, and state [3].

That trend is worth betting on. It gives you more control than pure reactive prompting, and it avoids the latency and brittleness of running full search every time. The disagreement is in where to put the abstraction boundary. SGA-MCTS pushes planning into offline search plus retrieval [1]. GAM pushes continuity into memory consolidation and graph-guided retrieval [2]. AgentSPEX pushes behavior into a workflow layer you can inspect and modify without rewriting Python orchestration logic [3]. AlphaEval is the reality check: model-level wins often disappear when the full agent product meets ambiguous requirements, heterogeneous inputs, and expert judgment in the loop [4].

The one skepticism signal to keep: some papers promise better reasoning by adding more internal machinery, but the stronger evidence here comes from systems that make that machinery inspectable. The benchmark paper in this set is valuable precisely because it evaluates complete products like Claude Code and Codex on 94 production tasks from seven companies, using mixed evaluation modes rather than a single toy metric [4]. If a technique cannot survive that kind of setup, it is still a lab trick.

## What to steal

- **Cache search as retrieval, not weights.** Run expensive exploration offline, distill trajectories into reusable abstractions, and retrieve them at runtime. SGA-MCTS's SGA atoms are a good pattern because they de-lexicalize entities into symbolic slots, which keeps the causal pattern while dropping domain noise [1].

- **Separate event memory from stable knowledge.** Keep a volatile interaction graph for the current session and only consolidate into longer-lived topic memory when a semantic shift actually happens. That is the core design move in GAM, and it is a cleaner default than dumping everything into one append-only memory stream [2].

- **Specify workflows as artifacts, not code side effects.** Use explicit typed steps, branches, loops, parallel blocks, and state transitions. AgentSPEX is interesting less as a new DSL than as a reminder that maintainability improves when agent behavior is inspectable, checkpointable, and editable outside your app code [3].

- **Evaluate the product you ship, not the model you bought.** Build evals from real requirements with hidden constraints, mixed modalities, long-horizon deliverables, and domain-expert judgment. AlphaEval's requirement-to-benchmark pipeline is the steal here, not just the benchmark itself [4].

- **Treat data generation as part of agent training.** CoEvolve extracts forgetting and uncertainty signals from rollouts, synthesizes new tasks with an LLM, validates them in the environment, and updates the data distribution in a closed loop [5]. If your agent plateaus, fix the task distribution before you reach for another round of prompt surgery.

## The papers

**SGA-MCTS** is the pick to read first because it offers a practical answer to the planning trade-off: do the expensive search once, then turn the result into reusable retrieval objects [1]. The key mechanism is the State-Goal-Action atom: a de-lexicalized primitive produced offline by MCTS, then fetched online through a hybrid symbolic-semantic retriever and re-grounded into the current task. Next to GAM, it is the planning-side version of the same instinct—structure what the model should remember so runtime stays fast and controllable [1][2].

**GAM** is a solid memory architecture paper because it names a concrete failure mode—interference between transient context and durable knowledge—and fixes it with an explicit two-level graph [2]. Ongoing dialogue lives in an event progression graph; only semantically shifted material is consolidated into a topic associative network, then retrieved with a graph-guided multi-factor strategy. Compared with SGA-MCTS, GAM is less about reusable plans and more about preventing your long-lived agent from poisoning itself with session noise [1][2].

**AgentSPEX** tackles a different bottleneck: workflow logic disappearing into prompts and Python glue code [3]. Its contribution is an execution language with typed steps, loops, branching, parallel execution, reusable submodules, explicit state, plus a harness for sandboxing, verification, checkpointing, and logging. Alongside GAM and SGA-MCTS, it gives you a third place to put structure—neither in weights nor prompts, but in a first-class workflow artifact you can inspect and version [1][2][3].

**AlphaEval** matters because it tests the thing builders actually deploy: complete agent products under messy production conditions [4]. The useful mechanism is the construction pipeline that converts authentic requirements into executable benchmark tasks with multiple judging paradigms, rather than pretending one score can capture professional work. It pairs well with AgentSPEX in particular: once your workflow is explicit, you can evaluate failures at the product level instead of arguing about prompt quality in the abstract [3][4].

**CoEvolve** is the learning pick because it closes the loop between agent behavior and the data used to improve it [5]. Instead of training on a static task set, it mines rollout failures using forgetting and uncertainty signals, synthesizes new tasks, validates them through environment interaction, and retrains on the updated distribution; the reported absolute gains are 19.43%, 15.58%, and 18.14% on AppWorld and BFCL across Qwen2.5-7B, Qwen3-4B, and Qwen3-30B-A3B [5]. Read it next to AlphaEval: one tells you how agents fail in production-shaped settings, the other suggests a mechanism for generating the next wave of training data from those failures [4][5].
