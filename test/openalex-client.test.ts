import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { buildSearchUrl, searchByKeyword } from '@/lib/openalex/client'

const MAILTO = 'test@example.com'

beforeEach(() => {
  process.env.OPENALEX_MAILTO = MAILTO
  delete process.env.OPENALEX_API_KEY
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('buildSearchUrl', () => {
  it('includes search, filter, pagination, mailto, and type filter', () => {
    const url = buildSearchUrl({
      query: '"catheter ablation" AND afib',
      fromDate: '2026-03-14',
      toDate: '2026-04-13',
      perPage: 25,
      page: 1,
    })
    expect(url).toContain('https://api.openalex.org/works?')
    expect(url).toContain('search=%22catheter+ablation%22+AND+afib')
    expect(url).toContain('from_publication_date%3A2026-03-14')
    expect(url).toContain('to_publication_date%3A2026-04-13')
    expect(url).toContain('type%3Aarticle%7Creview%7Cbook-chapter%7Cpreprint%7Cdissertation%7Creport%7Cpeer-review')
    expect(url).toContain('per_page=25')
    expect(url).toContain('page=1')
    expect(url).toContain(`mailto=${encodeURIComponent(MAILTO)}`)
    expect(url).not.toContain('api_key=')
  })

  it('includes api_key when env var is set', () => {
    process.env.OPENALEX_API_KEY = 'SECRET'
    const url = buildSearchUrl({
      query: 'x',
      fromDate: '2026-01-01',
      toDate: '2026-01-31',
    })
    expect(url).toContain('api_key=SECRET')
  })
})

describe('searchByKeyword', () => {
  it('returns parsed meta and results on 200', async () => {
    const fetchSpy = vi
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ meta: { count: 2 }, results: [{ id: 'W1' }, { id: 'W2' }] }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
    const r = await searchByKeyword({
      query: 'x',
      fromDate: '2026-01-01',
      toDate: '2026-01-31',
    })
    expect(r.meta.count).toBe(2)
    expect(r.results).toHaveLength(2)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('retries on 429 then succeeds', async () => {
    const fetchSpy = vi
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response('rate', { status: 429 }))
      .mockResolvedValueOnce(new Response('rate', { status: 429 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ meta: { count: 0 }, results: [] }), {
          status: 200,
        }),
      )
    const r = await searchByKeyword({
      query: 'x',
      fromDate: '2026-01-01',
      toDate: '2026-01-31',
    })
    expect(r.meta.count).toBe(0)
    expect(fetchSpy).toHaveBeenCalledTimes(3)
  })

  it('throws after 3 failures', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response('nope', { status: 500 }))
    await expect(
      searchByKeyword({ query: 'x', fromDate: '2026-01-01', toDate: '2026-01-31' }),
    ).rejects.toThrow()
  })

  it('throws when OPENALEX_MAILTO is missing', async () => {
    delete process.env.OPENALEX_MAILTO
    await expect(
      searchByKeyword({ query: 'x', fromDate: '2026-01-01', toDate: '2026-01-31' }),
    ).rejects.toThrow(/OPENALEX_MAILTO/)
  })
})
