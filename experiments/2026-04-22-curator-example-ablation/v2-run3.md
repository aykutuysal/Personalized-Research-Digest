# openai/gpt-5.4 — v2-run3

```json
{
  "ok": true,
  "label": "v2",
  "run": 3,
  "ms": 27150,
  "cost": 0.024999,
  "totalTokens": 16498,
  "inputTokens": 15102,
  "outputTokens": 1396,
  "referenceIds": [
    "W7154458881",
    "W7154716487",
    "W7154537784",
    "W7154789938",
    "W7155019889"
  ],
  "bodyChars": 6771
}
```

## body

## The big picture

The center of gravity is shifting from “make the agent reason harder” to **make the agent’s state and control surfaces explicit**. The strongest picks here all externalize something that used to stay buried in prompts or latent behavior—memory structure, reusable planning atoms, production evaluation criteria, workflow control flow, or the weak point inside a multi-agent team—so you can inspect it, swap it, and improve it without retraining the whole stack [1][2][3][4][5].

## Where things are converging

Three technique lines are showing up at once. First, *structured external memory* is getting less like a transcript store and more like a data model: GAM separates short-term event progression from consolidated topic memory, then retrieves with graph-guided signals instead of plain semantic similarity [1]. Second, planning is getting amortized into reusable artifacts rather than re-derived every run: SGA-MCTS turns expensive search traces into de-lexicalized State-Goal-Action atoms that can be retrieved as soft hints at inference time [2]. Third, the operational layer is being treated as a first-class product surface: AgentSPEX gives workflows typed steps, branches, loops, and explicit state [4], while AlphaEval evaluates complete agent products against messy production tasks rather than benchmark-clean prompts [3].

The disagreement worth watching is where adaptation should live. WORC says multi-agent gains often come from **budgeting more reasoning for the weakest role** instead of upgrading the strongest one [5]. SGA-MCTS argues you can front-load the hard thinking offline and keep online execution cheap [2]. GAM makes the same trade in memory form: spend effort on consolidation boundaries so retrieval stays clean later [1]. If building cost-sensitive systems is the goal, the safer bet is on architectures that move work out of the hot path. Be more skeptical of approaches that add another live deliberation loop unless they also expose a clear control knob, like WORC’s repeated-sampling allocation [5].

## What to steal

- **Split memory into “events” and “beliefs.”** Don’t dump every interaction into one vector store. Keep a high-churn session/event log, then promote only semantically stable facts or topic summaries into a longer-lived associative layer, the way GAM separates an event progression graph from a topic network [1].
- **Cache planning as reusable atoms, not full trajectories.** If you already collect successful traces, compress them into templated state-goal-action snippets with slots for entities and parameters. At run time, retrieve the snippet and re-ground it instead of asking the model to rediscover the whole plan [2].
- **Add a “weak-link” allocator to multi-agent teams.** Track which role most often causes downstream failure, then give only that role extra samples, critique rounds, or verification budget. WORC’s core idea is that stability improves faster when you patch the bottleneck agent than when you globally increase compute [5].
- **Move orchestration out of Python glue where possible.** Typed workflow steps, explicit branches, checkpointing, and inspectable state make failure analysis much easier than prompt spaghetti. AgentSPEX is a reminder that maintainability is a capability multiplier, not a cleanup task [4].
- **Evaluate the product, not just the model.** Pull a handful of real tasks with hidden constraints, heterogeneous inputs, and expert-scored outputs, then measure your whole agent stack—including tools, prompts, retries, and UI assumptions—the way AlphaEval evaluates deployed systems instead of base models [3].

If only one thing sticks: the next step up in agent quality is coming from **better serialized state and workflow structure**, not just smarter base models.

## The papers

- **GAM: Hierarchical Graph-based Agentic Memory for LLM Agents** builds memory as two linked structures with different jobs: an event progression graph for fresh interaction context and a topic associative network for more stable consolidation [1]. The useful mechanism is the promotion rule—only integrating into long-term structure on semantic shifts—plus graph-guided retrieval, which is a much more practical recipe than “long-term memory” as a single retrieval bucket. It pairs naturally with SGA-MCTS: both turn expensive online reasoning into reusable external artifacts.

- **SGA-MCTS: Decoupling Planning from Execution via Training-Free Atomic Experience Retrieval** is one of the more actionable planning ideas in the pool: run MCTS offline, distill the good trajectories into de-lexicalized State-Goal-Action atoms, and retrieve those atoms online as reasoning hints [2]. That gives you search depth without paying search latency every time, and it is exactly the kind of pattern that can live inside an existing agent runtime with frozen models. Compared with AgentSPEX, it solves the content of planning rather than the control flow; together they suggest a clean separation between reusable reasoning primitives and executable workflow.

- **AlphaEval: Evaluating Agents in Production** matters because it changes what counts as evidence when choosing an agent stack [3]. Instead of curated benchmark tasks with crisp specs, it evaluates commercial agent products on real company tasks with implicit constraints, messy multimodal inputs, long-form deliverables, and changing expert judgments. Read it next to AgentSPEX: one says agents need explicit, inspectable execution structure; the other shows why that structure is necessary when production failures come from the system boundary, not just the model.

- **AgentSPEX: An Agent SPecification and EXecution Language** replaces reactive prompt orchestration with a workflow language: typed steps, loops, branches, parallel execution, reusable modules, explicit state, plus a harness with sandboxing, verification, logging, and checkpointing [4]. For builders, the main contribution is not the language syntax itself but the decision to make control flow a serializable artifact that can be edited, visualized, and audited. It sits on the same trajectory as GAM and SGA-MCTS: move hidden agent behavior into data structures you can version.

- **Weak-Link Optimization for Multi-Agent Reasoning and Collaboration** offers a nice corrective to the usual “add more expert agents” instinct [5]. WORC first predicts which agent role is the weak link from task features, then allocates extra repeated-sampling budget specifically to that role, improving stability without uniformly raising cost. That complements the other four papers well: once memory, plans, workflows, and evaluation are explicit, weak-link targeting becomes the obvious next optimization loop rather than brute-force scaling.
