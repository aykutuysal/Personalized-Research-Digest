// src/lib/schedule/timezone.ts
const CITY_TO_IANA: Record<string, string> = {
  istanbul: 'Europe/Istanbul',
  ankara: 'Europe/Istanbul',
  izmir: 'Europe/Istanbul',
  london: 'Europe/London',
  manchester: 'Europe/London',
  dublin: 'Europe/Dublin',
  paris: 'Europe/Paris',
  berlin: 'Europe/Berlin',
  munich: 'Europe/Berlin',
  amsterdam: 'Europe/Amsterdam',
  madrid: 'Europe/Madrid',
  barcelona: 'Europe/Madrid',
  lisbon: 'Europe/Lisbon',
  rome: 'Europe/Rome',
  milan: 'Europe/Rome',
  stockholm: 'Europe/Stockholm',
  copenhagen: 'Europe/Copenhagen',
  helsinki: 'Europe/Helsinki',
  athens: 'Europe/Athens',
  warsaw: 'Europe/Warsaw',
  'new york': 'America/New_York',
  nyc: 'America/New_York',
  boston: 'America/New_York',
  washington: 'America/New_York',
  'washington dc': 'America/New_York',
  toronto: 'America/Toronto',
  montreal: 'America/Toronto',
  chicago: 'America/Chicago',
  dallas: 'America/Chicago',
  houston: 'America/Chicago',
  'los angeles': 'America/Los_Angeles',
  la: 'America/Los_Angeles',
  'san francisco': 'America/Los_Angeles',
  seattle: 'America/Los_Angeles',
  vancouver: 'America/Vancouver',
  'mexico city': 'America/Mexico_City',
  'sao paulo': 'America/Sao_Paulo',
  'são paulo': 'America/Sao_Paulo',
  tokyo: 'Asia/Tokyo',
  osaka: 'Asia/Tokyo',
  seoul: 'Asia/Seoul',
  shanghai: 'Asia/Shanghai',
  beijing: 'Asia/Shanghai',
  'hong kong': 'Asia/Hong_Kong',
  singapore: 'Asia/Singapore',
  taipei: 'Asia/Taipei',
  dubai: 'Asia/Dubai',
  'tel aviv': 'Asia/Jerusalem',
  jerusalem: 'Asia/Jerusalem',
  mumbai: 'Asia/Kolkata',
  delhi: 'Asia/Kolkata',
  bangalore: 'Asia/Kolkata',
  sydney: 'Australia/Sydney',
  melbourne: 'Australia/Melbourne',
  auckland: 'Pacific/Auckland',
}

function isValidIanaZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone })
    return true
  } catch {
    return false
  }
}

export interface ResolveInput {
  city?: string
  timezone?: string
}

export function resolveTimezone(input: ResolveInput): string | null {
  if (input.timezone) {
    return isValidIanaZone(input.timezone) ? input.timezone : null
  }
  if (input.city) {
    const key = input.city.trim().toLowerCase()
    return CITY_TO_IANA[key] ?? null
  }
  return null
}
