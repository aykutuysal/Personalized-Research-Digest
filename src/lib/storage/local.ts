// src/lib/storage/local.ts
import type { ResearchChatMessage } from '@/lib/ai/chat-types'
import type { DigestConfig } from '@/lib/config-schema'

const KEY = 'rd:onboarding:v2'
const SCHEMA_VERSION = 3 as const

export interface OnboardingLocalState {
  schemaVersion: typeof SCHEMA_VERSION
  sessionId: string
  messages: ResearchChatMessage[]
  /** Populated once handoffToPlan fires; undefined during chat. */
  config?: DigestConfig
  lastUpdated: string
}

/**
 * Migrates a v2 stored payload that may still carry the old `output_style`
 * field (before the format_structure / voice_language schema split in Task 1).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function migrateFromV2(raw: any): any {
  if (!raw || typeof raw !== 'object') return raw
  const cfg = raw.config
  if (cfg && typeof cfg.output_style === 'string' && !cfg.format_structure) {
    cfg.format_structure = cfg.output_style
    cfg.voice_language = ''
    delete cfg.output_style
  }
  raw.schemaVersion = SCHEMA_VERSION
  return raw
}

export function loadOnboardingState(): OnboardingLocalState | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parsed = JSON.parse(raw) as any

    if (parsed.schemaVersion === 2) {
      const migrated = migrateFromV2(parsed) as OnboardingLocalState
      // Persist the migrated state immediately so next load is clean.
      window.localStorage.setItem(KEY, JSON.stringify(migrated))
      return migrated
    }

    if (parsed.schemaVersion !== SCHEMA_VERSION) {
      window.localStorage.removeItem(KEY)
      return null
    }
    return parsed as OnboardingLocalState
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
    lastUpdated: new Date().toISOString(),
  }
}
