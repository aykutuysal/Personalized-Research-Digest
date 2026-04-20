// src/lib/ai/showcase.ts
import 'server-only'

// ---------- Thresholds ----------
export const SHOWCASE_PROBED_ANGLES = 4
export const SHOWCASE_PER_QUERY_PAGE_SIZE = 15
export const SHOWCASE_PRIMARY_WINDOW_DAYS = 7
export const SHOWCASE_WIDENED_WINDOW_DAYS = 30
export const SHOWCASE_POOL_MIN_FOR_RANKER = 6
export const SHOWCASE_QUIET_ANGLE_HIT_CEILING = 2
export const SHOWCASE_MAX_PATCHES = 2
export const SHOWCASE_PARALLEL_LIMIT = 4
export const SHOWCASE_LLM_RETRIES = 2
export const SHOWCASE_TOTAL_TIMEOUT_MS = 15_000

// ---------- Types (shared across planner, ranker, orchestrator) ----------
export interface ShowcaseAngleInput {
  id: number
  text: string
}

export interface ShowcasePatch {
  absorbedAngleId: number
  intoAngleId: number
  newText: string
  reason: string
}

export interface ShowcasePick {
  openalexId: string
  angleId: number
  chipLabel: string
  title: string
  authors: string
  date: string
  venue: string
  url: string
  whyForYou: string
}

export type ShowcaseResult =
  | {
      ok: true
      headline: string
      picks: ShowcasePick[]
      finalAngles: ShowcaseAngleInput[]
      stats: { papersScanned: number; anglesProbed: number }
      candidatePreview?: string[] // fallback path for scan-theatre title tease
    }
  | {
      ok: false
      reason: 'no-candidates' | 'ranker-failed' | 'openalex-failed' | 'timeout'
    }

import { searchByKeyword, type OpenAlexWork } from '@/lib/openalex/client'
import { reconstructAbstract } from '@/lib/openalex/abstract'
import { planShowcaseQueries } from '@/lib/ai/showcase-planner'
import { rankShowcasePicks, type RankerCandidate } from '@/lib/ai/showcase-ranker'

// ---------- Pure helpers ----------

/**
 * Apply ranker-proposed merges to the user's angle list.
 * Removes absorbed angles, rewrites merge targets, re-sequences IDs from 1.
 */
export function applyPatches(
  angles: ShowcaseAngleInput[],
  patches: ShowcasePatch[],
): ShowcaseAngleInput[] {
  if (patches.length === 0) return angles.map((a) => ({ ...a }))
  const absorbed = new Set(patches.map((p) => p.absorbedAngleId))
  return angles
    .filter((a) => !absorbed.has(a.id))
    .map((a) => {
      const patch = patches.find((p) => p.intoAngleId === a.id)
      return patch ? { ...a, text: patch.newText } : { ...a }
    })
    .map((a, i) => ({ ...a, id: i + 1 }))
}

// ---------- Runtime helpers ----------

function daysAgoISO(days: number): string {
  const d = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  return d.toISOString().slice(0, 10)
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

async function withLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let cursor = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const i = cursor++
      out[i] = await fn(items[i], i)
    }
  })
  await Promise.all(workers)
  return out
}

function extractAuthors(work: OpenAlexWork): string {
  const authorships = (work as { authorships?: Array<{ author?: { display_name?: string } }> }).authorships
  if (!authorships || authorships.length === 0) return 'Unknown'
  const names = authorships
    .map((a) => a.author?.display_name)
    .filter((n): n is string => typeof n === 'string' && n.length > 0)
  if (names.length === 0) return 'Unknown'
  if (names.length === 1) return names[0]
  if (names.length === 2) return names.join(' & ')
  return `${names[0]} et al.`
}

function extractVenue(work: OpenAlexWork): string {
  const primary = (work as { primary_location?: { source?: { display_name?: string } } }).primary_location
  if (primary?.source?.display_name) return primary.source.display_name
  const locations = (work as { locations?: Array<{ source?: { display_name?: string } } | null> }).locations
  if (locations) {
    for (const loc of locations) {
      const name = loc?.source?.display_name
      if (name) return name
    }
  }
  return ''
}

function extractYear(work: OpenAlexWork): number {
  const date = work.publication_date
  if (typeof date === 'string' && /^\d{4}/.test(date)) return parseInt(date.slice(0, 4), 10)
  return new Date().getFullYear()
}

function extractUrl(work: OpenAlexWork): string {
  if (typeof work.doi === 'string' && work.doi.length > 0) {
    return work.doi.startsWith('http') ? work.doi : `https://doi.org/${work.doi}`
  }
  return work.id
}

interface Probe {
  angleId: number
  query: string
  works: OpenAlexWork[]
  count: number
}

async function fetchProbeWave(
  queries: Array<{ angle_id: number; query: string }>,
  windowDays: number,
): Promise<Probe[]> {
  const fromDate = daysAgoISO(windowDays)
  const toDate = todayISO()
  return withLimit(queries, SHOWCASE_PARALLEL_LIMIT, async (q) => {
    const res = await searchByKeyword({
      query: q.query,
      fromDate,
      toDate,
      perPage: SHOWCASE_PER_QUERY_PAGE_SIZE,
      page: 1,
    })
    return {
      angleId: q.angle_id,
      query: q.query,
      works: res.results,
      count: res.meta?.count ?? 0,
    }
  })
}

function dedupePool(probes: Probe[]): RankerCandidate[] {
  const seen = new Set<string>()
  const out: RankerCandidate[] = []
  for (const p of probes) {
    for (const w of p.works) {
      if (typeof w.id !== 'string' || seen.has(w.id)) continue
      seen.add(w.id)
      const title = typeof w.title === 'string' ? w.title : '(untitled)'
      const abstract = reconstructAbstract(
        (w as { abstract_inverted_index?: Record<string, number[]> | null }).abstract_inverted_index ?? null,
      ) ?? ''
      out.push({
        openalexId: w.id,
        angleId: p.angleId,
        title,
        authors: extractAuthors(w),
        year: extractYear(w),
        venue: extractVenue(w),
        date: typeof w.publication_date === 'string' ? w.publication_date : todayISO(),
        url: extractUrl(w),
        abstract,
      })
    }
  }
  return out
}

function sortByDateDesc(pool: RankerCandidate[]): RankerCandidate[] {
  return [...pool].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
}

function computeHitCounts(probes: Probe[]): Record<number, number> {
  const counts: Record<number, number> = {}
  for (const p of probes) counts[p.angleId] = p.count
  return counts
}

// ---------- Orchestrator ----------

export interface RunShowcaseInput {
  subject: string
  profile: string
  angles: ShowcaseAngleInput[]
}

export async function runShowcase(
  input: RunShowcaseInput,
  opts: { sessionId?: string | null } = {},
): Promise<ShowcaseResult> {
  const tag = `[showcase ${opts.sessionId?.slice(0, 8) ?? 'no-session'}]`
  const startedAt = Date.now()
  console.log(
    `${tag} start subject="${input.subject}" angles=${input.angles.length} profile_chars=${input.profile.length}`,
  )

  // 1. Plan
  let plan
  try {
    plan = await planShowcaseQueries(input, { sessionId: opts.sessionId })
  } catch (err) {
    console.error(`${tag} planner failed`, err)
    return { ok: false, reason: 'ranker-failed' }  // planner dying early is rare; surfaced as ranker-failed for symmetry
  }

  // 2. Fetch (7-day window)
  let probes: Probe[]
  try {
    probes = await fetchProbeWave(plan.queries, SHOWCASE_PRIMARY_WINDOW_DAYS)
  } catch (err) {
    console.error(`${tag} openalex fetch failed`, err)
    return { ok: false, reason: 'openalex-failed' }
  }

  let pool = sortByDateDesc(dedupePool(probes))
  for (const p of probes) {
    console.log(`${tag} probe angle=${p.angleId} hits=${p.count}`)
  }

  // 3. Widen if too thin
  if (pool.length < SHOWCASE_POOL_MIN_FOR_RANKER) {
    console.log(`${tag} widening pool=${pool.length} → ${SHOWCASE_WIDENED_WINDOW_DAYS}d`)
    try {
      probes = await fetchProbeWave(plan.queries, SHOWCASE_WIDENED_WINDOW_DAYS)
    } catch (err) {
      console.error(`${tag} openalex widen failed`, err)
      return { ok: false, reason: 'openalex-failed' }
    }
    pool = sortByDateDesc(dedupePool(probes))
  }

  // 4. Silent skip if still empty
  if (pool.length === 0) {
    console.log(`${tag} done ok=false reason=no-candidates ms=${Date.now() - startedAt}`)
    return { ok: false, reason: 'no-candidates' }
  }

  // 5. Rank — cap pool so the ranker prompt stays small enough to return in <60s
  const rankerPool = pool.slice(0, 24)
  let ranked
  try {
    ranked = await rankShowcasePicks(
      {
        profile: input.profile,
        angles: input.angles,
        selectedAngleIds: plan.selectedAngleIds,
        hitCounts: computeHitCounts(probes),
        pool: rankerPool,
      },
      { sessionId: opts.sessionId },
    )
  } catch (err) {
    console.error(`${tag} ranker failed`, err)
    return { ok: false, reason: 'ranker-failed' }
  }

  // 6. Apply patches (logged for observability, stripped from public return)
  if (ranked.patches.length > 0) {
    console.log(`${tag} patches=${JSON.stringify(ranked.patches)}`)
  }
  const finalAngles = applyPatches(input.angles, ranked.patches)

  // 7. Assemble picks from pool metadata (hallucination containment)
  const poolById = new Map(pool.map((c) => [c.openalexId, c]))
  const picks: ShowcasePick[] = ranked.picks
    .map((p) => {
      const cand = poolById.get(p.openalexId)
      if (!cand) return null
      return {
        openalexId: cand.openalexId,
        angleId: p.angleId,
        chipLabel: p.chipLabel,
        title: cand.title,
        authors: cand.authors,
        date: cand.date,
        venue: cand.venue,
        url: cand.url,
        whyForYou: p.whyForYou,
      }
    })
    .filter((p): p is ShowcasePick => p !== null)

  if (picks.length === 0) {
    console.log(`${tag} done ok=false reason=ranker-failed (no picks matched pool IDs)`)
    return { ok: false, reason: 'ranker-failed' }
  }

  // 8. Fallback candidatePreview for scan theatre (first 6 titles from pool)
  const candidatePreview = pool.slice(0, 6).map((c) => c.title)

  console.log(
    `${tag} done ok=true picks=${picks.length} patches=${ranked.patches.length} total_ms=${Date.now() - startedAt}`,
  )

  return {
    ok: true,
    headline: ranked.headline,
    picks,
    finalAngles,
    stats: {
      papersScanned: pool.length,
      anglesProbed: plan.selectedAngleIds.length,
    },
    candidatePreview,
  }
}
