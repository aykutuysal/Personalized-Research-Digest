// src/lib/ai/discovery/extract-vocab.ts
import type { SeedFetchResult } from './fetch-seeds'

const GENERIC_KEYWORDS = new Set(['study', 'research', 'analysis', 'method', 'result'])

function isValidKeyword(name: string): boolean {
  if (!name || name.length < 3) return false
  if (name.includes('(') || name.includes(')')) return false
  if (GENERIC_KEYWORDS.has(name.toLowerCase())) return false
  return true
}

function topN<K>(counter: Map<K, number>, n: number): Array<[K, number]> {
  return [...counter.entries()].sort((a, b) => b[1] - a[1]).slice(0, n)
}

export interface Vocabulary {
  totalPapers: number
  topics: Array<[string, number]>
  subfields: Array<[string, number]>
  fields: Array<[string, number]>
  keywords: Array<[string, number]>
  journals: Array<[string, number]>
  sampleTitles: string[]
}

/**
 * Mine the returned papers' metadata to discover real vocabulary that
 * indexes papers in the user's area.
 */
export function extractVocabulary(seedResults: SeedFetchResult[]): Vocabulary {
  const topics = new Map<string, number>()
  const subfields = new Map<string, number>()
  const fields = new Map<string, number>()
  const keywords = new Map<string, number>()
  const journals = new Map<string, number>()
  const sampleTitles: string[] = []
  let totalPapers = 0

  for (const sr of seedResults) {
    for (const paper of sr.results) {
      totalPapers++
      if (paper.title && sampleTitles.length < 15) sampleTitles.push(paper.title)
      const topic = paper.primary_topic ?? null
      if (topic?.display_name) topics.set(topic.display_name, (topics.get(topic.display_name) ?? 0) + 1)
      const sub = topic?.subfield?.display_name
      if (sub) subfields.set(sub, (subfields.get(sub) ?? 0) + 1)
      const fld = topic?.field?.display_name
      if (fld) fields.set(fld, (fields.get(fld) ?? 0) + 1)
      for (const kw of paper.keywords ?? []) {
        const name = kw.display_name ?? ''
        if (isValidKeyword(name)) keywords.set(name, (keywords.get(name) ?? 0) + 1)
      }
      const src = paper.primary_location?.source?.display_name
      if (src) journals.set(src, (journals.get(src) ?? 0) + 1)
    }
  }

  return {
    totalPapers,
    topics: topN(topics, 15),
    subfields: topN(subfields, 10),
    fields: topN(fields, 5),
    keywords: topN(keywords, 25),
    journals: topN(journals, 10),
    sampleTitles,
  }
}

/** Reconstruct abstract text from OpenAlex's inverted-index format. */
export function reconstructAbstract(invIdx?: Record<string, number[]> | null): string {
  if (!invIdx) return ''
  const entries: Array<[number, string]> = []
  for (const [word, positions] of Object.entries(invIdx)) {
    for (const pos of positions) entries.push([pos, word])
  }
  entries.sort((a, b) => a[0] - b[0])
  return entries.map(([, w]) => w).join(' ')
}
