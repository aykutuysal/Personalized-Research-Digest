# openai/gpt-5.4 — builder-situated-run3

```json
{
  "ok": true,
  "label": "builder-situated",
  "run": 3,
  "ms": 26143,
  "cost": 0.051859,
  "totalTokens": 16407,
  "inputTokens": 15148,
  "outputTokens": 1259,
  "referenceIds": [
    "W7154716487",
    "W7154458881",
    "W7154789938",
    "W7154537784",
    "W7155011363"
  ],
  "bodyChars": 5984
}
```

## body

## The big picture

The useful question in this pool is not whether agents can do more. It is **which parts of the stack are worth hardening or restructuring before you add more capability**. These five papers mostly land on the same answer: stop treating planning, memory, evaluation, and workflow definition as one opaque prompt, and start turning them into explicit artifacts you can inspect, retrieve, benchmark, and govern [1][2][3][4][5].

## Where things are converging

The strongest convergence is around **externalizing agent cognition**.

Instead of asking the model to improvise long-horizon behavior from scratch each run, several picks push reusable structure outside the forward pass. *SGA-MCTS* turns search trajectories into de-lexicalized State-Goal-Action atoms that can be retrieved later [1]. *GAM* separates fast event capture from slower graph consolidation, then uses graph-guided retrieval instead of dumping a flat memory stream back into context [2]. *AgentSPEX* does the same move for orchestration: explicit control flow, typed steps, loops, parallel branches, and state, rather than “one giant system prompt plus tools” [3].

The disagreement is about where to spend complexity. One camp says put it into better internal scaffolding for the agent — memory structure and reusable planning atoms [1][2]. Another says your biggest bottleneck is the surrounding system: production-grounded evaluation and maintainable workflow specs [3][4]. I’d bet on both of those before betting on more clever prompt chains. The paper to watch with skepticism is any approach that claims robust long-horizon behavior without a corresponding artifact you can inspect after the run. *MemEvoBench* is the warning sign here: static prompt defenses were insufficient once memory drift was introduced across multi-round interactions, 7 domains, and 36 risk types [5].

## What to steal

- **Cache search as reusable planning atoms.** Run heavier search or successful trajectories offline, abstract them into de-lexicalized state-goal-action snippets, and retrieve them as hints at inference time instead of paying full search cost on every task [1].

- **Split memory into “what just happened” and “what has earned consolidation.”** Keep recent interaction state in an event graph. Only promote it into a topic-level long-term memory when a semantic shift happens. That is the core anti-interference trick in GAM [2].

- **Author workflows as code-like specs, not prompt folklore.** Put branching, loops, parallel steps, and explicit state into a typed workflow layer. AgentSPEX’s main practical idea is that orchestration logic should be editable and inspectable without spelunking through Python callbacks and nested prompts [3].

- **Benchmark the product, not just the model.** Evaluate the actual assembled agent system on messy, under-specified tasks using mixed paradigms: rubric scoring, formal checks, UI tests, and judge models. AlphaEval’s move from model-centric eval to product-centric eval is the part worth copying [4].

- **Test memory safety as a trajectory problem.** Inject misleading memories, noisy tool returns, and biased feedback over many turns. Do not trust a one-shot jailbreak or prompt-injection suite to tell you whether your persistent agent is safe after session 12 [5].

## The papers

**SGA-MCTS** [1] is the most directly useful planning paper here because it converts expensive deliberation into a retrieval problem. Offline MCTS generates high-fidelity trajectories, then the system distills them into de-lexicalized SGA atoms that preserve causal structure while stripping domain-specific surface form; online, a hybrid symbolic-semantic retriever re-grounds those atoms as soft hints. Next to GAM, it suggests a broader pattern: don’t just retrieve documents or chat history — retrieve compressed operational experience.

**GAM** [2] is the cleanest memory architecture in the set. The mechanism is a two-level graph: an event progression graph for ongoing dialogue and a topic associative network for consolidated long-term knowledge, with promotion only on semantic shifts. That design directly addresses the failure mode MemEvoBench exposes — transient noise and biased updates contaminating persistent state — while also giving you a more precise retrieval surface than a monolithic memory buffer.

**AgentSPEX** [3] matters if your current agent stack feels harder to maintain than the task it automates. Its contribution is not “another framework,” but a specification language with typed steps, branching, loops, parallel execution, reusable submodules, explicit state management, plus an execution harness with sandboxing, checkpointing, verification, and logging. Read it next to AlphaEval: if you want production evaluation to mean anything, your workflows need to be explicit enough to observe and replay.

**AlphaEval** [4] is the evaluation pick because it measures complete agent products on 94 tasks from seven companies instead of giving yet another sanitized benchmark of neat, deterministic tasks. The mechanism worth borrowing is the requirement-to-benchmark pipeline: take real production requirements with implicit constraints and heterogeneous inputs, then turn them into executable tasks scored by multiple paradigms. It pairs naturally with AgentSPEX and GAM: explicit workflows and explicit memory structures are much easier to evaluate than vibes-driven agents.

**MemEvoBench** [5] is the reliability check that keeps the rest of the stack honest. It is the first benchmark focused on memory misevolution, with QA-style tasks across 7 domains and 36 risk types plus workflow tasks adapted from 20 Agent-SafetyBench environments, all using mixed benign and misleading memory pools over multi-round interactions. The practical takeaway next to GAM is straightforward: if you are adding persistent memory, you need tests for behavioral drift under contaminated updates, because prompt-only defenses did not hold up.
