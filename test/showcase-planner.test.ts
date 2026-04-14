// test/showcase-planner.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import * as ai from 'ai'
import { planShowcaseQueries } from '@/lib/ai/showcase-planner'

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
  { id: 4, text: 'anticoagulation' },
  { id: 5, text: 'AI detection' },
  { id: 6, text: 'rhythm control' },
  { id: 7, text: 'genetics' },
  { id: 8, text: 'clinical outcomes' },
]

afterEach(() => {
  vi.restoreAllMocks()
})

describe('planShowcaseQueries', () => {
  it('returns 4 selected angle IDs and 4 queries on an 8-angle list', async () => {
    vi.mocked(ai.generateObject).mockResolvedValue({
      object: {
        selectedAngleIds: [2, 3, 5, 1],
        queries: [
          {
            angle_id: 2,
            query: '("catheter ablation" OR "pulsed field ablation") AND ("atrial fibrillation" OR "AF")',
            rationale: 'Active technique area with weekly trials.',
          },
          {
            angle_id: 3,
            query: '("cardiac MRI" OR "CMR") AND ("atrial fibrillation" OR "AF")',
            rationale: 'Imaging sub-studies publish frequently.',
          },
          {
            angle_id: 5,
            query: '("AI" OR "deep learning") AND "ECG" AND ("atrial fibrillation" OR "AF")',
            rationale: 'AI detection is a hot area.',
          },
          {
            angle_id: 1,
            query: '"atrial fibrillation" AND ("epidemiology" OR "mechanism" OR "pathophysiology")',
            rationale: 'Foundational papers surface regularly.',
          },
        ],
      },
      usage: { totalTokens: 520 },
      providerMetadata: {},
      finishReason: 'stop',
      response: {} as never,
      warnings: [],
      request: {} as never,
      logprobs: undefined,
    } as never)

    const result = await planShowcaseQueries(
      {
        subject: 'atrial fibrillation',
        profile: 'Clinical cardiologist tracking AF evidence.',
        angles: ANGLES,
      },
      { sessionId: 'test' },
    )

    expect(result.selectedAngleIds).toHaveLength(4)
    expect(result.queries).toHaveLength(4)
    expect(result.queries.every((q) => typeof q.query === 'string' && q.query.length > 0)).toBe(true)
  })

  it('caps probed angles at the list length when N < 4', async () => {
    vi.mocked(ai.generateObject).mockResolvedValue({
      object: {
        selectedAngleIds: [1, 2],
        queries: [
          { angle_id: 1, query: '"test 1"', rationale: 'r1' },
          { angle_id: 2, query: '"test 2"', rationale: 'r2' },
        ],
      },
      usage: { totalTokens: 200 },
      providerMetadata: {},
      finishReason: 'stop',
      response: {} as never,
      warnings: [],
      request: {} as never,
      logprobs: undefined,
    } as never)

    const twoAngles = ANGLES.slice(0, 2)
    const result = await planShowcaseQueries(
      { subject: 'test', profile: 'test', angles: twoAngles },
      { sessionId: 'test' },
    )
    expect(result.selectedAngleIds).toHaveLength(2)
  })
})
