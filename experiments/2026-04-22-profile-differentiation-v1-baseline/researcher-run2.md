# openai/gpt-5.4 — researcher-run2

```json
{
  "ok": true,
  "label": "researcher",
  "run": 2,
  "ms": 23470,
  "cost": 0.055735,
  "totalTokens": 16044,
  "inputTokens": 14794,
  "outputTokens": 1250,
  "referenceIds": [
    "W7154716487",
    "W7154458881",
    "W7154971597",
    "W7154738737",
    "W7155019889"
  ],
  "bodyChars": 6118
}
```

## body

## The big picture

The strongest work here is moving away from “make the agent reason harder” and toward **changing the substrate the agent reasons over**. Across planning, memory, cooperation, and training, the common move is to externalize the brittle part: cache search as reusable atoms, separate transient events from consolidated knowledge, put cooperation under explicit mechanisms instead of hoping for goodwill, and let training data co-evolve with the failures the agent is actually producing [1][2][3][4][5].

## Where things are converging

There’s a clear convergence on *amortization*: spend expensive reasoning once, then reuse the right abstraction later. SGA-MCTS turns tree search traces into de-lexicalized **State-Goal-Action atoms** that can be retrieved as soft hints at inference time, which is a much cleaner bet than running fresh search every step [1]. GAM makes a parallel move for memory by splitting online event capture from slower graph consolidation, so retrieval hits semantically stable structure instead of one noisy stream [2]. CoEvolve applies the same idea to learning: don’t train on a fixed benchmark distribution, synthesize new tasks from observed uncertainty and forgetting so the data tracks the policy’s actual weak spots [3].

Where the papers disagree is on how much structure you should impose. CoopEval argues that in multi-agent settings, explicit mechanism design—**contracts and mediation**—beats relying on repeated interaction to induce cooperation, especially once counterparties vary [4]. WORC is softer-touch: keep the collaboration pattern, but detect the weak agent and allocate more reasoning budget there through repeated sampling [5]. The trend to bet on is explicit intermediate structure that survives distribution shift: retrieval atoms, memory graphs, and institution-like coordination. The one to watch skeptically is “just add more rounds” as a cure for either single-agent planning or multi-agent cooperation; two of these papers are basically showing that more interaction without the right scaffold just gives errors more places to accumulate [1][4].

## What to steal

- **Cache search as reusable primitives, not full trajectories.** If you already run MCTS, beam search, or expensive deliberation offline, distill the resulting traces into de-lexicalized state-goal-action chunks and retrieve them as hints at inference time rather than replaying full plans [1]. The useful trick is the abstraction boundary: keep causal structure, drop task-specific names.

- **Split memory into write-fast and consolidate-slow paths.** Keep a transient event graph for fresh interaction state, and only promote content into a topic-level associative store when there is a real semantic shift [2]. This is the most actionable antidote to memory pollution from turn-by-turn accumulation.

- **Mine failures for data generation signals.** Track uncertainty and forgetting in rollouts, then synthesize tasks that recreate those failure modes instead of broadening data uniformly [3]. If your agent plateaus, this is a better curriculum signal than generic self-play or random task augmentation.

- **Treat cooperation as mechanism design, not prompting.** For mixed-motive multi-agent tasks, prototype delegated mediation or explicit contract-style payoff shaping before spending cycles on better social prompts [4]. The paper’s practical point is that equilibrium-supporting structure matters more than whether the base model sounds collaborative.

- **Spend extra samples on the weakest role, not the whole team.** If you run a multi-agent stack, add a cheap weak-link detector and route extra test-time budget to the least reliable role rather than globally increasing deliberation [5]. That gives you a cleaner robustness/latency trade-off than making every agent think longer.

## The papers

- **SGA-MCTS** replaces online planning with retrieval over search-derived abstractions [1]. The mechanism is the interesting part: offline MCTS trajectories are distilled into de-lexicalized SGA atoms, then a hybrid symbolic-semantic retriever re-grounds them in the current context. Next to GAM, it’s the planning-side version of the same idea: preserve reusable structure while stripping away noise [2].

- **GAM** gives long-horizon agents a two-speed memory system [2]. Instead of dumping everything into one stream, it keeps dialogue in an event progression graph and only consolidates into a topic associative network when semantics actually shift, which directly targets interference from transient junk. Read beside MemEvo-style concerns in the broader literature, it’s one of the cleaner architectural answers to memory drift rather than a prompt patch.

- **CoEvolve** makes the training distribution adaptive to the policy’s current blind spots [3]. The core mechanism is the closed loop: rollout trajectories produce failure signals such as forgetting and uncertainty, those signals guide task synthesis, and validated tasks are fed back into training. Relative to the other picks, this is the learning analogue of retrieval and memory structuring—move effort toward the failures your current abstractions are missing.

- **CoopEval** is useful because it isolates which cooperation-sustaining mechanisms actually work with capable LLM agents [4]. Repetition, reputation, mediation, and contracting are compared head-to-head, and the sharp result is that contracting and mediation hold up better, while repetition degrades badly when partners vary. That sits nicely against WORC: one paper fixes collaboration through external rules, the other through internal budget allocation [5].

- **WORC** asks a better question than most multi-agent papers: which agent is currently limiting the whole system, and what happens if you only reinforce that one [5]? Its meta-learned weak-agent localization plus uncertainty-driven repeated sampling is a concrete mechanism for damping error amplification without redesigning the whole topology. Compared with CoopEval, it’s the within-architecture answer when you can’t impose stronger external coordination [4].
