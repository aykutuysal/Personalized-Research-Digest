// src/lib/ai/openrouter.ts
import 'server-only'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'

export const MODEL_ID = process.env.OPENROUTER_MODEL_ID ?? 'deepseek/deepseek-v3.2'

function getOpenRouter() {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY env var is required')
  }
  return createOpenRouter({ apiKey })
}

/**
 * Returns the configured DeepSeek v3.2 language model via OpenRouter.
 * Lazily initialized so tests can mock the provider without tripping the
 * env-var guard on import.
 *
 * `sessionId` is forwarded to OpenRouter via `extraBody.session_id` at model
 * construction time (the provider spreads `settings.extraBody` into the
 * request body). Passing it through `providerOptions` does not flatten
 * correctly and the field never reaches OpenRouter.
 */
export function deepseek(opts: { sessionId?: string | null } = {}) {
  const extraBody = opts.sessionId ? { session_id: opts.sessionId } : undefined
  return getOpenRouter()(MODEL_ID, {
    usage: { include: true },
    ...(extraBody ? { extraBody } : {}),
  })
}
