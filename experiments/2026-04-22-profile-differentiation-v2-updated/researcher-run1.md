# openai/gpt-5.4 — researcher-run1

```json
{
  "ok": true,
  "label": "researcher",
  "run": 1,
  "ms": 24126,
  "cost": 0.0407095,
  "totalTokens": 16496,
  "inputTokens": 15133,
  "outputTokens": 1363,
  "referenceIds": [
    "W7154458881",
    "W7154716487",
    "W7154971597",
    "W7155019889",
    "W7155008820"
  ],
  "bodyChars": 6417
}
```

## body

## The big picture

The move across these picks is from *letting agents improvise* toward **factoring the problem into reusable units with explicit failure signals**. Memory is being split into fast vs. stable stores [1], planning into offline search vs. online retrieval [2], training into agent improvement plus data-distribution repair [3], collaboration into identifying the weak link instead of averaging across roles [4], and reliability into benchmarks that isolate where the system breaks rather than just reporting a win rate [5].

## Where things are converging

The strongest convergence is on **amortization**. Instead of paying full reasoning cost every episode, papers here push hard work offline and cash it out online as structure. SGA-MCTS stores de-lexicalized State-Goal-Action atoms mined by MCTS, then retrieves and re-grounds them at inference time [2]. GAM does the same shape of move for memory: keep a local event graph for ongoing context, and only consolidate into a topic-level associative network when a semantic shift happens [1]. CoEvolve applies the pattern to learning by turning rollout failures—specifically forgetting and uncertainty—into synthesized tasks that reshape the next training distribution [3].

Where they disagree is what the bottleneck really is. GAM says long-horizon performance dies from **interference** inside memory and fixes it with separation plus graph-guided retrieval [1]. SGA-MCTS says the bottleneck is **search cost**, and that you can replace online deliberation with non-parametric retrieval of reusable causal fragments [2]. WORC argues that in multi-agent setups the real failure mode is **variance amplification from the weakest participant**, so budget should flow to the least reliable role, not the strongest one [4]. The benchmark signal from SocialGrid supports that decomposition-first view: even with a Planning Oracle to remove navigation as a confound, deception detection stays near random chance, which means better low-level execution alone will not rescue social reasoning [5].

If I had to bet on one trend, it would be this: **retrieve structured experience, don’t regenerate it**. I’d watch with skepticism any result that wins by adding more agents or more free-form chain-of-thought without isolating which reusable unit actually carried the gain.

## What to steal

- **Separate write-time memory from read-time memory.** Keep a transient event log or event graph during the episode. Consolidate only on semantic shifts, not every turn. Then retrieve with both topology and semantics, not cosine similarity alone. That is the practical pattern behind GAM [1].

- **Mine atomic plan fragments offline.** Run search once, distill trajectories into de-lexicalized state-goal-action templates, and retrieve them as hints at inference. Do not ask the model to rediscover the whole plan on every task. That is the core SGA-MCTS trick [2].

- **Turn failure traces into curriculum.** Log forgetting events, uncertainty spikes, and repeated dead ends during rollouts. Use those traces to synthesize new tasks that target the failure pattern, then validate them in the environment before adding them to training. CoEvolve reports absolute gains of **19.43%**, **15.58%**, and **18.14%** on AppWorld and BFCL across three model sizes using exactly this loop [3].

- **Allocate extra samples to the weak agent, not the average agent.** Predict which role is likely to fail on a task, then spend repeated-sampling budget there. WORC’s point is not “ensemble more”; it is “ensemble selectively where reliability is thinnest” [4].

- **Use oracles to factor your evals.** If planning errors contaminate social-reasoning measurement, add a planning oracle and measure the residual gap. SocialGrid shows why this matters: task completion improves with planning help, but deception detection remains near random chance and GPT-OSS-120B stays below **60%** on task completion and planning overall [5].

## The papers

- **GAM: Hierarchical Graph-based Agentic Memory** [1] builds memory as two linked structures with different update rates: an event progression graph for fresh interaction traces, and a topic associative network for consolidated knowledge. The mechanism worth stealing is the consolidation trigger—merge only when semantic shifts occur—which directly targets interference from transient noise. Next to SGA-MCTS, it is the memory-side version of the same design instinct: keep reusable structure, discard episode-specific clutter.

- **SGA-MCTS** [2] is the cleanest planning paper in the set because it turns search into a retrieval problem instead of just bolting MCTS onto inference. The key object is the SGA atom: a de-lexicalized primitive that preserves causal logic while abstracting away entities. Relative to GAM, this is stronger on reusable procedural structure; relative to CoEvolve, it amortizes reasoning at inference time rather than improving the policy through additional training.

- **CoEvolve** [3] matters because it closes the loop between agent behavior and the data it trains on. The mechanism is not generic self-play; it extracts forgetting and uncertainty from trajectories, uses those signals to synthesize tasks, validates those tasks through environment interaction, and then updates the training distribution. That makes it the learning analogue of the other picks: explicit structure plus targeted repair instead of hoping broader data washes out failure modes.

- **WORC** [4] gives a concrete answer to why multi-agent systems often get more brittle as you add roles: collaboration amplifies the worst participant. Its two-stage recipe—localize the weak agent with a meta-learned weight predictor, then allocate more reasoning budget through uncertainty-driven repeated sampling—sits nicely beside SocialGrid because both suggest that aggregate capability numbers hide the real choke points.

- **SocialGrid** [5] is the evaluation pick because it separates embodied planning from social reasoning instead of mashing them together into one score. The Planning Oracle is the useful idea: remove a known bottleneck and see what remains. What remains here is ugly and informative—agents rely on shallow heuristics, fail to accumulate behavioral evidence, and stay near random at deception detection—so if you work on multi-agent reasoning, this is the benchmark result to keep in your threat model.
