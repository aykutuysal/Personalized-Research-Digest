import { describe, it, expect, beforeEach, vi } from 'vitest'
import { loadOnboardingState, saveOnboardingState, newOnboardingState } from '@/lib/storage/local'

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
  }
})()

const KEY = 'rd:onboarding:v2'

beforeEach(() => {
  localStorageMock.clear()
  vi.stubGlobal('window', { localStorage: localStorageMock })
})

describe('loadOnboardingState', () => {
  it('returns null when storage is empty', () => {
    expect(loadOnboardingState()).toBeNull()
  })

  it('returns null and removes data for unknown schema versions', () => {
    localStorageMock.setItem(KEY, JSON.stringify({ schemaVersion: 99 }))
    expect(loadOnboardingState()).toBeNull()
    expect(localStorageMock.getItem(KEY)).toBeNull()
  })

  it('returns state for current schema version (3)', () => {
    const state = newOnboardingState()
    localStorageMock.setItem(KEY, JSON.stringify(state))
    const loaded = loadOnboardingState()
    expect(loaded).not.toBeNull()
    expect(loaded?.schemaVersion).toBe(3)
  })

  it('migrates v2 state: copies output_style into format_structure, sets voice_language empty', () => {
    const v2State = {
      schemaVersion: 2,
      sessionId: 'abc-123',
      messages: [],
      lastUpdated: new Date().toISOString(),
      config: {
        subject: 'AI agents',
        profile: 'Engineer.',
        output_style: 'Concise. Technical.',
        research_areas: [{ id: 1, text: 'language models' }],
        search_queries: [],
      },
    }
    localStorageMock.setItem(KEY, JSON.stringify(v2State))

    const loaded = loadOnboardingState()
    expect(loaded).not.toBeNull()
    expect(loaded?.schemaVersion).toBe(3)
    expect(loaded?.config?.format_structure).toBe('Concise. Technical.')
    expect(loaded?.config?.voice_language).toBe('')
    // output_style must be gone
    expect((loaded?.config as Record<string, unknown>)?.output_style).toBeUndefined()
  })

  it('migrates v2 state with no config gracefully (no crash)', () => {
    const v2State = {
      schemaVersion: 2,
      sessionId: 'abc-456',
      messages: [],
      lastUpdated: new Date().toISOString(),
    }
    localStorageMock.setItem(KEY, JSON.stringify(v2State))

    const loaded = loadOnboardingState()
    expect(loaded).not.toBeNull()
    expect(loaded?.schemaVersion).toBe(3)
  })

  it('persists migrated state back to storage', () => {
    const v2State = {
      schemaVersion: 2,
      sessionId: 'abc-789',
      messages: [],
      lastUpdated: new Date().toISOString(),
      config: { output_style: 'Brief.' },
    }
    localStorageMock.setItem(KEY, JSON.stringify(v2State))
    loadOnboardingState()

    const persisted = JSON.parse(localStorageMock.getItem(KEY) ?? '{}')
    expect(persisted.schemaVersion).toBe(3)
  })
})

describe('saveOnboardingState', () => {
  it('always writes schemaVersion 3', () => {
    const state = newOnboardingState()
    saveOnboardingState(state)
    const stored = JSON.parse(localStorageMock.getItem(KEY) ?? '{}')
    expect(stored.schemaVersion).toBe(3)
  })
})
