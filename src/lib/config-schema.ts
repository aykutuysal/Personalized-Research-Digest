// src/lib/config-schema.ts
import { z } from 'zod'

export const angleSchema = z.object({
  id: z.number().int().min(1),
  text: z.string().min(1),
  status: z.enum(['core', 'proposed', 'rejected']).default('core'),
  priority: z.enum(['high', 'normal', 'low']).default('normal'),
})

export const scheduleSchema = z.object({
  cron: z.string().min(1),
  timezone: z.string().min(1),
  description: z.string().min(1),
})

export const digestConfigSchema = z.object({
  // Structured — operational
  subject: z.string().min(1),
  schedule: scheduleSchema,
  volume_target: z.number().int().min(3).max(40),

  // Free text — used by LLMs
  profile: z.string().min(1),
  output_style: z.string().min(1),

  // Structured — retrieval contract
  core_angles: z.array(angleSchema).min(1),

  // Optional — power-user escape hatch
  search_queries: z.array(z.string()).default([]),

  // Metadata
  version: z.number().int().min(1),
  created_at: z.string().min(1),
  updated_at: z.string().min(1),
})

export type Angle = z.infer<typeof angleSchema>
export type Schedule = z.infer<typeof scheduleSchema>
export type DigestConfig = z.infer<typeof digestConfigSchema>
