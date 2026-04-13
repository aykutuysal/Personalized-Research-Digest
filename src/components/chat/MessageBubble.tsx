// src/components/chat/MessageBubble.tsx
'use client'

import type { UIMessage } from 'ai'
import { motion } from 'framer-motion'
import { AngleProposalCard } from './AngleProposalCard'
import { ScheduleCard } from './ScheduleCard'
import { SanityCheckCard } from './SanityCheckCard'
import type { ToolCallState } from './ToolCallCard'

export interface MessageBubbleProps {
  message: UIMessage
}

type ToolPart = {
  type: string
  toolCallId?: string
  state?: string
  input?: unknown
  output?: unknown
  errorText?: string
}

function mapState(state: string | undefined): ToolCallState {
  if (!state) return 'pending'
  if (state === 'output-available' || state === 'output-error' || state === 'output-denied') {
    return 'completed'
  }
  if (state === 'input-available' || state === 'approval-requested' || state === 'approval-responded') {
    return 'running'
  }
  // 'input-streaming'
  return 'pending'
}

type AngleProposalResult = { angles: Array<{ text: string; rationale: string }> }
type ScheduleResult =
  | { ok: true; cron: string; timezone: string; description: string; nextThreeFires: string[] }
  | { ok: false; error: string; suggestion?: string }
type SanityCheckResult = {
  results: Array<{
    angleText: string
    count30d: number
    papersPerRun: number
    verdict: 'healthy' | 'sparse' | 'empty' | 'error'
    sampleTitles?: string[]
  }>
}

function extractOutput<T>(part: ToolPart): T | undefined {
  return part.state === 'output-available' ? (part.output as T) : undefined
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user'

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: [0.2, 0.7, 0.2, 1] }}
      className={isUser ? 'flex justify-end' : 'flex flex-col gap-3'}
    >
      {isUser ? (
        <div className="max-w-[80%] rounded-xl bg-accent-soft text-ink px-4 py-2 text-[16px] leading-[1.65]">
          {message.parts?.map((part, idx) =>
            part.type === 'text' ? <span key={idx}>{(part as any).text}</span> : null,
          )}
        </div>
      ) : (
        message.parts?.map((part, idx) => {
          if (part.type === 'text') {
            return (
              <div
                key={idx}
                className="max-w-[85%] text-ink text-[16px] leading-[1.65] whitespace-pre-wrap"
              >
                {(part as any).text}
              </div>
            )
          }

          const typed = part as unknown as ToolPart
          const callState = mapState(typed.state)

          if (typed.type === 'tool-proposeAngles') {
            return (
              <AngleProposalCard
                key={idx}
                state={callState}
                result={extractOutput<AngleProposalResult>(typed)}
              />
            )
          }
          if (typed.type === 'tool-normalizeSchedule') {
            return (
              <ScheduleCard
                key={idx}
                state={callState}
                result={extractOutput<ScheduleResult>(typed)}
              />
            )
          }
          if (typed.type === 'tool-corpusSanityCheck') {
            return (
              <SanityCheckCard
                key={idx}
                state={callState}
                result={extractOutput<SanityCheckResult>(typed)}
              />
            )
          }
          // generateConfig transitions the whole UI; handled in Task 33.
          return null
        })
      )}
    </motion.div>
  )
}
