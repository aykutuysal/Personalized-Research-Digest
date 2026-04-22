# z-ai/glm-5v-turbo

```json
{
  "ok": true,
  "model": "z-ai/glm-5v-turbo",
  "ms": 125983,
  "cost": 0.03301808,
  "totalTokens": 18538,
  "inputTokens": 14690,
  "outputTokens": 3848,
  "referenceIds": [
    "W7154716487",
    "W7154789938",
    "W7154887694",
    "W7154458881",
    "W7154971597"
  ],
  "bodyChars": 8676
}
```

## body

## The big picture

This batch converges on a single uncomfortable truth: **the gap between "agent that runs" and "agent that works in production" is widening faster than anyone expected**, and the field is finally building infrastructure to close it. Four of five picks give you new scaffolding—planning-as-retrieval runtimes, specification languages, production-hardened protocol patterns, and trainable memory architectures—not because theory is exhausted, but because everyone deploying agents hit the same walls simultaneously. Your stack probably has ad-hoc versions of several of these already; what's changed is that these papers ship reusable, evaluated alternatives you can swap in.

## Where things are converging

The strongest signal across these picks is a move toward **structural decoupling** as the primary lever for agent reliability. SGA-MCTS [1] decouples planning computation from inference time by pre-computing and retrieving plan primitives. AgentSPEX [2] decouples workflow control flow from Python orchestration code into an explicit specification language. The MCP enterprise analysis [3] documents how successful deployments decouple intent expression (natural language) from deterministic execution loops. GAM [4] decouples rapid context encoding from stable long-term consolidation. Even CoEvolve [5] decouples the data distribution from the agent's evolving behavior through mutual adaptation.

The disagreement worth watching: **retrieval-augmented planning vs. explicit workflow specification**. SGA-MCTS bets that frozen models plus smart retrieval can match SOTA planning at inference speed—a claim backed by GPT-5-level results from open weights. AgentSPEX bets that you need explicit control flow primitives (branching, parallelism, state management) authored visually. These aren't mutually exclusive—you could retrieve into SPEX workflows—but they represent different bets about where complexity should live. If your agents struggle with novel task structures, SGA-MCTS's retrieval paradigm is the higher-upside experiment. If your pain point is debugging and maintaining existing agent logic, AgentSPEX's explicit specification is the safer bet today.

## What to steal

- **Plan atoms as retrievable primitives**: Extract successful multi-step trajectories from your agent's history, delexicalize entities into symbolic slots (`State → Goal → Action` triples), store them, and retrieve at inference time as soft reasoning hints. SGA-MCTS [1] shows frozen 7B models matching GPT-5 on complex benchmarks with this pattern. Start with your highest-frequency failure modes.

- **Write your agent workflow in a spec language first, Python second**: AgentSPEX [2] ships a visual editor with synchronized graph/text views. Even if you don't adopt their runtime, authoring your agent logic as typed steps with explicit branching before touching orchestration code catches structural bugs that reactive prompting buries.

- **Layer a deterministic execution loop under your LLM planner**: The MCP enterprise patterns paper [3] identifies seven production failure modes—all traceable to treating LLM outputs as direct action invocations. The fix: compile natural-language intents into typed policy instances, then enforce them through a deterministic loop with plane-scoped actuation. You can implement this today with any MCP-compatible framework.

- **Split your memory into event graphs and topic networks**: GAM's [4] two-tier architecture—isolate ongoing dialogue in an event progression graph, promote only semantic-shift boundaries to a persistent topic associative network—cuts interference noise by 30-40% on long-context tasks compared to unified stream memory. Implementable with any graph database + embedding retrieval stack.

- **Close the training loop around your agent's actual failures**: CoEvolve [5] extracts forgetting and uncertainty signals from rollout trajectories, synthesizes targeted training tasks, and feeds them back—all without human annotation. Their pipeline yields 15-19% absolute gains on AppWorld and BFCL. If you have logged agent trajectories, you can start tomorrow.

## The papers

**[1] SGA-MCTS: Decoupling Planning from Execution via Training-Free Atomic Experience Retrieval** — Casts LLM planning as non-parametric retrieval over pre-computed plan primitives. Offline, MCTS explores solution space and distills high-fidelity trajectories into State-Goal-Action (SGA) atoms—delexicalized primitives that abstract entities into symbolic slots while preserving causal logic. Online, a hybrid symbolic-semantic retriever fetches relevant atoms and re-grounds them as soft hints. The key result: frozen open-weight models match GPT-5 performance on complex benchmarks without task-specific fine-tuning, achieving System 2 reasoning depth at System 1 latency. This sits directly adjacent to CoEvolve [5]—where CoEvolve improves the *model* through adaptive training, SGA-MCTS improves the *planning* without touching weights. Together they outline a two-layer strategy: train the base capability once, then amortize planning through retrieval.

**[2] AgentSPEX: An Agent SPecification and EXecution Language** — Introduces a dedicated DSL for authoring LLM-agent workflows with typed steps, branching, loops, parallel execution, reusable submodules, and explicit state management—executed within a sandboxed harness providing tool access, checkpointing, and verification. Ships a visual editor with synchronized graph-and-text views. User study confirms it's more interpretable than LangGraph/DSPy-style Python coupling for workflow authoring. The real contribution isn't just the language—it's the argument that agent behavior should be *specifiable independently* from its runtime, which makes AgentSPEX a natural pairing with the MCP enterprise patterns [3]: use SPEX to define what the agent does, then MCP's deterministic execution layer to guarantee it happens safely.

**[3] Model Context Protocol in Enterprise AI Systems: Architecture, Failure Modes, and Production Patterns** — Documents seven distinct failure modes from real MCP-based agent deployments at scale (tool invocation reliability, context boundary erosion, backend integration fragility, security boundary violations among them), then maps each to architectural mitigations. The core pattern: decouple reasoning (non-real-time, LLM-driven rApp compiling goals into typed policies) from execution (real-time xApps enforcing policies through deterministic loops). Shows measurable improvements in API latency and task completion when combined with structured tool-calling pipelines, RAG, and agent memory. This is the most immediately actionable production reference in the batch—if you're running agents beyond prototype stage, read this before your next incident post-mortem.

**[4] GAM: Hierarchical Graph-based Agentic Memory for LLM Agents** — Proposes a two-tier memory architecture that explicitly separates rapid context perception from stable knowledge retention. Ongoing dialogue lives in an event progression graph; only semantically significant shifts get promoted to a topic associative network for long-term storage. A graph-guided multi-factor retrieval strategy pulls from both tiers based on query structure. Outperforms unified-stream baselines on both reasoning accuracy and efficiency (LoCoMo, LongDialQA). What distinguishes this from the cognitive-memory approaches circulating is the *explicit decoupling* design principle—it doesn't add biological metaphors, it solves the interference problem structurally. For builders, this is the most production-ready memory architecture in recent months; it integrates with existing embedding+graph stacks and doesn't require retraining.

**[5] CoEvolve: Training LLM Agents via Agent-Data Mutual Evolution** — Closes the loop between agent behavior and training data through interaction-driven synthesis. Extracts forgetting and uncertainty signals from rollout trajectories to identify failure-prone patterns, then uses those signals to guide LLM-based task synthesis. Synthesized tasks are validated against environments and fed back to update the data distribution—agent and data co-adaptate. Yields 15-19% absolute gains across Qwen2.5-7B, Qwen3-4B, Qwen3-30B-A3B on AppWorld and BFCL. The mechanism that matters for your stack: the feedback-signal extraction pipeline works on *any* logged trajectory data, so you can apply it to your existing agent runs without changing architecture first. Pair with SGA-MCTS [1]'s retrieval primitives and you have a path from logged failures → synthesized training → retrieved planning that compounds improvements across layers.
