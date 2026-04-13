import { describe, it, expect } from 'vitest'
import { resolveTimezone } from '@/lib/schedule/timezone'
import { normalizeSchedule } from '@/lib/schedule/cron'

describe('resolveTimezone', () => {
  it('resolves a known city to an IANA zone', () => {
    expect(resolveTimezone({ city: 'Istanbul' })).toBe('Europe/Istanbul')
    expect(resolveTimezone({ city: 'istanbul' })).toBe('Europe/Istanbul')
    expect(resolveTimezone({ city: 'New York' })).toBe('America/New_York')
  })

  it('returns the passed timezone when valid', () => {
    expect(resolveTimezone({ timezone: 'Europe/Berlin' })).toBe('Europe/Berlin')
  })

  it('prefers explicit timezone over city', () => {
    expect(
      resolveTimezone({ timezone: 'Europe/Paris', city: 'Istanbul' }),
    ).toBe('Europe/Paris')
  })

  it('returns null when neither resolves', () => {
    expect(resolveTimezone({ city: 'Atlantis' })).toBeNull()
    expect(resolveTimezone({})).toBeNull()
  })

  it('rejects an unknown timezone string', () => {
    expect(resolveTimezone({ timezone: 'Mars/Olympus' })).toBeNull()
  })
})

describe('normalizeSchedule', () => {
  const now = new Date('2026-04-13T08:00:00.000Z') // Monday

  it('parses "every Monday at 9 AM Istanbul"', () => {
    const r = normalizeSchedule({ naturalLanguage: 'every Monday at 9 AM', city: 'Istanbul', now })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.cron).toBe('0 9 * * 1')
      expect(r.timezone).toBe('Europe/Istanbul')
      expect(r.description.toLowerCase()).toContain('monday')
      expect(r.nextThreeFires).toHaveLength(3)
    }
  })

  it('defaults time to 9 AM when unspecified', () => {
    const r = normalizeSchedule({ naturalLanguage: 'daily', timezone: 'UTC', now })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.cron).toBe('0 9 * * *')
  })

  it('handles "daily at 7am"', () => {
    const r = normalizeSchedule({ naturalLanguage: 'daily at 7am', timezone: 'UTC', now })
    expect(r.ok && r.cron).toBe('0 7 * * *')
  })

  it('handles "every other day"', () => {
    const r = normalizeSchedule({ naturalLanguage: 'every other day', timezone: 'UTC', now })
    expect(r.ok && r.cron).toBe('0 9 */2 * *')
  })

  it('handles "first of every month"', () => {
    const r = normalizeSchedule({
      naturalLanguage: 'first of every month at 10am',
      timezone: 'UTC',
      now,
    })
    expect(r.ok && r.cron).toBe('0 10 1 * *')
  })

  it('handles "weekdays at 8"', () => {
    const r = normalizeSchedule({ naturalLanguage: 'weekdays at 8am', timezone: 'UTC', now })
    expect(r.ok && r.cron).toBe('0 8 * * 1-5')
  })

  it('handles "twice a week Mon and Thu"', () => {
    const r = normalizeSchedule({
      naturalLanguage: 'twice a week Mon and Thu at 9am',
      timezone: 'UTC',
      now,
    })
    expect(r.ok && r.cron).toBe('0 9 * * 1,4')
  })

  it('returns needsTimezone when city is unknown', () => {
    const r = normalizeSchedule({ naturalLanguage: 'daily', now })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toBe('needsTimezone')
  })

  it('returns unparseable on gibberish', () => {
    const r = normalizeSchedule({
      naturalLanguage: 'qwerty asdf zxcv',
      timezone: 'UTC',
      now,
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toBe('unparseable')
  })
})
