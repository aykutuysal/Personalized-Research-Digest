# openai/gpt-5.4 — builder-run3

```json
{
  "ok": true,
  "label": "builder",
  "run": 3,
  "ms": 22303,
  "cost": 0.022323,
  "totalTokens": 15977,
  "inputTokens": 14760,
  "outputTokens": 1217,
  "referenceIds": [
    "W7154716487",
    "W7154458881",
    "W7154971597",
    "W7154537784",
    "W7154789938"
  ],
  "bodyChars": 5803
}
```

## body

## The big picture

The center of gravity is shifting from “make the agent reason harder” to **make the runtime carry more of the intelligence**. These picks all attack the same failure mode from different angles: brittle long-horizon behavior when planning, memory, tools, and evaluation are all left to a single prompt loop. What’s changing is the stack shape: cached search priors, structured memory, production-grounded eval, explicit workflow languages, and closed-loop data generation are replacing one-shot prompting as the default way to get agents that hold up over time [1][2][3][4][5].

## Where things are converging

The common move is amortization. *SGA-MCTS* turns expensive search into reusable **State-Goal-Action atoms** that can be retrieved at run time instead of recomputed [1]. *GAM* does the same for memory by splitting fast event capture from slower graph consolidation, then retrieving through graph structure rather than raw transcript similarity [2]. *CoEvolve* amortizes failure analysis into future training data: it mines forgetting and uncertainty from rollouts, synthesizes tasks around those weak spots, validates them in the environment, and updates the training distribution in a loop [3].

The bet to make is on agents built around **structured intermediate assets**: graph memories, reusable planning atoms, typed workflows, and eval traces that can feed back into development. Those assets travel better across tasks than giant prompt templates. The skeptical watch item is “more agents = better agent.” *AlphaEval* is a useful corrective here: production tasks expose failures that clean academic tasks hide, and product-level differences show up even when underlying models look similar on standard benchmarks [4]. Structure helps, but only if you can measure it in the environments where the system will actually live. *AgentSPEX* fits this convergence because it externalizes control flow, state, branching, and verification instead of burying them in Python glue and prompts [5].

## What to steal

- **Cache search as reusable primitives, not full trajectories.** If you already run tree search or collect successful traces, distill them into de-lexicalized state-goal-action snippets and retrieve them as soft hints at inference time, rather than replaying whole demonstrations [1].
- **Split memory into “write fast, consolidate slow.”** Keep a lightweight event log for immediate context, then promote only semantically stable facts or topic shifts into a graph store. That reduces transcript noise and makes retrieval less fragile than naive long-term memory append-only schemes [2].
- **Mine your own eval failures into new tasks.** Add uncertainty and forgetting detectors over rollouts, cluster the bad cases, synthesize variants, and push only environment-validated examples back into training or regression suites [3].
- **Move workflow logic out of prompts and code comments.** Represent branching, retries, loops, checkpoints, and state explicitly in a workflow spec. You’ll get easier debugging, safer edits, and cleaner A/B tests on orchestration changes [5].
- **Benchmark the product, not just the model.** Pull tasks from real support queues, ops workflows, or customer deliverables; mix LLM judges with executable checks and UI tests; and track where the agent system fails end-to-end, not just whether the base model can answer a benchmark question [4].

## The papers

- *SGA-MCTS* builds a practical bridge between search-heavy planning and real-time serving by doing MCTS offline, compressing trajectories into reusable SGA atoms, and retrieving them online with a hybrid symbolic-semantic matcher [1]. The key idea is not “use MCTS,” but **treat planning experience as a retrieval corpus**; that puts it in the same family as graph memory in [2], except aimed at action selection instead of factual continuity.

- *GAM* gives long-term memory a better shape: one graph tracks event progression in ongoing interaction, another associative network stores more stable topical knowledge, and consolidation only happens when semantic shifts justify it [2]. That separation matters because it directly tackles interference from transient context, which complements [1]: both papers reduce run-time confusion by retrieving from structured abstractions instead of raw history.

- *CoEvolve* is the most directly useful learning recipe here because it closes the loop between deployment behavior and future training data [3]. Rather than fine-tuning on a static benchmark, it watches rollouts for uncertainty and forgetting, uses those signals to synthesize new tasks, validates them through actual environment interaction, then retrains on the refreshed distribution; that’s the missing counterpart to the runtime structure in [1] and [2].

- *AlphaEval* matters because it evaluates complete agent products on tasks taken from companies actually running them, with heterogeneous inputs, implicit constraints, and expert-scored deliverables [4]. Mechanistically, the contribution is the requirement-to-benchmark pipeline plus mixed evaluation modes; it gives you a way to test whether ideas like [1], [2], and [5] survive contact with messy production work instead of only looking good on narrow lab tasks.

- *AgentSPEX* is the strongest framework/tooling pick because it introduces an explicit specification language for agent workflows with typed steps, branching, loops, parallelism, reusable modules, explicit state, and a harness for sandboxing, checkpointing, verification, and logging [5]. It sits underneath the rest: if you want to operationalize graph memory [2], planning retrieval [1], or production eval loops [4], a workflow layer like this is what keeps the system inspectable when the orchestration inevitably gets complicated.
