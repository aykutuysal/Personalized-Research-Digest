# openai/gpt-5.4 — researcher-situated-run1

```json
{
  "ok": true,
  "label": "researcher-situated",
  "run": 1,
  "ms": 27995,
  "cost": 0.024449,
  "totalTokens": 16528,
  "inputTokens": 15182,
  "outputTokens": 1346,
  "referenceIds": [
    "W7154716487",
    "W7154458881",
    "W7154971597",
    "W7154738737",
    "W7155008820"
  ],
  "bodyChars": 6450
}
```

## body

## The big picture

Right now, the useful question is not whether agents can do more, but **which mechanism buys reliability without baking in more latency or more brittle prompting**. This pool matters because several papers stop treating planning, memory, and collaboration as end-to-end magic and instead factor them into reusable pieces: retrieve a distilled action atom instead of searching live [1], separate fast event capture from slower memory consolidation [2], adapt the training distribution around current failures instead of optimizing on stale tasks [3], and put cooperation on top of explicit game mechanisms rather than hoping better reasoning will make agents nicer [4]. The benchmark pick earns its slot because it isolates where embodied social agents actually fail once you stop blaming navigation [5].

## Where things are converging

The common move across the strongest papers is **amortization**. Instead of paying full reasoning cost at inference time, they precompute structure and reuse it later.

In planning, SGA-MCTS turns tree search traces into de-lexicalized State-Goal-Action atoms that can be retrieved as soft hints online [1]. In memory, GAM keeps recent interaction state in an event progression graph, then only consolidates into a topic-level associative network when semantic shifts happen [2]. In learning, CoEvolve closes the loop by mining rollout failures—especially forgetting and uncertainty—to synthesize new tasks that reshape the data distribution itself [3].

Where the papers disagree is what should be fixed and what should stay fluid. SGA-MCTS bets that causal planning fragments can be abstracted once and re-grounded many times [1]. GAM is less about abstraction and more about staged storage: preserve detail first, compress later [2]. CoEvolve goes further upstream and changes the task stream rather than the inference stack [3]. The outlier is CoopEval, which says some multi-agent failures are not cognition failures at all; they are incentive failures, and contracting or mediation beats hoping repeated interaction will induce cooperation [4]. SocialGrid sharpens that point from the evaluation side: even with a Planning Oracle, deception detection stays near random chance, so better pathing does not rescue weak social inference [5].

If you are betting on a trend, bet on **explicit intermediate structure with a narrow job**: action atoms, event graphs, synthesized failure-targeting tasks. Be skeptical of generic “more agents, more reasoning” stories unless the mechanism says how error is prevented from compounding.

## What to steal

- **Cache planning as reusable atoms, not full trajectories.** Distill search outputs into de-lexicalized state-goal-action snippets and retrieve them as hints at runtime, the way SGA-MCTS does [1]. Copy the abstraction boundary: remove entity names, keep causal shape.
- **Split memory into write-fast and consolidate-slow paths.** Store ongoing interaction in a transient event graph, and only merge into durable semantic memory on detected topic shifts [2]. This is the cleanest pattern in the pool for reducing interference from transient noise.
- **Use failure signals to generate the next curriculum.** Mine trajectories for uncertainty and forgetting, synthesize tasks around those patterns, then validate them in the environment before adding them to training data [3]. Do not keep training on yesterday’s easy distribution.
- **Test social reasoning with planning held constant.** Add an oracle or scaffold that removes navigation as a confound, then inspect whether the agent can actually accumulate behavioral evidence about others [5]. If performance stays flat, your bottleneck is social inference, not general competence.
- **Add mechanism-level incentives to multi-agent setups.** Try contracts or mediator agents before adding more debate rounds or longer interaction windows [4]. CoopEval’s signal is clear: repetition alone degrades badly when counterparties vary.

## The papers

**SGA-MCTS** is the one to read first because it turns search into a reusable artifact rather than a per-query expense [1]. The key mechanism is the State-Goal-Action atom: an MCTS-discovered trajectory fragment stripped of domain-specific surface form, then recovered through hybrid symbolic-semantic retrieval. Next to GAM, it is the planning analogue of selective consolidation—keep the reusable causal core, throw away incidental detail [2].

**GAM** is the cleanest memory design in the set because it explicitly decouples encoding from consolidation [2]. The event progression graph handles fresh context, while the topic associative network stores more stable knowledge only after semantic shifts, which is a concrete answer to the classic interference-vs-adaptation tradeoff. Compared with SGA-MCTS, GAM is less about search depth and more about controlling when compression happens.

**CoEvolve** matters because it treats the agent and its data as a coupled system rather than assuming the benchmark distribution is fixed [3]. The mechanism is closed-loop task synthesis from rollout-derived failure signals, and the gains are large: absolute improvements of **19.43%**, **15.58%**, and **18.14%** on AppWorld and BFCL across Qwen2.5-7B, Qwen3-4B, and Qwen3-30B-A3B. Relative to the retrieval-style reuse in [1] and [2], this is the training-time version of amortization.

**CoopEval** is the surprise in the pool because it reframes cooperation as mechanism design, not agent virtue [4]. Across four social dilemmas, contracting and mediation work better than repetition, and repetition-induced cooperation deteriorates drastically when co-players vary. Put next to SocialGrid, it suggests that a lot of “multi-agent reasoning” work is under-specifying incentives and then misreading the resulting failures as purely cognitive [5].

**SocialGrid** earns the benchmark slot because it isolates social reasoning from embodied planning instead of letting navigation noise dominate the story [5]. Even the strongest open model, **GPT-OSS-120B**, stays below **60%** on task completion and planning, and with planning assistance agents still detect deception at near-random chance. That makes it a better diagnostic companion to CoopEval than a generic leaderboard: one paper shows which external mechanisms sustain cooperation [4], the other shows what still breaks when those mechanisms are absent and planning is partially solved [5].
