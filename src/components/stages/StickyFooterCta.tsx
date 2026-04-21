'use client'
import type { ReactNode, MouseEventHandler } from 'react'

export interface StickyFooterCtaProps {
  label: string
  onClick: MouseEventHandler<HTMLButtonElement>
  helper?: ReactNode
  disabled?: boolean
}

export function StickyFooterCta({ label, onClick, helper, disabled }: StickyFooterCtaProps) {
  return (
    <div className="rd-sticky-footer">
      <div className="mx-auto flex max-w-[820px] flex-col items-center gap-2">
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          className="w-full max-w-[420px] rounded-[3px] bg-accent px-10 py-[18px] text-[14px] font-semibold uppercase tracking-[0.14em] text-accent-ink hover:bg-accent-hover disabled:opacity-50"
        >
          {label}
        </button>
        {helper && (
          <div className="font-display italic text-[13px] text-ink-faint">{helper}</div>
        )}
      </div>
    </div>
  )
}
