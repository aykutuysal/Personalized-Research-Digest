# Curator output-format example ablation — notes

**Setup.** Model: `openai/gpt-5.4`. N=3 per variant. Same user prompt as earlier A/B.

- `v2` — cardiology example in output-format block (same prompt as earlier A/B)
- `v2b` — output-format block keeps the JSON skeleton but drops the concrete body
- `v2c` — output-format block has a schematic placeholder body (`[open decision]`, `[count]`, `[kinds]`, `[single sentence the reader can hold onto]`), no domain language

## Hook firing (3 rules written in prose, only the example changed)

| variant | take-away hook fired |
|---|---|
| v2 (cardiology example) | 3/3 |
| v2b (no example) | **0/3** |
| v2c (schematic example) | 3/3 |

**The rule alone does not land the hook.** v2b has the exact same three-rule prose in `Writing for this reader` as v2 and v2c; the only thing it's missing is a demonstration in the output-format block. Hook rate collapses from 3/3 to 0/3. Models imitate shapes they see; they don't reliably synthesize them from description.

The schematic placeholder (v2c) teaches the hook just as reliably as the full domain example (v2). The *slot* `[single sentence the reader can hold onto]` is enough of a demonstration.

## Paper-selection drift (MemEvoBench as drift indicator)

| variant | MemEvoBench in picks |
|---|---|
| earlier v1 A/B (no personalization layer) | 0/3 |
| v2 (cardiology) | 2/3 |
| v2b (no example) | **0/3** |
| v2c (schematic) | **2/3** |

**Updated hypothesis: the drift isn't from the cardiology domain — it's from the example's decision-and-tradeoff register.** I was wrong in the previous write-up. Switching to a placeholder-only schematic kept the same drift rate. Both v2 and v2c share the structural phrase *"this week gives you [count] [kinds] that change the terms of the choice"* and the hook-framing at the end. That framing — a decision being weighed, a counterweight that shifts it — biases the curator toward papers that *complicate* a decision. MemEvoBench is exactly that: a memory-safety warning that pushes back on memory-architecture enthusiasm. OATS plays the same role. They get pulled in when the curator is looking for "the one that changes the terms".

The cardiology domain wasn't the real leak. The *decision-oriented framing* of the example was.

Takeaway: the body-shape of the example teaches *what kinds of stories the issue should tell*, not just *how to format sections*. That is either a bug or a feature.

## Lede rule — all 9 runs default to field-narrative

Every one of the 9 runs opens with "The field is moving away from..." or "The center of gravity is shifting from...". This is consistent with the earlier A/B: **the lede rule does not fire on a thin profile**, regardless of the example variant. The three-rule block describes the rule, the example demonstrates it, but the rule still needs a profile that actually contains a decision or live question to anchor on. Without upstream enrichment (the pre-distill "reader brief" step), this rule is a no-op.

## Bottom line

1. **The take-away hook rule needs a worked example in the output-format block to fire.** Without it (v2b), the rule is inert.
2. **A schematic placeholder example is as effective as a full domain example for hook firing** (3/3 vs. 3/3).
3. **But a schematic doesn't eliminate selection drift** — because the drift is register-driven ("this week gives you N kinds that change the terms of the choice"), not domain-driven. Any example that frames the issue as a *decision with a counterweight* will nudge selection toward papers that serve as counterweights.
4. **Drift may be legitimate.** MemEvoBench is a defensible pick for a builder reader. One way to read this: the personalization layer is working — it's pushing the curator away from purely convergent "everyone's doing the same thing" picks toward ones that productively disagree.
5. **Lede rule remains a no-op on thin profiles.** Pre-distill step is load-bearing for that rule to work, regardless of the example variant.

## Recommendations

- **Land v2c** (schematic placeholder example), not v2 (cardiology). Same hook rate, no domain register risk, lower chance of being read as biased toward medical tone if someone inspects the prompt.
- **Treat the selection shift as expected, not a regression.** Have the filter+curator end-to-end evals judged on reader-fit outcomes rather than paper-overlap with a baseline, because the baseline (v1) is itself a choice.
- **The lede rule needs the pre-distill step before it's worth keeping.** As written, it's dead code. Either build the brief-distiller upstream, or remove the lede rule from the prompt for now and re-add it when the brief lands.
