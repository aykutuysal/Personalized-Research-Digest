# xiaomi/mimo-v2-pro

```json
{
  "ok": true,
  "model": "xiaomi/mimo-v2-pro",
  "ms": 20049,
  "cost": 0.0176684,
  "totalTokens": 16354,
  "inputTokens": 15364,
  "outputTokens": 990,
  "referenceIds": [
    "W7154458881",
    "W7155019002",
    "W7154716487",
    "W7154939277",
    "W7155019889"
  ],
  "bodyChars": 4322
}
```

## body

## The big picture

The field is moving from building agents that can *do* tasks to building agents that can *survive* doing them. This week's picks converge on a single tension: as agents gain memory, tools, and autonomy, their reliability and security become the binding constraints. The shared problem is no longer capability—it's control.

## Where things are converging

Two clear trends emerge. First, **memory is becoming a first-class architectural component**, not an afterthought. The papers on hierarchical graph memory [2] and the experience compression spectrum [7] both argue that naive context stuffing fails at scale, and they propose structured, multi-level approaches to knowledge retention. Second, **security is shifting from output filtering to pre-execution governance**. The work on symbolic guardrails [19] and the OATS specification [30] both reject post-hoc safety checks in favor of compile-time and runtime enforcement—a pattern you should bet on for any production agent.

The disagreement is subtler: some papers treat agent planning as a search problem best solved with MCTS [15][16], while others treat it as a retrieval problem [16]. The retrieval approach is faster and more scalable, but the search-based methods handle novel situations better. Watch the retrieval trend for speed, but keep MCTS in your back pocket for hard, open-ended tasks.

## What to steal

- **Decouple memory encoding from consolidation.** GAM's [2] approach of isolating ongoing dialogue in an event graph and only integrating into long-term memory on semantic shifts is a clean pattern you can implement today to reduce noise in your agent's recall.
- **Use symbolic guardrails for domain-specific safety.** The finding that 74% of benchmark policies can be enforced by simple symbolic checks [19] means you don't always need a neural safety model—typed tool contracts and allow-lists get you surprisingly far.
- **Amortize search with offline distillation.** SGA-MCTS [16] shows you can run expensive MCTS offline, distill successful trajectories into reusable State-Goal-Action atoms, and retrieve them at inference time for near-instant System 2 reasoning. This is a practical way to get planning depth without latency.
- **Optimize the weak link, not the star.** WORC [27] demonstrates that giving extra reasoning budget to your weakest agent in a multi-agent system yields more stability than boosting your strongest. A simple weight-prediction loop can identify and compensate for reliability gaps.
- **Specify agent workflows declaratively.** AgentSPEX [32] offers a language for agent workflows with explicit control flow, typed steps, and modular subworkflows—far easier to maintain and debug than tangled Python orchestration code.

## The papers

[1] **GAM: Hierarchical Graph-based Agentic Memory** [2] introduces a two-tier memory graph that separates live event tracking from long-term associative recall. By triggering consolidation only on semantic shifts, it minimizes interference from transient noise—a concrete mechanism you can layer onto any existing agent memory system.

[2] **Experience Compression Spectrum** [7] maps memory, skills, and rules onto a single axis of compression ratio and identifies the "missing diagonal": no existing system adaptively moves knowledge between these levels. This is a design blueprint for building agents that manage their own knowledge lifecycle.

[3] **SGA-MCTS: Decoupling Planning from Execution** [16] treats planning as non-parametric retrieval by distilling MCTS trajectories into de-lexicalized State-Goal-Action atoms. It lets frozen open-weight models match GPT-5 on complex benchmarks at System 1 speeds—the most practical planning trick in this batch.

[4] **Symbolic Guardrails for Domain-Specific Agents** [19] systematically audits 80 safety benchmarks and shows that simple typed contracts and allow-lists can enforce three-quarters of specified policies without hurting agent utility. This is your low-effort, high-return safety lever.

[5] **WORC: Weak-Link Optimization for Multi-Agent Reasoning** [27] uses meta-learning to predict which agent in a collaboration is the performance bottleneck and allocates extra sampling budget accordingly. It's a targeted, architectural fix for the instability that plagues multi-agent pipelines.
