// src/components/plan/ResearchPlanView.tsx
'use client'

import { useState, useCallback } from 'react'
import type { DigestConfig, ResearchArea } from '@/lib/config-schema'
import { MastheadEditor } from './MastheadEditor'
import { ProfileEditor } from './ProfileEditor'
import { ResearchAreaChips } from './ResearchAreaChips'
import { PreviewSection } from './PreviewSection'

export interface ResearchPlanViewProps {
  initialConfig: DigestConfig
  sessionId?: string | null
  onReset: () => void
}

export function ResearchPlanView({ initialConfig, sessionId, onReset }: ResearchPlanViewProps) {
  const [config, setConfig] = useState<DigestConfig>(initialConfig)
  const [previewStale, setPreviewStale] = useState(false)

  const patch = useCallback(
    (partial: Partial<DigestConfig>) => {
      setConfig((c) => ({
        ...c,
        ...partial,
        search_queries: [],
        schedule: undefined,
        updated_at: new Date().toISOString(),
      }))
      setPreviewStale(true)
    },
    [],
  )

  const setResearchAreas = useCallback(
    (areas: ResearchArea[]) => patch({ research_areas: areas }),
    [patch],
  )

  return (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
      <div
        className="mx-auto flex flex-col gap-10 px-6 py-10"
        style={{ maxWidth: '820px' }}
      >
        <MastheadEditor subject={config.subject} onChange={(subject) => patch({ subject })} />

        <ProfileEditor
          label="Who this is for"
          value={config.profile}
          onChange={(profile) => patch({ profile })}
        />

        <ResearchAreaChips areas={config.research_areas} onChange={setResearchAreas} />

        <ProfileEditor
          label="Format &amp; structure"
          value={config.format_structure}
          onChange={(format_structure) => patch({ format_structure })}
          italic
        />

        <ProfileEditor
          label="Voice &amp; language"
          value={config.voice_language}
          onChange={(voice_language) => patch({ voice_language })}
          italic
        />

        <PreviewSection
          config={config}
          sessionId={sessionId}
          stale={previewStale}
          onPreviewSettled={() => setPreviewStale(false)}
          onScheduleSet={(schedule) => setConfig((c) => ({ ...c, schedule }))}
          onSubscribe={() => {
            // SubscribeSection owns validation + toast; this prop is a future
            // hook for auth/persistence. Leave as a no-op for MVP.
          }}
        />

        <div className="pt-6">
          <button
            onClick={onReset}
            className="text-[12px] uppercase tracking-[0.16em] text-ink-faint hover:text-ink"
          >
            Start over
          </button>
        </div>
      </div>
    </div>
  )
}
