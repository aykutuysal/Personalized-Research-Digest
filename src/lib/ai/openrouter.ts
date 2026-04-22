// src/lib/ai/openrouter.ts
import 'server-only'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'

// ---------------------------------------------------------------------------
// Per-scenario model selection.
//
// Each stage of the pipeline gets its own named helper so we can swap models
// independently (e.g. a cheap filter model vs. a premium curator model) by
// flipping env vars — no code change. Every helper falls back to a scenario-
// level default, and those defaults fall back to OPENROUTER_DEFAULT_MODEL_ID,
// which itself defaults to deepseek-v3.2 (cheap + fast for structured tasks).
// ---------------------------------------------------------------------------

const DEFAULT_MODEL_ID =
  process.env.OPENROUTER_DEFAULT_MODEL_ID ?? 'deepseek/deepseek-v3.2'

function modelIdFor(envVar: string, fallback = DEFAULT_MODEL_ID): string {
  return process.env[envVar] ?? fallback
}

function getOpenRouter() {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY env var is required')
  }
  return createOpenRouter({ apiKey })
}

/**
 * Build an OpenRouter language model for a specific pipeline role.
 *
 * `sessionId` is forwarded to OpenRouter via `extraBody.session_id` at model
 * construction time (the provider spreads `settings.extraBody` into the
 * request body). Passing it through `providerOptions` does not flatten
 * correctly and the field never reaches OpenRouter.
 */
function buildModel(modelId: string, sessionId: string | null | undefined) {
  const extraBody = sessionId ? { session_id: sessionId } : undefined
  return getOpenRouter()(modelId, {
    usage: { include: true },
    // Response-healing unwraps ```json fences and repairs malformed JSON that
    // some models return despite the system prompt. No-op when the model's
    // output is already valid, so it's safe to enable for every stage that
    // uses structured generation (filter, curator, seeds, proposals).
    // https://openrouter.ai/docs/guides/features/plugins/response-healing
    plugins: [{ id: 'response-healing' }],
    ...(extraBody ? { extraBody } : {}),
  })
}

// ---------------------------------------------------------------------------
// Named helpers. Add a new one whenever a new stage lands — don't reach for
// a generic "any model" helper.
// ---------------------------------------------------------------------------

/** Onboarding chat (streamText, multi-turn). */
export function onboardingModel(opts: { sessionId?: string | null } = {}) {
  return buildModel(
    modelIdFor('OPENROUTER_ONBOARDING_MODEL_ID'),
    opts.sessionId ?? null,
  )
}

/** `proposeResearchAreas` — structured generation of 6–12 research areas. */
export function proposalModel(opts: { sessionId?: string | null } = {}) {
  return buildModel(
    modelIdFor('OPENROUTER_PROPOSAL_MODEL_ID'),
    opts.sessionId ?? null,
  )
}

/** Legacy query planner (not on the current hot path). */
export function queryPlannerModel(opts: { sessionId?: string | null } = {}) {
  return buildModel(
    modelIdFor('OPENROUTER_QUERY_PLANNER_MODEL_ID'),
    opts.sessionId ?? null,
  )
}

/** Preview seed-query generator. */
export function seedsModel(opts: { sessionId?: string | null } = {}) {
  return buildModel(
    modelIdFor('OPENROUTER_SEEDS_MODEL_ID'),
    opts.sessionId ?? null,
  )
}

/** Preview compact-library builder (one query per research area). */
export function libraryModel(opts: { sessionId?: string | null } = {}) {
  return buildModel(
    modelIdFor('OPENROUTER_LIBRARY_MODEL_ID'),
    opts.sessionId ?? null,
  )
}

/** Preview relevance filter (keep/drop against profile). */
export function filterModel(opts: { sessionId?: string | null } = {}) {
  return buildModel(
    modelIdFor('OPENROUTER_FILTER_MODEL_ID'),
    opts.sessionId ?? null,
  )
}

/** Preview editorial curator. Defaults to a premium model by intent. */
export function curatorModel(opts: { sessionId?: string | null } = {}) {
  return buildModel(
    modelIdFor('OPENROUTER_CURATOR_MODEL_ID', 'openai/gpt-5.4'),
    opts.sessionId ?? null,
  )
}
