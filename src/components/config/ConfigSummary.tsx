'use client'

import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import type { DigestConfig } from '@/lib/config-schema'

export interface ConfigSummaryProps {
  config: DigestConfig
  onReset: () => void
}

export function ConfigSummary({ config, onReset }: ConfigSummaryProps) {
  const download = () => {
    const blob = new Blob([JSON.stringify(config, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'research-digest-config.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
      <div
        className="mx-auto flex flex-col gap-6 px-6 py-10"
        style={{ maxWidth: 'var(--reading-width)' }}
      >
        <h1 className="font-display text-[42px] leading-[1.15] text-ink">
          Your digest is ready to go.
        </h1>

      <Card>
        <h2 className="font-display text-[20px] text-ink">Subject</h2>
        <p className="mt-2 text-[18px] text-ink">{config.subject}</p>
      </Card>

      <Card>
        <h2 className="font-display text-[20px] text-ink">Schedule</h2>
        <p className="mt-2 text-[16px] text-ink">{config.schedule.description}</p>
        <p className="mt-1 text-[13px] text-ink-dim">
          Timezone: {config.schedule.timezone}
        </p>
      </Card>

      <Card>
        <h2 className="font-display text-[20px] text-ink">Areas I&apos;ll track</h2>
        <ul className="mt-3 flex flex-col gap-2">
          {config.core_angles.map((a) => (
            <li key={a.id} className="text-[15px] text-ink">
              {a.text}
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <h2 className="font-display text-[20px] text-ink">About you</h2>
        <p className="mt-2 whitespace-pre-wrap text-[15px] leading-[1.65] text-ink">
          {config.profile}
        </p>
      </Card>

      <Card>
        <h2 className="font-display text-[20px] text-ink">How I&apos;ll write it</h2>
        <p className="mt-2 whitespace-pre-wrap text-[15px] leading-[1.65] text-ink">
          {config.output_style}
        </p>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="primary" size="lg" onClick={download}>
          Download config (JSON)
        </Button>
        <Button variant="ghost" onClick={onReset}>
          Start a new digest
        </Button>
      </div>

        <p className="text-[13px] text-ink-faint">
          Saved in this browser for now. We&apos;ll hook it to your account in the next phase.
        </p>
      </div>
    </div>
  )
}
