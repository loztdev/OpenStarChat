import { useRef, useEffect, useState, useCallback } from 'react'
import { Send, Square, ChevronDown, Paperclip, X } from 'lucide-react'
import clsx from 'clsx'
import type { Chat, Character } from '../../types'
import { useSettingsStore } from '../../store/settingsStore'
import { completeFree, getPollinationsProvider, getCustomProvider } from '../../api/freeProvider'
import { completeChat } from '../../api/openrouter'

const DRAFT_KEY = 'openstarchat-drafts'

function loadDraft(chatId: string): string {
  try {
    const drafts = JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}')
    return drafts[chatId] ?? ''
  } catch { return '' }
}

function saveDraft(chatId: string, text: string) {
  try {
    const drafts = JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}')
    if (text) drafts[chatId] = text
    else delete drafts[chatId]
    localStorage.setItem(DRAFT_KEY, JSON.stringify(drafts))
  } catch { /* noop */ }
}

interface ChatInputProps {
  chat: Chat
  character: Character | null
  isStreaming: boolean
  onSend: (content: string, imageUrl?: string) => void
  onCancel: () => void
  onOpenModelPicker: () => void
  onOpenCharacters: () => void
}

export function ChatInput({
  chat,
  character,
  isStreaming,
  onSend,
  onCancel,
  onOpenModelPicker,
  onOpenCharacters,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [attachedImage, setAttachedImage] = useState<string | null>(null)
  const [attachedName, setAttachedName] = useState<string>('')
  const [ghostText, setGhostText] = useState('')
  const predictiveText = useSettingsStore((s) => s.predictiveText)
  const apiKey = useSettingsStore((s) => s.apiKey)
  const freeProvider = useSettingsStore((s) => s.freeProvider)
  const predictionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const predictionAbortRef = useRef<AbortController | null>(null)
  const lastChatIdRef = useRef(chat.id)

  function autosize() {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`
  }

  // Restore draft when chat changes
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    // Save draft for previous chat
    if (lastChatIdRef.current !== chat.id) {
      saveDraft(lastChatIdRef.current, ta.value)
    }
    lastChatIdRef.current = chat.id
    // Load draft for current chat
    ta.value = loadDraft(chat.id)
    autosize()
    setGhostText('')
  }, [chat.id])

  // Periodically save draft as user types
  const handleInput = useCallback(() => {
    autosize()
    const val = textareaRef.current?.value ?? ''
    saveDraft(chat.id, val)

    // Predictive text
    setGhostText('')
    if (predictionTimerRef.current) clearTimeout(predictionTimerRef.current)
    if (predictionAbortRef.current) predictionAbortRef.current.abort()

    if (predictiveText && val.length >= 5) {
      predictionTimerRef.current = setTimeout(() => {
        requestPrediction(val)
      }, 800)
    }
  }, [chat.id, predictiveText])

  // Save draft on unmount
  useEffect(() => {
    return () => {
      const ta = textareaRef.current
      if (ta) saveDraft(chat.id, ta.value)
    }
  }, [chat.id])

  const requestPrediction = useCallback(async (text: string) => {
    const controller = new AbortController()
    predictionAbortRef.current = controller

    const msgs = [{ role: 'user' as const, content: text }]
    const sysPrompt = 'You are an autocomplete engine. The user is typing a message in a chat app. Continue their text naturally with 5-15 words. Output ONLY the completion text, nothing else. Do not repeat what they already typed.'

    try {
      let completion: string

      if (freeProvider.enabled && !apiKey) {
        const provider = freeProvider.type === 'pollinations'
          ? getPollinationsProvider(freeProvider.pollinationsKey, freeProvider.pollinationsModel)
          : getCustomProvider(freeProvider.customUrl, freeProvider.customKey, freeProvider.customModel)
        completion = await completeFree({
          provider,
          messages: msgs,
          systemPrompt: sysPrompt,
          signal: controller.signal,
          temperature: 0.3,
          maxTokens: 30,
        })
      } else if (apiKey) {
        completion = await completeChat({
          apiKey,
          modelId: 'openai/gpt-4o-mini',
          messages: msgs,
          systemPrompt: sysPrompt,
          signal: controller.signal,
          temperature: 0.3,
        })
      } else {
        return
      }

      if (!controller.signal.aborted && completion) {
        setGhostText(completion.trim())
      }
    } catch {
      // prediction failed silently
    }
  }, [apiKey, freeProvider])

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Accept prediction with Tab
    if (e.key === 'Tab' && ghostText && !e.shiftKey) {
      e.preventDefault()
      const ta = textareaRef.current
      if (ta) {
        ta.value = ta.value + ghostText
        saveDraft(chat.id, ta.value)
        autosize()
      }
      setGhostText('')
      return
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  function submit() {
    const val = textareaRef.current?.value.trim()
    if ((!val && !attachedImage) || isStreaming) return
    if (textareaRef.current) {
      textareaRef.current.value = ''
      autosize()
    }
    saveDraft(chat.id, '')
    setGhostText('')
    const img = attachedImage ?? undefined
    setAttachedImage(null)
    setAttachedName('')
    onSend(val ?? '', img)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = () => {
      setAttachedImage(reader.result as string)
      setAttachedName(file.name)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const modelParts = chat.modelId.split('/')
  const provider = modelParts[0] ?? ''
  const modelShort = modelParts.slice(1).join('/') || chat.modelId

  return (
    <div
      className="border-t border-subtle p-3"
      style={{ background: 'var(--bg-secondary)' }}
    >
      {/* Context bar */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <button
          onClick={onOpenModelPicker}
          className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border border-subtle btn-ghost font-medium"
          title="Change model"
        >
          <span className="text-muted capitalize">{provider}</span>
          <span>/</span>
          <span>{modelShort}</span>
          <ChevronDown size={11} className="text-muted" />
        </button>

        <button
          onClick={onOpenCharacters}
          className={clsx(
            'flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border border-subtle btn-ghost font-medium',
            character ? 'border-accent' : ''
          )}
          style={character ? { borderColor: character.color } : undefined}
          title="Change character"
        >
          {character ? (
            <>
              {character.avatarUrl ? (
                <img
                  src={character.avatarUrl}
                  alt=""
                  className="w-4 h-4 rounded-full object-cover"
                />
              ) : (
                <span>{character.emoji}</span>
              )}
              <span>{character.name}</span>
            </>
          ) : (
            <span className="text-muted">No Character</span>
          )}
          <ChevronDown size={11} className="text-muted" />
        </button>

        {chat.systemPrompt && (
          <span
            className="text-xs px-2 py-0.5 rounded-full"
            style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
            title={chat.systemPrompt}
          >
            📋 System prompt set
          </span>
        )}
      </div>

      {/* Image preview */}
      {attachedImage && (
        <div className="flex items-center gap-2 mb-2 px-1">
          <img src={attachedImage} alt="Attachment preview" className="h-12 w-12 object-cover rounded-lg border border-subtle" />
          <span className="text-xs text-muted truncate flex-1">{attachedName}</span>
          <button
            onClick={() => { setAttachedImage(null); setAttachedName('') }}
            className="btn-ghost p-1 rounded"
            title="Remove image"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* Input row */}
      <div
        className="flex items-end gap-2 rounded-xl border border-subtle p-2"
        style={{ background: 'var(--bg-tertiary)' }}
      >
        <button
          onClick={() => fileInputRef.current?.click()}
          className="shrink-0 p-1.5 rounded-lg btn-ghost"
          title="Attach image"
          disabled={isStreaming}
        >
          <Paperclip size={15} />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />

        <div className="flex-1 relative min-h-[1.5rem]">
          <textarea
            ref={textareaRef}
            rows={1}
            placeholder="Message… (Enter to send, Shift+Enter for newline)"
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            disabled={isStreaming}
            className="w-full bg-transparent outline-none resize-none text-sm leading-relaxed min-h-[1.5rem] max-h-[200px] relative z-10"
            style={{ color: 'var(--text-primary)' }}
          />
          {ghostText && (
            <div
              className="absolute top-0 left-0 text-sm leading-relaxed pointer-events-none whitespace-pre-wrap break-words w-full"
              style={{ color: 'var(--text-secondary)', opacity: 0.4 }}
              aria-hidden
            >
              <span style={{ visibility: 'hidden' }}>{textareaRef.current?.value ?? ''}</span>
              <span>{ghostText}</span>
              <span className="text-xs ml-1" style={{ opacity: 0.6 }}>⇥ Tab</span>
            </div>
          )}
        </div>

        {isStreaming ? (
          <button
            onClick={onCancel}
            className="shrink-0 p-2 rounded-lg transition-colors"
            style={{ background: 'var(--danger)', color: 'white' }}
            title="Stop generation"
          >
            <Square size={14} />
          </button>
        ) : (
          <button
            onClick={submit}
            className="shrink-0 p-2 rounded-lg btn-primary"
            title="Send (Enter)"
          >
            <Send size={14} />
          </button>
        )}
      </div>
    </div>
  )
}
