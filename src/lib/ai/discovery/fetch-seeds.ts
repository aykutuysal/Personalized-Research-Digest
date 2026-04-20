// src/lib/ai/discovery/fetch-seeds.ts
import 'server-only'
import { searchByKeyword } from '@/lib/openalex/client'
import type { OpenAlexWork } from '@/lib/openalex/client'

const SELECT_FIELDS = [
  'id',
  'title',
  'primary_topic',
  'keywords',
  'primary_location',
  'publication_date',
  'abstract_inverted_index',
  'authorships',
]

export interface SeedFetchResult {
  seed: string
  count: number
  results: OpenAlexWork[]
}

/**
 * Fetch up to `perPage` papers per seed in parallel, using
 * `title_and_abstract.search` against the last `windowDays` days.
 * Returns one entry per seed in input order.
 */
export async function fetchSeedPapers(
  seeds: string[],
  opts: { windowDays?: number; perPage?: number } = {},
): Promise<SeedFetchResult[]> {
  const windowDays = opts.windowDays ?? 180 // 6 months
  const perPage = opts.perPage ?? 50
  const toDate = new Date().toISOString().slice(0, 10)
  const fromDate = new Date(Date.now() - windowDays * 86_400_000).toISOString().slice(0, 10)

  const tasks = seeds.map(async (seed): Promise<SeedFetchResult> => {
    try {
      const res = await searchByKeyword({
        query: seed,
        fromDate,
        toDate,
        perPage,
        filterMode: 'title_and_abstract.search',
        selectFields: SELECT_FIELDS,
      })
      return { seed, count: res.meta.count, results: res.results }
    } catch {
      return { seed, count: -1, results: [] }
    }
  })

  return Promise.all(tasks)
}
