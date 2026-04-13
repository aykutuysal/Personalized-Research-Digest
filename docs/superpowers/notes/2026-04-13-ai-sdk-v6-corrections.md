# AI SDK v6.0.158 API Surface Corrections

Verified against installed type files on 2026-04-13.

---

## 1. streamText — WORKS AS WRITTEN

`streamText({ model, system, messages, tools, temperature })` — all these params exist in the signature.

`result.toUIMessageStreamResponse()` — EXISTS on `StreamTextResult`. The method signature:
```ts
toUIMessageStreamResponse(options?: UIMessageStreamResponseInit & UIMessageStreamOptions<UI_MESSAGE>): Response;
```

There is NO `.toDataStreamResponse()` method — `toUIMessageStreamResponse()` is the correct v6 name.

**Status: WORKS AS WRITTEN.**

---

## 2. convertToModelMessages — NEEDS AWAIT (async)

The signature is:
```ts
declare function convertToModelMessages<UI_MESSAGE extends UIMessage>(
  messages: Array<Omit<UI_MESSAGE, 'id'>>,
  options?: { tools?: ToolSet; ignoreIncompleteToolCalls?: boolean; ... }
): Promise<ModelMessage[]>;
```

`convertToModelMessages` is **async** (returns `Promise<ModelMessage[]>`).

### Correction for Task 23:
```ts
// WRONG (plan may imply sync usage):
messages: convertToModelMessages(body.messages)

// CORRECT:
messages: await convertToModelMessages(body.messages)
```

The outer handler must be `async` and the call must be awaited.

---

## 3. useChat — NEEDS CORRECTION

The plan calls `useChat({ api: '/api/onboarding-chat' })`.

**This will NOT work.** `api` is NOT a field of `ChatInit` (which is what `UseChatOptions` extends). The `Chat` class defaults to `new DefaultChatTransport()` which hits `/api/chat`.

### Correct pattern for Task 28:
```ts
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';

const { messages, sendMessage, status } = useChat({
  transport: new DefaultChatTransport({ api: '/api/onboarding-chat' }),
});
```

`messages`, `sendMessage`, `status` are all valid fields returned by `useChat`. Status values are: `'submitted' | 'streaming' | 'ready' | 'error'`. The "thinking" check `status === 'submitted' || status === 'streaming'` is correct.

---

## 4. UIMessage parts — WORKS WITH MINOR NAMING NOTE

`message.parts` — YES, `UIMessage` has a `parts: Array<UIMessagePart<...>>` field.

Part type for a tool named `proposeAngles` is: `type: 'tool-proposeAngles'` — CORRECT, the SDK uses the template literal `` `tool-${NAME}` ``.

`part.state` — YES, valid. States are: `'input-streaming' | 'input-available' | 'approval-requested' | 'approval-responded' | 'output-available' | 'output-error' | 'output-denied'`.

`part.output` — YES, present when `state === 'output-available'`. When `state === 'output-error'`, use `part.errorText` instead.

`part.input` — YES, always present (except when `state === 'input-streaming'` where it may be partial/undefined).

### Correction for Task 32:
The plan's `part.output` access is only valid when `part.state === 'output-available'`. Guard access:
```ts
if (part.state === 'output-available') {
  // part.output is available
}
if (part.state === 'output-error') {
  // part.errorText is available (not part.output)
}
```

**Status: WORKS AS WRITTEN if guards are used correctly.**

---

## Summary Table

| Surface | Status | Note |
|---|---|---|
| `streamText(...)` params | WORKS | all named params accepted |
| `result.toUIMessageStreamResponse()` | WORKS | correct v6 method name |
| `convertToModelMessages(body.messages)` | NEEDS FIX | must be `await convertToModelMessages(...)` |
| `useChat({ api: '...' })` | NEEDS FIX | must use `transport: new DefaultChatTransport({ api: '...' })` |
| `messages, sendMessage, status` from `useChat` | WORKS | all valid return fields |
| `status === 'submitted' \|\| 'streaming'` | WORKS | correct status values |
| `message.parts` | WORKS | field exists on UIMessage |
| `part.type === 'tool-proposeAngles'` | WORKS | template literal naming confirmed |
| `part.state`, `part.input`, `part.output` | WORKS | with proper state guard |
| `part.errorText` (error case) | NOTE | use this, not `part.output`, when `state === 'output-error'` |
