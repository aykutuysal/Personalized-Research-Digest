// src/lib/session.ts
import { cookies } from 'next/headers'

const COOKIE_NAME = 'rd_session'
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365

function uuid(): string {
  // crypto.randomUUID is available in Node 19+ and the browser.
  return (globalThis.crypto?.randomUUID?.() ??
    // Fallback, ≈ v4 format, non-cryptographic.
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0
      const v = c === 'x' ? r : (r & 0x3) | 0x8
      return v.toString(16)
    }))
}

/** Server-side: read the session id, creating + setting it if absent. */
export async function getOrCreateSession(): Promise<string> {
  const store = await cookies()
  const existing = store.get(COOKIE_NAME)?.value
  if (existing) return existing
  const id = uuid()
  store.set(COOKIE_NAME, id, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: ONE_YEAR_SECONDS,
  })
  return id
}

/** Server-side: read the session id, or null if absent. */
export async function getSession(): Promise<string | null> {
  const store = await cookies()
  return store.get(COOKIE_NAME)?.value ?? null
}
