# Situated-lede template test — notes

**Setup.** Same pool, same profiles, same updated curator prompt. Only change: section 1 of the template description swapped from *"naming the move the picks collectively point to: the shared problem the field is wrestling with, what's changing about how it's being approached"* to *"locating this issue in what the reader is actually working on or deciding right now — not a field summary. Do not open with 'the field is moving'..."*. Both profiles × N=3.

## Opening paragraphs — before vs after

**Before (field-narrative, current template description):**
- *"The field is moving away from 'one giant prompt plus tools' and toward **explicit structure around experience, execution, and evaluation**..."*
- *"The center of gravity is shifting from 'make the agent reason harder' to..."*
- *"The move across these picks is from *letting agents improvise* toward..."*

**After (reader-situated, new template description):**

*Builder:*
- *"If you're deciding what to harden in an agent system this month, these picks point to a concrete direction..."*
- *"Right now the practical question is not whether to add more agent loops, tools, or collaborators. It is **which parts of the stack should become explicit system components instead of prompt text**."*
- *"The useful question in this pool is not whether agents can do more. It is **which parts of the stack are worth hardening or restructuring before you add more capability**."*

*Researcher:*
- *"Right now, the useful question is not whether agents can do more, but **which mechanism buys reliability without baking in more latency or more brittle prompting**."*
- *"Right now the hard part is not getting an agent to *do something* once. It is getting the same mechanism to hold up over long horizons..."*
- *"Right now the useful question is not whether agents can do more steps. It is **which mechanism actually buys reliable extra depth** without turning the system into an expensive, brittle pile of prompts."*

**The template description is the control.** Changing one line moved every single run off the "field is moving" opener and onto a reader-situated framing. No curator-prompt rule was required.

## New ledes differentiate across profiles

- Builder ledes anchor around *stack hardening* and *explicit system components*.
- Researcher ledes anchor around *which mechanism buys reliability* and *mechanisms holding up over long horizons*.

Same underlying question structure, different content in the frame. That's the personalization working inside the new template.

## But a new pattern is emerging

Five of six new ledes open with *"Right now the X question is..."* or *"The useful question in this pool is..."*. That's a pattern replacing the old "field is moving" pattern — still templated, just reader-focused now. For a weekly reader, this could start to feel repetitive after a few issues.

Two paths from here if we want more lede variety:
- Broaden the template description (e.g. allow "If you're X", "Right now the question is X", "The reader is still deciding X", etc., as possible shapes).
- Invest in pre-distill so the model has richer signals to anchor on — specific decisions, vocabulary, or open questions from the reader's profile — giving it more ways to vary the opener.

## Differentiation preserved on picks

| paper | builder-situated | researcher-situated |
|---|---:|---:|
| SGA-MCTS | 3/3 | 3/3 |
| GAM | 3/3 | 3/3 |
| CoEvolve | 3/3 | 3/3 |
| AgentSPEX | **3/3** | **0/3** |
| AlphaEval | **3/3** | **0/3** |
| CoopEval | 0/3 | 1/3 |
| WORC | 0/3 | 2/3 |
| SocialGrid | 0/3 | 2/3 |
| MemEvoBench | 1/3 | 1/3 |

Jaccard ~0.43. Hard splits intact. No regression from the template change.

## Cost

| | avg / run | vs. previous |
|---|---:|---|
| ms | ~27,500 | +15% |
| cost | $0.044 | -15% |

Mixed. Latency up slightly, unit cost slightly down (more cached inputs this run).

## Bottom line

**The template description is the single most powerful lever for the lede.** We spent four experiments trying to fix the lede via curator-prompt rules; changing one line of template description did what the rules couldn't. This retroactively explains why my earlier lede rule was inert: it was competing with a more specific instruction the curator was already following.

Next steps if you want to keep pushing this:

1. **Update the default template** the onboarding agent proposes to include reader-situated section descriptions where appropriate. The curator prompt doesn't need to change further.
2. **Allow user-visible "template variants"** during onboarding — field-framing vs. reader-situated vs. something else — so users pick the stance they want for their weekly.
3. **Pre-distill still helps**, but now as a follow-on rather than a prerequisite. With a reader-situated template, even thin profiles produce situated ledes; with a richer profile, those ledes would be less templated.
