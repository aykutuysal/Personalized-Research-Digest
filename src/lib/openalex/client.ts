// src/lib/openalex/client.ts
const OPENALEX_BASE = 'https://api.openalex.org/works'
const TYPE_FILTER = 'article|review|book-chapter|preprint|dissertation|report|peer-review'

export interface SearchOptions {
  query: string
  fromDate: string // YYYY-MM-DD
  toDate: string // YYYY-MM-DD
  perPage?: number
  page?: number
}

export interface OpenAlexWork {
  id: string
  doi?: string | null
  title?: string | null
  publication_date?: string | null
  abstract_inverted_index?: Record<string, number[]> | null
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
  params.set('search', opts.query)
  params.set(
    'filter',
    `from_publication_date:${opts.fromDate},to_publication_date:${opts.toDate},type:${TYPE_FILTER}`,
  )
  params.set('per_page', String(opts.perPage ?? 25))
  params.set('page', String(opts.page ?? 1))
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
