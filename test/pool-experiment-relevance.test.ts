// test/pool-experiment-relevance.test.ts
//
// Precision check for the NEW-prompt queries. Recall is only half the story —
// does "unified protocol" / "third wave" / "process based" actually return
// CBT/schema-therapy papers, or is the pool padded with unrelated fields?
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

import { searchByKeyword } from '@/lib/openalex/client'
import type { OpenAlexWork } from '@/lib/openalex/client'

const QUERIES_TO_CHECK = [
  'unified protocol',
  'third wave',
  'process based',
  'schema modes',
  'schema therapy',
  'digital CBT',
  'imagery rescripting',
  'insomnia CBT',
  'acceptance commitment CBT',
]

// Conservative relevance classifier: does the paper's title/abstract/topic
// land in the CBT / psychotherapy / anxiety-depression neighborhood?
const RELEVANT_TOKENS = [
  'cbt', 'therapy', 'psychotherap', 'cogniti', 'behavio', 'depress', 'anxiet',
  'mental health', 'ptsd', 'trauma', 'schema', 'mindful', 'acceptance',
  'commitment', 'imagery', 'insomn', 'sleep', 'emotion', 'regul', 'rumin',
  'mood', 'psycholog', 'psychiatr', 'counsel', 'worry', 'panic',
]
const IRRELEVANT_FIELDS = new Set([
  'Computer Science', 'Engineering', 'Physics and Astronomy',
  'Earth and Planetary Sciences', 'Chemistry', 'Mathematics',
  'Materials Science', 'Economics, Econometrics and Finance',
  'Business, Management and Accounting', 'Environmental Science',
  'Chemical Engineering', 'Energy',
])
const RELEVANT_FIELDS = new Set(['Psychology', 'Medicine', 'Neuroscience'])

function reconstructAbstract(invIdx?: Record<string, number[]> | null): string {
  if (!invIdx) return ''
  const entries: Array<[number, string]> = []
  for (const [word, positions] of Object.entries(invIdx)) {
    for (const pos of positions) entries.push([pos, word])
  }
  entries.sort((a, b) => a[0] - b[0])
  return entries.map(([, w]) => w).join(' ')
}

function classify(w: OpenAlexWork): 'relevant' | 'maybe' | 'off-topic' {
  const field = w.primary_topic?.field?.display_name ?? ''
  if (IRRELEVANT_FIELDS.has(field)) return 'off-topic'
  const hay = (
    (w.title ?? '') +
    ' ' +
    reconstructAbstract(w.abstract_inverted_index ?? null)
  ).toLowerCase()
  const hasRelTok = RELEVANT_TOKENS.some((t) => hay.includes(t))
  if (RELEVANT_FIELDS.has(field) && hasRelTok) return 'relevant'
  if (RELEVANT_FIELDS.has(field)) return 'maybe'
  if (hasRelTok) return 'maybe'
  return 'off-topic'
}

const RUN = process.env.RUN_POOL_EXPERIMENT === '1'
const maybe = RUN ? describe : describe.skip

maybe('relevance: what do the short NEW-prompt queries actually retrieve?', () => {
  it(
    'prints titles + crude relevance per query (7d window)',
    async () => {
      const toDate = new Date().toISOString().slice(0, 10)
      const fromDate = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10)

      console.log('\n================ RELEVANCE AUDIT ================')
      console.log(`window: ${fromDate} → ${toDate}`)

      const totals = { relevant: 0, maybe: 0, off: 0 }

      for (const q of QUERIES_TO_CHECK) {
        const res = await searchByKeyword({
          query: q,
          fromDate,
          toDate,
          perPage: 15,
          filterMode: 'title_and_abstract.search',
          selectFields: [
            'id',
            'title',
            'publication_date',
            'primary_topic',
            'abstract_inverted_index',
            'primary_location',
          ],
        })
        const counts = { relevant: 0, maybe: 0, off: 0 }
        const rows: string[] = []
        for (const p of res.results) {
          const c = classify(p)
          if (c === 'relevant') counts.relevant++
          else if (c === 'maybe') counts.maybe++
          else counts.off++
          const field = p.primary_topic?.field?.display_name ?? '—'
          const topic = p.primary_topic?.display_name ?? '—'
          rows.push(
            `    [${c.padEnd(9)}] field="${field}" topic="${topic}"\n      "${(p.title ?? '').slice(0, 140)}"`,
          )
        }
        totals.relevant += counts.relevant
        totals.maybe += counts.maybe
        totals.off += counts.off
        console.log(
          `\n--- "${q}" — total=${res.meta.count} returned=${res.results.length} — rel=${counts.relevant} maybe=${counts.maybe} off=${counts.off}`,
        )
        for (const r of rows) console.log(r)
      }

      console.log('\n================ TOTALS ================')
      console.log(`  relevant:  ${totals.relevant}`)
      console.log(`  maybe:     ${totals.maybe}`)
      console.log(`  off-topic: ${totals.off}`)
      console.log('==========================================\n')
    },
    180_000,
  )
})
