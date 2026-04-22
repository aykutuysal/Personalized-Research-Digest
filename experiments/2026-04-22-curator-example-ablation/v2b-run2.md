# openai/gpt-5.4 — v2b-run2

```json
{
  "ok": true,
  "label": "v2b",
  "run": 2,
  "ms": 25888,
  "cost": 0.0534155,
  "totalTokens": 16314,
  "inputTokens": 14981,
  "outputTokens": 1333,
  "referenceIds": [
    "W7154716487",
    "W7154458881",
    "W7154479191",
    "W7154971597",
    "W7154537784"
  ],
  "bodyChars": 6302
}
```

## body

## The big picture

The center of gravity is shifting from “make the model reason harder” to **make the agent system remember, retrieve, and execute with structure**. The strongest work here treats planning, memory, and evaluation as infrastructure problems: search gets amortized into reusable atoms, long-horizon context gets consolidated instead of endlessly appended, and benchmarks finally look more like the messy production surfaces where agent failures actually show up [1][2][3][4][5].

## Where things are converging

The common move is explicit externalization of agent competence. *SGA-MCTS* turns expensive tree search into a reusable retrieval layer of de-lexicalized State-Goal-Action atoms, so the online agent can act like it searched without paying search-time latency every run [1]. *GAM* does something similar for memory: it separates transient event tracking from durable topic-level consolidation, then retrieves with graph guidance rather than flat recency or vector similarity alone [2]. *NaviRAG* applies the same instinct to knowledge access, replacing one-shot chunk retrieval with hierarchical navigation across granularity levels [3].

That makes the strongest trend to bet on: **compile experience into structured artifacts, then retrieve them at runtime**. It shows up as SGA atoms, graph memories, and hierarchical knowledge records rather than end-to-end prompting tricks.

The disagreement is about where adaptation should happen. *CoEvolve* says static task distributions are the bottleneck and closes the loop by synthesizing new tasks from rollout failures, uncertainty, and forgetting signals [4]. The other papers mostly optimize inference-time structure over fixed data or fixed corpora. That split matters: one camp improves agents by organizing what they already know; the other improves them by changing what they get to practice on.

The skeptical watch item is benchmarks that are too clean. *AlphaEval* is the useful corrective here: production tasks have hidden constraints, fragmented inputs, long deliverables, and shifting rubrics, so gains on tidy benchmarks may not transfer cleanly into deployed agents [5]. If one sentence changes the stack this week, it is this: **stop treating planning quality as only a prompting problem; start treating it as a data structure problem.**

## What to steal

- **Amortize search into reusable plans.** Build a library of de-lexicalized trajectory fragments like `(state pattern, goal, action)` from your successful runs, then retrieve them as hints before the model plans from scratch. That is the core trick behind SGA-MCTS, and it is a practical middle ground between expensive test-time search and brittle fine-tuning [1].

- **Split working memory from long-term memory.** Keep raw interaction traces in an event log, but only promote them into durable memory when a semantic shift happens. Flat append-only memory is how noise and stale assumptions keep leaking back into later turns; GAM’s two-level graph is a better default [2].

- **Retrieve by navigating, not just ranking.** For documents with natural hierarchy—API docs, codebases, product specs—start from coarse topics, identify the missing sub-question, then descend to fine evidence. NaviRAG’s active traversal is a better fit for multi-hop tool selection and grounded answering than top-k chunk stuffing [3].

- **Use failures to mint training tasks.** Mine rollouts for uncertainty spikes, forgotten constraints, and repeated dead ends; generate neighboring tasks that stress the same failure pattern; validate them in-environment before adding them back to training. CoEvolve turns “agent logs” into a curriculum engine instead of just observability exhaust [4].

- **Evaluate the product, not just the model.** If your agent runs over docs, tools, UI state, and implicit business rules, mirror that in eval. AlphaEval’s useful pattern is mixing judge-based scoring, formal checks, UI tests, and reference-driven metrics in one benchmark rather than expecting one scalar to cover all failure modes [5].

## The papers

- **SGA-MCTS** [1] precomputes planning competence offline with Monte Carlo Tree Search, then distills the useful parts into de-lexicalized State-Goal-Action atoms that can be symbolically and semantically retrieved at runtime. The key build idea is decoupling heavy search from live execution: next to GAM and NaviRAG, it is the clearest example of moving reasoning out of the prompt and into a reusable external store.

- **GAM** [2] builds memory as two connected graphs: an event progression graph for short-term narrative flow and a topic associative network for consolidated long-term knowledge, with promotion triggered by semantic shifts rather than every turn. Compared with SGA-MCTS’s plan retrieval, GAM is about preventing context pollution and interference; compared with NaviRAG, it applies structured navigation to the agent’s own lived experience instead of external documents.

- **NaviRAG** [3] restructures source material into a hierarchy and lets the agent actively navigate from broad concepts to fine-grained evidence, updating retrieval based on what is still missing. The practical value is not just better recall on long-document QA; it is a retrieval loop that looks much closer to how tool-using agents should inspect docs, repos, and knowledge bases when one pass is not enough.

- **CoEvolve** [4] closes the training loop by extracting forgetting and uncertainty signals from trajectories, using them to synthesize new tasks, validating those tasks through environment interaction, and then updating the data distribution itself. Among these picks, it is the one that most directly addresses adaptation: while the others make inference more structured, CoEvolve makes the practice set move with the agent.

- **AlphaEval** [5] is less about a single mechanism inside the agent and more about the evaluation harness around it: 94 tasks from real company deployments, judged with mixed paradigms because production success is heterogeneous by nature. It sits next to the other four as the reality check—if you adopt graph memory, retrieval-planning, or self-generated curricula, this is the kind of benchmark shape that will tell you whether those changes survive contact with actual workflows.

