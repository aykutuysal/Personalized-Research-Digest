'use client'

import { memo } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'

export interface MarkdownTextProps {
  text: string
}

const components: Components = {
  p: ({ children }) => (
    <p className="my-2 first:mt-0 last:mb-0">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="my-2 list-disc space-y-1 pl-5">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="my-2 list-decimal space-y-1 pl-5">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-[1.55]">{children}</li>,
  strong: ({ children }) => (
    <strong className="font-semibold text-ink">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
  code: ({ className, children }) => {
    const isBlock = typeof className === 'string' && className.startsWith('language-')
    if (isBlock) {
      return <code className={className}>{children}</code>
    }
    return (
      <code className="rounded bg-bg-elev-2 px-1 py-0.5 text-[0.9em] font-mono">
        {children}
      </code>
    )
  },
  pre: ({ children }) => (
    <pre className="my-3 overflow-x-auto rounded-md bg-bg-elev-2 p-3 text-[14px] font-mono">
      {children}
    </pre>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-accent underline underline-offset-2 hover:text-accent-hover"
    >
      {children}
    </a>
  ),
  h1: ({ children }) => (
    <h1 className="mt-3 mb-1 text-[19px] font-semibold text-ink">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-3 mb-1 text-[18px] font-semibold text-ink">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-3 mb-1 text-[17px] font-semibold text-ink">{children}</h3>
  ),
  hr: () => <hr className="my-4 border-line" />,
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-2 border-line-strong pl-3 italic text-ink-soft">
      {children}
    </blockquote>
  ),
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto">
      <table className="w-full border-collapse text-[14px]">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-line px-2 py-1 text-left font-semibold">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-line px-2 py-1 align-top">{children}</td>
  ),
}

function MarkdownTextImpl({ text }: MarkdownTextProps) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {text}
    </ReactMarkdown>
  )
}

export const MarkdownText = memo(MarkdownTextImpl)
