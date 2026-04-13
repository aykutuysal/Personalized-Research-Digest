// test/helpers.ts
// Cast helper: tool.execute() in AI SDK v6 is typed as optional and returns
// AsyncIterable<T> | PromiseLike<T> | T. For non-streaming tools in tests
// we know it always resolves to T — this helper narrows safely.

import type { ModelMessage, Tool, InferToolInput, InferToolOutput, ToolExecutionOptions } from 'ai'

export const toolCtx = (id: string): ToolExecutionOptions => ({
  toolCallId: id,
  messages: [] as ModelMessage[],
})

export async function runTool<T extends Tool>(
  tool: T,
  args: InferToolInput<T>,
  ctx: ToolExecutionOptions,
): Promise<InferToolOutput<T>> {
  if (!tool.execute) throw new Error('tool.execute is undefined')
  const result = await tool.execute(args, ctx)
  return result as InferToolOutput<T>
}
