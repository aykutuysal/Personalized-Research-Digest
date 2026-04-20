// src/components/plan/PreviewReadyState.tsx
'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { DigestConfig } from '@/lib/config-schema'
import type { ReferencePaper } from '@/lib/ai/preview/progress-events'
import { PaperRow } from '@/components/common/PaperRow'

export interface PreviewReadyStateProps {
  config: DigestConfig
  body: string
  references: ReferencePaper[]
  papersScanned: number
  stale: boolean
  onRegenerate: () => void
}

export function PreviewReadyState({
  config,
  body,
  references,
  papersScanned,
  stale,
  onRegenerate,
}: PreviewReadyStateProps) {
  const chipLabelFor = (ref: ReferencePaper, idx: number): string => {
    // Best-effort: map the reference to a research area by index-into-references.
    // References come back in citation order from the curator; we don't track
    // per-paper research_area_id reliably. Use a generic label.
    void ref
    void idx
    return 'THIS WEEK'
  }

  return (
    <div className={`rounded-2xl border border-line bg-bg-elev-1 p-6 ${stale ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-6">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-accent">
            Your digest · First read
          </div>
          <p className="mt-1 max-w-prose font-display text-[14px] italic text-ink-soft">
            Rendered in the format you asked for. Five papers this time — your real digest pulls from many more.
          </p>
        </div>
        <button
          onClick={onRegenerate}
          className={`shrink-0 rounded-lg border px-3 py-1.5 text-[12px] uppercase tracking-[0.16em] ${stale ? 'border-accent text-accent' : 'border-line text-ink-faint hover:border-line-strong hover:text-ink'}`}
        >
          {stale ? 'Preview again' : 'Regenerate'}
        </button>
      </div>

      {stale && (
        <div className="mt-4 rounded-lg border border-dashed border-accent bg-accent-soft/30 px-4 py-2 text-[13px] text-ink-soft">
          Your plan changed. This preview is from the previous version.
        </div>
      )}

      <article className="prose prose-neutral dark:prose-invert mt-6 max-w-prose font-display text-ink">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
      </article>

      <div className="mt-10">
        <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-accent">
          References
        </div>
        <div className="mt-4 flex flex-col gap-3">
          {references.map((ref, i) => (
            <PaperRow key={ref.id} index={i + 1} paper={ref} chipLabel={chipLabelFor(ref, i)} />
          ))}
        </div>
      </div>

      <div className="mt-10 grid gap-8 md:grid-cols-2">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-accent">
            This first read
          </div>
          <p className="mt-2 font-display text-[14px] leading-[1.6] text-ink">
            {papersScanned.toLocaleString()} papers scanned · {config.research_areas.length} research areas covered · {references.length} chosen for this sample
          </p>
          <p className="mt-2 font-display text-[13px] italic text-ink-soft">
            Your curator worked across abstracts, venues, and publication dates from the last 7 days.
          </p>
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-accent">
            What your real digest does differently
          </div>
          <ul className="mt-2 space-y-3 text-[14px] leading-[1.6] text-ink">
            <li>
              <strong className="font-display">Picks more papers.</strong> Your sections fill in properly — not just one or two papers per section, but the real field's output for the cycle.
            </li>
            <li>
              <strong className="font-display">Reads more carefully.</strong> Goes beyond abstracts, looks at who's citing whom, and notices threads that don't show up in a single pass.
            </li>
            <li>
              <strong className="font-display">Matches your voice better.</strong> The more digests you read, the more your curator writes the way you actually read.
            </li>
            <li>
              <strong className="font-display">Arrives on your cadence.</strong> In your inbox, when you asked for it.
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}
