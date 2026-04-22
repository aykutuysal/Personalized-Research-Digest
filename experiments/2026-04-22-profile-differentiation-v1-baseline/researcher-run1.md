# openai/gpt-5.4 — researcher-run1

```json
{
  "ok": true,
  "label": "researcher",
  "run": 1,
  "ms": 25249,
  "cost": 0.05821,
  "totalTokens": 16209,
  "inputTokens": 14794,
  "outputTokens": 1415,
  "referenceIds": [
    "W7154458881",
    "W7154716487",
    "W7155019889",
    "W7155008820",
    "W7154738737"
  ],
  "bodyChars": 6977
}
```

## body

## The big picture

The common move across these papers is a shift away from treating agent ability as “more chain-of-thought, more tools, more rollouts,” and toward **explicitly structuring the failure surface**: what gets remembered, what gets retrieved, which agent is actually limiting the team, and which part of social behavior is being measured rather than accidentally confounded. The field is getting more surgical. Instead of adding another orchestration layer, these picks isolate reusable units — memory consolidation boundaries, de-lexicalized planning atoms, weak-link budget allocation, and benchmark controls that separate planning failure from social failure [1][2][3][4][5].

## Where things are converging

The shared bet is on *decoupling*. GAM splits fast event capture from slower consolidation into a topic-level graph, so short-term noise does not overwrite long-term state [1]. SGA-MCTS does the same for planning: expensive search happens offline, and online inference becomes retrieval over State-Goal-Action atoms rather than fresh tree search each time [2]. WORC decouples “multi-agent quality” from average-agent quality by explicitly finding the weakest node in a collaboration and spending extra reasoning budget there instead of globally scaling everyone [3].

Where they disagree is on what should be made explicit. The memory line says structure should live in the agent’s state representation — graphs, semantic shifts, multi-factor retrieval [1]. The planning line says structure should live in the reusable action prior — de-lexicalized causal fragments recovered by retrieval [2]. The social-eval papers argue that before adding more mechanism, you need cleaner measurement. SocialGrid’s planning oracle is a sharp example: if navigation is weak, you are not really testing social reasoning at all [4]. CoopEval pushes that further by showing that cooperation does not reliably emerge from stronger reasoning; mechanism design matters more, with **contracts and mediation** outperforming simple repeated interaction once partners vary [5].

The trend to bet on is retrieval over *structured intermediates*, not raw histories: graph memories [1], atomic planning traces [2], and targeted intervention on weak components [3]. The trend to watch skeptically is any claim that stronger base reasoning alone yields better multi-agent behavior. Both SocialGrid and CoopEval cut against that story in different ways [4][5].

## What to steal

- **Add a consolidation gate to memory.** Keep raw interaction events in a short-horizon structure, and only promote them into durable topic memory when a semantic shift is detected. That is the practical core of GAM, and it is a better default than appending every turn into one growing stream [1].
- **Store plans as atoms, not transcripts.** If you already run search or collect successful trajectories, compress them into de-lexicalized State-Goal-Action units and retrieve them as hints at inference time. This is the portable part of SGA-MCTS: amortize search once, then reuse causal fragments cheaply [2].
- **Debug multi-agent systems by finding the weakest agent first.** WORC’s lesson is not the exact meta-learning stack; it is the allocation rule. Estimate which role is failing most often, then spend extra samples, retries, or verification budget there instead of increasing deliberation across the board [3].
- **Separate capability axes in your evals.** SocialGrid’s oracle is worth copying anywhere one missing subskill contaminates the metric. If your “reasoning” benchmark is partly measuring navigation, parsing, or UI control, add an assisted mode to expose the true bottleneck [4].
- **Use incentive scaffolds, not just better prompts, for cooperation.** In mixed-motive settings, contracts and delegated mediation did more than repeated play to sustain cooperation. If your agents must coordinate under conflicting incentives, add explicit commitment or arbitration mechanisms before you spend cycles tuning dialogue style [5].

## The papers

- **GAM: Hierarchical Graph-based Agentic Memory** builds memory around two separate graph objects: an event progression graph for ongoing interaction and a topic associative network for consolidated knowledge. The useful mechanism is the promotion rule — only integrate into long-term structure on semantic shifts — plus graph-guided retrieval, which makes this a cleaner answer to interference than the usual “summarize and append” memory stack [1]. It sits naturally next to SGA-MCTS because both papers turn expensive online cognition into retrieval over structured artifacts rather than free-form re-reasoning [2].

- **SGA-MCTS** takes trajectories found by offline Monte Carlo Tree Search and distills them into de-lexicalized State-Goal-Action atoms that preserve causal logic while stripping task-specific details. That matters because it gives you a concrete recipe for training-free planning improvement: search once, index the reusable pieces, then re-ground them online as soft hints instead of paying tree-search latency every episode [2]. Compared with GAM, the representation is procedural rather than episodic; compared with WORC, it attacks single-agent planning quality before collaboration enters the picture [1][3].

- **WORC** contributes a simple but underused mechanism for multi-agent systems: treat collaboration as a weak-link problem, identify the performance-limiting agent from task features, and allocate more reasoning budget specifically to that role. The point is not merely “more samples help,” but that selective compensation stabilizes the whole group better than reinforcing already-strong agents, which is a useful correction to majority-vote and ensemble instincts [3]. It complements CoopEval because both reject the idea that aggregate intelligence alone produces robust collective behavior [5].

- **SocialGrid** is one of the better benchmark design moves in the pool because it isolates embodied social reasoning from lower-level control. The planning oracle is the real contribution: it lets you test whether deception detection and evidence accumulation are genuinely weak, rather than hidden behind navigation failures or repetitive action loops [4]. That makes it a good counterpart to CoopEval — one studies social reasoning under embodied task constraints, the other studies cooperation under strategic incentives [5].

- **CoopEval** compares equilibrium-supporting mechanisms head-to-head instead of asking whether agents are “cooperative” in the abstract. The strongest result is mechanistic: repeated interaction is fragile when partners vary, while **contracting and mediation** sustain cooperation more reliably, and even more so under evolutionary pressure to maximize payoff [5]. Read next to SocialGrid, it suggests that multi-agent progress will come less from generic reasoning gains and more from explicit protocol design, incentive shaping, and controlled evaluation [4].
