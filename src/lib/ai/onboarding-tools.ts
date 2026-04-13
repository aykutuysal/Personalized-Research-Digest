// src/lib/ai/onboarding-tools.ts
import 'server-only'
import { tool } from 'ai'
import { z } from 'zod'
import { normalizeSchedule as normalizeScheduleImpl } from '@/lib/schedule/cron'
import { digestConfigSchema } from '@/lib/config-schema'
import { proposeAngles as proposeAnglesImpl } from '@/lib/ai/propose-angles'
import { searchByKeyword } from '@/lib/openalex/client'

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

const proposeAnglesInput = z.object({
  subject: z.string().describe('The subject the user wants a digest about.'),
  profileSummary: z
    .string()
    .describe('A short profile of the reader: role, intent, anti-interests.'),
  hints: z.string().optional().describe('Optional hints from the conversation so far.'),
})

const proposeAnglesTool = tool({
  description:
    'Generate 6–12 specific research angles for a subject given a reader profile. Call this once subject, role, and intent are clear. Narrate the result to the user in natural language — do not dump the raw list.',
  inputSchema: proposeAnglesInput,
  execute: async (args) => {
    return proposeAnglesImpl(args)
  },
})

type Verdict = 'healthy' | 'sparse' | 'empty' | 'error'

function computeVerdict(count30d: number, papersPerRun: number): Verdict {
  if (count30d === 0) return 'empty'
  if (papersPerRun >= 2) return 'healthy'
  return 'sparse'
}

function todayUtc(): Date {
  return new Date()
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

async function withSemaphore<T>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<void>,
): Promise<void> {
  let cursor = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const i = cursor++
      await fn(items[i], i)
    }
  })
  await Promise.all(workers)
}

const corpusSanityInput = z.object({
  subject: z.string(),
  angles: z.array(z.object({ text: z.string() })).min(1),
  cadenceDays: z.number().int().positive(),
})

interface SanityResult {
  angleText: string
  count30d: number
  papersPerRun: number
  verdict: Verdict
  sampleTitles?: string[]
}

const corpusSanityCheckTool = tool({
  description:
    "For each angle, run one OpenAlex search over the last 30 days and estimate papers-per-run given the user's cadence. Call this after angles AND schedule are both settled. Surface sparse/empty angles to the user with cadence-aware language.",
  inputSchema: corpusSanityInput,
  execute: async (args) => {
    const to = todayUtc()
    const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000)
    const fromDate = formatDate(from)
    const toDate = formatDate(to)
    const out: SanityResult[] = new Array(args.angles.length)

    await withSemaphore(args.angles, 5, async (angle, i) => {
      const query = `"${angle.text}" AND ${args.subject}`
      try {
        const res = await searchByKeyword({
          query,
          fromDate,
          toDate,
          perPage: 3,
          page: 1,
        })
        const count30d = res.meta?.count ?? 0
        const papersPerRun = (count30d / 30) * args.cadenceDays
        const verdict = computeVerdict(count30d, papersPerRun)
        const sampleTitles =
          verdict === 'healthy'
            ? undefined
            : res.results
                .map((w) => (typeof w.title === 'string' ? w.title : null))
                .filter((t): t is string => !!t)
                .slice(0, 3)
        out[i] = {
          angleText: angle.text,
          count30d,
          papersPerRun,
          verdict,
          sampleTitles,
        }
      } catch {
        out[i] = {
          angleText: angle.text,
          count30d: 0,
          papersPerRun: 0,
          verdict: 'error',
        }
      }
    })

    return { results: out }
  },
})

export const onboardingTools = {
  normalizeSchedule: normalizeScheduleTool,
  generateConfig: generateConfigTool,
  proposeAngles: proposeAnglesTool,
  corpusSanityCheck: corpusSanityCheckTool,
}
