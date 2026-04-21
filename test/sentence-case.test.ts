import { describe, it, expect } from 'vitest'
import { sentenceCase } from '@/lib/ui/sentence-case'

describe('sentenceCase', () => {
  it('capitalizes the first letter only', () => {
    expect(sentenceCase('tool-augmented language models')).toBe(
      'Tool-augmented language models',
    )
  })
  it('preserves acronyms already in caps', () => {
    expect(sentenceCase('retrieval-augmented generation (RAG) for agents')).toBe(
      'Retrieval-augmented generation (RAG) for agents',
    )
  })
  it('passes through single-word strings', () => {
    expect(sentenceCase('agents')).toBe('Agents')
  })
  it('handles empty string', () => {
    expect(sentenceCase('')).toBe('')
  })
  it('is a no-op when already sentence-cased', () => {
    expect(sentenceCase('Agent evaluation')).toBe('Agent evaluation')
  })
})
