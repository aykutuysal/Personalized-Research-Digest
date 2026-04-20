// src/lib/config-schema.ts
import { z } from 'zod'

export const researchAreaSchema = z.object({
  id: z.number().int().min(1),
  text: z.string().min(1),
})

export const searchQuerySchema = z.object({
  query: z.string().min(1),
  research_area_id: z.number().int().min(1),
  source: z.enum(['preview', 'full', 'manual']),
  rationale: z.string().default(''),
})

export const scheduleSchema = z.object({
  cron: z.string().min(1),
  timezone: z.string().min(1),
  description: z.string().min(1),
})

// Single source of truth. `schedule` is optional so the same object covers
// the post-chat state (no schedule yet) and the subscribe-ready state.
export const digestConfigSchema = z.object({
  subject: z.string().min(1),
  profile: z.string().min(1),
  output_style: z.string().min(1),
  research_areas: z.array(researchAreaSchema).min(1),
  search_queries: z.array(searchQuerySchema).default([]),
  schedule: scheduleSchema.optional(),
  version: z.number().int().min(1).default(1),
  created_at: z.string().min(1),
  updated_at: z.string().min(1),
})

// Used by Subscribe — enforces schedule is set.
export const subscribableConfigSchema = digestConfigSchema.required({ schedule: true })

export type ResearchArea = z.infer<typeof researchAreaSchema>
export type SearchQuery = z.infer<typeof searchQuerySchema>
export type Schedule = z.infer<typeof scheduleSchema>
export type DigestConfig = z.infer<typeof digestConfigSchema>
export type SubscribableConfig = z.infer<typeof subscribableConfigSchema>
