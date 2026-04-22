# openai/gpt-5.4 — builder-run3

```json
{
  "ok": true,
  "label": "builder",
  "run": 3,
  "ms": 23276,
  "cost": 0.0581325,
  "totalTokens": 16458,
  "inputTokens": 15099,
  "outputTokens": 1359,
  "referenceIds": [
    "W7154716487",
    "W7154458881",
    "W7154789938",
    "W7154537784",
    "W7155011363"
  ],
  "bodyChars": 6293
}
```

## body

## The big picture

The move across these picks is **from prompt-shaped agents to systems-shaped agents**. The interesting work is no longer just getting an LLM to reason a bit better; it is about freezing useful reasoning into retrieval units, memory structures, workflow languages, production benchmarks, and security boundaries so agents stay usable under long horizons, real tools, and real failure modes [1][2][3][4][5].

## Where things are converging

The clearest convergence is on *decoupling*. SGA-MCTS turns expensive search into reusable State-Goal-Action atoms that a frozen model can retrieve at run time instead of re-deriving plans every time [1]. GAM does the same move for memory by splitting event capture from later consolidation into a topic graph, which is a cleaner answer than dumping everything into a single stream [2]. AgentSPEX decouples workflow logic from Python glue, making branching, loops, parallelism, and state explicit instead of hidden in prompts [3].

The second trend to bet on is **agent infrastructure that exposes failure surfaces** instead of hiding them. AlphaEval evaluates full agent products on 94 tasks from seven companies, using mixed paradigms rather than one score that papers can game [4]. MemEvoBench does the same for long-horizon memory corruption, with 7 domains, 36 risk types, and workflow tasks adapted from 20 Agent-SafetyBench environments [5]. The field is getting more honest about where agents actually break.

The disagreement is about where to put the intelligence. SGA-MCTS says: do the hard search offline, retrieve compressed reasoning online [1]. GAM says: preserve more structure in memory, then retrieve precisely [2]. AgentSPEX says: force more of the plan into an explicit executable workflow [3]. My bet: use all three. What I would watch skeptically is any claim that a static prompt or a single monolithic memory buffer is enough once the agent spans sessions, tools, and changing state; MemEvoBench is a clean warning that prompt-only defenses do not survive memory drift [5].

## What to steal

- **Cache planning as reusable atoms, not transcripts.** Distill solved trajectories into de-lexicalized state-goal-action snippets and retrieve them as soft hints before tool use. This is the practical idea in SGA-MCTS: pay search cost once, then reuse the causal skeleton across tasks [1].

- **Separate write-time memory from read-time knowledge.** Keep fresh interaction traces in an event log or graph, and only consolidate on semantic shifts. Copy GAM’s split between event progression and topic association if your current memory keeps getting polluted by recent noise [2].

- **Make control flow first-class.** Move agent logic out of giant system prompts and into typed steps with branches, loops, parallel blocks, checkpoints, and explicit state. AgentSPEX is worth stealing even if you do not adopt the language itself; the design lesson is that maintainable agents need inspectable workflows [3].

- **Evaluate the product, not the model.** Build tasks from actual user requirements, heterogeneous inputs, and real deliverables, then score with multiple evaluators. AlphaEval’s requirement-to-benchmark pipeline is the pattern to copy before your next internal eval refresh [4].

- **Red-team memory, not just prompts.** Inject misleading tool outputs, biased feedback, and contaminated long-term notes across repeated sessions. MemEvoBench shows that long-horizon memory safety fails in ways a single-turn prompt-injection test will miss [5].

## The papers

- **The one to read first: SGA-MCTS** [1]. The mechanism is the point: run MCTS offline, compress high-value trajectories into de-lexicalized SGA atoms, then retrieve and re-ground them online with a hybrid symbolic-semantic retriever. Next to GAM and AgentSPEX, it is the strongest argument here that planning should become an artifact your stack can store and reuse, not a fresh inference-time expense on every task.

- **GAM** [2]. Instead of one undifferentiated memory stream, it keeps ongoing dialogue in an event progression graph and only folds information into a topic associative network when semantic shifts happen, then retrieves with graph-guided, multi-factor lookup. That sits neatly beside MemEvoBench: if memory drift is a real attack and reliability problem, structured consolidation is a better primitive than “just summarize harder.”

- **AgentSPEX** [3]. What they actually built is a workflow language plus harness: typed steps, loops, branching, parallel execution, explicit state, reusable modules, sandboxed execution, checkpointing, verification, logging, and a visual editor with synced graph and code views. Relative to the other picks, this is the cleanest tool-layer paper: it complements SGA-MCTS and GAM because both become much easier to operationalize when the surrounding agent runtime has explicit control flow.

- **AlphaEval** [4]. The useful contribution is not another benchmark scorecard but a production-grounded construction method: take requirements from deployed agents, convert them into executable tasks, and evaluate complete products like Claude Code or Codex under mixed assessment modes. Its 94 tasks across seven companies make it a better companion for AgentSPEX than many research benchmarks, because it tells you whether your orchestration stack survives messy inputs and shifting expert judgment.

- **MemEvoBench** [5]. The paper matters because it isolates a failure mode many builders are already creating accidentally: abnormal behavior caused by contaminated memory accumulation over multi-round interaction. With QA tasks over 7 domains and 36 risk types plus workflow tasks from 20 Agent-SafetyBench environments, it pairs well with GAM as both diagnosis and design pressure: if your agent stores across sessions, memory update policy is part of your safety model, not a convenience feature.

The shared direction is pretty clear: build agents as **retrieval-backed, workflow-explicit, memory-disciplined systems**. If you are choosing where to invest engineering time, spend it on reusable reasoning artifacts, structured memory consolidation, and evals that hit the full product surface — then use memory-focused adversarial testing to keep the whole thing honest [1][2][3][4][5].
