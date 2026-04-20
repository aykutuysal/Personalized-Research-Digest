// src/components/common/PaperRow.tsx
'use client'

import type { ReferencePaper } from '@/lib/ai/preview/progress-events'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function formatPublishedDateline(dateStr: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr)
  if (!m) return dateStr || ''
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

export interface PaperRowProps {
  index: number           // 1-based citation number
  paper: ReferencePaper
  chipLabel?: string      // optional — e.g. the research area text
}

export function PaperRow({ index, paper, chipLabel }: PaperRowProps) {
  return (
    <a
      href={paper.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-2xl border border-line bg-bg-elev-1 px-[26px] py-[22px] transition-[border-color,transform] duration-[var(--dur-sm)] ease-[var(--ease-out)] hover:-translate-y-[1px] hover:border-line-strong"
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-line-strong pb-3">
        <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-accent">
          [{index}]
        </span>
        {paper.venue && (
          <>
            <span
              className="min-w-0 truncate font-display text-[16px] font-semibold text-ink"
              title={paper.venue}
            >
              {paper.venue}
            </span>
            <span className="text-line-strong" aria-hidden="true">—</span>
          </>
        )}
        <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-accent">
          {formatPublishedDateline(paper.date)}
        </span>
        {chipLabel && (
          <span className="ml-auto text-[9px] font-bold uppercase tracking-[0.16em] text-ink-faint">
            {chipLabel}
          </span>
        )}
      </div>

      <div className="mt-[14px] font-display text-[21px] font-medium leading-[1.22] tracking-[-0.012em] text-ink">
        {paper.title}
      </div>

      <div className="mt-2 text-[12px] text-ink-faint">{paper.authors}</div>
    </a>
  )
}
