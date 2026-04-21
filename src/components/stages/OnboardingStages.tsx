'use client'
import { useState } from 'react'
import type { DigestConfig } from '@/lib/config-schema'
import { StageBreadcrumb, type StageId } from './StageBreadcrumb'
import { PlanStage } from './PlanStage'
import { PreviewStage } from './PreviewStage'
import { StartStage } from './StartStage'

export interface OnboardingStagesProps {
  initialConfig: DigestConfig
  sessionId?: string | null
}

export function OnboardingStages({ initialConfig, sessionId }: OnboardingStagesProps) {
  const [stage, setStage] = useState<StageId>('plan')
  const [config, setConfig] = useState<DigestConfig>(initialConfig)
  const [saved, setSaved] = useState(true)

  const patch = (partial: Partial<DigestConfig>) => {
    setConfig((c) => ({ ...c, ...partial, updated_at: new Date().toISOString() }))
    setSaved(false)
    queueMicrotask(() => setSaved(true)) // real save debounce is in storage layer
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <StageBreadcrumb current={stage} onNavigate={setStage} savedIndicator={stage === 'plan' && saved} />
      {stage === 'plan' && (
        <PlanStage config={config} onChange={patch} onContinue={() => setStage('preview')} />
      )}
      {stage === 'preview' && (
        <PreviewStage
          config={config}
          sessionId={sessionId}
          onBack={() => setStage('plan')}
          onStart={() => setStage('start')}
        />
      )}
      {stage === 'start' && (
        <StartStage
          config={config}
          onChange={patch}
          onCommit={() => {
            /* placeholder; real payment integration lives here later */
          }}
        />
      )}
    </div>
  )
}
