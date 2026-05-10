import { useRef, useState } from 'react'
import { streamChat } from '../api/openrouter'
import { streamFree, getPollinationsProvider, getCustomProvider } from '../api/freeProvider'
import { useChatStore } from '../store/chatStore'
import { useSettingsStore } from '../store/settingsStore'
import type { Message } from '../types'

export function useStreamingChat() {
  const [isStreaming, setIsStreaming] = useState(false)
  const cancelRef = useRef<(() => void) | null>(null)
  const addMessage = useChatStore((s) => s.addMessage)
  const updateMessage = useChatStore((s) => s.updateMessage)
  const finalizeMessage = useChatStore((s) => s.finalizeMessage)
  const truncateMessagesAfter = useChatStore((s) => s.truncateMessagesAfter)
  const chats = useChatStore((s) => s.chats)
  const apiKey = useSettingsStore((s) => s.apiKey)
  const freeProvider = useSettingsStore((s) => s.freeProvider)
  const pushRecentModel = useSettingsStore((s) => s.pushRecentModel)

  const useFree = freeProvider.enabled && !apiKey

  function cancelStream() {
    cancelRef.current?.()
    cancelRef.current = null
    setIsStreaming(false)
  }

  function _stream(
    chatId: string,
    historyMessages: Pick<Message, 'role' | 'content' | 'imageUrl'>[],
    modelId: string,
    systemPrompt: string | undefined
  ) {
    const assistantMsg: Message = addMessage(chatId, {
      role: 'assistant',
      content: '',
      isStreaming: true,
    })

    setIsStreaming(true)

    let accumulated = ''

    const callbacks = {
      onDelta: (delta: string) => {
        accumulated += delta
        updateMessage(chatId, assistantMsg.id, accumulated)
      },
      onDone: (tokenCount?: number) => {
        finalizeMessage(chatId, assistantMsg.id, tokenCount)
        setIsStreaming(false)
        cancelRef.current = null
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
      const provider = freeProvider.type === 'pollinations'
        ? getPollinationsProvider(freeProvider.pollinationsKey, freeProvider.pollinationsModel)
        : getCustomProvider(freeProvider.customUrl, freeProvider.customKey, freeProvider.customModel)

      cancel = streamFree({
        provider,
        messages: historyMessages,
        systemPrompt,
        ...callbacks,
      })
    } else {
      cancel = streamChat({
        apiKey,
        modelId,
        messages: historyMessages,
        systemPrompt,
        ...callbacks,
      })
    }

    cancelRef.current = cancel
  }

  function sendMessage(chatId: string, userContent: string, imageUrl?: string) {
    const chat = chats.find((c) => c.id === chatId)
    if (!chat) return

    pushRecentModel(chat.modelId)
    cancelRef.current?.()

    addMessage(chatId, { role: 'user', content: userContent, imageUrl })

    const historyMessages: Pick<Message, 'role' | 'content' | 'imageUrl'>[] = [
      ...chat.messages.map(({ role, content, imageUrl }) => ({ role, content, imageUrl })),
      { role: 'user' as const, content: userContent, imageUrl },
    ]

    _stream(chatId, historyMessages, chat.modelId, chat.systemPrompt || undefined)
  }

  function regenerate(chatId: string) {
    const chat = chats.find((c) => c.id === chatId)
    if (!chat) return

    // Find the last assistant message and remove it
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

    // Build history up to (but not including) the removed assistant message
    const historyMessages = messages
      .slice(0, lastAssistantIdx)
      .map(({ role, content, imageUrl }) => ({ role, content, imageUrl }))

    cancelRef.current?.()
    pushRecentModel(chat.modelId)
    _stream(chatId, historyMessages, chat.modelId, chat.systemPrompt || undefined)
  }

  function editAndResend(chatId: string, messageId: string, newContent: string) {
    const chat = chats.find((c) => c.id === chatId)
    if (!chat) return

    const idx = chat.messages.findIndex((m) => m.id === messageId)
    if (idx === -1) return

    // Truncate everything after this message (removes old response)
    const nextMsg = chat.messages[idx + 1]
    if (nextMsg) {
      truncateMessagesAfter(chatId, nextMsg.id)
    }

    // Update the user message content
    updateMessage(chatId, messageId, newContent)

    // Build history up to and including this edited message
    const historyMessages = [
      ...chat.messages
        .slice(0, idx)
        .map(({ role, content, imageUrl }) => ({ role, content, imageUrl })),
      { role: 'user' as const, content: newContent, imageUrl: chat.messages[idx].imageUrl },
    ]

    cancelRef.current?.()
    pushRecentModel(chat.modelId)
    _stream(chatId, historyMessages, chat.modelId, chat.systemPrompt || undefined)
  }

  return { sendMessage, regenerate, editAndResend, isStreaming, cancelStream, useFreeProvider: useFree }
}
