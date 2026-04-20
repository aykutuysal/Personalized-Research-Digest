// src/components/plan/MastheadEditor.tsx
'use client'

import { useState } from 'react'

export interface MastheadEditorProps {
  subject: string
  onChange: (value: string) => void
}

export function MastheadEditor({ subject, onChange }: MastheadEditorProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(subject)

  const commit = () => {
    const trimmed = draft.trim()
    if (trimmed.length > 0) onChange(trimmed)
    else setDraft(subject)
    setEditing(false)
  }

  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-accent">
        Your research plan
      </div>
      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit()
            if (e.key === 'Escape') {
              setDraft(subject)
              setEditing(false)
            }
          }}
          className="mt-2 block w-full bg-transparent font-display text-[40px] font-medium leading-[1.1] tracking-[-0.012em] text-ink outline-none border-b border-line-strong focus:border-accent"
        />
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="mt-2 block w-full text-left font-display text-[40px] font-medium leading-[1.1] tracking-[-0.012em] text-ink hover:text-ink-soft"
        >
          {subject}
        </button>
      )}
    </div>
  )
}
