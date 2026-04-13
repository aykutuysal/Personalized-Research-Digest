import { describe, it, expect } from 'vitest'
import { resolveTimezone } from '@/lib/schedule/timezone'

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
