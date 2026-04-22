# openai/gpt-5.4 — builder run2

## format_structure (from onboarding)

1. **The big picture.** Open with a short editorial note anchored in what the reader is building or deciding right now: which agent architecture is looking more viable, where reliability is still blocking deployment, and which new results actually change the tradeoffs for a production-minded builder.
2. **Where the signal is.** Synthesize the strongest common threads across this issue's picks, with an emphasis on approaches that look transferable across use cases rather than narrow demos. Make clear where results are converging, where claims outrun the evidence, and which ideas seem worth taking seriously.
3. **What to steal.** Pull out concrete design patterns, tooling ideas, evaluation habits, or implementation choices the reader could try in their own stack. Phrase each takeaway as a practical move, with enough detail to make the mechanism clear.
4. **What holds up under pressure.** Focus on robustness, failure modes, and evaluation quality: what broke, what generalized, what only worked in a sandbox, and what evidence is strong enough to matter for real systems.
5. **The papers.** Brief per-paper notes placing each pick in context for an agent builder: what was actually built, what technical move matters most, how convincing the validation is, and who should read the full paper.

## voice_language (from onboarding)

Write like an experienced builder sending a sharp personal briefing to another builder. Keep it clear, direct, and technically literate without hiding behind jargon. Prioritize implementation details, transferable patterns, and honest judgment over abstract framing or theory-first discussion. Use plain English for the main read, name specific methods and tools when they matter, and include numbers only when they change the reader's take. Aim for roughly 600 to 800 words total.

## curator output

```json
{
  "referenceIds": [
    "W7154716487",
    "W7154458881",
    "W7154537784",
    "W7155011363",
    "W7154971597"
  ]
}
```

### body

## The big picture

The architecture trend that looks more viable right now is **more structure around the model, not more faith in the model**. The strongest picks here keep pushing the same direction: separate planning from execution, make memory explicit instead of dumping more transcript into context, and evaluate the whole agent product under messy conditions instead of polished benchmark prompts. SGA-MCTS turns planning into reusable retrieval rather than fresh search every run [1]. GAM does the same move for long-horizon memory by splitting event capture from consolidation [2]. AlphaEval is the reminder that a lot of agent claims still evaporate when requirements are implicit, inputs are multimodal, and success is judged the way production teams actually judge it [3].

Reliability is still the blocker. The sharpest warning is MemEvoBench: persistent memory helps continuity, but repeated bad updates can quietly bend behavior over time, and prompt-only defenses do not stop it [4]. On the adaptation side, CoEvolve is one of the few papers here that changes the tradeoff in a useful way: instead of training on a fixed distribution, it uses rollout failures to synthesize new tasks and moved Qwen variants by 19.43%, 15.58%, and 18.14% on AppWorld and BFCL [5]. That is the kind of result worth paying attention to if you are deciding whether your next gain comes from more prompting, more search, or a closed-loop training pipeline.

## Where the signal is

The common thread is **amortization**.

Rather than asking the model to do expensive, brittle reasoning from scratch on every episode, the better systems precompute or compress something reusable. In SGA-MCTS, that reusable object is a library of de-lexicalized State-Goal-Action atoms distilled from MCTS rollouts, then retrieved online as soft hints [1]. In GAM, it is a hierarchical memory graph where short-term event progression stays separate from topic-level knowledge until a semantic shift warrants consolidation [2]. In CoEvolve, the reusable asset is not just a better policy but a better training distribution, updated from the agent's own failure patterns [5].

That matters because it is transferable. These are not narrow tricks for one benchmark. They are all variants of the same engineering bet: capture structure once, reuse it many times, and keep the runtime loop cheap and legible.

The evidence is stronger when papers isolate a real bottleneck. AlphaEval does that well by evaluating complete products on 94 tasks from seven companies, not toy tasks with fully specified requirements [3]. That is a better fit for how agents actually fail in deployment: hidden constraints, fragmented evidence, long-form deliverables, moving judgment criteria. MemEvoBench does the same for long-horizon safety by stressing memory evolution across 7 domains, 36 risk types, and workflow tasks adapted from 20 Agent-SafetyBench environments [4].

Where claims outrun evidence: SGA-MCTS makes a big headline claim about frozen open models matching GPT-5-class systems, but the abstract does not give the benchmark numbers you would want before rewriting your stack around it [1]. GAM sounds practical and the architectural move is clean, but the abstract also stays light on absolute gains [2]. CoEvolve is the most concrete of the bunch because it gives the mechanism and the deltas [5]. AlphaEval is less about a new agent design than about stopping you from fooling yourself [3].

## What to steal

- **Split memory into write-fast and consolidate-slow paths.** Keep raw interaction traces in an event layer, and only promote stable facts or themes into a longer-lived associative layer when a semantic shift occurs. Copy GAM's basic move: separate encoding from consolidation, then retrieve with structure-aware signals instead of raw recency [2].

- **Turn search into assets.** Run expensive exploration offline, distill trajectories into reusable abstractions, and retrieve them online. The key move in SGA-MCTS is de-lexicalizing trajectories into State-Goal-Action atoms so the same causal pattern can transfer across tasks without dragging along domain-specific clutter [1].

- **Train on your failures, not your original benchmark.** Log uncertainty, forgetting, and repeated dead ends from rollouts. Use those traces to synthesize new tasks, validate them in the environment, and feed them back into training. That closed loop is the mechanism behind CoEvolve's 19.43%, 15.58%, and 18.14% gains across three model families [5].

- **Evaluate the agent product, not just the model.** Build tests from real requirements, mixed evidence formats, long-horizon deliverables, and domain-specific judging. AlphaEval's framework mixes LLM-as-a-Judge, rubric scoring, formal verification, reference-based metrics, and automated UI testing because no single metric survives contact with production [3].

- **Red-team memory as a first-class attack surface.** Inject misleading facts, noisy tool outputs, and biased feedback over multiple rounds. Measure drift, not just one-turn jailbreak success. MemEvoBench is useful here because it treats persistence itself as the vulnerability, not an incidental feature [4].

## What holds up under pressure

The most credible results here are the ones that test **whole-system failure modes**.

AlphaEval holds up because it is grounded in deployed workflows rather than synthetic agent puzzles [3]. MemEvoBench holds up because it models a failure mode builders actually create when they add long-term memory: poisoned updates that look harmless locally and dangerous cumulatively [4]. CoEvolve holds up because the improvement comes from a loop that should generalize: mine failures, synthesize harder data, validate in-environment, retrain [5].

The shakier evidence is where abstractions sound elegant but the validation remains benchmark-forward. SGA-MCTS is promising because separating offline search from online execution is exactly the sort of systems trick that scales, but you should want replication on your own tasks before assuming the retrieval atoms are the right abstraction boundary [1]. GAM is plausible and likely useful, but memory systems usually fail at the edges: stale consolidation, retrieval collisions, and hidden contamination from bad tool outputs — exactly the class of problems MemEvoBench suggests you need to test aggressively [2][4].

If you are shipping agents, the operational lesson is simple: structure helps, but **unobserved state is still where systems rot**. Memory, evaluator choice, and data refresh loops now matter as much as prompt quality.

## The papers

- **[1] SGA-MCTS — read this first if your bottleneck is planning latency.** The important move is to precompute MCTS trajectories offline, compress them into reusable SGA atoms, and retrieve them at runtime as soft reasoning hints. That is a cleaner production story than live tree search on every request. Validation sounds strong, but the abstract withholds the numbers that would make the headline fully persuasive.

- **[2] GAM — the memory architecture pick.** What was built is a hierarchical graph memory with an event progression graph plus a topic associative network, tied together by delayed consolidation and graph-guided retrieval. The design choice that matters is isolating transient dialogue noise from stable knowledge. Read the full paper if your agents span sessions and you are tired of transcript stuffing.

- **[3] AlphaEval — the evaluation pick.** This is not another benchmark for isolated model capability; it is 94 production-grounded tasks from seven companies, evaluating full agent products under mixed assessment methods. Read it if you are designing evals for internal launches and need something closer to actual acceptance criteria than leaderboard accuracy.

- **[4] MemEvoBench — the safety pick.** The contribution is a benchmark for long-horizon memory corruption, with QA tasks across 7 domains and 36 risk types plus workflow tasks adapted from 20 Agent-SafetyBench environments. The useful conclusion is blunt: static prompt defenses are not enough once memory updates themselves become adversarial.

- **[5] CoEvolve — the learning loop pick.** The core move is mutual evolution of agent and data: use rollout feedback like forgetting and uncertainty to generate new tasks, validate them by interaction, and update the training distribution. The reported gains — 19.43%, 15.58%, and 18.14% — are large enough to matter if you are trying to improve tool-using agents without endlessly hand-authoring harder tasks.
