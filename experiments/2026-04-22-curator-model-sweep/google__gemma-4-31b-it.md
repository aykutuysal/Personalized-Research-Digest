# google/gemma-4-31b-it

```json
{
  "ok": true,
  "model": "google/gemma-4-31b-it",
  "ms": 39693,
  "cost": 0.00246494,
  "totalTokens": 16069,
  "inputTokens": 15241,
  "outputTokens": 828,
  "referenceIds": [
    "W7154716487",
    "W7154693837",
    "W7154458881",
    "W7154591662",
    "W7154693164",
    "W7154888128"
  ],
  "bodyChars": 3321
}
```

## body

## The big picture

We are moving away from the "one big prompt" era toward **architectural decoupling**. The field is wrestling with the instability of long-horizon agents, and the solution is shifting from better models to structured systems that separate reasoning from execution, memory from context, and planning from retrieval.

## Where things are converging

There is a clear convergence on **non-parametric planning**. Instead of asking an LLM to "think step-by-step" in a single pass, new patterns like SGA-MCTS [1] and SA-MCTS [2] use Monte Carlo Tree Search (MCTS) to explore the state space offline or via semantic priors, then retrieve those successful trajectories as "hints" during runtime. This effectively moves the heavy lifting of System 2 reasoning out of the critical path of inference.

On the memory front, the trend is moving toward **hierarchical graph structures**. Both GAM [3] and STG [4] reject the flat vector-store approach in favor of graphs that decouple rapid context updates from stable long-term knowledge. The disagreement lies in the implementation: one focuses on semantic shifts to trigger consolidation [3], while the other implements bio-inspired mechanisms like synaptic pruning and salience decay [4]. For a builder, the bet is on graph-based memory; the skepticism should be reserved for any system claiming "infinite context" without a structured consolidation mechanism.

## What to steal

- **SGA Atoms**: Instead of storing raw trajectories, de-lexicalize them into *State-Goal-Action* atoms (symbolic slots). This allows you to retrieve a causal logic pattern from a different domain and re-ground it into your current context [1].
- **The ORGA Loop**: Implement an *Observe-Reason-Gate-Act* loop where the "Gate" is a structurally isolated policy engine. This prevents the LLM from "convincing" the system to bypass security checks through prompt injection [5].
- **Multi-fork Hypothesis Testing**: When optimizing parameters or searching for solutions, use a "Hypothesis Agent" to spawn parallel simulations (multi-forking) to evaluate multiple candidate sets simultaneously rather than sequentially [6].

## The papers

- **SGA-MCTS** [1] distills MCTS trajectories into de-lexicalized symbolic primitives, allowing frozen models to achieve high-level reasoning at System 1 speeds by treating planning as a retrieval task.
- **SA-MCTS** [2] integrates LLM semantic priors to prune the search width of MCTS, specifically solving the sparse reward problem in complex navigation environments.
- **GAM** [3] implements a hierarchical graph that separates an event progression graph (short-term) from a topic associative network (long-term) to stop transient noise from corrupting stable memory.
- **Cognitive Memory (STG)** [4] builds a memory architecture using nine biological mechanisms, including Hebbian learning and tension tracking, to maintain continuity across dozens of sessions.
- **OATS** [5] provides a zero-trust specification that shifts security from output filtering to pre-execution governance via declarative tool contracts and a verifiable policy engine.
- **CGAgentX** [6] uses a master-worker hierarchy where a specialized Hypothesis Agent coordinates parallel multi-fork simulations to optimize complex model parameters without manual intervention.
