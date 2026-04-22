# openai/gpt-5.4 — v2-run1

```json
{
  "ok": true,
  "label": "v2",
  "run": 1,
  "ms": 25216,
  "cost": 0.058845,
  "totalTokens": 16508,
  "inputTokens": 15102,
  "outputTokens": 1406,
  "referenceIds": [
    "W7154458881",
    "W7154716487",
    "W7154789938",
    "W7155011363",
    "W7154693164"
  ],
  "bodyChars": 6593
}
```

## body

## The big picture

The field is moving away from “give the model more freedom and see what happens” toward **explicitly engineered agent infrastructure**: memory that is structured instead of appended, planning that is retrieved instead of recomputed, and workflows that are specified as systems rather than hidden in prompts. The common thread across these picks is that capability gains now come from better control surfaces around the model—what gets stored, when search is amortized, how execution is constrained, and how production behavior is measured [1][2][3][4][5].

## Where things are converging

The strongest convergence is on *decoupling*. GAM separates fast event capture from slower memory consolidation with a two-layer graph, which is a cleaner pattern than dumping every turn into one long memory stream [1]. SGA-MCTS does the same for planning: expensive search happens offline, then the live agent retrieves de-lexicalized State-Goal-Action atoms as reusable reasoning primitives [2]. AgentSPEX pushes decoupling into orchestration by making control flow, branching, and state explicit in a workflow language instead of burying them in Python callbacks or prompt spaghetti [3].

The security side is also converging on a blunt lesson: prompt-only defenses are not enough once the agent has memory, tools, and long trajectories. MemEvoBench shows that memory itself becomes an attack surface; biased updates and noisy tool outputs slowly bend behavior, and static defenses barely help [4]. OATS takes the opposite stance and moves trust to the execution boundary with declarative tool contracts, a fixed Observe-Reason-Gate-Act loop, and a policy gate that the model cannot rewrite [5]. If there is a trend to bet on, it is **typed interfaces plus runtime enforcement**. The trend to watch skeptically is “more reasoning” as a universal fix; several of these papers implicitly argue that better structure beats more free-form tokens.

## What to steal

- **Split memory into write-fast and consolidate-slow paths.** Keep an append-only event log for recent interaction state, but only promote facts into durable memory when a semantic shift or topic boundary is detected. That is the core move behind GAM, and it is a practical way to reduce interference from transient junk [1].
- **Cache planning as reusable atoms, not full trajectories.** If you already run search, self-play, or expensive traces offline, distill them into slot-filled action templates keyed by state and goal. SGA-MCTS’s de-lexicalized SGA atoms are a good pattern for getting search-time reasoning without paying search-time latency on every request [2].
- **Make workflow state a first-class artifact.** AgentSPEX’s value is not the language itself so much as the discipline: typed steps, explicit branches, explicit loops, explicit checkpoints. If your current agent logic lives across prompts plus Python if-statements, pulling state transitions into a spec will make failures easier to replay and patch [3].
- **Treat memory writes as untrusted input.** MemEvoBench is a useful design reminder: tool outputs, user corrections, and self-summaries should not all land in durable memory with equal weight. Add provenance tags, confidence scores, and delayed promotion for any memory that could steer later decisions [4].
- **Gate actions before execution, not after generation.** OATS’s ORGA loop is the pattern to copy: observe, reason, pass through a policy gate, then act. Even a lightweight version—allow-listed tools, typed arguments, and tamper-evident logs—will buy more reliability than another prompt warning about safe behavior [5].

## The papers

**GAM: Hierarchical Graph-based Agentic Memory for LLM Agents** builds memory as two linked structures: an event progression graph for ongoing interaction state and a topic associative network for consolidated knowledge, with retrieval guided by graph structure instead of plain vector lookup [1]. The practical contribution is the consolidation rule: new context does not immediately contaminate durable memory. Read it next to MemEvoBench and the value becomes clearer—better memory quality is now as much a safety primitive as a recall primitive [4].

**SGA-MCTS: Decoupling Planning from Execution via Training-Free Atomic Experience Retrieval** turns offline MCTS rollouts into reusable State-Goal-Action atoms that strip away entity names but preserve causal structure, then retrieves and re-grounds them online as soft planning hints [2]. That makes this more than another planning paper: it is a recipe for shipping stronger agents on frozen models without expensive online search. It pairs naturally with AgentSPEX, because reusable planning atoms become much more manageable when the surrounding workflow has explicit state and branching [3].

**AgentSPEX: An Agent SPecification and EXecution Language** introduces a workflow language with typed steps, loops, branching, parallel execution, reusable modules, checkpointing, verification, and logging, plus a visual editor and execution harness [3]. The main win is maintainability: the control plane stops being implicit. Among these picks, this is the clearest framework paper, and it complements both SGA-MCTS and OATS by giving you a place to encode planning structure and policy boundaries without hard-wiring everything into Python [2][5].

**MemEvoBench: Benchmarking Memory MisEvolution in LLM Agents** is a long-horizon benchmark for what happens when agent memory slowly drifts under adversarial injections, biased feedback, and noisy tool returns across QA and workflow settings [4]. The useful result is not just that agents fail; it is *how* they fail: gradual memory contamination produces downstream behavior shifts that prompt-layer defenses do not catch. If one thing changes implementation priorities this week, it should be this: **memory deserves the same threat modeling as tool execution** [4].

**Open Agent Trust Stack (OATS): A System Specification for Zero-Trust AI Agent Execution** specifies a model-agnostic execution stack built around declarative tool contracts, an Observe-Reason-Gate-Act loop, cryptographic identity, a formal policy engine, and tamper-evident audit logs [5]. It is more system spec than benchmark, but the design choice is the key mechanism: move the trust boundary out of the model and into pre-execution governance. Put next to MemEvoBench, it reads as the missing half of the story—if memory corrupts what the agent wants to do, OATS is about making sure corrupted intent still cannot cross the action boundary unchecked [4].
