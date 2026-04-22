# Curator prompt A/B — notes

**Setup.** Model: `openai/gpt-5.4`. N=3 per variant. Same user prompt (`test-curator-user.md`: AI-agents builder reader). Temperature 0.5. `v1` = `prompts/preview-curator-system.md`; `v2` = `prompts/preview-curator-system.v2.md`.

**Changes in v2:**
1. Tightened opening — leads with "for this reader" instead of "for a specific reader".
2. `Inputs` glosses rewritten as use-directives (e.g. "Anchor the lede and implications to what you can infer from this").
3. New section `Writing for this reader` inserted **above** selection rules, consolidating the personalization principle into three concrete rules: situated lede, implications in substance, one take-away hook per issue.
4. Removed redundancy between the old "address as you" bullet and the "reader-located framing" bullet (they said the same thing).
5. Added a before/after cardiology-domain example showing tagging voice vs. situated voice.
6. Replaced the generic `Output format` example (`"First section"`, `"bullet one"`) with a grounded cardiology example showing the shape in action.
7. Removed the redundant "Use `[n]` citations..." bullet from Writing rules (duplicated in Citation numbering section).

## Per-dimension comparison

### Lede anchoring ("situated in reader's live question/decision")

| variant | result |
|---|---|
| v1-run1 | "The field is moving away from 'just give the model more context...'" — field narrative |
| v1-run2 | "The field is moving away from 'let the model think harder'..." — field narrative |
| v1-run3 | "The center of gravity is shifting from 'make the model reason harder'..." — field narrative |
| v2-run1 | "The field is moving away from 'give the model more freedom'..." — field narrative |
| v2-run2 | "The center of gravity is moving away from 'make the model reason harder at runtime'..." — field narrative |
| v2-run3 | "The center of gravity is shifting from 'can the model reason?'..." — field narrative |

**Verdict: rule did not fire.** Both variants default to "the field is moving" framing. The lede rule was the one I expected to land hardest — it didn't.

Diagnosis: the test profile is thin ("Builder of various AI agents who wants to stay on top of the latest developments. Avoids pure theory..."). There's no stated decision, no live question, no patient/pipeline/stack the curator can anchor to. Without richer signal, the model has nothing specific to situate the lede in, so it falls back on field-level generality — exactly as predicted in the earlier discussion about thin profiles. **This confirms the pre-distill step is load-bearing, not optional.**

### Take-away hook

| variant | result |
|---|---|
| v1-run1 | none |
| v1-run2 | none (analytic closing, not a hook) |
| v1-run3 | none (ends with a "be skeptical" line) |
| v2-run1 | ✓ *"If one thing changes implementation priorities this week, it should be this: memory deserves the same threat modeling as tool execution."* |
| v2-run2 | ✓ *"If one thing changes this week, it is this: the durable gains are coming from turning agent behavior into infrastructure, not from one more clever prompt."* |
| v2-run3 | ✓ *"If only one thing sticks: the reusable artifact is becoming the unit of progress — not the prompt, not the model checkpoint, but the memory graph, action atom library, and failure-derived task bank."* |

**Verdict: 3/3 v2, 0/3 v1. Clear win.** The rule fires reliably and the hook reads as a genuine take-away, not scaffolding. This is the strongest signal in the experiment.

### Implications in the reader's terms (inside "What to steal")

Both variants produce concrete builder advice. v2 has slightly more grounded imagined scenarios — e.g. v2-run1: *"If your current agent logic lives across prompts plus Python if-statements, pulling state transitions into a spec will make failures easier to replay and patch"*; v2-run2 invents a concrete atom shape: *"state: missing dependency -> goal: run tests -> action: inspect lockfile"*. v1 has similar but slightly more abstract phrasing.

**Verdict: small edge to v2, not dramatic.** Both prompts already pushed "what to try" concreteness; the change isn't large enough to call a win.

### Tagging-voice leakage

| variant | tagging voice |
|---|---|
| v1 × 3 | none |
| v2 × 3 | none |

**Verdict: no regression, no new risk from the explicit before/after example.** The example didn't cause the model to imitate the wrong version.

### Paper selection

| variant | picks |
|---|---|
| v1-run1 | GAM, SGA-MCTS, CoEvolve, AlphaEval, AgentSPEX |
| v1-run2 | GAM, SGA-MCTS, CoEvolve, AgentSPEX, AlphaEval |
| v1-run3 | SGA-MCTS, GAM, CoEvolve, AlphaEval, SocialGrid |
| v2-run1 | GAM, SGA-MCTS, AgentSPEX, **MemEvoBench, OATS** (security shift) |
| v2-run2 | SGA-MCTS, GAM, CoEvolve, AlphaEval, AgentSPEX |
| v2-run3 | SGA-MCTS, GAM, CoEvolve, AlphaEval, **MemEvoBench** |

**Verdict: v2 drifted toward security-framed papers in 2/3 runs.** MemEvoBench appears in 2 v2 runs (0 v1 runs); OATS appears in 1 v2 run (0 v1 runs).

Most likely cause: the cardiology example in the new output-format block talks about PFA caveats and reconnection-mapping outcomes — a safety/caution register. That register appears to have leaked into what kinds of papers the model finds salient. This is the "example domain bias" risk we flagged conceptually. It's subtle but real.

Mitigation options for next iteration:
- Use a non-technical, non-safety-coded example domain (education, policy, urban planning).
- Make the example schematic ("`## At a glance\n\nIf you're still [decision], this week gives you [count] [kinds]...`") rather than domain-specific.
- Drop the example entirely and rely on the three-rule description.

### Cost / latency

| | v1 avg | v2 avg | delta |
|---|---:|---:|---:|
| ms | 21,544 | 25,693 | +19% |
| input tokens | 14,760 | 15,102 | +342 (+2.3%) |
| output tokens | 1,306 | 1,367 | +4.7% |
| cost per run | $0.045 | $0.047 | +$0.002 |

Longer prompt, marginally longer output, ~$0.002 more per run.

## Bottom line

**Land:** the take-away hook rule. It's the one clean, repeatable win and it's cheap. The rule alone could be ported into v1 without the full v2 restructure.

**Don't land v2 as-is:**
- Lede rule didn't fire on a thin profile — ship the pre-distill step (reader brief) first, then re-test the lede rule against a profile that has a situation/question the rule can actually attach to.
- The cardiology output-format example is subtly biasing paper selection toward security/safety framing. Before landing v2's example, swap it for a non-technical or schematic one and re-run.

**Neutral:** tagging-voice discipline, structural fidelity — both variants are clean.

**Next experiment:**
1. Port *only* the take-away hook rule into v1 and re-run to confirm the hook gain is from that rule specifically, not from other v2 changes.
2. Write a pre-distill prompt that produces a `READER BRIEF` from profile+subject+areas, pipe it into v2, re-run, check whether the lede rule now fires.
3. Try the v2 structure with a schematic (non-domain) output-format example and re-run paper-selection stability against v1.
