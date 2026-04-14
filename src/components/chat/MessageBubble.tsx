// src/components/chat/MessageBubble.tsx
'use client'

import { motion } from 'framer-motion'
import type { ResearchChatMessage } from '@/lib/ai/chat-types'
import { AngleProposalCard } from './AngleProposalCard'
import { ScheduleCard } from './ScheduleCard'
import { MarkdownText } from './MarkdownText'
import type { ToolCallState } from './ToolCallCard'

export interface MessageBubbleProps {
  message: ResearchChatMessage
}

type ToolPartState =
  | 'input-streaming'
  | 'input-available'
  | 'approval-requested'
  | 'approval-responded'
  | 'output-available'
  | 'output-error'
  | 'output-denied'

function mapState(state: ToolPartState): ToolCallState {
  if (state === 'output-available' || state === 'output-error' || state === 'output-denied') {
    return 'completed'
  }
  if (state === 'input-available' || state === 'approval-requested' || state === 'approval-responded') {
    return 'running'
  }
  return 'pending'
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user'
  const parts = message.parts ?? []

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: [0.2, 0.7, 0.2, 1] }}
      className={isUser ? 'flex justify-end' : 'flex flex-col gap-3'}
    >
      {isUser ? (
        <div className="max-w-[80%] rounded-xl bg-accent-soft text-ink px-4 py-2 text-[16px] leading-[1.65]">
          {parts.map((part, idx) =>
            part.type === 'text' ? <span key={idx}>{part.text}</span> : null,
          )}
        </div>
      ) : (
        parts.map((part, idx) => {
          if (part.type === 'text') {
            if (part.text.trim().length === 0) return null
            return (
              <div
                key={idx}
                className="max-w-[85%] text-ink text-[16px] leading-[1.65]"
              >
                <MarkdownText text={part.text} />
              </div>
            )
          }

          if (part.type === 'tool-proposeAngles') {
            return (
              <AngleProposalCard
                key={idx}
                state={mapState(part.state)}
                result={part.state === 'output-available' ? part.output : undefined}
              />
            )
          }
          if (part.type === 'tool-normalizeSchedule') {
            return (
              <ScheduleCard
                key={idx}
                state={mapState(part.state)}
                result={part.state === 'output-available' ? part.output : undefined}
              />
            )
          }
          // tool-generateConfig transitions the whole UI in ChatShell.
          return null
        })
      )}
    </motion.div>
  )
}
