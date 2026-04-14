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
  const scrollerRef = useRef<HTMLDivElement | null>(null)
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
    const scroller = scrollerRef.current
    if (!scroller) return

    // Only the newest turn should be sized to fill the scroller — clear any
    // leftover inline minHeight on previously-last sections.
    for (const section of turnRefs.current) {
      if (section) section.style.minHeight = ''
    }

    const target = turnRefs.current[turns.length - 1]
    if (!target) return

    // Size the newest turn to fill the scroller minus the desired top offset,
    // so the scroll below isn't clamped short of placing the user bubble at
    // the top.
    const applyMinHeight = () => {
      target.style.minHeight = `${scroller.clientHeight - 24}px`
    }
    applyMinHeight()

    // Position the newest turn near the top of the scroller *without*
    // touching window scroll. scrollIntoView would walk up every scrollable
    // ancestor including <html>, which pulls the composer/header along.
    const scrollerRect = scroller.getBoundingClientRect()
    const targetRect = target.getBoundingClientRect()
    const top = scroller.scrollTop + (targetRect.top - scrollerRect.top) - 24

    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches
    scroller.scrollTo({
      top: Math.max(0, top),
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
    })

    const ro = new ResizeObserver(applyMinHeight)
    ro.observe(scroller)
    return () => ro.disconnect()
  }, [turns.length])

  return (
    <div
      ref={scrollerRef}
      className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain"
    >
      <div
        className="mx-auto w-full min-w-0 px-6 pt-10"
        style={{ maxWidth: 'var(--reading-width)' }}
      >
        <div className="flex flex-col gap-10">
          {turns.map((turn, idx) => (
            <section
              key={turn.key}
              ref={(el) => {
                turnRefs.current[idx] = el
              }}
              className="flex flex-col gap-4"
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
    </div>
  )
}
