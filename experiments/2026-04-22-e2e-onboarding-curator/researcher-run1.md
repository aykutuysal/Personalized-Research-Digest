# openai/gpt-5.4 — researcher run1

## format_structure (from onboarding)

1. **Editor's read.** Open with a short, reader-anchored essay that starts from the mechanism-level question on the table for this issue: what these papers change about how AI agents actually work, what they reveal about planning, tool use, memory, coordination, or adaptation, and which claims look more structurally justified after reading them. This is not a field summary. It should feel like a pointed take for a researcher deciding which ideas are real, which are superficial, and where the underlying algorithmic story has sharpened or cracked.
2. **What seems to be doing the work.** Synthesize the papers around the core mechanism or formal idea they test. Name the proposed source of improvement plainly, compare how different papers isolate it, and separate genuine causal insight from performance that could be explained by confounds, scaffolding, or evaluation design. The reader should come away with a clearer model of why a result holds, not just that it does.
3. **Methods worth reading closely.** Highlight the 1 to 2 papers that most reward serious attention to setup, ablations, or theoretical framing, with a sentence on what makes each one unusually informative. This section helps the reader decide where to spend real reading time.
4. **Open questions.** Pull out the unresolved conceptual or mathematical questions these picks leave behind: assumptions that still look shaky, mechanisms that remain underidentified, settings where the claimed explanation may not travel, and places where current evaluations still fail to distinguish competing accounts. The point is to show where the literature is still thin or overconfident.
5. **The papers.** Give a compact numbered list of the five picks, each with 2 to 3 sentences placing the paper in conversation with the others: the mechanism it isolates, the real contribution, the main caveat, and who should read it closely. Skip generic abstract-style summaries and framework chatter. Keep the emphasis on algorithmic content, evidence, and explanatory value.

## voice_language (from onboarding)

Write like a researcher briefing another researcher: precise, concept-forward, and easy to read, with no startup tone and no product language. Prioritize mechanisms, theoretical structure, ablation logic, and algorithmic insight over applications, tooling, or implementation fashion. Use plain technical language rather than jargon for its own sake, but do not oversimplify when the formal idea matters. The digest should read as an editorial synthesis first and a paper list second, with selective detail on setup or numbers only when they change the interpretation. Target roughly 600 to 800 words.

## curator output

```json
{
  "referenceIds": [
    "W7154716487",
    "W7154971597",
    "W7154458881",
    "W7154738737",
    "W7155008820"
  ]
}
```

### body

## Editor's read

The mechanism-level question running through this set is not whether agents benefit from more scaffolding. They usually do. The sharper question is which *kind* of structure survives contact with distribution shift: does the gain come from better search, better abstractions over prior search, better control of memory updates, better adaptation of the task distribution, or better institutional rules for multi-agent interaction?

What changed my mind most here is that several papers stop treating agent improvement as a monolith. *SGA-MCTS* argues that planning can be amortized into reusable state-goal-action atoms rather than re-run online [1]. *CoEvolve* treats training data as an adaptive object, using rollout-derived failure signals to generate the next tasks the agent should face [2]. *GAM* splits memory into fast event tracking and slower consolidation, making interference itself the target of the design [3]. The multi-agent papers are useful precisely because they push against softer stories: *CoopEval* shows that stronger reasoning does not itself induce cooperation, while mechanism design can [4]; *SocialGrid* shows that social reasoning claims are badly confounded by basic planning deficits unless the environment explicitly factors them apart [5].

So the strongest claims in this pool are the ones that localize an information-processing bottleneck. Search is expensive, so cache its causal skeleton [1]. Static training data misses evolving failure modes, so close the loop on task generation [2]. Memory corruption comes from undifferentiated accumulation, so separate encoding from consolidation [3]. Cooperation does not emerge from intelligence alone, so alter incentives and delegation structure [4]. And if your benchmark cannot separate navigation failure from deception detection, it is not really measuring social intelligence yet [5].

## What seems to be doing the work

The common mechanism is **structured compression of interaction history**.

In *SGA-MCTS* [1], the compressed object is planning experience. MCTS is used offline to produce de-lexicalized State-Goal-Action atoms, and the online system retrieves these as reusable causal templates. If the result is real, the gain is not “retrieval helps” in the generic RAG sense; it is that planning traces can be factorized into abstractions that preserve action logic while stripping away instance-specific content. The key thing to inspect is whether the atoms truly transfer because of causal structure, rather than because benchmarks reuse surface task schemas.

In *GAM* [3], the compressed object is memory. The claimed source of improvement is not merely graph storage, but the decision to delay consolidation until semantic shifts occur. That is a concrete hypothesis about interference: transient local context should remain in an event graph, while stable cross-session knowledge should enter a topic-level associative network only after evidence of persistence. This is more informative than generic “hierarchical memory” language because it proposes a specific update rule.

In *CoEvolve* [2], the compressed object is failure information extracted from rollouts. Forgetting and uncertainty become sufficient statistics for where the data distribution should expand next. The large gains on AppWorld and BFCL—19.43%, 15.58%, and 18.14% absolute depending on model [2]—are notable, but the causal question is whether the benefit comes from mutual evolution per se or from simply generating harder, better-targeted tasks than the original corpus contained.

The multi-agent papers make the confounds more visible. *CoopEval* [4] is strongest when read as a mechanism-design paper: repetition, reputation, mediation, and contracting are alternative interventions on equilibrium structure, and the result that contracting and mediation dominate while repeated-play cooperation collapses under varying co-players is exactly the sort of negative result the area needs. *SocialGrid* [5] does similar cleanup on the evaluation side: by introducing a Planning Oracle, it tests whether apparent social failure is really just path-planning failure. The answer seems to be no—planning assistance raises task completion, but deception detection stays near chance [5]. That is a useful disentanglement.

## Methods worth reading closely

- **SGA-MCTS** [1]. This is the one to read first if you care about whether amortized search can be made algorithmically clean rather than heuristic. The de-lexicalization step is the center of gravity: if the paper really shows that these atoms retain reusable causal structure, it offers a concrete route between explicit search and fast inference.

- **SocialGrid** [5]. The benchmark design is more informative than many “harder environment” papers because it explicitly isolates competing explanations. The Planning Oracle is a simple but powerful intervention: if an agent still reasons socially at near-random chance after navigation is patched, then claims about emergent social competence need to be discounted.

## Open questions

The main unresolved question is how much of this structure is genuinely causal and how much is benchmark-aligned.

For *SGA-MCTS* [1], the open issue is transfer theory. Under what equivalence relation on states and goals do SGA atoms remain valid? Without that, retrieval may just be a very effective nearest-neighbor planner with unclear out-of-distribution behavior.

For *CoEvolve* [2], the unresolved point is stability of the co-adaptation loop. When the agent and task distribution evolve together, what prevents cycling, overfitting to self-generated failure modes, or collapse onto a narrow curriculum?

For *GAM* [3] and *MemEvoBench*'s findings in the background they imply, memory update rules remain underidentified. “Semantic shift” sounds right, but what statistic decides that a memory should consolidate, decay, or be quarantined? Without a sharper rule, robustness claims about long-horizon memory will remain qualitative.

For multi-agent work, *CoopEval* [4] and *SocialGrid* [5] leave a broader question: are we studying agent cognition or game form? If cooperation can be restored mainly by contracts and mediators, then many apparent social deficits may be failures of incentive structure, not reasoning. But if deception detection remains near chance even after planning help [5], there is still a core inference problem that mechanism design alone will not solve.

## The papers

1. **SGA-MCTS: Decoupling Planning from Execution via Training-Free Atomic Experience Retrieval** [1]. The central mechanism is amortized search through de-lexicalized State-Goal-Action atoms rather than online tree search. Its real contribution is to make “retrieval as planning” precise enough to inspect; the caveat is that transfer may depend on benchmark regularities more than the abstraction story admits. Read closely if you care about reusable planning structure.

2. **CoEvolve: Training LLM Agents via Agent-Data Mutual Evolution** [2]. This paper isolates adaptation at the data-distribution level: rollout failures generate the next training tasks. The 19.43%, 15.58%, and 18.14% absolute gains are hard to ignore, but the main caveat is causal attribution—mutual evolution may be less essential than targeted synthesis from uncertainty and forgetting signals. Read it for curriculum-generation logic, not just headline performance.

3. **GAM: Hierarchical Graph-based Agentic Memory for LLM Agents** [3]. The mechanism here is a separation between fast event encoding and slower semantic consolidation, aimed squarely at interference. That makes it a better memory paper than work that merely adds another store or retriever; the caveat is that the trigger for consolidation still needs sharper operational analysis. Read it if you want a concrete memory-update hypothesis.

4. **CoopEval: Benchmarking Cooperation-Sustaining Mechanisms and LLM Agents in Social Dilemmas** [4]. This is valuable because it tests institutional interventions, not just model variants. The important result is that contracting and mediation sustain cooperation better than repetition, especially when co-players vary; the caveat is that it speaks more to equilibrium engineering than to intrinsic social reasoning. Read it if you want clean evidence about coordination mechanisms.

5. **SocialGrid: A Benchmark for Planning and Social Reasoning in Embodied Multi-Agent Systems** [5]. The paper earns its slot because it separates two failure modes that are often collapsed: navigation/planning versus social inference. The strongest result is diagnostic, not leaderboard-oriented: even with a Planning Oracle, agents remain near-random at deception detection and stay below 60% on task completion and planning in the base setting. Read it if you care about evaluation that distinguishes competing explanations.
