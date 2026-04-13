// src/lib/ai/onboarding-tools.ts
import { tool } from 'ai'
import { z } from 'zod'
import { normalizeSchedule as normalizeScheduleImpl } from '@/lib/schedule/cron'

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

export const onboardingTools = {
  normalizeSchedule: normalizeScheduleTool,
}
