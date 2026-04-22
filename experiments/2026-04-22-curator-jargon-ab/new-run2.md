# openai/gpt-5.4 — new-run2

```json
{
  "ok": true,
  "label": "new",
  "run": 2,
  "ms": 20991,
  "cost": 0.02318,
  "totalTokens": 16761,
  "bodyChars": 5947
}
```

## body

## The big picture

The move across these picks is **shifting agent capability out of the prompt and into infrastructure**. Instead of asking one model to think harder at runtime, the strongest work here externalizes competence into structured memory [1], reusable planning snippets discovered offline [2], closed-loop data generation [3], explicit workflow languages [4], and production-grounded evaluation harnesses [5]. The field is getting less mystical: better agents now look more like systems that cache, compile, retrieve, and verify.

## Where things are converging

The convergence is on *amortization*: pay the expensive reasoning cost once, then reuse it. GAM [1] amortizes long-term context by separating fast event capture from slower consolidation into a topic graph. SGA-MCTS [2] amortizes search by turning offline tree search traces into reusable state-goal-action atoms that can be retrieved as hints at inference time. CoEvolve [3] amortizes failures by mining rollout traces for forgetting and uncertainty, then synthesizing new tasks to reshape the training distribution.

The disagreement is about where to put the control surface. AgentSPEX [4] bets on **explicit control flow** — typed steps, branching, loops, checkpointing, verification — so the agent is inspectable before it runs. AlphaEval [5] is the reminder that elegant architecture claims do not matter unless they survive messy production tasks with implicit constraints, multimodal inputs, and expert scoring. If I had to bet, I’d bet on retrieval-heavy and workflow-explicit systems first. The thing to watch skeptically is any result that comes only from giving the model more free-form reasoning budget without changing memory structure, execution scaffolding, or evaluation realism.

## What to steal

- **Split short-term from long-term memory.** Copy GAM’s pattern: keep an event stream for recent interaction state, and only consolidate into a stable topic graph when the conversation or task actually shifts [1]. Don’t let every transient tool output become durable memory.

- **Store planning snippets, not just transcripts.** Run expensive search or trajectory mining offline, strip task-specific names out of successful plans, and save reusable state-goal-action templates you can re-ground later [2]. This is the cleanest way here to get better planning from frozen models.

- **Generate new tasks from your failures.** Log uncertainty spikes, forgetting, and repeated dead ends from real rollouts; feed those patterns into task synthesis; validate the generated tasks in the environment before adding them to training [3]. CoEvolve reports absolute gains of 19.43%, 15.58%, and 18.14% on AppWorld and BFCL across three base models, which is large enough to justify building the loop.

- **Move agent logic out of Python glue where possible.** Use a workflow spec with typed state, branches, loops, and reusable modules so you can diff behavior as a program, not as a pile of prompts [4]. Even if you do not adopt AgentSPEX directly, the pattern is worth stealing.

- **Evaluate the product, not the model.** Borrow AlphaEval’s framing: test the whole agent stack against real deliverables, mixed evaluation methods, and domain-expert judgment instead of only clean benchmark tasks [5]. If your current eval cannot express hidden requirements or long-horizon outputs, it is probably flattering your system.

## The papers

**GAM** [1] builds a two-layer memory system that separates live interaction state from consolidated knowledge. The useful mechanism is the handoff rule: ongoing dialogue lives in an event progression graph, and only semantically meaningful shifts get merged into a topic associative network, then a graph-guided retrieval step pulls context back with more precision. Next to SGA-MCTS [2], it shows the same broader pattern: structure first, retrieval second.

**SGA-MCTS** [2] is the one I’d read first. It uses offline tree search to discover good trajectories, compresses them into reusable planning atoms with task-specific words stripped out, and retrieves those atoms online as soft reasoning hints. That puts it in the sweet spot between brittle hand-authored workflows and expensive inference-time search, and it pairs naturally with memory systems like GAM [1] or workflow layers like AgentSPEX [4].

**CoEvolve** [3] is the strongest learning-system pick because it closes the loop between agent behavior and training data instead of treating the dataset as fixed. The mechanism is practical: detect failure-prone patterns from rollouts using forgetting and uncertainty signals, synthesize new tasks targeting those gaps, validate them through environment interaction, then retrain on the updated distribution. It complements SGA-MCTS [2]: one reuses solved reasoning traces at inference time, the other manufactures the next tranche of hard cases for training.

**AgentSPEX** [4] matters because it treats agents as explicit programs rather than prompt-shaped fog. The specification language gives you typed steps, branching, loops, parallel execution, reusable submodules, explicit state, plus a harness with sandboxing, checkpointing, verification, and logging. Compared with the adaptive systems here [1][2][3], AgentSPEX is the counterweight: less emergent behavior, more inspectable control, which is exactly what you want when an agent starts to sprawl.

**AlphaEval** [5] is the paper that should change how you judge all the others. It packages 94 tasks from seven companies across six work domains and evaluates full agent products with mixed methods including LLM judging, reference-based metrics, formal verification, rubric scoring, and automated UI testing. In context with the other picks, it is the reality check: if your memory architecture [1], planning retrieval layer [2], learning loop [3], or workflow DSL [4] cannot survive production-style ambiguity, the benchmark table was never the point.

