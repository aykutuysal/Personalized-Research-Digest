'use client'

import { useEffect, useState } from 'react'

// A small vocabulary that narrates the reader's mind at work. The word
// swaps every ~1.4s, which is the motion — driven by React state so the
// global prefers-reduced-motion rule in globals.css can't freeze it.
const PHRASES = ['Reading', 'Pondering', 'Weighing', 'Drafting'] as const

export function ThinkingIndicator() {
  const [i, setI] = useState(0)

  useEffect(() => {
    const id = window.setInterval(
      () => setI((n) => (n + 1) % PHRASES.length),
      1400,
    )
    return () => window.clearInterval(id)
  }, [])

  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Thinking"
      className="inline-flex items-baseline text-[16px] text-ink-dim"
    >
      <span
        aria-hidden
        className="font-display italic tracking-[-0.005em] inline-block"
        style={{ minWidth: '10ch' }}
      >
        {PHRASES[i]}
      </span>
      <span
        aria-hidden
        className="font-display italic text-accent ml-0.5"
      >
        |
      </span>
      <span className="sr-only">Thinking</span>
    </div>
  )
}
