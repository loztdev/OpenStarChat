import type { Message } from '../types'
import type { ApiMessage } from './openrouter'

function buildApiMessage(msg: Pick<Message, 'role' | 'content' | 'imageUrl'>): ApiMessage {
  if (msg.role === 'user' && msg.imageUrl) {
    return {
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: msg.imageUrl } },
        { type: 'text', text: msg.content },
      ],
    }
  }
  return { role: msg.role, content: msg.content }
}

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

export function getPollinationsProvider(
  apiKey: string,
  model: string,
): FreeProviderInfo {
  return {
    baseUrl: POLLINATIONS_BASE,
    apiKey,
    model: model || 'openai',
  }
}

export function getCustomProvider(
  baseUrl: string,
  apiKey: string,
  model: string,
): FreeProviderInfo {
  return {
    baseUrl: baseUrl.replace(/\/+$/, ''),
    apiKey,
    model,
  }
}

export type StreamFreeOptions = {
  provider: FreeProviderInfo
  messages: Pick<Message, 'role' | 'content' | 'imageUrl'>[]
  systemPrompt?: string
  onDelta: (delta: string) => void
  onDone: (tokenCount?: number) => void
  onError: (err: Error) => void
}

export function streamFree(opts: StreamFreeOptions): () => void {
  const { provider, messages, systemPrompt, onDelta, onDone, onError } = opts
  const controller = new AbortController()

  const apiMessages: ApiMessage[] = systemPrompt
    ? [{ role: 'system', content: systemPrompt }, ...messages.map(buildApiMessage)]
    : messages.map(buildApiMessage)

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (provider.apiKey) {
    headers['Authorization'] = `Bearer ${provider.apiKey}`
  }

  ;(async () => {
    let res: Response
    try {
      res = await fetch(`${provider.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: provider.model,
          stream: true,
          messages: apiMessages,
        }),
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

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          onDone(Math.ceil(totalChars / 4))
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
            onDone(Math.ceil(totalChars / 4))
            return
          }
          try {
            const parsed = JSON.parse(data)
            const delta = parsed.choices?.[0]?.delta?.content
            if (typeof delta === 'string' && delta) {
              totalChars += delta.length
              onDelta(delta)
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
  messages: Pick<Message, 'role' | 'content' | 'imageUrl'>[]
  systemPrompt?: string
  signal?: AbortSignal
  temperature?: number
  maxTokens?: number
}

export async function completeFree(opts: CompleteFreeOptions): Promise<string> {
  const { provider, messages, systemPrompt, signal, temperature, maxTokens } = opts

  const apiMessages: ApiMessage[] = systemPrompt
    ? [{ role: 'system', content: systemPrompt }, ...messages.map(buildApiMessage)]
    : messages.map(buildApiMessage)

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
