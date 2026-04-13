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

describe('generateConfig tool', () => {
  const validConfig = {
    subject: 'Atrial fibrillation',
    schedule: {
      cron: '0 9 * * 1',
      timezone: 'Europe/Istanbul',
      description: 'Every Monday at 9:00 AM',
    },
    volume_target: 15,
    profile: 'Clinical cardiologist tracking AF evidence. No basic science.',
    output_style:
      'Sections: Summary, Evidence Updates, Watch List. Clinical implications per paper.',
    core_angles: [
      { id: 1, text: 'Catheter ablation techniques', status: 'core', priority: 'high' },
    ],
  }

  it('returns ok with a stamped config on valid input', async () => {
    const r = await onboardingTools.generateConfig.execute(
      { config: validConfig },
      { toolCallId: 'g-1', messages: [] },
    )
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.config.version).toBe(1)
      expect(typeof r.config.created_at).toBe('string')
      expect(typeof r.config.updated_at).toBe('string')
      expect(r.config.core_angles).toHaveLength(1)
    }
  })

  it('returns ok:false with errors on missing required field', async () => {
    const bad = { ...validConfig, profile: '' }
    const r = await onboardingTools.generateConfig.execute(
      { config: bad },
      { toolCallId: 'g-2', messages: [] },
    )
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.length).toBeGreaterThan(0)
  })
})
