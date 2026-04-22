# openai/gpt-5.4 — researcher-run3

```json
{
  "ok": true,
  "label": "researcher",
  "run": 3,
  "ms": 22587,
  "cost": 0.05617,
  "totalTokens": 16073,
  "inputTokens": 14794,
  "outputTokens": 1279,
  "referenceIds": [
    "W7154716487",
    "W7154971597",
    "W7154458881",
    "W7155011363",
    "W7154738737"
  ],
  "bodyChars": 6109
}
```

## body

## The big picture

The field is moving away from “make the model think harder at inference time” and toward **changing the substrate the agent reasons over**: better memory state, reusable planning atoms, sharper training data, and explicit external mechanisms for coordination and safety. Across these picks, the common move is to stop treating agent behavior as a single prompt problem and instead shape the intermediate objects — memories, search traces, synthesized tasks, contracts, and benchmark structure — that actually determine what the agent can do next [1][2][3][4][5].

## Where things are converging

The strongest convergence is on *amortization*. SGA-MCTS turns expensive search into reusable **State-Goal-Action atoms** that can be retrieved later instead of recomputed [1]. CoEvolve does the same for learning pressure: it mines rollouts for forgetting and uncertainty, then synthesizes new tasks exactly where the policy is weak instead of training on a frozen distribution [2]. GAM applies the pattern to memory by separating transient event accumulation from slower semantic consolidation, reducing interference from noisy recent context [3].

Where they disagree is on how much structure to impose. GAM and SGA-MCTS both win by introducing explicit representational bias — graphs in one case, de-lexicalized action atoms in the other [1][3]. CoEvolve is looser: it keeps the agent flexible but moves the data distribution around it [2]. On the robustness side, MemEvoBench is a warning that memory quality is not a side issue; persistent state becomes an attack surface, and prompt-only defenses do little once bad updates enter the loop [4]. CoopEval pushes the same lesson into multi-agent settings: repeated interaction alone is a weak bet, while **contracts and mediated decision-making** are the mechanisms that actually sustain cooperation when agents optimize hard [5].

If you are betting on a trend, bet on methods that externalize reusable decision structure rather than asking the base model to rediscover it each episode. Be more skeptical of “just add reflection” stories unless they specify what gets stored, compressed, or enforced.

## What to steal

- **Split fast memory from slow memory.** Keep a high-churn event log for local context, but only promote facts into a stable semantic store when a topic shift or consistency threshold is crossed. That is the core trick in GAM, and it is a practical way to reduce contamination from one-off noise [3].

- **Retrieve plans as abstractions, not transcripts.** SGA-MCTS suggests storing de-lexicalized state-goal-action primitives instead of raw successful trajectories. In practice: replace entity names with slots, index by state and subgoal, and inject the retrieved atom as a soft hint rather than a hard script [1].

- **Train on failure shapes, not just failed examples.** CoEvolve extracts uncertainty and forgetting signals from rollouts, then uses them to synthesize new tasks. The pattern to copy is the loop: detect recurrent failure motifs, generate neighboring tasks that preserve the failure mechanism, validate in-environment, then retrain [2].

- **Add memory red-teaming to long-horizon eval.** MemEvoBench makes the failure mode concrete: mix benign and misleading memory over many rounds and measure behavioral drift, not just immediate jailbreak success. If your agent has persistence, test whether poisoned updates survive retrieval and alter later decisions [4].

- **Use explicit cooperation devices in multi-agent runs.** CoopEval shows that repeated play is fragile when partners vary, while mediation and outcome-conditioned contracts hold up better. For collaborative agents, that means adding shared commitment objects or delegated arbitration instead of hoping emergent cooperation appears from chat alone [5].

## The papers

- **SGA-MCTS** turns planning into a retrieval problem by doing search offline, then distilling solution traces into de-lexicalized State-Goal-Action atoms that preserve causal structure while stripping task-specific surface form [1]. Next to GAM, it is the clearest example here of winning through representation design: better intermediate units make a frozen model act more deliberate without paying search cost online [3].

- **CoEvolve** changes the training loop by making the data distribution co-adapt with the agent: rollout traces are mined for uncertainty and forgetting, and those signals drive LLM-based synthesis of new tasks that are then validated in the environment [2]. Compared with SGA-MCTS, which amortizes inference, CoEvolve amortizes learning pressure — not by more generic self-play, but by targeting the exact interaction patterns the current agent mishandles [1].

- **GAM** builds memory as two coupled graphs: an event progression graph for ongoing dialogue and a topic associative network for consolidated knowledge, with promotion gated by semantic shifts rather than every turn [3]. That makes it a useful counterpart to MemEvoBench: the architecture is explicitly trying to control interference, which is exactly the axis where long-horizon memory systems fail under noisy or adversarial updates [4].

- **MemEvoBench** isolates a failure mode most memory papers blur away: persistent memory can slowly drift agent behavior when misleading information, noisy tool returns, or biased feedback accumulate over many rounds [4]. Its real contribution is the benchmark design — mixed benign/misleading memory pools plus workflow tasks with noisy tools — which gives you a way to tell whether a memory method is genuinely stable or just looks good on clean retrieval setups [3].

- **CoopEval** compares mechanism-level interventions for cooperation in social dilemmas and finds that contracts and third-party mediation do more than repetition or reputation when capable LLM agents have incentives to defect [5]. That matters beyond game settings: it is the multi-agent analogue of the other papers’ message that you need explicit structure around the policy, because stronger reasoning alone does not produce the behavior you want [1][2].
