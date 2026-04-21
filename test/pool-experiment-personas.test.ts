// test/pool-experiment-personas.test.ts
//
// Stress test: six distinct user personas spanning ML, cardiology, climate
// science, digital marketing, materials science, and education research.
// For each, runs the full preview pipeline (seeds → vocab → library → run)
// against live OpenAlex with the 7-day window and NEW prompt, reporting pool
// size, area coverage, token length, and precision measured against the
// subject's own extracted field vocabulary.
//
// Each persona includes deliberate homograph-bait terms (transformer, agent,
// heat, cold, funnel, anchor, formative) to stress the anchor rule.
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

import { generateSeeds, combineSeeds, researchAreasToSeeds } from '@/lib/ai/discovery/seeds'
import { fetchSeedPapers } from '@/lib/ai/discovery/fetch-seeds'
import { extractVocabulary } from '@/lib/ai/discovery/extract-vocab'
import type { Vocabulary } from '@/lib/ai/discovery/extract-vocab'
import { buildCompactLibrary } from '@/lib/ai/discovery/build-library'
import { runLibrary } from '@/lib/ai/discovery/run-library'
import type { DigestConfig, SearchQuery } from '@/lib/config-schema'
import type { OpenAlexWork } from '@/lib/openalex/client'

type PersonaConfig = Pick<DigestConfig, 'subject' | 'profile' | 'research_areas'> & {
  name: string
  homographTraps: string[]
}

const PERSONAS: PersonaConfig[] = [
  {
    name: 'AI/LLM engineer',
    subject: 'LLM agents and tool-use in production systems',
    profile:
      'ML engineer at a SaaS company shipping production AI features. Tracks progress on agent reliability, tool-use, and evaluation. Prefers practical work over pure theory papers.',
    homographTraps: ['agent', 'transformer', 'attention', 'tool', 'chain'],
    research_areas: [
      { id: 1, text: 'Tool-use reliability in LLM agents' },
      { id: 2, text: 'Multi-step reasoning in agent frameworks' },
      { id: 3, text: 'Retrieval augmentation for agents' },
      { id: 4, text: 'Alignment and safety in agent systems' },
      { id: 5, text: 'Evaluation benchmarks for agents' },
      { id: 6, text: 'Long-context transformer architectures' },
    ],
  },
  {
    name: 'Cardiologist',
    subject: 'atrial fibrillation management and stroke prevention',
    profile:
      'Cardiologist at a community hospital focusing on AFib management and stroke prevention in outpatient practice. Wants clinically actionable evidence, not animal models.',
    homographTraps: ['screening', 'flow', 'block'],
    research_areas: [
      { id: 1, text: 'DOAC dosing in elderly AFib patients' },
      { id: 2, text: 'Catheter ablation outcomes for persistent AFib' },
      { id: 3, text: 'Left atrial appendage closure indications' },
      { id: 4, text: 'AFib screening in primary care settings' },
      { id: 5, text: 'Anticoagulation in patients with CKD' },
    ],
  },
  {
    name: 'Climate scientist',
    subject: 'ocean heat content and marine heatwaves',
    profile:
      'Physical oceanographer studying ocean-atmosphere heat exchange and long-term climate trends. Follows observational + model-based work on ocean variability.',
    homographTraps: ['heat', 'content', 'wave', 'current', 'circulation'],
    research_areas: [
      { id: 1, text: 'Ocean heat content trends over decades' },
      { id: 2, text: 'Marine heatwaves and ecosystem impacts' },
      { id: 3, text: 'Arctic sea ice variability and feedback' },
      { id: 4, text: 'Deep ocean carbon uptake dynamics' },
      { id: 5, text: 'Climate model skill vs. ocean observations' },
    ],
  },
  {
    name: 'Digital marketer',
    subject: 'consumer behavior in e-commerce checkout flows',
    profile:
      'Growth marketer at a D2C startup optimizing checkout conversion and reducing cart abandonment. Follows consumer-psych and A/B testing work, not academic theory.',
    homographTraps: ['anchor', 'funnel', 'conversion', 'trust', 'cart'],
    research_areas: [
      { id: 1, text: 'Cart abandonment recovery strategies' },
      { id: 2, text: 'One-click checkout conversion impact' },
      { id: 3, text: 'Trust signals in e-commerce UI' },
      { id: 4, text: 'Price anchoring on product pages' },
      { id: 5, text: 'Subscription vs. one-time purchase models' },
    ],
  },
  {
    name: 'Materials scientist',
    subject: 'solid-state lithium battery electrolytes',
    profile:
      'Materials science PhD working on solid-state Li-ion batteries for EV applications. Follows sulfide + oxide electrolyte work and lithium metal anode research.',
    homographTraps: ['interface', 'transport', 'conduction', 'metal'],
    research_areas: [
      { id: 1, text: 'Sulfide solid electrolyte stability' },
      { id: 2, text: 'Garnet oxide electrolytes (LLZO)' },
      { id: 3, text: 'Lithium metal anode dendrite formation' },
      { id: 4, text: 'Cathode-electrolyte interface engineering' },
      { id: 5, text: 'Manufacturing scale-up of solid-state cells' },
    ],
  },
  {
    name: 'Education researcher',
    subject: 'formative assessment in K-12 mathematics',
    profile:
      'Education researcher studying how formative assessment shapes math learning in middle school. Interested in teacher practice and equity outcomes.',
    homographTraps: ['assessment', 'feedback', 'gap', 'formative', 'scaffold'],
    research_areas: [
      { id: 1, text: 'Feedback timing in formative math assessment' },
      { id: 2, text: 'Technology-mediated formative assessment' },
      { id: 3, text: 'Teacher training for formative practices' },
      { id: 4, text: 'Equity gaps in mathematics assessment' },
      { id: 5, text: 'Student self-assessment strategies in math' },
    ],
  },
]

// ---- Helpers ----

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

/**
 * Subject-agnostic precision proxy: a paper is "in-field" if its
 * primary_topic.field is among the persona's own vocab.fields (the top fields
 * the seed fetch landed in). No hand-coded keyword lists.
 */
function inFieldCheck(w: OpenAlexWork, relevantFields: Set<string>): 'in' | 'off' | 'unknown' {
  const f = w.primary_topic?.field?.display_name
  if (!f) return 'unknown'
  return relevantFields.has(f) ? 'in' : 'off'
}

async function runPersona(p: PersonaConfig): Promise<{
  name: string
  poolSize: number
  perArea: Array<{ areaId: number; query: string; hits: number; inField: number; offField: number }>
  avgTokens: number
  areasCovered: number
  inField: number
  offField: number
  unknown: number
  relevantFields: string[]
  topicsTop: string[]
  library: SearchQuery[]
  homographTrapsInQueries: string[]
}> {
  // 1. Seeds
  const { seeds: llmSeeds } = await generateSeeds(p, {})
  const angleSeeds = researchAreasToSeeds(p.research_areas)
  const seeds = combineSeeds(llmSeeds, angleSeeds)

  // 2. Seed fetch (180d)
  const seedResults = await fetchSeedPapers(seeds)

  // 3. Vocab
  const vocab: Vocabulary = extractVocabulary(seedResults)
  const relevantFields = new Set(vocab.fields.map(([name]) => name))

  // 4. Library
  const { queries: library } = await buildCompactLibrary(
    p,
    seedResults.map((r) => ({ seed: r.seed, count: r.count })),
    vocab,
    {},
  )

  // 5. Run library (7d)
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
    return {
      areaId: r.query.research_area_id,
      query: r.query.query,
      hits: r.hits.length,
      inField: inF,
      offField: offF,
    }
  })

  // Check: did the LLM use any of the homograph-trap tokens unanchored?
  const allQueryText = library.map((q) => q.query.toLowerCase()).join(' | ')
  const homographTrapsInQueries = p.homographTraps.filter((tok) =>
    new RegExp(`\\b${tok.toLowerCase()}\\b`).test(allQueryText),
  )

  return {
    name: p.name,
    poolSize: pool.length,
    perArea,
    avgTokens,
    areasCovered,
    inField,
    offField,
    unknown,
    relevantFields: [...relevantFields],
    topicsTop: vocab.topics.slice(0, 5).map(([n]) => n),
    library,
    homographTrapsInQueries,
  }
}

const RUN = process.env.RUN_POOL_EXPERIMENT === '1'
const maybe = RUN ? describe : describe.skip

maybe('persona stress test: NEW prompt across 6 distinct subjects', () => {
  it(
    'runs preview pipeline for each persona and reports recall + precision',
    async () => {
      console.log('\n================ PERSONA STRESS TEST ================')

      // Run sequentially to avoid OpenRouter / OpenAlex rate-limit clustering.
      const results = []
      for (const p of PERSONAS) {
        console.log(`\n--- ${p.name} ---`)
        console.log(`  subject: ${p.subject}`)
        try {
          const r = await runPersona(p)
          results.push(r)
          console.log(`  vocab.fields: [${r.relevantFields.join(', ')}]`)
          console.log(`  vocab.topics top-5: [${r.topicsTop.join(' | ')}]`)
          console.log(`  library queries (${r.library.length}):`)
          for (const q of r.library) {
            console.log(`    area=${q.research_area_id} [${tokenCount(q.query)} tok] q="${q.query}"`)
          }
          console.log(`  per-area hits (inField/off):`)
          for (const a of r.perArea) {
            console.log(`    area=${a.areaId} hits=${a.hits} in=${a.inField} off=${a.offField}  q="${a.query}"`)
          }
          console.log(
            `  SUMMARY: pool=${r.poolSize} in=${r.inField} off=${r.offField} unknown=${r.unknown} areas=${r.areasCovered}/${p.research_areas.length} avgTok=${r.avgTokens.toFixed(2)}`,
          )
          if (r.homographTrapsInQueries.length > 0) {
            console.log(`  homograph traps used in queries: [${r.homographTrapsInQueries.join(', ')}]`)
          }
        } catch (e) {
          console.error(`  FAILED:`, (e as Error).message)
          results.push(null)
        }
      }

      // --- Aggregate table ---
      console.log('\n================ AGGREGATE ================')
      console.log(
        ['persona', 'pool', 'in', 'off', 'unknown', 'precision', 'areas', 'avg_tok'].join('\t'),
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
            r.poolSize,
            r.inField,
            r.offField,
            r.unknown,
            precision,
            `${r.areasCovered}/${PERSONAS[i].research_areas.length}`,
            r.avgTokens.toFixed(2),
          ].join('\t'),
        )
      }
      console.log('==============================================\n')
    },
    300_000,
  )
})
