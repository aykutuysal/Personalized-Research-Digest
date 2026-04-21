// test/map-progress-to-stage.test.ts
import { describe, it, expect } from 'vitest'
import { mapProgressToStage, STAGE_LABELS } from '@/lib/ai/preview/map-progress-to-stage'
import type { ProgressEvent } from '@/lib/ai/preview/progress-events'

describe('mapProgressToStage', () => {
  it('starts with stage 0 running, 0 done', () => {
    const s = mapProgressToStage([], 10)
    expect(s).toEqual({ running: 0, done: 0, papersScanned: 0, areasDone: 0 })
  })

  it('marks stage 0 done and stage 1 running after seeds', () => {
    const events: ProgressEvent[] = [{ kind: 'seeds', seeds: ['a', 'b'] }]
    const s = mapProgressToStage(events, 10)
    expect(s.done).toBe(1)
    expect(s.running).toBe(1)
  })

  it('counts papers scanned from seed-fetch-done and area-hit', () => {
    const events: ProgressEvent[] = [
      { kind: 'seeds', seeds: [] },
      { kind: 'seed-fetch-done', papersScanned: 40, perSeed: [] },
      { kind: 'area-hit', research_area_id: 1, hits: 12, sampleTitle: null },
      { kind: 'area-hit', research_area_id: 2, hits: 8, sampleTitle: null },
    ]
    const s = mapProgressToStage(events, 10)
    expect(s.papersScanned).toBe(60) // 40 + 12 + 8
    expect(s.areasDone).toBe(2)
  })

  it('advances to filtering after all areas are hit', () => {
    const events: ProgressEvent[] = [
      { kind: 'seeds', seeds: [] },
      { kind: 'area-hit', research_area_id: 1, hits: 5, sampleTitle: null },
      { kind: 'area-hit', research_area_id: 2, hits: 5, sampleTitle: null },
    ]
    const s = mapProgressToStage(events, 2) // 2 total areas
    expect(s.done).toBe(2) // stages: mapping, looking
    expect(s.running).toBe(2) // finding
  })

  it('advances to reading the shortlist after filter-done', () => {
    const events: ProgressEvent[] = [
      { kind: 'seeds', seeds: [] },
      { kind: 'filter-done', kept: 10, dropped: 20 },
    ]
    const s = mapProgressToStage(events, 10)
    expect(s.done).toBeGreaterThanOrEqual(3)
    expect(s.running).toBe(3)
  })

  it('advances to writing after curating', () => {
    const events: ProgressEvent[] = [
      { kind: 'seeds', seeds: [] },
      { kind: 'filter-done', kept: 10, dropped: 20 },
      { kind: 'curating' },
    ]
    const s = mapProgressToStage(events, 10)
    expect(s.running).toBe(4)
    expect(s.done).toBe(4)
  })

  it('marks everything done on done event', () => {
    const events: ProgressEvent[] = [
      { kind: 'seeds', seeds: [] },
      { kind: 'done', body: '', references: [], queries: [] },
    ]
    const s = mapProgressToStage(events, 10)
    expect(s.done).toBe(5)
  })

  it('exposes five stage labels in benefit-framed order', () => {
    expect(STAGE_LABELS).toEqual([
      'Mapping your interests',
      'Looking across the whole field',
      'Finding what fits you',
      'Reading the shortlist',
      'Writing it in your voice',
    ])
  })
})
