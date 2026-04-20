// src/components/plan/PreviewSection.tsx
'use client'

import { useState } from 'react'
import type { DigestConfig, Schedule, SearchQuery } from '@/lib/config-schema'
import type { ReferencePaper } from '@/lib/ai/preview/progress-events'
import { PreviewRunningState } from './PreviewRunningState'
import { PreviewReadyState } from './PreviewReadyState'
import { CadenceSection } from './CadenceSection'
import { SubscribeSection } from './SubscribeSection'

interface ReadyPayload {
  body: string
  references: ReferencePaper[]
  queries: SearchQuery[]
  papersScanned: number
  generatedAt: string
}

export interface PreviewSectionProps {
  config: DigestConfig
  stale: boolean                               // parent toggles this when any field edits
  onPreviewSettled: () => void                 // parent clears stale flag when preview arrives
  onScheduleSet: (s: Schedule) => void
  onSubscribe: () => void
}

export function PreviewSection({
  config,
  stale,
  onPreviewSettled,
  onScheduleSet,
  onSubscribe,
}: PreviewSectionProps) {
  const [running, setRunning] = useState(false)
  const [ready, setReady] = useState<ReadyPayload | null>(null)
  const [error, setError] = useState<string | null>(null)

  // If parent marks stale, surface the previous preview as stale.
  const effectiveStale = stale && !!ready

  const handleDone = (p: {
    body: string
    references: ReferencePaper[]
    queries: SearchQuery[]
    papersScanned: number
  }) => {
    setRunning(false)
    setReady({
      body: p.body,
      references: p.references,
      queries: p.queries,
      papersScanned: p.papersScanned,
      generatedAt: new Date().toISOString(),
    })
    onPreviewSettled()
  }

  const handleError = (message: string) => {
    setRunning(false)
    setError(message)
  }

  const kickoff = () => {
    setError(null)
    setRunning(true)
  }

  // Only show cadence + subscribe once preview is ready AND not stale.
  const showCadence = !!ready && !effectiveStale && !running && !error

  return (
    <div className="flex flex-col gap-6">
      {!ready && !running && !error && (
        <button
          onClick={kickoff}
          className="rounded-2xl border border-accent bg-accent px-8 py-4 text-center font-display text-[18px] text-bg hover:bg-accent/90"
        >
          Preview your digest
        </button>
      )}

      {running && (
        <PreviewRunningState
          config={config}
          onDone={handleDone}
          onError={handleError}
        />
      )}

      {error && !running && (
        <div className="rounded-2xl border border-line bg-bg-elev-1 p-6">
          <div className="text-[12px] uppercase tracking-[0.16em] text-accent">Couldn&apos;t finish</div>
          <p className="mt-2 max-w-prose text-[14px] text-ink-soft">{error}</p>
          <button
            onClick={kickoff}
            className="mt-4 rounded-lg border border-accent px-3 py-1.5 text-[12px] uppercase tracking-[0.16em] text-accent hover:bg-accent-soft"
          >
            Try again
          </button>
        </div>
      )}

      {ready && !running && (
        <PreviewReadyState
          config={config}
          body={ready.body}
          references={ready.references}
          papersScanned={ready.papersScanned}
          stale={effectiveStale}
          onRegenerate={kickoff}
        />
      )}

      {showCadence && (
        <CadenceSection
          timezoneDefault={Intl.DateTimeFormat().resolvedOptions().timeZone}
          schedule={config.schedule}
          onScheduleSet={onScheduleSet}
        />
      )}

      {showCadence && config.schedule && (
        <SubscribeSection config={config} onSubscribe={onSubscribe} />
      )}
    </div>
  )
}
