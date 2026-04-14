// src/lib/ai/showcase-planner.ts
import 'server-only'
import { generateObject } from 'ai'
import { z } from 'zod'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { deepseek } from '@/lib/ai/openrouter'
import type { ShowcaseAngleInput } from '@/lib/ai/showcase'
import { SHOWCASE_PROBED_ANGLES } from '@/lib/ai/showcase'

// NOTE: the `.max()` below uses a literal 4 instead of SHOWCASE_PROBED_ANGLES
// because this schema is evaluated at module-top, and `showcase.ts` will later
// import this file (for `runShowcase`) which creates a circular dependency.
// Inside function bodies the imported constant is safe — see `planShowcaseQueries`.
// If you change SHOWCASE_PROBED_ANGLES in showcase.ts, change the literal here too.
export const showcasePlanSchema = z.object({
  selectedAngleIds: z.array(z.number().int().min(1)).min(1).max(4),
  queries: z
    .array(
      z.object({
        angle_id: z.number().int().min(1),
        query: z.string().min(1),
        rationale: z.string(),
      }),
    )
    .min(1)
    .max(4),
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
  })

  const cost = (providerMetadata?.openrouter as { usage?: { cost?: number } } | undefined)?.usage?.cost
  console.log(
    `${tag} done selected=${object.selectedAngleIds.length} queries=${object.queries.length} tokens=${usage.totalTokens ?? '?'} cost=${cost != null ? `$${cost.toFixed(6)}` : '—'} ms=${Date.now() - startedAt}`,
  )
  return object
}
