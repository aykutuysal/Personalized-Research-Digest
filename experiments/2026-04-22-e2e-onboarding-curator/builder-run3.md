# openai/gpt-5.4 — builder run3

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
    "W7155008820",
    "W7154537784",
    "W7154971597"
  ]
}
```

### body

## The big picture

The architecture trend that looks more real this round is **structured agents that externalize hard cognition** instead of trying to get one model to do everything in one pass. The strongest results come from systems that split planning from execution, turn search or memory into reusable artifacts, and then retrieve those artifacts cheaply at runtime [1][2]. For a production stack, that changes the tradeoff: spend compute offline to build better plans, memories, and evals; keep online inference narrower, faster, and easier to inspect.

Reliability is still the blocker. The most useful new evidence says the failures are not just prompt-level mistakes. They accumulate through memory drift, weak evaluation, and environment mismatch between lab tasks and deployed systems [3][4]. The papers worth your time here are the ones that actually expose those failure surfaces instead of hand-waving past them.

## Where the signal is

The clearest convergence is on a simple idea: **amortize expensive reasoning**. SGA-MCTS does it by running Monte Carlo Tree Search offline, distilling trajectories into de-lexicalized State-Goal-Action atoms, and retrieving them later as soft hints for a frozen model [1]. GAM does something similar for long-horizon interaction, separating fast event capture from slower consolidation into a topic-level graph so short-term noise does not overwrite durable knowledge [2]. CoEvolve applies the same instinct to training data: instead of static RL data, it uses rollout failures, uncertainty, and forgetting signals to synthesize the next tasks the agent should train on [5].

That pattern looks transferable because it is not tied to one domain or one model family. It is a way of moving intelligence out of the prompt and into artifacts your system can version: memory graphs, search atoms, synthesized tasks.

Where claims outrun evidence: some of the security and orchestration work is directionally interesting, but the papers that matter more right now are the ones with validation against realistic tasks or concrete failure analysis. AlphaEval earns attention because it evaluates complete agent products on 94 tasks from seven companies, using mixed paradigms instead of one judge metric [4]. SocialGrid matters for the same reason in embodied multi-agent work: even with planning help, social reasoning still breaks, and deception detection stays near random chance [3]. That is a stronger signal than another paper claiming a new multi-agent pattern from a narrow demo.

The other useful convergence is less flattering: stronger agents still fail in ways that look operationally familiar. They get stuck in loops, rely on shallow heuristics, overfit to static benchmarks, and degrade when memory gets contaminated [3][4][2]. If you are deciding whether to deploy more autonomy or more scaffolding, this batch argues for more scaffolding.

## What to steal

- **Precompute search, then retrieve plans instead of rethinking everything online.** Copy the SGA-MCTS pattern: use MCTS or another expensive planner offline, distill trajectories into reusable state-goal-action units, de-lexicalize them so they survive entity changes, and retrieve them at runtime as hints rather than hard scripts [1]. This is the cleanest route here to getting deeper planning without paying search latency on every request.

- **Split memory into capture and consolidation layers.** Store interaction flow in an event graph first. Promote only semantically stable material into a higher-level associative graph when the topic actually shifts [2]. That is a practical way to reduce interference, especially if your agents work across long sessions or customer threads.

- **Train on your agent’s own blind spots, not a frozen task set.** Log uncertainty, forgetting, and repeated failure patterns from rollouts. Synthesize new tasks around those patterns, validate them in-environment, and feed them back into training [5]. CoEvolve reports absolute gains of 19.43%, 15.58%, and 18.14% on AppWorld and BFCL across Qwen2.5-7B, Qwen3-4B, and Qwen3-30B-A3B [5]. The move to copy is the closed loop, not the exact model recipe.

- **Benchmark the product, not just the model.** Build evals the way AlphaEval does: take real requirements, preserve implicit constraints, and score with multiple paradigms when one metric cannot see the whole failure surface [4]. If your agent touches tools, documents, UI, or long-form deliverables, single-number model evals are lying to you.

- **Separate planning quality from environment competence.** Use oracle or assisted settings the way SocialGrid does to isolate whether the failure is navigation, execution, or social reasoning [3]. Do this before you spend weeks tuning prompts for what is really an environment bottleneck.

## What holds up under pressure

The most credible robustness result here is not a defense paper. It is the combination of evaluation work showing where agents break when the environment stops being toy-like.

AlphaEval is the strongest evidence on that front because it uses production-grounded tasks with heterogeneous inputs, implicit requirements, long-horizon outputs, and evolving human standards [4]. That is much closer to what breaks real agent systems than leaderboard-style capability tests.

SocialGrid also holds up because it does the diagnostic work. The top open model stays below 60% on task completion and planning, and when planning is partially patched with an oracle, **social reasoning remains the bottleneck** [3]. That is exactly the kind of decomposition you need if you are building embodied or multi-agent systems and trying to figure out what to fix first.

On memory, GAM is promising because it attacks a real long-horizon failure mode with a mechanism that makes operational sense [2]. But MemEvoBench is the warning label you should keep in mind: memory is not just helpful state, it is an attack and drift surface, and static prompt defenses are not enough [2].

CoEvolve is convincing enough to matter because it validates on AppWorld and BFCL rather than a synthetic micro-benchmark, but the pressure test for you is whether the synthesized tasks improve your own environment rather than just broad benchmark coverage [5].

## The papers

- **[1] SGA-MCTS** — Read this first if you care about planning latency. The key move is turning search trajectories into de-lexicalized SGA atoms and retrieving them online instead of rerunning search. The validation claim is aggressive — frozen open-weight models matching frontier systems without task-specific fine-tuning — but the mechanism is concrete and reusable.

- **[2] GAM** — The memory pick. What was built is a two-layer graph memory: event progression for fresh context, topic association for consolidated knowledge, plus graph-guided retrieval. This matters if your current memory stack is just a growing transcript with summaries taped on top.

- **[3] SocialGrid** — The best reality check in the set for multi-agent and embodied work. It gives you failure analysis, an optional Planning Oracle, and evidence that deception detection is near random chance even after planning help. Read it if your agents need to infer intent from behavior, not just complete tasks.

- **[4] AlphaEval** — The eval paper that actually changes process. It benchmarks complete agent products on 94 tasks from seven companies and mixes LLM judges, formal verification, rubric scoring, and automated UI testing. Read it if your current eval harness still assumes clean specs and deterministic answers.

- **[5] CoEvolve** — The learning pick. The important build choice is mutual evolution between the agent and its training distribution, driven by rollout-derived failure signals. Read it if you are past prompt iteration and want a disciplined way to improve an agent from its own operational traces.
