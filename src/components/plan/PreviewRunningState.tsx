// src/components/plan/PreviewRunningState.tsx
'use client'

import { useEffect, useState } from 'react'
import type { DigestConfig } from '@/lib/config-schema'
import type { ProgressEvent, ReferencePaper } from '@/lib/ai/preview/progress-events'
import type { SearchQuery } from '@/lib/config-schema'

export interface PreviewRunningStateProps {
  config: DigestConfig
  sessionId?: string | null
  onDone: (payload: {
    body: string
    references: ReferencePaper[]
    queries: SearchQuery[]
    papersScanned: number
  }) => void
  onError: (message: string) => void
}

const STATUS_LINES = [
  'Picking seed queries…',
  'Pulling papers from OpenAlex…',
  'Reading what the field actually publishes…',
  'Building your search library…',
  'Checking each research area for this week…',
  'Filtering for what actually matches you…',
  'Writing your editorial…',
]

export function PreviewRunningState({ config, sessionId, onDone, onError }: PreviewRunningStateProps) {
  const [statusIdx, setStatusIdx] = useState(0)
  const [papersScanned, setPapersScanned] = useState(0)
  const [areasDone, setAreasDone] = useState<number>(0)

  // Cycle status lines every ~2s until we receive 'done' or 'error'.
  useEffect(() => {
    const i = setInterval(() => setStatusIdx((n) => (n + 1) % STATUS_LINES.length), 2000)
    return () => clearInterval(i)
  }, [])

  // Open the SSE connection on mount. React 19 strict mode double-invokes
  // this effect in dev; the first invocation's fetch is aborted by the
  // cleanup and swallowed in the catch below, so the second run is the one
  // that actually streams. In production there's only one mount, one fetch.
  useEffect(() => {
    const abort = new AbortController()
    ;(async () => {
      // Local counter — closure-stable, unlike `papersScanned` state.
      let scanned = 0
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
          const text = await res.text().catch(() => '')
          onError(`HTTP ${res.status}${text ? `: ${text.slice(0, 200)}` : ''}`)
          return
        }
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffered = ''
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
            try {
              evt = JSON.parse(line.slice(5).trim())
            } catch {
              continue
            }
            switch (evt.kind) {
              case 'seed-fetch-done':
                scanned = evt.papersScanned
                setPapersScanned(scanned)
                break
              case 'area-hit':
                scanned += evt.hits
                setAreasDone((n) => n + 1)
                setPapersScanned(scanned)
                break
              case 'done':
                onDone({
                  body: evt.body,
                  references: evt.references,
                  queries: evt.queries,
                  papersScanned: scanned,
                })
                return
              case 'error':
                onError(evt.message)
                return
            }
          }
        }
      } catch (err) {
        // Swallow aborts — they come from unmount (incl. React strict-mode
        // double-invoke in dev), not from the server or the network.
        if (abort.signal.aborted) return
        onError((err as Error).message ?? 'Network error')
      }
    })()

    return () => abort.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="rounded-2xl border border-line bg-bg-elev-1 p-6">
      <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-accent">
        First read in progress
      </div>
      <div className="mt-3 font-display text-[18px] italic text-ink">
        {STATUS_LINES[statusIdx]}
      </div>
      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-[12px] text-ink-faint">
        <span>{papersScanned.toLocaleString()} papers scanned</span>
        <span>
          {areasDone} / {config.research_areas.length} research areas checked
        </span>
      </div>
    </div>
  )
}
