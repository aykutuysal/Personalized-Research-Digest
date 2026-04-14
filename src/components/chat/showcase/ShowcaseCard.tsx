// src/components/chat/showcase/ShowcaseCard.tsx
'use client'

import { AnimatePresence, motion } from 'framer-motion'
import type { ResearchChatMessage } from '@/lib/ai/chat-types'
import { ShowcaseScanState } from './ShowcaseScanState'
import { ShowcaseLandedState } from './ShowcaseLandedState'

type MessagePart = NonNullable<ResearchChatMessage['parts']>[number]
type ShowcasePart = Extract<MessagePart, { type: 'tool-showcaseRecentPapers' }>

export interface ShowcaseCardProps {
  part: ShowcasePart
}

export function ShowcaseCard({ part }: ShowcaseCardProps) {
  // Silent skip on error / denial — render nothing.
  if (part.state === 'output-error' || part.state === 'output-denied') {
    return null
  }

  // Input not yet streamed — render nothing (no flash of empty card).
  if (part.state === 'input-streaming' || part.state === 'approval-requested' || part.state === 'approval-responded') {
    return null
  }

  if (part.state === 'output-available') {
    const out = part.output
    if (out.ok === false) return null // silent skip
    return (
      <motion.div layout transition={{ layout: { duration: 0.32, ease: [0.2, 0.7, 0.2, 1] } }}>
        <AnimatePresence mode="wait">
          <motion.div key="landed">
            <ShowcaseLandedState
              headline={out.headline}
              picks={out.picks}
              finalAngles={out.finalAngles}
              stats={out.stats}
            />
          </motion.div>
        </AnimatePresence>
      </motion.div>
    )
  }

  // input-available → tool is running
  const anglesFromInput =
    (part.input as { angles?: Array<{ id: number; text: string }> } | undefined)?.angles ?? []
  const litAngleIds = anglesFromInput.slice(0, 4).map((a) => a.id)

  return (
    <motion.div layout transition={{ layout: { duration: 0.32, ease: [0.2, 0.7, 0.2, 1] } }}>
      <AnimatePresence mode="wait">
        <motion.div key="scanning">
          <ShowcaseScanState angles={anglesFromInput} litAngleIds={litAngleIds} />
        </motion.div>
      </AnimatePresence>
    </motion.div>
  )
}
