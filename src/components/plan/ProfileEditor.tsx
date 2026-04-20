// src/components/plan/ProfileEditor.tsx
'use client'

import { useState } from 'react'

export interface ProfileEditorProps {
  label: string              // e.g. 'WHO THIS IS FOR' or 'VOICE & FORMAT'
  value: string
  onChange: (next: string) => void
  italic?: boolean
}

export function ProfileEditor({ label, value, onChange, italic }: ProfileEditorProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  const commit = () => {
    const trimmed = draft.trim()
    if (trimmed.length > 0) onChange(trimmed)
    else setDraft(value)
    setEditing(false)
  }

  const bodyClass = `font-display text-[17px] leading-[1.6] text-ink max-w-prose ${italic ? 'italic' : ''}`

  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-accent">
        {label}
      </div>
      {editing ? (
        <textarea
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          rows={Math.max(3, Math.min(10, draft.split('\n').length + 1))}
          className={`mt-2 block w-full bg-transparent outline-none border-b border-line-strong focus:border-accent ${bodyClass}`}
        />
      ) : (
        <button
          onClick={() => setEditing(true)}
          className={`mt-2 block w-full text-left ${bodyClass} hover:text-ink-soft`}
        >
          {value}
        </button>
      )}
    </div>
  )
}
