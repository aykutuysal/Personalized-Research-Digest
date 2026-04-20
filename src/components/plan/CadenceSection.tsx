// src/components/plan/CadenceSection.tsx
'use client'

import { useState } from 'react'
import type { Schedule } from '@/lib/config-schema'
import { buildSchedule, type Cadence } from '@/lib/schedule/build-cron'

const CADENCE_OPTIONS: Array<{ value: Cadence; label: string }> = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekdays', label: 'Weekdays' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
]
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export interface CadenceSectionProps {
  timezoneDefault: string
  schedule?: Schedule
  onScheduleSet: (s: Schedule) => void
}

export function CadenceSection({ timezoneDefault, schedule, onScheduleSet }: CadenceSectionProps) {
  const [cadence, setCadence] = useState<Cadence | null>(null)
  const [dayOfWeek, setDayOfWeek] = useState<0 | 1 | 2 | 3 | 4 | 5 | 6>(1)
  const [time, setTime] = useState('08:00')
  const [tz, setTz] = useState(schedule?.timezone ?? timezoneDefault)

  const canSubmit = !!cadence && /^\d{1,2}:\d{2}$/.test(time) && tz.length > 0

  const save = () => {
    if (!cadence) return
    try {
      const s = buildSchedule({ cadence, dayOfWeek, time, timezone: tz })
      onScheduleSet(s)
    } catch {
      // time parse errors bubble up; keep the form open
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-bg-elev-1 p-6">
      <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-accent">Delivery</div>

      <div className="mt-4">
        <div className="text-[12px] uppercase tracking-[0.16em] text-ink-faint">Cadence</div>
        <div role="radiogroup" className="mt-2 flex flex-wrap gap-2">
          {CADENCE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              role="radio"
              aria-checked={cadence === opt.value}
              onClick={() => setCadence(opt.value)}
              className={`rounded-full border px-4 py-1.5 text-[13px] ${cadence === opt.value ? 'border-accent bg-accent-soft text-ink' : 'border-line text-ink-faint hover:text-ink hover:border-line-strong'}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {cadence === 'weekly' && (
        <div className="mt-4">
          <div className="text-[12px] uppercase tracking-[0.16em] text-ink-faint">Day of week</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {DAYS.map((d, i) => (
              <button
                key={d}
                onClick={() => setDayOfWeek(i as 0 | 1 | 2 | 3 | 4 | 5 | 6)}
                className={`rounded-full border px-3 py-1 text-[13px] ${dayOfWeek === i ? 'border-accent bg-accent-soft text-ink' : 'border-line text-ink-faint hover:text-ink hover:border-line-strong'}`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-end gap-6">
        <label className="flex flex-col">
          <span className="text-[12px] uppercase tracking-[0.16em] text-ink-faint">Time</span>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="mt-1 rounded-lg border border-line bg-bg-elev-1 px-3 py-1.5 text-[14px] text-ink"
          />
        </label>
        <label className="flex flex-col">
          <span className="text-[12px] uppercase tracking-[0.16em] text-ink-faint">Timezone</span>
          <input
            type="text"
            value={tz}
            onChange={(e) => setTz(e.target.value)}
            className="mt-1 rounded-lg border border-line bg-bg-elev-1 px-3 py-1.5 text-[14px] text-ink min-w-[220px]"
          />
        </label>
        <button
          disabled={!canSubmit}
          onClick={save}
          className="rounded-lg border border-accent bg-accent px-4 py-2 text-[13px] uppercase tracking-[0.16em] text-bg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Set schedule
        </button>
      </div>

      {schedule && (
        <p className="mt-4 font-display text-[14px] italic text-ink">{schedule.description}</p>
      )}
    </div>
  )
}
