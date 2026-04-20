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

function uuid(): string {
  // crypto.randomUUID is only available in secure contexts (HTTPS/localhost).
  // getRandomValues is available in insecure LAN dev — fall back to it.
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0'))
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`
}

export function newOnboardingState(): OnboardingLocalState {
  return {
    schemaVersion: SCHEMA_VERSION,
    sessionId: uuid(),
    messages: [],
    configDraft: {},
    lastUpdated: new Date().toISOString(),
  }
}
