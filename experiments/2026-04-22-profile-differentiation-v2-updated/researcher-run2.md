# openai/gpt-5.4 — researcher-run2

```json
{
  "ok": true,
  "label": "researcher",
  "run": 2,
  "ms": 23819,
  "cost": 0.0578125,
  "totalTokens": 16465,
  "inputTokens": 15133,
  "outputTokens": 1332,
  "referenceIds": [
    "W7154716487",
    "W7154458881",
    "W7154971597",
    "W7155019889",
    "W7155011363"
  ],
  "bodyChars": 6108
}
```

## body

## The big picture

The move across these picks is from *more agentic behavior* toward **better-structured agentic behavior**. The interesting work is no longer just “let the model reason longer” or “add more agents,” but how to cache search into reusable units [1], separate fast memory from stable memory [2], adapt the training distribution as the agent changes [3], expose the real bottleneck in multi-agent settings [4], and measure failure modes that only show up over long horizons and repeated interaction [5].

## Where things are converging

There’s a clear convergence on **factoring the problem into reusable primitives** rather than relying on one monolithic reasoning trace. SGA-MCTS turns search trajectories into de-lexicalized State-Goal-Action atoms that can be retrieved at inference time [1]. GAM splits memory into an event progression graph for fresh context and a topic associative network for consolidated knowledge [2]. CoEvolve treats failures themselves as structure: forgetting and uncertainty become signals for generating the next batch of tasks [3].

Where they disagree is what should be optimized first. One camp says amortize deliberation: do expensive search offline, then retrieve the right abstraction online [1]. Another says the main failure is representational drift, so fix the memory substrate before anything else [2][5]. A third says the agent is only as good as the data it keeps creating for itself, so the training loop has to co-adapt with behavior [3]. My bet: **retrieval over compressed experience** is the trend to build on first, because it shows up both in planning [1] and memory [2]. The thing to watch skeptically is generic multi-agent scaling. WORC’s result is a useful corrective: collaboration quality often hinges less on adding specialists than on finding the weak agent and spending budget there [4].

## What to steal

- **Cache search as abstractions, not transcripts.** Distill successful trajectories into slot-based state-goal-action templates, then retrieve and re-ground them as hints during execution. Copy the de-lexicalization move from SGA-MCTS before you spend more compute on live tree search [1].
- **Separate write-time memory from consolidated memory.** Keep a high-churn event buffer for ongoing interaction, and only merge into a more stable semantic store when you detect a topic or narrative shift. That is the core anti-interference trick in GAM [2].
- **Mine training tasks from rollout pathologies.** Log uncertainty spikes, forgetting events, and repeated dead ends. Use those signatures to synthesize new tasks, validate them in the environment, and refresh the training distribution instead of replaying a static corpus [3].
- **Allocate extra samples to the weakest node in the team.** Don’t average reasoning budget across agents. Predict which role is most likely to fail on a task, then give that agent repeated sampling or extra deliberation budget first [4].
- **Test memory under adversarial evolution, not just one-shot prompts.** Mix benign and misleading memories over many rounds and measure drift by failure type. MemEvoBench’s setup—7 domains, 36 risk types, plus workflow tasks adapted from 20 Agent-SafetyBench environments—is the right shape for evaluating whether your memory policy actually holds up [5].

## The papers

- **SGA-MCTS** [1] is the strongest planning paper here because it makes a clean mechanism claim: planning can be turned into retrieval if you store the right unit. The key object is the SGA atom—de-lexicalized, causally meaningful, and reusable across tasks—which lets a frozen model recover something like System 2 depth at near System 1 latency. Relative to GAM, it compresses *action knowledge* rather than interaction history; relative to CoEvolve, it pushes the heavy lifting offline instead of adapting online.

- **GAM** [2] is the memory paper to read first because it isolates the interference problem rather than just proposing “better memory.” The useful design choice is decoupling encoding from consolidation: recent events live in an event progression graph, while stable knowledge is only integrated into a topic associative network on semantic shifts. That puts it in direct conversation with MemEvoBench: if long-horizon failures come from bad updates accumulating [5], GAM gives a concrete memory-write policy to harden.

- **CoEvolve** [3] is the best learning paper in the set because it closes the loop between agent behavior and data generation. Instead of training on a fixed distribution, it extracts failure signals from rollouts, synthesizes tasks to target those failure modes, validates them by interaction, and then retrains on the updated distribution; on AppWorld and BFCL it reports absolute gains of 19.43%, 15.58%, and 18.14% across three model settings. It pairs naturally with SGA-MCTS: one compresses successful experience for inference [1], the other expands failure cases for training.

- **WORC** [4] is the surprise useful multi-agent paper because it rejects the usual “boost the best agent” instinct. Its mechanism is simple but sharp: localize the weak link with a task-feature-based weight predictor, then use uncertainty-driven repeated sampling to compensate where the team is most brittle; it reports 82.2% average accuracy on reasoning benchmarks. Next to the other picks, this is the collaboration analogue of GAM’s anti-interference idea: performance is often limited by a specific failure channel, not by average capability.

- **MemEvoBench** [5] earns the slot because it gives the right failure model for persistent agents: not prompt injection in one shot, but gradual behavioral drift from contaminated memory. The benchmark spans QA tasks across 7 domains and 36 risk types, plus workflow-style tasks from 20 Agent-SafetyBench environments with noisy tool returns, and shows that static prompt defenses are not enough. Read it as the evaluation backstop for GAM and CoEvolve: if you change how agents write memory [2] or how they generate new training data [3], this is the kind of long-horizon test you should run next.
