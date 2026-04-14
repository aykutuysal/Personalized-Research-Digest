// test/corpus-sanity.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { buildOnboardingTools } from '@/lib/ai/onboarding-tools'

const onboardingTools = buildOnboardingTools(null)
import * as openalex from '@/lib/openalex/client'
import * as planner from '@/lib/ai/query-planner'
import type { QueryPlan } from '@/lib/ai/query-planner'
import { runTool, toolCtx } from './helpers'

function planFor(angles: { text: string }[]): QueryPlan {
  return {
    subject: 'test',
    allocation: angles.map((_, i) => ({
      angle_id: i + 1,
      queries: 1,
      reason: 'test',
    })),
    queries: angles.map((a, i) => ({
      id: i + 1,
      angle_id: i + 1,
      slot: 1,
      query: `("${a.text}") AND test`,
      rationale: 'tight phrase anchor',
    })),
    coverage_notes: 'test plan',
  }
}

const PROFILE = 'Cardiologist tracking AFib, wants clinical depth, no animal studies.'

beforeEach(() => {
  process.env.OPENALEX_MAILTO = 'test@example.com'
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('corpusSanityCheck tool', () => {
  it('maps high counts to healthy', async () => {
    const angles = [{ text: 'ablation' }, { text: 'anticoagulation' }]
    vi.spyOn(planner, 'planQueries').mockResolvedValue(planFor(angles))
    vi.spyOn(openalex, 'searchByKeyword').mockResolvedValue({
      meta: { count: 120 },
      results: [],
    })
    const r = await runTool(onboardingTools.corpusSanityCheck, {
      subject: 'AF',
      profile: PROFILE,
      cadenceDays: 7,
      angles,
    }, toolCtx('c-1'))
    expect(r.results).toHaveLength(2)
    for (const item of r.results) {
      expect(item.verdict).toBe('healthy')
      expect(item.papersPerRun).toBeCloseTo((120 / 30) * 7, 5)
    }
  })

  it('maps low counts to sparse', async () => {
    const angles = [{ text: 'rare technique' }]
    vi.spyOn(planner, 'planQueries').mockResolvedValue(planFor(angles))
    vi.spyOn(openalex, 'searchByKeyword').mockResolvedValue({
      meta: { count: 3 },
      results: [{ id: 'W1', title: 'Rare technique study' } as never],
    })
    const r = await runTool(onboardingTools.corpusSanityCheck, {
      subject: 'x',
      profile: PROFILE,
      cadenceDays: 7,
      angles,
    }, toolCtx('c-2'))
    expect(r.results[0].verdict).toBe('sparse')
    expect(r.results[0].papersPerRun).toBeCloseTo((3 / 30) * 7, 5)
  })

  it('maps zero counts to empty', async () => {
    const angles = [{ text: 'empty angle' }]
    vi.spyOn(planner, 'planQueries').mockResolvedValue(planFor(angles))
    vi.spyOn(openalex, 'searchByKeyword').mockResolvedValue({
      meta: { count: 0 },
      results: [],
    })
    const r = await runTool(onboardingTools.corpusSanityCheck, {
      subject: 'x',
      profile: PROFILE,
      cadenceDays: 7,
      angles,
    }, toolCtx('c-3'))
    expect(r.results[0].verdict).toBe('empty')
    expect(r.results[0].papersPerRun).toBe(0)
  })

  it('maps fetch failure to error verdict', async () => {
    const angles = [{ text: 'boom' }]
    vi.spyOn(planner, 'planQueries').mockResolvedValue(planFor(angles))
    vi.spyOn(openalex, 'searchByKeyword').mockRejectedValue(new Error('network'))
    const r = await runTool(onboardingTools.corpusSanityCheck, {
      subject: 'x',
      profile: PROFILE,
      cadenceDays: 7,
      angles,
    }, toolCtx('c-4'))
    expect(r.results[0].verdict).toBe('error')
  })

  it('maps planner failure to error verdicts for every angle', async () => {
    const angles = [{ text: 'a' }, { text: 'b' }]
    vi.spyOn(planner, 'planQueries').mockRejectedValue(new Error('llm parse'))
    const fetchSpy = vi.spyOn(openalex, 'searchByKeyword')
    const r = await runTool(onboardingTools.corpusSanityCheck, {
      subject: 'x',
      profile: PROFILE,
      cadenceDays: 7,
      angles,
    }, toolCtx('c-planner-fail'))
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(r.results).toHaveLength(2)
    expect(r.results.every((x) => x.verdict === 'error')).toBe(true)
    expect(r.results[0].angleText).toBe('a')
    expect(r.results[1].angleText).toBe('b')
  })

  it('invokes the planner with profile + budget sized to the angle list', async () => {
    const angles = [{ text: 'angle-x' }, { text: 'angle-y' }, { text: 'angle-z' }]
    const planSpy = vi
      .spyOn(planner, 'planQueries')
      .mockResolvedValue(planFor(angles))
    vi.spyOn(openalex, 'searchByKeyword').mockResolvedValue({
      meta: { count: 100 },
      results: [],
    })
    await runTool(onboardingTools.corpusSanityCheck, {
      subject: 'neuroscience',
      profile: PROFILE,
      cadenceDays: 7,
      angles,
    }, toolCtx('c-plan-args'))
    expect(planSpy).toHaveBeenCalledTimes(1)
    expect(planSpy.mock.calls[0][0]).toEqual({
      subject: 'neuroscience',
      profile: PROFILE,
      angles,
      queryBudget: 3,
      minPerAngle: 1,
      maxPerAngle: 1,
    })
  })

  it('runs the planner-produced query string against OpenAlex', async () => {
    const angles = [{ text: 'base editing' }]
    vi.spyOn(planner, 'planQueries').mockResolvedValue({
      subject: 'gene therapy',
      allocation: [{ angle_id: 1, queries: 1, reason: 'rich corpus' }],
      queries: [
        {
          id: 1,
          angle_id: 1,
          slot: 1,
          query: '("base editing" OR "base editor") AND ("gene therapy" OR "genome editing")',
          rationale: 'tight phrase anchor',
        },
      ],
      coverage_notes: 'single-angle sanity probe',
    })
    const fetchSpy = vi.spyOn(openalex, 'searchByKeyword').mockResolvedValue({
      meta: { count: 42 },
      results: [],
    })
    await runTool(onboardingTools.corpusSanityCheck, {
      subject: 'gene therapy',
      profile: PROFILE,
      cadenceDays: 7,
      angles,
    }, toolCtx('c-plan-run'))
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(fetchSpy.mock.calls[0][0]).toMatchObject({
      query:
        '("base editing" OR "base editor") AND ("gene therapy" OR "genome editing")',
      perPage: 3,
      page: 1,
    })
  })

  it('caps concurrency at 5 even if a larger plan slips through', async () => {
    // Bypass the schema .max(4) cap — this test isolates the semaphore
    // behavior in withSemaphore, not the schema validation.
    const angles = Array.from({ length: 12 }, (_, i) => ({ text: `angle-${i}` }))
    vi.spyOn(planner, 'planQueries').mockResolvedValue(planFor(angles))
    let inFlight = 0
    let peak = 0
    vi.spyOn(openalex, 'searchByKeyword').mockImplementation(async () => {
      inFlight += 1
      peak = Math.max(peak, inFlight)
      await new Promise((r) => setTimeout(r, 5))
      inFlight -= 1
      return { meta: { count: 50 }, results: [] }
    })
    await onboardingTools.corpusSanityCheck.execute!(
      {
        subject: 'x',
        profile: PROFILE,
        cadenceDays: 7,
        angles,
      },
      toolCtx('c-5'),
    )
    expect(peak).toBeLessThanOrEqual(5)
  })
})
