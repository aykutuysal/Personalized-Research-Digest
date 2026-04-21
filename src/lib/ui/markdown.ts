export interface NumberedItem {
  lead: string  // first sentence (with trailing period)
  body: string  // remainder of the item
}

const LINE_RE = /^\s*\d+\.\s+(.*)$/

export function parseMarkdownList(src: string): NumberedItem[] {
  const lines = src
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

  const items: NumberedItem[] = []
  let current: string | null = null
  for (const line of lines) {
    const m = LINE_RE.exec(line)
    if (m) {
      if (current != null) items.push(splitLead(current))
      current = m[1]
    } else if (current != null) {
      current = current + ' ' + line
    } else {
      current = line
    }
  }
  if (current != null) items.push(splitLead(current))
  return items
}

function splitLead(raw: string): NumberedItem {
  const idx = raw.indexOf('. ')
  if (idx === -1) return { lead: '', body: raw.trim() }
  return {
    lead: raw.slice(0, idx + 1).trim(),
    body: raw.slice(idx + 2).trim(),
  }
}

export function serializeMarkdownList(items: NumberedItem[]): string {
  return items
    .map((it, i) => {
      const lead = it.lead ? it.lead + ' ' : ''
      return `${i + 1}. ${lead}${it.body}`.trim()
    })
    .join('\n')
}
