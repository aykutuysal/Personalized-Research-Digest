// test/curator-model-sweep.test.ts
//
// Curator model sweep.
//
// Calls the preview curator (generateObject with the curator schema) against a
// fixed list of OpenRouter models using the same system prompt and composed
// user prompt the app produces, saves each model's body + metadata + cost to
// experiments/2026-04-22-curator-model-sweep/, and writes summary.{json,md}.
//
// Gated by RUN_CURATOR_SWEEP=1.

import { describe, it } from 'vitest'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

function loadEnvLocal() {
  try {
    const content = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const idx = trimmed.indexOf('=')
      if (idx === -1) continue
      const key = trimmed.slice(0, idx).trim()
      let val = trimmed.slice(idx + 1).trim()
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) val = val.slice(1, -1)
      if (!process.env[key]) process.env[key] = val
    }
  } catch {}
}
loadEnvLocal()

import { generateObject } from 'ai'
import { z } from 'zod'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'

const curatorSchema = z.object({
  body: z.string(),
  referenceIds: z.array(z.string()),
})

const ALL_MODELS = [
  'deepseek/deepseek-v3.2-speciale',
  'deepseek/deepseek-v3.2',
  'openai/gpt-5.4-mini',
  'openai/gpt-5.4',
  'anthropic/claude-sonnet-4.6',
  'anthropic/claude-haiku-4.5',
  'qwen/qwen3.6-plus',
  'moonshotai/kimi-k2.6',
  'google/gemma-4-31b-it',
  'z-ai/glm-5.1',
  'x-ai/grok-4.20',
  'xiaomi/mimo-v2-pro',
  'minimax/minimax-m2.7',
  'google/gemini-3.1-pro-preview',
  'google/gemini-3.1-flash-lite-preview',
  'google/gemini-3-flash-preview',
]

const ONLY = process.env.CURATOR_SWEEP_ONLY
const MODELS = ONLY
  ? ONLY.split(',').map((s) => s.trim()).filter(Boolean)
  : ALL_MODELS

function slugify(id: string): string {
  return id.replace(/\//g, '__').replace(/[^a-zA-Z0-9._-]/g, '-')
}

type Result =
  | {
      ok: true
      model: string
      ms: number
      cost: number | null
      totalTokens: number | null
      inputTokens: number | null
      outputTokens: number | null
      referenceIds: string[]
      bodyChars: number
    }
  | { ok: false; model: string; ms: number; error: string }

describe('curator model sweep', () => {
  it('runs all models in parallel and saves outputs', async () => {
    if (!process.env.RUN_CURATOR_SWEEP) {
      console.log('Skipping — set RUN_CURATOR_SWEEP=1 to run')
      return
    }

    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey) throw new Error('OPENROUTER_API_KEY required')

    const outDir = resolve(
      process.cwd(),
      'experiments/2026-04-22-curator-model-sweep',
    )
    mkdirSync(outDir, { recursive: true })

    const system = readFileSync(
      resolve(process.cwd(), 'prompts/preview-curator-system.md'),
      'utf8',
    )
    const userPrompt = readFileSync(
      resolve(process.cwd(), 'test-curator-user.md'),
      'utf8',
    )

    const openrouter = createOpenRouter({ apiKey })

    const runOne = async (modelId: string): Promise<Result> => {
      const started = Date.now()
      const slug = slugify(modelId)
      const filePath = resolve(outDir, `${slug}.md`)
      try {
        const model = openrouter(modelId, {
          usage: { include: true },
          plugins: [{ id: 'response-healing' }],
        })
        const { object, usage, providerMetadata } = await generateObject({
          model,
          schema: curatorSchema,
          system,
          prompt: userPrompt,
          temperature: 0.5,
        })
        const cost = (providerMetadata?.openrouter as
          | { usage?: { cost?: number } }
          | undefined)?.usage?.cost
        const ms = Date.now() - started
        const result: Result = {
          ok: true,
          model: modelId,
          ms,
          cost: typeof cost === 'number' ? cost : null,
          totalTokens: usage?.totalTokens ?? null,
          inputTokens: usage?.inputTokens ?? null,
          outputTokens: usage?.outputTokens ?? null,
          referenceIds: object.referenceIds,
          bodyChars: object.body.length,
        }
        writeFileSync(
          filePath,
          [
            `# ${modelId}`,
            ``,
            '```json',
            JSON.stringify(result, null, 2),
            '```',
            ``,
            `## body`,
            ``,
            object.body,
            ``,
          ].join('\n'),
        )
        console.log(
          `[ok]   ${modelId.padEnd(44)} ms=${ms.toString().padStart(6)} tokens=${
            result.totalTokens ?? '—'
          } cost=${result.cost != null ? `$${result.cost.toFixed(6)}` : '—'}`,
        )
        return result
      } catch (err: unknown) {
        const ms = Date.now() - started
        const message = err instanceof Error ? err.message : String(err)
        const result: Result = { ok: false, model: modelId, ms, error: message }
        writeFileSync(
          filePath,
          [
            `# ${modelId}`,
            ``,
            '```json',
            JSON.stringify(result, null, 2),
            '```',
            ``,
            `## error`,
            ``,
            message,
            ``,
          ].join('\n'),
        )
        console.log(
          `[fail] ${modelId.padEnd(44)} ms=${ms.toString().padStart(6)} ${message.slice(0, 160)}`,
        )
        return result
      }
    }

    const results = await Promise.all(MODELS.map(runOne))

    if (ONLY) {
      console.log(`\nPartial run (CURATOR_SWEEP_ONLY=${ONLY}) — skipping summary rewrite.`)
      console.log(`Output: ${outDir}`)
      return
    }

    writeFileSync(
      resolve(outDir, 'summary.json'),
      JSON.stringify(
        { ranAt: new Date().toISOString(), results },
        null,
        2,
      ),
    )

    const successes = results.filter((r): r is Extract<Result, { ok: true }> => r.ok)
    const totalCost = successes.reduce((s, r) => s + (r.cost ?? 0), 0)
    const totalTokens = successes.reduce((s, r) => s + (r.totalTokens ?? 0), 0)

    const lines: string[] = []
    lines.push(`# Curator model sweep — ${new Date().toISOString()}`)
    lines.push('')
    lines.push(
      `${successes.length}/${results.length} models returned a valid curator object. Total cost across runs: $${totalCost.toFixed(6)}. Total tokens: ${totalTokens}.`,
    )
    lines.push('')
    lines.push('| Model | Status | ms | in tok | out tok | total tok | cost | body chars |')
    lines.push('|---|---|---:|---:|---:|---:|---:|---:|')
    for (const r of results) {
      if (r.ok) {
        lines.push(
          `| \`${r.model}\` | ok | ${r.ms} | ${r.inputTokens ?? '—'} | ${r.outputTokens ?? '—'} | ${r.totalTokens ?? '—'} | ${
            r.cost != null ? `$${r.cost.toFixed(6)}` : '—'
          } | ${r.bodyChars} |`,
        )
      } else {
        lines.push(
          `| \`${r.model}\` | **fail** | ${r.ms} | — | — | — | — | — |`,
        )
      }
    }
    lines.push('')
    lines.push('## Failures')
    lines.push('')
    const failures = results.filter((r): r is Extract<Result, { ok: false }> => !r.ok)
    if (failures.length === 0) {
      lines.push('_none_')
    } else {
      for (const f of failures) {
        lines.push(`- \`${f.model}\` — ${f.error.slice(0, 300)}`)
      }
    }
    lines.push('')
    writeFileSync(resolve(outDir, 'summary.md'), lines.join('\n'))

    console.log(`\nDone. Output: ${outDir}`)
    console.log(`Total cost: $${totalCost.toFixed(6)}`)
  }, 900_000)
})
