// src/components/ui/Chip.tsx
import type { HTMLAttributes } from 'react'

export function Chip({ className = '', ...rest }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={`inline-flex items-center rounded-md bg-bg-elev-2 px-2 py-1 text-[12px] font-medium uppercase tracking-wider text-ink-dim ${className}`.trim()}
      {...rest}
    />
  )
}
