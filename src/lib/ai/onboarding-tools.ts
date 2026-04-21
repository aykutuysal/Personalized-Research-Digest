// src/lib/ai/onboarding-tools.ts
import 'server-only'
import { tool } from 'ai'
import { z } from 'zod'
import { digestConfigSchema } from '@/lib/config-schema'
import { proposeResearchAreas as proposeResearchAreasImpl } from '@/lib/ai/propose-research-areas'

const proposeResearchAreasInput = z.object({
  subject: z.string().describe('The subject the user wants a digest about.'),
  profileSummary: z
    .string()
    .describe('A short profile of the reader: role, intent, anti-interests.'),
  hints: z.string().optional().describe('Optional hints from the conversation so far.'),
})

function makeProposeResearchAreasTool(sessionId: string | null) {
  return tool({
    description:
      'Generate 6–12 specific research areas for a subject given a reader profile. Call this once subject, role, and intent are clear. Narrate the result to the user in natural language — do not dump the raw list.',
    inputSchema: proposeResearchAreasInput,
    execute: async (args) => {
      return proposeResearchAreasImpl(args, { sessionId })
    },
  })
}

// Pre-schedule subset of DigestConfig. Chat never sets schedule or metadata.
const handoffDraftSchema = digestConfigSchema.omit({
  schedule: true,
  version: true,
  created_at: true,
  updated_at: true,
  search_queries: true,
})

const handoffToPlanInput = z.object({
  config: z
    .record(z.string(), z.unknown())
    .describe(
      'The assembled fields: subject, profile, format_structure, voice_language, research_areas. Will be validated.',
    ),
})

const handoffToPlanTool = tool({
  description:
    'Finalize the five-field plan draft (subject, profile, format_structure, voice_language, research_areas) once they are all ready. The UI transitions to the Research Plan view on success. On failure, fix the named fields and retry.',
  inputSchema: handoffToPlanInput,
  execute: async (args) => {
    const parsed = handoffDraftSchema.safeParse(args.config)
    if (parsed.success) {
      return { ok: true as const, config: parsed.data }
    }
    return {
      ok: false as const,
      errors: parsed.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      })),
    }
  },
})

export type OnboardingTools = ReturnType<typeof buildOnboardingTools>

export function buildOnboardingTools(sessionId: string | null) {
  return {
    proposeResearchAreas: makeProposeResearchAreasTool(sessionId),
    handoffToPlan: handoffToPlanTool,
  }
}
