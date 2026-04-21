'use client'

export interface CitationChipProps {
  n: number
  onClick?: (n: number) => void
}

export function CitationChip({ n, onClick }: CitationChipProps) {
  return (
    <button
      type="button"
      onClick={() => onClick?.(n)}
      className="mx-[2px] inline-block rounded-[3px] bg-accent-soft px-[5px] py-[1px] align-baseline text-[10px] font-semibold text-accent hover:bg-accent-soft/70"
      aria-label={`Go to source ${n}`}
    >
      [{n}]
    </button>
  )
}
