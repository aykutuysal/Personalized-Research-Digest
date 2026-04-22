# openai/gpt-5.4 — researcher run3

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

The mechanism-level question running through this set is simple: when an agent gets better, **what exactly was improved**? Not “the stack,” not “the workflow,” but the operative unit of competence. These papers are strongest when they replace vague claims about better planning or adaptation with a sharper object: retrieved planning atoms, an evolving task distribution, a specific cooperation mechanism, a decomposed memory architecture, or a benchmark that removes one confound so another failure becomes visible.

The most convincing shift is away from treating agent ability as a monolith. SGA-MCTS argues that a large part of planning can be amortized into reusable state-goal-action abstractions rather than recomputed online [1]. CoEvolve makes a parallel move on learning: improvement comes less from generic RL pressure than from iteratively reshaping the training distribution around uncertainty and forgetting signals extracted from the agent’s own failures [2]. In both cases, the algorithmic story is about converting expensive interaction into reusable structure.

The other three papers matter because they stress-test that story. GAM asks whether long-horizon competence depends on separating transient event traces from consolidated semantic memory, instead of writing everything into one stream [3]. CoopEval asks whether cooperation in multi-agent settings is really a property of the model, or of the institutional mechanism wrapped around the interaction; its answer leans hard toward the latter [4]. SocialGrid is useful precisely because it shows how often “social reasoning” claims are contaminated by basic planning and navigation failures, then gives an oracle to factor them apart [5]. After reading these together, the structurally justified claims are the ones that isolate a reusable representation or an interaction mechanism and then show what changes when that variable is actually controlled.

## What seems to be doing the work

Across the strongest papers, the recurring source of improvement is **structured decomposition with controlled reuse**.

SGA-MCTS [1] isolates this most cleanly. Its claim is not merely that search helps, but that offline search can be compressed into de-lexicalized State-Goal-Action atoms that preserve causal structure while stripping away instance noise. If that holds, the gain should travel to frozen models without fine-tuning, and the paper claims exactly that. The key mechanism is amortization: expensive deliberation becomes retrieval over reusable primitives rather than repeated online tree expansion.

CoEvolve [2] tests a related idea in learning rather than planning. The proposed source of improvement is not just synthetic data generation, which would be easy to dismiss as distribution padding, but a closed loop where rollout-derived signals—specifically forgetting and uncertainty—select failure modes, then drive new task synthesis and validation. The reported gains of 19.43%, 15.58%, and 18.14% across three model settings are large enough to matter, but the mechanism only really holds if those signals identify genuinely undercovered interaction patterns rather than simply hard examples near the benchmark metric.

GAM [3] makes a narrower architectural claim: interference in long-term agent memory comes from collapsing fast-changing context and durable knowledge into the same representational store. Its event progression graph plus topic associative network is an explicit attempt to separate acquisition from consolidation. That is a real mechanism, not just a storage redesign, because it predicts where robustness should come from: fewer harmful updates from transient noise and more precise retrieval after semantic shifts.

CoopEval [4] is useful because it relocates causality from “better reasoning” to **game structure**. Contracting and mediation outperform repetition, and repetition degrades sharply when co-players vary. That pattern weakens naive stories in which more capable agents simply infer reciprocity better. The paper instead supports a mechanism closer to equilibrium design: cooperation persists when the environment changes incentives or delegates decisions through stabilizing institutions.

SocialGrid [5] contributes by ruling out a confound. If agents fail an embodied social benchmark because they cannot navigate, then any conclusion about deception detection or evidence accumulation is underidentified. The Planning Oracle is therefore the core idea: a way to hold low-level planning fixed and ask whether social inference itself improves. The answer appears to be no; even with planning help, deception detection stays near random chance [5].

## Methods worth reading closely

- **SGA-MCTS** [1]. Read this closely for its representational bet: de-lexicalized planning atoms as the unit that transfers. If the ablations really show that symbolic-semantic retrieval matters more than either raw search or raw demonstrations, then this is one of the cleaner accounts of how to get System-2-style behavior without paying System-2 inference cost every time.

- **SocialGrid** [5]. Read this for evaluation design rather than raw scores. The Planning Oracle is an unusually informative intervention because it separates embodied control failure from social reasoning failure, which many agent benchmarks currently entangle. If you care about identifying mechanisms rather than leaderboard movement, that separation is the point.

## Open questions

The main unresolved issue is whether these reusable structures are **causal abstractions or just convenient compressions**.

For SGA-MCTS [1], the open mathematical question is what invariances an SGA atom must preserve to transfer across tasks. De-lexicalization may remove nuisance variation, but it can also erase task-specific constraints that matter for action validity.

For CoEvolve [2], the underidentified piece is curriculum dynamics. Do forgetting and uncertainty expose latent task families the agent truly lacks, or do they overweight brittle edge cases created by the current evaluator and environment? Without stronger analysis of the induced data distribution, it is hard to know when mutual evolution converges versus chases its own artifacts.

For GAM [3], the missing question is when semantic-shift-triggered consolidation helps versus delays needed updates. Any memory system that protects against interference also risks preserving stale beliefs too long.

For multi-agent work, CoopEval [4] and SocialGrid [5] together expose a broader gap: current evaluations still struggle to distinguish failures of preference alignment, incentive design, epistemic inference, and low-level control. Until those are more cleanly separated, many claims about collaboration or social intelligence will remain too coarse.

## The papers

1. **SGA-MCTS: Decoupling Planning from Execution via Training-Free Atomic Experience Retrieval** [1]. The core contribution is to treat planning as retrieval over de-lexicalized experience atoms rather than as online search or fine-tuned policy imitation. Read it closely if you care about reusable causal structure in action selection; the caveat is that the abstract leaves open exactly how robust the abstraction is under distribution shift.

2. **CoEvolve: Training LLM Agents via Agent-Data Mutual Evolution** [2]. This paper isolates adaptive data generation as the driver, using forgetting and uncertainty from rollouts to update the task distribution. The gains—19.43%, 15.58%, and 18.14%—are hard to ignore, but the real question is whether the loop learns missing capabilities or merely tracks benchmark-shaped failure pockets.

3. **GAM: Hierarchical Graph-based Agentic Memory for LLM Agents** [3]. The mechanism here is memory separation: event progression for local, transient context and a topic-level associative graph for consolidated knowledge. It is worth reading if you want a concrete answer to why stream-style memory interferes with itself; the caveat is that better retrieval and better consolidation are still somewhat entangled in the reported improvement.

4. **CoopEval: Benchmarking Cooperation-Sustaining Mechanisms and LLM Agents in Social Dilemmas** [4]. The interesting result is not that models defect, but that contracting and mediation sustain cooperation better than repetition, especially when partners vary. Read this if you want a cleaner account of how institutional mechanism design can dominate model capability in multi-agent outcomes.

5. **SocialGrid: A Benchmark for Planning and Social Reasoning in Embodied Multi-Agent Systems** [5]. This earns its place because it explicitly factors planning competence from social inference with a Planning Oracle. Read it if you are tired of benchmarks that report “social reasoning” while agents are still failing at navigation; the caveat is that benchmark realism and mechanism isolation still pull in opposite directions, as they usually do.
