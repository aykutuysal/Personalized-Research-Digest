# openai/gpt-5.4

```json
{
  "ok": true,
  "model": "openai/gpt-5.4",
  "ms": 25275,
  "cost": 0.0557625,
  "totalTokens": 15800,
  "inputTokens": 14499,
  "outputTokens": 1301,
  "referenceIds": [
    "W7154716487",
    "W7154458881",
    "W7154789938",
    "W7154971597",
    "W7154537784"
  ],
  "bodyChars": 6303
}
```

## body

## The big picture

The strongest papers are all pushing on the same bottleneck: **agents break less often when you move capability out of a single free-form prompt and into explicit structure**. That structure takes different forms — reusable planning atoms, graph memory, typed workflow languages, production-grounded eval, and closed-loop task generation — but the shared shift is clear: better agents are being built by externalizing planning, memory, and control into artifacts you can inspect, retrieve, optimize, and test, rather than hoping a bigger model improvises reliably [1][2][3][4][5].

## Where things are converging

The convergence trend to bet on is **compiled agent behavior**. *SGA-MCTS* turns search trajectories into reusable State-Goal-Action atoms that can be retrieved at inference time instead of re-solving every problem from scratch [1]. *GAM* does something similar for memory by separating fast event capture from slower semantic consolidation into a topic graph, which avoids the usual “everything goes into one transcript” failure mode [2]. *AgentSPEX* pushes the same idea into orchestration: explicit control flow, typed steps, loops, branches, and checkpointable state instead of Python glue plus giant prompts [3].

Where the signal gets more interesting is disagreement over how much adaptation should happen online. *CoEvolve* says static task distributions are the real limiter and uses rollout-derived signals like forgetting and uncertainty to synthesize new tasks that reshape the training distribution as the agent changes [4]. That is a strong argument for continuous agent-data co-adaptation, but *AlphaEval* is the reality check: agents that look good on curated benchmarks can still fail on long-horizon professional work with implicit constraints and evolving standards [5]. The practical takeaway: bet on retrieval- and workflow-based structure first, because it gives you lower-latency gains and better debuggability now; treat self-evolving training loops as promising, but keep skepticism until they are measured on production-style tasks rather than only benchmark environments [1][4][5].

## What to steal

- **Cache planning as reusable atoms, not full traces.** If you already log successful runs, distill them into de-lexicalized state-goal-action snippets and retrieve them as hints for similar tasks. That is the core move in SGA-MCTS, and it is a cleaner reuse unit than storing entire chains of thought or full demonstrations [1].
- **Split memory into write-fast and consolidate-slow paths.** Keep an event log for immediate interaction state, but only promote information into durable semantic memory when there is a topic shift or repeated salience. GAM’s event graph plus topic associative network is a good pattern if your current “memory” is just vector-search over conversation chunks [2].
- **Make workflow control flow first-class.** Add typed step boundaries, explicit branching, retry loops, and checkpointed state to your agent runtime. AgentSPEX is useful less because of the language itself than because it forces the agent contract to become inspectable and editable without spelunking through orchestration code [3].
- **Generate new training tasks from live failures.** Mine rollout traces for uncertainty spikes, forgotten steps, or repeated dead ends, then synthesize variants that target those failure patterns before the next training cycle. CoEvolve shows this can materially outperform training on a fixed task pool [4].
- **Evaluate the whole product, not just the model.** Mix judge-based scoring, executable checks, UI tests, and rubric grading on tasks that came from real operating requirements. AlphaEval’s main lesson is that the benchmark should reflect hidden constraints, messy inputs, and expert standards, or you will optimize the wrong thing [5].

## The papers

- **SGA-MCTS** builds a retrieval-first planning stack: do the expensive MCTS exploration offline, compress resulting trajectories into de-lexicalized State-Goal-Action atoms, then re-ground those atoms online as soft reasoning hints [1]. Next to GAM and AgentSPEX, it is the clearest example of moving cognition into a reusable artifact; unlike fine-tuning-heavy approaches, it gives you a path to stronger planning with frozen models and much better latency.

- **GAM** introduces a hierarchical graph memory where current interaction events live in an event progression graph and only get consolidated into a topic associative network when semantic shifts justify it [2]. The mechanism matters: it is not “more memory,” it is less interference through staged consolidation plus graph-guided retrieval, which pairs naturally with SGA-style retrieval because both depend on storing abstractions instead of raw transcripts.

- **AgentSPEX** defines an execution language for agents with typed steps, branches, loops, parallelism, reusable modules, explicit state, and a harness with sandboxing, verification, logging, and checkpointing [3]. Compared with the other picks, this is the most directly usable if you are fighting framework sprawl: it turns orchestration decisions into a maintained spec, which also makes AlphaEval-style product evaluation easier because execution paths are no longer hidden in ad hoc prompts.

- **CoEvolve** closes the loop between agent behavior and the data it trains on by extracting failure signals from rollouts — especially forgetting and uncertainty — and feeding them into LLM-based task synthesis, with environment validation before the new tasks enter training [4]. What stands out beside SGA-MCTS is the opposite answer to reuse: instead of reusing past solutions at inference time, it keeps changing the future task distribution so the agent learns from its own blind spots.

- **AlphaEval** is the benchmark pick because it evaluates complete agent products on 94 tasks sourced from seven companies, using a mix of scoring paradigms that match production messiness rather than idealized benchmark assumptions [5]. It complements the other four by giving you the missing test harness: if you adopt graph memory, explicit workflows, or adaptive training, this is the kind of evaluation setup you need to tell whether those changes survive real constraints instead of only improving toy success rates.
