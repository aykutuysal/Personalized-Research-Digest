// src/lib/ai/propose-angles.ts
import 'server-only'
import { generateObject } from 'ai'
import { z } from 'zod'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { deepseek } from '@/lib/ai/openrouter'

export const proposeAnglesOutputSchema = z.object({
  angles: z
    .array(
      z.object({
        text: z.string().min(1),
        rationale: z.string().min(1),
      }),
    )
    .min(6)
    .max(12),
})

export type ProposeAnglesOutput = z.infer<typeof proposeAnglesOutputSchema>

let cachedPrompt: string | null = null

function getSystemPrompt(): string {
  if (cachedPrompt) return cachedPrompt
  cachedPrompt = readFileSync(
    resolve(process.cwd(), 'prompts/propose-angles-system.md'),
    'utf8',
  )
  return cachedPrompt
}

export async function proposeAngles(
  input: {
    subject: string
    profileSummary: string
    hints?: string
  },
  opts: { sessionId?: string | null } = {},
): Promise<ProposeAnglesOutput> {
  const tag = `[proposeAngles ${opts.sessionId?.slice(0, 8) ?? 'no-session'}]`
  const startedAt = Date.now()
  console.log(`${tag} start subject="${input.subject}"`)

  const { object, usage, providerMetadata } = await generateObject({
    model: deepseek({ sessionId: opts.sessionId }),
    schema: proposeAnglesOutputSchema,
    system: getSystemPrompt(),
    prompt: [
      `SUBJECT: ${input.subject}`,
      '',
      `READER PROFILE:\n${input.profileSummary}`,
      input.hints ? `\nHINTS:\n${input.hints}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
    temperature: 0.7,
  })

  const cost = (providerMetadata?.openrouter as { usage?: { cost?: number } } | undefined)?.usage?.cost
  console.log(
    `${tag} done angles=${object.angles.length} tokens=${usage.totalTokens ?? '?'} cost=${cost != null ? `$${cost.toFixed(6)}` : '—'} ms=${Date.now() - startedAt}`,
  )
  return object
}
