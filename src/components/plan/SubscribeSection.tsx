// src/components/plan/SubscribeSection.tsx
'use client'

import { useState } from 'react'
import { subscribableConfigSchema, type DigestConfig } from '@/lib/config-schema'

export interface SubscribeSectionProps {
  config: DigestConfig
  onSubscribe: () => void
}

export function SubscribeSection({ config, onSubscribe }: SubscribeSectionProps) {
  const [errors, setErrors] = useState<Array<{ path: string; message: string }> | null>(null)
  const [saved, setSaved] = useState(false)

  const click = () => {
    const now = new Date().toISOString()
    const candidate = {
      ...config,
      created_at: config.created_at || now,
      updated_at: now,
    }
    const parsed = subscribableConfigSchema.safeParse(candidate)
    if (!parsed.success) {
      setErrors(
        parsed.error.issues.map((i) => ({
          path: i.path.join('.') || '(root)',
          message: i.message,
        })),
      )
      return
    }
    setErrors(null)
    setSaved(true)
    onSubscribe()
    // Placeholder: no persistence, no auth. Toast for 4s.
    setTimeout(() => setSaved(false), 4000)
  }

  return (
    <div className="rounded-2xl border border-line bg-bg-elev-1 p-6">
      <button
        onClick={click}
        className="w-full rounded-xl border border-accent bg-accent px-6 py-3 font-display text-[18px] text-bg hover:bg-accent/90"
      >
        Subscribe to get this on your cadence
      </button>

      {errors && (
        <ul className="mt-4 space-y-1 text-[13px] text-accent">
          {errors.map((e, i) => (
            <li key={i}>
              <strong>{e.path}:</strong> {e.message}
            </li>
          ))}
        </ul>
      )}

      {saved && (
        <p className="mt-4 text-[14px] text-ink-soft">
          Subscription coming soon — your plan is saved for this session.
        </p>
      )}
    </div>
  )
}
