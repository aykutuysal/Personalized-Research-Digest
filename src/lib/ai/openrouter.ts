// src/lib/ai/openrouter.ts
import 'server-only'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'

export const MODEL_ID = 'deepseek/deepseek-v3.2'

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
 */
export function deepseek() {
  return getOpenRouter()(MODEL_ID)
}
