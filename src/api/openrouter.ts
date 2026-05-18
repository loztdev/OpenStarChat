import type { Model, Message } from '../types'
import { mergeToolCallDeltas, accumulatorToOpenAIToolCalls, type ToolCallAccumulator } from './builtinTools'

const BASE_URL = 'https://openrouter.ai/api/v1'

function headers(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': window.location.origin,
    'X-Title': 'OpenStarChat',
  }
}

export async function fetchModels(apiKey: string): Promise<Model[]> {
  const reqHeaders: Record<string, string> = {
    'HTTP-Referer': window.location.origin,
    'X-Title': 'OpenStarChat',
  }
  if (apiKey) reqHeaders.Authorization = `Bearer ${apiKey}`

  const res = await fetch(`${BASE_URL}/models`, { headers: reqHeaders })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Failed to fetch models: ${res.status} ${text}`)
  }
  const payload = (await res.json().catch(() => null)) as { data?: unknown } | null
  if (!payload || !Array.isArray(payload.data)) {
    throw new Error('Unexpected response from /models — no `data` array.')
  }
  return payload.data as Model[]
}

export type ApiMessagePart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }

export type ApiToolCall = {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

export type ApiMessage = {
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string | ApiMessagePart[] | null
  tool_calls?: ApiToolCall[]
  tool_call_id?: string
}

function userImageUrls(msg: Pick<Message, 'imageUrl' | 'imageUrls'>): string[] {
  if (msg.imageUrls?.length) return msg.imageUrls
  if (msg.imageUrl) return [msg.imageUrl]
  return []
}

/** Convert a persisted chat message into an OpenRouter / OpenAI chat message. */
export function messageToApiMessage(msg: Message): ApiMessage {
  if (msg.role === 'tool') {
    return {
      role: 'tool',
      tool_call_id: msg.toolCallId ?? '',
      content: msg.content,
    }
  }

  if (msg.role === 'assistant' && msg.assistantToolCalls) {
    let calls: ApiToolCall[] = []
    try {
      calls = JSON.parse(msg.assistantToolCalls) as ApiToolCall[]
    } catch {
      calls = []
    }
    return {
      role: 'assistant',
      content: msg.content.length ? msg.content : null,
      tool_calls: calls.length ? calls : undefined,
    }
  }

  if (msg.role === 'user') {
    const imgs = userImageUrls(msg)
    if (imgs.length > 0) {
      return {
        role: 'user',
        content: [
          ...imgs.map((url) => ({ type: 'image_url' as const, image_url: { url } })),
          { type: 'text' as const, text: msg.content },
        ],
      }
    }
  }

  return { role: msg.role === 'system' ? 'system' : msg.role === 'assistant' ? 'assistant' : 'user', content: msg.content }
}

export function messagesToApiMessages(messages: Message[]): ApiMessage[] {
  return messages.map(messageToApiMessage)
}

export interface CompleteChatOptions {
  apiKey: string
  modelId: string
  messages: Message[]
  systemPrompt?: string
  signal?: AbortSignal
  temperature?: number
  maxTokens?: number
  tools?: unknown[]
  toolChoice?: unknown
  responseFormat?: unknown
}

export async function completeChat(opts: CompleteChatOptions): Promise<string> {
  const {
    apiKey,
    modelId,
    messages,
    systemPrompt,
    signal,
    temperature,
    maxTokens,
    tools,
    toolChoice,
    responseFormat,
  } = opts
  const apiMessages: ApiMessage[] = systemPrompt
    ? [{ role: 'system', content: systemPrompt }, ...messagesToApiMessages(messages)]
    : messagesToApiMessages(messages)

  const body: Record<string, unknown> = {
    model: modelId,
    stream: false,
    messages: apiMessages,
    ...(temperature !== undefined ? { temperature } : {}),
    ...(maxTokens !== undefined ? { max_tokens: maxTokens } : {}),
  }
  if (tools?.length) {
    body.tools = tools
    body.tool_choice = toolChoice ?? 'auto'
  }
  if (responseFormat) body.response_format = responseFormat

  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: headers(apiKey),
    signal,
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status}: ${text}`)
  }
  const data = await res.json()
  const content = data?.choices?.[0]?.message?.content
  if (typeof content !== 'string') {
    throw new Error('No content returned from model.')
  }
  return content
}

export interface StreamDoneMeta {
  finishReason?: string | null
  toolCalls?: ReturnType<typeof accumulatorToOpenAIToolCalls> | null
}

export type StreamChatOptions = {
  apiKey: string
  modelId: string
  messages: Message[]
  systemPrompt?: string
  temperature?: number
  maxTokens?: number
  tools?: unknown[]
  toolChoice?: unknown
  responseFormat?: unknown
  onDelta: (delta: string) => void
  onReasoningDelta?: (delta: string) => void
  onDone: (tokenCount?: number, meta?: StreamDoneMeta) => void
  onError: (err: Error) => void
}

function extractReasoningChunk(delta: Record<string, unknown>): string {
  const r = delta.reasoning ?? delta.reasoning_content
  if (typeof r === 'string') return r
  if (r && typeof r === 'object' && 'text' in r && typeof (r as { text?: unknown }).text === 'string') {
    return (r as { text: string }).text
  }
  return ''
}

export function streamChat(opts: StreamChatOptions): () => void {
  const {
    apiKey,
    modelId,
    messages,
    systemPrompt,
    onDelta,
    onReasoningDelta,
    onDone,
    onError,
    temperature,
    maxTokens,
    tools,
    toolChoice,
    responseFormat,
  } = opts
  const controller = new AbortController()

  const apiMessages: ApiMessage[] = systemPrompt
    ? [{ role: 'system', content: systemPrompt }, ...messagesToApiMessages(messages)]
    : messagesToApiMessages(messages)

  const body: Record<string, unknown> = {
    model: modelId,
    stream: true,
    messages: apiMessages,
    ...(temperature !== undefined ? { temperature } : {}),
    ...(maxTokens !== undefined ? { max_tokens: maxTokens } : {}),
  }
  if (tools?.length) {
    body.tools = tools
    body.tool_choice = toolChoice ?? 'auto'
  }
  if (responseFormat) body.response_format = responseFormat

  ;(async () => {
    let res: Response
    try {
      res = await fetch(`${BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: headers(apiKey),
        body: JSON.stringify(body),
        signal: controller.signal,
      })
    } catch (err) {
      if ((err as Error).name !== 'AbortError') onError(err as Error)
      return
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      onError(new Error(`HTTP ${res.status}: ${text}`))
      return
    }

    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let totalChars = 0
    let finishReason: string | null | undefined
    const toolAcc: ToolCallAccumulator = new Map()

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          const toolCalls = toolAcc.size ? accumulatorToOpenAIToolCalls(toolAcc) : null
          onDone(Math.ceil(totalChars / 4), { finishReason, toolCalls: toolCalls?.length ? toolCalls : null })
          break
        }

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data: ')) continue
          const data = trimmed.slice(6)
          if (data === '[DONE]') {
            const toolCalls = toolAcc.size ? accumulatorToOpenAIToolCalls(toolAcc) : null
            onDone(Math.ceil(totalChars / 4), { finishReason, toolCalls: toolCalls?.length ? toolCalls : null })
            return
          }
          try {
            const parsed = JSON.parse(data) as {
              choices?: Array<{
                delta?: Record<string, unknown>
                finish_reason?: string | null
              }>
            }
            const choice = parsed.choices?.[0]
            if (choice?.finish_reason) finishReason = choice.finish_reason

            const d = choice?.delta
            if (d && typeof d === 'object') {
              const reasoning = extractReasoningChunk(d)
              if (reasoning) onReasoningDelta?.(reasoning)

              const delta = d.content
              if (typeof delta === 'string' && delta) {
                totalChars += delta.length
                onDelta(delta)
              }

              const rawTc = d.tool_calls as
                | Array<{ index?: number; id?: string; function?: { name?: string; arguments?: string } }>
                | undefined
              if (Array.isArray(rawTc) && rawTc.length) mergeToolCallDeltas(toolAcc, rawTc)
            }
          } catch {
            // malformed chunk — skip
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') onError(err as Error)
    }
  })()

  return () => controller.abort()
}
