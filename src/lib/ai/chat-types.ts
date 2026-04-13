// src/lib/ai/chat-types.ts
// Pure type module. Safe for both server and client imports since the
// `import type` below is erased at compile time and pulls no runtime code
// from the server-gated `onboarding-tools.ts`.
import type { InferUITools, UIMessage } from 'ai'
import type { onboardingTools } from './onboarding-tools'

export type OnboardingUITools = InferUITools<typeof onboardingTools>

export type ResearchChatMessage = UIMessage<never, never, OnboardingUITools>
