// src/components/plan/PreviewSection.tsx
'use client'

import type { DigestConfig, Schedule } from '@/lib/config-schema'

export interface PreviewSectionProps {
  config: DigestConfig
  stale: boolean
  onPreviewSettled: () => void
  onScheduleSet: (s: Schedule) => void
  onSubscribe: () => void
}

export function PreviewSection({ stale }: PreviewSectionProps) {
  return (
    <div className="rounded-2xl border border-line bg-bg-elev-1 p-6">
      <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-accent">
        Preview
      </div>
      <div className="mt-2 text-[14px] text-ink-faint">
        Preview section placeholder (implemented in later tasks). {stale ? 'Plan has pending edits.' : ''}
      </div>
    </div>
  )
}
