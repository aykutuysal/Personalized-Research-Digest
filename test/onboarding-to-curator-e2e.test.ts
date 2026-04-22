// test/onboarding-to-curator-e2e.test.ts
//
// End-to-end test of the onboarding -> curator pipeline.
//
// For two personas (builder, researcher):
//  1. Ask gpt-5.4 with the onboarding system prompt to produce
//     format_structure + voice_language (generateObject with schema, no
//     conversational back-and-forth).
//  2. Swap those into a curator user prompt (same pool as the earlier tests).
//  3. Run the curator.
//  4. Save everything.
//
// Gated by RUN_CURATOR_E2E=1.

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

const MODEL_ID = process.env.CURATOR_AB_MODEL ?? 'openai/gpt-5.4'

const templateSchema = z.object({
  format_structure: z.string().describe(
    'Markdown numbered list of sections. Each item: "Section name. Description." Start with an overview-style opening section as instructed in the system prompt.',
  ),
  voice_language: z.string().describe(
    'Short prose paragraph on voice, tone, depth, target word count, and language preferences.',
  ),
})

const curatorSchema = z.object({
  body: z.string(),
  referenceIds: z.array(z.string()),
})

type Persona = {
  label: 'builder' | 'researcher'
  subject: string
  profile: string
  areas: string[]
}

const PERSONAS: Persona[] = [
  {
    label: 'builder',
    subject: 'AI agents',
    profile:
      'Builder of various AI agents who wants to stay on top of the latest developments. Avoids pure theory papers without implementation details and work on overly narrow domains that don\'t generalize. Interested in frameworks and tools.',
    areas: [
      'LLM agents',
      'Tool-use and function calling in LLM agents',
      'Agent planning and reasoning',
      'Multi-agent systems and collaboration',
      'Agent evaluation benchmarks and environments',
      'Agent learning and adaptation',
      'Retrieval-augmented generation (RAG) for agents',
      'Agent robustness and reliability',
      'Multimodal and vision-language agents',
      'Agent frameworks and development tools',
    ],
  },
  {
    label: 'researcher',
    subject: 'AI agents',
    profile:
      'AI-agents researcher who cares about mechanisms and why things work. Wants to understand the theory, mathematical structure, or algorithmic insight behind results. Avoids framework papers, tool-integration write-ups, and application-flavored "here\'s our pipeline" papers — not interested in which library to use. Prefers papers that isolate a single mechanism and show something new about it.',
    areas: [
      'LLM agents',
      'Tool-use and function calling in LLM agents',
      'Agent planning and reasoning',
      'Multi-agent systems and collaboration',
      'Agent evaluation benchmarks and environments',
      'Agent learning and adaptation',
      'Retrieval-augmented generation (RAG) for agents',
      'Agent robustness and reliability',
      'Multimodal and vision-language agents',
      'Agent frameworks and development tools',
    ],
  },
]

describe('onboarding -> curator e2e', () => {
  it('generates templates then runs them through the curator', async () => {
    if (!process.env.RUN_CURATOR_E2E) {
      console.log('Skipping — set RUN_CURATOR_E2E=1 to run')
      return
    }

    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey) throw new Error('OPENROUTER_API_KEY required')

    const outDir = resolve(process.cwd(), 'experiments/2026-04-22-e2e-onboarding-curator')
    mkdirSync(outDir, { recursive: true })

    const onboardingSystem = readFileSync(
      resolve(process.cwd(), 'prompts/onboarding-system.md'),
      'utf8',
    )
    const curatorSystem = readFileSync(
      resolve(process.cwd(), 'prompts/preview-curator-system.md'),
      'utf8',
    )

    // Pool lives in test-curator-user.md — grab the CANDIDATE POOL section so
    // we can reuse it across both personas with generated templates.
    const existingCuratorUser = readFileSync(
      resolve(process.cwd(), 'test-curator-user.md'),
      'utf8',
    )
    const poolStart = existingCuratorUser.indexOf('CANDIDATE POOL')
    if (poolStart === -1) throw new Error('could not find CANDIDATE POOL in test-curator-user.md')
    const poolSection = existingCuratorUser.slice(poolStart)

    const openrouter = createOpenRouter({ apiKey })

    const generateTemplate = async (p: Persona) => {
      const userMsg = [
        'For this test, skip the conversation and output the final two fields directly using the structured-output schema.',
        '',
        'The reader has already confirmed their structure and voice (treat as implicit). Produce `format_structure` and `voice_language` as described by your system prompt. Follow every guideline in that prompt — especially the opening-section rules (reader-anchored, no field summaries, no jargon like "pool" / "candidate" / "corpus") and the cadence-neutrality rules.',
        '',
        `SUBJECT: ${p.subject}`,
        ``,
        `PROFILE:`,
        p.profile,
        ``,
        `RESEARCH AREAS:`,
        ...p.areas.map((a, i) => `  ${i + 1}. ${a}`),
      ].join('\n')

      const started = Date.now()
      const { object, usage, providerMetadata } = await generateObject({
        model: openrouter(MODEL_ID, {
          usage: { include: true },
          plugins: [{ id: 'response-healing' }],
        }),
        schema: templateSchema,
        system: onboardingSystem,
        prompt: userMsg,
        temperature: 0.5,
      })
      const cost = (providerMetadata?.openrouter as
        | { usage?: { cost?: number } }
        | undefined)?.usage?.cost
      console.log(
        `[onboarding] ${p.label.padEnd(12)} ms=${Date.now() - started} tokens=${
          usage?.totalTokens ?? '—'
        } cost=${cost != null ? `$${cost.toFixed(6)}` : '—'}`,
      )
      return { object, cost, tokens: usage?.totalTokens ?? null }
    }

    const runCurator = async (
      p: Persona,
      template: { format_structure: string; voice_language: string },
      runIdx: number,
    ) => {
      const userPrompt = [
        `READER PROFILE:`,
        p.profile,
        ``,
        `SUBJECT: ${p.subject}`,
        ``,
        `RESEARCH AREAS:`,
        ...p.areas.map((a, i) => `  ${i + 1}. ${a}`),
        ``,
        `THE READER'S DIGEST TEMPLATE (render exactly):`,
        template.format_structure,
        ``,
        template.voice_language,
        ``,
        poolSection,
      ].join('\n')

      const started = Date.now()
      const { object, usage, providerMetadata } = await generateObject({
        model: openrouter(MODEL_ID, {
          usage: { include: true },
          plugins: [{ id: 'response-healing' }],
        }),
        schema: curatorSchema,
        system: curatorSystem,
        prompt: userPrompt,
        temperature: 0.5,
      })
      const cost = (providerMetadata?.openrouter as
        | { usage?: { cost?: number } }
        | undefined)?.usage?.cost
      console.log(
        `[curator]    ${p.label.padEnd(12)} run${runIdx + 1} ms=${Date.now() - started} tokens=${
          usage?.totalTokens ?? '—'
        } cost=${cost != null ? `$${cost.toFixed(6)}` : '—'}`,
      )
      writeFileSync(
        resolve(outDir, `${p.label}-run${runIdx + 1}.md`),
        [
          `# ${MODEL_ID} — ${p.label} run${runIdx + 1}`,
          '',
          '## format_structure (from onboarding)',
          '',
          template.format_structure,
          '',
          '## voice_language (from onboarding)',
          '',
          template.voice_language,
          '',
          '## curator output',
          '',
          '```json',
          JSON.stringify({ referenceIds: object.referenceIds }, null, 2),
          '```',
          '',
          '### body',
          '',
          object.body,
          '',
        ].join('\n'),
      )
      return { body: object.body, referenceIds: object.referenceIds, cost, tokens: usage?.totalTokens ?? null }
    }

    let totalCost = 0
    const summary: Array<Record<string, unknown>> = []

    for (const p of PERSONAS) {
      const template = await generateTemplate(p)
      totalCost += template.cost ?? 0

      // save the onboarding output separately
      writeFileSync(
        resolve(outDir, `${p.label}-template.md`),
        [
          `# ${p.label} — generated template`,
          '',
          '## format_structure',
          '',
          template.object.format_structure,
          '',
          '## voice_language',
          '',
          template.object.voice_language,
          '',
        ].join('\n'),
      )

      // run curator 3 times per persona for variance
      const runs = await Promise.all([0, 1, 2].map((i) => runCurator(p, template.object, i)))
      for (const r of runs) totalCost += r.cost ?? 0

      summary.push({
        persona: p.label,
        templateCost: template.cost,
        curatorCosts: runs.map((r) => r.cost),
        picks: runs.map((r) => r.referenceIds),
      })
    }

    writeFileSync(
      resolve(outDir, 'summary.json'),
      JSON.stringify({ ranAt: new Date().toISOString(), totalCost, summary }, null, 2),
    )

    console.log(`\nDone. Output: ${outDir}`)
    console.log(`Total cost: $${totalCost.toFixed(6)}`)
  }, 900_000)
})
