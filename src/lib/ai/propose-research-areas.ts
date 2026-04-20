// src/lib/ai/propose-research-areas.ts
import 'server-only'
import { generateObject } from 'ai'
import { z } from 'zod'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { deepseek } from '@/lib/ai/openrouter'

// NOTE: Anthropic's structured-output API rejects these JSON-schema constraint
// keywords entirely (other providers accept them):
//   - integer/number: `minimum`, `maximum`
//   - string: `minLength`, `maxLength`
//   - array: `maxItems`; `minItems` only allows 0 or 1
// Official Anthropic SDKs auto-strip these and validate client-side, but the
// Vercel AI SDK + OpenRouter route passes the Zod-derived schema verbatim, so
// we strip manually here. Soft-cap targets are enforced via the system prompt
// and post-call truncation in `proposeResearchAreas`.
//
// EXTRA GOTCHA — `z.number().int()`: Zod v4 serializes `.int()` as
// `{type: "integer", minimum: -9007199254740991, maximum: 9007199254740991}`
// to enforce JS safe-integer bounds, which trips the same rejection even when
// you never wrote min/max by hand. Use plain `z.number()` for any field that
// will be sent to Anthropic via this path.
//
// Refs:
//   https://docs.claude.com/en/docs/build-with-claude/structured-outputs
//   https://vercel.com/docs/ai-gateway/sdks-and-apis/anthropic-messages-api/structured-outputs
export const proposeResearchAreasOutputSchema = z.object({
  angles: z
    .array(
      z.object({
        text: z.string(),
        rationale: z.string(),
      }),
    )
    .min(1),
})

const PROPOSE_RESEARCH_AREAS_HARD_CAP = 12

export type ProposeResearchAreasOutput = z.infer<typeof proposeResearchAreasOutputSchema>

let cachedPrompt: string | null = null

function getSystemPrompt(): string {
  if (cachedPrompt) return cachedPrompt
  cachedPrompt = readFileSync(
    resolve(process.cwd(), 'prompts/propose-research-areas-system.md'),
    'utf8',
  )
  return cachedPrompt
}

export async function proposeResearchAreas(
  input: {
    subject: string
    profileSummary: string
    hints?: string
  },
  opts: { sessionId?: string | null } = {},
): Promise<ProposeResearchAreasOutput> {
  const tag = `[proposeResearchAreas ${opts.sessionId?.slice(0, 8) ?? 'no-session'}]`
  const startedAt = Date.now()
  console.log(`${tag} start subject="${input.subject}"`)

  try {
    const { object, usage, providerMetadata } = await generateObject({
      model: deepseek({ sessionId: opts.sessionId }),
      schema: proposeResearchAreasOutputSchema,
      system: getSystemPrompt(),
      prompt: [
        `SUBJECT: ${input.subject}`,
        '',
        `READER PROFILE:\n${input.profileSummary}`,
        input.hints ? `\nHINTS:\n${input.hints}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
      temperature: 0.7,
    })

    const cost = (providerMetadata?.openrouter as { usage?: { cost?: number } } | undefined)?.usage?.cost
    const trimmed = object.angles.slice(0, PROPOSE_RESEARCH_AREAS_HARD_CAP)
    if (trimmed.length < object.angles.length) {
      console.warn(`${tag} truncated angles ${object.angles.length} → ${trimmed.length}`)
    }
    console.log(
      `${tag} done angles=${trimmed.length} tokens=${usage.totalTokens ?? '?'} cost=${cost != null ? `$${cost.toFixed(6)}` : '—'} ms=${Date.now() - startedAt}`,
    )
    return { angles: trimmed }
  } catch (err) {
    const e = err as { name?: string; message?: string; cause?: unknown; text?: string }
    console.error(`${tag} FAILED ms=${Date.now() - startedAt} name=${e.name ?? 'Error'} message=${e.message ?? '(none)'}`)
    if (e.text) {
      console.error(`${tag} raw model text:`, e.text.slice(0, 1000))
    }
    if (e.cause) {
      console.error(`${tag} cause:`, e.cause)
    }
    throw err
  }
}
