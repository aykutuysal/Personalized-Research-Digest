// src/components/stages/PreviewStage.tsx
'use client'
import { useEffect, useState } from 'react'
import type { DigestConfig, SearchQuery } from '@/lib/config-schema'
import type { ProgressEvent, ReferencePaper } from '@/lib/ai/preview/progress-events'
import { mapProgressToStage, type ProgressState } from '@/lib/ai/preview/map-progress-to-stage'
import { PreviewLoadingView } from './PreviewLoadingView'
import { PreviewIssueView } from './PreviewIssueView'
import { StickyFooterCta } from './StickyFooterCta'

export interface PreviewStageProps {
  config: DigestConfig
  sessionId?: string | null
  onBack: () => void
  onStart: () => void
}

interface ReadyPayload {
  body: string
  references: ReferencePaper[]
  queries: SearchQuery[]
  papersScanned: number
}

export function PreviewStage({ config, sessionId, onBack, onStart }: PreviewStageProps) {
  const [events, setEvents] = useState<ProgressEvent[]>([])
  const [ready, setReady] = useState<ReadyPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const state: ProgressState = mapProgressToStage(events, config.research_areas.length)

  useEffect(() => {
    const abort = new AbortController()
    // Reset stream state on (re)mount so Strict-Mode double-invoke restarts cleanly.
    setEvents([])
    setReady(null)
    setError(null)
    ;(async () => {
      try {
        const res = await fetch('/api/preview-digest', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(sessionId ? { 'x-session-id': sessionId } : {}),
          },
          body: JSON.stringify(config),
          signal: abort.signal,
        })
        if (!res.ok || !res.body) {
          setError(`HTTP ${res.status}`)
          return
        }
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffered = ''
        // Accumulate events locally so we can compute papersScanned at `done`
        // without relying on the stale closure over `events` state.
        const accumulated: ProgressEvent[] = []
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffered += decoder.decode(value, { stream: true })
          const frames = buffered.split('\n\n')
          buffered = frames.pop() ?? ''
          for (const frame of frames) {
            const line = frame.trim()
            if (!line.startsWith('data:')) continue
            let evt: ProgressEvent
            try { evt = JSON.parse(line.slice(5).trim()) } catch { continue }
            accumulated.push(evt)
            setEvents((prev) => prev.concat(evt))
            if (evt.kind === 'done') {
              const finalState = mapProgressToStage(accumulated, config.research_areas.length)
              setReady({
                body: evt.body,
                references: evt.references,
                queries: evt.queries,
                papersScanned: finalState.papersScanned,
              })
            }
            if (evt.kind === 'error') {
              setError(evt.message)
            }
          }
        }
      } catch (err) {
        if (abort.signal.aborted) return
        setError((err as Error).message ?? 'Network error')
      }
    })()
    return () => abort.abort()
  }, [config, sessionId])

  if (error && !ready) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="mx-auto flex max-w-[680px] flex-col gap-4 px-12 py-20">
            <div className="text-[12px] uppercase tracking-[0.16em] text-accent">Couldn&apos;t finish</div>
            <p className="font-display text-[15px] text-ink-soft">{error}</p>
            <button
              onClick={onBack}
              className="self-start rounded border border-line-strong px-4 py-2 text-[12px] uppercase tracking-[0.1em] text-ink-soft hover:border-accent hover:text-accent"
            >
              ← Edit plan
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!ready) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <PreviewLoadingView
            subject={config.subject}
            totalAreas={config.research_areas.length}
            state={state}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <PreviewIssueView
          config={config}
          body={ready.body}
          references={ready.references}
          papersScanned={ready.papersScanned}
          onStart={onStart}
        />
      </div>
      {/* Sticky footer CTA for mobile — desktop has sidebar CTA + end-of-article CTA */}
      <div className="hidden max-[900px]:block">
        <StickyFooterCta label="Start my digest" onClick={onStart} />
      </div>
    </div>
  )
}
