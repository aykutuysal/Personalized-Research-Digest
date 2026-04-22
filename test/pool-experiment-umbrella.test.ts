// test/pool-experiment-umbrella.test.ts
//
// Umbrella-queries experiment (variants A + B).
//
// Hypothesis: when a reader's subject names established frameworks the literature
// itself indexes (e.g. "CBT and schema therapy", "reinforcement learning"), the
// current system over-decomposes into sub-mechanisms and never emits a query for
// the umbrella term itself. Canonical umbrella papers (meta-analyses, foundational
// reviews, protocol updates) are left on the floor.
//
// Four arms, same subject+profile input per persona:
//   BASELINE — current proposer prompt, current library (areas-only)
//   A only   — prompts/propose-research-areas-system-v2.md carve-out + library as-is
//   B only   — current proposer + deterministic umbrella queries appended to library
//   A + B    — both
//
// Shared per persona: seeds, seed-fetch, vocab (using BASELINE areas for seed
// derivation). Isolates the change to proposer → library stages. Runs all 7
// personas in parallel; within each persona the 4 arms also run in parallel.
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

import { generateObject } from 'ai'
import { proposalModel } from '@/lib/ai/openrouter'
import { proposeResearchAreasOutputSchema } from '@/lib/ai/propose-research-areas'
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
  {
    name: 'Clinical psychologist',
    subject: 'CBT and schema therapy',
    profile:
      'Clinical psychologist in private practice treating depression, anxiety, and personality disorders. Wants updates on CBT and schema therapy specifically — protocol revisions, new RCTs, meta-analyses, and mechanism research that changes how sessions run. Not interested in animal studies, neurobiology at the molecular level, or non-clinical cognitive science.',
  },
]

// Umbrella-queries lane (variant B).
//
// Deterministic subject parser: split on " and "/comma/semicolon, strip trailing
// scope clauses (" in …", " for …", " of …", " with …", " at …"), drop leading
// stopwords, keep fragments with 1–4 content words. Every surviving fragment
// becomes a query with its literal text — no rewriting, no AND/OR.
const UMBRELLA_STOPWORDS = new Set([
  'and', 'or', 'the', 'a', 'an', 'for', 'of', 'with', 'to', 'on', 'in', 'by', 'as', 'at',
])

function extractUmbrellaTerms(subject: string): string[] {
  const parts = subject.split(/\s*(?:,|;|\band\b)\s*/i).map((p) => p.trim()).filter(Boolean)
  const out: string[] = []
  for (let p of parts) {
    p = p.replace(/\s+(in|for|of|with|at)\s+.+$/i, '').trim()
    const words = p.split(/\s+/).filter((w) => !UMBRELLA_STOPWORDS.has(w.toLowerCase()))
    if (words.length >= 1 && words.length <= 4) {
      out.push(words.join(' '))
    }
  }
  const seen = new Set<string>()
  return out.filter((t) => {
    const k = t.toLowerCase()
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

function buildUmbrellaQueries(subject: string): SearchQuery[] {
  const terms = extractUmbrellaTerms(subject)
  return terms.map((term, i) => ({
    query: term,
    research_area_id: 1000 + i, // sentinel range outside 1..12 area IDs
    source: 'preview' as const,
    rationale: `umbrella query derived from subject="${subject}"`,
  }))
}

// Proposer, but with an overridable system-prompt file. Lets us A/B the prompt
// without touching production's cached-prompt path.
async function proposeWithPrompt(
  subject: string,
  profile: string,
  systemPromptPath: string,
): Promise<ResearchArea[]> {
  const system = readFileSync(resolve(process.cwd(), systemPromptPath), 'utf8')
  const { object } = await generateObject({
    model: proposalModel({ sessionId: null }),
    schema: proposeResearchAreasOutputSchema,
    system,
    prompt: [
      `SUBJECT: ${subject}`,
      '',
      `READER PROFILE:\n${profile}`,
    ].join('\n'),
    temperature: 0.7,
  })
  return object.angles.slice(0, 12).map((a, i) => ({ id: i + 1, text: a.text }))
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
function tokenCount(s: string): number {
  return s.split(/\s+/).filter(Boolean).length
}
function inFieldCheck(w: OpenAlexWork, relevantFields: Set<string>): 'in' | 'off' | 'unknown' {
  const f = w.primary_topic?.field?.display_name
  if (!f) return 'unknown'
  return relevantFields.has(f) ? 'in' : 'off'
}
// "Umbrella paper" = title mentions one of the subject-derived umbrella terms
// verbatim (case-insensitive). Direct measure of whether papers filed under the
// canonical framework label make it into the pool at all.
function countUmbrellaHits(pool: OpenAlexWork[], umbrellaTerms: string[]): number {
  if (umbrellaTerms.length === 0) return 0
  const lowered = umbrellaTerms.map((t) => t.toLowerCase())
  let hits = 0
  for (const p of pool) {
    const title = (p.title ?? '').toLowerCase()
    if (!title) continue
    if (lowered.some((t) => title.includes(t))) hits++
  }
  return hits
}

interface ArmResult {
  arm: 'BASELINE' | 'A' | 'B' | 'A+B'
  areas: ResearchArea[]
  library: SearchQuery[]
  perQuery: Array<{ areaId: number; areaText: string; query: string; hits: number; inField: number; offField: number; isUmbrella: boolean }>
  poolSize: number
  inField: number
  offField: number
  unknown: number
  umbrellaHits: number
  avgTokens: number
  areasCovered: number
  umbrellaTermsUsed: string[]
}

async function runArm(
  arm: ArmResult['arm'],
  persona: Persona,
  shared: {
    seedResults: { seed: string; count: number; results: OpenAlexWork[] }[]
    vocab: Vocabulary
    relevantFields: Set<string>
    // Pre-computed per variant to isolate umbrella effect from proposer stochasticity.
    // BASELINE and B share baselineAreas+baselineLibrary; A and A+B share variantAAreas+variantALibrary.
    baselineAreas: ResearchArea[]
    baselineLibrary: SearchQuery[]
    variantAAreas: ResearchArea[]
    variantALibrary: SearchQuery[]
  },
): Promise<ArmResult> {
  const variantA = arm === 'A' || arm === 'A+B'
  const variantB = arm === 'B' || arm === 'A+B'

  const areas = variantA ? shared.variantAAreas : shared.baselineAreas
  const areaQueries = variantA ? shared.variantALibrary : shared.baselineLibrary

  const umbrellaQueries = variantB ? buildUmbrellaQueries(persona.subject) : []
  const library: SearchQuery[] = [...areaQueries, ...umbrellaQueries]
  const umbrellaTerms = umbrellaQueries.map((q) => q.query)

  const runResults = await runLibrary(library)
  const pool = dedup(runResults.flatMap((r) => r.hits))
  const inField = pool.filter((w) => inFieldCheck(w, shared.relevantFields) === 'in').length
  const offField = pool.filter((w) => inFieldCheck(w, shared.relevantFields) === 'off').length
  const unknown = pool.filter((w) => inFieldCheck(w, shared.relevantFields) === 'unknown').length
  const umbrellaHits = countUmbrellaHits(pool, umbrellaTerms.length > 0 ? umbrellaTerms : extractUmbrellaTerms(persona.subject))
  const avgTokens = library.reduce((s, q) => s + tokenCount(q.query), 0) / Math.max(library.length, 1)
  const areasCovered = runResults.filter(
    (r) => r.hits.length > 0 && r.query.research_area_id < 1000,
  ).length

  const perQuery = runResults.map((r) => {
    let inF = 0, offF = 0
    for (const w of r.hits) {
      const v = inFieldCheck(w, shared.relevantFields)
      if (v === 'in') inF++
      else if (v === 'off') offF++
    }
    const isUmbrella = r.query.research_area_id >= 1000
    const areaText = isUmbrella
      ? `[umbrella] ${r.query.query}`
      : (areas.find((a) => a.id === r.query.research_area_id)?.text ?? '(unknown area)')
    return {
      areaId: r.query.research_area_id,
      areaText,
      query: r.query.query,
      hits: r.hits.length,
      inField: inF,
      offField: offF,
      isUmbrella,
    }
  })

  return {
    arm,
    areas,
    library,
    perQuery,
    poolSize: pool.length,
    inField,
    offField,
    unknown,
    umbrellaHits,
    avgTokens,
    areasCovered,
    umbrellaTermsUsed: umbrellaTerms,
  }
}

async function runPersona(persona: Persona): Promise<{ persona: Persona; baselineAreas: ResearchArea[]; variantAAreas: ResearchArea[]; umbrellaTerms: string[]; arms: ArmResult[]; error?: string }> {
  try {
    // Variant A shipped — the "baseline" and "variant A" prompts are now the
    // same file on master. Kept two separate proposer calls so the test shape
    // (4 arms, 2 area lists) is preserved for future re-runs that want to
    // compare a resurrected historical prompt via git. Both calls use the
    // current shipped prompt.
    const [baselineAreas, variantAAreas] = await Promise.all([
      proposeWithPrompt(persona.subject, persona.profile, 'prompts/propose-research-areas-system.md'),
      proposeWithPrompt(persona.subject, persona.profile, 'prompts/propose-research-areas-system.md'),
    ])

    // Seeds+vocab: use baseline areas (the field is the field — decomposition
    // shape shouldn't meaningfully shift vocab).
    const baselineConfig = { subject: persona.subject, profile: persona.profile, research_areas: baselineAreas }
    const { seeds: llmSeeds } = await generateSeeds(baselineConfig, {})
    const angleSeeds = researchAreasToSeeds(baselineAreas)
    const seeds = combineSeeds(llmSeeds, angleSeeds)
    const seedResults = await fetchSeedPapers(seeds)
    const vocab = extractVocabulary(seedResults)
    const relevantFields = new Set(vocab.fields.map(([name]) => name))

    // Build both area libraries ONCE each, in parallel.
    const [baselineLib, variantALib] = await Promise.all([
      buildCompactLibrary(
        { ...baselineConfig, research_areas: baselineAreas },
        seedResults.map((r) => ({ seed: r.seed, count: r.count })),
        vocab,
        {},
      ),
      buildCompactLibrary(
        { subject: persona.subject, profile: persona.profile, research_areas: variantAAreas },
        seedResults.map((r) => ({ seed: r.seed, count: r.count })),
        vocab,
        {},
      ),
    ])

    const umbrellaTerms = extractUmbrellaTerms(persona.subject)

    const shared = {
      seedResults,
      vocab,
      relevantFields,
      baselineAreas,
      baselineLibrary: baselineLib.queries,
      variantAAreas,
      variantALibrary: variantALib.queries,
    }

    // Arms sequential within a persona to stay under OpenAlex's polite-pool
    // rate limit. Personas still run in parallel; that's where wall-clock
    // parallelism comes from. Running all 28 arms at once reliably rate-limits.
    const arms: ArmResult[] = []
    for (const name of ['BASELINE', 'A', 'B', 'A+B'] as const) {
      arms.push(await runArm(name, persona, shared))
    }

    return { persona, baselineAreas, variantAAreas, umbrellaTerms, arms }
  } catch (err) {
    return { persona, baselineAreas: [], variantAAreas: [], umbrellaTerms: [], arms: [], error: (err as Error).message ?? String(err) }
  }
}

const RUN = process.env.RUN_POOL_EXPERIMENT === '1'
const maybe = RUN ? describe : describe.skip

maybe('umbrella queries (variants A + B) — 7 personas, 4 arms each', () => {
  it(
    'compares BASELINE vs A vs B vs A+B across all personas',
    async () => {
      console.log('\n================ UMBRELLA-QUERIES STRESS TEST ================')
      console.log(`Launching ${PERSONAS.length} personas in parallel, 4 arms each...\n`)

      const results = await Promise.all(PERSONAS.map((p) => runPersona(p)))

      for (const r of results) {
        const { persona, baselineAreas, variantAAreas, umbrellaTerms, arms, error } = r
        console.log(`\n========== ${persona.name} ==========`)
        console.log(`subject: ${persona.subject}`)
        console.log(`umbrella terms extracted: [${umbrellaTerms.map((t) => `"${t}"`).join(', ')}]`)
        if (error) {
          console.error(`  FAILED: ${error}`)
          continue
        }
        console.log(`\n  BASELINE areas (shared by arms BASELINE, B):`)
        for (const a of baselineAreas) console.log(`    ${a.id}. ${a.text}`)
        console.log(`  variant-A areas (shared by arms A, A+B):`)
        for (const a of variantAAreas) console.log(`    ${a.id}. ${a.text}`)

        for (const arm of arms) {
          console.log(`\n  --- arm ${arm.arm} ---`)
          console.log(`    areas (${arm.areas.length}):`)
          for (const a of arm.areas) console.log(`      ${a.id}. ${a.text}`)
          console.log(`    library queries (${arm.library.length}):`)
          for (const q of arm.perQuery) {
            const tag = q.isUmbrella ? '[UMBR]' : '[area]'
            console.log(`      ${tag} id=${q.areaId} hits=${q.hits} in=${q.inField} off=${q.offField}  query="${q.query}"`)
          }
          console.log(
            `    pool=${arm.poolSize} in=${arm.inField} off=${arm.offField} unk=${arm.unknown} umbrella-papers=${arm.umbrellaHits} areas=${arm.areasCovered}/${arm.areas.length} avgTok=${arm.avgTokens.toFixed(2)}`,
          )
        }
      }

      console.log('\n================ AGGREGATE ================')
      const header = [
        'persona', 'arm', 'areas', 'lib', 'pool', 'in', 'off', 'unk',
        'precision', 'coverage', 'umbrella-papers', 'avg_tok',
      ]
      console.log(header.join('\t'))
      for (const r of results) {
        if (r.error) {
          console.log([r.persona.name, 'FAILED', r.error].join('\t'))
          continue
        }
        for (const arm of r.arms) {
          const denom = arm.inField + arm.offField
          const precision = denom > 0 ? ((arm.inField / denom) * 100).toFixed(0) + '%' : '—'
          console.log(
            [
              r.persona.name,
              arm.arm,
              arm.areas.length,
              arm.library.length,
              arm.poolSize,
              arm.inField,
              arm.offField,
              arm.unknown,
              precision,
              `${arm.areasCovered}/${arm.areas.length}`,
              arm.umbrellaHits,
              arm.avgTokens.toFixed(2),
            ].join('\t'),
          )
        }
      }
      console.log('==============================================\n')

      // Per-persona deltas BASELINE → A+B, the headline comparison.
      console.log('================ DELTA: BASELINE → A+B ================')
      console.log(['persona', 'pool Δ', 'in Δ', 'umbrella Δ', 'precision Δ'].join('\t'))
      for (const r of results) {
        if (r.error || r.arms.length < 4) continue
        const base = r.arms.find((a) => a.arm === 'BASELINE')!
        const ab = r.arms.find((a) => a.arm === 'A+B')!
        const bp = base.inField + base.offField
        const ap = ab.inField + ab.offField
        const basePrec = bp > 0 ? base.inField / bp : 0
        const abPrec = ap > 0 ? ab.inField / ap : 0
        console.log(
          [
            r.persona.name,
            `${base.poolSize} → ${ab.poolSize}  (+${ab.poolSize - base.poolSize})`,
            `${base.inField} → ${ab.inField}  (+${ab.inField - base.inField})`,
            `${base.umbrellaHits} → ${ab.umbrellaHits}  (+${ab.umbrellaHits - base.umbrellaHits})`,
            `${(basePrec * 100).toFixed(0)}% → ${(abPrec * 100).toFixed(0)}%`,
          ].join('\t'),
        )
      }
      console.log('==============================================\n')
    },
    900_000,
  )
})
