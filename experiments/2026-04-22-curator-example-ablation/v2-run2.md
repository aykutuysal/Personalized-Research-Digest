# openai/gpt-5.4 — v2-run2

```json
{
  "ok": true,
  "label": "v2",
  "run": 2,
  "ms": 27601,
  "cost": 0.025254,
  "totalTokens": 16515,
  "inputTokens": 15102,
  "outputTokens": 1413,
  "referenceIds": [
    "W7154716487",
    "W7154458881",
    "W7154537784",
    "W7155011363",
    "W7154789938"
  ],
  "bodyChars": 6743
}
```

## body

## The big picture

The field is moving away from agents that *reason in one long prompt* and toward agents that externalize competence into things you can cache, retrieve, evaluate, and govern. Across these picks, the common move is to shift capability out of hidden chain-of-thought and into explicit artifacts: state-goal-action atoms for planning [1], graph-structured memory [2], production-grounded eval tasks [3], hardened memory-safety benchmarks [4], and typed workflow/runtime layers [5]. That is a better fit for real stacks: cheaper to run, easier to debug, and much less dependent on hoping the base model improvises well under pressure.

## Where things are converging

Three technique lines are starting to meet.

First, **amortized reasoning** is getting more concrete. SGA-MCTS turns expensive search into an offline asset library of de-lexicalized State-Goal-Action atoms, then uses hybrid symbolic-semantic retrieval at runtime [1]. That is the strongest signal here: if a planning problem repeats even loosely, store reusable causal fragments instead of paying for fresh tree search every turn.

Second, memory is being treated as a systems problem, not a context-window problem. GAM separates short-term event progression from longer-term topic association, then retrieves with graph-guided multi-factor search [2]. MemEvoBench pushes on the uncomfortable side of the same design space: once memory persists across sessions, biased updates and noisy tool returns become a first-class failure mode, and prompt-only defenses stop working [4]. The trend to bet on is **structured memory with explicit consolidation rules**. The trend to watch skeptically is “just save everything and summarize later.”

Third, tooling around agents is getting less toy-like. AlphaEval evaluates *complete agent products* on messy company tasks with mixed scoring methods rather than clean benchmark prompts [3]. AgentSPEX makes workflow structure explicit with typed steps, branching, loops, checkpointing, and a harness instead of burying orchestration in Python glue and prompt text [5]. Together they point to a stack where the agent is no longer a single prompt template but a compiled workflow plus runtime plus eval surface.

If only one thing sticks: **the winning agent stack is becoming retrieval-heavy, stateful, and inspectable rather than bigger-prompt, bigger-model, and hope-driven**.

## What to steal

- **Cache planning traces as reusable units, not full transcripts.** SGA-MCTS’s useful trick is de-lexicalization: store patterns like `state -> subgoal -> action` with slots, then re-ground at runtime [1]. If you already log trajectories, try post-processing them into typed plan atoms instead of dumping raw conversations into a vector DB.

- **Split memory ingestion from memory consolidation.** GAM’s design pattern is worth copying directly: keep a volatile event stream for what just happened, and only promote items into durable topic memory when a semantic shift or stability threshold is met [2]. That reduces both retrieval noise and long-session drift.

- **Test memory with adversarial updates, not just recall tasks.** MemEvoBench’s setup suggests a practical harness: mix benign notes with misleading tool outputs, biased user feedback, and stale facts across many turns, then measure behavior drift rather than single-turn error [4]. This is a better pre-prod test for assistants with persistent user memory.

- **Evaluate the assembled product, not the model in isolation.** AlphaEval mixes rubric scoring, formal checks, UI tests, and expert judgment across production-style tasks [3]. For your own stack, that means evaluating planner + tool layer + retrieval + guardrails together, because that combination often fails in ways model-only benchmarks never expose.

- **Move workflow logic out of ad hoc code paths.** AgentSPEX’s typed steps, explicit state, loops, and checkpointing are the practical pattern [5]. Even if you do not adopt a DSL, the takeaway is to represent branches, retries, verifier calls, and tool contracts as data, so you can diff, test, and visualize them.

## The papers

- **SGA-MCTS: Decoupling Planning from Execution via Training-Free Atomic Experience Retrieval** builds a nice bridge between search-based planning and runtime speed [1]. The mechanism is not “MCTS at inference,” but using offline MCTS to mine reusable State-Goal-Action atoms, then retrieving and re-grounding those atoms as soft hints online. Next to GAM, it suggests a broader pattern: experience should be stored in structured, compressed forms rather than as raw chat history [2].

- **GAM: Hierarchical Graph-based Agentic Memory for LLM Agents** tackles the interference problem that shows up when long-term memory is just a single append-only stream [2]. Its key move is architectural separation: an event progression graph captures ongoing local context, while a topic associative network holds consolidated knowledge, with promotion happening around semantic shifts and retrieval guided by graph structure. Read alongside MemEvoBench, it looks less like a recall optimization and more like a safety design choice [4].

- **AlphaEval: Evaluating Agents in Production** matters because it evaluates real agent products on real company tasks, not benchmark-style stand-ins [3]. The contribution is the construction framework as much as the benchmark itself: turning authentic requirements into executable evals with mixed judging paradigms, including UI testing, rubric-based review, and formal verification where possible. It complements AgentSPEX well: explicit workflows are much easier to evaluate reproducibly than prompt spaghetti [5].

- **MemEvoBench: Benchmarking Memory MisEvolution in LLM Agents** gives a failure model that a lot of persistent-agent stacks are currently missing [4]. Instead of asking whether agents can remember, it asks what happens when memory updates are gradually poisoned by misleading information, noisy tools, or biased feedback over multi-round interactions. That makes it the right counterweight to papers like GAM: better memory architecture is useful, but only if you also test how that memory goes wrong under accumulation [2].

- **AgentSPEX: An Agent SPecification and EXecution Language** is one of the cleaner attempts to separate orchestration from prompt craft and framework-specific Python code [5]. The useful mechanism is the combo of typed workflow steps, explicit state, reusable modules, parallel branches, and an execution harness with sandboxing, verification, logging, and checkpointing. In the context of AlphaEval, this is the kind of substrate that makes agent behavior inspectable enough to benchmark seriously and stable enough to ship [3].
