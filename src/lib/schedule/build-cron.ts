// src/lib/schedule/build-cron.ts
import type { Schedule } from '@/lib/config-schema'

export type Cadence = 'daily' | 'weekdays' | 'weekly' | 'monthly'

export interface BuildScheduleInput {
  cadence: Cadence
  dayOfWeek?: 0 | 1 | 2 | 3 | 4 | 5 | 6  // weekly only; 0 = Sunday per cron
  time: string                           // 'HH:MM'
  timezone: string                       // IANA
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function parseTime(time: string): { hour: number; minute: number } {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time)
  if (!m) throw new Error(`Invalid time: ${time}`)
  const hour = Number(m[1])
  const minute = Number(m[2])
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    throw new Error(`Invalid time: ${time}`)
  }
  return { hour, minute }
}

function formatTwelveHour(hour: number, minute: number): string {
  const suffix = hour < 12 ? 'AM' : 'PM'
  const h = hour % 12 === 0 ? 12 : hour % 12
  const mm = String(minute).padStart(2, '0')
  return `${h}:${mm} ${suffix}`
}

export function buildSchedule(input: BuildScheduleInput): Schedule {
  const { hour, minute } = parseTime(input.time)
  const displayTime = formatTwelveHour(hour, minute)
  const tz = input.timezone

  switch (input.cadence) {
    case 'daily': {
      return {
        cron: `${minute} ${hour} * * *`,
        timezone: tz,
        description: `Every day at ${displayTime} (${tz})`,
      }
    }
    case 'weekdays': {
      return {
        cron: `${minute} ${hour} * * 1-5`,
        timezone: tz,
        description: `Every weekday at ${displayTime} (${tz})`,
      }
    }
    case 'weekly': {
      const dow = input.dayOfWeek ?? 1
      if (dow < 0 || dow > 6) throw new Error(`Invalid dayOfWeek: ${dow}`)
      return {
        cron: `${minute} ${hour} * * ${dow}`,
        timezone: tz,
        description: `Every ${DAY_NAMES[dow]} at ${displayTime} (${tz})`,
      }
    }
    case 'monthly': {
      return {
        cron: `${minute} ${hour} 1 * *`,
        timezone: tz,
        description: `First of every month at ${displayTime} (${tz})`,
      }
    }
  }
}
