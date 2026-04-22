# anthropic/claude-sonnet-4.6

```json
{
  "ok": true,
  "model": "anthropic/claude-sonnet-4.6",
  "ms": 41546,
  "cost": 0.075123,
  "totalTokens": 18613,
  "inputTokens": 17006,
  "outputTokens": 1607,
  "referenceIds": [
    "W7154716487",
    "W7154971597",
    "W7154618638",
    "W7154939277",
    "W7154537784"
  ],
  "bodyChars": 6713
}
```

## body

## The big picture

The field is converging on a shared tension: agents are getting more capable in narrow demos but increasingly fragile in production. The picks this week all orbit that gap — how to make planning more robust, memory more reliable, tool-calling safer, and evaluation more honest about what actually breaks in the wild.

## Where things are converging

Three overlapping trends show up across these papers, and they're worth separating.

**Structured experience reuse is replacing raw context stuffing.** SGA-MCTS [1] and CoEvolve [2] both attack the same planning problem from different angles: instead of shoving more context into the prompt, extract reusable causal primitives offline and retrieve them at inference time. SGA-MCTS distills MCTS trajectories into de-lexicalized State-Goal-Action atoms that frozen models can retrieve without fine-tuning. CoEvolve closes the loop differently — it mines failure signals (forgetting, uncertainty) from rollouts to synthesize new training tasks, so the data distribution evolves with the agent. These aren't competing approaches; they're complementary layers of the same stack.

**Security is moving from heuristic filters to structural enforcement.** Both the UCCA prompt injection framework [3] and the symbolic guardrails work [4] argue that neural mitigations alone can't provide guarantees. UCCA stacks five cryptographic and probabilistic mechanisms (randomized smoothing, erase-and-check, ZK-SNARKs, control barrier functions) to drive attack success below 8% on real LLMs. Symbolic guardrails take a lighter-touch approach — declarative policy rules that cover 74% of benchmark policy requirements with low overhead and no utility loss. The skeptical signal: UCCA's guarantees depend on stated assumptions that may not hold in real deployments, and the 340ms latency overhead compounds in agentic loops. Symbolic guardrails are more immediately deployable.

**Production evaluation is finally getting honest.** AlphaEval [5] is the clearest signal here — 94 tasks sourced from seven companies' actual production pipelines, evaluating complete agent products rather than isolated model capabilities. The benchmark reveals performance gaps that model-level evals miss entirely. Pair this with the finding from SGA-MCTS that frozen open-weights models can match GPT-5-class systems with the right retrieval scaffolding, and the picture is: capability gaps are often infrastructure gaps.

---

## What to steal

- **SGA atom extraction**: Run MCTS offline on your hardest task class, de-lexicalize the winning trajectories into symbolic slots (replace entity names with typed variables), and build a retrieval index. At inference, fetch the top-k atoms and inject them as soft hints before the planning step. This is the core SGA-MCTS move and it requires no fine-tuning [1].

- **Failure-signal-driven task synthesis**: In CoEvolve, the key hook is using *forgetting* (performance drop on previously solved tasks) and *uncertainty* (entropy over action distributions) as signals to trigger new task generation. If you're doing any RL training loop, instrument these two metrics and route high-signal rollouts to a task synthesizer rather than discarding them [2].

- **Symbolic guardrail layer before tool dispatch**: Before any tool call, run a lightweight declarative policy check — allow-list of permitted tool/argument combinations, deny-list of sensitive patterns. The symbolic guardrails paper shows this covers the majority of real policy requirements at near-zero cost and doesn't degrade task completion [4].

- **Production task sourcing for eval**: When building internal evals, use the AlphaEval construction pattern — start from real production requirements, identify implicit constraints (the ones users don't write down), and build rubrics around those. The benchmark's requirement-to-task pipeline is worth adapting [5].

## The papers

**SGA-MCTS** [1] builds a non-parametric planning layer: MCTS explores offline, high-quality trajectories are compressed into de-lexicalized SGA atoms stored in a retrieval index, and at inference a hybrid symbolic-semantic retriever fetches relevant atoms and re-grounds them into the live context. The result is that frozen open-weights models match state-of-the-art systems without any fine-tuning — the compute cost of search is paid once, not per query. This sits as the most immediately actionable planning upgrade in the pool.

**CoEvolve** [2] addresses the static-data problem in RL training: it instruments rollout trajectories for forgetting and uncertainty signals, uses those to prompt an LLM task synthesizer, validates new tasks through environment interaction, and updates the training distribution in a closed loop. Across three Qwen model sizes on AppWorld and BFCL, absolute gains of 15–19% over strong baselines show the loop works. Where SGA-MCTS improves inference-time planning, CoEvolve improves the training distribution itself — they address different bottlenecks.

**UCCA** [3] is the most architecturally ambitious security paper in recent memory for agents: five complementary mechanisms (information-theoretic leakage bounds, certified robustness, erase-and-check token rejection, control barrier functions for trajectory enforcement, and ZK-SNARK verifiable inference) are stacked so that a successful injection must bypass all five simultaneously. Evaluated on GPT-4o, Claude 3.5 Sonnet, and Mistral-7B across four attack benchmarks, attack success rates drop below 8%. The latency overhead (median 340ms) is the real deployment constraint to watch.

**Symbolic Guardrails** [4] takes the opposite bet from UCCA — instead of probabilistic guarantees, it asks which policy requirements can be enforced with zero-cost declarative rules. After reviewing 80 agent safety benchmarks, the authors find 85% lack concrete policies, and among those that do, 74% of requirements are coverable by simple symbolic checks. Evaluated on τ²-Bench, CAR-bench, and MedAgentBench, guardrails improve safety without hurting task completion. The practical implication: add a policy layer before you reach for anything heavier.

**AlphaEval** [5] is the evaluation infrastructure paper the field has needed. Ninety-four tasks from seven production deployments, spanning six O*NET occupational domains, evaluating complete agent products (Claude Code, Codex, etc.) rather than base models. The benchmark surfaces performance variation that model-level evals hide, and the requirement-to-benchmark construction framework — which systematically surfaces implicit constraints from real production requirements — is the most transferable artifact for anyone building internal evals.
