'use client'

import { motion } from 'framer-motion'
import { SendHorizontal } from 'lucide-react'
import { forwardRef, useRef, type KeyboardEvent, type ChangeEvent } from 'react'

export interface ComposerProps {
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
  disabled?: boolean
  placeholder?: string
  size?: 'hero' | 'docked'
}

export const Composer = forwardRef<HTMLTextAreaElement, ComposerProps>(
  (
    { value, onChange, onSubmit, disabled = false, placeholder, size = 'hero' },
    ref,
  ) => {
    const innerRef = useRef<HTMLTextAreaElement | null>(null)

    const setRef = (node: HTMLTextAreaElement | null) => {
      innerRef.current = node
      if (typeof ref === 'function') ref(node)
      else if (ref) (ref as React.MutableRefObject<HTMLTextAreaElement | null>).current = node
    }

    const resize = () => {
      const el = innerRef.current
      if (!el) return
      el.style.height = 'auto'
      const max = 6 * 24 // ~6 rows
      el.style.height = `${Math.min(el.scrollHeight, max)}px`
    }

    const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
        e.preventDefault()
        if (!disabled && value.trim().length > 0) onSubmit()
      }
    }

    const onInput = (e: ChangeEvent<HTMLTextAreaElement>) => {
      onChange(e.target.value)
      resize()
    }

    const sizeCls =
      size === 'hero'
        ? 'max-w-[640px] text-[18px] p-5'
        : 'max-w-[var(--reading-width)] text-[16px] p-4'

    return (
      <motion.div
        layoutId="rd-composer"
        className={`mx-auto w-full ${sizeCls} rounded-2xl bg-bg-elev-1 border border-line focus-within:border-accent/60 focus-within:ring-4 focus-within:ring-accent-ring transition-[border-color,box-shadow] duration-[var(--dur-sm)]`}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="flex items-end gap-3">
          <textarea
            ref={setRef}
            value={value}
            onChange={onInput}
            onKeyDown={onKeyDown}
            rows={1}
            disabled={disabled}
            placeholder={placeholder ?? 'Tell me what you want to track…'}
            className="flex-1 resize-none bg-transparent outline-none placeholder:text-ink-faint"
          />
          <button
            type="button"
            onClick={() => !disabled && value.trim().length > 0 && onSubmit()}
            disabled={disabled || value.trim().length === 0}
            aria-label="Send"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-accent-ink transition-transform duration-[var(--dur-xs)] active:scale-[0.95] disabled:opacity-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-accent-ring"
          >
            <SendHorizontal size={18} />
          </button>
        </div>
      </motion.div>
    )
  },
)

Composer.displayName = 'Composer'
