// test/showcase.test.ts
import { describe, it, expect } from 'vitest'
import { vi, beforeEach, afterEach } from 'vitest'
import { applyPatches } from '@/lib/ai/showcase'
import * as openalex from '@/lib/openalex/client'
import * as plannerModule from '@/lib/ai/showcase-planner'
import * as rankerModule from '@/lib/ai/showcase-ranker'
import { runShowcase } from '@/lib/ai/showcase'

describe('applyPatches', () => {
  const angles = [
    { id: 1, text: 'atrial fibrillation fundamentals' },
    { id: 2, text: 'catheter ablation outcomes' },
    { id: 3, text: 'cardiac MRI' },
    { id: 4, text: 'anticoagulation' },
    { id: 5, text: 'AI detection' },
    { id: 6, text: 'rhythm control' },
    { id: 7, text: 'genetics' },
    { id: 8, text: 'clinical outcomes' },
  ]

  it('returns angles unchanged when patches is empty', () => {
    expect(applyPatches(angles, [])).toEqual(angles)
  })

  it('removes absorbed angles and rewrites the merge target', () => {
    const patches = [
      {
        absorbedAngleId: 7,
        intoAngleId: 1,
        newText: 'atrial fibrillation fundamentals and genetic risk',
        reason: 'genetics overlap',
      },
    ]
    const result = applyPatches(angles, patches)
    expect(result).toHaveLength(7)
    expect(result.find((a) => a.text.includes('genetic risk'))).toBeDefined()
    expect(result.find((a) => a.text === 'genetics')).toBeUndefined()
  })

  it('re-sequences IDs from 1 after removing an angle', () => {
    const patches = [
      { absorbedAngleId: 3, intoAngleId: 2, newText: 'catheter ablation including imaging', reason: '' },
    ]
    const result = applyPatches(angles, patches)
    expect(result.map((a) => a.id)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it('handles two patches in one call', () => {
    const patches = [
      { absorbedAngleId: 7, intoAngleId: 1, newText: 'AF and genetics', reason: '' },
      { absorbedAngleId: 6, intoAngleId: 2, newText: 'ablation and rhythm control', reason: '' },
    ]
    const result = applyPatches(angles, patches)
    expect(result).toHaveLength(6)
    expect(result.map((a) => a.id)).toEqual([1, 2, 3, 4, 5, 6])
  })
})

const RUN_ANGLES = [
  { id: 1, text: 'atrial fibrillation fundamentals' },
  { id: 2, text: 'catheter ablation outcomes' },
  { id: 3, text: 'cardiac MRI' },
  { id: 4, text: 'anticoagulation' },
  { id: 5, text: 'AI detection' },
  { id: 6, text: 'rhythm control' },
  { id: 7, text: 'genetics' },
  { id: 8, text: 'clinical outcomes' },
]

const PROFILE = 'Clinical cardiologist tracking AF evidence.'

function work(id: string, angle: number, title = `Title ${id}`) {
  return {
    id,
    doi: null,
    title,
    publication_date: '2026-04-10',
    authorships: [{ author: { display_name: 'Smith' } }],
    primary_location: { source: { display_name: 'NEJM' } },
    abstract_inverted_index: null,
    _angle: angle,
  } as never
}

beforeEach(() => {
  process.env.OPENALEX_MAILTO = 'test@example.com'
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('runShowcase', () => {
  it('happy path: returns ok with 3 picks, finalAngles unchanged when no patches', async () => {
    vi.spyOn(plannerModule, 'planShowcaseQueries').mockResolvedValue({
      selectedAngleIds: [1, 2, 3, 5],
      queries: [
        { angle_id: 1, query: 'q1', rationale: 'r' },
        { angle_id: 2, query: 'q2', rationale: 'r' },
        { angle_id: 3, query: 'q3', rationale: 'r' },
        { angle_id: 5, query: 'q5', rationale: 'r' },
      ],
    })
    vi.spyOn(openalex, 'searchByKeyword').mockResolvedValue({
      meta: { count: 20 },
      results: [work('W1', 1), work('W2', 2), work('W3', 3), work('W4', 5), work('W5', 1), work('W6', 2)],
    })
    vi.spyOn(rankerModule, 'rankShowcasePicks').mockResolvedValue({
      headline: "Three papers I'd have sent you",
      picks: [
        { openalexId: 'W1', angleId: 1, chipLabel: 'Fundamentals', whyForYou: 'Matches your clinical depth interest perfectly.' },
        { openalexId: 'W2', angleId: 2, chipLabel: 'Ablation', whyForYou: 'Practice-changing RCT in ablation outcomes area.' },
        { openalexId: 'W3', angleId: 3, chipLabel: 'Imaging', whyForYou: 'Imaging sub-study bridging two of your interests.' },
      ],
      patches: [],
    })

    const result = await runShowcase(
      { subject: 'atrial fibrillation', profile: PROFILE, angles: RUN_ANGLES },
      { sessionId: 'test' },
    )

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.picks).toHaveLength(3)
      expect(result.finalAngles).toHaveLength(8)
      expect(result.stats.anglesProbed).toBe(4)
      expect(result.stats.papersScanned).toBeGreaterThan(0)
      expect(result.picks[0].title).toBe('Title W1')  // joined from pool
    }
  })

  it('widens to 60 days when 14-day pool is too thin', async () => {
    vi.spyOn(plannerModule, 'planShowcaseQueries').mockResolvedValue({
      selectedAngleIds: [1, 2, 3, 5],
      queries: [
        { angle_id: 1, query: 'q1', rationale: 'r' },
        { angle_id: 2, query: 'q2', rationale: 'r' },
        { angle_id: 3, query: 'q3', rationale: 'r' },
        { angle_id: 5, query: 'q5', rationale: 'r' },
      ],
    })

    const searchSpy = vi.spyOn(openalex, 'searchByKeyword')
    // First wave (14d) returns tiny pool
    searchSpy.mockResolvedValueOnce({ meta: { count: 1 }, results: [work('W1', 1)] })
    searchSpy.mockResolvedValueOnce({ meta: { count: 1 }, results: [work('W2', 2)] })
    searchSpy.mockResolvedValueOnce({ meta: { count: 0 }, results: [] })
    searchSpy.mockResolvedValueOnce({ meta: { count: 0 }, results: [] })
    // Second wave (60d) returns a richer pool
    searchSpy.mockResolvedValue({
      meta: { count: 12 },
      results: [work('W3', 1), work('W4', 2), work('W5', 3), work('W6', 5), work('W7', 1), work('W8', 2)],
    })

    vi.spyOn(rankerModule, 'rankShowcasePicks').mockResolvedValue({
      headline: 'Recent highlights',
      picks: [
        { openalexId: 'W3', angleId: 1, chipLabel: 'Fundamentals', whyForYou: 'Fundamental paper that still holds up for your profile.' },
      ],
      patches: [],
    })

    const result = await runShowcase(
      { subject: 'atrial fibrillation', profile: PROFILE, angles: RUN_ANGLES },
      { sessionId: 'test' },
    )

    expect(result.ok).toBe(true)
    // Widen fired: 4 calls for 14d + 4 calls for 60d = 8 total
    expect(searchSpy.mock.calls.length).toBeGreaterThanOrEqual(5)
  })

  it('returns ok:false no-candidates when pool is still empty after widening', async () => {
    vi.spyOn(plannerModule, 'planShowcaseQueries').mockResolvedValue({
      selectedAngleIds: [1, 2, 3, 5],
      queries: [
        { angle_id: 1, query: 'q1', rationale: 'r' },
        { angle_id: 2, query: 'q2', rationale: 'r' },
        { angle_id: 3, query: 'q3', rationale: 'r' },
        { angle_id: 5, query: 'q5', rationale: 'r' },
      ],
    })
    vi.spyOn(openalex, 'searchByKeyword').mockResolvedValue({ meta: { count: 0 }, results: [] })
    const rankerSpy = vi.spyOn(rankerModule, 'rankShowcasePicks')

    const result = await runShowcase(
      { subject: 'x', profile: PROFILE, angles: RUN_ANGLES },
      { sessionId: 'test' },
    )

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('no-candidates')
    expect(rankerSpy).not.toHaveBeenCalled()  // never reached the ranker
  })

  it('applies patches and re-sequences finalAngles', async () => {
    vi.spyOn(plannerModule, 'planShowcaseQueries').mockResolvedValue({
      selectedAngleIds: [1, 2, 3, 7],
      queries: [
        { angle_id: 1, query: 'q1', rationale: 'r' },
        { angle_id: 2, query: 'q2', rationale: 'r' },
        { angle_id: 3, query: 'q3', rationale: 'r' },
        { angle_id: 7, query: 'q7', rationale: 'r' },
      ],
    })
    vi.spyOn(openalex, 'searchByKeyword').mockResolvedValue({
      meta: { count: 15 },
      results: [work('W1', 1), work('W2', 2), work('W3', 3), work('W4', 1), work('W5', 2), work('W6', 3)],
    })
    vi.spyOn(rankerModule, 'rankShowcasePicks').mockResolvedValue({
      headline: 'Three papers',
      picks: [
        { openalexId: 'W1', angleId: 1, chipLabel: 'Fundamentals', whyForYou: 'Bridges your interest in ablation and imaging.' },
        { openalexId: 'W2', angleId: 2, chipLabel: 'Ablation', whyForYou: 'Bridges your interest in ablation and imaging.' },
        { openalexId: 'W3', angleId: 3, chipLabel: 'Imaging', whyForYou: 'Bridges your interest in ablation and imaging.' },
      ],
      patches: [
        {
          absorbedAngleId: 7,
          intoAngleId: 1,
          newText: 'atrial fibrillation fundamentals including genetic risk',
          reason: 'genetics overlaps',
        },
      ],
    })

    const result = await runShowcase(
      { subject: 'AF', profile: PROFILE, angles: RUN_ANGLES },
      { sessionId: 'test' },
    )

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.finalAngles).toHaveLength(7)
      expect(result.finalAngles.map((a) => a.id)).toEqual([1, 2, 3, 4, 5, 6, 7])
      expect(result.finalAngles[0].text).toContain('genetic risk')
      expect(result.finalAngles.find((a) => a.text === 'genetics')).toBeUndefined()
    }
  })

  it('returns ok:false ranker-failed when the ranker throws', async () => {
    vi.spyOn(plannerModule, 'planShowcaseQueries').mockResolvedValue({
      selectedAngleIds: [1, 2, 3, 5],
      queries: [
        { angle_id: 1, query: 'q1', rationale: 'r' },
        { angle_id: 2, query: 'q2', rationale: 'r' },
        { angle_id: 3, query: 'q3', rationale: 'r' },
        { angle_id: 5, query: 'q5', rationale: 'r' },
      ],
    })
    vi.spyOn(openalex, 'searchByKeyword').mockResolvedValue({
      meta: { count: 15 },
      results: [work('W1', 1), work('W2', 2), work('W3', 3), work('W4', 5), work('W5', 1), work('W6', 2)],
    })
    vi.spyOn(rankerModule, 'rankShowcasePicks').mockRejectedValue(new Error('parse error'))

    const result = await runShowcase(
      { subject: 'AF', profile: PROFILE, angles: RUN_ANGLES },
      { sessionId: 'test' },
    )

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('ranker-failed')
  })

  it('returns ok:false openalex-failed when fetch throws', async () => {
    vi.spyOn(plannerModule, 'planShowcaseQueries').mockResolvedValue({
      selectedAngleIds: [1, 2, 3, 5],
      queries: [
        { angle_id: 1, query: 'q1', rationale: 'r' },
        { angle_id: 2, query: 'q2', rationale: 'r' },
        { angle_id: 3, query: 'q3', rationale: 'r' },
        { angle_id: 5, query: 'q5', rationale: 'r' },
      ],
    })
    vi.spyOn(openalex, 'searchByKeyword').mockRejectedValue(new Error('openalex 503'))

    const result = await runShowcase(
      { subject: 'AF', profile: PROFILE, angles: RUN_ANGLES },
      { sessionId: 'test' },
    )

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('openalex-failed')
  })
})
