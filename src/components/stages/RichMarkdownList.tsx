'use client'
import { useRef, useEffect } from 'react'
import { parseMarkdownList, serializeMarkdownList, type NumberedItem } from '@/lib/ui/markdown'

export interface RichMarkdownListProps {
  value: string
  onChange: (next: string) => void
}

export function RichMarkdownList({ value, onChange }: RichMarkdownListProps) {
  const ref = useRef<HTMLOListElement>(null)
  const items = parseMarkdownList(value)

  // Re-render the ol contents when `value` changes from outside.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (el.matches(':focus-within')) return // don't clobber while user is typing
    el.innerHTML = items
      .map(
        (it) =>
          `<li><strong>${escapeHtml(it.lead)}</strong> ${escapeHtml(it.body)}</li>`,
      )
      .join('')
  }, [value])

  const handleBlur = () => {
    const el = ref.current
    if (!el) return
    const next: NumberedItem[] = Array.from(el.children).map((li) => {
      const strong = li.querySelector('strong')
      const lead = strong?.textContent?.trim() ?? ''
      const full = li.textContent?.trim() ?? ''
      const body = strong ? full.replace(lead, '').trim() : full
      return { lead, body }
    })
    onChange(serializeMarkdownList(next))
  }

  return (
    <ol
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      onBlur={handleBlur}
      className="rd-scroll rd-mdlist cursor-text list-none pl-[22px] font-display text-[16px] leading-[1.7] text-ink outline-none"
      style={{ counterReset: 'sec' }}
    />
  )
}

function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}
