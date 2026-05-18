import { useRef, useState } from 'react'
import {
  Sparkles, RefreshCw, Upload, FileText, Image as ImageIcon, X,
  AlertCircle, KeyRound, ChevronRight, ScrollText,
} from 'lucide-react'
import { useSettingsStore } from '../../store/settingsStore'
import { completeChat } from '../../api/openrouter'
import { ModelPicker } from '../models/ModelPicker'
import type { Character, Message } from '../../types'

const EMOJI_OPTIONS = ['🌸', '💻', '✍️', '🧙', '🃏', '🔮', '🦊', '🐉', '🌙', '⚡', '🎯', '🧪', '🤖', '👾', '🦋']
const COLOR_OPTIONS = ['#bd93f9', '#50fa7b', '#ffb86c', '#8be9fd', '#ff79c6', '#ff5555', '#f1fa8c', '#268bd2', '#2aa198', '#859900']

// Dedicated transcriber/character-archivist prompt.
// Distinct from the AI Idea builder — this one assumes you HAVE source material and just need it structured.
const TRANSCRIBE_SYSTEM_PROMPT = `You are a Character Archivist & Transcriber. You ingest raw, messy source material about a character — pasted notes, file excerpts, descriptions, dialogue snippets, possibly reference images — and you produce a single clean, structured character sheet.

Your method:
1. Read EVERYTHING the user provides, including referenced images.
2. Extract every concrete fact: name, aliases, age, species, appearance, voice, personality traits, history/background, relationships, motivations, fears, abilities, quirks, mannerisms, speech patterns, hard limits.
3. Synthesize them faithfully into a JSON object matching the schema below. Do NOT invent contradictory facts. If a field is unspecified in the source, omit it or write a neutral inference clearly grounded in what's there.
4. The "systemPrompt" must be a rich, second-person directive that lets a chat model BECOME this character: identity, voice, behavior, knowledge, quirks, hard limits. Aim for 180-400 words. Do not water down. Do not preach. Do not break the fourth wall. Do not refer to the character as an AI/model/assistant unless they explicitly are one.
5. The "notes" field is a Markdown character sheet for the user's own reference. Use clearly labeled sections, e.g.:
\`\`\`
## Appearance
## Personality
## Background
## Relationships
## Abilities & Skills
## Quirks & Mannerisms
## Voice & Speech
## Notes
\`\`\`
Pull every concrete detail from the source material into the right section. Use bullet points liberally.

Schema:
{
  "name": string (max 60 chars; use the character's actual name from the source),
  "emoji": single emoji from this set: ${EMOJI_OPTIONS.join(' ')} (pick whichever best fits the vibe),
  "color": single hex string from this set: ${COLOR_OPTIONS.join(' ')},
  "description": string (one short sentence, max 200 chars, hooks the reader),
  "tags": string[] (3-6 lowercase one-word tags drawn from genre/role/personality),
  "systemPrompt": string (180-400 words, second-person, vivid, in-character behavior directives),
  "notes": string (Markdown character sheet built from the source material — sections + bullets)
}

Return ONLY the JSON object. No backticks. No commentary. No prose outside the JSON.`

export interface TranscribedDraft {
  name: string
  emoji: string
  color: string
  description: string
  tags: string[]
  systemPrompt: string
  notes: string
}

interface FileEntry {
  id: string
  name: string
  kind: 'text' | 'image'
  content: string
  size: number
}

const MAX_TEXT_BYTES = 200_000
const MAX_IMAGE_BYTES = 1_500_000
const TEXT_EXTS = /\.(txt|md|markdown|json|csv|tsv|yml|yaml|html|htm|rtf|log|xml)$/i

function fileKind(file: File): 'text' | 'image' | null {
  if (file.type.startsWith('image/')) return 'image'
  if (file.type.startsWith('text/')) return 'text'
  if (file.type === 'application/json') return 'text'
  if (TEXT_EXTS.test(file.name)) return 'text'
  return null
}

function tryParseDraft(raw: string): TranscribedDraft | null {
  let text = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return null
  const slice = text.slice(start, end + 1)
  try {
    const obj = JSON.parse(slice)
    if (typeof obj.name !== 'string' || typeof obj.systemPrompt !== 'string') return null
    return {
      name: String(obj.name).slice(0, 60),
      emoji: typeof obj.emoji === 'string' && obj.emoji ? obj.emoji : '🤖',
      color: typeof obj.color === 'string' && /^#[0-9a-f]{6}$/i.test(obj.color) ? obj.color : '#bd93f9',
      description: typeof obj.description === 'string' ? obj.description.slice(0, 240) : '',
      tags: Array.isArray(obj.tags) ? obj.tags.map(String).slice(0, 8) : [],
      systemPrompt: String(obj.systemPrompt).trim(),
      notes: typeof obj.notes === 'string' ? obj.notes.trim() : '',
    }
  } catch {
    return null
  }
}

interface CharacterTranscriberProps {
  onAccept: (draft: Omit<Character, 'id' | 'isBuiltIn'>) => void
  onCancel?: () => void
}

export function CharacterTranscriber({ onAccept, onCancel }: CharacterTranscriberProps) {
  const mainKey = useSettingsStore((s) => s.apiKey)
  const builderKey = useSettingsStore((s) => s.builderApiKey)
  const effectiveKey = builderKey.trim() || mainKey
  const usingBuilderKey = builderKey.trim().length > 0
  const defaultModelId = useSettingsStore((s) => s.defaultModelId)

  const [modelId, setModelId] = useState(defaultModelId)
  const [showPicker, setShowPicker] = useState(false)
  const [pastedText, setPastedText] = useState('')
  const [files, setFiles] = useState<FileEntry[]>([])
  const [refImages, setRefImages] = useState<FileEntry[]>([])
  const [useRefAsAvatar, setUseRefAsAvatar] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState<TranscribedDraft | null>(null)
  const [rawOutput, setRawOutput] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  const textFileInputRef = useRef<HTMLInputElement>(null)
  const imageFileInputRef = useRef<HTMLInputElement>(null)

  function addFile(file: File) {
    const kind = fileKind(file)
    if (!kind) {
      setError(`Skipped "${file.name}" — only text/markdown/json/csv and image files are supported.`)
      return
    }
    const limit = kind === 'image' ? MAX_IMAGE_BYTES : MAX_TEXT_BYTES
    if (file.size > limit) {
      setError(`"${file.name}" is too large (${Math.round(file.size / 1024)}KB). Limit is ${Math.round(limit / 1024)}KB.`)
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const entry: FileEntry = {
        id: Math.random().toString(36).slice(2, 9),
        name: file.name,
        kind,
        content: reader.result as string,
        size: file.size,
      }
      if (kind === 'image') {
        setRefImages((prev) => [...prev, entry])
      } else {
        setFiles((prev) => [...prev, entry])
      }
    }
    reader.onerror = () => setError(`Could not read "${file.name}".`)
    if (kind === 'image') reader.readAsDataURL(file)
    else reader.readAsText(file)
  }

  function handleTextFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const list = e.target.files
    if (!list) return
    Array.from(list).forEach(addFile)
    e.target.value = ''
  }

  function handleImageFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const list = e.target.files
    if (!list) return
    Array.from(list).forEach(addFile)
    e.target.value = ''
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const list = e.dataTransfer.files
    if (!list) return
    Array.from(list).forEach(addFile)
  }

  function removeFile(id: string) {
    setFiles((prev) => prev.filter((f) => f.id !== id))
  }

  function removeImage(id: string) {
    setRefImages((prev) => prev.filter((f) => f.id !== id))
  }

  const sourceCount = (pastedText.trim() ? 1 : 0) + files.length + refImages.length
  const canGenerate = sourceCount > 0 && !!effectiveKey

  async function handleGenerate() {
    if (!effectiveKey) {
      setError('No API key. Set your main or builder key in Settings first.')
      return
    }
    if (sourceCount === 0) {
      setError('Add some source material — paste text, attach files, or drop in a reference image.')
      return
    }
    setIsLoading(true)
    setError(null)
    setDraft(null)
    setRawOutput(null)

    try {
      const segments: string[] = []
      if (pastedText.trim()) {
        segments.push(`=== Pasted notes ===\n${pastedText.trim()}`)
      }
      for (const f of files) {
        segments.push(`=== File: ${f.name} ===\n${f.content}`)
      }
      const userText = segments.length
        ? `Source material follows. Synthesize a single character sheet that faithfully reflects every concrete detail.\n\n${segments.join('\n\n')}`
        : 'The only source material is the attached reference image(s). Build the character sheet primarily from what you can see.'

      const userContent: Message[] = [
        { id: 'u0', role: 'user', content: userText, createdAt: Date.now() },
      ]

      const imageMessages: Message[] = refImages.map((img, i) => ({
        id: `img-${i}`,
        role: 'user' as const,
        content: 'Reference image for the character.',
        imageUrl: img.content,
        imageUrls: [img.content],
        createdAt: Date.now() + i + 1,
      }))

      const text = await completeChat({
        apiKey: effectiveKey,
        modelId,
        systemPrompt: TRANSCRIBE_SYSTEM_PROMPT,
        temperature: 0.7,
        messages: [...userContent, ...imageMessages],
      })

      setRawOutput(text)
      const parsed = tryParseDraft(text)
      if (!parsed) {
        setError("Model didn't return clean JSON. Try a stronger model, or trim the source down.")
      } else {
        setDraft(parsed)
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  function handleAccept() {
    if (!draft) return
    const avatarUrl = useRefAsAvatar && refImages.length > 0 ? refImages[0].content : undefined
    onAccept({
      name: draft.name,
      emoji: draft.emoji,
      color: draft.color,
      description: draft.description,
      tags: draft.tags,
      systemPrompt: draft.systemPrompt,
      notes: draft.notes || undefined,
      avatarUrl,
    })
  }

  return (
    <>
      <div className="flex flex-col gap-4 max-w-3xl">
        <div
          className="rounded-xl p-3 flex items-start gap-3 border"
          style={{
            background: 'color-mix(in srgb, var(--accent) 8%, var(--bg-tertiary))',
            borderColor: 'color-mix(in srgb, var(--accent) 30%, var(--border))',
          }}
        >
          <ScrollText size={16} style={{ color: 'var(--accent)' }} className="shrink-0 mt-0.5" />
          <div className="text-xs leading-relaxed">
            <div className="font-semibold mb-0.5">Transcribe a character</div>
            <span className="text-muted">
              Paste notes, drop in text/markdown/json files, attach reference images. The transcriber AI will
              extract every key point and produce a structured, ready-to-roleplay character sheet.
            </span>
          </div>
        </div>

        {/* Model picker */}
        <div>
          <label className="text-xs text-muted mb-1.5 block">Transcriber model</label>
          <button
            onClick={() => setShowPicker(true)}
            className="w-full flex items-center justify-between gap-2 input-field text-sm py-2 hover:border-accent transition-colors"
          >
            <span className="truncate font-mono text-xs">{modelId}</span>
            <ChevronRight size={14} className="shrink-0 text-muted" />
          </button>
          <div className="flex items-center justify-between gap-2 mt-1.5">
            <p className="text-xs text-muted">
              Use a vision-capable model (e.g. GPT-4o, Claude, Gemini) if you attach reference images.
            </p>
            {usingBuilderKey && (
              <span
                className="shrink-0 text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 font-medium"
                style={{
                  background: 'color-mix(in srgb, var(--accent) 18%, transparent)',
                  color: 'var(--accent)',
                }}
              >
                <KeyRound size={10} />
                Builder key
              </span>
            )}
          </div>
        </div>

        {/* Pasted text */}
        <div>
          <label className="text-xs text-muted mb-1.5 block">Paste notes / lore / dialogue</label>
          <textarea
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
            rows={6}
            placeholder="Drop in any raw notes about your character — appearance, history, dialogue snippets, vibes, half-formed ideas…"
            className="input-field text-sm resize-y leading-relaxed w-full"
            disabled={isLoading}
          />
        </div>

        {/* File drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className="rounded-xl border-2 border-dashed p-4 transition-colors"
          style={{
            borderColor: dragOver ? 'var(--accent)' : 'var(--border)',
            background: dragOver ? 'color-mix(in srgb, var(--accent) 8%, transparent)' : 'transparent',
          }}
        >
          <div className="flex flex-col items-center gap-2 text-center">
            <Upload size={20} className="text-muted" />
            <p className="text-sm font-medium">Drop files anywhere here</p>
            <p className="text-xs text-muted">
              .txt, .md, .json, .csv, .yaml, .xml, etc — and images for reference
            </p>
            <div className="flex gap-2 mt-1">
              <button
                onClick={() => textFileInputRef.current?.click()}
                className="btn-ghost border border-subtle rounded-lg text-xs flex items-center gap-1.5"
                disabled={isLoading}
              >
                <FileText size={13} />
                Add text files
              </button>
              <button
                onClick={() => imageFileInputRef.current?.click()}
                className="btn-ghost border border-subtle rounded-lg text-xs flex items-center gap-1.5"
                disabled={isLoading}
              >
                <ImageIcon size={13} />
                Add images
              </button>
            </div>
          </div>
          <input
            ref={textFileInputRef}
            type="file"
            multiple
            accept=".txt,.md,.markdown,.json,.csv,.tsv,.yml,.yaml,.xml,.html,.htm,.log,.rtf,text/*,application/json"
            className="hidden"
            onChange={handleTextFileChange}
          />
          <input
            ref={imageFileInputRef}
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={handleImageFileChange}
          />
        </div>

        {/* Attached files list */}
        {(files.length > 0 || refImages.length > 0) && (
          <div className="flex flex-col gap-2">
            {files.length > 0 && (
              <div className="flex flex-col gap-1">
                <div className="text-xs text-muted">Text sources ({files.length})</div>
                {files.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center gap-2 p-2 rounded-lg border border-subtle"
                    style={{ background: 'var(--bg-tertiary)' }}
                  >
                    <FileText size={13} className="shrink-0 text-muted" />
                    <span className="text-xs truncate flex-1">{f.name}</span>
                    <span className="text-[10px] text-muted shrink-0">{Math.round(f.size / 1024)}KB</span>
                    <button onClick={() => removeFile(f.id)} className="btn-ghost p-1 rounded">
                      <X size={11} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {refImages.length > 0 && (
              <div className="flex flex-col gap-1">
                <div className="text-xs text-muted">Reference images ({refImages.length})</div>
                <div className="flex flex-wrap gap-2">
                  {refImages.map((img) => (
                    <div
                      key={img.id}
                      className="relative w-20 h-20 rounded-lg overflow-hidden border border-subtle group"
                    >
                      <img src={img.content} alt={img.name} className="w-full h-full object-cover" />
                      <button
                        onClick={() => removeImage(img.id)}
                        className="absolute top-1 right-1 p-0.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ background: 'rgba(0,0,0,0.6)', color: 'white' }}
                      >
                        <X size={11} />
                      </button>
                    </div>
                  ))}
                </div>
                <label className="flex items-center gap-2 text-xs text-muted mt-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useRefAsAvatar}
                    onChange={(e) => setUseRefAsAvatar(e.target.checked)}
                  />
                  Use the first reference image as the character&apos;s avatar
                </label>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={handleGenerate}
            disabled={isLoading || !canGenerate}
            className="btn-primary text-sm flex items-center justify-center gap-2 disabled:opacity-50 flex-1"
          >
            {isLoading ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                Reading the source…
              </>
            ) : (
              <>
                <Sparkles size={14} />
                Transcribe to Character Sheet
              </>
            )}
          </button>
          {onCancel && (
            <button
              onClick={onCancel}
              className="btn-ghost text-sm border border-subtle rounded-lg px-4"
              disabled={isLoading}
            >
              Cancel
            </button>
          )}
        </div>

        {error && (
          <div
            className="flex items-start gap-2 text-xs p-3 rounded-lg"
            style={{
              background: 'color-mix(in srgb, var(--danger) 15%, transparent)',
              color: 'var(--danger)',
            }}
          >
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Preview */}
        {draft && (
          <div
            className="rounded-xl border p-4 flex flex-col gap-3"
            style={{ borderColor: draft.color, background: 'var(--bg-tertiary)' }}
          >
            <div className="flex items-center gap-3">
              {useRefAsAvatar && refImages.length > 0 ? (
                <img
                  src={refImages[0].content}
                  alt="Avatar preview"
                  className="w-14 h-14 rounded-2xl object-cover shrink-0"
                  style={{ border: `2px solid ${draft.color}` }}
                />
              ) : (
                <span
                  className="text-3xl w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
                  style={{ background: `${draft.color}22` }}
                >
                  {draft.emoji}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="font-bold text-base" style={{ color: draft.color }}>{draft.name}</div>
                {draft.description && (
                  <div className="text-xs text-muted">{draft.description}</div>
                )}
              </div>
            </div>

            {draft.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {draft.tags.map((t) => (
                  <span
                    key={t}
                    className="text-[10px] px-2 py-0.5 rounded-full"
                    style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}

            <details>
              <summary className="text-xs text-muted cursor-pointer">System prompt</summary>
              <p
                className="text-xs leading-relaxed max-h-48 overflow-y-auto p-2 mt-1.5 rounded-md font-mono whitespace-pre-wrap"
                style={{ background: 'var(--bg-secondary)' }}
              >
                {draft.systemPrompt}
              </p>
            </details>

            {draft.notes && (
              <details open>
                <summary className="text-xs text-muted cursor-pointer">Character sheet</summary>
                <pre
                  className="text-xs leading-relaxed max-h-72 overflow-y-auto p-2 mt-1.5 rounded-md whitespace-pre-wrap break-words"
                  style={{ background: 'var(--bg-secondary)' }}
                >
                  {draft.notes}
                </pre>
              </details>
            )}

            <div className="flex gap-2">
              <button onClick={handleAccept} className="btn-primary text-xs flex-1">
                Save to Library
              </button>
              <button
                onClick={handleGenerate}
                disabled={isLoading}
                className="btn-ghost text-xs flex-1 border border-subtle rounded-lg"
              >
                Reroll
              </button>
            </div>
          </div>
        )}

        {!draft && rawOutput && (
          <details className="text-xs text-muted">
            <summary className="cursor-pointer">Show raw model output</summary>
            <pre
              className="mt-2 p-2 rounded-md font-mono text-[11px] whitespace-pre-wrap break-words max-h-48 overflow-y-auto"
              style={{ background: 'var(--bg-tertiary)' }}
            >
              {rawOutput}
            </pre>
          </details>
        )}
      </div>

      {showPicker && (
        <ModelPicker
          onClose={() => setShowPicker(false)}
          title="Pick Transcriber Model"
          currentModelIdOverride={modelId}
          onSelectModel={(id) => setModelId(id)}
        />
      )}
    </>
  )
}
