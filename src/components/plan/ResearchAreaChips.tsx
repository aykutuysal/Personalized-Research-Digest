// src/components/plan/ResearchAreaChips.tsx
'use client'

import { useState } from 'react'
import type { ResearchArea } from '@/lib/config-schema'

export interface ResearchAreaChipsProps {
  areas: ResearchArea[]
  onChange: (areas: ResearchArea[]) => void
}

function reId(areas: ResearchArea[]): ResearchArea[] {
  return areas.map((a, i) => ({ ...a, id: i + 1 }))
}

export function ResearchAreaChips({ areas, onChange }: ResearchAreaChipsProps) {
  const [editingId, setEditingId] = useState<number | null>(null)
  const [draft, setDraft] = useState('')
  const [adding, setAdding] = useState(false)

  const startEdit = (a: ResearchArea) => {
    setEditingId(a.id)
    setDraft(a.text)
  }

  const commitEdit = () => {
    if (editingId == null) return
    const trimmed = draft.trim()
    const next = areas.map((a) => (a.id === editingId ? { ...a, text: trimmed || a.text } : a))
    onChange(reId(next))
    setEditingId(null)
    setDraft('')
  }

  const remove = (id: number) => {
    const next = areas.filter((a) => a.id !== id)
    onChange(reId(next))
  }

  const startAdd = () => {
    setAdding(true)
    setDraft('')
  }

  const commitAdd = () => {
    const trimmed = draft.trim()
    if (trimmed.length > 0) {
      onChange(reId([...areas, { id: areas.length + 1, text: trimmed }]))
    }
    setAdding(false)
    setDraft('')
  }

  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-accent">
        Research areas
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {areas.map((a) =>
          editingId === a.id ? (
            <input
              key={a.id}
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitEdit()
                if (e.key === 'Escape') {
                  setDraft('')
                  setEditingId(null)
                }
              }}
              className="rounded-full border border-accent bg-bg-elev-1 px-3 py-1 text-[13px] text-ink outline-none"
            />
          ) : (
            <span
              key={a.id}
              className="inline-flex items-center gap-1 rounded-full border border-line bg-bg-elev-1 px-3 py-1 text-[13px] text-ink hover:border-line-strong"
            >
              <button onClick={() => startEdit(a)} className="text-left">
                {a.text}
              </button>
              <button
                onClick={() => remove(a.id)}
                aria-label={`Remove ${a.text}`}
                className="ml-1 text-ink-faint hover:text-ink"
              >
                ×
              </button>
            </span>
          ),
        )}
        {adding ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitAdd}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitAdd()
              if (e.key === 'Escape') {
                setAdding(false)
                setDraft('')
              }
            }}
            placeholder="new area"
            className="rounded-full border border-accent bg-bg-elev-1 px-3 py-1 text-[13px] text-ink outline-none"
          />
        ) : (
          <button
            onClick={startAdd}
            className="inline-flex items-center rounded-full border border-dashed border-line px-3 py-1 text-[13px] text-ink-faint hover:border-line-strong hover:text-ink"
          >
            + Add area
          </button>
        )}
      </div>
    </div>
  )
}
