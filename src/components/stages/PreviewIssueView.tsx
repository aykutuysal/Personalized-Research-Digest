'use client'
import { useCallback, useEffect, useRef } from 'react'
import { PreviewSidebar } from './PreviewSidebar'
import { SourceCard } from './SourceCard'
import { MarkdownText } from '@/components/chat/MarkdownText'
import type { ReferencePaper } from '@/lib/ai/preview/progress-events'
import type { DigestConfig } from '@/lib/config-schema'

export interface PreviewIssueViewProps {
  config: DigestConfig
  body: string
  references: ReferencePaper[]
  papersScanned: number
  onStart: () => void
}

export function PreviewIssueView({
  config,
  body,
  references,
  papersScanned,
  onStart,
}: PreviewIssueViewProps) {
  const onCite = useCallback((n: number) => {
    const el = document.getElementById(`source-${n}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.classList.add('!border-accent')
      setTimeout(() => el.classList.remove('!border-accent'), 1500)
    }
  }, [])

  return (
    <div className="grid min-h-screen grid-cols-[280px_1fr] max-[900px]:grid-cols-1">
      <PreviewSidebar
        papersScanned={papersScanned}
        totalAreas={config.research_areas.length}
        papersSelected={references.length}
        ctaLabel="Start my digest →"
        onCta={onStart}
        ctaHelper={<span>Set your schedule next. Change anything, anytime.</span>}
      />

      <article className="mx-auto max-w-[680px] px-12 py-11">
        <header className="mb-8 border-b border-ink pb-6 text-center">
          <div className="mb-[18px] flex items-center justify-center gap-[14px]">
            <span className="h-px flex-1 max-w-[80px] bg-line-strong" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-accent">
              Preview Issue · {config.subject} · {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
            <span className="h-px flex-1 max-w-[80px] bg-line-strong" />
          </div>
          <h1 className="font-display text-[36px] font-medium leading-[1.12] tracking-[-0.01em] text-ink">
            A sample issue,<br />in your voice.
          </h1>
          <p className="mx-auto mt-4 max-w-[460px] font-display text-[15.5px] italic leading-[1.55] text-ink-dim">
            How your {config.subject} digest would read: voice, structure, paper-picking, in a single issue.
          </p>
        </header>

        <div className="font-display text-[15px] leading-[1.65] text-ink">
          <MarkdownWithCitations body={body} onCite={onCite} />
        </div>

        <section className="mt-9">
          <div className="mb-[10px] text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
            Sources in this sample
          </div>
          {references.map((p, i) => (
            <SourceCard key={p.id} n={i + 1} paper={p} />
          ))}
        </section>

        <section className="mt-11 rounded border border-line-strong bg-bg-elev-1 p-8 text-center">
          <h3 className="mb-1 font-display text-[22px] font-medium tracking-[-0.005em] text-ink">
            Ready for the real thing?
          </h3>
          <p className="mb-4 font-display text-[14px] italic text-ink-dim">
            Pick your schedule and your first full digest goes out on it.
          </p>
          <button
            onClick={onStart}
            className="rounded-[3px] bg-accent px-8 py-3 text-[12px] font-semibold uppercase tracking-[0.08em] text-accent-ink hover:bg-accent-hover"
          >
            Start my digest →
          </button>
        </section>
      </article>
    </div>
  )
}

function MarkdownWithCitations({ body, onCite }: { body: string; onCite: (n: number) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const root = ref.current
    if (!root) return
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    const nodes: Text[] = []
    while (walker.nextNode()) nodes.push(walker.currentNode as Text)
    const RE = /\[(\d+)\]/g
    for (const node of nodes) {
      const text = node.nodeValue ?? ''
      if (!RE.test(text)) continue
      RE.lastIndex = 0
      const frag = document.createDocumentFragment()
      let lastIdx = 0
      let m: RegExpExecArray | null
      while ((m = RE.exec(text)) !== null) {
        if (m.index > lastIdx) frag.appendChild(document.createTextNode(text.slice(lastIdx, m.index)))
        const btn = document.createElement('button')
        btn.type = 'button'
        btn.textContent = `[${m[1]}]`
        btn.className =
          'mx-[2px] inline-block rounded-[3px] bg-accent-soft px-[5px] py-[1px] align-baseline text-[10px] font-semibold text-accent hover:bg-accent-soft/70'
        btn.setAttribute('aria-label', `Go to source ${m[1]}`)
        const n = parseInt(m[1], 10)
        btn.addEventListener('click', () => onCite(n))
        frag.appendChild(btn)
        lastIdx = m.index + m[0].length
      }
      if (lastIdx < text.length) frag.appendChild(document.createTextNode(text.slice(lastIdx)))
      node.replaceWith(frag)
    }
  }, [body, onCite])

  return (
    <div ref={ref}>
      <MarkdownText text={body} />
    </div>
  )
}
