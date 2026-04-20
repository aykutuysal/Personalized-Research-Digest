// src/lib/ai/showcase-planner.ts
import 'server-only'
import { generateObject } from 'ai'
import { z } from 'zod'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { deepseek } from '@/lib/ai/openrouter'
import type { ShowcaseAngleInput } from '@/lib/ai/showcase'
import { SHOWCASE_PROBED_ANGLES } from '@/lib/ai/showcase'

// NOTE: Anthropic's structured-output API rejects these JSON-schema constraint
// keywords (other providers accept them):
//   - integer/number: `minimum`, `maximum`
//   - string: `minLength`, `maxLength`
//   - array: `maxItems`; `minItems` only allows 0 or 1
// CRITICAL: Do not use `z.number().int()` in any schema sent through this path —
// Zod v4 serializes `.int()` as `{type: "integer", minimum: -9007199254740991,
// maximum: 9007199254740991}` to enforce JS safe-integer bounds, which trips
// Anthropic's `minimum`/`maximum` rejection even though you never wrote those
// constraints by hand. Use plain `z.number()` instead.
// See propose-angles.ts for the full explanation and source links.
export const showcasePlanSchema = z.object({
  selectedAngleIds: z.array(z.number()).min(1),
  queries: z
    .array(
      z.object({
        angle_id: z.number(),
        query: z.string(),
        rationale: z.string(),
      }),
    )
    .min(1),
})

export type ShowcasePlan = z.infer<typeof showcasePlanSchema>

export interface PlanShowcaseQueriesInput {
  subject: string
  profile: string
  angles: ShowcaseAngleInput[]
}

let cachedPrompt: string | null = null
function getSystemPrompt(): string {
  if (cachedPrompt) return cachedPrompt
  cachedPrompt = readFileSync(
    resolve(process.cwd(), 'prompts/showcase-planner-system.md'),
    'utf8',
  )
  return cachedPrompt
}

function buildUserPrompt(input: PlanShowcaseQueriesInput, probedCount: number): string {
  const anglesBlock = input.angles
    .map((a, i) => `  ${i + 1}. ${a.text}`)
    .join('\n')
  return [
    `SUBJECT: ${input.subject}`,
    '',
    'PROFILE:',
    input.profile,
    '',
    'ANGLES (1-indexed; pick the N most showcase-worthy):',
    anglesBlock,
    '',
    `PROBED_COUNT: ${probedCount}`,
  ].join('\n')
}

export async function planShowcaseQueries(
  input: PlanShowcaseQueriesInput,
  opts: { sessionId?: string | null } = {},
): Promise<ShowcasePlan> {
  const tag = `[showcase-planner ${opts.sessionId?.slice(0, 8) ?? 'no-session'}]`
  const probedCount = Math.min(SHOWCASE_PROBED_ANGLES, input.angles.length)
  const startedAt = Date.now()
  console.log(
    `${tag} start subject="${input.subject}" angles=${input.angles.length} probe=${probedCount}`,
  )

  const { object, usage, providerMetadata } = await generateObject({
    model: deepseek({ sessionId: opts.sessionId }),
    schema: showcasePlanSchema,
    system: getSystemPrompt(),
    prompt: buildUserPrompt(input, probedCount),
    temperature: 0.3,
    abortSignal: AbortSignal.timeout(45_000),
  })

  const cost = (providerMetadata?.openrouter as { usage?: { cost?: number } } | undefined)?.usage?.cost
  const cappedSelected = object.selectedAngleIds.slice(0, SHOWCASE_PROBED_ANGLES)
  const cappedQueries = object.queries.slice(0, SHOWCASE_PROBED_ANGLES)
  if (
    cappedSelected.length < object.selectedAngleIds.length ||
    cappedQueries.length < object.queries.length
  ) {
    console.warn(
      `${tag} truncated selected ${object.selectedAngleIds.length}→${cappedSelected.length} queries ${object.queries.length}→${cappedQueries.length}`,
    )
  }
  console.log(
    `${tag} done selected=${cappedSelected.length} queries=${cappedQueries.length} tokens=${usage.totalTokens ?? '?'} cost=${cost != null ? `$${cost.toFixed(6)}` : '—'} ms=${Date.now() - startedAt}`,
  )
  return { selectedAngleIds: cappedSelected, queries: cappedQueries }
}
