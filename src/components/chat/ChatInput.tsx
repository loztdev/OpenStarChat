import { useRef, useEffect, useState, useCallback } from 'react'
import { Send, Square, ChevronDown, Paperclip, X, Mic, MicOff, Thermometer, SlidersHorizontal, Wrench, Braces } from 'lucide-react'
import clsx from 'clsx'
import type { Chat, Character, Message } from '../../types'
import { useSettingsStore } from '../../store/settingsStore'
import { useChatStore } from '../../store/chatStore'
import { completeFree, getPollinationsProvider, getCustomProvider } from '../../api/freeProvider'
import { completeChat } from '../../api/openrouter'
import { MarkdownContent } from './MarkdownContent'
import { extractPdfTextAsString } from '../../utils/extractPdfText'

interface SpeechResult {
  readonly [index: number]: { transcript: string }
}
interface SpeechEvent {
  results: ArrayLike<SpeechResult>
}
type SpeechRecognitionInstance = {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((e: SpeechEvent) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
  start: () => void
  stop: () => void
}

function createSpeechRecognition(): SpeechRecognitionInstance | null {
  const W = window as unknown as Record<string, unknown>
  const Ctor = W.SpeechRecognition ?? W.webkitSpeechRecognition
  if (!Ctor) return null
  return new (Ctor as new () => SpeechRecognitionInstance)()
}

const HAS_SPEECH =
  typeof window !== 'undefined' &&
  (!!(window as unknown as Record<string, unknown>).SpeechRecognition ||
    !!(window as unknown as Record<string, unknown>).webkitSpeechRecognition)

const DRAFT_KEY = 'openstarchat-drafts'

function loadDraft(chatId: string): string {
  try {
    const drafts = JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}')
    return drafts[chatId] ?? ''
  } catch {
    return ''
  }
}

function saveDraft(chatId: string, text: string) {
  try {
    const drafts = JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}')
    if (text) drafts[chatId] = text
    else delete drafts[chatId]
    localStorage.setItem(DRAFT_KEY, JSON.stringify(drafts))
  } catch {
    /* noop */
  }
}

type Attachment =
  | { id: string; kind: 'image'; dataUrl: string; name: string }
  | { id: string; kind: 'file_text'; name: string; text: string }

const MAX_ATTACHMENTS = 8
const MAX_IMAGES = 4

interface ChatInputProps {
  chat: Chat
  character: Character | null
  isStreaming: boolean
  onSend: (
    content: string,
    opts?: { imageUrls?: string[]; imageUrl?: string; fileExtracts?: { name: string; text: string }[] },
  ) => void
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
  const underlayRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState('')
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [ghostText, setGhostText] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [showParams, setShowParams] = useState(false)
  const recognitionRef = useRef<ReturnType<typeof createSpeechRecognition> | null>(null)
  const updateChat = useChatStore((s) => s.updateChat)
  const predictiveText = useSettingsStore((s) => s.predictiveText)
  const apiKey = useSettingsStore((s) => s.apiKey)
  const freeProvider = useSettingsStore((s) => s.freeProvider)
  const predictionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const predictionAbortRef = useRef<AbortController | null>(null)
  const lastChatIdRef = useRef(chat.id)

  function autosize() {
    const ta = textareaRef.current
    const under = underlayRef.current
    if (!ta) return
    ta.style.height = 'auto'
    const h = Math.min(ta.scrollHeight, 200)
    ta.style.height = `${h}px`
    if (under) under.style.height = `${h}px`
  }

  useEffect(() => {
    if (lastChatIdRef.current !== chat.id) {
      saveDraft(lastChatIdRef.current, draft)
    }
    lastChatIdRef.current = chat.id
    const next = loadDraft(chat.id)
    setDraft(next)
    setAttachments([])
    setGhostText('')
    setTimeout(() => autosize(), 0)
  }, [chat.id])

  useEffect(() => {
    autosize()
  }, [draft])

  useEffect(() => {
    return () => {
      saveDraft(chat.id, draft)
    }
  }, [chat.id, draft])

  const requestPrediction = useCallback(
    async (text: string) => {
      const controller = new AbortController()
      predictionAbortRef.current = controller
      const msgs: Message[] = [{ id: 'pred', role: 'user', content: text, createdAt: Date.now() }]
      const sysPrompt =
        'You are an autocomplete engine. The user is typing a message in a chat app. Continue their text naturally with 5-15 words. Output ONLY the completion text, nothing else. Do not repeat what they already typed.'

      try {
        let completion: string
        if (freeProvider.enabled && !apiKey) {
          const provider =
            freeProvider.type === 'pollinations'
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
            maxTokens: 30,
          })
        } else {
          return
        }
        if (!controller.signal.aborted && completion) {
          setGhostText(completion.trim())
        }
      } catch {
        /* prediction failed silently */
      }
    },
    [apiKey, freeProvider],
  )

  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const val = e.target.value
      setDraft(val)
      saveDraft(chat.id, val)
      setGhostText('')
      if (predictionTimerRef.current) clearTimeout(predictionTimerRef.current)
      if (predictionAbortRef.current) predictionAbortRef.current.abort()
      if (predictiveText && val.length >= 5) {
        predictionTimerRef.current = setTimeout(() => {
          void requestPrediction(val)
        }, 800)
      }
    },
    [chat.id, predictiveText, requestPrediction],
  )

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Tab' && ghostText && !e.shiftKey) {
      e.preventDefault()
      const next = draft + ghostText
      setDraft(next)
      saveDraft(chat.id, next)
      setGhostText('')
      return
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  function submit() {
    const val = draft.trim()
    const images = attachments.filter((a): a is Attachment & { kind: 'image' } => a.kind === 'image')
    const files = attachments.filter((a): a is Attachment & { kind: 'file_text' } => a.kind === 'file_text')
    if ((!val && images.length === 0) || isStreaming) return
    const imageUrls = images.slice(0, MAX_IMAGES).map((i) => i.dataUrl)
    const fileExtracts = files.map((f) => ({ name: f.name, text: f.text }))
    setDraft('')
    saveDraft(chat.id, '')
    setGhostText('')
    setAttachments([])
    if (imageUrls.length === 1) {
      onSend(val, {
        imageUrl: imageUrls[0],
        imageUrls,
        fileExtracts: fileExtracts.length ? fileExtracts : undefined,
      })
    } else if (imageUrls.length > 1) {
      onSend(val, { imageUrls, fileExtracts: fileExtracts.length ? fileExtracts : undefined })
    } else {
      onSend(val, { fileExtracts: fileExtracts.length ? fileExtracts : undefined })
    }
  }

  function toggleVoice() {
    if (isListening) {
      recognitionRef.current?.stop()
      setIsListening(false)
      return
    }
    const recognition = createSpeechRecognition()
    if (!recognition) return
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = navigator.language || 'en-US'
    recognition.onresult = (event: SpeechEvent) => {
      const transcript = Array.from(event.results)
        .map((r) => r[0].transcript)
        .join('')
      setDraft(transcript)
      saveDraft(chat.id, transcript)
    }
    recognition.onend = () => setIsListening(false)
    recognition.onerror = () => setIsListening(false)
    recognition.start()
    recognitionRef.current = recognition
    setIsListening(true)
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const fileList = e.target.files
    if (!fileList?.length) return
    const next: Attachment[] = [...attachments]
    for (const file of Array.from(fileList)) {
      if (next.length >= MAX_ATTACHMENTS) break
      if (file.type.startsWith('image/')) {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = () => reject(new Error('read'))
          reader.readAsDataURL(file)
        })
        const imgs = next.filter((a) => a.kind === 'image')
        if (imgs.length >= MAX_IMAGES) continue
        next.push({ id: `${Date.now()}-${file.name}`, kind: 'image', dataUrl, name: file.name })
      } else if (file.type === 'application/pdf') {
        try {
          const text = await extractPdfTextAsString(file)
          next.push({
            id: `${Date.now()}-${file.name}`,
            kind: 'file_text',
            name: file.name,
            text: text || '(no extractable text in PDF)',
          })
        } catch {
          next.push({
            id: `${Date.now()}-${file.name}`,
            kind: 'file_text',
            name: file.name,
            text: '(could not read PDF — try copying text manually)',
          })
        }
      } else if (
        file.type.startsWith('text/') ||
        file.name.endsWith('.md') ||
        file.name.endsWith('.txt') ||
        file.name.endsWith('.json') ||
        file.name.endsWith('.csv')
      ) {
        const text = await file.text()
        next.push({ id: `${Date.now()}-${file.name}`, kind: 'file_text', name: file.name, text })
      }
    }
    setAttachments(next)
    e.target.value = ''
  }

  function removeAttachment(id: string) {
    setAttachments((prev) => prev.filter((a) => a.id !== id))
  }

  const modelParts = chat.modelId.split('/')
  const provider = modelParts[0] ?? ''
  const modelShort = modelParts.slice(1).join('/') || chat.modelId

  const imageAttachments = attachments.filter((a) => a.kind === 'image')

  return (
    <div className="border-t border-subtle p-3" style={{ background: 'var(--bg-secondary)' }}>
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
            character ? 'border-accent' : '',
          )}
          style={character ? { borderColor: character.color } : undefined}
          title="Change character"
        >
          {character ? (
            <>
              {character.avatarUrl ? (
                <img src={character.avatarUrl} alt="" className="w-4 h-4 rounded-full object-cover" />
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

        <button
          onClick={() => setShowParams((v) => !v)}
          className={clsx(
            'flex items-center gap-1 text-xs px-2 py-1 rounded-full border border-subtle btn-ghost',
            showParams && 'accent-text',
          )}
          style={showParams ? { borderColor: 'var(--accent)' } : undefined}
          title="Model parameters & advanced"
        >
          <SlidersHorizontal size={11} />
        </button>
      </div>

      {showParams && (
        <div className="flex flex-col gap-3 mb-2 px-2 py-2 rounded-lg text-xs" style={{ background: 'var(--bg-tertiary)' }}>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <Thermometer size={12} className="text-muted shrink-0" />
              <span className="text-muted shrink-0">Temp</span>
              <input
                type="range"
                min={0}
                max={2}
                step={0.1}
                value={chat.temperature ?? 1}
                onChange={(e) => updateChat(chat.id, { temperature: parseFloat(e.target.value) })}
                className="flex-1 accent-accent"
              />
              <span className="w-6 text-right font-mono">{(chat.temperature ?? 1).toFixed(1)}</span>
            </div>
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <span className="text-muted shrink-0">Max</span>
              <input
                type="number"
                min={1}
                max={128000}
                step={256}
                value={chat.maxTokens ?? 4096}
                onChange={(e) => updateChat(chat.id, { maxTokens: parseInt(e.target.value, 10) || 4096 })}
                className="w-20 px-2 py-1 rounded border border-subtle bg-transparent outline-none text-xs font-mono"
                style={{ color: 'var(--text-primary)', background: 'var(--bg-secondary)' }}
              />
              <span className="text-muted">tokens</span>
            </div>
          </div>

          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={!!chat.experimentalTools}
              onChange={(e) => updateChat(chat.id, { experimentalTools: e.target.checked })}
              className="mt-0.5"
            />
            <span>
              <span className="flex items-center gap-1 font-medium">
                <Wrench size={12} /> Built-in tools (time, random int)
              </span>
              <span className="block text-muted mt-0.5">
                The model may call safe tools that run in your browser. Optional JSON below merges with these; only
                built-in tool names execute locally.
              </span>
            </span>
          </label>

          <div>
            <span className="flex items-center gap-1 text-muted mb-1">
              <Braces size={11} /> Extra tools JSON (optional array)
            </span>
            <textarea
              value={chat.toolsJson ?? ''}
              onChange={(e) => updateChat(chat.id, { toolsJson: e.target.value })}
              placeholder='[{"type":"function","function":{"name":"…","description":"…","parameters":{…}}}]'
              rows={3}
              className="w-full px-2 py-1.5 rounded border border-subtle bg-transparent outline-none font-mono text-[11px]"
              style={{ color: 'var(--text-primary)', background: 'var(--bg-secondary)' }}
            />
          </div>

          <div>
            <span className="text-muted mb-1 block">JSON Schema for structured replies (optional)</span>
            <textarea
              value={chat.jsonSchemaText ?? ''}
              onChange={(e) => updateChat(chat.id, { jsonSchemaText: e.target.value })}
              placeholder='{ "type": "object", "properties": { … } }'
              rows={4}
              className="w-full px-2 py-1.5 rounded border border-subtle bg-transparent outline-none font-mono text-[11px]"
              style={{ color: 'var(--text-primary)', background: 'var(--bg-secondary)' }}
            />
          </div>
        </div>
      )}

      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {attachments.map((a) => (
            <div
              key={a.id}
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-subtle text-xs max-w-[220px]"
              style={{ background: 'var(--bg-tertiary)' }}
            >
              {a.kind === 'image' ? (
                <img src={a.dataUrl} alt="" className="h-8 w-8 object-cover rounded" />
              ) : (
                <span className="text-muted truncate">{a.name}</span>
              )}
              <button type="button" onClick={() => removeAttachment(a.id)} className="btn-ghost p-0.5 rounded" title="Remove">
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2 rounded-xl border border-subtle p-2" style={{ background: 'var(--bg-tertiary)' }}>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="shrink-0 p-1.5 rounded-lg btn-ghost"
          title="Attach images, PDF, or text files"
          disabled={isStreaming}
        >
          <Paperclip size={15} />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf,text/*,.md,.txt,.json,.csv"
          multiple
          className="hidden"
          onChange={(e) => void handleFileChange(e)}
        />

        <div className="flex-1 relative min-h-[1.5rem] max-h-[200px] overflow-hidden">
          <div
            ref={underlayRef}
            className="absolute inset-0 overflow-y-auto pointer-events-none z-0 px-0 py-0 text-sm leading-relaxed opacity-90"
            aria-hidden
          >
            <MarkdownContent text={draft || '\u00a0'} variant="composer" />
          </div>
          <textarea
            ref={textareaRef}
            rows={1}
            value={draft}
            onChange={handleInput}
            onScroll={(e) => {
              if (underlayRef.current) underlayRef.current.scrollTop = e.currentTarget.scrollTop
            }}
            placeholder="Message… (Enter to send, Shift+Enter for newline)"
            onKeyDown={handleKeyDown}
            disabled={isStreaming}
            spellCheck
            className="composer-md-input w-full bg-transparent outline-none resize-none text-sm leading-relaxed min-h-[1.5rem] max-h-[200px] relative z-10 overflow-y-auto text-transparent caret-auto"
            style={{ caretColor: 'var(--text-primary)' }}
          />
          {ghostText && (
            <div
              className="absolute top-0 left-0 z-20 text-sm leading-relaxed pointer-events-none whitespace-pre-wrap break-words w-full"
              style={{ color: 'var(--text-secondary)', opacity: 0.45 }}
              aria-hidden
            >
              <span className="invisible">{draft}</span>
              <span>{ghostText}</span>
              <span className="text-xs ml-1" style={{ opacity: 0.65 }}>
                ⇥ Tab
              </span>
            </div>
          )}
        </div>

        {HAS_SPEECH && !isStreaming && (
          <button
            onClick={toggleVoice}
            className={clsx('shrink-0 p-1.5 rounded-lg btn-ghost', isListening && 'animate-pulse')}
            style={isListening ? { color: 'var(--danger)' } : undefined}
            title={isListening ? 'Stop listening' : 'Voice input'}
          >
            {isListening ? <MicOff size={14} /> : <Mic size={14} />}
          </button>
        )}

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
            disabled={!draft.trim() && imageAttachments.length === 0}
            className="shrink-0 p-2 rounded-lg btn-primary disabled:opacity-40"
            title="Send (Enter)"
          >
            <Send size={14} />
          </button>
        )}
      </div>
    </div>
  )
}
