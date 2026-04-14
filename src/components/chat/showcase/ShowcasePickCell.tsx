'use client'

import type { ShowcasePick } from '@/lib/ai/showcase'

export interface ShowcasePickCellProps {
  pick: ShowcasePick
}

export function ShowcasePickCell({ pick }: ShowcasePickCellProps) {
  return (
    <a
      href={pick.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex min-h-full flex-col gap-2 rounded-xl border border-line bg-bg p-4 transition-[border-color,transform] duration-[var(--dur-sm)] hover:-translate-y-[1px] hover:border-line-strong"
    >
      <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-accent">
        {pick.chipLabel}
      </div>
      <div className="text-[14px] font-medium leading-[1.4] text-ink">{pick.title}</div>
      <div className="text-[11px] tabular-nums text-ink-faint">
        {pick.venue} · {pick.year}
      </div>
      <div className="mt-auto border-t border-dashed border-line pt-3">
        <div className="mb-1 text-[9px] font-medium uppercase tracking-[0.1em] text-ink-faint">
          Why for you
        </div>
        <div className="font-display text-[12px] italic leading-[1.5] text-ink-soft">
          {pick.whyForYou}
        </div>
      </div>
    </a>
  )
}
