'use client'

export function ThinkingIndicator() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Thinking"
      className="relative inline-flex items-center text-ink-dim text-[16px] leading-[1.65]"
    >
      <span className="relative inline-block overflow-hidden pr-0.5">
        Thinking
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 w-[2px] bg-accent rounded-full"
          style={{
            boxShadow: '0 0 6px 1px var(--accent)',
            animation: 'rd-reading-cursor 1.6s var(--ease-out) infinite',
          }}
        />
      </span>
      <span className="sr-only">Thinking</span>
    </div>
  )
}
