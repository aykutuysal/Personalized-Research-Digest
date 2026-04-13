'use client'

import { ToolCallCard, type ToolCallState } from './ToolCallCard'

export interface AngleProposalCardProps {
  state: ToolCallState
  result?: { angles: Array<{ text: string; rationale: string }> }
}

export function AngleProposalCard({ state, result }: AngleProposalCardProps) {
  const count = result?.angles.length ?? 0

  const detail =
    result && count > 0 ? (
      <ul className="flex flex-col gap-3">
        {result.angles.map((a, i) => (
          <li key={i}>
            <div className="text-ink text-[15px]">{a.text}</div>
            <div className="text-ink-dim text-[13px]">{a.rationale}</div>
          </li>
        ))}
      </ul>
    ) : null

  return (
    <ToolCallCard
      state={state}
      pendingLabel="Sketching the things I'll track for you…"
      completedLabel={`${count} areas proposed`}
      detail={detail}
    />
  )
}
