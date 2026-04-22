# openai/gpt-5.4 — researcher run2

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

The strongest papers here are not the ones that add more agent scaffolding. They are the ones that make a narrower claim about *where competence is stored* and then show what follows. Across the five picks, the live question is whether agent performance comes from heavier inference-time search, better externalized structure, better adaptation of the task distribution, or better institutional constraints on interaction. The useful shift is that several papers now try to factor these apart rather than bundling them into a single “agent system” result.

The clearest pattern is a move from end-to-end prompting toward **amortized structure**. SGA-MCTS argues that planning can be compressed into reusable state-goal-action atoms, so online behavior looks less like fresh deliberation and more like retrieval over abstract causal fragments [1]. CoEvolve makes a parallel move on learning: the gain is not just more RL, but closed-loop modification of the data distribution using failure signals extracted from trajectories [2]. On the memory side, GAM claims that the important split is not short-term vs long-term memory in the abstract, but encoding vs consolidation, with interference controlled by when information is promoted into a more stable graph [3].

The multi-agent papers are interesting for a different reason. CoopEval is one of the few papers here that treats cooperation as a mechanism-design problem rather than a prompting style, and it shows that equilibrium-supporting institutions matter more than raw model capability in mixed-motive settings [4]. SocialGrid is valuable because it refuses to let “social reasoning” hide behind navigation failure: the Planning Oracle is an unusually clean attempt to separate planning competence from deception detection and evidence accumulation [5]. After reading these together, the most defensible claims are the ones that isolate a bottleneck by changing the representation or the game, not the ones that merely add more roles, prompts, or tools.

## What seems to be doing the work

Two mechanisms recur.

First, **abstraction that preserves decision-relevant structure while discarding local noise**. SGA-MCTS de-lexicalizes trajectories into State-Goal-Action atoms and uses hybrid symbolic-semantic retrieval online [1]. The proposed source of improvement is not retrieval per se, but reuse of causal substructure learned by offline search. GAM makes a similar claim for memory: keep event progression local, consolidate only on semantic shifts, and retrieve through graph structure rather than a flat stream [3]. In both cases, the core bet is that the right intermediate representation improves generalization by filtering interference.

Second, **training or coordination signals that are endogenous to agent failure**. CoEvolve identifies forgetting and uncertainty in rollouts, synthesizes new tasks around those failure modes, and updates the training distribution accordingly [2]. That is a stronger algorithmic story than generic self-play or data augmentation because the adaptation target is defined by observed behavioral deficits. CoopEval does something analogous at the interaction level: it changes incentive structure through repetition, reputation, mediation, and contracts, then asks which mechanisms actually sustain cooperation [4]. The result that contracting and mediation dominate, while repetition collapses when partners vary, suggests the gain comes from credible commitment and delegated decision rules rather than from emergent prosociality.

The main confound across these papers is evaluation design. Retrieval-based planning can look strong if the abstraction leaks task-template information; memory architectures can look strong if benchmarks reward consistency more than selective forgetting; cooperation mechanisms can look strong if agents mostly respond to explicit payoff reshaping rather than learning stable partner models. SocialGrid is especially useful here because it demonstrates one such confound directly: even with planning assistance, deception detection stays near random chance, so poor social performance is not explained away by locomotion alone [5]. That kind of factorization is still too rare.

## Methods worth reading closely

- **SGA-MCTS** [1]. Read this closely for the representation choice. If the SGA atoms really preserve reusable causal logic while stripping domain-specific lexical content, then this is a serious proposal for amortizing search without fine-tuning. The paper is most informative where it explains atom construction and retrieval, because that is where “planning as non-parametric retrieval” either becomes a real algorithmic idea or collapses into case-based prompting.

- **SocialGrid** [5]. Read this for evaluation design, not leaderboard interest. The Planning Oracle is the key move: it gives you a way to ask whether failure comes from path planning, task execution, or social inference. The reported numbers matter because GPT-OSS-120B stays below 60% on task completion and planning, and deception detection remains at near-random chance even after planning help.

## Open questions

The biggest unresolved question is what these abstractions are invariant to.

SGA-MCTS depends on the idea that de-lexicalized SGA atoms capture causal structure that transfers across tasks [1]. But what is the equivalence class? It is still unclear when two trajectories share enough latent structure for atom reuse to help rather than mislead. GAM raises the same issue in memory form: semantic-shift-triggered consolidation sounds plausible, but the decision boundary for promotion may be highly benchmark-specific [3].

For CoEvolve, the conceptual gap is whether the synthesized task distribution converges to the right curriculum or just chases the current model’s blind spots in a self-reinforcing loop [2]. There is also a deeper identifiability problem: improvements could come from better coverage of rare interactions, from better reward shaping through validation, or from simple extra task volume.

For multi-agent work, the thin spot is still theory of coordination under changing partners and partial observability. CoopEval shows repetition degrades sharply with co-player variation [4], while SocialGrid shows agents fail to accumulate behavioral evidence against deceptive peers [5]. That leaves open whether current agents lack the right belief-update mechanism, the right memory over opponent behavior, or simply the right training distribution to learn contingent strategies.

## The papers

1. **SGA-MCTS: Decoupling Planning from Execution via Training-Free Atomic Experience Retrieval** [1]  
   The mechanism is the paper: offline MCTS creates de-lexicalized State-Goal-Action atoms, and online planning becomes retrieval plus re-grounding rather than fresh search. Its real contribution is a concrete hypothesis about how to amortize System-2-style search into reusable primitives; the caveat is that transfer depends entirely on whether those atoms encode genuine causal regularities rather than benchmark templates. Read it closely if you care about planning representations more than agent wrappers.

2. **CoEvolve: Training LLM Agents via Agent-Data Mutual Evolution** [2]  
   This is one of the cleaner adaptation stories in the pool because it uses forgetting and uncertainty from rollouts to steer task synthesis, then validates those tasks through environment interaction. The reported absolute gains — 19.43%, 15.58%, and 18.14% across three model settings on AppWorld and BFCL — are large enough to matter, but the deeper question is whether the benefit comes from failure-targeted curriculum construction or from a more mundane expansion of task coverage. Read it if you want mechanism-level ideas about non-static training distributions.

3. **GAM: Hierarchical Graph-based Agentic Memory for LLM Agents** [3]  
   GAM isolates a specific memory claim: interference is reduced by separating fast event encoding from slower consolidation into a topic-level associative graph. That is more informative than generic “long-term memory helps” papers because it specifies what should be stored where and when; the caveat is that the abstract does not yet tell you how sensitive the gains are to the semantic-shift trigger or retrieval heuristics. Read it if your interest in memory is really about representational stability.

4. **CoopEval: Benchmarking Cooperation-Sustaining Mechanisms and LLM Agents in Social Dilemmas** [4]  
   The contribution here is not another multi-agent benchmark but a comparative test of equilibrium-supporting mechanisms. The sharp result is that contracting and mediation work best, while repetition-induced cooperation deteriorates when co-players vary, which is strong evidence against naive hopes that better reasoning alone yields robust cooperation. Read it if you want to think about coordination as institutional design rather than conversational style.

5. **SocialGrid: A Benchmark for Planning and Social Reasoning in Embodied Multi-Agent Systems** [5]  
   SocialGrid earns its place because it tries to separate confounded competencies inside embodied multi-agent evaluation. The Planning Oracle is the central idea: once planning deficits are partially controlled, agents still fail to detect deception at near-random chance, which argues that social inference is a distinct bottleneck rather than a side effect of poor navigation. Read it if you care about whether current benchmarks actually identify the mechanism of failure.
