# openai/gpt-5.4 — v2d-run1

```json
{
  "ok": true,
  "label": "v2d",
  "run": 1,
  "ms": 23201,
  "cost": 0.0345085,
  "totalTokens": 16319,
  "inputTokens": 15025,
  "outputTokens": 1294,
  "referenceIds": [
    "W7154716487",
    "W7154479191",
    "W7154458881",
    "W7155011363",
    "W7154887694"
  ],
  "bodyChars": 6263
}
```

## body

## The big picture

The center of gravity is shifting from “make the agent reason harder” to **make the agent remember, retrieve, and execute under structure**. The strongest picks here all attack the same bottleneck from different sides: long-horizon agents fail less often when search is amortized into reusable artifacts, memory is consolidated instead of streamed, and the runtime gives you production-grade observability rather than hoping prompt glue holds under load [1][2][3][4][5].

## Where things are converging

Three technique lines are clearly meeting.

First, **retrieval is becoming planning infrastructure**, not just document lookup. SGA-MCTS turns offline search trajectories into de-lexicalized State-Goal-Action atoms that can be retrieved as reasoning hints at inference time [1]. NaviRAG does the same move for knowledge access: hierarchical records plus iterative navigation over coarse-to-fine evidence instead of one-shot chunk retrieval [2]. The common bet is that reusable structure beats repeated free-form deliberation.

Second, **memory is being treated as a systems problem**. GAM separates fast event capture from slower consolidation into a topic-associative graph, which is exactly the kind of split you want once an agent has to survive many sessions without drowning in transient noise [3]. MemEvoBench is the warning label on the other side: if memory updates are naive, the agent drifts under biased feedback, adversarial memory injection, and noisy tool returns, and static prompt defenses do not save it [4].

Third, **production reliability is moving down-stack into protocols and runtime patterns**. The MCP paper is less about benchmark wins than about the ugly stuff that breaks live agents: tool invocation reliability, context handling, backend boundaries, and failure modes you only notice after deployment [5]. That makes it a useful counterweight to more algorithmic papers. The trend to bet on is explicit structure: typed retrieval units, hierarchical memory, staged consolidation, protocolized tool calling. The trend to watch skeptically is any claim that more reasoning tokens alone will clean up long-horizon failures; these picks mostly say the opposite.

If only one thing sticks: build agents so they can **reuse structured experience safely** instead of recomputing judgment from raw context every turn [1].

## What to steal

- **Cache search as reusable atoms, not full traces.** SGA-MCTS’s best idea is de-lexicalizing successful trajectories into State-Goal-Action primitives, then re-grounding them online [1]. In a practical stack, that means storing plans as templates with slots (`entity_a`, `target_api`, `constraint`) rather than saving verbose scratchpads.

- **Split memory write paths.** Borrow GAM’s separation between an event progression graph and a more stable topic graph [3]. Put new observations into a volatile layer first; only promote them after semantic shift detection, repeated confirmation, or tool-backed verification.

- **Retrieve top-down before you retrieve deep.** NaviRAG’s hierarchical navigation pattern is a clean drop-in for agentic RAG [2]. Start with topic-level routing, then descend to specific evidence only when the current step exposes an information gap.

- **Test memory with poisoned updates, not just retrieval accuracy.** MemEvoBench’s setup is worth copying into internal evals: mix benign and misleading memories, inject noisy tool outputs, and measure drift over multiple rounds [4]. A memory subsystem that looks fine on static QA can still rot in deployment.

- **Treat MCP boundaries as product code, not orchestration boilerplate.** The enterprise MCP paper’s useful pattern is a structured tool-calling pipeline with explicit failure-mode handling around context, backend integration, and security boundaries [5]. If your agent calls tools through ad hoc wrappers, this is the week to formalize contracts and logging.

## The papers

- **SGA-MCTS** builds a retrieval-first planner by doing the expensive part offline: MCTS explores solution space, then the system distills successful trajectories into de-lexicalized SGA atoms that preserve causal structure while stripping task-specific surface details [1]. Online, the model stays frozen and uses hybrid symbolic-semantic retrieval to pull those atoms back in as soft hints, which makes it sit nicely between memory systems like GAM and retrieval stacks like NaviRAG rather than competing with them.

- **NaviRAG** replaces flat chunk retrieval with hierarchical knowledge records and an agent that actively navigates between granularity levels based on what it still does not know [2]. That makes it more than a better retriever: it is a control policy for evidence acquisition, and it pairs naturally with SGA-style planning because both reduce reasoning cost by turning prior structure into a reusable search scaffold.

- **GAM** introduces a hierarchical graph memory that decouples immediate encoding from consolidation: ongoing dialogue is tracked in an event graph, and only integrated into a topic-associative network when semantic shifts justify it [3]. The mechanism matters because it directly attacks interference, which is exactly the failure mode MemEvoBench later exposes when agents update memory indiscriminately.

- **MemEvoBench** is the most useful “don’t trust your demo” paper in the set: it benchmarks long-horizon memory safety under adversarial memory injection, biased feedback, and noisy tool returns across both QA-style and workflow-style tasks [4]. The key result is not just degradation; it is that prompt-level defenses stay brittle once the corruption is embedded into the agent’s own evolving memory, which should push builders toward gated writes and provenance-aware recall.

- **Model Context Protocol in Enterprise AI Systems** is the practical runtime paper here: it catalogs seven production failure modes in MCP-based deployments and ties mitigation to architectural patterns around structured tool calling, RAG, and memory integration [5]. Next to the other picks, its contribution is not new reasoning machinery but the operational layer that keeps those mechanisms debuggable once they touch real services, latency budgets, and security boundaries.
