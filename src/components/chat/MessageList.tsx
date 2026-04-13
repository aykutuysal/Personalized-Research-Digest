'use client'

import { useLayoutEffect, useRef } from 'react'
import type { ResearchChatMessage } from '@/lib/ai/chat-types'
import { MessageBubble } from './MessageBubble'
import { ThinkingIndicator } from './ThinkingIndicator'

export interface MessageListProps {
  messages: ResearchChatMessage[]
  isThinking: boolean
}

export function MessageList({ messages, isThinking }: MessageListProps) {
  const turnRefs = useRef<Array<HTMLElement | null>>([])

  // Group consecutive messages into "turns": each user message starts a new turn
  // and collects the immediately following assistant responses.
  const turns: Array<{ key: string; items: ResearchChatMessage[] }> = []
  for (const m of messages) {
    if (m.role === 'user' || turns.length === 0) {
      turns.push({ key: m.id, items: [m] })
    } else {
      turns[turns.length - 1].items.push(m)
    }
  }

  useLayoutEffect(() => {
    const last = turnRefs.current[turns.length - 1]
    if (!last) return
    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches
    last.scrollIntoView({
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
      block: 'start',
    })
  }, [turns.length])

  return (
    <div
      className="mx-auto w-full px-6 pt-6"
      style={{ maxWidth: 'var(--reading-width)' }}
    >
      <div className="flex flex-col gap-10">
        {turns.map((turn, idx) => (
          <section
            key={turn.key}
            ref={(el) => {
              turnRefs.current[idx] = el
            }}
            className="flex flex-col gap-4 scroll-mt-6"
            style={{
              minHeight:
                idx === turns.length - 1
                  ? 'calc(100dvh - var(--header-h) - var(--composer-h) - var(--safe-bottom) - 48px)'
                  : undefined,
            }}
          >
            {turn.items.map((m) => (
              <MessageBubble key={m.id} message={m} />
            ))}
            {idx === turns.length - 1 && isThinking ? (
              <ThinkingIndicator />
            ) : null}
          </section>
        ))}
      </div>
    </div>
  )
}
