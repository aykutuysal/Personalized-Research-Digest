// src/lib/storage/local.ts
import type { ResearchChatMessage } from '@/lib/ai/chat-types'
import type { DigestConfig } from '@/lib/config-schema'

const KEY = 'rd:onboarding:v1'
const SCHEMA_VERSION = 1 as const

export interface OnboardingLocalState {
  schemaVersion: typeof SCHEMA_VERSION
  sessionId: string
  messages: ResearchChatMessage[]
  configDraft: Partial<DigestConfig>
  finalConfig?: DigestConfig
  lastUpdated: string
}

export function loadOnboardingState(): OnboardingLocalState | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as OnboardingLocalState
    if (parsed.schemaVersion !== SCHEMA_VERSION) {
      window.localStorage.removeItem(KEY)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function saveOnboardingState(state: OnboardingLocalState): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ ...state, schemaVersion: SCHEMA_VERSION, lastUpdated: new Date().toISOString() }),
    )
  } catch {
    /* storage blocked — ignore */
  }
}

export function clearOnboardingState(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}

export function newOnboardingState(sessionId: string): OnboardingLocalState {
  return {
    schemaVersion: SCHEMA_VERSION,
    sessionId,
    messages: [],
    configDraft: {},
    lastUpdated: new Date().toISOString(),
  }
}
