// src/lib/ai/discovery/run-library.ts
import 'server-only'
import { searchByKeyword } from '@/lib/openalex/client'
import type { OpenAlexWork } from '@/lib/openalex/client'
import type { SearchQuery } from '@/lib/config-schema'

const SELECT_FIELDS = [
  'id',
  'title',
  'publication_date',
  'abstract_inverted_index',
  'primary_location',
  'authorships',
  'primary_topic',
]

export interface QueryRunResult {
  query: SearchQuery
  hits: OpenAlexWork[]
  totalCount: number
  error: string | null
}

/**
 * Run the compact library against the last `windowDays` days in parallel.
 * Each query retrieves up to `perPage` hits; returns results in input order.
 */
export async function runLibrary(
  library: SearchQuery[],
  opts: { windowDays?: number; perPage?: number; onResult?: (r: QueryRunResult) => void } = {},
): Promise<QueryRunResult[]> {
  const windowDays = opts.windowDays ?? 7
  const perPage = opts.perPage ?? 15
  const toDate = new Date().toISOString().slice(0, 10)
  const fromDate = new Date(Date.now() - windowDays * 86_400_000).toISOString().slice(0, 10)

  const results: QueryRunResult[] = new Array(library.length)
  const tasks = library.map(async (q, i) => {
    try {
      const res = await searchByKeyword({
        query: q.query,
        fromDate,
        toDate,
        perPage,
        filterMode: 'title_and_abstract.search',
        selectFields: SELECT_FIELDS,
      })
      const result: QueryRunResult = {
        query: q,
        hits: res.results,
        totalCount: res.meta.count,
        error: null,
      }
      results[i] = result
      opts.onResult?.(result)
    } catch (err) {
      const result: QueryRunResult = {
        query: q,
        hits: [],
        totalCount: -1,
        error: (err as Error).message ?? 'unknown',
      }
      results[i] = result
      opts.onResult?.(result)
    }
  })
  await Promise.all(tasks)
  return results
}
