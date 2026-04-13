// src/components/ui/Card.tsx
import type { HTMLAttributes } from 'react'

export function Card({ className = '', ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`bg-bg-elev-1 border border-line rounded-xl p-5 ${className}`.trim()}
      {...rest}
    />
  )
}
