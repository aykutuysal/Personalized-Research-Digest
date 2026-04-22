// src/lib/config-schema.ts
import { z } from 'zod'

export const researchAreaSchema = z.object({
  id: z.number().int().min(1),
  text: z.string().min(1),
})

export const searchQuerySchema = z.object({
  query: z.string().min(1),
  // 1..N points at a specific research area; 0 is reserved for umbrella queries
  // derived from the subject (not tied to any single area).
  research_area_id: z.number().int().min(0),
  source: z.enum(['preview', 'full', 'manual']),
  rationale: z.string().default(''),
})

export const scheduleSchema = z.object({
  cron: z.string().min(1),
  timezone: z.string().min(1),
  description: z.string().min(1),
})

export const planSchema = z.enum(['monthly', 'yearly'])

export const digestConfigSchema = z.object({
  subject: z.string().min(1),
  profile: z.string().min(1),
  // Split from the old `output_style`. Rendered separately in the UI.
  format_structure: z.string().min(1),
  voice_language: z.string().min(1),
  research_areas: z.array(researchAreaSchema).min(1),
  search_queries: z.array(searchQuerySchema).default([]),
  plan: planSchema.default('yearly'),
  email: z.string().email().optional(),
  schedule: scheduleSchema.optional(),
  version: z.number().int().min(1).default(1),
  created_at: z.string().min(1),
  updated_at: z.string().min(1),
})

export const subscribableConfigSchema = digestConfigSchema.required({
  schedule: true,
  email: true,
})

export type ResearchArea = z.infer<typeof researchAreaSchema>
export type SearchQuery = z.infer<typeof searchQuerySchema>
export type Schedule = z.infer<typeof scheduleSchema>
export type Plan = z.infer<typeof planSchema>
export type DigestConfig = z.infer<typeof digestConfigSchema>
export type SubscribableConfig = z.infer<typeof subscribableConfigSchema>
