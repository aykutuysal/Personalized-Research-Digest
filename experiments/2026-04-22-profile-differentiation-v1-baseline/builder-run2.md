# openai/gpt-5.4 — builder-run2

```json
{
  "ok": true,
  "label": "builder",
  "run": 2,
  "ms": 20956,
  "cost": 0.022068,
  "totalTokens": 15960,
  "inputTokens": 14760,
  "outputTokens": 1200,
  "referenceIds": [
    "W7154716487",
    "W7154458881",
    "W7154971597",
    "W7154789938",
    "W7154537784"
  ],
  "bodyChars": 5752
}
```

## body

## The big picture

The field is moving away from “give the model a better prompt” and toward **explicit external structure**: retrieval units for planning, graph memory for long-horizon state, workflow languages for control flow, production-grounded evaluation, and closed-loop data generation for learning. The common thread is that agents now fail less because they lack raw model capability and more because their memory, planning substrate, and feedback loops are underspecified [1][2][3][4][5].

## Where things are converging

The strongest convergence is on **amortization**. Instead of spending test-time tokens to rediscover a plan, SGA-MCTS stores de-lexicalized *State-Goal-Action* atoms offline and retrieves them as reusable reasoning hints at runtime [1]. GAM does the same move for memory, splitting fast-changing event traces from slower topic-level consolidation in a hierarchical graph so transient noise does not overwrite durable state [2]. CoEvolve pushes the pattern into training: it mines rollout failures such as uncertainty and forgetting, synthesizes new tasks around those weak spots, and updates the data distribution rather than freezing it [3].

Where they differ is in what should be made explicit. AgentSPEX bets on **workflow specification** — typed steps, branches, loops, parallelism, explicit state — as the right control surface for maintainable agents [4]. AlphaEval argues structure is not enough if you still evaluate on toy tasks; its contribution is a requirement-to-benchmark pipeline built from real deployed agent work, where hidden constraints and expert judgment dominate [5]. The trend to bet on is explicit artifacts you can inspect and reuse: graph memory, symbolic plan atoms, typed workflows, and failure-driven task generation. The thing to watch with skepticism is any agent stack that claims robustness from prompting alone without a persistent representation of state, policy, or failure history [1][2][3].

## What to steal

- **Cache plans as abstractions, not transcripts.** Build a retrieval layer over de-lexicalized state→goal→action triples or similar planning atoms, then re-ground them at runtime. That is the key trick in SGA-MCTS: expensive search happens offline; serving time becomes retrieval plus light adaptation [1].
- **Split short-term events from consolidated memory.** GAM’s event progression graph feeding a topic associative network is a practical memory pattern for agents that chat, browse, and act over many sessions. Keep volatile interaction traces separate until a semantic shift justifies consolidation [2].
- **Generate training tasks from failure signatures.** If your agent logs uncertainty spikes, forgotten constraints, or repeated dead ends, use those traces to synthesize new tasks and refresh the training mix. CoEvolve’s win is not just more RL; it is targeted data evolution driven by observed failure modes [3].
- **Move orchestration out of Python glue and into a typed spec.** AgentSPEX’s explicit branching, loops, parallel steps, checkpointing, and verification are worth copying even if you never adopt the language itself. The practical lesson is that agent state and control flow should be inspectable artifacts, not hidden in prompt text and callback spaghetti [4].
- **Evaluate the assembled product, not just the base model.** AlphaEval shows why agent regressions often come from tool wiring, document handling, or unstated requirement misspecification rather than model IQ. Borrow the method: convert real requirements into executable tasks with mixed evaluation paradigms, then score the full system [5].

## The papers

- **SGA-MCTS** turns planning into a retrieval problem by running MCTS offline, distilling trajectories into reusable SGA atoms, and using hybrid symbolic-semantic retrieval to inject those atoms as soft reasoning hints online [1]. Next to GAM, it is the planning analogue of structured memory: both reduce inference-time thrashing by storing reusable structure outside the context window.

- **GAM** builds a two-layer memory system: an event progression graph for ongoing interaction state and a topic associative network for consolidated long-term knowledge, with graph-guided retrieval over both [2]. Relative to SGA-MCTS, it is less about choosing the next action and more about preventing interference and drift as context accumulates across sessions.

- **CoEvolve** closes the loop between agent behavior and training data by extracting failure signals from rollouts, synthesizing new tasks around those patterns, validating them through environment interaction, and retraining on the updated distribution [3]. It pairs naturally with AlphaEval: one gives you production-like failure surfaces to care about, the other gives you a mechanism for turning those failures into new training data.

- **AgentSPEX** contributes a specification language and harness for agent workflows with typed steps, loops, branching, parallel execution, explicit state, sandboxing, checkpointing, verification, and logging, plus a visual editor for authoring and inspection [4]. In the context of the other picks, this is the control-plane answer: if SGA-MCTS and GAM make reasoning assets reusable, AgentSPEX makes the runtime that consumes them maintainable.

- **AlphaEval** is the most useful corrective to benchmark complacency: it evaluates complete agent products on 94 tasks sourced from companies actually deploying them, using mixed assessment methods including judges, rubrics, verification, and UI testing [5]. Read it beside CoEvolve and AgentSPEX: once you evaluate whole systems on messy requirements, you get a sharper view of what should be codified in workflow specs and what should feed back into data generation.
