'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ShowcaseTrackingChips } from './ShowcaseTrackingChips'

const STATUS_LINES = [
  'Reading your angles…',
  'Pulling fresh work from OpenAlex…',
  'Weighing candidates against your profile…',
  'Picking the three that deserve your Monday…',
]

export interface ShowcaseScanStateProps {
  angles: Array<{ id: number; text: string }>
  /** The subset of angles being probed — these animate on top of the full list. */
  litAngleIds: number[]
  /** If the tool is emitting live titles via streaming, pass them here. Otherwise cycles local fallback. */
  liveTitles?: string[]
}

export function ShowcaseScanState({ angles, litAngleIds, liveTitles }: ShowcaseScanStateProps) {
  const [lineIdx, setLineIdx] = useState(0)
  const [titleIdx, setTitleIdx] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setLineIdx((i) => (i + 1) % STATUS_LINES.length), 2200)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!liveTitles || liveTitles.length === 0) return
    const id = setInterval(() => setTitleIdx((i) => (i + 1) % liveTitles.length), 1400)
    return () => clearInterval(id)
  }, [liveTitles])

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-line bg-bg-elev-1 p-6 shadow-[0_1px_2px_rgba(42,38,32,0.04),0_8px_32px_rgba(42,38,32,0.05)]"
      aria-live="polite"
      aria-busy="true"
    >
      {/* Top hairline — reuses the existing rd-reading-cursor keyframe */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[2px] overflow-hidden rounded-t-2xl"
      >
        <span
          className="absolute top-0 h-full w-1/3 rounded-full bg-accent"
          style={{ animation: 'rd-reading-cursor 1.6s var(--ease-out) infinite' }}
        />
      </span>

      <div className="flex items-center justify-between">
        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">
          Scanning fresh work
        </div>
        <div className="tabular-nums text-[11px] text-ink-faint">
          {litAngleIds.length} focus areas
        </div>
      </div>

      <div className="relative mt-3 min-h-[32px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={lineIdx}
            initial={{ y: 6, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -6, opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.2, 0.7, 0.2, 1] }}
            className="font-display text-[22px] leading-[1.35] tracking-[-0.005em] text-ink"
          >
            {STATUS_LINES[lineIdx]}
          </motion.div>
        </AnimatePresence>
      </div>

      {liveTitles && liveTitles.length > 0 ? (
        <div className="mt-4 border-t border-dashed border-line pt-4">
          <div className="mb-1 text-[9px] font-medium uppercase tracking-[0.12em] text-ink-faint">
            Just in
          </div>
          <div className="relative h-[20px]">
            <AnimatePresence mode="wait">
              <motion.span
                key={titleIdx}
                initial={{ y: 8, opacity: 0 }}
                animate={{ y: 0, opacity: 0.85 }}
                exit={{ y: -8, opacity: 0 }}
                transition={{ duration: 0.24, ease: [0.2, 0.7, 0.2, 1] }}
                className="font-display text-[13px] italic text-ink-soft"
              >
                {liveTitles[titleIdx]}
              </motion.span>
            </AnimatePresence>
          </div>
        </div>
      ) : null}

      <div className="mt-5">
        <ShowcaseTrackingChips angles={angles} litAngleIds={litAngleIds} animating />
      </div>
    </div>
  )
}
