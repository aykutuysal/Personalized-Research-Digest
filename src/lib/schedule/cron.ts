// src/lib/schedule/cron.ts
import { CronExpressionParser } from 'cron-parser'
import cronstrue from 'cronstrue'
import { resolveTimezone } from './timezone'

export interface NormalizeScheduleInput {
  naturalLanguage: string
  city?: string
  timezone?: string
  now?: Date
}

export type NormalizeScheduleResult =
  | {
      ok: true
      cron: string
      timezone: string
      description: string
      nextThreeFires: string[]
    }
  | {
      ok: false
      error: 'needsTimezone' | 'unparseable' | 'invalidCron'
      suggestion?: string
    }

const DAY_MAP: Record<string, number> = {
  sun: 0, sunday: 0,
  mon: 1, monday: 1,
  tue: 2, tues: 2, tuesday: 2,
  wed: 3, weds: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4,
  fri: 5, friday: 5,
  sat: 6, saturday: 6,
}

function parseTime(text: string): { hour: number; minute: number } | null {
  // "9am", "9 am", "9:30am", "9 AM", "21:00", "21.00"
  const amPm = text.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i)
  if (amPm) {
    let h = parseInt(amPm[1], 10)
    const m = amPm[2] ? parseInt(amPm[2], 10) : 0
    const suf = amPm[3].toLowerCase()
    if (suf === 'pm' && h < 12) h += 12
    if (suf === 'am' && h === 12) h = 0
    if (h < 0 || h > 23 || m < 0 || m > 59) return null
    return { hour: h, minute: m }
  }
  const h24 = text.match(/\b(\d{1,2}):(\d{2})\b/)
  if (h24) {
    const h = parseInt(h24[1], 10)
    const m = parseInt(h24[2], 10)
    if (h < 0 || h > 23 || m < 0 || m > 59) return null
    return { hour: h, minute: m }
  }
  const bareHour = text.match(/\bat\s+(\d{1,2})\b(?!\s*(am|pm))/i)
  if (bareHour) {
    const h = parseInt(bareHour[1], 10)
    if (h >= 0 && h <= 23) return { hour: h, minute: 0 }
  }
  return null
}

function parseDaysOfWeek(text: string): number[] | null {
  const found = new Set<number>()
  for (const [name, num] of Object.entries(DAY_MAP)) {
    const re = new RegExp(`\\b${name}\\b`, 'i')
    if (re.test(text)) found.add(num)
  }
  return found.size > 0 ? Array.from(found).sort((a, b) => a - b) : null
}

function buildCron(nl: string): string | null {
  const text = nl.toLowerCase().trim()
  const time = parseTime(text) ?? { hour: 9, minute: 0 }
  const h = time.hour
  const m = time.minute

  // first of every month
  if (/\bfirst of (every|each)?\s*month\b/.test(text) || /\b1st of (every|each)?\s*month\b/.test(text)) {
    return `${m} ${h} 1 * *`
  }

  // weekdays
  if (/\bweekdays?\b/.test(text)) {
    return `${m} ${h} * * 1-5`
  }

  // weekends
  if (/\bweekends?\b/.test(text)) {
    return `${m} ${h} * * 0,6`
  }

  // every other day / every 2 days
  if (/\bevery other day\b/.test(text) || /\bevery 2 days?\b/.test(text)) {
    return `${m} ${h} */2 * *`
  }
  const everyN = text.match(/\bevery\s+(\d+)\s+days?\b/)
  if (everyN) {
    return `${m} ${h} */${everyN[1]} * *`
  }

  // days of week
  const dows = parseDaysOfWeek(text)
  if (dows) {
    return `${m} ${h} * * ${dows.join(',')}`
  }

  // plain daily
  if (/\bdaily\b/.test(text) || /\bevery day\b/.test(text) || /\beach day\b/.test(text)) {
    return `${m} ${h} * * *`
  }

  return null
}

function roundTripCron(cron: string): boolean {
  try {
    CronExpressionParser.parse(cron)
    return true
  } catch {
    return false
  }
}

function computeNextThree(cron: string, timezone: string, now: Date): string[] {
  const iter = CronExpressionParser.parse(cron, { currentDate: now, tz: timezone })
  const out: string[] = []
  for (let i = 0; i < 3; i++) {
    out.push(iter.next().toDate().toISOString())
  }
  return out
}

export function normalizeSchedule(
  input: NormalizeScheduleInput,
): NormalizeScheduleResult {
  const tz = resolveTimezone({ city: input.city, timezone: input.timezone })
  if (!tz) {
    return { ok: false, error: 'needsTimezone', suggestion: 'Which city are you in?' }
  }

  const cron = buildCron(input.naturalLanguage)
  if (!cron) {
    return {
      ok: false,
      error: 'unparseable',
      suggestion: 'Try "every Monday at 9am" or "daily at 7am".',
    }
  }
  if (!roundTripCron(cron)) {
    return { ok: false, error: 'invalidCron' }
  }

  const description = cronstrue.toString(cron, { use24HourTimeFormat: false })
  const nextThreeFires = computeNextThree(cron, tz, input.now ?? new Date())

  return { ok: true, cron, timezone: tz, description, nextThreeFires }
}
