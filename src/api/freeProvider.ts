import type { Message } from '../types'
import type { ApiMessage } from './openrouter'
import { messageToApiMessage } from './openrouter'
import { mergeToolCallDeltas, accumulatorToOpenAIToolCalls, type ToolCallAccumulator } from './builtinTools'
import type { StreamDoneMeta } from './openrouter'

export interface FreeProviderInfo {
  baseUrl: string
  apiKey: string
  model: string
}

const POLLINATIONS_BASE = 'https://gen.pollinations.ai'

export const POLLINATIONS_MODELS = [
  { id: 'openai', label: 'OpenAI (GPT)' },
  { id: 'openai-large', label: 'OpenAI Large' },
  { id: 'openai-reasoning', label: 'OpenAI Reasoning' },
  { id: 'qwen-coder', label: 'Qwen Coder' },
  { id: 'llama', label: 'Llama' },
  { id: 'mistral', label: 'Mistral' },
  { id: 'deepseek', label: 'DeepSeek' },
  { id: 'deepseek-reasoning', label: 'DeepSeek Reasoning' },
  { id: 'gemini', label: 'Gemini' },
  { id: 'claude-hybridspace', label: 'Claude (via HybridSpace)' },
] as const

export function getPollinationsProvider(apiKey: string, model: string): FreeProviderInfo {
  return {
    baseUrl: POLLINATIONS_BASE,
    apiKey,
    model: model || 'openai',
  }
}

export function getCustomProvider(baseUrl: string, apiKey: string, model: string): FreeProviderInfo {
  return {
    baseUrl: baseUrl.replace(/\/+$/, ''),
    apiKey,
    model,
  }
}

export type StreamFreeOptions = {
  provider: FreeProviderInfo
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

export function streamFree(opts: StreamFreeOptions): () => void {
  const {
    provider,
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
    ? [{ role: 'system', content: systemPrompt }, ...messages.map((m) => messageToApiMessage(m))]
    : messages.map((m) => messageToApiMessage(m))

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (provider.apiKey) {
    headers['Authorization'] = `Bearer ${provider.apiKey}`
  }

  const body: Record<string, unknown> = {
    model: provider.model,
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
      res = await fetch(`${provider.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers,
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
            // malformed chunk
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') onError(err as Error)
    }
  })()

  return () => controller.abort()
}

export type CompleteFreeOptions = {
  provider: FreeProviderInfo
  messages: Message[]
  systemPrompt?: string
  signal?: AbortSignal
  temperature?: number
  maxTokens?: number
}

export async function completeFree(opts: CompleteFreeOptions): Promise<string> {
  const { provider, messages, systemPrompt, signal, temperature, maxTokens } = opts

  const apiMessages: ApiMessage[] = systemPrompt
    ? [{ role: 'system', content: systemPrompt }, ...messages.map((m) => messageToApiMessage(m))]
    : messages.map((m) => messageToApiMessage(m))

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (provider.apiKey) {
    headers['Authorization'] = `Bearer ${provider.apiKey}`
  }

  const res = await fetch(`${provider.baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers,
    signal,
    body: JSON.stringify({
      model: provider.model,
      stream: false,
      messages: apiMessages,
      ...(temperature !== undefined ? { temperature } : {}),
      ...(maxTokens !== undefined ? { max_tokens: maxTokens } : {}),
    }),
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
