# openai/gpt-5.4 — v2b-run1

```json
{
  "ok": true,
  "label": "v2b",
  "run": 1,
  "ms": 26231,
  "cost": 0.0251195,
  "totalTokens": 16386,
  "inputTokens": 14981,
  "outputTokens": 1405,
  "referenceIds": [
    "W7154716487",
    "W7154971597",
    "W7154789938",
    "W7154458881",
    "W7154537784"
  ],
  "bodyChars": 6832
}
```

## body

## The big picture

The field is moving away from “make the model reason harder at inference time” and toward **architectures that externalize competence**: reusable planning atoms, explicit workflow languages, production-grounded evals, structured memory, and closed-loop data generation. The common thread is practical: instead of hoping one bigger model call can carry long-horizon behavior, these systems break agent ability into artifacts you can inspect, retrieve, replay, benchmark, and improve.

## Where things are converging

Three techniques show up repeatedly.

First, **offline-to-online amortization** is winning over brute-force runtime search. SGA-MCTS turns expensive search into reusable State-Goal-Action atoms retrieved as soft hints at inference time [1]. CoEvolve does the same move for training data: mine rollout failures, synthesize new tasks around them, then refresh the agent’s data distribution instead of training on a stale benchmark mix [2]. The bet to take seriously is that agent quality will come more from what gets cached and regenerated between runs than from ever-longer test-time chains.

Second, **explicit structure is replacing prompt soup**. AgentSPEX pushes workflow logic into a typed execution language with branching, loops, state, and checkpointing [3]. GAM does something similar for memory, separating transient event flow from consolidated topic-level knowledge so retrieval doesn’t keep dragging noise back into the loop [4]. That’s the more credible direction than “one giant system prompt plus tool docs,” because both papers make control flow and state legible enough to debug.

Third, evaluation is getting closer to where agents actually fail in deployed stacks. AlphaEval measures complete agent products on messy, implicit, expert-judged work rather than sanitized benchmark tasks [5]. That cuts against the still-common pattern of optimizing for toy environments and then being surprised when the production wrapper underperforms the underlying model.

The skepticism point: retrieval and structure help, but they solve different bottlenecks. SGA-MCTS [1] is about reusable decision primitives; GAM [4] is about persistence under long interactions; AgentSPEX [3] is about workflow control. Treating them as substitutes would be a mistake. The emerging stack looks compositional, not singular.

## What to steal

- **Cache search as reusable primitives, not full trajectories.** SGA-MCTS’s key move is to store de-lexicalized State-Goal-Action atoms instead of verbose demonstrations [1]. In practice: log successful traces, abstract entities into slots, then retrieve by current state plus intended subgoal. This is a cleaner way to get planning lift than pasting entire exemplars back into context.

- **Split memory into “what just happened” and “what has earned consolidation.”** GAM’s event graph plus topic associative network is a useful design pattern even if you never implement graphs literally [4]. Keep a high-churn scratch layer for recent interaction state and a slower, gated long-term layer updated only on semantic shifts.

- **Use failure signals to generate tomorrow’s training set.** CoEvolve extracts forgetting and uncertainty from rollouts, then synthesizes validated tasks around those weak spots [2]. If you already have agent traces, a lightweight version is: cluster failures by tool, step, or environment state; generate near-neighbor tasks; replay them into fine-tuning or eval.

- **Move orchestration logic out of Python glue and into something inspectable.** AgentSPEX’s typed steps, branches, loops, and visual editor point to a practical ops win [3]. Even a minimal internal DSL or declarative YAML graph will make regression review, handoff, and checkpoint recovery much easier than callback-heavy framework code.

- **Benchmark the product, not just the model.** AlphaEval’s strongest idea is methodological: evaluate the whole agent system under implicit requirements, heterogeneous artifacts, and expert scoring [5]. If your current evals don’t include wrappers, tools, retries, and output formatting, they’re probably overstating progress.

## The papers

- **SGA-MCTS** replaces online planning with retrieval over compact planning atoms built offline using MCTS [1]. The useful mechanism is the de-lexicalization step: it strips domain-specific surface details while preserving causal structure, so a frozen model can borrow “how to proceed” without inheriting a full trace. Next to GAM [4], it handles short-horizon decision reuse rather than persistent memory; next to AgentSPEX [3], it supplies planning content where a workflow engine supplies control.

- **CoEvolve** closes the loop between agent behavior and training data instead of treating the environment distribution as fixed [2]. The important build detail is the pipeline: detect failure patterns from rollouts using uncertainty and forgetting signals, synthesize new tasks around those patterns with an LLM, validate them by environment interaction, then update the training mix. It pairs well with AlphaEval [5]: one gives you production-like failure surfaces, the other gives you a way to turn those surfaces into new data.

- **AgentSPEX** is a workflow language plus execution harness for agents with typed steps, branching, loops, parallelism, state, sandboxing, checkpointing, verification, and logging [3]. The contribution is less “another framework” than separating agent logic from ad hoc Python orchestration so behavior becomes editable and inspectable as a first-class artifact. Compared with SGA-MCTS [1], it won’t make the agent smarter by itself, but it makes planning and tool-use failures easier to localize and replay.

- **GAM** tackles long-horizon memory by decoupling encoding from consolidation in a hierarchical graph memory [4]. The mechanism that matters is the two-layer design: an event progression graph absorbs fresh interaction state, while a topic associative network only updates when the conversation has actually shifted, reducing interference from transient noise. In a production stack, this is the clearest memory paper here because it ties architecture directly to retrieval precision and efficiency rather than treating memory as a flat append-only log.

- **AlphaEval** is an evaluation framework built from real tasks contributed by companies shipping agent products, with multimodal inputs, implicit constraints, long-form deliverables, and mixed evaluation methods [5]. What it actually shows is that model capability and product capability diverge once wrappers, tools, domain conventions, and expert judgment enter the loop. That makes it the best reality check among these picks: before tuning prompts or adding another planner, make sure the thing being optimized resembles the work the agent is supposed to survive.

