// test/curator-jargon-ab.test.ts
//
// A/B the curator system prompt to measure the effect of the 2026-04-22
// jargon-discipline rules. OLD prompt is pulled from HEAD (pre-edit) via
// `git show`; NEW prompt is read from the working tree. Both run against
// the same test-curator-user.md fixture and openai/gpt-5.4.
//
// Gated by RUN_CURATOR_JARGON_AB=1.

import { describe, it } from 'vitest'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { execSync } from 'node:child_process'

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
const N = Number(process.env.CURATOR_AB_N ?? '2')

type Variant = { label: 'old' | 'new'; system: string }

type Run =
  | {
      ok: true
      label: string
      run: number
      ms: number
      cost: number | null
      totalTokens: number | null
      bodyChars: number
      body: string
    }
  | { ok: false; label: string; run: number; ms: number; error: string }

describe('curator jargon A/B', () => {
  it('compares pre-edit (HEAD) vs post-edit (working tree) curator prompts', async () => {
    if (!process.env.RUN_CURATOR_JARGON_AB) {
      console.log('Skipping — set RUN_CURATOR_JARGON_AB=1 to run')
      return
    }

    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey) throw new Error('OPENROUTER_API_KEY required')

    const outDir = resolve(
      process.cwd(),
      'experiments/2026-04-22-curator-jargon-ab',
    )
    mkdirSync(outDir, { recursive: true })

    const oldPrompt = execSync(
      'git show HEAD:prompts/preview-curator-system.md',
      { encoding: 'utf8' },
    )
    const newPrompt = readFileSync(
      resolve(process.cwd(), 'prompts/preview-curator-system.md'),
      'utf8',
    )
    const userPrompt = readFileSync(
      resolve(process.cwd(), 'test-curator-user.md'),
      'utf8',
    )

    const variants: Variant[] = [
      { label: 'old', system: oldPrompt },
      { label: 'new', system: newPrompt },
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
        console.log(`[fail] ${tag.padEnd(10)} ms=${ms} ${message.slice(0, 160)}`)
        return { ok: false, label: v.label, run: i + 1, ms, error: message }
      }
    }

    const jobs: Array<Promise<Run>> = []
    for (const v of variants) {
      for (let i = 0; i < N; i++) {
        jobs.push(runOne(v, i))
      }
    }
    const results = await Promise.all(jobs)

    const successes = results.filter((r): r is Extract<Run, { ok: true }> => r.ok)
    const totalCost = successes.reduce((s, r) => s + (r.cost ?? 0), 0)

    writeFileSync(
      resolve(outDir, 'summary.json'),
      JSON.stringify(
        {
          ranAt: new Date().toISOString(),
          model: MODEL_ID,
          n: N,
          results: results.map((r) => (r.ok ? { ...r, body: undefined } : r)),
          totalCost,
        },
        null,
        2,
      ),
    )

    console.log(`\nDone. Output: ${outDir}`)
    console.log(`Total cost: $${totalCost.toFixed(6)}`)
  }, 900_000)
})
