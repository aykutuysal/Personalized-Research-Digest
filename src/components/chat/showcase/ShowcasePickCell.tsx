'use client'

import type { ShowcasePick } from '@/lib/ai/showcase'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function formatPublishedDateline(dateStr: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr)
  if (!m) return dateStr
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  const then = Date.UTC(y, mo - 1, d)
  const now = new Date()
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  const diffDays = Math.floor((today - then) / 86_400_000)
  if (diffDays < 0) return `${MONTHS[mo - 1]} ${d}, ${y}`
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays <= 7) return `${diffDays} days ago`
  return `${MONTHS[mo - 1]} ${d}, ${y}`
}

export interface ShowcasePickCellProps {
  pick: ShowcasePick
}

export function ShowcasePickCell({ pick }: ShowcasePickCellProps) {
  return (
    <a
      href={pick.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-2xl border border-line bg-bg-elev-1 px-[26px] py-[22px] transition-[border-color,transform] duration-[var(--dur-sm)] ease-[var(--ease-out)] hover:-translate-y-[1px] hover:border-line-strong"
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-line-strong pb-3">
        {pick.venue && (
          <>
            <span
              className="min-w-0 truncate font-display text-[16px] font-semibold text-ink"
              title={pick.venue}
            >
              {pick.venue}
            </span>
            <span className="text-line-strong" aria-hidden="true">—</span>
          </>
        )}
        <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-accent">
          {formatPublishedDateline(pick.date)}
        </span>
        <span className="ml-auto text-[9px] font-bold uppercase tracking-[0.16em] text-ink-faint">
          {pick.chipLabel}
        </span>
      </div>

      <div className="mt-[14px] font-display text-[21px] font-medium leading-[1.32] text-ink">
        {pick.title}
      </div>

      <div className="mt-4 flex">
        <div className="w-[3px] flex-none rounded-full bg-accent" aria-hidden="true" />
        <div className="pl-4">
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-accent">
            Why for you
          </div>
          <div className="mt-[6px] font-sans text-[14px] italic leading-[1.6] text-ink-soft">
            {pick.whyForYou}
          </div>
        </div>
      </div>
    </a>
  )
}
