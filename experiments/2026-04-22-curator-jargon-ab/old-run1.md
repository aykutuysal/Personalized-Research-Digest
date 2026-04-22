# openai/gpt-5.4 — old-run1

```json
{
  "ok": true,
  "label": "old",
  "run": 1,
  "ms": 24510,
  "cost": 0.025419,
  "totalTokens": 16606,
  "bodyChars": 6277
}
```

## body

## The big picture

The move across these picks is **turning agent capability into infrastructure**. Instead of asking a single model to plan harder, these systems externalize the brittle parts: planning gets amortized into reusable retrieval atoms [1], memory gets split into fast events plus consolidated knowledge graphs [2], adaptation happens through closed-loop task generation [3], evaluation shifts from toy tasks to production or embodied settings [4], and workflow logic itself becomes a typed artifact rather than a Python tangle [5].

## Where things are converging

The clearest convergence is on **decoupling**.

[1] decouples search from execution: heavy MCTS happens offline, then the online agent retrieves de-lexicalized State-Goal-Action atoms as soft hints. [2] does the same for memory by separating event encoding from later consolidation into a topic-associative graph. [5] does it at the orchestration layer, pulling control flow, loops, branching, and state out of prompts and into an explicit execution language. Different layer, same instinct: stop recomputing reasoning every step when you can compile reusable structure.

The second shared trend is that retrieval is getting more agentic. In [1], retrieval is not just fetching documents; it is fetching reusable decision primitives. In [2], retrieval is graph-guided and multi-factor, which is much closer to stateful memory access than top-k similarity search. In [3], the retrieval analogue is on the data side: failure patterns from rollouts are surfaced and fed back into task synthesis, so the training distribution follows the agent’s actual blind spots.

Where they disagree is what to optimize first. [3] says the biggest win is *adaptive training data*: it reports absolute gains of **19.43%**, **15.58%**, and **18.14%** on AppWorld and BFCL across three model setups. [1] argues you can get most of the planning lift without fine-tuning at all by retrieving search-derived atoms, enough for frozen open-weight models to match frontier closed systems. My bet: use retrieval-compiled reasoning first; it is cheaper to ship and easier to debug. Watch adaptive self-generated training with interest, but be skeptical until you know how task synthesis behaves under distribution drift.

## What to steal

- **Precompute reasoning traces into reusable units.** Run search or strong-model rollouts offline, strip entity names into slots, and store state-goal-action chunks you can retrieve at inference time. That is the core pattern from SGA-MCTS [1].

- **Split working memory from long-term memory.** Keep a short-lived event graph for recent interaction state. Consolidate into a longer-lived topic graph only on semantic shifts. That is the anti-interference trick in GAM [2].

- **Train on your own failures, not a frozen task set.** Mine rollout traces for forgetting and uncertainty, synthesize tasks around those failure modes, validate them in the environment, then refresh the data mix. That closed loop is the useful part of CoEvolve [3].

- **Evaluate the whole product, not the base model.** Mix judge-based scoring, reference metrics, formal checks, and UI tests in one harness, because production tasks hide failure modes model eval misses. AlphaEval [4] is the right pressure in this direction.

- **Move orchestration out of prompt soup.** Define loops, branches, submodules, and state explicitly in a workflow spec with checkpointing and verification hooks. AgentSPEX [5] is the cleanest version of that idea in these picks.

## The papers

- **The one to read first: SGA-MCTS** [1]. The mechanism is unusually practical: use MCTS offline to harvest high-value trajectories, compress them into de-lexicalized SGA atoms, then retrieve and re-ground them online as planning hints. Next to [3], it is the opposite philosophy — improve behavior by compiling experience rather than updating weights — and for builders that usually means faster iteration and cleaner failure analysis.

- **GAM** [2] is the memory-system pick because it actually names the storage and consolidation strategy instead of saying “better long-term memory.” Ongoing dialogue lives in an event progression graph; only when the topic shifts does the system merge information into a topic associative network, then a graph-guided multi-factor retriever pulls context back out. Paired with [1], it suggests a broader pattern: store structure, not transcripts.

- **CoEvolve** [3] is the strongest learning result here because the data pipeline adapts with the agent. It extracts failure signals like forgetting and uncertainty from rollouts, uses them to drive LLM-based task synthesis, validates those tasks by real environment interaction, and then retrains on the updated distribution. The headline numbers matter: **19.43%**, **15.58%**, and **18.14%** absolute gains across Qwen2.5-7B, Qwen3-4B, and Qwen3-30B-A3B on AppWorld and BFCL.

- **AlphaEval** [4] matters because most agent teams still overfit to benchmark-shaped tasks. Its contribution is less the 94 tasks than the construction method: translate real production requirements from seven companies into executable evaluations that can mix LLM-as-a-judge, rubric scoring, formal verification, and automated UI testing. Read it next to [5]: one gives you a better way to define agent workflows, the other gives you a better way to tell whether those workflows survive contact with reality.

- **AgentSPEX** [5] is the framework/tooling pick. The useful move is making workflow structure first-class: typed steps, loops, branching, parallel execution, reusable submodules, explicit state, plus a harness with sandboxing, logging, checkpointing, and verification. Compared with the other four, it is less about a new capability and more about making the capabilities in [1]-[4] maintainable enough to live in an actual stack.

A clean way to combine these: author the agent in AgentSPEX [5], use GAM [2] for memory isolation, plug in SGA retrieval [1] as the planning layer, then let CoEvolve [3] generate the next wave of failure-targeted tasks and score the whole thing with AlphaEval-style product evaluation [4]. That stack feels much closer to how robust agents will actually get built than another round of “just prompt the model better.”
