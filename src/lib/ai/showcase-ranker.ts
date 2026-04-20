// src/lib/ai/showcase-ranker.ts
import 'server-only'
import { generateObject } from 'ai'
import { z } from 'zod'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { deepseek } from '@/lib/ai/openrouter'
import type { ShowcaseAngleInput } from '@/lib/ai/showcase'

// NOTE: Anthropic's structured-output API rejects these JSON-schema constraint
// keywords (other providers accept them):
//   - integer/number: `minimum`, `maximum`
//   - string: `minLength`, `maxLength`
//   - array: `maxItems`; `minItems` only allows 0 or 1
// We strip them all from the schema and enforce caps post-call in
// `rankShowcasePicks`. See propose-angles.ts for the full explanation
// and source links.
const RANKER_MAX_PICKS = 3
const RANKER_MAX_PATCHES = 2
const RANKER_HEADLINE_MAX = 80
const RANKER_WHY_FOR_YOU_MAX = 240

// CRITICAL: Use `z.number()` not `z.number().int()` — see showcase-planner.ts
// header for the explanation. Zod v4 serializes `.int()` with safe-integer
// bounds that Anthropic's structured-output API rejects.
export const showcaseRankerSchema = z.object({
  headline: z.string(),
  picks: z
    .array(
      z.object({
        openalexId: z.string(),
        angleId: z.number(),
        chipLabel: z.string(),
        whyForYou: z.string(),
      }),
    )
    .min(1),
  patches: z.array(
    z.object({
      absorbedAngleId: z.number(),
      intoAngleId: z.number(),
      newText: z.string(),
      reason: z.string(),
    }),
  ),
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
    abortSignal: AbortSignal.timeout(60_000),
  })

  const cost = (providerMetadata?.openrouter as { usage?: { cost?: number } } | undefined)?.usage?.cost
  const cappedHeadline = object.headline.slice(0, RANKER_HEADLINE_MAX)
  const cappedPicks = object.picks.slice(0, RANKER_MAX_PICKS).map((p) => ({
    ...p,
    whyForYou: p.whyForYou.slice(0, RANKER_WHY_FOR_YOU_MAX),
  }))
  const cappedPatches = object.patches.slice(0, RANKER_MAX_PATCHES)
  if (
    cappedPicks.length < object.picks.length ||
    cappedPatches.length < object.patches.length
  ) {
    console.warn(
      `${tag} truncated picks ${object.picks.length}→${cappedPicks.length} patches ${object.patches.length}→${cappedPatches.length}`,
    )
  }
  console.log(
    `${tag} done picks=${cappedPicks.length} patches=${cappedPatches.length} tokens=${usage.totalTokens ?? '?'} cost=${cost != null ? `$${cost.toFixed(6)}` : '—'} ms=${Date.now() - startedAt}`,
  )
  return { headline: cappedHeadline, picks: cappedPicks, patches: cappedPatches }
}
