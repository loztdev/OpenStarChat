import { useRef, useState } from 'react'
import { streamChat } from '../api/openrouter'
import { streamFree, getPollinationsProvider, getCustomProvider } from '../api/freeProvider'
import { useChatStore } from '../store/chatStore'
import { useSettingsStore } from '../store/settingsStore'
import { useMemoryStore } from '../store/memoryStore'
import type { Message } from '../types'
import { generateChatTitle } from '../api/chatTitle'
import {
  BUILTIN_OPENROUTER_TOOLS,
  isBuiltinToolName,
  runBuiltinTool,
} from '../api/builtinTools'

const MAX_TOOL_DEPTH = 6

function parseExtraTools(json?: string): unknown[] {
  if (!json?.trim()) return []
  try {
    const v = JSON.parse(json) as unknown
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

function parseResponseFormat(jsonSchemaText?: string): unknown | undefined {
  if (!jsonSchemaText?.trim()) return undefined
  try {
    const schemaObj = JSON.parse(jsonSchemaText) as Record<string, unknown>
    return {
      type: 'json_schema',
      json_schema: { name: 'response', strict: true, schema: schemaObj },
    }
  } catch {
    return undefined
  }
}

export function useStreamingChat() {
  const [isStreaming, setIsStreaming] = useState(false)
  const cancelRef = useRef<(() => void) | null>(null)
  const titlingRef = useRef(new Set<string>())
  const addMessage = useChatStore((s) => s.addMessage)
  const updateMessage = useChatStore((s) => s.updateMessage)
  const patchMessage = useChatStore((s) => s.patchMessage)
  const finalizeMessage = useChatStore((s) => s.finalizeMessage)
  const truncateMessagesAfter = useChatStore((s) => s.truncateMessagesAfter)
  const renameChat = useChatStore((s) => s.renameChat)
  const apiKey = useSettingsStore((s) => s.apiKey)
  const freeProvider = useSettingsStore((s) => s.freeProvider)
  const pushRecentModel = useSettingsStore((s) => s.pushRecentModel)
  const useAiChatTitles = useSettingsStore((s) => s.useAiChatTitles)

  const getActiveMemoryPrompt = useMemoryStore((s) => s.getActiveMemoryPrompt)

  const useFree = freeProvider.enabled && !apiKey

  function cancelStream() {
    cancelRef.current?.()
    cancelRef.current = null
    setIsStreaming(false)
  }

  function maybeRenameWithAiTitle(chatId: string) {
    if (!useAiChatTitles || !apiKey) return
    if (titlingRef.current.has(chatId)) return
    const chat = useChatStore.getState().chats.find((c) => c.id === chatId)
    if (!chat || chat.title !== 'New Chat') return
    const users = chat.messages.filter((m) => m.role === 'user')
    const assts = chat.messages.filter((m) => m.role === 'assistant' && !m.isStreaming)
    if (users.length < 1 || assts.length < 1) return
    const lastAsst = assts[assts.length - 1]
    if (!lastAsst.content.trim() && !lastAsst.assistantToolCalls) return

    titlingRef.current.add(chatId)
    void (async () => {
      try {
        const u0 = users[0]?.content ?? ''
        const a0 = lastAsst.content ?? ''
        const t = await generateChatTitle(apiKey, u0, a0)
        if (t) renameChat(chatId, t)
      } catch {
        /* ignore title failures */
      } finally {
        titlingRef.current.delete(chatId)
      }
    })()
  }

  function _stream(
    chatId: string,
    historyMessages: Message[],
    modelId: string,
    systemPrompt: string | undefined,
    depth: number,
  ) {
    const chat = useChatStore.getState().chats.find((c) => c.id === chatId)
    if (!chat) return

    const assistantMsg = addMessage(chatId, {
      role: 'assistant',
      content: '',
      isStreaming: true,
    })

    setIsStreaming(true)

    let accumulated = ''

    const temperature = chat.temperature
    const maxTokens = chat.maxTokens

    const extraTools = parseExtraTools(chat.toolsJson)
    const tools =
      chat.experimentalTools && (BUILTIN_OPENROUTER_TOOLS.length || extraTools.length)
        ? [...BUILTIN_OPENROUTER_TOOLS, ...extraTools]
        : undefined
    const responseFormat = parseResponseFormat(chat.jsonSchemaText)

    const callbacks = {
      onDelta: (delta: string) => {
        accumulated += delta
        updateMessage(chatId, assistantMsg.id, accumulated)
      },
      onReasoningDelta: (chunk: string) => {
        const st = useChatStore.getState()
        const m = st.chats
          .find((c) => c.id === chatId)
          ?.messages.find((x) => x.id === assistantMsg.id)
        const prev = m?.reasoning ?? ''
        patchMessage(chatId, assistantMsg.id, { reasoning: prev + chunk })
      },
      onDone: (
        tokenCount?: number,
        meta?: { finishReason?: string | null; toolCalls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }> | null },
      ) => {
        const finishReason = meta?.finishReason
        const streamedToolCalls = meta?.toolCalls ?? null

        const shouldTool =
          depth < MAX_TOOL_DEPTH &&
          streamedToolCalls &&
          streamedToolCalls.length > 0 &&
          (finishReason === 'tool_calls' || (!accumulated.trim() && finishReason !== 'length'))

        if (shouldTool) {
          patchMessage(chatId, assistantMsg.id, {
            assistantToolCalls: JSON.stringify(streamedToolCalls),
            content: accumulated,
            isStreaming: false,
            ...(tokenCount !== undefined ? { tokenCount } : {}),
          })

          for (const call of streamedToolCalls) {
            const out = isBuiltinToolName(call.function.name)
              ? runBuiltinTool(call.function.name, call.function.arguments)
              : JSON.stringify({ error: `unsupported_tool:${call.function.name}` })
            addMessage(chatId, {
              role: 'tool',
              content: out,
              toolCallId: call.id,
            })
          }

          const nextHistory = useChatStore.getState().chats.find((c) => c.id === chatId)?.messages ?? []
          const memoryPrompt = getActiveMemoryPrompt()
          const fullSystemPrompt = [memoryPrompt, chat.systemPrompt].filter(Boolean).join('\n\n') || undefined
          _stream(chatId, nextHistory, modelId, fullSystemPrompt, depth + 1)
          return
        }

        finalizeMessage(chatId, assistantMsg.id, tokenCount)
        setIsStreaming(false)
        cancelRef.current = null
        maybeRenameWithAiTitle(chatId)
      },
      onError: (err: Error) => {
        updateMessage(chatId, assistantMsg.id, `⚠️ Error: ${err.message}`)
        finalizeMessage(chatId, assistantMsg.id)
        setIsStreaming(false)
        cancelRef.current = null
      },
    }

    let cancel: () => void

    if (useFree) {
      const provider =
        freeProvider.type === 'pollinations'
          ? getPollinationsProvider(freeProvider.pollinationsKey, freeProvider.pollinationsModel)
          : getCustomProvider(freeProvider.customUrl, freeProvider.customKey, freeProvider.customModel)

      cancel = streamFree({
        provider,
        messages: historyMessages,
        systemPrompt,
        temperature,
        maxTokens,
        tools,
        responseFormat,
        ...callbacks,
      })
    } else {
      cancel = streamChat({
        apiKey,
        modelId,
        messages: historyMessages,
        systemPrompt,
        temperature,
        maxTokens,
        tools,
        responseFormat,
        ...callbacks,
      })
    }

    cancelRef.current = cancel
  }

  function sendMessage(
    chatId: string,
    userContent: string,
    opts?: { imageUrls?: string[]; imageUrl?: string; fileExtracts?: { name: string; text: string }[] },
  ) {
    const chat = useChatStore.getState().chats.find((c) => c.id === chatId)
    if (!chat) return

    pushRecentModel(chat.modelId)
    cancelRef.current?.()

    const urls = [...(opts?.imageUrls ?? [])]
    if (opts?.imageUrl) urls.unshift(opts.imageUrl)
    const dedup = [...new Set(urls)]

    let text = userContent
    if (opts?.fileExtracts?.length) {
      const blocks = opts.fileExtracts
        .map((f) => `### Attached file: ${f.name}\n\n${f.text}`)
        .join('\n\n')
      text = text.trim() ? `${text.trim()}\n\n${blocks}` : blocks
    }

    addMessage(chatId, {
      role: 'user',
      content: text,
      ...(dedup.length === 1
        ? { imageUrl: dedup[0], imageUrls: dedup }
        : dedup.length > 1
          ? { imageUrls: dedup }
          : {}),
    })

    const historyMessages = useChatStore.getState().chats.find((c) => c.id === chatId)?.messages ?? []
    const memoryPrompt = getActiveMemoryPrompt()
    const fullSystemPrompt = [memoryPrompt, chat.systemPrompt].filter(Boolean).join('\n\n') || undefined
    _stream(chatId, historyMessages, chat.modelId, fullSystemPrompt, 0)
  }

  function regenerate(chatId: string) {
    const chat = useChatStore.getState().chats.find((c) => c.id === chatId)
    if (!chat) return

    const messages = [...chat.messages]
    let lastAssistantIdx = -1
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') {
        lastAssistantIdx = i
        break
      }
    }
    if (lastAssistantIdx === -1) return

    const lastAssistantId = messages[lastAssistantIdx].id
    truncateMessagesAfter(chatId, lastAssistantId)

    const historyMessages =
      useChatStore.getState().chats.find((c) => c.id === chatId)?.messages ?? []

    cancelRef.current?.()
    pushRecentModel(chat.modelId)
    const memoryPrompt2 = getActiveMemoryPrompt()
    const fullSys2 = [memoryPrompt2, chat.systemPrompt].filter(Boolean).join('\n\n') || undefined
    _stream(chatId, historyMessages, chat.modelId, fullSys2, 0)
  }

  function editAndResend(chatId: string, messageId: string, newContent: string) {
    const chat = useChatStore.getState().chats.find((c) => c.id === chatId)
    if (!chat) return

    const idx = chat.messages.findIndex((m) => m.id === messageId)
    if (idx === -1) return

    const nextMsg = chat.messages[idx + 1]
    if (nextMsg) {
      truncateMessagesAfter(chatId, nextMsg.id)
    }

    updateMessage(chatId, messageId, newContent)

    const fresh = useChatStore.getState().chats.find((c) => c.id === chatId)
    if (!fresh) return
    const historyMessages = fresh.messages.slice(0, idx + 1)

    cancelRef.current?.()
    pushRecentModel(chat.modelId)
    const memoryPrompt3 = getActiveMemoryPrompt()
    const fullSys3 = [memoryPrompt3, chat.systemPrompt].filter(Boolean).join('\n\n') || undefined
    _stream(chatId, historyMessages, chat.modelId, fullSys3, 0)
  }

  return { sendMessage, regenerate, editAndResend, isStreaming, cancelStream, useFreeProvider: useFree }
}
