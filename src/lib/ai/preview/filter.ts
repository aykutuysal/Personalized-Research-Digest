// src/lib/ai/preview/filter.ts
import 'server-only'
import { generateObject } from 'ai'
import { z } from 'zod'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { filterModel } from '@/lib/ai/openrouter'
import { reconstructAbstract } from '@/lib/ai/discovery/extract-vocab'
import type { DigestConfig } from '@/lib/config-schema'
import type { OpenAlexWork } from '@/lib/openalex/client'

// OpenAlex returns `id` as a full URL (https://openalex.org/W123...); the
// LLM tends to return just the short form. Normalize both ends so the
// join doesn't silently miss everything. Mirrors curator.ts.
function shortId(id: string): string {
  return id.replace(/^https?:\/\/openalex\.org\//i, '')
}

// Loose schema — no min/max (Anthropic compat) and no `.int()` (see
// propose-research-areas.ts for the Zod v4 safe-integer bounds trap).
const filterSchema = z.object({
  keep: z.array(
    z.object({
      id: z.string(),
      reason: z.string(),
    }),
  ),
})

export type FilterOutput = z.infer<typeof filterSchema>

export interface FilterResult {
  survivors: OpenAlexWork[]
  reasons: Map<string, string> // shortId → reason (for logs/debug)
  dropped: number
  cost?: number
  totalTokens?: number
}

let cachedPrompt: string | null = null
function getFilterSystemPrompt(): string {
  if (cachedPrompt) return cachedPrompt
  cachedPrompt = readFileSync(
    resolve(process.cwd(), 'prompts/preview-filter-system.md'),
    'utf8',
  )
  return cachedPrompt
}

function areaIdOf(paper: OpenAlexWork & { __areaId?: number }): number | null {
  return typeof paper.__areaId === 'number' ? paper.__areaId : null
}

/**
 * Single-call relevance filter. DeepSeek scores the full pool against the
 * reader's profile and returns the IDs worth keeping. Server joins against
 * the pool (hallucination containment) and drops unknown IDs.
 *
 * Batch strategy: one call for up to ~80 papers, ~13k input tokens. If a
 * future run needs more, the caller can partition and merge results.
 */
export async function filterCandidates(
  config: Pick<DigestConfig, 'subject' | 'profile' | 'research_areas'>,
  pool: Array<OpenAlexWork & { __areaId?: number }>,
  opts: { sessionId?: string | null } = {},
): Promise<FilterResult> {
  const tag = `[preview-filter ${opts.sessionId?.slice(0, 8) ?? 'no-session'}]`
  const started = Date.now()

  if (pool.length === 0) {
    return { survivors: [], reasons: new Map(), dropped: 0 }
  }

  const poolLines = pool
    .map((p) => {
      const abstract = reconstructAbstract(p.abstract_inverted_index).slice(0, 300)
      const area = areaIdOf(p)
      const areaSuffix = area != null ? `, area=${area}` : ''
      return [
        `[id=${shortId(p.id)}${areaSuffix}, date=${p.publication_date ?? '?'}]`,
        `  title: ${p.title ?? '(no title)'}`,
        `  abstract: ${abstract || '(no abstract)'}`,
      ].join('\n')
    })
    .join('\n\n')

  const areasText = config.research_areas
    .map((a) => `  ${a.id}. ${a.text}`)
    .join('\n')

  const userPrompt = [
    `READER PROFILE:\n${config.profile}`,
    ``,
    `SUBJECT: ${config.subject}`,
    ``,
    `RESEARCH AREAS (1-indexed — area= in each candidate points here):`,
    areasText,
    ``,
    `CANDIDATE POOL (${pool.length} deduped papers from the last week):`,
    poolLines,
  ].join('\n')

  console.log(`${tag} prompt chars=${userPrompt.length} ---\n${userPrompt}\n---`)
  const { object, usage, providerMetadata } = await generateObject({
    model: filterModel({ sessionId: opts.sessionId ?? null }),
    schema: filterSchema,
    system: getFilterSystemPrompt(),
    prompt: userPrompt,
    temperature: 0.2,
  })
  console.log(`${tag} response ${JSON.stringify(object)}`)

  const cost = (providerMetadata?.openrouter as { usage?: { cost?: number } } | undefined)?.usage?.cost

  // Join against the pool by short id. Silently drop any unknown ids.
  const byShortId = new Map(pool.map((p) => [shortId(p.id), p]))
  const survivors: OpenAlexWork[] = []
  const reasons = new Map<string, string>()
  const seen = new Set<string>()
  for (const k of object.keep) {
    const s = shortId(k.id)
    if (seen.has(s)) continue
    const paper = byShortId.get(s)
    if (!paper) continue
    seen.add(s)
    survivors.push(paper)
    reasons.set(s, k.reason)
  }
  const dropped = pool.length - survivors.length

  console.log(
    `${tag} done keep=${survivors.length}/${pool.length} dropped=${dropped} tokens=${usage.totalTokens ?? '?'} cost=${cost != null ? `$${cost.toFixed(6)}` : '—'} ms=${Date.now() - started}`,
  )
  return { survivors, reasons, dropped, cost, totalTokens: usage.totalTokens }
}
