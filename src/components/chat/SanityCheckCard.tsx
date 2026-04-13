'use client'

import { ToolCallCard, type ToolCallState } from './ToolCallCard'

type Verdict = 'healthy' | 'sparse' | 'empty' | 'error'

export interface SanityCheckCardProps {
  state: ToolCallState
  result?: {
    results: Array<{
      angleText: string
      count30d: number
      papersPerRun: number
      verdict: Verdict
      sampleTitles?: string[]
    }>
  }
}

export function SanityCheckCard({ state, result }: SanityCheckCardProps) {
  const items = result?.results ?? []
  const nonHealthy = items.filter((r) => r.verdict !== 'healthy')
  const healthy = items.filter((r) => r.verdict === 'healthy')
  const hasWarnings = nonHealthy.length > 0

  const completedLabel = hasWarnings
    ? `${nonHealthy.length} area${nonHealthy.length === 1 ? '' : 's'} look sparse — take a look`
    : 'All areas look healthy'

  const detail =
    items.length > 0 ? (
      <div className="flex flex-col gap-3">
        {nonHealthy.map((r, i) => (
          <div
            key={i}
            className="rounded-lg border border-warn/40 bg-warn-soft px-3 py-2"
          >
            <div className="text-ink text-[14px] font-medium">{r.angleText}</div>
            <div className="text-ink-dim text-[12px]">
              ~{r.papersPerRun.toFixed(1)} papers/run · {r.verdict}
            </div>
            {r.sampleTitles && r.sampleTitles.length > 0 ? (
              <ul className="mt-1 list-disc pl-4 text-ink-dim text-[12px]">
                {r.sampleTitles.map((t, j) => (
                  <li key={j}>{t}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ))}
        {healthy.length > 0 ? (
          <p className="text-ink-dim text-[13px]">
            {healthy.length} other area{healthy.length === 1 ? '' : 's'} look good.
          </p>
        ) : null}
      </div>
    ) : null

  return (
    <ToolCallCard
      state={state}
      pendingLabel="Checking how active each area is…"
      completedLabel={completedLabel}
      autoExpand={hasWarnings}
      detail={detail}
    />
  )
}
