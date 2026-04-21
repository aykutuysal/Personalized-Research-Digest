// src/lib/ai/preview/map-progress-to-stage.ts
import type { ProgressEvent } from './progress-events'

export const STAGE_LABELS = [
  'Mapping your interests',
  'Looking across the whole field',
  'Finding what fits you',
  'Reading the shortlist',
  'Writing it in your voice',
] as const

export interface ProgressState {
  running: number // index of the stage currently running
  done: number    // count of stages completed
  papersScanned: number
  areasDone: number
}

export function mapProgressToStage(
  events: ProgressEvent[],
  totalAreas: number,
): ProgressState {
  let running = 0
  let done = 0
  let papersScanned = 0
  let areasDone = 0

  for (const e of events) {
    switch (e.kind) {
      case 'seeds':
        if (done < 1) { done = 1; running = 1 }
        break
      case 'seed-fetch-done':
        papersScanned += e.papersScanned
        break
      case 'area-hit':
        papersScanned += e.hits
        areasDone += 1
        if (totalAreas > 0 && areasDone >= totalAreas) {
          if (done < 2) { done = 2 }
          if (running < 2) { running = 2 }
        }
        break
      case 'filtering':
        if (running < 2) { running = 2 }
        break
      case 'filter-done':
        if (done < 3) { done = 3 }
        if (running < 3) { running = 3 }
        break
      case 'curating':
        if (done < 4) { done = 4 }
        if (running < 4) { running = 4 }
        break
      case 'done':
        done = 5
        running = 5
        break
      case 'error':
        // leave current state; caller handles surfacing the error
        break
    }
  }
  return { running, done, papersScanned, areasDone }
}
