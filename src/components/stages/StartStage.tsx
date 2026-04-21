'use client'
import { useState } from 'react'
import type { DigestConfig, Plan, Schedule } from '@/lib/config-schema'
import { buildSchedule, type Cadence } from '@/lib/schedule/build-cron'
import { buildScheduleSummary, nextDeliveryDate } from '@/lib/ui/schedule-summary'
import { StickyFooterCta } from './StickyFooterCta'
import { StartedView } from './StartedView'

export interface StartStageProps {
  config: DigestConfig
  onChange: (patch: Partial<DigestConfig>) => void
  onCommit: (finalized: DigestConfig & { schedule: Schedule }) => void
}

const PRICE: Record<Plan, { display: string; cta: string; under: string }> = {
  monthly: { display: '$19 / month', cta: '$19 / MONTH', under: '$19 a month' },
  yearly:  { display: '$149 / year', cta: '$149 / YEAR', under: '$149 a year' },
}

export function StartStage({ config, onChange, onCommit }: StartStageProps) {
  const [cadence, setCadence] = useState<Cadence>('weekly')
  const [dayOfWeek, setDayOfWeek] = useState<number>(2) // Tue
  const [time, setTime] = useState('09:00')
  const [tz, setTz] = useState<string>(config.schedule?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone)
  const [email, setEmail] = useState<string>(config.email ?? '')
  const [plan, setPlan] = useState<Plan>(config.plan ?? 'yearly')
  const [started, setStarted] = useState<null | { when: string; price: string; email: string }>(null)

  const summary = buildScheduleSummary({
    cadence,
    dayOfWeek,
    time,
    timezone: tz,
    plan,
    email: email || 'your inbox',
  })

  const commit = () => {
    const s = buildSchedule({ cadence, dayOfWeek: dayOfWeek as 0 | 1 | 2 | 3 | 4 | 5 | 6, time, timezone: tz })
    const next: DigestConfig & { schedule: Schedule } = { ...config, plan, email, schedule: s }
    onChange({ plan, email, schedule: s })
    onCommit(next)
    const when = nextDeliveryDate({ cadence, dayOfWeek, time, timezone: tz }).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    setStarted({ when, price: PRICE[plan].under, email })
  }

  if (started) {
    return <StartedView email={started.email} whenLabel={started.when} priceLabel={started.price} />
  }

  const canCommit = !!email && /\S+@\S+\.\S+/.test(email)

  return (
    <div className="mx-auto flex min-h-0 max-w-[720px] flex-1 flex-col overflow-y-auto px-12 py-16 pb-40">
      <div className="font-sans text-[10px] font-semibold uppercase tracking-[0.22em] text-accent">Final step</div>
      <div className="my-[10px] font-display text-[46px] font-medium leading-[1.1] tracking-[-0.015em] text-ink">Start your digest.</div>
      <p className="mb-10 max-w-[540px] font-display text-[16px] italic leading-[1.55] text-ink-dim">
        Pick when, where, and your plan. You can change any of it anytime.
      </p>

      {/* When section */}
      <section className="border-t border-line-strong py-[26px]">
        <SectionHead label="When" hint="Daily, weekly, or monthly. You pick the time." />
        <div className="flex flex-wrap gap-2">
          {(['daily', 'weekdays', 'weekly', 'monthly'] as Cadence[]).map((c) => (
            <button
              key={c}
              onClick={() => setCadence(c)}
              className={`rounded-full border px-[18px] py-[10px] text-[13px] font-medium capitalize ${
                cadence === c
                  ? 'bg-accent border-accent text-accent-ink'
                  : 'border-line-strong text-ink-soft hover:border-accent hover:text-accent'
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="mt-[18px] flex flex-wrap gap-5 items-end">
          {cadence === 'weekly' && (
            <SubField label="Day">
              <div className="flex gap-[6px]">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => (
                  <button
                    key={d}
                    onClick={() => setDayOfWeek(i)}
                    className={`flex h-10 w-10 items-center justify-center rounded-full border text-[12px] font-medium ${
                      dayOfWeek === i ? 'bg-accent border-accent text-accent-ink' : 'border-line-strong text-ink-soft hover:border-accent hover:text-accent'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </SubField>
          )}
          <SubField label="Time">
            <select value={time} onChange={(e) => setTime(e.target.value)} className="rounded border border-line-strong bg-bg-elev-1 px-[14px] py-[9px] font-display text-[16px] text-ink outline-none focus:border-accent">
              {['07:00', '08:00', '09:00', '10:00', '18:00'].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </SubField>
          <SubField label="Timezone">
            <select value={tz} onChange={(e) => setTz(e.target.value)} className="rounded border border-line-strong bg-bg-elev-1 px-[14px] py-[9px] font-display text-[16px] text-ink outline-none focus:border-accent">
              <option value={tz}>{tz}</option>
              <option value="UTC">UTC</option>
              <option value="America/New_York">America/New_York</option>
              <option value="Europe/London">Europe/London</option>
              <option value="Asia/Tokyo">Asia/Tokyo</option>
            </select>
          </SubField>
        </div>
      </section>

      {/* Plan section */}
      <section className="border-t border-line-strong py-[26px]">
        <SectionHead label="Plan" hint="Switch between monthly and yearly anytime." />
        <div className="grid grid-cols-2 gap-3 max-[600px]:grid-cols-1">
          <PlanCard planKey="monthly" active={plan === 'monthly'} onClick={() => setPlan('monthly')} price="$19" per="/ month" sub="Billed every month." />
          <PlanCard planKey="yearly" active={plan === 'yearly'} onClick={() => setPlan('yearly')} price="$149" per="/ year" sub="Works out to $12.42/month, billed yearly." saveChip="Save 35%" />
        </div>
      </section>

      {/* Where section */}
      <section className="border-t border-line-strong py-[26px]">
        <SectionHead label="Where" hint="We'll send each issue here." />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full min-w-[280px] max-w-[460px] rounded border border-line-strong bg-bg-elev-1 px-[14px] py-[9px] font-display text-[16px] text-ink outline-none focus:border-accent"
        />
      </section>

      {/* Summary */}
      <div className="mt-10 rounded border border-line-strong bg-bg-elev-1 p-6">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">So that&apos;s</div>
        <p className="font-display text-[17px] leading-[1.55] text-ink">{summary}</p>
        <div className="mt-4 flex items-center gap-3 rounded border border-dashed border-line-strong bg-bg p-[10px_12px] text-[12px] italic text-ink-faint">
          <span className="h-2 w-2 rounded-full bg-line-strong" />
          Payment details collected on the next step. Cancel anytime, no questions.
        </div>
      </div>

      <StickyFooterCta
        label={`Start my digest · ${PRICE[plan].cta}`}
        onClick={commit}
        disabled={!canCommit}
        helper={<span>Cancel anytime in settings. Your plan and schedule stay editable.</span>}
      />
    </div>
  )
}

function SectionHead({ label, hint }: { label: string; hint: string }) {
  return (
    <div className="mb-4 flex items-baseline justify-between gap-6">
      <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">{label}</span>
      <span className="text-[11px] italic text-ink-faint">{hint}</span>
    </div>
  )
}

function SubField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-[6px]">
      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-faint">{label}</span>
      {children}
    </div>
  )
}

function PlanCard(props: {
  planKey: Plan
  active: boolean
  onClick: () => void
  price: string
  per: string
  sub: string
  saveChip?: string
}) {
  return (
    <button
      onClick={props.onClick}
      className={`relative rounded border p-[20px_22px] text-left ${
        props.active
          ? 'border-accent bg-bg-elev-1 shadow-[0_0_0_1px_var(--accent)]'
          : 'border-line-strong bg-bg-elev-1 hover:border-ink-faint'
      }`}
    >
      <span className={`absolute right-[22px] top-[20px] block h-[18px] w-[18px] rounded-full border ${props.active ? 'border-accent bg-[radial-gradient(circle_at_center,var(--accent)_5px,var(--bg)_6px)]' : 'border-line-strong bg-bg'}`} />
      <div className="flex items-baseline justify-between pr-6">
        <span className="font-display text-[20px] font-medium capitalize">{props.planKey}</span>
        {props.saveChip && (
          <span className="rounded bg-accent-soft px-2 py-[3px] text-[10px] font-semibold uppercase tracking-[0.12em] text-accent">{props.saveChip}</span>
        )}
      </div>
      <div className="mt-[10px] font-display text-[36px] font-medium leading-none text-ink">
        {props.price}<span className="ml-1 font-sans text-[14px] italic text-ink-faint">{props.per}</span>
      </div>
      <div className="mt-[6px] text-[11px] text-ink-faint">{props.sub}</div>
    </button>
  )
}
