# openai/gpt-5.4 — v2d-run3

```json
{
  "ok": true,
  "label": "v2d",
  "run": 3,
  "ms": 26895,
  "cost": 0.0544345,
  "totalTokens": 16457,
  "inputTokens": 15025,
  "outputTokens": 1432,
  "referenceIds": [
    "W7154716487",
    "W7154458881",
    "W7154789938",
    "W7154537784",
    "W7155011363"
  ],
  "bodyChars": 6935
}
```

## body

## The big picture

The field is moving away from “make the model think harder at runtime” and toward **amortizing agency into structure**: precomputed planning atoms, explicit workflow languages, production-grounded eval, and memory systems that decide what to retain instead of shoving everything into context. Across these picks, the common problem is no longer raw capability in toy settings; it is how to keep an agent fast, inspectable, and stable once it has tools, long horizons, and real failure costs.

## Where things are converging

The strongest convergence is on **decoupling expensive cognition from online execution**. SGA-MCTS stores search-discovered State-Goal-Action atoms and retrieves them as soft hints instead of re-running tree search on every task [1]. GAM does something similar for memory by separating event capture from later consolidation into a topic graph, then retrieving with graph-aware signals rather than recency alone [2]. AgentSPEX pushes the same idea into orchestration: move control flow, state, branching, and verification out of prompt text and into an explicit executable spec [3].

The second convergence is that evaluation is getting closer to deployment reality. AlphaEval does not score isolated models on tidy prompts; it evaluates full agent products on messy professional tasks with mixed judging methods [4]. MemEvoBench extends that realism to long-horizon failure: memory poisoning, biased feedback, and noisy tool returns degrade agents over repeated interactions in ways static prompt defenses do not catch [5].

Where they disagree is what layer deserves your next engineering dollar. The planning papers argue for retrieval over live search [1], the memory paper argues for better consolidation and retrieval over bigger context windows [2], and the workflow paper argues that many “reasoning” gains are actually control-flow bugs in disguise [3]. The trend to bet on is **explicit intermediate structure**—typed state, stored experience, graph memory, executable workflows. The trend to watch skeptically is any claim that a stronger base model or a heavier runtime prompt can substitute for those layers once the agent is stateful and tool-using.

If only one thing sticks: build agents so that planning traces, memory writes, and control flow become first-class artifacts you can retrieve, inspect, and test—not just tokens you hope the model handles well [1].

## What to steal

- **Cache planning as reusable atoms, not full trajectories.** SGA-MCTS de-lexicalizes successful search traces into State-Goal-Action units, then re-grounds them at inference time [1]. In practice: log solved episodes, abstract entity names into slots, embed both the state sketch and goal, and retrieve 3–5 nearest action motifs before the model acts.

- **Split short-term event logging from long-term memory consolidation.** GAM’s event progression graph plus topic associative network is a cleaner pattern than one undifferentiated memory buffer [2]. A simple version is: write every event to a session graph, promote only semantically shifted or repeated facts into durable memory, and retrieve from both layers with different weights.

- **Move orchestration out of Python glue and prompt prose.** AgentSPEX’s typed steps, loops, branching, checkpointing, and visual editor point to a practical design rule: your agent should have an inspectable execution plan separate from model instructions [3]. If you are already on LangGraph or a homegrown runner, this suggests defining a declarative workflow layer for state schema, retry policy, approval gates, and parallel branches.

- **Evaluate the product, not the demo.** AlphaEval mixes rubric scoring, UI testing, formal checks, and expert judgment because any single metric misses too much [4]. Borrow the pattern by making every serious task have at least one outcome metric, one process metric, and one domain-specific human or rule-based review.

- **Red-team memory as its own subsystem.** MemEvoBench shows that biased memory updates and noisy tool outputs can slowly bend behavior even when the base model looks fine in single-turn evals [5]. Add tests where false facts enter through summaries, user feedback, or tool outputs, then track whether those facts get promoted, repeated, or acted on over multiple turns.

## The papers

- **SGA-MCTS** turns search into an offline asset instead of an online tax [1]. The core mechanism is not “MCTS helps planning”; it is the extraction of de-lexicalized State-Goal-Action atoms from tree-searched trajectories, plus a hybrid symbolic-semantic retrieval layer that feeds those atoms back as hints to a frozen model. Next to GAM, it is the planning-side version of the same broader pattern: store structured experience in a form that survives task variation rather than re-deriving it every run.

- **GAM** is a memory architecture built around a useful separation: transient interaction state lives in an event progression graph, while durable knowledge only gets consolidated into a topic associative network when semantic shifts justify it [2]. That design matters because it attacks the common failure mode where agents overfit to recent noise or clutter retrieval with low-value observations. Paired with MemEvoBench, it reads as both a capability improvement and a possible mitigation path for memory drift.

- **AgentSPEX** contributes an execution language, not just another framework wrapper [3]. Typed steps, explicit state, loops, parallel execution, checkpointing, verification hooks, and a visual editor make agent behavior inspectable at the workflow level instead of burying control flow inside prompts and Python callbacks. Beside SGA-MCTS and GAM, it fills the missing orchestration layer: once planning and memory are structured, the runtime itself needs to be equally explicit.

- **AlphaEval** is valuable because it evaluates complete agent systems on real work sourced from companies, with heterogeneous inputs, implicit requirements, and mixed assessment methods [4]. The key contribution is the requirement-to-benchmark construction pipeline, which gives teams a way to convert production tasks into executable evals without waiting for a public benchmark to match their stack. That makes it the measurement counterpart to AgentSPEX: if execution is explicit, evaluation can be grounded in the actual workflow rather than synthetic proxies.

- **MemEvoBench** isolates a failure class many agent stacks currently hand-wave away: long-horizon behavioral drift caused by bad memory updates [5]. Its setup mixes benign and misleading memories, noisy tool outputs, and biased feedback across multi-round interactions, showing that static prompt defenses do not hold once the agent’s own stored state becomes the attack surface. Read next to GAM, it sharpens the design brief for memory systems: retrieval quality matters, but write-path governance may matter more.
