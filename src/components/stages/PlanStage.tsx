'use client'

import type { DigestConfig, ResearchArea } from '@/lib/config-schema'
import { ResearchAreaChips } from '@/components/plan/ResearchAreaChips'
import { RichMarkdownList } from './RichMarkdownList'
import { StickyFooterCta } from './StickyFooterCta'

export interface PlanStageProps {
  config: DigestConfig
  onChange: (patch: Partial<DigestConfig>) => void
  onContinue: () => void
}

export function PlanStage({ config, onChange, onContinue }: PlanStageProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="mx-auto max-w-[var(--reading-width)] px-12 py-16 pb-12">
      <div className="font-sans text-[10px] font-semibold uppercase tracking-[0.22em] text-accent">
        Your research plan
      </div>

      <input
        value={config.subject}
        onChange={(e) => onChange({ subject: e.target.value })}
        className="my-[10px] w-full border-0 bg-transparent font-display text-[46px] font-medium leading-[1.1] tracking-[-0.015em] text-ink outline-none focus:bg-bg-elev-1"
      />

      <p className="mb-10 max-w-[600px] font-display text-[16px] italic leading-[1.55] text-ink-dim">
        This is how we&apos;ll pick and write each issue for you. Edit anything, then preview how one issue will read.
      </p>

      <PlanSection
        label="Who this is for"
        hint="Shapes which papers get picked."
      >
        <textarea
          rows={3}
          value={config.profile}
          onChange={(e) => onChange({ profile: e.target.value })}
          className="rd-scroll w-full resize-y border-0 bg-transparent p-0 font-display text-[16px] leading-[1.65] text-ink outline-none focus:bg-bg-elev-1 focus:outline-1 focus:outline-line focus:outline-offset-4"
        />
      </PlanSection>

      <PlanSection
        label="Research areas"
        hint="At least one paper candidate per area, every issue."
      >
        <ResearchAreaChips
          areas={config.research_areas}
          onChange={(areas: ResearchArea[]) => onChange({ research_areas: areas })}
        />
      </PlanSection>

      <PlanSection
        label="Format & Structure"
        hint="The shape of each issue. Uses a numbered list."
      >
        <RichMarkdownList
          value={config.format_structure}
          onChange={(format_structure) => onChange({ format_structure })}
        />
      </PlanSection>

      <PlanSection
        label="Voice & Language"
        hint="How each issue sounds."
      >
        <textarea
          rows={3}
          value={config.voice_language}
          onChange={(e) => onChange({ voice_language: e.target.value })}
          className="rd-scroll w-full resize-y border-0 bg-transparent p-0 font-display text-[16px] leading-[1.65] text-ink outline-none focus:bg-bg-elev-1 focus:outline-1 focus:outline-line focus:outline-offset-4"
        />
      </PlanSection>

        </div>
      </div>
      <StickyFooterCta
        label="Preview your digest"
        onClick={onContinue}
      />
    </div>
  )
}

function PlanSection({
  label,
  hint,
  children,
}: {
  label: string
  hint: string
  children: React.ReactNode
}) {
  return (
    <section className="border-t border-line-strong py-[26px]">
      <div className="mb-3 flex items-baseline justify-between gap-6">
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">{label}</span>
        <span className="text-[11px] italic text-ink-faint">{hint}</span>
      </div>
      {children}
    </section>
  )
}
