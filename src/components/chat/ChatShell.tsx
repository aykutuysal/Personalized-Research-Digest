'use client'

import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { LayoutGroup, motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { ResearchPlanView } from '@/components/plan/ResearchPlanView'
import type { ResearchChatMessage } from '@/lib/ai/chat-types'
import type { DigestConfig } from '@/lib/config-schema'
import {
  clearOnboardingState,
  loadOnboardingState,
  newOnboardingState,
  saveOnboardingState,
} from '@/lib/storage/local'
import { Composer } from './Composer'
import { MessageList } from './MessageList'

const PENDING_KEY = 'rd:pending-first-message'

function readInitialMessages(mode: 'hero' | 'docked'): ResearchChatMessage[] {
  if (mode !== 'docked' || typeof window === 'undefined') return []
  try {
    // When arriving from the hero with a pending first message, start a clean
    // session — any previously saved conversation belongs to a different turn.
    const pending = window.sessionStorage.getItem(PENDING_KEY)
    if (pending && pending.length > 0) {
      clearOnboardingState()
      return []
    }
    return loadOnboardingState()?.messages ?? []
  } catch {
    return []
  }
}

export interface ChatShellProps {
  initialMode: 'hero' | 'docked'
}

export function ChatShell({ initialMode }: ChatShellProps) {
  const router = useRouter()
  const [input, setInput] = useState('')
  const [initialMessages] = useState<ResearchChatMessage[]>(() =>
    readInitialMessages(initialMode),
  )
  const [conversationId] = useState<string>(() => {
    if (typeof window === 'undefined') return ''
    const existing = loadOnboardingState()
    if (existing) return existing.sessionId
    const fresh = newOnboardingState()
    saveOnboardingState(fresh)
    return fresh.sessionId
  })
  const { messages, sendMessage, status } = useChat<ResearchChatMessage>({
    messages: initialMessages,
    transport: new DefaultChatTransport({
      api: '/api/onboarding-chat',
      body: { conversationId },
    }),
  })

  const isThinking = status === 'submitted' || status === 'streaming'

  // Persist messages to localStorage after each settled turn so the
  // conversation survives page refresh.
  useEffect(() => {
    if (initialMode !== 'docked') return
    if (status !== 'ready') return
    if (messages.length === 0) return
    try {
      const existing = loadOnboardingState() ?? newOnboardingState()
      saveOnboardingState({ ...existing, messages })
    } catch {
      /* ignore */
    }
  }, [initialMode, messages, status])

  const finalConfig = useMemo<DigestConfig | null>(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      for (const p of messages[i].parts ?? []) {
        if (p.type === 'tool-handoffToPlan' && p.state === 'output-available') {
          const out = p.output
          if (out.ok) {
            // handoffToPlan returns the pre-schedule subset; stamp metadata for
            // the DigestConfig shape ResearchPlanView expects.
            const now = new Date().toISOString()
            return {
              ...out.config,
              search_queries: [],
              version: 1,
              created_at: now,
              updated_at: now,
            } as DigestConfig
          }
        }
      }
    }
    return null
  }, [messages])

  // Persist finalConfig to localStorage once handoffToPlan fires.
  useEffect(() => {
    if (initialMode !== 'docked') return
    if (!finalConfig) return
    try {
      const existing = loadOnboardingState() ?? newOnboardingState()
      saveOnboardingState({ ...existing, config: finalConfig })
    } catch {
      /* ignore */
    }
  }, [initialMode, finalConfig])

  const onReset = () => {
    try {
      clearOnboardingState()
      sessionStorage.removeItem(PENDING_KEY)
    } catch {
      /* ignore */
    }
    router.push('/')
  }

  // When mounted in docked mode, pick up any pending first message from /.
  useEffect(() => {
    if (initialMode !== 'docked') return
    try {
      const pending = sessionStorage.getItem(PENDING_KEY)
      if (pending && pending.length > 0) {
        sessionStorage.removeItem(PENDING_KEY)
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
        sessionStorage.setItem(PENDING_KEY, input.trim())
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
    return <ResearchPlanView initialConfig={finalConfig} onReset={onReset} />
  }

  return (
    <LayoutGroup>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <MessageList messages={messages} isThinking={isThinking} />
        <div
          className="shrink-0 w-full px-6 pt-8 bg-gradient-to-t from-bg via-bg/95 to-transparent"
          style={{ paddingBottom: 'max(1.5rem, var(--safe-bottom))' }}
        >
          <Composer
            value={input}
            onChange={setInput}
            onSubmit={onSubmit}
            size="docked"
            disabled={isThinking}
          />
        </div>
      </div>
    </LayoutGroup>
  )
}
