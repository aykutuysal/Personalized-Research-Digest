// src/lib/ai/chat-types.ts
// Pure type module. Safe for both server and client imports since the
// `import type` below is erased at compile time and pulls no runtime code
// from the server-gated `onboarding-tools.ts`.
import type { InferUITools, UIMessage } from 'ai'
import type { OnboardingTools } from './onboarding-tools'

export type OnboardingUITools = InferUITools<OnboardingTools>

export type ResearchChatMessage = UIMessage<never, never, OnboardingUITools>
