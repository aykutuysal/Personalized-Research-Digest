'use client'

import { LayoutGroup, motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Composer } from './Composer'

export interface ChatShellProps {
  initialMode: 'hero' | 'docked'
}

export function ChatShell({ initialMode }: ChatShellProps) {
  const router = useRouter()
  const [input, setInput] = useState('')

  const onSubmit = () => {
    // Store the first message for the onboarding page to pick up.
    try {
      sessionStorage.setItem('rd:pending-first-message', input.trim())
    } catch {
      /* ignore */
    }
    router.push('/onboarding')
  }

  if (initialMode === 'hero') {
    return (
      <LayoutGroup>
        <div className="min-h-dvh flex flex-col items-center justify-center px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.2, 0.7, 0.2, 1] }}
          >
            <h1 className="font-display text-[56px] leading-[1.05] sm:text-[72px] tracking-[-0.5px] text-ink">
              A research digest, written for you.
            </h1>
            <p className="mt-4 text-[18px] text-ink-soft">
              Describe what you want to track. I&apos;ll do the reading.
            </p>
          </motion.div>

          <div className="mt-10 w-full">
            <Composer
              value={input}
              onChange={setInput}
              onSubmit={onSubmit}
              size="hero"
            />
          </div>
        </div>
      </LayoutGroup>
    )
  }

  // Docked mode is wired in Task 28.
  return <DockedPlaceholder />
}

function DockedPlaceholder() {
  return <div className="p-6 text-ink-soft">Docked chat wired in Task 28.</div>
}
