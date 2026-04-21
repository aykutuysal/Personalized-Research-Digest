// test/pool-experiment-prompt-ab.test.ts
//
// Head-to-head A/B: OLD library prompt vs. NEW library prompt against live
// OpenAlex, using the same therapist profile, same seeds, same vocab, same
// 7-day window. Only the system prompt changes — this isolates the effect
// of the prompt edits alone.
//
// Gated by RUN_POOL_EXPERIMENT=1.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { generateObject } from 'ai'
import { z } from 'zod'

// ---- Load .env.local ----
function loadEnvLocal() {
  try {
    const content = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const idx = trimmed.indexOf('=')
      if (idx === -1) continue
      const key = trimmed.slice(0, idx).trim()
      let val = trimmed.slice(idx + 1).trim()
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1)
      }
      if (!process.env[key]) process.env[key] = val
    }
  } catch {
    // no .env.local
  }
}
loadEnvLocal()

import { generateSeeds, combineSeeds, researchAreasToSeeds } from '@/lib/ai/discovery/seeds'
import { fetchSeedPapers } from '@/lib/ai/discovery/fetch-seeds'
import { extractVocabulary } from '@/lib/ai/discovery/extract-vocab'
import type { Vocabulary } from '@/lib/ai/discovery/extract-vocab'
import { runLibrary } from '@/lib/ai/discovery/run-library'
import { libraryModel } from '@/lib/ai/openrouter'
import type { DigestConfig, SearchQuery } from '@/lib/config-schema'
import type { OpenAlexWork } from '@/lib/openalex/client'

const THERAPIST_CONFIG: Pick<DigestConfig, 'subject' | 'profile' | 'research_areas'> = {
  subject: 'developments in CBT and schema therapy',
  profile:
    "Therapist working mainly with depression and anxiety, wants to track what's happening in the field without animal studies, prefers digest to read like relevant reading material rather than a list.",
  research_areas: [
    { id: 1, text: 'ACT-CBT integration for depression/anxiety' },
    { id: 2, text: 'Schema therapy modes for depression/anxiety' },
    { id: 3, text: 'Digital CBT delivery for depression/anxiety' },
    { id: 4, text: 'CBT for emotional disorders (Unified Protocol)' },
    { id: 5, text: 'Imagery rescripting for depression/anxiety' },
    { id: 6, text: 'Process-based CBT for depression/anxiety' },
    { id: 7, text: 'Schema therapy adaptations for depression/anxiety' },
    { id: 8, text: 'CBT for comorbid insomnia and depression/anxiety' },
    { id: 9, text: 'Third-wave approaches for treatment-resistant cases' },
  ],
}

const OLD_LIBRARY_PROMPT = `You build a COMPACT search query library for a research digest PREVIEW. The user's profile is below,
along with the REQUIRED_RESEARCH_AREAS (a fixed list — every area is a hard slot you MUST cover with
EXACTLY one query) and REAL vocabulary extracted from papers retrieved by seed queries.

Output a library of search queries for OpenAlex's title_and_abstract.search filter. This filter
supports only space-separated keywords — no AND, OR, NOT, or quotes.

HARD CONSTRAINTS (failures here invalidate the whole library):
- You MUST produce EXACTLY one query per research area. No skips, no extras.
- Each query must declare its \`research_area_id\` (1-based, matching REQUIRED_RESEARCH_AREAS order).
- Dimension is always \`core\`. No intersections, no adjacents, no serendipity.

RULES:
1. USE VOCABULARY FROM THE EXTRACTED DATA, not your own assumptions. These terms actually appear in
   the papers this user would want.
2. Filter out noise. A topic appearing in the data does not mean it serves this user's goal.
3. Each query: 2-6 space-separated words. Prefer specific noun phrases over generic descriptions.
4. Target result count: 10-300 papers per query per week. Too few = loosen. Too many = add a qualifier.
5. For each query, write a short rationale that references the USER'S GOAL, the area it serves,
   and the vocabulary evidence.

Respond with ONLY a JSON object:
{
  "queries": [
    {"query": "...", "research_area_id": 1, "rationale": "..."}
  ]
}
No prose.`

const NEW_LIBRARY_PROMPT = readFileSync(
  resolve(process.cwd(), 'prompts/preview-library-system.md'),
  'utf8',
)

const librarySchema = z.object({
  queries: z.array(
    z.object({
      query: z.string(),
      research_area_id: z.number(),
      rationale: z.string(),
    }),
  ),
})

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

async function buildLibraryWithPrompt(
  systemPrompt: string,
  config: Pick<DigestConfig, 'subject' | 'profile' | 'research_areas'>,
  seedsWithCounts: Array<{ seed: string; count: number }>,
  vocab: Vocabulary,
): Promise<SearchQuery[]> {
  const areaLines = config.research_areas
    .map((a, i) => `  ${i + 1}. ${a.text}`)
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

  const { object } = await generateObject({
    model: libraryModel({ sessionId: null }),
    schema: librarySchema,
    system: systemPrompt,
    prompt: userPrompt,
    temperature: 0.3,
  })

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
  return cleaned
}

function normalizeTitle(t?: string | null): string {
  return (t ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
}
function dedup(papers: OpenAlexWork[]): OpenAlexWork[] {
  const byId = new Map<string, OpenAlexWork>()
  for (const p of papers) if (!byId.has(p.id)) byId.set(p.id, p)
  const byTitle = new Set<string>()
  const out: OpenAlexWork[] = []
  for (const p of byId.values()) {
    const key = normalizeTitle(p.title)
    if (!key) { out.push(p); continue }
    if (byTitle.has(key)) continue
    byTitle.add(key); out.push(p)
  }
  return out
}
function inWindow(paper: OpenAlexWork, fromDate: string): boolean {
  const d = paper.publication_date
  return !!d && d >= fromDate
}
function tokenCount(s: string): number {
  return s.split(/\s+/).filter(Boolean).length
}

// Crude relevance classifier tuned to the therapist subject. Not intended as
// a production filter — it just lets us compare noise rates between prompts.
const REL_TOKENS = [
  'cbt', 'therapy', 'psychotherap', 'cogniti', 'behavio', 'depress', 'anxiet',
  'mental health', 'ptsd', 'trauma', 'schema', 'mindful', 'acceptance',
  'commitment', 'imagery', 'insomn', 'sleep', 'emotion', 'regul', 'rumin',
  'mood', 'psycholog', 'psychiatr', 'counsel', 'worry', 'panic',
]
const IRRELEVANT_FIELDS = new Set([
  'Computer Science', 'Engineering', 'Physics and Astronomy',
  'Earth and Planetary Sciences', 'Chemistry', 'Mathematics',
  'Materials Science', 'Economics, Econometrics and Finance',
  'Business, Management and Accounting', 'Environmental Science',
  'Chemical Engineering', 'Energy',
])
const RELEVANT_FIELDS = new Set(['Psychology', 'Medicine', 'Neuroscience'])

function reconstructAbstract(invIdx?: Record<string, number[]> | null): string {
  if (!invIdx) return ''
  const entries: Array<[number, string]> = []
  for (const [word, positions] of Object.entries(invIdx)) {
    for (const pos of positions) entries.push([pos, word])
  }
  entries.sort((a, b) => a[0] - b[0])
  return entries.map(([, w]) => w).join(' ')
}

function classifyRelevance(w: OpenAlexWork): 'rel' | 'maybe' | 'off' {
  const field = w.primary_topic?.field?.display_name ?? ''
  if (IRRELEVANT_FIELDS.has(field)) return 'off'
  const hay = ((w.title ?? '') + ' ' + reconstructAbstract(w.abstract_inverted_index ?? null)).toLowerCase()
  const hasTok = REL_TOKENS.some((t) => hay.includes(t))
  if (RELEVANT_FIELDS.has(field) && hasTok) return 'rel'
  if (RELEVANT_FIELDS.has(field)) return 'maybe'
  if (hasTok) return 'maybe'
  return 'off'
}

function summarizePrecision(papers: OpenAlexWork[]): { rel: number; maybe: number; off: number } {
  const out = { rel: 0, maybe: 0, off: 0 }
  for (const p of papers) {
    const c = classifyRelevance(p)
    if (c === 'rel') out.rel++
    else if (c === 'maybe') out.maybe++
    else out.off++
  }
  return out
}

const RUN = process.env.RUN_POOL_EXPERIMENT === '1'
const maybe = RUN ? describe : describe.skip

maybe('prompt A/B: OLD vs NEW library system prompt', () => {
  it(
    'measures pool size under each prompt, same seeds/vocab',
    async () => {
      console.log('\n================ PROMPT A/B EXPERIMENT ================')

      // --- Shared: seeds + fetch + vocab (same for both variants) ---
      const { seeds: llmSeeds } = await generateSeeds(THERAPIST_CONFIG, {})
      const angleSeeds = researchAreasToSeeds(THERAPIST_CONFIG.research_areas)
      const seeds = combineSeeds(llmSeeds, angleSeeds)
      console.log(`\nseeds (shared): ${seeds.length}`, JSON.stringify(seeds))

      const seedResults = await fetchSeedPapers(seeds)
      const totalSeed = seedResults.reduce((s, r) => s + r.results.length, 0)
      console.log(`seed-fetch (shared): ${totalSeed} papers`)
      const vocab = extractVocabulary(seedResults)
      const seedsWithCounts = seedResults.map((r) => ({ seed: r.seed, count: r.count }))

      // --- Run both prompts in parallel to minimize API-state drift ---
      const [oldQueries, newQueries] = await Promise.all([
        buildLibraryWithPrompt(OLD_LIBRARY_PROMPT, THERAPIST_CONFIG, seedsWithCounts, vocab),
        buildLibraryWithPrompt(NEW_LIBRARY_PROMPT, THERAPIST_CONFIG, seedsWithCounts, vocab),
      ])

      console.log('\n--- OLD PROMPT queries ---')
      for (const q of oldQueries) {
        console.log(`  area=${q.research_area_id} [${tokenCount(q.query)} tok] q="${q.query}"`)
      }
      console.log('\n--- NEW PROMPT queries ---')
      for (const q of newQueries) {
        console.log(`  area=${q.research_area_id} [${tokenCount(q.query)} tok] q="${q.query}"`)
      }

      // --- Run both libraries against OpenAlex (7d) ---
      const [oldRun, newRun] = await Promise.all([runLibrary(oldQueries), runLibrary(newQueries)])
      const oldPool = dedup(oldRun.flatMap((r) => r.hits))
      const newPool = dedup(newRun.flatMap((r) => r.hits))

      console.log('\n--- OLD per-area ---')
      for (const r of oldRun) {
        console.log(`  area=${r.query.research_area_id} hits=${r.hits.length} q="${r.query.query}"`)
      }
      console.log('--- NEW per-area ---')
      for (const r of newRun) {
        console.log(`  area=${r.query.research_area_id} hits=${r.hits.length} q="${r.query.query}"`)
      }

      // --- Also measure with fix #1 applied on top of each ---
      const fromDate = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10)
      const seedHitsInWindow: OpenAlexWork[] = []
      for (const r of seedResults) {
        for (const p of r.results) if (inWindow(p, fromDate)) seedHitsInWindow.push(p)
      }
      const oldPoolPlusSeeds = dedup([...oldPool, ...seedHitsInWindow])
      const newPoolPlusSeeds = dedup([...newPool, ...seedHitsInWindow])

      // --- Precision audit ---
      const oldPrec = summarizePrecision(oldPool)
      const newPrec = summarizePrecision(newPool)
      console.log('\n--- precision (per-query) NEW ---')
      for (const r of newRun) {
        const p = summarizePrecision(r.hits)
        console.log(`  area=${r.query.research_area_id} q="${r.query.query}" rel=${p.rel} maybe=${p.maybe} off=${p.off}`)
      }

      // --- Summary ---
      console.log('\n================ RESULTS ================')
      console.log(`  OLD prompt           → library pool: ${oldPool.length}  (rel=${oldPrec.rel} maybe=${oldPrec.maybe} off=${oldPrec.off})`)
      console.log(`  OLD prompt + fix #1  → pool:         ${oldPoolPlusSeeds.length}`)
      console.log(`  NEW prompt           → library pool: ${newPool.length}  (rel=${newPrec.rel} maybe=${newPrec.maybe} off=${newPrec.off})`)
      console.log(`  NEW prompt + fix #1  → pool:         ${newPoolPlusSeeds.length}`)
      console.log(`  in-window seed hits: ${seedHitsInWindow.length}`)

      const oldCovered = new Set(oldRun.filter((r) => r.hits.length > 0).map((r) => r.query.research_area_id))
      const newCovered = new Set(newRun.filter((r) => r.hits.length > 0).map((r) => r.query.research_area_id))
      console.log(`  OLD areas covered: ${oldCovered.size}/9   NEW areas covered: ${newCovered.size}/9`)

      const oldAvgTokens = oldQueries.reduce((s, q) => s + tokenCount(q.query), 0) / oldQueries.length
      const newAvgTokens = newQueries.reduce((s, q) => s + tokenCount(q.query), 0) / newQueries.length
      console.log(`  OLD avg tokens/query: ${oldAvgTokens.toFixed(2)}  NEW: ${newAvgTokens.toFixed(2)}`)
      console.log('=========================================\n')

      // We assert NEW >= OLD, not a magic threshold.
      expect(newPool.length).toBeGreaterThanOrEqual(oldPool.length)
    },
    240_000,
  )
})
