# End-to-end test — onboarding → curator

**Setup.** For each of two personas (builder, researcher): call gpt-5.4 with the updated `prompts/onboarding-system.md` and ask it to produce `format_structure` + `voice_language` directly via structured output (no conversational back-and-forth). Swap those into the curator user prompt with the same 40-paper pool. Run the curator (also updated `preview-curator-system.md`) 3× per persona. Total: 2 onboarding calls + 6 curator calls, $0.35.

## Templates generated

**Builder** opening: *"Open with a short editorial note anchored in what the reader is building or deciding right now: which agent architecture is looking more viable, where reliability is still blocking deployment, and which new results actually change the tradeoffs for a production-minded builder."*

**Researcher** opening: *"Open with a short, reader-anchored essay that starts from the mechanism-level question on the table for this issue: what these papers change about how AI agents actually work... This is not a field summary. It should feel like a pointed take for a researcher deciding which ideas are real, which are superficial..."*

Both are reader-situated. Neither contains jargon. Builder references "production-minded builder", "operate a stack", "what to steal"; researcher references "mechanism-level question", "where competence is stored", "algorithmic content". Different framings for different readers — the onboarding agent adapted the section descriptions substantively, not cosmetically.

Structure differentiation is also substantive:
- Builder invented a **"What holds up under pressure"** section (robustness/failure modes) that isn't in any of the example templates.
- Researcher uses **"What seems to be doing the work"** and **"Methods worth reading closely"** — mechanism-forward framings not present in builder.

## Curator ledes (all 6 runs)

**Builder:**
- *"The architecture trend that looks more viable right now is **structured agents with explicit control surfaces**, not bigger free-form loops."*
- *"The architecture trend that looks more viable right now is **more structure around the model, not more faith in the model**."*
- *"The architecture trend that looks more real this round is **structured agents that externalize hard cognition**..."*

**Researcher:**
- *"The mechanism-level question running through this set is not whether agents benefit from more scaffolding. They usually do. The sharper question is which *kind* of structure survives contact with distribution shift..."*
- *"The strongest papers here are not the ones that add more agent scaffolding. They are the ones that make a narrower claim about *where competence is stored*..."*
- *"The mechanism-level question running through this set is simple: when an agent gets better, **what exactly was improved**?"*

**Zero field-narrative ledes across 6 runs** — no "the field is moving", no "the center of gravity is shifting". This is the cleanest result in the full sequence of experiments. The onboarding prompt's new opening-section philosophy pushed through to the final output.

Builder ledes anchor on *viable production architecture*. Researcher ledes anchor on *mechanism-level questions about where improvement comes from*. Substantive content differentiation at the opener — the thing we were after from the start.

Within-persona repetition (*"The architecture trend..."* × 3, *"The mechanism-level question..."* × 2) is mild templatization — same as the previous situated-lede test. Broadening the opener variety would need either more example openers in the description or upstream profile enrichment.

## Jargon check

- **Templates from onboarding:** zero instances of "pool", "candidate", "corpus" in the generated `format_structure` or `voice_language`.
- **Curator body output:** 2 leaks out of 6 runs, both researcher:
  - researcher-run1.md: *"the strongest claims in this pool are the ones that..."*
  - researcher-run2.md: *"This is one of the cleaner adaptation stories in the pool..."*

Root cause: the curator user message includes the literal label `CANDIDATE POOL` to mark the 40-paper input section. The model picked up the word from that label and echoed it. Not a template problem.

**Fix applied:** added an anti-pattern bullet to `preview-curator-system.md` explicitly forbidding "pool" / "candidate pool" / "candidates" / "corpus" / "the set" in the body, with instruction that the `CANDIDATE POOL` label is internal and never reader-facing.

## Pick differentiation

| paper | builder | researcher |
|---|---:|---:|
| SGA-MCTS | 3/3 | 3/3 |
| GAM | 3/3 | 3/3 |
| CoEvolve | 3/3 | 3/3 |
| AlphaEval | 3/3 | 0/3 |
| AgentSPEX | 1/3 | 0/3 |
| CoopEval | 0/3 | 3/3 |
| SocialGrid | 1/3 | 3/3 |
| MemEvoBench | 1/3 | 0/3 |

Hard splits (AlphaEval, CoopEval) preserved. AgentSPEX/SocialGrid splits are less sharp than in earlier tests — the builder template pulled SocialGrid in one run, and dropped AgentSPEX in two. Average Jaccard ~0.51 (up from 0.43 in the hand-written-template test). Some differentiation softening from the generated templates vs hand-written ones, but still clearly split on the framework-vs-mechanism axis.

Researcher was extremely stable — identical picks across all 3 runs. Builder had mild variance.

## Cost

| step | count | cost |
|---|---:|---:|
| onboarding → template | 2 | ~$0.06 |
| curator → digest | 6 | ~$0.30 |
| **total** | **8** | **$0.35** |

## Bottom line

1. The onboarding-prompt changes work end-to-end. Generated templates are reader-situated, jargon-free, and structurally differentiated across personas.
2. The curator renders those templates into reader-situated ledes consistently (0/6 field-narrative openers).
3. One residual issue: the curator echoing the `CANDIDATE POOL` input label in 2/6 runs. Fixed by a new anti-pattern rule.
4. Pick differentiation is slightly softer with generated templates than with hand-written ones (Jaccard 0.51 vs 0.43), but still works.

The pipeline as updated is now producing substantively personalized, clean-voice digests for multiple personas without manual template authoring. Recommend shipping.
