// src/lib/session.ts
import { cookies } from 'next/headers'

const COOKIE_NAME = 'rd_session'
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365

/** Server-side: read the session id, creating + setting it if absent. */
export async function getOrCreateSession(): Promise<string> {
  const store = await cookies()
  const existing = store.get(COOKIE_NAME)?.value
  if (existing) return existing
  const id = crypto.randomUUID()
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
