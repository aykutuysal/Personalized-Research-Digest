// test/tools.test.ts
import { describe, it, expect, vi } from 'vitest'
import { buildOnboardingTools } from '@/lib/ai/onboarding-tools'

const onboardingTools = buildOnboardingTools(null)
import * as proposeAnglesModule from '@/lib/ai/propose-angles'
import { runTool, toolCtx } from './helpers'

describe('normalizeSchedule tool', () => {
  it('exposes a tool named normalizeSchedule', () => {
    expect(onboardingTools.normalizeSchedule).toBeDefined()
  })

  it('round-trips "every Monday at 9 AM" with Istanbul', async () => {
    const r = await runTool(onboardingTools.normalizeSchedule, {
      naturalLanguage: 'every Monday at 9 AM',
      city: 'Istanbul',
    }, toolCtx('test-1'))
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.cron).toBe('0 9 * * 1')
      expect(r.timezone).toBe('Europe/Istanbul')
      expect(r.nextThreeFires).toHaveLength(3)
    }
  })

  it('returns needsTimezone when city is missing', async () => {
    const r = await runTool(onboardingTools.normalizeSchedule, {
      naturalLanguage: 'daily at 8am',
    }, toolCtx('test-2'))
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
    const r = await runTool(onboardingTools.generateConfig, { config: validConfig }, toolCtx('g-1'))
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
    const r = await runTool(onboardingTools.generateConfig, { config: bad }, toolCtx('g-2'))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.length).toBeGreaterThan(0)
  })
})

describe('proposeAngles tool', () => {
  it('returns 6–12 angles for a subject/profile', async () => {
    vi.spyOn(proposeAnglesModule, 'proposeAngles').mockResolvedValueOnce({
      angles: [
        { text: 'Catheter ablation techniques', rationale: 'High publication volume; named techniques.' },
        { text: 'Anticoagulation choices', rationale: 'DOAC trials publish regularly.' },
        { text: 'Rate vs rhythm control', rationale: 'Active debate with landmark trials.' },
        { text: 'Stroke prevention', rationale: 'LAAC devices are a productive sub-area.' },
        { text: 'Guideline updates', rationale: 'ESC/ACC updates produce trackable news.' },
        { text: 'Wearable monitoring', rationale: 'Consumer-device trials are growing.' },
      ],
    })

    const r = await runTool(onboardingTools.proposeAngles, {
      subject: 'Atrial fibrillation',
      profileSummary: 'Clinical cardiologist, no basic science.',
    }, toolCtx('a-1'))
    expect(r.angles.length).toBeGreaterThanOrEqual(6)
    expect(r.angles.length).toBeLessThanOrEqual(12)
    expect(r.angles[0]).toHaveProperty('text')
    expect(r.angles[0]).toHaveProperty('rationale')
  })
})
