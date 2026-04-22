# openai/gpt-5.4-mini

```json
{
  "ok": true,
  "model": "openai/gpt-5.4-mini",
  "ms": 13066,
  "cost": 0.01786275,
  "totalTokens": 16052,
  "inputTokens": 14499,
  "outputTokens": 1553,
  "referenceIds": [
    "W7154789938",
    "W7154693164",
    "W7154716487",
    "W7154479191",
    "W7154458881",
    "W7154618638",
    "W7154572266",
    "W7154458881",
    "W7155011363",
    "W7155019889",
    "W7154537784",
    "W7154865761",
    "W7154656065",
    "W7154971597",
    "W7155019877"
  ],
  "bodyChars": 7037
}
```

## body

## The big picture

The field is moving from *single-agent prompting* toward **engineered agent systems**: explicit orchestration, typed tool calls, retrieval-aware planning, and built-in evaluation loops. Across these picks, the shared problem is no longer whether an agent can answer a task, but whether it can choose the right tool, keep state clean over time, and stay reliable when the environment pushes back. The strongest signal is that the next gains are coming from structure — workflows, memory architecture, and benchmarked failure modes — rather than from just scaling the base model [1][2][3].

## Where things are converging

Three techniques keep reappearing: hierarchical control, retrieval/planning as a first-class step, and tighter runtime governance. Systems like AgentSPEX and OATS push explicit control flow and action gating, while SGA-MCTS and NaviRAG move “think before retrieve / act” into the core loop instead of leaving it implicit [2][3][4][5]. The disagreement is about where to spend complexity: one camp bets on more structure at build time — specs, typed tools, reusable submodules — while another bets on adaptive search or learning online. The bet to make is on **structured orchestration plus targeted adaptation**; the part to watch skeptically is heavyweight search bolted onto brittle prompts, which still breaks when the model and prompt style mismatch [4][5][6].

## What to steal

- Use a **typed action boundary**. OATS’ allow-list + policy gate idea is the cleanest pattern here: make tool invocation a governed step, not a free-form continuation [6].
- Add a **retrieval planner before retrieval**. NaviRAG and AtomRAG both show that multi-hop work improves when the agent decomposes the information need first, then chooses granularity or subquestions [4][7].
- Treat memory as a **write policy problem**, not just a long context window. GAM and MemEvoBench together suggest you want separate pathways for live dialogue, consolidation, and adversarial/noisy updates [8][9].
- Instrument collaboration with **weak-link diagnosis**. WORC’s useful move is to find the brittle agent and allocate extra budget there instead of uniformly scaling everyone [10].
- For production, evaluate **whole trajectories**, not isolated outputs. AlphaEval, ATBench, and CompliBench all point to task-level, policy-level, or turn-level failure diagnosis as the thing that actually helps you fix systems [11][12][13].

## The papers

**1. AgentSPEX** defines an agent workflow language with typed steps, branches, loops, parallelism, reusable submodules, and explicit state management, then runs that inside a harness with sandboxing, checkpointing, verification, and logging [1]. The real contribution is not just “more structure,” but making agent behavior inspectable and editable without living in Python control spaghetti; it sits naturally next to OATS as the more developer-friendly side of the same push toward governed execution.

**2. Open Agent Trust Stack (OATS)** takes the security side further with declarative tool contracts, compile-time ORGA enforcement, and a policy gate isolated from LLM influence [6]. Compared with AgentSPEX, this is less about authoring convenience and more about zero-trust execution: it is the strongest option here if the stack needs hard pre-execution boundaries rather than just cleaner orchestration.

**3. SGA-MCTS** turns planning into non-parametric retrieval by distilling MCTS trajectories into de-lexicalized State-Goal-Action atoms and then re-grounding them online as reasoning hints [4]. That makes planning reusable instead of purely inferential, and it complements NaviRAG: one is about storing successful action traces, the other about navigating knowledge at the right granularity.

**4. NaviRAG** reorganizes documents hierarchically and lets the agent actively move across levels of detail while tracking information gaps [5]. The mechanism that matters is multi-granular evidence localization; it is a better bet than flat chunk retrieval whenever the answer depends on nested context, and it pairs well with AtomRAG’s explicit query decomposition.

**5. GAM** splits memory into an event progression graph and a topic associative network, only consolidating when semantic shifts occur, then retrieves with graph-guided multi-factor scoring [8]. That design is the clearest practical answer here to long-horizon drift: keep transient interaction noise out of consolidated memory, and retrieve with structure instead of raw similarity alone.

**6. MemEvoBench** stresses memory under adversarial injection, noisy tool returns, and biased feedback, showing that static prompt defenses do not hold up [9]. It is the right companion to GAM because it tests the failure mode the architecture is trying to avoid: memory corruption over time, not just one-shot jailbreaks.

**7. WORC** identifies the weak agent in a multi-agent setup and spends more sampling budget where the system is fragile [10]. That is a useful practical heuristic for agent teams: instead of adding more agents or more debate by default, diagnose where error amplification starts and reinforce that link directly.

**8. AlphaEval** reframes evaluation around production tasks with ambiguous requirements, fragmented inputs, and expert judgment, then compares full agent products rather than model-only demos [11]. It is the most useful reminder in the set that a shiny benchmark win can still miss the failure modes that matter once the workflow includes real deliverables and changing standards.

**9. ATBench** extends trajectory safety evaluation into new execution settings by customizing the policy taxonomy per environment and reusing a shared benchmark pipeline [12]. That makes it a strong blueprint for any internal eval harness: keep the construction machinery stable, but let the risk taxonomy adapt to the tool stack and action surface you actually run.

**10. CompliBench** builds a scalable way to train and test LLM judges on exact guideline violations and the turn where they happen [13]. For agent builders, the practical point is that “judge quality” is itself a system component; if you are using LLMs for compliance, routing, or reward modeling, you need violation localization, not just a coarse pass/fail score.

**11. CoEvolve** closes the loop between rollout failures and task synthesis, using forgetting and uncertainty signals to generate new training tasks from agent behavior itself [14]. That is the most concrete adaptation story in the set: instead of freezing the data distribution, let the agent’s own failure patterns shape what it trains on next.

**12. VoxMind** shows a spoken agent stack that combines think-before-speak reasoning with an auxiliary agent for asynchronous retrieval, which decouples tool load from user-facing latency [15]. It is a useful implementation pattern for any interactive agent where tool breadth threatens responsiveness: move retrieval off the critical path, but keep it aligned to the main reasoning trajectory.
