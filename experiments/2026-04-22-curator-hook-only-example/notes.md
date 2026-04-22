# Curator hook-only example ablation — notes

**Setup.** Model: `openai/gpt-5.4`. N=3 per variant. `v2c` = schematic full-body example (lede + what-to-steal + hook). `v2d` = hook-line only in the output-format example.

## Hook firing

| variant | hook fired |
|---|---|
| v2c (full schematic) | 3/3 |
| v2d (hook-only) | 3/3 |

**A one-line hook demonstration is enough.** The full schematic body is not required — stripping everything except the hook line keeps the rule firing at 3/3. This is the minimal viable change.

## MemEvoBench selection drift

| variant | MemEvoBench appears |
|---|---|
| v1 (no personalization layer) | 0/3 |
| v2b (rules, no example) | 0/3 |
| v2c (schematic full body) | 2/3 |
| v2d (hook-only) | **2/3** |
| v2 (cardiology example) | 2/3 |

**The drift is tied to the hook, not to the lede framing.** Stripping the lede/what-to-steal placeholder from the example (v2d) did not reduce the drift. The drift appears the moment *any* example is present alongside the `Writing for this reader` rules. Likely mechanism: the hook rule forces the curator to name "one thing that sticks", and finding a candidate for that line pushes it toward papers that provide a useful counterweight — MemEvoBench is exactly that for a builder reader.

## Side observation — v2d has higher selection variance

v2d-run1 picked NaviRAG (W7154479191) and MCP-Enterprise (W7154887694), both papers that appeared in *no other run across any variant*. The minimal example seems to give less structural guidance about the rest of the body, which shows up as noisier picks. v2c stays closer to the core-5 of SGA-MCTS + GAM + AgentSPEX + AlphaEval + (CoEvolve | MemEvoBench).

## Cost

| variant | avg cost / run |
|---|---:|
| v2c | $0.025 |
| v2d | $0.041 |

v2d averaged higher only because one run billed the non-cached path. Structurally v2d has slightly fewer input tokens.

## Bottom line

- v2d confirms that the hook needs only a one-line demonstration. Minimal surface-area change.
- **The MemEvoBench drift is a property of the hook rule itself**, not of example framing. You can't get the hook win without it, at least on this pool and profile.
- v2d is noisier on non-drift picks (one run pulled two outlier papers). v2c gives more stable "interesting neighbor" framing around the core picks.

So: if the drift is acceptable, v2c is the cleaner choice — same hook rate, more stable selection around the core. If the drift is not acceptable, don't add the hook rule at all — neither example shape avoids it.
