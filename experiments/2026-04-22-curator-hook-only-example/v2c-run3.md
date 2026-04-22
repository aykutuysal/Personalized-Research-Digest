# openai/gpt-5.4 — v2c-run3

```json
{
  "ok": true,
  "label": "v2c",
  "run": 3,
  "ms": 27204,
  "cost": 0.026374,
  "totalTokens": 16593,
  "inputTokens": 15106,
  "outputTokens": 1487,
  "referenceIds": [
    "W7154458881",
    "W7154716487",
    "W7154971597",
    "W7154537784",
    "W7155011363"
  ],
  "bodyChars": 7281
}
```

## body

## The big picture

The center of gravity is shifting from clever prompting to **agent infrastructure that amortizes reasoning**: store better experience, retrieve the right fragment at runtime, and evaluate agents in settings that look like production instead of toy tasks. Across these picks, the field is treating planning, memory, and eval less as separate problems and more as one systems question: how to keep agents fast enough to ship, structured enough to debug, and robust enough not to drift or fall apart once they run for more than a few turns [1][2][3][4][5].

## Where things are converging

The common move is to replace monolithic context stuffing with explicit intermediate structure. *GAM* builds memory as two linked graphs—an event progression graph for fresh interaction state and a topic associative network for consolidated knowledge—so retrieval happens over a cleaner long-term substrate instead of a single noisy stream [1]. *SGA-MCTS* does something similar for planning: expensive search happens offline, then gets compressed into de-lexicalized State-Goal-Action atoms that can be retrieved online as reusable reasoning hints [2]. *CoEvolve* pushes the same idea into training, mining rollout failures like forgetting and uncertainty to synthesize the next batch of tasks rather than continuing to optimize against a stale task distribution [3].

Where they disagree is on how much structure should be learned versus imposed. GAM and SGA-MCTS both bet on hand-designed representational units—graphs and SGA atoms—because they make retrieval tractable and debuggable [1][2]. CoEvolve is more distributional: let the agent's own failures generate new data and update behavior through closed-loop training [3]. The evaluation papers add a useful reality check. *AlphaEval* says many benchmark wins disappear once tasks contain implicit requirements, multimodal inputs, and expert-scored deliverables [4]. *MemEvoBench* adds that even if the agent looks good at turn 1, persistent memory can silently accumulate bad state and create long-horizon behavior drift that prompt defenses do not catch [5]. If there is a trend to bet on, it's **retrieval over recomputation**—but with skepticism toward any memory layer that lacks explicit contamination tests and failure analysis [1][2][5].

## What to steal

- **Split short-term and long-term memory into different data structures.** Keep raw interaction traces in an event log or event graph, and only promote them into a consolidated knowledge store when a semantic shift threshold is crossed. That is the key anti-interference move in GAM, and it's a better default than appending everything into one vector store [1].
- **Precompute reusable planning chunks offline.** If your agent repeatedly solves families of tasks, run search on traces once, distill them into abstract state-goal-action templates, and retrieve them as soft hints at inference time. SGA-MCTS is basically a recipe for turning expensive test-time search into a cached planning library [2].
- **Use failure signals to generate the next training tasks.** CoEvolve extracts uncertainty and forgetting from rollouts, then uses those patterns to synthesize new tasks and validate them in-environment before adding them to training. If your eval set is static, you are probably training past the actual failure surface of the agent [3].
- **Add long-horizon memory red-teaming to your eval loop.** MemEvoBench's core lesson is that mixed benign and misleading memory updates produce degradation that static prompts do not fix. Inject noisy tool returns and biased feedback across many turns, then measure whether behavior drifts, not just whether single-turn answers degrade [5].
- **Evaluate the product, not just the model.** AlphaEval is a good pattern for anyone building agents for real workflows: benchmark complete systems against messy requirements, heterogeneous artifacts, and domain-specific scoring instead of isolated model tasks [4].

If only one thing sticks: **treat memory, planning artifacts, and evaluation traces as first-class assets you can shape and test—not just leftover context.** [1][2][4][5]

## The papers

**GAM: Hierarchical Graph-based Agentic Memory** turns memory into a two-stage pipeline: ongoing dialogue is first captured in an event progression graph, then selectively consolidated into a topic associative network when the conversation meaningfully shifts [1]. That design is the practical detail that matters: it reduces interference from transient noise while giving retrieval more structure than a flat episodic buffer. Next to MemEvoBench, it reads like a candidate answer to the right problem—though the benchmark paper makes clear that any such memory layer still needs adversarial contamination testing [5].

**SGA-MCTS** decouples planning quality from online latency by doing MCTS offline, then distilling searched trajectories into de-lexicalized State-Goal-Action atoms that can be symbolically and semantically retrieved later [2]. The useful mechanism is not MCTS by itself but the abstraction step: planning traces become reusable units that preserve causal structure while stripping task-specific surface form. Paired with GAM, it suggests a broader stack pattern where both memory and reasoning are compressed into retrieval-friendly artifacts rather than regenerated every run [1].

**CoEvolve** closes the loop between agent behavior and training data by detecting failure-prone rollout patterns—especially uncertainty and forgetting—and feeding them into LLM-based task synthesis, with environment validation before the new tasks enter training [3]. That makes it more operational than generic self-play or static RL fine-tuning because the curriculum moves with the agent instead of lagging behind it. Read beside SGA-MCTS, it points to a useful division: retrieval can amortize known reasoning patterns, while mutual agent-data evolution keeps extending coverage where those patterns still break [2].

**AlphaEval** is one of the more useful evaluation papers because it benchmarks full agent products on tasks sourced from companies, using mixed evaluation paradigms like rubric scoring, UI testing, formal verification, and LLM judges depending on the domain [4]. The mechanism-level contribution is its requirement-to-benchmark construction pipeline, which turns real production requirements into executable tasks fast enough to be operationally useful. In the context of the other picks, this is the paper that stops memory and planning work from overfitting to tidy benchmark assumptions.

**MemEvoBench** focuses on a failure mode that a lot of agent stacks still under-measure: behavioral drift caused by repeated exposure to misleading information in persistent memory [5]. Its setup mixes benign and adversarial memory updates across QA-style and workflow-style tasks, including noisy tool outputs and biased feedback, then tracks safety degradation over long interactions. Read next to GAM and AlphaEval, the implication is straightforward: once you add durable memory, you need evals that stress memory evolution explicitly, because prompt-level safeguards are not enough and production-like performance can decay for reasons your usual benchmark never surfaces [1][4].
