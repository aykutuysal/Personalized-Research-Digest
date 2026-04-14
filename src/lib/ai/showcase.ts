// src/lib/ai/showcase.ts
import 'server-only'

// ---------- Thresholds ----------
export const SHOWCASE_PROBED_ANGLES = 4
export const SHOWCASE_PER_QUERY_PAGE_SIZE = 15
export const SHOWCASE_PRIMARY_WINDOW_DAYS = 14
export const SHOWCASE_WIDENED_WINDOW_DAYS = 60
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
  year: number
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
