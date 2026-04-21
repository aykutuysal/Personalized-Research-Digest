// test/pool-experiment-personas-full.test.ts
//
// End-to-end stress test: I provide only subject + profile text, like a user
// would in onboarding. DeepSeek then:
//   1. Proposes research areas (proposeResearchAreas)
//   2. Generates seed queries (generateSeeds)
//   3. Builds the compact library (buildCompactLibrary, NEW prompt)
//
// We then hit OpenAlex with the library queries and report recall +
// precision. No hand-written areas, no cherry-picking.
//
// Gated by RUN_POOL_EXPERIMENT=1.

import { describe, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

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
      ) val = val.slice(1, -1)
      if (!process.env[key]) process.env[key] = val
    }
  } catch {}
}
loadEnvLocal()

import { proposeResearchAreas } from '@/lib/ai/propose-research-areas'
import { generateSeeds, combineSeeds, researchAreasToSeeds } from '@/lib/ai/discovery/seeds'
import { fetchSeedPapers } from '@/lib/ai/discovery/fetch-seeds'
import { extractVocabulary } from '@/lib/ai/discovery/extract-vocab'
import type { Vocabulary } from '@/lib/ai/discovery/extract-vocab'
import { buildCompactLibrary } from '@/lib/ai/discovery/build-library'
import { runLibrary } from '@/lib/ai/discovery/run-library'
import type { SearchQuery, ResearchArea } from '@/lib/config-schema'
import type { OpenAlexWork } from '@/lib/openalex/client'

interface Persona {
  name: string
  subject: string
  profile: string
}

const PERSONAS: Persona[] = [
  {
    name: 'AI/LLM engineer',
    subject: 'LLM agents and tool-use in production systems',
    profile:
      'ML engineer at a SaaS company shipping production AI features. Tracks progress on agent reliability, tool-use, and evaluation. Prefers practical work over pure theory papers.',
  },
  {
    name: 'Cardiologist',
    subject: 'atrial fibrillation management and stroke prevention',
    profile:
      'Cardiologist at a community hospital focusing on AFib management and stroke prevention in outpatient practice. Wants clinically actionable evidence, not animal models.',
  },
  {
    name: 'Climate scientist',
    subject: 'ocean heat content and marine heatwaves',
    profile:
      'Physical oceanographer studying ocean-atmosphere heat exchange and long-term climate trends. Follows observational and model-based work on ocean variability.',
  },
  {
    name: 'Digital marketer',
    subject: 'consumer behavior in e-commerce checkout flows',
    profile:
      'Growth marketer at a D2C startup optimizing checkout conversion and reducing cart abandonment. Follows consumer-psych and A/B testing work, not academic theory.',
  },
  {
    name: 'Materials scientist',
    subject: 'solid-state lithium battery electrolytes',
    profile:
      'Materials science PhD working on solid-state Li-ion batteries for EV applications. Follows sulfide and oxide electrolyte work and lithium metal anode research.',
  },
  {
    name: 'Education researcher',
    subject: 'formative assessment in K-12 mathematics',
    profile:
      'Education researcher studying how formative assessment shapes math learning in middle school. Interested in teacher practice and equity outcomes.',
  },
]

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
function tokenCount(s: string): number {
  return s.split(/\s+/).filter(Boolean).length
}
function inFieldCheck(w: OpenAlexWork, relevantFields: Set<string>): 'in' | 'off' | 'unknown' {
  const f = w.primary_topic?.field?.display_name
  if (!f) return 'unknown'
  return relevantFields.has(f) ? 'in' : 'off'
}

interface PersonaResult {
  name: string
  subject: string
  profile: string
  areas: ResearchArea[]
  library: SearchQuery[]
  perArea: Array<{ areaId: number; areaText: string; query: string; hits: number; inField: number; offField: number }>
  poolSize: number
  inField: number
  offField: number
  unknown: number
  relevantFields: string[]
  avgTokens: number
  areasCovered: number
}

async function runPersona(p: Persona): Promise<PersonaResult> {
  // 1. Propose research areas (LLM)
  const { angles } = await proposeResearchAreas({
    subject: p.subject,
    profileSummary: p.profile,
  })
  // Map to DigestConfig ResearchArea shape
  const researchAreas: ResearchArea[] = angles.map((a, i) => ({ id: i + 1, text: a.text }))

  const config = {
    subject: p.subject,
    profile: p.profile,
    research_areas: researchAreas,
  }

  // 2. Seeds
  const { seeds: llmSeeds } = await generateSeeds(config, {})
  const angleSeeds = researchAreasToSeeds(researchAreas)
  const seeds = combineSeeds(llmSeeds, angleSeeds)

  // 3. Seed fetch (180d)
  const seedResults = await fetchSeedPapers(seeds)

  // 4. Vocab
  const vocab: Vocabulary = extractVocabulary(seedResults)
  const relevantFields = new Set(vocab.fields.map(([name]) => name))

  // 5. Library
  const { queries: library } = await buildCompactLibrary(
    config,
    seedResults.map((r) => ({ seed: r.seed, count: r.count })),
    vocab,
    {},
  )

  // 6. Run library (7d)
  const runResults = await runLibrary(library)

  // Stats
  const pool = dedup(runResults.flatMap((r) => r.hits))
  const inField = pool.filter((w) => inFieldCheck(w, relevantFields) === 'in').length
  const offField = pool.filter((w) => inFieldCheck(w, relevantFields) === 'off').length
  const unknown = pool.filter((w) => inFieldCheck(w, relevantFields) === 'unknown').length
  const avgTokens = library.reduce((s, q) => s + tokenCount(q.query), 0) / Math.max(library.length, 1)
  const areasCovered = runResults.filter((r) => r.hits.length > 0).length

  const perArea = runResults.map((r) => {
    let inF = 0, offF = 0
    for (const w of r.hits) {
      const v = inFieldCheck(w, relevantFields)
      if (v === 'in') inF++
      else if (v === 'off') offF++
    }
    const area = researchAreas.find((a) => a.id === r.query.research_area_id)
    return {
      areaId: r.query.research_area_id,
      areaText: area?.text ?? '(unknown area)',
      query: r.query.query,
      hits: r.hits.length,
      inField: inF,
      offField: offF,
    }
  })

  return {
    name: p.name,
    subject: p.subject,
    profile: p.profile,
    areas: researchAreas,
    library,
    perArea,
    poolSize: pool.length,
    inField,
    offField,
    unknown,
    relevantFields: [...relevantFields],
    avgTokens,
    areasCovered,
  }
}

const RUN = process.env.RUN_POOL_EXPERIMENT === '1'
const maybe = RUN ? describe : describe.skip

maybe('persona FULL-PATH stress test: only subject + profile, DeepSeek does the rest', () => {
  it(
    'runs proposeResearchAreas + seeds + library + run for each persona',
    async () => {
      console.log('\n================ FULL-PATH PERSONA STRESS TEST ================')

      // Run personas in parallel — each is fully independent (own LLM calls,
      // own OpenAlex calls). Keeps total wall-clock ~= slowest persona rather
      // than sum of all personas.
      console.log(`Launching ${PERSONAS.length} personas in parallel...\n`)
      const settled = await Promise.allSettled(PERSONAS.map((p) => runPersona(p)))
      const results: Array<PersonaResult | null> = settled.map((s) =>
        s.status === 'fulfilled' ? s.value : null,
      )

      for (let i = 0; i < PERSONAS.length; i++) {
        const p = PERSONAS[i]
        const r = results[i]
        console.log(`\n========== ${p.name} ==========`)
        console.log(`subject: ${p.subject}`)
        console.log(`profile: ${p.profile}`)
        try {
          if (!r) {
            const s = settled[i]
            throw new Error(s.status === 'rejected' ? (s.reason as Error).message : 'null result')
          }

          console.log(`\n  LLM-proposed research areas (${r.areas.length}):`)
          for (const a of r.areas) console.log(`    ${a.id}. ${a.text}`)
          console.log(`  vocab.fields: [${r.relevantFields.join(', ')}]`)
          console.log(`\n  library queries + results:`)
          for (const a of r.perArea) {
            console.log(
              `    area=${a.areaId} [${tokenCount(a.query)} tok] hits=${a.hits} in=${a.inField} off=${a.offField}`,
            )
            console.log(`      area="${a.areaText}"`)
            console.log(`      query="${a.query}"`)
          }
          console.log(
            `\n  SUMMARY: pool=${r.poolSize} in=${r.inField} off=${r.offField} unknown=${r.unknown} areas=${r.areasCovered}/${r.areas.length} avgTok=${r.avgTokens.toFixed(2)}`,
          )
        } catch (e) {
          console.error(`  FAILED:`, (e as Error).message)
        }
      }

      console.log('\n================ AGGREGATE ================')
      console.log(
        ['persona', 'areas', 'pool', 'in', 'off', 'unk', 'precision', 'coverage', 'avg_tok'].join('\t'),
      )
      for (let i = 0; i < PERSONAS.length; i++) {
        const r = results[i]
        if (!r) {
          console.log([PERSONAS[i].name, 'FAILED'].join('\t'))
          continue
        }
        const denom = r.inField + r.offField
        const precision = denom > 0 ? ((r.inField / denom) * 100).toFixed(0) + '%' : '—'
        console.log(
          [
            r.name,
            r.areas.length,
            r.poolSize,
            r.inField,
            r.offField,
            r.unknown,
            precision,
            `${r.areasCovered}/${r.areas.length}`,
            r.avgTokens.toFixed(2),
          ].join('\t'),
        )
      }
      console.log('==============================================\n')
    },
    540_000,
  )
})
