// src/lib/ai/preview/curator.ts
import 'server-only'
import { generateObject } from 'ai'
import { z } from 'zod'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { curatorModel } from '@/lib/ai/openrouter'
import type { DigestConfig } from '@/lib/config-schema'
import type { OpenAlexWork } from '@/lib/openalex/client'
import { reconstructAbstract } from '@/lib/ai/discovery/extract-vocab'
import type { ReferencePaper } from './progress-events'

const curatorSchema = z.object({
  body: z.string(),
  referenceIds: z.array(z.string()),
})

let cachedSystem: string | null = null
function getCuratorSystemPrompt(): string {
  if (cachedSystem) return cachedSystem
  cachedSystem = readFileSync(
    resolve(process.cwd(), 'prompts/preview-curator-system.md'),
    'utf8',
  )
  return cachedSystem
}

function firstAuthor(paper: OpenAlexWork): string {
  const names = (paper.authorships ?? [])
    .map((a) => a?.author?.display_name)
    .filter((n): n is string => typeof n === 'string' && n.length > 0)
  if (names.length === 0) return 'Unknown'
  return names.length === 1 ? names[0] : `${names[0]} et al.`
}

function extractVenue(paper: OpenAlexWork): string {
  return paper.primary_location?.source?.display_name ?? ''
}

// OpenAlex returns `id` as a full URL (https://openalex.org/W123...); the
// LLM tends to return just the short form `W123...`. Normalize both ends
// before map lookup so the join doesn't silently miss everything.
function shortId(id: string): string {
  return id.replace(/^https?:\/\/openalex\.org\//i, '')
}

function urlFor(paper: OpenAlexWork): string {
  const oid = paper.id.startsWith('https://') ? paper.id : `https://openalex.org/${paper.id}`
  if (paper.doi && typeof paper.doi === 'string') {
    const doi = paper.doi.startsWith('https://') ? paper.doi : `https://doi.org/${paper.doi}`
    return doi
  }
  return oid
}

export interface CuratorResult {
  body: string
  references: ReferencePaper[]
  cost?: number
  totalTokens?: number
}

/**
 * Editorial curator. Receives dedup'd pool from step-5 retrieval, returns
 * markdown body + 3–5 reference IDs. Server joins metadata to render
 * references. Paper count is fixed (5) per prompt; schema has no volume_target.
 */
export async function curatePreview(
  config: Pick<DigestConfig, 'subject' | 'profile' | 'output_style' | 'research_areas'>,
  pool: OpenAlexWork[],
  opts: { sessionId?: string | null } = {},
): Promise<CuratorResult> {
  const tag = `[preview-curator ${opts.sessionId?.slice(0, 8) ?? 'no-session'}]`
  const started = Date.now()

  const poolLines = pool.map((p) => {
    const abstract = reconstructAbstract(p.abstract_inverted_index).slice(0, 500)
    return [
      `[id=${shortId(p.id)}] (${p.publication_date ?? '?'}, venue=${extractVenue(p) || '—'})`,
      `  title: ${p.title ?? '(no title)'}`,
      `  abstract: ${abstract || '(no abstract)'}`,
    ].join('\n')
  }).join('\n\n')

  const areasText = config.research_areas.map((a, i) => `  ${i + 1}. ${a.text}`).join('\n')

  const userPrompt = [
    `READER PROFILE:\n${config.profile}`,
    ``,
    `SUBJECT: ${config.subject}`,
    ``,
    `RESEARCH AREAS:`,
    areasText,
    ``,
    `THE READER'S DIGEST TEMPLATE (output_style — render exactly):`,
    config.output_style,
    ``,
    `CANDIDATE POOL (${pool.length} papers, deduped across queries):`,
    poolLines,
  ].join('\n')

  const { object, usage, providerMetadata } = await generateObject({
    model: curatorModel({ sessionId: opts.sessionId ?? null }),
    schema: curatorSchema,
    system: getCuratorSystemPrompt(),
    prompt: userPrompt,
    temperature: 0.5,
  })

  const cost = (providerMetadata?.openrouter as { usage?: { cost?: number } } | undefined)?.usage?.cost

  // Join metadata server-side — hallucination containment.
  const byId = new Map(pool.map((p) => [shortId(p.id), p]))
  const references: ReferencePaper[] = []
  for (const id of object.referenceIds) {
    const paper = byId.get(shortId(id))
    if (!paper) continue
    references.push({
      id: paper.id,
      title: paper.title ?? '(untitled)',
      authors: firstAuthor(paper),
      venue: extractVenue(paper),
      date: paper.publication_date ?? '',
      url: urlFor(paper),
    })
  }

  console.log(
    `${tag} done refs=${references.length}/${object.referenceIds.length} body_chars=${object.body.length} tokens=${usage.totalTokens ?? '?'} cost=${cost != null ? `$${cost.toFixed(6)}` : '—'} ms=${Date.now() - started}`,
  )
  return { body: object.body, references, cost, totalTokens: usage.totalTokens }
}
