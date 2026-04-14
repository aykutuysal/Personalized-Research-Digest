'use client'

import { motion } from 'framer-motion'

export interface ShowcaseTrackingChipsProps {
  angles: Array<{ id: number; text: string }>
  /** During the scan state, these IDs animate; otherwise all render neutral. */
  litAngleIds?: number[]
  /** When true, the lit chips animate in a staggered sweep. */
  animating?: boolean
}

export function ShowcaseTrackingChips({
  angles,
  litAngleIds = [],
  animating = false,
}: ShowcaseTrackingChipsProps) {
  const lit = new Set(litAngleIds)
  return (
    <div className="flex flex-wrap gap-1.5">
      {angles.map((a, i) => {
        const isLit = lit.has(a.id) && animating
        return (
          <motion.span
            layout
            key={a.id}
            initial={false}
            className={
              'rounded-full border px-2.5 py-1 text-[11px] font-medium tabular-nums ' +
              (isLit
                ? 'border-accent/60 bg-accent-soft text-accent'
                : 'border-line bg-bg text-ink-soft')
            }
            style={
              isLit
                ? { animationDelay: `${i * 0.15}s`, animation: 'rd-chip-pulse 2.4s var(--ease-out) infinite' }
                : undefined
            }
          >
            {a.text}
          </motion.span>
        )
      })}
    </div>
  )
}
