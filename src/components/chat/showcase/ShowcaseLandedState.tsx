'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import type { ShowcasePick } from '@/lib/ai/showcase'
import { ShowcasePickCell } from './ShowcasePickCell'
import { ShowcaseTrackingChips } from './ShowcaseTrackingChips'

export interface ShowcaseLandedStateProps {
  headline: string
  picks: ShowcasePick[]
  finalAngles: Array<{ id: number; text: string }>
  stats: { papersScanned: number; anglesProbed: number }
}

function useCountUp(target: number, durationMs = 900): number {
  const [value, setValue] = useState(0)
  useEffect(() => {
    let raf = 0
    const startedAt = performance.now()
    const tick = (now: number) => {
      const elapsed = now - startedAt
      const t = Math.min(1, elapsed / durationMs)
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3)
      setValue(Math.round(target * eased))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, durationMs])
  return value
}

export function ShowcaseLandedState({
  headline,
  picks,
  finalAngles,
  stats,
}: ShowcaseLandedStateProps) {
  const count = useCountUp(stats.papersScanned)
  const gridCols =
    picks.length === 1 ? 'grid-cols-1' : picks.length === 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-3'

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.24, ease: [0.2, 0.7, 0.2, 1] }}
      className="rounded-2xl border border-line bg-bg-elev-1 p-6 shadow-[0_1px_2px_rgba(42,38,32,0.04),0_8px_32px_rgba(42,38,32,0.06)]"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">
            Fresh this week
          </div>
          <h3 className="mt-1 font-display text-[24px] leading-[1.2] tracking-[-0.005em] text-ink">
            {headline}
          </h3>
        </div>
        <div className="whitespace-nowrap text-right tabular-nums text-[11px] leading-[1.6] text-ink-faint">
          <strong className="font-medium text-ink-soft">{count.toLocaleString()}</strong> papers scanned
          <br />
          across <strong className="font-medium text-ink-soft">{stats.anglesProbed}</strong> areas
        </div>
      </div>

      <div className={`mt-5 grid gap-3 ${gridCols}`}>
        {picks.map((p) => (
          <ShowcasePickCell key={p.openalexId} pick={p} />
        ))}
      </div>

      <div className="mt-5 border-t border-line pt-4">
        <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.12em] text-ink-faint">
          Tracking
        </div>
        <ShowcaseTrackingChips angles={finalAngles} />
      </div>
    </motion.div>
  )
}
