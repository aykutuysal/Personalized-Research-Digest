// test/showcase-ranker.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import * as ai from 'ai'
import { rankShowcasePicks, type RankerCandidate } from '@/lib/ai/showcase-ranker'

vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>()
  return { ...actual, generateObject: vi.fn() }
})

vi.mock('@/lib/ai/openrouter', () => ({
  deepseek: vi.fn().mockReturnValue('mock-model'),
  MODEL_ID: 'deepseek/deepseek-v3.2',
}))

const ANGLES = [
  { id: 1, text: 'atrial fibrillation fundamentals' },
  { id: 2, text: 'catheter ablation outcomes' },
  { id: 3, text: 'cardiac MRI' },
  { id: 7, text: 'genetics' },
]

const CANDIDATES: RankerCandidate[] = [
  {
    openalexId: 'W001',
    angleId: 2,
    title: 'Catheter ablation vs. drug therapy in persistent atrial fibrillation',
    authors: 'Smith, Chen, Patel',
    year: 2026,
    venue: 'NEJM',
    date: '2026-04-10',
    url: 'https://example.org/w001',
    abstract: 'Randomized trial of 600 patients with persistent AF...',
  },
  {
    openalexId: 'W002',
    angleId: 3,
    title: 'Left atrial strain predicts recurrence after ablation',
    authors: 'Nakamura et al.',
    year: 2026,
    venue: 'JACC',
    date: '2026-04-07',
    url: 'https://example.org/w002',
    abstract: 'Imaging biomarker study across 412 patients...',
  },
  {
    openalexId: 'W003',
    angleId: 1,
    title: 'AI-ECG screening in primary care',
    authors: 'Anand, Morales',
    year: 2026,
    venue: 'Circulation',
    date: '2026-04-12',
    url: 'https://example.org/w003',
    abstract: 'Population-level screening feasibility study...',
  },
]

afterEach(() => {
  vi.restoreAllMocks()
})

describe('rankShowcasePicks', () => {
  it('returns 3 picks with valid openalex IDs and patches when ranker proposes them', async () => {
    vi.mocked(ai.generateObject).mockResolvedValue({
      object: {
        headline: "Three papers I'd have sent you",
        picks: [
          {
            openalexId: 'W001',
            angleId: 2,
            chipLabel: 'Ablation',
            whyForYou: 'First hard-endpoint RCT for persistent AF — practice-changing evidence.',
          },
          {
            openalexId: 'W002',
            angleId: 3,
            chipLabel: 'Imaging',
            whyForYou: 'Imaging marker bridging two of your areas, pragmatic sub-study.',
          },
          {
            openalexId: 'W003',
            angleId: 1,
            chipLabel: 'Detection',
            whyForYou: 'Population-level story you could land in a primary-care conversation.',
          },
        ],
        patches: [
          {
            absorbedAngleId: 7,
            intoAngleId: 1,
            newText: 'atrial fibrillation fundamentals including genetic risk',
            reason: 'genetics overlaps with fundamentals',
          },
        ],
      },
      usage: { totalTokens: 3200 },
      providerMetadata: {},
      finishReason: 'stop',
      response: {} as never,
      warnings: [],
      request: {} as never,
      logprobs: undefined,
    } as never)

    const result = await rankShowcasePicks(
      {
        profile: 'Clinical cardiologist',
        angles: ANGLES,
        selectedAngleIds: [1, 2, 3, 7],
        hitCounts: { 1: 14, 2: 27, 3: 11, 7: 1 },
        pool: CANDIDATES,
      },
      { sessionId: 'test' },
    )

    expect(result.picks).toHaveLength(3)
    expect(result.picks.every((p) => CANDIDATES.some((c) => c.openalexId === p.openalexId))).toBe(true)
    expect(result.patches).toHaveLength(1)
    expect(result.headline).toBeTruthy()
  })

  it('accepts fewer than 3 picks when pool is thin', async () => {
    vi.mocked(ai.generateObject).mockResolvedValue({
      object: {
        headline: 'Recent highlights',
        picks: [
          {
            openalexId: 'W001',
            angleId: 2,
            chipLabel: 'Ablation',
            whyForYou: 'The only strong match this cycle but it is a solid one.',
          },
        ],
        patches: [],
      },
      usage: { totalTokens: 800 },
      providerMetadata: {},
      finishReason: 'stop',
      response: {} as never,
      warnings: [],
      request: {} as never,
      logprobs: undefined,
    } as never)

    const result = await rankShowcasePicks(
      {
        profile: 'test',
        angles: ANGLES,
        selectedAngleIds: [2],
        hitCounts: { 2: 3 },
        pool: CANDIDATES.slice(0, 1),
      },
      { sessionId: 'test' },
    )

    expect(result.picks).toHaveLength(1)
    expect(result.patches).toHaveLength(0)
  })
})
