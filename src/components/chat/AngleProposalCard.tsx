'use client'

import { useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import type { ToolCallState } from './ToolCallCard'

export interface AngleProposalCardProps {
  state: ToolCallState
  result?: { angles: Array<{ text: string; rationale: string }> }
}

const COUNT_WORDS = [
  'Zero',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
]

function countWord(n: number): string {
  return COUNT_WORDS[n] ?? String(n)
}

export function AngleProposalCard({ state, result }: AngleProposalCardProps) {
  const [open, setOpen] = useState(true)
  const reduceMotion = useReducedMotion()
  const isDone = state === 'completed'

  if (!isDone || !result) {
    return (
      <motion.section
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18, ease: [0.2, 0.7, 0.2, 1] }}
        aria-live="polite"
        aria-busy="true"
        className="relative overflow-hidden rounded-2xl border border-accent/30 bg-bg-elev-1 px-7 py-6"
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[2px] overflow-hidden rounded-t-2xl"
        >
          <span
            className="absolute top-0 h-full w-1/3 rounded-full bg-accent"
            style={{ animation: 'rd-reading-cursor 1.4s var(--ease-out) infinite' }}
          />
        </span>
        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">
          Thinking
        </div>
        <h3 className="mt-1.5 font-display text-[20px] leading-[1.3] text-ink">
          Sketching the areas I&apos;ll track for you…
        </h3>
      </motion.section>
    )
  }

  const angles = result.angles
  const count = angles.length
  const headline = `${countWord(count)} areas I'll track for you`

  return (
    <motion.section
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: [0.2, 0.7, 0.2, 1] }}
      className="overflow-hidden rounded-2xl border border-line bg-bg-elev-1 shadow-[0_1px_2px_rgba(42,38,32,0.04),0_8px_32px_rgba(42,38,32,0.06)]"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-start justify-between gap-4 px-7 pb-2 pt-6 text-left"
      >
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">
            Tracking for you
          </div>
          <h3 className="mt-1.5 font-display text-[22px] leading-[1.28] text-ink">
            {headline}
          </h3>
        </div>
        <div className="flex flex-shrink-0 items-start gap-3">
          <div className="whitespace-nowrap text-right text-[11px] leading-[1.6] tabular-nums text-ink-faint">
            <strong className="font-medium text-ink-soft">{count}</strong> areas
            <br />
            inferred
          </div>
          <ChevronDown
            size={16}
            className={
              'mt-[3px] text-ink-faint transition-transform duration-[var(--dur-sm)] ' +
              (open ? 'rotate-180' : 'rotate-0')
            }
          />
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="items"
            initial={reduceMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{
              height: { duration: 0.24, ease: [0.2, 0.7, 0.2, 1] },
              opacity: { duration: 0.18, ease: 'easeOut' },
            }}
            style={{ overflow: 'hidden' }}
          >
            <div className="px-7 pb-5 pt-2">
              {angles.map((a, i) => (
                <div
                  key={i}
                  className={
                    'flex items-baseline gap-4 py-[14px] ' +
                    (i < angles.length - 1 ? 'border-b border-line' : '')
                  }
                >
                  <div className="w-6 flex-shrink-0 font-display text-[14px] tabular-nums text-ink-faint">
                    {String(i + 1).padStart(2, '0')}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-display text-[18px] leading-[1.32] text-ink">
                      {a.text}
                    </div>
                    <div className="mt-1 text-[13px] italic leading-[1.55] text-ink-dim">
                      {a.rationale}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-line px-7 py-3">
              <div className="text-[11px] italic text-ink-faint">
                Tell me which to drop, rename, or add.
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.section>
  )
}
