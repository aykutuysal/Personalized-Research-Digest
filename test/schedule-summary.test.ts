import { describe, it, expect } from 'vitest'
import { buildScheduleSummary, nextDeliveryDate } from '@/lib/ui/schedule-summary'

describe('nextDeliveryDate', () => {
  it('returns next Tuesday at 09:00 when today is Monday', () => {
    // 2026-04-20 is a Monday
    const d = nextDeliveryDate({
      cadence: 'weekly',
      dayOfWeek: 2, // Tue
      time: '09:00',
      timezone: 'UTC',
      now: new Date('2026-04-20T12:00:00Z'),
    })
    expect(d.toISOString().slice(0, 10)).toBe('2026-04-21')
    expect(d.toISOString().slice(11, 16)).toBe('09:00')
  })

  it('returns tomorrow for daily', () => {
    const d = nextDeliveryDate({
      cadence: 'daily',
      time: '09:00',
      timezone: 'UTC',
      now: new Date('2026-04-20T12:00:00Z'),
    })
    expect(d.toISOString().slice(0, 10)).toBe('2026-04-21')
  })
})

describe('buildScheduleSummary', () => {
  it('composes the human-readable line for weekly + yearly', () => {
    const line = buildScheduleSummary({
      cadence: 'weekly',
      dayOfWeek: 2,
      time: '09:00',
      timezone: 'Europe/Istanbul',
      plan: 'yearly',
      email: 'a@b.com',
      now: new Date('2026-04-20T12:00:00Z'),
    })
    expect(line).toMatch(/first issue lands .* at 09:00/)
    expect(line).toMatch(/in a@b\.com/)
    expect(line).toMatch(/\$149 a year/)
  })

  it('uses $19 a month for monthly plan', () => {
    const line = buildScheduleSummary({
      cadence: 'daily',
      time: '08:00',
      timezone: 'UTC',
      plan: 'monthly',
      email: 'a@b.com',
      now: new Date('2026-04-20T12:00:00Z'),
    })
    expect(line).toMatch(/\$19 a month/)
  })
})
