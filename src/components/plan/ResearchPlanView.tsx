// src/components/plan/ResearchPlanView.tsx
'use client'

import type { DigestConfig } from '@/lib/config-schema'

export interface ResearchPlanViewProps {
  initialConfig: DigestConfig
  onReset: () => void
}

export function ResearchPlanView({ initialConfig, onReset }: ResearchPlanViewProps) {
  return (
    <div className="p-8">
      <h2 className="font-display text-[32px] text-ink">Your Research Plan (stub)</h2>
      <pre className="mt-4 text-[12px] text-ink-faint overflow-auto max-h-[60vh]">
        {JSON.stringify(initialConfig, null, 2)}
      </pre>
      <button
        onClick={onReset}
        className="mt-6 rounded-lg border border-line bg-bg-elev-1 px-4 py-2 text-[14px] text-ink hover:border-line-strong"
      >
        Start over
      </button>
    </div>
  )
}
