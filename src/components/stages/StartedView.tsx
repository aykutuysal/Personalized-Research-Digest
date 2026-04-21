'use client'

export interface StartedViewProps {
  email: string
  whenLabel: string
  priceLabel: string
}

export function StartedView({ email, whenLabel, priceLabel }: StartedViewProps) {
  return (
    <div className="mx-auto max-w-[680px] px-12 py-20 text-center">
      <div className="mb-[18px] flex items-center justify-center gap-[14px]">
        <span className="h-px flex-1 max-w-[80px] bg-line-strong" />
        <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-accent">You&apos;re in</span>
        <span className="h-px flex-1 max-w-[80px] bg-line-strong" />
      </div>
      <h1 className="font-display text-[40px] font-medium leading-[1.12] tracking-[-0.01em] text-ink">
        Your digest starts {whenLabel}.
      </h1>
      <p className="mx-auto mt-4 max-w-[500px] font-display text-[16px] italic leading-[1.55] text-ink-dim">
        First issue lands in <span className="font-medium not-italic text-accent">{email}</span>. Billing: <span className="font-medium not-italic text-accent">{priceLabel}</span>.
      </p>
    </div>
  )
}
