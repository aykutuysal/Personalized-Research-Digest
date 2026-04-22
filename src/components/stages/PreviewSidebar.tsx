'use client'
import type { ReactNode } from 'react'

export interface PreviewSidebarProps {
  papersScanned: number
  totalAreas: number
  papersSelected: number
}

const SELL_BULLETS: Array<{ lead: string; body: string }> = [
  { lead: 'The full field, scanned.', body: 'Thousands of papers across your areas, so nothing important slips through.' },
  { lead: 'As much as the field delivers.', body: 'Not a fixed 5. A quiet stretch brings fewer, a flood of new work brings more, right-sized for each issue.' },
  { lead: 'Deep reads, not skims.', body: 'Reads the full paper for every pick and sees how it connects to related work, so nothing important gets missed.' },
  { lead: 'Continuity across issues.', body: 'Remembers what you have already read. Threads build over time. Nothing repeats.' },
  { lead: 'In your inbox, on your schedule.', body: 'Daily, weekly, monthly, whenever you want it.' },
]

export function PreviewSidebar({
  papersScanned,
  totalAreas,
  papersSelected,
}: PreviewSidebarProps) {
  return (
    <aside className="flex flex-col gap-4 border-r border-line bg-bg-elev-1 p-6 pb-5 max-[900px]:border-r-0 max-[900px]:border-b">
      <Block label="This is a preview">
        <p className="text-[12px] leading-[1.55] text-ink-soft">
          A short sample so you can feel the voice and paper-picking. Your real digest does much more.
        </p>
      </Block>

      <Block label="The sample">
        <StatRow n={papersScanned} k="Papers scanned" />
        <StatRow n={totalAreas} k="Areas covered" />
        <StatRow n={papersSelected} k="Selected for you" />
      </Block>

      <Block label="Your real digest does more">
        <ul className="m-0 list-none space-y-[10px] p-0">
          {SELL_BULLETS.map((b) => (
            <li key={b.lead} className="border-t border-line-strong pt-[8px] text-[12px] leading-[1.5] text-ink-soft first:border-t-0 first:pt-0">
              <strong className="mb-[3px] block font-display text-[14.5px] font-medium tracking-[-0.005em] text-ink">
                {b.lead}
              </strong>
              {b.body}
            </li>
          ))}
        </ul>
      </Block>
    </aside>
  )
}

function Block({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-[8px] text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">{label}</div>
      {children}
    </div>
  )
}

function StatRow({ n, k }: { n: number | string; k: string }) {
  return (
    <div className="border-t border-line-strong py-[8px] first:border-t-0 first:pt-0">
      <div className="font-display text-[24px] font-medium leading-none tabular-nums text-ink">{n}</div>
      <div className="mt-[4px] text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-faint">{k}</div>
    </div>
  )
}
