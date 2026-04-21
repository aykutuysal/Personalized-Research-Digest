import { describe, it, expect } from 'vitest'
import { extractVocabulary } from '@/lib/ai/discovery/extract-vocab'
import type { SeedFetchResult } from '@/lib/ai/discovery/fetch-seeds'
import type { OpenAlexWork } from '@/lib/openalex/client'

function paper(
  id: string,
  title: string,
  extras: Partial<OpenAlexWork> = {},
): OpenAlexWork {
  return {
    id,
    title,
    primary_topic: {
      display_name: 'Topic A',
      subfield: { display_name: 'Subfield A' },
      field: { display_name: 'Field A' },
    },
    keywords: [{ display_name: 'keyword-x' }],
    primary_location: { source: { display_name: 'Journal A' } },
    ...extras,
  }
}

function seedFetch(seed: string, results: OpenAlexWork[]): SeedFetchResult {
  return { seed, count: results.length, results }
}

describe('extractVocabulary — paper-level dedup', () => {
  it('deduplicates papers that appear in multiple seed results by ID', () => {
    const p1 = paper('W1', 'Paper One')
    const p2 = paper('W2', 'Paper Two')
    const seeds: SeedFetchResult[] = [
      seedFetch('seed-a', [p1, p2]),
      seedFetch('seed-b', [p1]), // p1 surfaced by a second seed
    ]

    const vocab = extractVocabulary(seeds)

    expect(vocab.totalPapers).toBe(2) // not 3
    expect(vocab.sampleTitles).toEqual(['Paper One', 'Paper Two'])
    expect(vocab.topics).toEqual([['Topic A', 2]]) // not 3
    expect(vocab.keywords).toEqual([['keyword-x', 2]])
  })

  it('deduplicates by normalized title when IDs differ (Zenodo-style versions)', () => {
    const p1 = paper('W100', 'Same Paper, Two Versions')
    const p1Dup = paper('W200', 'Same Paper, Two Versions') // different ID, same title
    const seeds: SeedFetchResult[] = [
      seedFetch('seed-a', [p1]),
      seedFetch('seed-b', [p1Dup]),
    ]

    const vocab = extractVocabulary(seeds)

    expect(vocab.totalPapers).toBe(1)
    expect(vocab.sampleTitles).toEqual(['Same Paper, Two Versions'])
  })

  it('caps sampleTitles at 15 with no duplicates', () => {
    // 10 unique papers, each returned by two seeds → 20 push attempts.
    const results = Array.from({ length: 10 }, (_, i) =>
      paper(`W${i}`, `Title ${i}`),
    )
    const seeds: SeedFetchResult[] = [
      seedFetch('seed-a', results),
      seedFetch('seed-b', results), // all duplicates
    ]

    const vocab = extractVocabulary(seeds)

    expect(vocab.totalPapers).toBe(10)
    expect(vocab.sampleTitles).toHaveLength(10)
    // No repeated titles:
    expect(new Set(vocab.sampleTitles).size).toBe(vocab.sampleTitles.length)
  })

  it('keeps counts honest when only one paper exists but three seeds returned it', () => {
    const p = paper('W1', 'Lone Paper')
    const seeds: SeedFetchResult[] = [
      seedFetch('s1', [p]),
      seedFetch('s2', [p]),
      seedFetch('s3', [p]),
    ]

    const vocab = extractVocabulary(seeds)

    expect(vocab.totalPapers).toBe(1)
    expect(vocab.topics).toEqual([['Topic A', 1]])
    expect(vocab.fields).toEqual([['Field A', 1]])
    expect(vocab.keywords).toEqual([['keyword-x', 1]])
    expect(vocab.journals).toEqual([['Journal A', 1]])
  })
})
