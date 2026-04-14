// src/lib/ai/showcase-ranker.ts
import 'server-only'
import { generateObject } from 'ai'
import { z } from 'zod'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { deepseek } from '@/lib/ai/openrouter'
import type { ShowcaseAngleInput } from '@/lib/ai/showcase'

// NOTE: the `.max(2)` below is literal for the same reason as in
// showcase-planner.ts — `showcase.ts` will import this file for the orchestrator,
// creating a circular dependency that would leave SHOWCASE_MAX_PATCHES
// uninitialized at module-top evaluation. If you change that constant in
// showcase.ts, change the literal here too.
export const showcaseRankerSchema = z.object({
  headline: z.string().min(1).max(80),
  picks: z
    .array(
      z.object({
        openalexId: z.string().min(1),
        angleId: z.number().int().min(1),
        chipLabel: z.string().min(1).max(20),
        whyForYou: z.string().min(20).max(200),
      }),
    )
    .min(1)
    .max(3),
  patches: z
    .array(
      z.object({
        absorbedAngleId: z.number().int().min(1),
        intoAngleId: z.number().int().min(1),
        newText: z.string().min(5).max(120),
        reason: z.string().max(100),
      }),
    )
    .max(2),
})

export type ShowcaseRankerOutput = z.infer<typeof showcaseRankerSchema>

export interface RankerCandidate {
  openalexId: string
  angleId: number
  title: string
  authors: string
  year: number
  venue: string
  date: string
  url: string
  abstract: string
}

export interface RankShowcaseInput {
  profile: string
  angles: ShowcaseAngleInput[]
  selectedAngleIds: number[]
  hitCounts: Record<number, number>
  pool: RankerCandidate[]
}

let cachedPrompt: string | null = null
function getSystemPrompt(): string {
  if (cachedPrompt) return cachedPrompt
  cachedPrompt = readFileSync(
    resolve(process.cwd(), 'prompts/showcase-ranker-system.md'),
    'utf8',
  )
  return cachedPrompt
}

function buildUserPrompt(input: RankShowcaseInput): string {
  const anglesBlock = input.angles
    .map((a) => `  ${a.id}. ${a.text}`)
    .join('\n')
  const hitCountsBlock = input.selectedAngleIds
    .map((id) => `  angle ${id}: ${input.hitCounts[id] ?? 0} works`)
    .join('\n')
  const poolBlock = input.pool
    .map(
      (c) =>
        `  [id=${c.openalexId}, angle=${c.angleId}, title="${c.title.replace(/"/g, '\\"')}", authors="${c.authors}", venue="${c.venue}", date="${c.date}", abstract="${c.abstract.slice(0, 400).replace(/"/g, '\\"')}"]`,
    )
    .join('\n')

  return [
    'PROFILE:',
    input.profile,
    '',
    "ANGLES (the user's committed list, 1-indexed):",
    anglesBlock,
    '',
    `PROBED_ANGLES: [${input.selectedAngleIds.join(', ')}]`,
    'HIT_COUNTS:',
    hitCountsBlock,
    '',
    `CANDIDATE_POOL (${input.pool.length} deduped works):`,
    poolBlock,
  ].join('\n')
}

export async function rankShowcasePicks(
  input: RankShowcaseInput,
  opts: { sessionId?: string | null } = {},
): Promise<ShowcaseRankerOutput> {
  const tag = `[showcase-ranker ${opts.sessionId?.slice(0, 8) ?? 'no-session'}]`
  const startedAt = Date.now()
  console.log(`${tag} start pool=${input.pool.length} angles=${input.angles.length}`)

  const { object, usage, providerMetadata } = await generateObject({
    model: deepseek({ sessionId: opts.sessionId }),
    schema: showcaseRankerSchema,
    system: getSystemPrompt(),
    prompt: buildUserPrompt(input),
    temperature: 0.4,
  })

  const cost = (providerMetadata?.openrouter as { usage?: { cost?: number } } | undefined)?.usage?.cost
  console.log(
    `${tag} done picks=${object.picks.length} patches=${object.patches.length} tokens=${usage.totalTokens ?? '?'} cost=${cost != null ? `$${cost.toFixed(6)}` : '—'} ms=${Date.now() - startedAt}`,
  )
  return object
}
