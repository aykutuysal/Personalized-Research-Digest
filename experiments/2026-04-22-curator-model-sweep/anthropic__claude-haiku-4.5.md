# anthropic/claude-haiku-4.5

```json
{
  "ok": true,
  "model": "anthropic/claude-haiku-4.5",
  "ms": 22996,
  "cost": 0.024796,
  "totalTokens": 18328,
  "inputTokens": 16711,
  "outputTokens": 1617,
  "referenceIds": [
    "W7155011363",
    "W7154458881",
    "W7154618638",
    "W7154939277",
    "W7154591662",
    "W7154738737",
    "W7154717912",
    "W7154979361"
  ],
  "bodyChars": 6640
}
```

## body

## The big picture

Agent memory and safety are becoming the hard problems. Early agent systems treated memory as a nice-to-have and security as something to bolt on afterward. The papers here show the field pivoting: memory is now a first-class architectural concern (not just context windows), and safety requires structural guarantees, not just filtering. The shared insight is that both scale—more interactions, longer horizons, more agents—expose fragility that prompting alone cannot fix. The move is toward *designed* memory systems and *provable* safety boundaries.

## Where things are converging

Three convergent moves stand out:

**Memory as architecture, not storage.** [1] and [2] both reject flat buffers in favor of structured graphs—one tracking memory evolution under adversarial conditions, the other decoupling event streams from consolidated knowledge. Both show that interference and drift are the real problems, not capacity. [5] independently converges on the same principles as decades-old cognitive science (Kanerva, Eliasmith), suggesting the architecture space is narrowing around graph-based associative memory.

**Safety via structural enforcement, not detection.** [3] and [4] take opposite approaches—one uses cryptographic guarantees (information-theoretic bounds, randomized smoothing, zero-knowledge proofs), the other uses symbolic guardrails (allow-lists, typed contracts, policy gates). Both reject the premise that training or filtering can catch everything. The convergence: *pre-execution governance* beats post-hoc detection.

**Multi-agent systems need explicit coordination.** [6] shows that stronger reasoning models actually defect more in social dilemmas—a counterintuitive finding that reframes multi-agent safety as a game-theory problem, not a capability problem. [7] demonstrates that orchestration frameworks (Semantic Kernel, LangGraph) are becoming table stakes for anything beyond toy systems.

## What to steal

- **Graph-based memory with semantic consolidation.** If your agents run for more than a few turns, flat memory will fail. Build a hierarchical structure: event stream (low interference, high fidelity) + topic network (stable, queryable). Consolidate only on semantic shifts, not every interaction.

- **Typed tool contracts as your security boundary.** Don't rely on the model to "understand" what it can do. Define tools as strict schemas with allowed inputs, outputs, and preconditions. Gate execution before the model sees the result. [4] shows this catches 74% of policy violations with near-zero overhead.

- **Cooperation mechanisms for multi-agent systems.** If you're building agents that interact, repetition alone won't work. Add reputation tracking or contract-based agreements. [6] shows these are most effective under competitive pressure—design for adversarial settings from the start.

- **Bilevel optimization for agent skills.** Don't hand-tune prompts and tool sets. Use MCTS to explore skill structure (which tools, which instructions) while refining content in an inner loop. [8] shows this beats manual engineering on realistic tasks.

## The papers

**[1] MemEvoBench: Benchmarking Memory MisEvolution in LLM Agents** — First benchmark for long-horizon memory safety. Shows that agents degrade under adversarial memory injection and biased feedback, and that static defenses fail. The contribution is concrete: a framework for measuring *how* memory corrupts behavior over time, not just whether it does. Sits next to [2] as the empirical case for why memory architecture matters.

**[2] GAM: Hierarchical Graph-based Agentic Memory for LLM Agents** — Proposes a two-layer memory: event progression graph (ongoing dialogue, low interference) + topic associative network (consolidated knowledge, retrieved via multi-factor strategy). Outperforms baselines on reasoning accuracy and latency. The mechanism is the decoupling: rapid perception without stable knowledge corruption.

**[3] Provable and Practical Prompt Injection Resilience in Autonomous LLM Agents** — UCCA integrates five complementary defenses: information-theoretic leakage bounds, certified robustness via randomized smoothing, token-level rejection, runtime trajectory enforcement via control barrier functions, and verifiable inference via ZK-SNARKs. Achieves <8% attack success on real models with <340ms overhead. This is the security paper that actually ships: formal guarantees *and* deployable latency.

**[4] Symbolic Guardrails for Domain-Specific Agents** — Systematic study of 80 agent safety benchmarks, finding 85% lack concrete policies. Shows 74% of policy requirements can be enforced by symbolic guardrails (allow-lists, precondition checks, output validation). Improves safety without sacrificing utility. Complements [3] by showing the simpler path works for most domains.

**[5] Cognitive Memory for LLM Agents: An Architecture Validated by Three Independent Discoveries** — Proposes Semantic Tension Graph (STG) implementing nine biologically-grounded mechanisms. Post-hoc analysis reveals convergence with Kanerva (1988) and Eliasmith (2013) across 38 years and three disciplines. Validated on 8,199 nodes over 20+ sessions. The contribution is not novelty but *validation*: shows the architecture space has converged, and cognitive science got it right decades ago.

**[6] CoopEval: Benchmarking Cooperation-Sustaining Mechanisms and LLM Agents in Social Dilemmas** — Tests whether stronger LLMs cooperate in mixed-motive games. They don't—recent models defect consistently. Evaluates game-theoretic mechanisms (repetition, reputation, mediation, contracts). Finds contracting and mediation most effective, and that these mechanisms *strengthen* under competitive pressure. Reframes multi-agent safety as mechanism design, not capability alignment.

**[7] Semantic Kernel Usage for Orchestration of Multi-Agent LLM-Based Systems** — Practical guide to orchestration patterns in Microsoft Semantic Kernel. Shows how to decompose tasks, delegate to specialized agents, and define functional boundaries. Emphasizes that MASs distribute roles, memory, and tools—not just computation. Grounds the architectural shift from monolith to multi-agent in real framework choices.

**[8] Bilevel Optimization of Agent Skills via Monte Carlo Tree Search** — Formulates skill optimization as a bilevel problem: outer loop (MCTS) determines skill structure (which tools, which instructions), inner loop refines content. Tested on OR-QA tasks. Shows that jointly optimizing structure and content beats hand-tuning. Directly applicable: you can run this on your own agent stack.
