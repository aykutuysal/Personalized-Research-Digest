// src/lib/ai/onboarding-tools.ts
import { tool } from 'ai'
import { z } from 'zod'
import { normalizeSchedule as normalizeScheduleImpl } from '@/lib/schedule/cron'
import { digestConfigSchema } from '@/lib/config-schema'

const normalizeScheduleInput = z.object({
  naturalLanguage: z
    .string()
    .describe('The user\'s natural-language description of their schedule.'),
  city: z
    .string()
    .optional()
    .describe('The user\'s city, used to resolve timezone when timezone is not given.'),
  timezone: z
    .string()
    .optional()
    .describe('An explicit IANA timezone string. Takes precedence over city.'),
})

const normalizeScheduleTool = tool({
  description:
    'Convert a natural-language schedule ("every Monday at 9am") into a cron expression, IANA timezone, a human description, and the next three fire times. Call this after the user describes when they want their digest.',
  inputSchema: normalizeScheduleInput,
  execute: async (args) => {
    return normalizeScheduleImpl({
      naturalLanguage: args.naturalLanguage,
      city: args.city,
      timezone: args.timezone,
    })
  },
})

const generateConfigInput = z.object({
  config: z
    .record(z.string(), z.unknown())
    .describe('The assembled DigestConfig fields. Will be validated against the schema.'),
})

const generateConfigTool = tool({
  description:
    'Validate the assembled config against the DigestConfig schema and finalize it. Call this once subject, schedule, profile, output_style, volume_target, and core_angles are all ready. On failure, fix the named fields and retry.',
  inputSchema: generateConfigInput,
  execute: async (args) => {
    const now = new Date().toISOString()
    const stamped = {
      version: 1,
      created_at: now,
      updated_at: now,
      search_queries: [],
      ...args.config,
    }
    const parsed = digestConfigSchema.safeParse(stamped)
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

export const onboardingTools = {
  normalizeSchedule: normalizeScheduleTool,
  generateConfig: generateConfigTool,
}
