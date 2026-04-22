# x-ai/grok-4.20

```json
{
  "ok": true,
  "model": "x-ai/grok-4.20",
  "ms": 11662,
  "cost": 0.0364148,
  "totalTokens": 15525,
  "inputTokens": 14155,
  "outputTokens": 1370,
  "referenceIds": [
    "W7154458881",
    "W7155019002",
    "W7154716487",
    "W7155019889",
    "W7154587936"
  ],
  "bodyChars": 6428
}
```

## body

## 1. The big picture

The picks show the field moving from brittle, one-shot agent loops toward **persistent, self-improving memory and collaboration systems** that treat accumulated experience as a first-class, compressible asset. Instead of throwing ever-larger context at every turn, these papers build mechanisms that evolve memory graphs, distill skills from trajectories, compensate for weak collaborators, and orchestrate lightweight agents at scale — all while keeping the system auditable and deployable. The shared problem is no longer “how do we make the LLM smarter” but “how do we stop the agent from slowly forgetting, drifting, or getting stuck when it has to remember, coordinate, and act over long horizons.”

## 2. Where things are converging

All five papers converge on **hierarchical or spectrum-based compression of experience** as the practical way forward: GAM’s event-to-topic graph, the Experience Compression Spectrum’s 5×–1000× axis, SGA-MCTS’s de-lexicalized State-Goal-Action atoms, WORC’s uncertainty-driven extra sampling for weak agents, and LAMO’s role-oriented distillation into a 3B executor. They agree that static prompts or monolithic fine-tuning are dead ends; dynamic retrieval, adaptive budgets, and modular orchestration beat them on both accuracy and latency. The clearest disagreement is on whether to optimize the weak link (WORC) or to let a strong planner ride a lightweight executor (LAMO). The trend worth betting on is **training-free retrieval of reusable primitives** (SGA atoms, compressed skills, graph-guided retrieval) — it scales without retraining and generalizes across domains. The signal to watch with skepticism is pure cryptographic or symbolic guardrails without a memory layer; they add overhead but don’t solve the core drift problem the memory papers expose.

## 3. What to steal

- Drop **SGA atoms** into your own planner: run offline MCTS once per domain, store the de-lexicalized (state, goal, action) triples in a vector + symbolic index, then at inference pull the top-k as soft hints. You get System-2 depth at System-1 speed with zero extra fine-tuning [3].
- Implement a **weak-link budget allocator**: after every few turns, score each collaborator on a quick uncertainty or meta-learned weight predictor and hand the lowest-scoring agent 3–5× more repeated samples or a stronger model. WORC shows this stabilizes multi-agent loops without touching the strong agents [4].
- Use **hierarchical graph memory** (event progression → topic network) instead of a flat vector store. On every semantic shift, consolidate the current thread into the long-term graph and retrieve with a multi-factor query that weights recency, topic relevance, and graph distance. GAM’s numbers on LongDialQA make this an immediate win for any conversational agent [1].
- Build a **role-scalable 3B executor** with LAMO-style two-stage training: first distill GUI/tool knowledge via perplexity-weighted SFT, then run RL that lets the small model call stronger planners as oracles. Swap planners without retraining the executor — perfect for edge deployment [5].
- Map every new tool or skill onto the **Experience Compression Spectrum** before you ship it. Ask: are we storing this at 20× (episodic trace), 200× (procedural skill), or 2000× (declarative rule)? Force the system to compress or expand on demand instead of living at one fixed level. The survey in [2] gives you the exact open problems to avoid.

## 4. The papers

**GAM [1]** builds a hierarchical Graph-based Agentic Memory that keeps transient dialogue in an event-progression graph and only folds it into a stable topic-associative network when a semantic shift is detected. This explicit decoupling beats unified stream memories on LoCoMo and LongDialQA by reducing noise interference while preserving long-term consistency; the graph-guided multi-factor retriever is the piece you can lift directly into any RAG-for-agents stack. It sits next to the Experience Compression Spectrum work by showing one concrete point on that spectrum (graph = mid-compression) that actually works today.

**Experience Compression Spectrum [2]** maps 20+ existing memory and skill systems onto a single axis of increasing compression and proves none of them support the “missing diagonal” of adaptive cross-level moves. The real contribution is the unifying vocabulary and the citation analysis showing the two communities barely talk; it gives you a checklist to audit your own agent’s memory layer and a set of design principles (transferability rises with compression, lifecycle management is neglected) that every other paper in this digest implicitly follows.

**SGA-MCTS [3]** turns expensive inference-time search into cheap retrieval. Offline it runs MCTS, distills trajectories into de-lexicalized State-Goal-Action atoms, then online a hybrid symbolic-semantic retriever pulls the right atoms and re-grounds them as hints. Frozen open-weight models now match GPT-5-class performance on complex benchmarks with no fine-tuning. This is the practical implementation of the compression spectrum’s high-compression end and pairs beautifully with GAM’s graph when you need both episodic and procedural memory.

**WORC [4]** attacks multi-agent fragility at the weak link. A meta-learner predicts per-agent weights from task features, identifies the current weakest collaborator, then gives it an uncertainty-scaled extra sampling budget. On reasoning benchmarks the framework lifts average accuracy to 82.2 % and improves stability across architectures. It directly complements SGA-MCTS: once you have good atomic hints, you still need to allocate inference effort intelligently when collaborators have uneven skill. The weak-link principle is the concrete pattern to steal for any orchestration layer.

**LAMO [5]** shows you can take a 3B multimodal model, give it GUI-specific knowledge via role-oriented data synthesis and a two-stage (SFT then RL) recipe, and turn it into a task-scalable executor that plugs into stronger planners. The resulting LAMO-3B runs monolithic or in MAS mode and keeps improving as planners advance. It is the deployable, lightweight counterpart to the heavier memory and planning papers — use it as the policy executor that actually clicks buttons while GAM and SGA-MCTS feed it high-quality memory and hints. Together the five form a full stack you can start wiring together this week.
