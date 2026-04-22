// src/lib/ai/discovery/umbrella.ts
//
// Subject-derived umbrella queries. When the reader's subject names one or
// more search-grade academic frameworks or named techniques ("CBT and schema
// therapy", "LLM agents and tool-use in production systems"), the decomposed
// research-area queries can miss the canonical umbrella term itself — papers
// titled with the bare term never reach the pool. This module emits one extra
// library query per umbrella term, deterministically parsed from the subject.
//
// Runs alongside the per-area library queries in the preview pipeline.
// Umbrella queries carry `research_area_id: 0` (the sentinel for
// not-tied-to-an-area) so downstream code can distinguish them.
//
// See experiments/2026-04-21-umbrella-queries.md for the validation data.

import type { SearchQuery } from '@/lib/config-schema'

// Tokens we'd never lead or keep a standalone umbrella with.
const UMBRELLA_STOPWORDS = new Set([
  'and', 'or', 'the', 'a', 'an', 'for', 'of', 'with', 'to', 'on', 'in', 'by', 'as', 'at',
])

/**
 * Parse the subject into umbrella terms. Split on " and "/comma/semicolon,
 * strip trailing scope clauses (" in X", " for X", " of X", " with X", " at X"),
 * drop stopwords, keep fragments with 1–4 content words. Deduped, case-
 * insensitively, in input order.
 *
 * Intentionally dumb — no LLM call, no rewriting. The downstream relevance
 * filter handles precision. If the term is too broad to be a useful search
 * key, the filter drops its hits.
 */
export function extractUmbrellaTerms(subject: string): string[] {
  const parts = subject.split(/\s*(?:,|;|\band\b)\s*/i).map((p) => p.trim()).filter(Boolean)
  const out: string[] = []
  for (let p of parts) {
    p = p.replace(/\s+(in|for|of|with|at)\s+.+$/i, '').trim()
    const words = p.split(/\s+/).filter((w) => !UMBRELLA_STOPWORDS.has(w.toLowerCase()))
    if (words.length >= 1 && words.length <= 4) {
      out.push(words.join(' '))
    }
  }
  const seen = new Set<string>()
  return out.filter((t) => {
    const k = t.toLowerCase()
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

/**
 * Build umbrella queries for the subject, ready to append to the library.
 * All carry `research_area_id: 0` and `source: 'preview'`.
 * Returns empty array when the subject yields no extractable umbrella terms.
 */
export function buildUmbrellaQueries(subject: string): SearchQuery[] {
  const terms = extractUmbrellaTerms(subject)
  return terms.map((term) => ({
    query: term,
    research_area_id: 0,
    source: 'preview',
    rationale: `Umbrella query for the reader's subject ("${subject}"). Catches canonical framework papers that decomposed area queries miss.`,
  }))
}
