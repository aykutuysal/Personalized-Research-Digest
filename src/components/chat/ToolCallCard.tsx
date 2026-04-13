'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { useState, type ReactNode } from 'react'

export type ToolCallState = 'pending' | 'running' | 'completed'

export interface ToolCallCardProps {
  state: ToolCallState
  pendingLabel: string
  completedLabel: string
  autoExpand?: boolean
  detail?: ReactNode
}

export function ToolCallCard({
  state,
  pendingLabel,
  completedLabel,
  autoExpand = false,
  detail,
}: ToolCallCardProps) {
  const [open, setOpen] = useState(autoExpand)

  const isDone = state === 'completed'

  return (
    <motion.section
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: [0.2, 0.7, 0.2, 1] }}
      aria-live="polite"
      className={
        'relative rounded-xl border px-4 py-3 text-[14px] ' +
        (isDone
          ? 'border-line bg-bg-elev-1 text-ink-soft'
          : 'border-accent/30 bg-bg-elev-1 text-ink-dim')
      }
    >
      {!isDone ? (
        <span
          aria-hidden
          className="absolute top-0 left-0 h-[2px] w-1/3 bg-accent rounded-full"
          style={{ animation: 'rd-reading-cursor 1.2s var(--ease-out) infinite' }}
        />
      ) : null}

      <button
        type="button"
        className="flex w-full items-center justify-between gap-3"
        onClick={() => isDone && detail && setOpen((v) => !v)}
        aria-expanded={open}
        disabled={!isDone || !detail}
      >
        <span className="flex items-center gap-2">
          <span
            aria-hidden
            className={
              'inline-block h-1.5 w-1.5 rounded-full ' +
              (isDone ? 'bg-accent' : 'bg-accent animate-pulse')
            }
          />
          <h3 className="font-medium">
            {isDone ? completedLabel : pendingLabel}
          </h3>
        </span>
        {isDone && detail ? (
          <ChevronDown
            size={16}
            className={
              'transition-transform duration-[var(--dur-sm)] ' +
              (open ? 'rotate-180' : 'rotate-0')
            }
          />
        ) : null}
      </button>

      <AnimatePresence initial={false}>
        {open && detail ? (
          <motion.div
            key="detail"
            layout
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: [0.2, 0.7, 0.2, 1] }}
            className="mt-3 overflow-hidden"
          >
            {detail}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.section>
  )
}
