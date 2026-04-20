// src/lib/ai/discovery/build-library.ts
import 'server-only'
import { generateObject } from 'ai'
import { z } from 'zod'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { libraryModel } from '@/lib/ai/openrouter'
import type { DigestConfig, ResearchArea, SearchQuery } from '@/lib/config-schema'
import type { Vocabulary } from './extract-vocab'

const librarySchema = z.object({
  queries: z.array(
    z.object({
      query: z.string(),
      research_area_id: z.number(),
      rationale: z.string(),
    }),
  ),
})

let cachedSystem: string | null = null
function getLibrarySystemPrompt(): string {
  if (cachedSystem) return cachedSystem
  cachedSystem = readFileSync(
    resolve(process.cwd(), 'prompts/preview-library-system.md'),
    'utf8',
  )
  return cachedSystem
}

function formatCounter(items: Array<[string, number]>, limit?: number): string {
  const slice = typeof limit === 'number' ? items.slice(0, limit) : items
  return slice.map(([name, count]) => `  - ${name}  (${count}x)`).join('\n')
}

function stripOperators(text: string): string {
  return text
    .replace(/ AND /g, ' ')
    .replace(/ OR /g, ' ')
    .replace(/ NOT /g, ' ')
    .replace(/"/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .join(' ')
}

/**
 * Build a compact library — exactly one query per research area. Order of
 * returned queries follows research_area_id. Strips unsupported boolean
 * operators if the LLM ignores the rule.
 */
export async function buildCompactLibrary(
  config: Pick<DigestConfig, 'subject' | 'profile' | 'research_areas'>,
  seedsWithCounts: Array<{ seed: string; count: number }>,
  vocab: Vocabulary,
  opts: { sessionId?: string | null } = {},
): Promise<{ queries: SearchQuery[]; cost?: number; totalTokens?: number }> {
  const tag = `[preview-library ${opts.sessionId?.slice(0, 8) ?? 'no-session'}]`
  const started = Date.now()

  const areaLines = config.research_areas
    .map((a: ResearchArea, i) => `  ${i + 1}. ${a.text}`)
    .join('\n')
  const seedLines = seedsWithCounts
    .map((s) => `  - "${s.seed}" → ${s.count} results`)
    .join('\n')

  const userPrompt = [
    `USER PROFILE:\n${config.profile}`,
    ``,
    `SUBJECT: ${config.subject}`,
    ``,
    `REQUIRED_RESEARCH_AREAS (you MUST cover every one of these with exactly one query):`,
    areaLines,
    ``,
    `QUERY_BUDGET: ${config.research_areas.length}`,
    ``,
    `SEED QUERIES ALREADY RUN:`,
    seedLines,
    ``,
    `EXTRACTED VOCABULARY (from ${vocab.totalPapers} real papers):`,
    ``,
    `Topics (OpenAlex's classification):`,
    formatCounter(vocab.topics),
    ``,
    `Subfields:`,
    formatCounter(vocab.subfields),
    ``,
    `Fields:`,
    formatCounter(vocab.fields),
    ``,
    `Keywords from paper metadata:`,
    formatCounter(vocab.keywords),
    ``,
    `Frequent journals:`,
    formatCounter(vocab.journals),
    ``,
    `Sample titles:`,
    vocab.sampleTitles.map((t) => `  - ${t}`).join('\n'),
  ].join('\n')

  const { object, usage, providerMetadata } = await generateObject({
    model: libraryModel({ sessionId: opts.sessionId ?? null }),
    schema: librarySchema,
    system: getLibrarySystemPrompt(),
    prompt: userPrompt,
    temperature: 0.3,
  })

  const cost = (providerMetadata?.openrouter as { usage?: { cost?: number } } | undefined)?.usage?.cost
  const areaCount = config.research_areas.length
  const cleaned: SearchQuery[] = []
  for (const q of object.queries) {
    const text = stripOperators((q.query ?? '').trim())
    if (text.length === 0) continue
    const aid = Number.isFinite(q.research_area_id)
      ? Math.floor(q.research_area_id)
      : 0
    if (aid < 1 || aid > areaCount) continue
    cleaned.push({
      query: text,
      research_area_id: aid,
      source: 'preview',
      rationale: q.rationale ?? '',
    })
  }

  console.log(
    `${tag} done queries=${cleaned.length}/${areaCount} tokens=${usage.totalTokens ?? '?'} cost=${cost != null ? `$${cost.toFixed(6)}` : '—'} ms=${Date.now() - started}`,
  )
  return { queries: cleaned, cost, totalTokens: usage.totalTokens }
}
