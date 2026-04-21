import { describe, it, expect } from 'vitest'
import { parseMarkdownList, serializeMarkdownList } from '@/lib/ui/markdown'

describe('parseMarkdownList', () => {
  it('parses a numbered list into items', () => {
    const md =
      '1. First. Body of first.\n2. Second. Body of second.\n3. Third. Body of third.'
    expect(parseMarkdownList(md)).toEqual([
      { lead: 'First.', body: 'Body of first.' },
      { lead: 'Second.', body: 'Body of second.' },
      { lead: 'Third.', body: 'Body of third.' },
    ])
  })
  it('treats the lead as the text before the first period (not including it in body)', () => {
    const md = '1. Hello. World.'
    expect(parseMarkdownList(md)).toEqual([{ lead: 'Hello.', body: 'World.' }])
  })
  it('tolerates extra blank lines between items', () => {
    const md = '1. A. B.\n\n2. C. D.'
    expect(parseMarkdownList(md)).toEqual([
      { lead: 'A.', body: 'B.' },
      { lead: 'C.', body: 'D.' },
    ])
  })
  it('falls back to a single item when there is no number prefix', () => {
    expect(parseMarkdownList('Just a sentence.')).toEqual([
      { lead: '', body: 'Just a sentence.' },
    ])
  })
  it('serializes a round-trip equal to the input', () => {
    const items = [
      { lead: 'First.', body: 'Body of first.' },
      { lead: 'Second.', body: 'Body of second.' },
    ]
    const md = serializeMarkdownList(items)
    expect(md).toBe('1. First. Body of first.\n2. Second. Body of second.')
    expect(parseMarkdownList(md)).toEqual(items)
  })
})
