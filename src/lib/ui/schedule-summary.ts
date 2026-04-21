import type { Plan } from '@/lib/config-schema'
import type { Cadence } from '@/lib/schedule/build-cron'

export interface NextDeliveryInput {
  cadence: Cadence
  dayOfWeek?: number // 0=Sun ... 6=Sat, required if cadence === 'weekly'
  dayOfMonth?: number // 1..31, required if cadence === 'monthly'
  time: string // 'HH:MM'
  timezone: string
  now?: Date
}

export function nextDeliveryDate(i: NextDeliveryInput): Date {
  const now = i.now ?? new Date()
  const [hh, mm] = i.time.split(':').map((n) => parseInt(n, 10))
  const candidate = new Date(now)
  candidate.setUTCHours(hh, mm, 0, 0)

  if (i.cadence === 'daily') {
    if (candidate <= now) candidate.setUTCDate(candidate.getUTCDate() + 1)
  } else if (i.cadence === 'weekdays') {
    if (candidate <= now) candidate.setUTCDate(candidate.getUTCDate() + 1)
    while ([0, 6].includes(candidate.getUTCDay())) {
      candidate.setUTCDate(candidate.getUTCDate() + 1)
    }
  } else if (i.cadence === 'weekly') {
    const target = i.dayOfWeek ?? 1
    let delta = (target - candidate.getUTCDay() + 7) % 7
    if (delta === 0 && candidate <= now) delta = 7
    candidate.setUTCDate(candidate.getUTCDate() + delta)
  } else if (i.cadence === 'monthly') {
    const day = i.dayOfMonth ?? 1
    candidate.setUTCDate(day)
    if (candidate <= now) candidate.setUTCMonth(candidate.getUTCMonth() + 1)
  }
  return candidate
}

export interface ScheduleSummaryInput extends NextDeliveryInput {
  plan: Plan
  email: string
}

const PRICE_COPY: Record<Plan, string> = {
  monthly: '$19 a month',
  yearly: '$149 a year',
}

export function buildScheduleSummary(i: ScheduleSummaryInput): string {
  const d = nextDeliveryDate(i)
  const fmt = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: i.timezone,
  })
  const when = fmt.format(d)
  const time = i.time // already HH:MM
  return `Your first issue lands ${when} at ${time}, in ${i.email}. Then every ${readableCadence(i)} for ${PRICE_COPY[i.plan]}, until you change it.`
}

function readableCadence(i: NextDeliveryInput): string {
  if (i.cadence === 'daily') return 'day'
  if (i.cadence === 'weekdays') return 'weekday'
  if (i.cadence === 'weekly') {
    const names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    return names[i.dayOfWeek ?? 1]
  }
  return `month on the ${i.dayOfMonth ?? 1}`
}
