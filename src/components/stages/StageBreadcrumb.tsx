'use client'

export type StageId = 'plan' | 'preview' | 'start'

const STAGES: Array<{ id: StageId; label: string }> = [
  { id: 'plan', label: 'Plan' },
  { id: 'preview', label: 'Preview' },
  { id: 'start', label: 'Start' },
]

export interface StageBreadcrumbProps {
  current: StageId
  onNavigate: (s: StageId) => void
  savedIndicator?: boolean
}

const ORDER: Record<StageId, number> = { plan: 0, preview: 1, start: 2 }

export function StageBreadcrumb({ current, onNavigate, savedIndicator }: StageBreadcrumbProps) {
  return (
    <div className="relative flex h-[var(--breadcrumb-h)] shrink-0 items-center justify-center border-b border-line bg-bg px-7">
      <nav className="flex items-center gap-0 text-[11px] uppercase tracking-[0.08em] text-ink-faint">
        {STAGES.map((s, i) => {
          const idx = ORDER[s.id]
          const curIdx = ORDER[current]
          const isCurrent = s.id === current
          const reachable = idx < curIdx
          return (
            <span key={s.id} className="flex items-center">
              {reachable ? (
                <button
                  onClick={() => onNavigate(s.id)}
                  className="text-ink-faint hover:text-accent"
                >
                  {s.label}
                </button>
              ) : (
                <span className={isCurrent ? 'font-semibold text-accent' : 'text-ink-faint'}>
                  {s.label}
                </span>
              )}
              {i < STAGES.length - 1 && (
                <span className="mx-[10px] text-line-strong">›</span>
              )}
            </span>
          )
        })}
      </nav>
      {savedIndicator && (
        <span className="absolute right-7 top-1/2 -translate-y-1/2 font-display text-[10px] italic uppercase tracking-[0.1em] text-ink-faint">
          Saved
        </span>
      )}
    </div>
  )
}
