# openai/gpt-5.4 — v2-run1

```json
{
  "ok": true,
  "label": "v2",
  "run": 1,
  "ms": 26750,
  "cost": 0.024519,
  "totalTokens": 16466,
  "inputTokens": 15102,
  "outputTokens": 1364,
  "referenceIds": [
    "W7154716487",
    "W7154458881",
    "W7154789938",
    "W7154537784",
    "W7155011363"
  ],
  "bodyChars": 6420
}
```

## body

## The big picture

The field is shifting from “make the agent reason harder” to **make the agent system more explicit**: explicit memory structure, explicit workflow control flow, explicit production evals, explicit retrieval primitives, explicit safety boundaries. The common move across these picks is to stop treating the prompt as the architecture and start pushing reusable behavior into inspectable artifacts—graphs, atoms, policies, and executable specs—so agent quality depends less on one lucky trajectory and more on what the system can store, retrieve, verify, and replay [1][2][3][4][5].

## Where things are converging

The strongest convergence is around *amortization*. SGA-MCTS turns expensive search into a library of de-lexicalized State-Goal-Action atoms that can be retrieved at inference time [1]. GAM does something similar for long-horizon interaction, separating fast event capture from slower consolidation into a topic graph so memory retrieval stops competing with every fresh token [2]. AgentSPEX applies the same instinct at the framework layer: instead of burying branching, loops, and state transitions in prompts and Python glue, it promotes them into a typed workflow language with checkpointing and verification hooks [3].

The second trend is that evaluation is getting closer to deployment. AlphaEval stops benchmarking raw models and scores complete agent products on messy, multi-source, expert-judged tasks that look more like real ops queues than benchmark puzzles [4]. MemEvoBench does the same for persistent memory, showing that long-session agents do not just fail once—they **drift** as poisoned memory, noisy tool outputs, and biased feedback accumulate over time [5].

What to bet on: retrieval-backed agent architectures that convert prior compute into reusable structures. The concrete forms differ—graph memory in [2], atomic plan retrieval in [1], typed workflow specs in [3]—but they all reduce dependence on brittle one-shot prompting.

What to watch with skepticism: any claim that stronger prompts or static system instructions are enough to stabilize a long-lived agent. MemEvoBench is the clearest warning shot here: once memory updates become the attack surface, prompt-only defenses stop being a serious answer [5].

## What to steal

- **Cache reasoning as reusable atoms, not full transcripts.** Distill successful trajectories into de-lexicalized state-goal-action chunks, then retrieve by symbolic state plus semantic similarity at runtime. This is the practical insight from SGA-MCTS: you want reusable causal structure, not verbose chain-of-thought logs [1].
- **Split memory into “working events” and “consolidated knowledge.”** Keep fresh interaction traces in an event graph, and only fold them into a higher-level topic graph when a semantic shift happens. That gives you fewer retrieval collisions and less contamination from transient noise [2].
- **Move orchestration out of prompts.** If your agent has branches, retries, approval gates, parallel calls, or resumability requirements, encode them in a workflow spec instead of natural language instructions. AgentSPEX’s typed steps and explicit state are a good pattern even if you never adopt the language itself [3].
- **Add a drift test, not just a task-success test.** Run multi-round evals where the agent must survive misleading memory writes, noisy tool returns, and biased feedback over time. A system that looks fine on single-session benchmarks can still slowly corrupt itself in production [5].
- **Evaluate the whole product path.** Pull a small set of real tasks from your stack—documents, UI actions, implicit constraints, expert review—and score the shipped agent end to end. AlphaEval’s main lesson is that model eval and product eval diverge earlier than most teams expect [4].

If only one thing sticks: **store less raw history and more reusable structure**—that is where reliability, latency, and maintainability are starting to compound.

## The papers

- **SGA-MCTS** builds a planning system around offline search distillation rather than online deliberation. It uses MCTS to generate high-quality trajectories, compresses them into de-lexicalized SGA atoms, then retrieves and re-grounds those atoms as soft hints at inference time; next to GAM, it is the clearest example of turning expensive agent cognition into a reusable substrate instead of paying the full planning bill on every run [1].

- **GAM** proposes a two-level memory design: an event progression graph for immediate context and a topic associative network for consolidated long-term knowledge. The important mechanism is the consolidation trigger on semantic shift plus graph-guided retrieval, which makes it feel less like “chat history with vector search” and more like a memory manager; paired with MemEvoBench, it also suggests a cleaner place to insert trust and validation checks before memory hardens [2][5].

- **AgentSPEX** is useful because it treats the agent as a program with typed steps, loops, branches, explicit state, and a harness that handles tools, sandboxing, checkpointing, verification, and logging. Compared with the retrieval-centric papers, this is the workflow counterpart: if [1] and [2] externalize knowledge, [3] externalizes control flow, which is exactly what starts to matter once agents become team-maintained systems instead of demos [3].

- **AlphaEval** contributes less a new agent mechanism than a better target for what to optimize. Its real build insight is the requirement-to-benchmark pipeline: turning production requirements into executable eval tasks that combine judge models, reference metrics, formal checks, UI tests, and expert rubrics; that sits naturally beside AgentSPEX and SGA-MCTS because both become much easier to tune once you are measuring the shipped workflow rather than a sandbox proxy [3][4].

- **MemEvoBench** focuses on the failure mode many memory-heavy agent stacks still under-test: behavior degradation caused by memory evolution rather than immediate jailbreaks or one-step tool errors. By mixing benign and misleading memories across long-horizon QA and workflow settings, it shows that poisoned updates, noisy tools, and biased feedback can bend an agent off course gradually, which makes it a useful counterweight to GAM: better memory structure helps, but memory itself needs ongoing governance and adversarial evaluation [2][5].
