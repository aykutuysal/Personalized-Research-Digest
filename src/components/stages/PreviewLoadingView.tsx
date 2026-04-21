// src/components/stages/PreviewLoadingView.tsx
'use client'
import type { ProgressState } from '@/lib/ai/preview/map-progress-to-stage'
import { STAGE_LABELS } from '@/lib/ai/preview/map-progress-to-stage'

export interface PreviewLoadingViewProps {
  subject: string
  totalAreas: number
  state: ProgressState
}

export function PreviewLoadingView({ subject, totalAreas, state }: PreviewLoadingViewProps) {
  const pct = Math.max(4, Math.min(100, (state.done / STAGE_LABELS.length) * 100))

  return (
    <div className="mx-auto max-w-[720px] px-12 py-16">
      <header className="mb-7 border-b border-ink pb-7 text-center">
        <div className="mb-[18px] flex items-center justify-center gap-[14px]">
          <span className="h-px flex-1 max-w-[80px] bg-line-strong" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-accent">
            Preview Issue · {subject}
          </span>
          <span className="h-px flex-1 max-w-[80px] bg-line-strong" />
        </div>
        <h1 className="font-display text-[38px] font-medium tracking-[-0.01em] text-ink">
          Going to press
          <span className="ml-1 inline-block h-[0.9em] w-[2px] animate-[rd-blink_1s_steps(2)_infinite] align-[-3px] bg-accent" />
        </h1>
        <p className="mx-auto mt-[14px] max-w-[500px] font-display text-[15.5px] italic leading-[1.55] text-ink-dim">
          We&apos;re pulling together a sample of how your digest will read. This usually takes about twenty seconds.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-6 py-2 pb-8 text-center">
        <Stat n={state.papersScanned} label="Papers scanned" />
        <Stat n={`${state.areasDone} / ${totalAreas}`} label="Areas checked" />
      </section>

      <div className="relative h-[2px] overflow-hidden rounded-[1px] bg-line">
        <div
          className="absolute left-0 top-0 bottom-0 rounded-[1px] bg-accent transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      <ol className="mt-0">
        {STAGE_LABELS.map((label, i) => {
          const st =
            i < state.done ? 'done' : i === state.running ? 'running' : 'pending'
          return <StageRow key={label} label={label} state={st} />
        })}
      </ol>

      <p className="mt-7 text-center font-display text-[13px] italic text-ink-faint">
        Leave this open. We&apos;ll land the preview right here when it&apos;s ready.
      </p>
    </div>
  )
}

function Stat({ n, label }: { n: number | string; label: string }) {
  return (
    <div>
      <div className="font-display text-[32px] font-medium leading-none tabular-nums text-ink">
        {n}
      </div>
      <div className="mt-[6px] text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
        {label}
      </div>
    </div>
  )
}

function StageRow({ label, state }: { label: string; state: 'done' | 'running' | 'pending' }) {
  const markClass =
    state === 'done'
      ? 'bg-accent border-accent after:content-["✓"] after:text-bg after:text-[10px]'
      : state === 'running'
        ? 'border-accent animate-[rd-pulse_1.2s_ease-in-out_infinite] bg-[radial-gradient(circle_at_center,var(--accent)_3px,transparent_4px)]'
        : 'border-line-strong bg-transparent'

  const labelClass =
    state === 'running'
      ? 'text-accent font-medium'
      : state === 'pending'
        ? 'text-ink-faint italic'
        : 'text-ink-soft'

  const meta = state === 'done' ? 'done' : state === 'running' ? 'in progress' : ''

  return (
    <li className="grid grid-cols-[20px_1fr_auto] items-center gap-3 border-t border-line px-0 py-[10px] font-display text-[15px] first:border-t-0 first:pt-[14px]">
      <span className={`flex h-4 w-4 items-center justify-center rounded-full border ${markClass}`} />
      <span className={labelClass}>{label}</span>
      <span className="text-[11px] tracking-[0.04em] tabular-nums text-ink-faint">{meta}</span>
    </li>
  )
}
