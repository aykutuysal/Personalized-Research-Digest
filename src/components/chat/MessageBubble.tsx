'use client'

import type { UIMessage } from 'ai'
import { motion } from 'framer-motion'

export interface MessageBubbleProps {
  message: UIMessage
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user'

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: [0.2, 0.7, 0.2, 1] }}
      className={isUser ? 'flex justify-end' : 'flex justify-start'}
    >
      <div
        className={
          isUser
            ? 'max-w-[80%] rounded-xl bg-accent-soft text-ink px-4 py-2 text-[16px] leading-[1.65]'
            : 'max-w-[85%] text-ink text-[16px] leading-[1.65] whitespace-pre-wrap'
        }
      >
        {message.parts?.map((part, idx) => {
          if (part.type === 'text') {
            return <span key={idx}>{part.text}</span>
          }
          // Tool parts are rendered in Task 32.
          return null
        })}
      </div>
    </motion.div>
  )
}
