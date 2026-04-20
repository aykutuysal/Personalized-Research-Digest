// src/app/api/onboarding-chat/route.ts
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { streamText, convertToModelMessages, stepCountIs } from 'ai'
import { onboardingModel } from '@/lib/ai/openrouter'
import { buildOnboardingTools } from '@/lib/ai/onboarding-tools'
import type { ResearchChatMessage } from '@/lib/ai/chat-types'

export const runtime = 'nodejs'
export const maxDuration = 60

let cachedSystem: string | null = null
function getSystemPrompt(): string {
  if (cachedSystem) return cachedSystem
  cachedSystem = readFileSync(
    resolve(process.cwd(), 'prompts/onboarding-system.md'),
    'utf8',
  )
  return cachedSystem
}

export async function POST(req: Request) {
  const body = (await req.json()) as { messages: ResearchChatMessage[]; conversationId?: string }
  const sessionId = body.conversationId ?? null
  const tag = `[onboarding ${sessionId?.slice(0, 8) ?? 'no-id'}]`

  console.log(`${tag} POST turns=${body.messages.length}`)

  const result = streamText({
    model: onboardingModel({ sessionId }),
    system: getSystemPrompt(),
    messages: await convertToModelMessages<ResearchChatMessage>(body.messages),
    tools: buildOnboardingTools(sessionId),
    stopWhen: stepCountIs(2),
    temperature: 0.7,
    onStepFinish: ({ stepNumber, finishReason, usage, toolCalls, toolResults, providerMetadata }) => {
      const cost = (providerMetadata?.openrouter as { usage?: { cost?: number } } | undefined)?.usage?.cost
      console.log(
        `${tag} step=${stepNumber} finish=${finishReason} tokens=${usage.totalTokens ?? '?'} cost=${cost != null ? `$${cost.toFixed(6)}` : '—'}`,
      )
      for (const c of toolCalls) {
        console.log(`${tag}   → tool-call ${c.toolName}`, JSON.stringify(c.input))
      }
      for (const r of toolResults) {
        const preview = JSON.stringify(r.output).slice(0, 300)
        console.log(`${tag}   ← tool-result ${r.toolName} ${preview}`)
      }
    },
    onFinish: ({ totalUsage }) => {
      console.log(`${tag} done total_tokens=${totalUsage.totalTokens ?? '?'}`)
    },
    onError: ({ error }) => {
      console.error(`${tag} stream error`, error)
    },
  })

  return result.toUIMessageStreamResponse<ResearchChatMessage>()
}
