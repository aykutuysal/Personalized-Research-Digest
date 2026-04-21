import { describe, it, expect } from 'vitest'
import { digestConfigSchema, subscribableConfigSchema } from '@/lib/config-schema'

const baseValid = {
  subject: 'AI agents',
  profile: 'Engineer interested in agent harnesses.',
  format_structure: '1. Picture. Paragraph.\n2. Shifts. Paragraph.',
  voice_language: 'Builder-to-builder, direct.',
  research_areas: [{ id: 1, text: 'tool-augmented language models' }],
  search_queries: [],
  plan: 'yearly' as const,
  email: 'alice@example.com',
  version: 1,
  created_at: '2026-04-21T00:00:00.000Z',
  updated_at: '2026-04-21T00:00:00.000Z',
}

describe('digestConfigSchema', () => {
  it('accepts the new split fields', () => {
    const r = digestConfigSchema.safeParse(baseValid)
    expect(r.success).toBe(true)
  })

  it('rejects when format_structure is missing', () => {
    const { format_structure: _, ...rest } = baseValid
    const r = digestConfigSchema.safeParse(rest)
    expect(r.success).toBe(false)
  })

  it('rejects when voice_language is missing', () => {
    const { voice_language: _, ...rest } = baseValid
    const r = digestConfigSchema.safeParse(rest)
    expect(r.success).toBe(false)
  })

  it('rejects when plan is not monthly or yearly', () => {
    const r = digestConfigSchema.safeParse({ ...baseValid, plan: 'weekly' })
    expect(r.success).toBe(false)
  })

  it('subscribableConfigSchema requires schedule', () => {
    const r = subscribableConfigSchema.safeParse(baseValid) // no schedule
    expect(r.success).toBe(false)
  })
})
