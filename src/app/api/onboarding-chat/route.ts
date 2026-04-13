// src/app/api/onboarding-chat/route.ts
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { streamText, convertToModelMessages } from 'ai'
import { deepseek } from '@/lib/ai/openrouter'
import { onboardingTools } from '@/lib/ai/onboarding-tools'
import type { ResearchChatMessage } from '@/lib/ai/chat-types'
import { getOrCreateSession } from '@/lib/session'

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
  await getOrCreateSession()

  const body = (await req.json()) as { messages: ResearchChatMessage[] }

  const result = streamText({
    model: deepseek(),
    system: getSystemPrompt(),
    messages: await convertToModelMessages<ResearchChatMessage>(body.messages),
    tools: onboardingTools,
    temperature: 0.7,
  })

  return result.toUIMessageStreamResponse<ResearchChatMessage>()
}
