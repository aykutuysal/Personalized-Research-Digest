// test/pool-experiment.test.ts
//
// Reproducible A/B experiment for the preview pool-size hypothesis.
//
// Replays the therapist profile from the 2026-04-21 preview log against live
// OpenAlex, keeping the 7-day library window. Measures pool size for the
// current behavior, each proposed fix in isolation, and all three combined.
//
// Gated by RUN_POOL_EXPERIMENT=1 so it never runs in CI. Expects a valid
// .env.local at the repo root.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// ---- Load .env.local (vitest doesn't read Next.js env files) ----
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
    // no .env.local — caller can still set vars directly
  }
}
loadEnvLocal()

// ---- Now safe to import server-only modules (aliased to empty.js for vitest) ----
import { generateSeeds, combineSeeds, researchAreasToSeeds } from '@/lib/ai/discovery/seeds'
import { fetchSeedPapers } from '@/lib/ai/discovery/fetch-seeds'
import { extractVocabulary } from '@/lib/ai/discovery/extract-vocab'
import { buildCompactLibrary } from '@/lib/ai/discovery/build-library'
import { runLibrary } from '@/lib/ai/discovery/run-library'
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

// ---- Helpers ----

/** Simulate fix #2 — strip subject-population qualifiers from a query. */
function stripSubjectQualifier(query: string): string {
  const STRIP = new Set(['depression', 'anxiety', 'depression/anxiety'])
  return query
    .split(/\s+/)
    .filter((w) => !STRIP.has(w.toLowerCase()))
    .join(' ')
    .trim()
}

/** Simulate fix #3 — cap the query to its first N tokens. */
function capTokens(query: string, n: number): string {
  return query.split(/\s+/).filter(Boolean).slice(0, n).join(' ')
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
    if (!key) {
      out.push(p)
      continue
    }
    if (byTitle.has(key)) continue
    byTitle.add(key)
    out.push(p)
  }
  return out
}

function inWindow(paper: OpenAlexWork, fromDate: string): boolean {
  const d = paper.publication_date
  return !!d && d >= fromDate
}

function countPerArea(queries: SearchQuery[], hitsPerQuery: OpenAlexWork[][]): string {
  return queries
    .map((q, i) => `area=${q.research_area_id} hits=${hitsPerQuery[i]?.length ?? 0} q="${q.query}"`)
    .join('\n    ')
}

const RUN = process.env.RUN_POOL_EXPERIMENT === '1'
const maybe = RUN ? describe : describe.skip

maybe('pool-experiment: 3 → ? pool size under current 7-day window', () => {
  it(
    'compares current vs. fix#1 (pool seeds) vs. fix#2 (strip) vs. fix#3 (cap 3)',
    async () => {
      console.log('\n================ POOL EXPERIMENT ================')
      console.log('Subject:', THERAPIST_CONFIG.subject)
      console.log('Areas:', THERAPIST_CONFIG.research_areas.length)
      console.log('OPENROUTER_MODEL_ID =', process.env.OPENROUTER_MODEL_ID ?? '(default)')

      // --- 1. Seeds ---
      const { seeds: llmSeeds } = await generateSeeds(THERAPIST_CONFIG, {})
      const angleSeeds = researchAreasToSeeds(THERAPIST_CONFIG.research_areas)
      const seeds = combineSeeds(llmSeeds, angleSeeds)
      console.log(`\n[1] seeds: llm=${llmSeeds.length} angle=${angleSeeds.length} combined=${seeds.length}`)
      console.log('    ', JSON.stringify(seeds))

      // --- 2. Seed fetch (180d) ---
      const seedResults = await fetchSeedPapers(seeds)
      const totalSeed = seedResults.reduce((s, r) => s + r.results.length, 0)
      console.log(`\n[2] seed-fetch (180d): ${totalSeed} papers across ${seedResults.length} seeds`)
      for (const r of seedResults) {
        console.log(`    "${r.seed}" → ${r.count} results (${r.results.length} returned)`)
      }

      // --- 3. Vocab ---
      const vocab = extractVocabulary(seedResults)
      console.log(`\n[3] vocab: topics=${vocab.topics.length} keywords=${vocab.keywords.length}`)

      // --- 4. Library ---
      const { queries: library } = await buildCompactLibrary(
        THERAPIST_CONFIG,
        seedResults.map((r) => ({ seed: r.seed, count: r.count })),
        vocab,
        {},
      )
      console.log(`\n[4] library: produced ${library.length} queries`)
      for (const q of library) {
        console.log(`    area=${q.research_area_id} q="${q.query}"`)
      }

      // --- 5. Baseline library run (7d) ---
      const baseRun = await runLibrary(library)
      const baseHits = baseRun.map((r) => r.hits)
      const baselinePool = dedup(baseRun.flatMap((r) => r.hits))
      console.log(`\n[5] BASELINE library run (7d): pool=${baselinePool.length}`)
      console.log('    ' + countPerArea(library, baseHits))

      // --- Fix #1: pool seed-fetch hits filtered to last 7d ---
      const WINDOW_DAYS = 7
      const fromDate = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString().slice(0, 10)
      const seedHitsInWindow: OpenAlexWork[] = []
      for (const r of seedResults) {
        for (const p of r.results) if (inWindow(p, fromDate)) seedHitsInWindow.push(p)
      }
      const fix1Pool = dedup([...baselinePool, ...seedHitsInWindow])
      console.log(
        `\n[fix #1] union with seed hits filtered to ${fromDate}+ : pool=${fix1Pool.length} (added ${fix1Pool.length - baselinePool.length} from ${seedHitsInWindow.length} in-window seed hits)`,
      )

      // --- Fix #2: strip subject qualifiers, re-run ---
      const fix2Queries: SearchQuery[] = library.map((q) => ({
        ...q,
        query: stripSubjectQualifier(q.query),
      }))
      console.log('\n[fix #2] stripped queries:')
      for (const q of fix2Queries) console.log(`    area=${q.research_area_id} q="${q.query}"`)
      const fix2Run = await runLibrary(fix2Queries)
      const fix2Hits = fix2Run.map((r) => r.hits)
      const fix2Pool = dedup(fix2Run.flatMap((r) => r.hits))
      console.log(`    pool=${fix2Pool.length}`)
      console.log('    ' + countPerArea(fix2Queries, fix2Hits))

      // --- Fix #3: cap library queries at 3 tokens, re-run ---
      const fix3Queries: SearchQuery[] = library.map((q) => ({
        ...q,
        query: capTokens(q.query, 3),
      }))
      console.log('\n[fix #3] 3-token queries:')
      for (const q of fix3Queries) console.log(`    area=${q.research_area_id} q="${q.query}"`)
      const fix3Run = await runLibrary(fix3Queries)
      const fix3Hits = fix3Run.map((r) => r.hits)
      const fix3Pool = dedup(fix3Run.flatMap((r) => r.hits))
      console.log(`    pool=${fix3Pool.length}`)
      console.log('    ' + countPerArea(fix3Queries, fix3Hits))

      // --- Combined: strip + cap 3, then union with in-window seed hits ---
      const combinedQueries: SearchQuery[] = library.map((q) => ({
        ...q,
        query: capTokens(stripSubjectQualifier(q.query), 3),
      }))
      console.log('\n[combined] strip + cap 3 queries:')
      for (const q of combinedQueries) console.log(`    area=${q.research_area_id} q="${q.query}"`)
      const combinedRun = await runLibrary(combinedQueries)
      const combinedHits = combinedRun.map((r) => r.hits)
      const combinedLibraryPool = dedup(combinedRun.flatMap((r) => r.hits))
      const combinedPool = dedup([...combinedLibraryPool, ...seedHitsInWindow])
      console.log(`    library pool=${combinedLibraryPool.length}`)
      console.log(`    + seed hits in window → final pool=${combinedPool.length}`)
      console.log('    ' + countPerArea(combinedQueries, combinedHits))

      // --- Summary ---
      console.log('\n================ RESULTS ================')
      console.log(`  BASELINE (current code):                 ${baselinePool.length}`)
      console.log(`  + fix #1 (pool seed hits in window):     ${fix1Pool.length}`)
      console.log(`  + fix #2 alone (strip subject):          ${fix2Pool.length}`)
      console.log(`  + fix #3 alone (cap 3 tokens):           ${fix3Pool.length}`)
      console.log(`  COMBINED #1+#2+#3:                        ${combinedPool.length}`)
      console.log('=========================================\n')

      // Hypothesis gate — pool should climb materially. We're honest: the
      // threshold is modest because weekly flow in niche psychotherapy
      // subfields is genuinely thin. Fail loudly if fixes don't help.
      expect(combinedPool.length).toBeGreaterThan(baselinePool.length)
    },
    240_000,
  )
})
