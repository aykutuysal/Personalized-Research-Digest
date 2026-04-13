'use client'

import { Chip } from '@/components/ui/Chip'
import { ToolCallCard, type ToolCallState } from './ToolCallCard'

export interface ScheduleCardProps {
  state: ToolCallState
  result?:
    | {
        ok: true
        cron: string
        timezone: string
        description: string
        nextThreeFires: string[]
      }
    | { ok: false; error: string; suggestion?: string }
}

function formatFire(iso: string, timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

export function ScheduleCard({ state, result }: ScheduleCardProps) {
  let completedLabel = 'Schedule set'
  let detail: React.ReactNode = null

  if (result && result.ok) {
    completedLabel = result.description
    detail = (
      <div className="flex flex-wrap gap-2">
        {result.nextThreeFires.map((iso, i) => (
          <Chip key={i}>{formatFire(iso, result.timezone)}</Chip>
        ))}
      </div>
    )
  } else if (result && !result.ok) {
    completedLabel = 'Need a bit more info'
    detail = (
      <p className="text-ink-dim text-[14px]">
        {result.suggestion ?? 'Let me know the schedule again.'}
      </p>
    )
  }

  return (
    <ToolCallCard
      state={state}
      pendingLabel="Working out your schedule…"
      completedLabel={completedLabel}
      detail={detail}
    />
  )
}
