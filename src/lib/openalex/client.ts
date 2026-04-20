// src/lib/openalex/client.ts
const OPENALEX_BASE = 'https://api.openalex.org/works'
const TYPE_FILTER = 'article|review|book-chapter|preprint|dissertation|report|peer-review'

export type FilterMode = 'search' | 'title_and_abstract.search'

export interface SearchOptions {
  query: string
  fromDate: string        // YYYY-MM-DD
  toDate: string          // YYYY-MM-DD
  perPage?: number
  page?: number
  filterMode?: FilterMode
  selectFields?: string[]
}

export interface OpenAlexWork {
  id: string
  doi?: string | null
  title?: string | null
  publication_date?: string | null
  abstract_inverted_index?: Record<string, number[]> | null
  primary_topic?: {
    display_name?: string
    subfield?: { display_name?: string }
    field?: { display_name?: string }
  } | null
  keywords?: Array<{ display_name?: string }>
  primary_location?: {
    source?: { display_name?: string }
  } | null
  authorships?: Array<{ author?: { display_name?: string } }>
  [k: string]: unknown
}

export interface SearchResponse {
  meta: { count: number; [k: string]: unknown }
  results: OpenAlexWork[]
}

export function buildSearchUrl(opts: SearchOptions): string {
  const mailto = process.env.OPENALEX_MAILTO
  const apiKey = process.env.OPENALEX_API_KEY

  const params = new URLSearchParams()
  const filterMode: FilterMode = opts.filterMode ?? 'search'

  if (filterMode === 'search') {
    params.set('search', opts.query)
    params.set(
      'filter',
      `from_publication_date:${opts.fromDate},to_publication_date:${opts.toDate},type:${TYPE_FILTER}`,
    )
  } else {
    // title_and_abstract.search goes inside the filter clause.
    params.set(
      'filter',
      `title_and_abstract.search:${opts.query},from_publication_date:${opts.fromDate},to_publication_date:${opts.toDate},type:${TYPE_FILTER}`,
    )
  }

  params.set('per_page', String(opts.perPage ?? 25))
  params.set('page', String(opts.page ?? 1))
  if (opts.selectFields && opts.selectFields.length > 0) {
    params.set('select', opts.selectFields.join(','))
  }
  if (mailto) params.set('mailto', mailto)
  if (apiKey) params.set('api_key', apiKey)

  return `${OPENALEX_BASE}?${params.toString()}`
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

const MAX_RETRIES = 3
const BASE_DELAY_MS = 500
const TIMEOUT_MS = 10_000

export async function searchByKeyword(opts: SearchOptions): Promise<SearchResponse> {
  if (!process.env.OPENALEX_MAILTO) {
    throw new Error('OPENALEX_MAILTO env var is required for the polite pool')
  }

  const url = buildSearchUrl(opts)

  let lastErr: unknown
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { Accept: 'application/json' },
      })
      if (res.ok) {
        const body = (await res.json()) as SearchResponse
        return body
      }
      if (res.status === 429 || res.status >= 500) {
        lastErr = new Error(`openalex ${res.status}`)
        await sleep(BASE_DELAY_MS * Math.pow(2, attempt))
        continue
      }
      throw new Error(`openalex ${res.status}`)
    } catch (err) {
      lastErr = err
      if (attempt < MAX_RETRIES - 1) {
        await sleep(BASE_DELAY_MS * Math.pow(2, attempt))
        continue
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('openalex unknown error')
}
