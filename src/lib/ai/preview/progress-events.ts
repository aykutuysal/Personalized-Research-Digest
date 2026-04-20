// src/lib/ai/preview/progress-events.ts
import type { SearchQuery } from '@/lib/config-schema'

export interface ReferencePaper {
  id: string
  title: string
  authors: string
  venue: string
  date: string
  url: string
}

export type ProgressEvent =
  | { kind: 'seeds'; seeds: string[] }
  | { kind: 'seed-fetch-done'; papersScanned: number; perSeed: Array<{ seed: string; count: number }> }
  | { kind: 'vocab'; topics: number; keywords: number; fields: string[] }
  | { kind: 'library'; queries: Array<{ query: string; research_area_id: number }> }
  | { kind: 'area-hit'; research_area_id: number; hits: number; sampleTitle: string | null }
  | { kind: 'curating' }
  | { kind: 'done'; body: string; references: ReferencePaper[]; queries: SearchQuery[] }
  | { kind: 'error'; stage: string; message: string }
