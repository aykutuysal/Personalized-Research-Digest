// src/app/api/preview-digest/route.ts
import { digestConfigSchema } from '@/lib/config-schema'
import { runPreviewPipeline } from '@/lib/ai/preview/pipeline'
import type { ProgressEvent } from '@/lib/ai/preview/progress-events'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: Request) {
  let parsedBody: unknown
  try {
    parsedBody = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'invalid-json' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  const parseResult = digestConfigSchema.safeParse(parsedBody)
  if (!parseResult.success) {
    return new Response(
      JSON.stringify({
        error: 'invalid-config',
        issues: parseResult.error.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }
  const config = parseResult.data
  const sessionId = req.headers.get('x-session-id')

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder()
      const emit = (e: ProgressEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`))
      }
      try {
        await runPreviewPipeline(config, { emit, sessionId })
      } catch (err) {
        emit({
          kind: 'error',
          stage: 'pipeline',
          message: (err as Error).message ?? String(err),
        })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      // Disable proxy buffering (nginx / Vercel / dev middleware) so SSE
      // frames reach the browser as they're emitted, not at stream close.
      'X-Accel-Buffering': 'no',
      'Content-Encoding': 'identity',
    },
  })
}
