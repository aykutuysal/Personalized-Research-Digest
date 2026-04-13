// test/tools.test.ts
import { describe, it, expect } from 'vitest'
import { onboardingTools } from '@/lib/ai/onboarding-tools'

describe('normalizeSchedule tool', () => {
  it('exposes a tool named normalizeSchedule', () => {
    expect(onboardingTools.normalizeSchedule).toBeDefined()
  })

  it('round-trips "every Monday at 9 AM" with Istanbul', async () => {
    const r = await onboardingTools.normalizeSchedule.execute(
      {
        naturalLanguage: 'every Monday at 9 AM',
        city: 'Istanbul',
      },
      { toolCallId: 'test-1', messages: [] },
    )
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.cron).toBe('0 9 * * 1')
      expect(r.timezone).toBe('Europe/Istanbul')
      expect(r.nextThreeFires).toHaveLength(3)
    }
  })

  it('returns needsTimezone when city is missing', async () => {
    const r = await onboardingTools.normalizeSchedule.execute(
      { naturalLanguage: 'daily at 8am' },
      { toolCallId: 'test-2', messages: [] },
    )
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toBe('needsTimezone')
  })
})
