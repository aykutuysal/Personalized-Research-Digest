// src/lib/ai/preview/pipeline.ts
import 'server-only'
import { combineSeeds, generateSeeds, researchAreasToSeeds } from '@/lib/ai/discovery/seeds'
import { fetchSeedPapers } from '@/lib/ai/discovery/fetch-seeds'
import { extractVocabulary } from '@/lib/ai/discovery/extract-vocab'
import { buildCompactLibrary } from '@/lib/ai/discovery/build-library'
import { runLibrary } from '@/lib/ai/discovery/run-library'
import { curatePreview } from './curator'
import { filterCandidates } from './filter'
import type { ProgressEvent } from './progress-events'
import type { DigestConfig, SearchQuery } from '@/lib/config-schema'
import type { OpenAlexWork } from '@/lib/openalex/client'

// Poolmember that remembers which research area first surfaced it — used
// by the relevance filter to match candidates against the reader's stated
// areas. Stripped before reaching the curator (it doesn't need this hint).
type PoolMember = OpenAlexWork & { __areaId?: number }

export interface PipelineOptions {
  emit: (e: ProgressEvent) => void
  sessionId?: string | null
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 2): Promise<T> {
  let lastErr: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr))
}

export async function runPreviewPipeline(
  config: DigestConfig,
  opts: PipelineOptions,
): Promise<void> {
  const { emit, sessionId } = opts
  const tag = `[preview ${sessionId?.slice(0, 8) ?? 'no-session'}]`
  const t0 = Date.now()

  // ---- Step 1: seeds ----
  let llmSeeds: string[] = []
  try {
    const res = await withRetry(() => generateSeeds(config, { sessionId }))
    llmSeeds = res.seeds
  } catch (err) {
    emit({ kind: 'error', stage: 'seeds', message: (err as Error).message })
    return
  }
  const angleSeeds = researchAreasToSeeds(config.research_areas)
  const seeds = combineSeeds(llmSeeds, angleSeeds)
  emit({ kind: 'seeds', seeds })

  // ---- Step 2: seed fetch ----
  let seedResults = await fetchSeedPapers(seeds)
  const anyPapers = seedResults.some((s) => s.results.length > 0)
  if (!anyPapers) {
    // Fallback: raw profile text as a single wildcard.
    const fallback = await fetchSeedPapers([config.profile.slice(0, 200)])
    if (fallback[0]?.results.length > 0) {
      seedResults = fallback
    } else {
      emit({ kind: 'error', stage: 'seed-fetch', message: 'No papers found for any seed.' })
      return
    }
  }
  const papersScanned = seedResults.reduce((s, r) => s + r.results.length, 0)
  emit({
    kind: 'seed-fetch-done',
    papersScanned,
    perSeed: seedResults.map((r) => ({ seed: r.seed, count: r.count })),
  })

  // ---- Step 3: vocabulary ----
  const vocab = extractVocabulary(seedResults)
  emit({
    kind: 'vocab',
    topics: vocab.topics.length,
    keywords: vocab.keywords.length,
    fields: vocab.fields.map(([n]) => n),
  })

  // ---- Step 4: library ----
  let library: SearchQuery[] = []
  try {
    const seedsWithCounts = seedResults.map((r) => ({ seed: r.seed, count: r.count }))
    const res = await withRetry(() =>
      buildCompactLibrary(config, seedsWithCounts, vocab, { sessionId }),
    )
    if (res.queries.length < Math.min(config.research_areas.length, 1)) {
      throw new Error('Library builder returned too few queries.')
    }
    library = res.queries
  } catch (err) {
    emit({ kind: 'error', stage: 'library', message: (err as Error).message })
    return
  }
  emit({
    kind: 'library',
    queries: library.map((q) => ({ query: q.query, research_area_id: q.research_area_id })),
  })

  // ---- Step 5: run library ----
  const runResults = await runLibrary(library, {
    onResult: (r) => {
      emit({
        kind: 'area-hit',
        research_area_id: r.query.research_area_id,
        hits: r.hits.length,
        sampleTitle: r.hits[0]?.title ?? null,
      })
    },
  })
  const poolById = new Map<string, PoolMember>()
  for (const rr of runResults) {
    for (const h of rr.hits) {
      if (!poolById.has(h.id)) {
        const annotated: PoolMember = { ...h, __areaId: rr.query.research_area_id }
        poolById.set(h.id, annotated)
      }
    }
  }
  // Second-level dedup by normalized title — Zenodo/arXiv often surface
  // multiple versions of the same paper under different OpenAlex IDs.
  const seenTitleKeys = new Set<string>()
  const pool: PoolMember[] = []
  for (const w of poolById.values()) {
    const key = (w.title ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
    if (key.length === 0) {
      pool.push(w)
      continue
    }
    if (seenTitleKeys.has(key)) continue
    seenTitleKeys.add(key)
    pool.push(w)
  }

  // ---- Step 6: relevance filter ----
  // Single DeepSeek call scores the pool against the reader's profile +
  // research areas and drops off-topic hits before the curator sees them.
  // On failure, fall through with the unfiltered pool — the curator still
  // has to pick 5, and a noisy pool is better than a dead run.
  let curatorPool: PoolMember[] = pool
  if (pool.length > 0) {
    emit({ kind: 'filtering' })
    try {
      const filterRes = await filterCandidates(config, pool, { sessionId })
      if (filterRes.survivors.length >= 3) {
        curatorPool = filterRes.survivors as PoolMember[]
        emit({
          kind: 'filter-done',
          kept: filterRes.survivors.length,
          dropped: filterRes.dropped,
        })
      } else {
        console.warn(
          `${tag} filter kept only ${filterRes.survivors.length}/${pool.length} — using unfiltered pool`,
        )
        emit({ kind: 'filter-done', kept: pool.length, dropped: 0 })
      }
    } catch (err) {
      console.warn(`${tag} filter failed, using unfiltered pool:`, (err as Error).message)
      emit({ kind: 'filter-done', kept: pool.length, dropped: 0 })
    }
  }

  // ---- Step 7: curator ----
  emit({ kind: 'curating' })
  try {
    const { body, references } = await withRetry(() => curatePreview(config, curatorPool, { sessionId }))
    if (references.length < 3) {
      throw new Error(`Curator returned only ${references.length} references.`)
    }
    emit({ kind: 'done', body, references, queries: library })
    console.log(`${tag} done total_ms=${Date.now() - t0}`)
  } catch (err) {
    // Fallback: render top 5 by date, no editorial. Dedup by normalized
    // title — Zenodo and similar repos register each version as a separate
    // OpenAlex work, so ID-dedup alone leaves visible duplicates.
    const seenTitles = new Set<string>()
    const fallback = curatorPool
      .sort((a, b) => (b.publication_date ?? '').localeCompare(a.publication_date ?? ''))
      .filter((p) => {
        const key = (p.title ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
        if (key.length === 0) return true
        if (seenTitles.has(key)) return false
        seenTitles.add(key)
        return true
      })
      .slice(0, 5)
    if (fallback.length === 0) {
      emit({ kind: 'error', stage: 'curator', message: (err as Error).message })
      return
    }
    const references = fallback.map((p) => ({
      id: p.id,
      title: p.title ?? '(untitled)',
      authors: ((p.authorships ?? []).map((a) => a?.author?.display_name).filter(Boolean) as string[])[0] ?? 'Unknown',
      venue: p.primary_location?.source?.display_name ?? '',
      date: p.publication_date ?? '',
      url: p.doi ? `https://doi.org/${p.doi}` : `https://openalex.org/${p.id}`,
    }))
    emit({
      kind: 'done',
      body: `_Your editor couldn't finish this preview. You'll see the full write-up after you subscribe._\n\nMost recent across your research areas:\n\n${references.map((r, i) => `${i + 1}. ${r.title}`).join('\n')}`,
      references,
      queries: library,
    })
    console.warn(`${tag} curator fallback used: ${(err as Error).message}`)
  }
}
