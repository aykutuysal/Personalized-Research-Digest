// test/curator-example-ablation.test.ts
//
// Ablates the output-format example in the curator system prompt to check
// whether the cardiology-example-driven paper-selection drift in v2 survives
// when the example is removed (v2b) or replaced by a schematic, domain-free
// placeholder (v2c).
//
// Runs three variants against openai/gpt-5.4 with N=3 each and saves outputs
// to experiments/2026-04-22-curator-example-ablation/.
//
// Gated by RUN_CURATOR_ABLATION=1.

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

const MODEL_ID = process.env.CURATOR_AB_MODEL ?? 'openai/gpt-5.4'
const N = Number(process.env.CURATOR_AB_N ?? '3')

type Variant = { label: 'v2' | 'v2b' | 'v2c'; system: string }

type Run =
  | {
      ok: true
      label: string
      run: number
      ms: number
      cost: number | null
      totalTokens: number | null
      inputTokens: number | null
      outputTokens: number | null
      referenceIds: string[]
      bodyChars: number
      body: string
    }
  | { ok: false; label: string; run: number; ms: number; error: string }

describe('curator example ablation', () => {
  it('runs v2 / v2b / v2c against the model', async () => {
    if (!process.env.RUN_CURATOR_ABLATION) {
      console.log('Skipping — set RUN_CURATOR_ABLATION=1 to run')
      return
    }

    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey) throw new Error('OPENROUTER_API_KEY required')

    const outDir = resolve(
      process.cwd(),
      'experiments/2026-04-22-curator-example-ablation',
    )
    mkdirSync(outDir, { recursive: true })

    const v2 = readFileSync(
      resolve(process.cwd(), 'prompts/preview-curator-system.v2.md'),
      'utf8',
    )
    const v2b = readFileSync(
      resolve(process.cwd(), 'prompts/preview-curator-system.v2b.md'),
      'utf8',
    )
    const v2c = readFileSync(
      resolve(process.cwd(), 'prompts/preview-curator-system.v2c.md'),
      'utf8',
    )
    const userPrompt = readFileSync(
      resolve(process.cwd(), 'test-curator-user.md'),
      'utf8',
    )

    const variants: Variant[] = [
      { label: 'v2', system: v2 },
      { label: 'v2b', system: v2b },
      { label: 'v2c', system: v2c },
    ]

    const openrouter = createOpenRouter({ apiKey })

    const runOne = async (v: Variant, i: number): Promise<Run> => {
      const started = Date.now()
      const tag = `${v.label}-run${i + 1}`
      try {
        const model = openrouter(MODEL_ID, {
          usage: { include: true },
          plugins: [{ id: 'response-healing' }],
        })
        const { object, usage, providerMetadata } = await generateObject({
          model,
          schema: curatorSchema,
          system: v.system,
          prompt: userPrompt,
          temperature: 0.5,
        })
        const cost = (providerMetadata?.openrouter as
          | { usage?: { cost?: number } }
          | undefined)?.usage?.cost
        const ms = Date.now() - started
        const result: Run = {
          ok: true,
          label: v.label,
          run: i + 1,
          ms,
          cost: typeof cost === 'number' ? cost : null,
          totalTokens: usage?.totalTokens ?? null,
          inputTokens: usage?.inputTokens ?? null,
          outputTokens: usage?.outputTokens ?? null,
          referenceIds: object.referenceIds,
          bodyChars: object.body.length,
          body: object.body,
        }
        writeFileSync(
          resolve(outDir, `${tag}.md`),
          [
            `# ${MODEL_ID} — ${tag}`,
            ``,
            '```json',
            JSON.stringify({ ...result, body: undefined }, null, 2),
            '```',
            ``,
            `## body`,
            ``,
            object.body,
            ``,
          ].join('\n'),
        )
        console.log(
          `[ok]   ${tag.padEnd(10)} ms=${ms.toString().padStart(6)} tokens=${
            result.totalTokens ?? '—'
          } cost=${result.cost != null ? `$${result.cost.toFixed(6)}` : '—'}`,
        )
        return result
      } catch (err: unknown) {
        const ms = Date.now() - started
        const message = err instanceof Error ? err.message : String(err)
        const result: Run = {
          ok: false,
          label: v.label,
          run: i + 1,
          ms,
          error: message,
        }
        writeFileSync(
          resolve(outDir, `${tag}.md`),
          [
            `# ${MODEL_ID} — ${tag}`,
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
        console.log(`[fail] ${tag.padEnd(10)} ms=${ms} ${message.slice(0, 160)}`)
        return result
      }
    }

    const jobs: Array<Promise<Run>> = []
    for (const v of variants) {
      for (let i = 0; i < N; i++) {
        jobs.push(runOne(v, i))
      }
    }
    const results = await Promise.all(jobs)

    writeFileSync(
      resolve(outDir, 'summary.json'),
      JSON.stringify(
        {
          ranAt: new Date().toISOString(),
          model: MODEL_ID,
          n: N,
          results: results.map((r) => (r.ok ? { ...r, body: undefined } : r)),
        },
        null,
        2,
      ),
    )

    const successes = results.filter((r): r is Extract<Run, { ok: true }> => r.ok)
    const totalCost = successes.reduce((s, r) => s + (r.cost ?? 0), 0)

    const lines: string[] = []
    lines.push(`# Curator example ablation — ${new Date().toISOString()}`)
    lines.push('')
    lines.push(`Model: \`${MODEL_ID}\`  |  N per variant: ${N}  |  Total cost: $${totalCost.toFixed(6)}`)
    lines.push('')
    lines.push('| label | run | status | ms | in tok | out tok | cost | body chars | picks |')
    lines.push('|---|---:|---|---:|---:|---:|---:|---:|---|')
    for (const r of results) {
      if (r.ok) {
        lines.push(
          `| ${r.label} | ${r.run} | ok | ${r.ms} | ${r.inputTokens ?? '—'} | ${r.outputTokens ?? '—'} | ${
            r.cost != null ? `$${r.cost.toFixed(6)}` : '—'
          } | ${r.bodyChars} | ${r.referenceIds.join(', ')} |`,
        )
      } else {
        lines.push(
          `| ${r.label} | ${r.run} | **fail** | ${r.ms} | — | — | — | — | — |`,
        )
      }
    }
    lines.push('')
    writeFileSync(resolve(outDir, 'summary.md'), lines.join('\n'))

    console.log(`\nDone. Output: ${outDir}`)
    console.log(`Total cost: $${totalCost.toFixed(6)}`)
  }, 900_000)
})
