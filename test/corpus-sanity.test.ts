// test/corpus-sanity.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { onboardingTools } from '@/lib/ai/onboarding-tools'
import * as openalex from '@/lib/openalex/client'
import { runTool, toolCtx } from './helpers'

beforeEach(() => {
  process.env.OPENALEX_MAILTO = 'test@example.com'
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('corpusSanityCheck tool', () => {
  it('maps high counts to healthy', async () => {
    vi.spyOn(openalex, 'searchByKeyword').mockResolvedValue({
      meta: { count: 120 },
      results: [],
    })
    const r = await runTool(onboardingTools.corpusSanityCheck, {
      subject: 'AF',
      cadenceDays: 7,
      angles: [{ text: 'ablation' }, { text: 'anticoagulation' }],
    }, toolCtx('c-1'))
    expect(r.results).toHaveLength(2)
    for (const item of r.results) {
      expect(item.verdict).toBe('healthy')
      expect(item.papersPerRun).toBeCloseTo((120 / 30) * 7, 5)
    }
  })

  it('maps low counts to sparse', async () => {
    vi.spyOn(openalex, 'searchByKeyword').mockResolvedValue({
      meta: { count: 3 },
      results: [{ id: 'W1', title: 'Rare technique study' } as never],
    })
    const r = await runTool(onboardingTools.corpusSanityCheck, {
      subject: 'x',
      cadenceDays: 7,
      angles: [{ text: 'rare technique' }],
    }, toolCtx('c-2'))
    expect(r.results[0].verdict).toBe('sparse')
    expect(r.results[0].papersPerRun).toBeCloseTo((3 / 30) * 7, 5)
  })

  it('maps zero counts to empty', async () => {
    vi.spyOn(openalex, 'searchByKeyword').mockResolvedValue({
      meta: { count: 0 },
      results: [],
    })
    const r = await runTool(onboardingTools.corpusSanityCheck, {
      subject: 'x',
      cadenceDays: 7,
      angles: [{ text: 'empty angle' }],
    }, toolCtx('c-3'))
    expect(r.results[0].verdict).toBe('empty')
    expect(r.results[0].papersPerRun).toBe(0)
  })

  it('maps fetch failure to error verdict', async () => {
    vi.spyOn(openalex, 'searchByKeyword').mockRejectedValue(new Error('network'))
    const r = await runTool(onboardingTools.corpusSanityCheck, {
      subject: 'x',
      cadenceDays: 7,
      angles: [{ text: 'boom' }],
    }, toolCtx('c-4'))
    expect(r.results[0].verdict).toBe('error')
  })

  it('caps concurrency at 5', async () => {
    let inFlight = 0
    let peak = 0
    vi.spyOn(openalex, 'searchByKeyword').mockImplementation(async () => {
      inFlight += 1
      peak = Math.max(peak, inFlight)
      await new Promise((r) => setTimeout(r, 5))
      inFlight -= 1
      return { meta: { count: 50 }, results: [] }
    })
    const angles = Array.from({ length: 12 }, (_, i) => ({ text: `angle-${i}` }))
    await runTool(onboardingTools.corpusSanityCheck, {
      subject: 'x',
      cadenceDays: 7,
      angles,
    }, toolCtx('c-5'))
    expect(peak).toBeLessThanOrEqual(5)
  })
})
