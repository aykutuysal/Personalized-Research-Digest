'use client'

import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { LayoutGroup, motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ConfigSummary } from '@/components/config/ConfigSummary'
import type { DigestConfig } from '@/lib/config-schema'
import { Composer } from './Composer'
import { MessageList } from './MessageList'

export interface ChatShellProps {
  initialMode: 'hero' | 'docked'
}

export function ChatShell({ initialMode }: ChatShellProps) {
  const router = useRouter()
  const [input, setInput] = useState('')
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: '/api/onboarding-chat' }),
  })

  const isThinking = status === 'submitted' || status === 'streaming'

  const finalConfig: DigestConfig | null = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i]
      if (!m.parts) continue
      for (const p of m.parts) {
        const tp = p as unknown as { type: string; state?: string; output?: { ok?: boolean; config?: DigestConfig } }
        if (
          tp.type === 'tool-generateConfig' &&
          tp.state === 'output-available' &&
          tp.output?.ok === true &&
          tp.output.config
        ) {
          return tp.output.config
        }
      }
    }
    return null
  })()

  const onReset = () => {
    try {
      localStorage.removeItem('rd:onboarding:v1')
      sessionStorage.removeItem('rd:pending-first-message')
    } catch {
      /* ignore */
    }
    router.push('/')
  }

  // When mounted in docked mode, pick up any pending first message from /.
  useEffect(() => {
    if (initialMode !== 'docked') return
    try {
      const pending = sessionStorage.getItem('rd:pending-first-message')
      if (pending && pending.length > 0) {
        sessionStorage.removeItem('rd:pending-first-message')
        sendMessage({ text: pending })
      }
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMode])

  const onSubmit = () => {
    if (input.trim().length === 0) return
    if (initialMode === 'hero') {
      try {
        sessionStorage.setItem('rd:pending-first-message', input.trim())
      } catch {
        /* ignore */
      }
      router.push('/onboarding')
    } else {
      const text = input.trim()
      setInput('')
      sendMessage({ text })
    }
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

  if (finalConfig) {
    return <ConfigSummary config={finalConfig} onReset={onReset} />
  }

  return (
    <LayoutGroup>
      <div className="min-h-dvh flex flex-col">
        <div className="flex-1 overflow-y-auto">
          <MessageList messages={messages} isThinking={isThinking} />
        </div>
        <div
          className="sticky bottom-0 w-full pb-[var(--safe-bottom)] pt-4 bg-gradient-to-t from-bg via-bg to-transparent"
          style={{ minHeight: 'var(--composer-h)' }}
        >
          <div className="px-6">
            <Composer
              value={input}
              onChange={setInput}
              onSubmit={onSubmit}
              size="docked"
              disabled={isThinking}
            />
          </div>
        </div>
      </div>
    </LayoutGroup>
  )
}
