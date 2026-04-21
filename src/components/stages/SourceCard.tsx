'use client'
import type { ReferencePaper } from '@/lib/ai/preview/progress-events'

export interface SourceCardProps {
  n: number
  paper: ReferencePaper
  highlighted?: boolean
}

export function SourceCard({ n, paper, highlighted }: SourceCardProps) {
  return (
    <div
      id={`source-${n}`}
      className={`mb-2 rounded border bg-bg-elev-1 p-[12px_14px] transition-colors ${
        highlighted ? 'border-accent' : 'border-line'
      }`}
    >
      <div className="flex items-baseline gap-3 text-[11px]">
        <span className="font-bold tracking-[0.04em] text-accent">[{n}]</span>
        <span className="text-ink-faint">
          {paper.venue} · {paper.date}
        </span>
      </div>
      <div className="mt-[2px] font-display text-[14px] font-medium leading-[1.3] text-ink">
        {paper.title}
      </div>
      <div className="text-[11px] text-ink-faint">{paper.authors}</div>
    </div>
  )
}
