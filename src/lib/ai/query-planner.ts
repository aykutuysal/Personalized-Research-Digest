// src/lib/ai/query-planner.ts
import 'server-only'
import { generateObject } from 'ai'
import { z } from 'zod'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { queryPlannerModel } from '@/lib/ai/openrouter'

export const queryPlanSchema = z.object({
  subject: z.string(),
  allocation: z
    .array(
      z.object({
        angle_id: z.number().int().min(1),
        queries: z.number().int().min(1).max(4),
        reason: z.string(),
      }),
    )
    .min(1),
  queries: z
    .array(
      z.object({
        id: z.number().int().min(1),
        angle_id: z.number().int().min(1),
        slot: z.number().int().min(1),
        query: z.string().min(1),
        rationale: z.string(),
      }),
    )
    .min(1),
  coverage_notes: z.string(),
})

export type QueryPlan = z.infer<typeof queryPlanSchema>

export interface PlanQueriesInput {
  subject: string
  profile: string
  angles: { text: string }[]
  queryBudget: number
  minPerAngle?: number
  maxPerAngle?: number
}

let cachedPrompt: string | null = null
function getSystemPrompt(): string {
  if (cachedPrompt) return cachedPrompt
  cachedPrompt = readFileSync(
    resolve(process.cwd(), 'prompts/query-planner-system.md'),
    'utf8',
  )
  return cachedPrompt
}

function buildUserPrompt(input: PlanQueriesInput): string {
  const minPerAngle = input.minPerAngle ?? 1
  const maxPerAngle = input.maxPerAngle ?? 4
  const anglesBlock = input.angles
    .map((a, i) => `  ${i + 1}. ${a.text}`)
    .join('\n')
  return [
    `SUBJECT: ${input.subject}`,
    '',
    'PROFILE:',
    input.profile,
    '',
    'REQUIRED_ANGLES (you MUST cover every one of these):',
    anglesBlock,
    '',
    `QUERY_BUDGET: ${input.queryBudget}`,
    `MIN_PER_ANGLE: ${minPerAngle}`,
    `MAX_PER_ANGLE: ${maxPerAngle}`,
  ].join('\n')
}

export async function planQueries(
  input: PlanQueriesInput,
  opts: { sessionId?: string | null } = {},
): Promise<QueryPlan> {
  const tag = `[planQueries ${opts.sessionId?.slice(0, 8) ?? 'no-session'}]`
  const startedAt = Date.now()
  console.log(
    `${tag} start subject="${input.subject}" angles=${input.angles.length} budget=${input.queryBudget}`,
  )

  const { object, usage, providerMetadata } = await generateObject({
    model: queryPlannerModel({ sessionId: opts.sessionId }),
    schema: queryPlanSchema,
    system: getSystemPrompt(),
    prompt: buildUserPrompt(input),
    temperature: 0.3,
  })

  const cost = (providerMetadata?.openrouter as { usage?: { cost?: number } } | undefined)?.usage
    ?.cost
  console.log(
    `${tag} done queries=${object.queries.length} tokens=${usage.totalTokens ?? '?'} cost=${cost != null ? `$${cost.toFixed(6)}` : '—'} ms=${Date.now() - startedAt}`,
  )
  return object
}
