# openai/gpt-5.4 — v1-run2

```json
{
  "ok": true,
  "label": "v1",
  "run": 2,
  "ms": 22695,
  "cost": 0.0576,
  "totalTokens": 16140,
  "inputTokens": 14760,
  "outputTokens": 1380,
  "referenceIds": [
    "W7154458881",
    "W7154716487",
    "W7154971597",
    "W7154789938",
    "W7154537784"
  ],
  "bodyChars": 6605
}
```

## body

## The big picture

The field is moving away from “let the model think harder” and toward **making agent capability explicit in the system around the model**: explicit memory structures, explicit reusable planning traces, explicit workflow languages, explicit production-grounded evaluation, and explicit data loops that generate the next failures to train on. Across these picks, the shared problem is not raw reasoning anymore; it is how to keep agents consistent, fast, inspectable, and improvable once they leave toy tasks and start accumulating state, tools, and long-horizon failure modes [1][2][3][4][5].

## Where things are converging

The clearest convergence is on *externalizing competence*. GAM turns memory into a two-level graph with separate event progression and topic association, then retrieves through graph-guided multi-factor search instead of dumping a stream back into context [1]. SGA-MCTS does the same for planning: expensive search happens offline, then gets compressed into de-lexicalized State-Goal-Action atoms that can be retrieved as reusable reasoning hints at runtime [2]. CoEvolve pushes this one step further by treating the training set itself as a live system component: rollout failures such as forgetting and uncertainty become signals for synthesizing the next batch of tasks [3].

The second convergence is on **agent engineering over prompt engineering**. AgentSPEX argues that control flow, loops, branching, state, and verification should live in a workflow language rather than in Python glue or one giant prompt [4]. AlphaEval makes the same bet from the measurement side: if you want to know whether an agent works, you have to evaluate the whole product in production-shaped tasks with heterogeneous inputs, long deliverables, and mixed grading modes, not just benchmark the underlying model [5].

Where the picks disagree is on the best unit of reuse. GAM bets on structured memory objects [1]. SGA-MCTS bets on abstract action primitives distilled from search [2]. CoEvolve bets on regenerating the task distribution itself [3]. If you are choosing where to invest, the near-term safer bet is retrieval over traces, memories, and typed workflow state, because it gives immediate latency and debuggability wins. The thing to watch with more skepticism is any setup that claims adaptation without showing how failures are converted into reusable artifacts or evaluations; the strongest paper here is the one that closes that loop end-to-end, and that is CoEvolve rather than vague “self-improving agent” stories [3].

## What to steal

- **Split working memory from stable memory.** Keep a short-lived event graph for current interaction state, and only consolidate into a topic graph when a semantic shift happens. That is the core GAM trick for reducing interference and stale clutter in long sessions [1].
- **Cache planning as reusable atoms, not full trajectories.** If you already run search or collect strong traces offline, de-lexicalize them into State-Goal-Action templates and retrieve them as soft hints at inference time. This is a practical way to buy some “System 2” behavior without paying search latency on every request [2].
- **Log forgetting and uncertainty as first-class metrics.** CoEvolve treats these as triggers for synthetic task generation, which is a much better training loop than sampling more of the same successful trajectories [3]. If your agent repeatedly drops constraints or hesitates around the same tool boundary, turn those into new evals and new finetuning data.
- **Move workflow logic out of ad hoc code paths.** Typed steps, explicit branching, checkpoints, and verification hooks make failures easier to inspect and replay. Even if you do not adopt AgentSPEX itself, copying that discipline will clean up a lot of agent spaghetti [4].
- **Evaluate the assembled product, not just the model.** AlphaEval’s lesson is to test with messy inputs, implicit constraints, expert-judged outputs, and domain-specific success criteria. If your internal benchmark only measures answer correctness on neat prompts, it is probably missing the failure modes your users actually hit [5].

## The papers

- **GAM: Hierarchical Graph-based Agentic Memory for LLM Agents** builds memory as two connected but distinct structures: an event progression graph for fresh interaction state and a topic associative network for consolidated knowledge [1]. The useful mechanism is the consolidation rule — memory only gets promoted when semantic shifts justify it — plus graph-guided retrieval, which makes this a strong companion to the planning-side compression in SGA-MCTS rather than just another long-context memory store [2].

- **SGA-MCTS: Decoupling Planning from Execution via Training-Free Atomic Experience Retrieval** turns offline search into reusable planning atoms by distilling MCTS trajectories into de-lexicalized State-Goal-Action units [2]. That puts it close to GAM in spirit — both separate expensive structure-building from cheap runtime retrieval — but aimed at action selection rather than memory, and it is one of the more practical answers to the latency-vs-quality tradeoff in agent planning.

- **CoEvolve: Training LLM Agents via Agent-Data Mutual Evolution** closes the learning loop by mining rollout traces for forgetting and uncertainty, then using those signals to synthesize and validate new tasks through environment interaction before updating the data distribution [3]. Compared with SGA-MCTS’s frozen-model retrieval strategy [2], this is the stronger pattern when you control training and want the agent to keep discovering its own blind spots instead of only borrowing prior search results.

- **AgentSPEX: An Agent SPecification and EXecution Language** is the most directly usable framework pick: it gives you typed workflow steps, loops, branches, parallel execution, explicit state, checkpointing, verification, logging, and a visual editor in one harness [4]. Next to GAM and SGA-MCTS, its role is less about adding intelligence and more about giving those capabilities somewhere inspectable to live without burying them in Python orchestration code.

- **AlphaEval: Evaluating Agents in Production** matters because it evaluates complete agent products on tasks sourced from real companies, using mixed evaluation modes such as LLM judges, formal verification, rubric scoring, and UI testing [5]. It pairs naturally with CoEvolve: AlphaEval gives you a more honest failure surface, while CoEvolve suggests one concrete way to turn that failure surface into fresh training and task data [3].
