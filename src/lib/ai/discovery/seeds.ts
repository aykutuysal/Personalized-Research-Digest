// src/lib/ai/discovery/seeds.ts
import 'server-only'
import { generateObject } from 'ai'
import { z } from 'zod'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { deepseek } from '@/lib/ai/openrouter'
import type { DigestConfig, ResearchArea } from '@/lib/config-schema'

// Connective / stopword tokens we never lead a seed with.
const ANGLE_SEED_STOPWORDS = new Set([
  'and', 'or', 'vs', 'versus', 'the', 'a', 'an', 'for', 'of', 'with', 'to',
  'on', 'in', 'by', 'as', 'at',
])

/**
 * Derive compact seed phrases from each research area's text. Strips
 * parenthesized clarifications, drops leading stopwords/connectives,
 * collapses adjacent duplicates, takes the first N content tokens.
 * Returns one seed per area, in input order. Empty strings are filtered.
 */
export function researchAreasToSeeds(areas: ResearchArea[], maxWords = 2): string[] {
  const out: string[] = []
  for (const area of areas) {
    const cleaned = area.text.replace(/\([^)]*\)/g, ' ')
    const tokens = cleaned.match(/[A-Za-z0-9][A-Za-z0-9\-/]*/g) ?? []
    const filtered = tokens.filter((t) => !ANGLE_SEED_STOPWORDS.has(t.toLowerCase()))
    const deduped: string[] = []
    for (const w of filtered) {
      if (deduped.length === 0 || deduped[deduped.length - 1].toLowerCase() !== w.toLowerCase()) {
        deduped.push(w)
      }
    }
    if (deduped.length >= 1) {
      out.push(deduped.slice(0, maxWords).join(' '))
    }
  }
  return out.filter((s) => s.length > 0)
}

let cachedSystem: string | null = null
function getSeedSystemPrompt(): string {
  if (cachedSystem) return cachedSystem
  cachedSystem = readFileSync(resolve(process.cwd(), 'prompts/preview-seed-system.md'), 'utf8')
  return cachedSystem
}

// Anthropic-schema-strip: use plain z.array(z.string()) — no .min()/.max()/.length().
// See src/lib/ai/propose-research-areas.ts for the full rationale.
const seedOutputSchema = z.object({
  seeds: z.array(z.string()),
})

export async function generateSeeds(
  config: Pick<DigestConfig, 'subject' | 'profile' | 'research_areas'>,
  opts: { sessionId?: string | null } = {},
): Promise<{ seeds: string[]; cost?: number; totalTokens?: number }> {
  const tag = `[preview-seeds ${opts.sessionId?.slice(0, 8) ?? 'no-session'}]`
  const started = Date.now()

  const userPrompt = [
    `USER PROFILE:\n${config.profile}`,
    '',
    `SUBJECT (one phrase summarising what they care about):\n${config.subject}`,
    '',
    `RESEARCH AREAS THEY WANT COVERED:`,
    ...config.research_areas.map((a) => `  - ${a.text}`),
    '',
    `Generate 3-5 seed queries.`,
  ].join('\n')

  const { object, usage, providerMetadata } = await generateObject({
    model: deepseek({ sessionId: opts.sessionId ?? null }),
    schema: seedOutputSchema,
    system: getSeedSystemPrompt(),
    prompt: userPrompt,
    temperature: 0.3,
  })

  const cost = (providerMetadata?.openrouter as { usage?: { cost?: number } } | undefined)?.usage?.cost
  const seeds = object.seeds.map((s) => s.trim()).filter((s) => s.length > 0)

  console.log(
    `${tag} done seeds=${seeds.length} tokens=${usage.totalTokens ?? '?'} cost=${cost != null ? `$${cost.toFixed(6)}` : '—'} ms=${Date.now() - started}`,
  )
  return { seeds, cost, totalTokens: usage.totalTokens }
}

/**
 * Combine LLM seeds with angle-derived seeds. LLM seeds first (they add
 * cross-angle framings); angle-derived added if not already present
 * (case-insensitive). This is the v9.2 core fix — forces the vocabulary
 * miner to read papers that name the user's drugs/procedures/frameworks.
 */
export function combineSeeds(llmSeeds: string[], angleSeeds: string[]): string[] {
  const seen = new Set(llmSeeds.map((s) => s.toLowerCase()))
  const out = [...llmSeeds]
  for (const s of angleSeeds) {
    if (!seen.has(s.toLowerCase())) {
      out.push(s)
      seen.add(s.toLowerCase())
    }
  }
  return out
}
