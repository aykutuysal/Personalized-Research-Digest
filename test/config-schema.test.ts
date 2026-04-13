// test/config-schema.test.ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { digestConfigSchema, angleSchema } from '@/lib/config-schema'

const now = '2026-04-13T12:00:00.000Z'

const validConfig = {
  subject: 'Atrial fibrillation',
  schedule: {
    cron: '0 9 * * 1',
    timezone: 'Europe/Istanbul',
    description: 'Every Monday at 9:00 AM',
  },
  volume_target: 15,
  profile: 'Clinical cardiologist tracking AF evidence. No basic science.',
  output_style: 'Clinical implications per paper, concise summaries, sections: Summary, Evidence Updates, Watch List.',
  core_angles: [
    { id: 1, text: 'Catheter ablation techniques and outcomes', status: 'core', priority: 'high' },
    { id: 2, text: 'Anticoagulation choices (DOAC selection, bleeding risk)', status: 'core', priority: 'normal' },
  ],
  search_queries: [],
  version: 1,
  created_at: now,
  updated_at: now,
}

describe('digestConfigSchema', () => {
  it('accepts a fully valid config', () => {
    const r = digestConfigSchema.safeParse(validConfig)
    expect(r.success).toBe(true)
  })

  it('rejects empty subject', () => {
    const r = digestConfigSchema.safeParse({ ...validConfig, subject: '' })
    expect(r.success).toBe(false)
  })

  it('rejects missing schedule', () => {
    const bad = { ...validConfig } as Record<string, unknown>
    delete bad.schedule
    const r = digestConfigSchema.safeParse(bad)
    expect(r.success).toBe(false)
  })

  it('rejects volume_target below 3', () => {
    const r = digestConfigSchema.safeParse({ ...validConfig, volume_target: 2 })
    expect(r.success).toBe(false)
  })

  it('rejects volume_target above 40', () => {
    const r = digestConfigSchema.safeParse({ ...validConfig, volume_target: 41 })
    expect(r.success).toBe(false)
  })

  it('rejects empty core_angles', () => {
    const r = digestConfigSchema.safeParse({ ...validConfig, core_angles: [] })
    expect(r.success).toBe(false)
  })

  it('rejects invalid angle status', () => {
    const r = angleSchema.safeParse({ id: 1, text: 'x', status: 'weird' })
    expect(r.success).toBe(false)
  })

  it('defaults angle status to core and priority to normal', () => {
    const r = angleSchema.parse({ id: 1, text: 'x' })
    expect(r.status).toBe('core')
    expect(r.priority).toBe('normal')
  })

  for (const profile of [
    'llm_agents',
    'marketing',
    'afib',
    'adolescent_depression',
  ] as const) {
    it(`validates ported ${profile} angles fixture shape`, () => {
      const raw = JSON.parse(
        readFileSync(
          resolve(__dirname, `fixtures/profiles/${profile}.angles.json`),
          'utf8',
        ),
      ) as unknown

      // The fixture is a raw angle list (the iter format) — we assert the
      // shape round-trips through angleSchema after normalization.
      const angles = Array.isArray(raw) ? raw : (raw as { angles?: unknown[] }).angles
      expect(Array.isArray(angles)).toBe(true)
      const normalized = (angles as Array<unknown>).map((a, i) => {
        // Handle both string angles and object angles
        let text = ''
        if (typeof a === 'string') {
          text = a
        } else if (typeof a === 'object' && a !== null) {
          const obj = a as Record<string, unknown>
          text = String(obj.text ?? obj.angle ?? '')
        }
        return {
          id: i + 1,
          text,
          status: 'core' as const,
          priority: 'normal' as const,
        }
      })
      for (const a of normalized) {
        expect(angleSchema.safeParse(a).success).toBe(true)
      }
      expect(normalized.length).toBeGreaterThan(0)
    })
  }
})
