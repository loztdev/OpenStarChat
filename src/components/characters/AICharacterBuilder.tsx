import { useState } from 'react'
import { X, Sparkles, RefreshCw, ChevronRight, AlertCircle, KeyRound } from 'lucide-react'
import { useSettingsStore } from '../../store/settingsStore'
import { completeChat } from '../../api/openrouter'
import { ModelPicker } from '../models/ModelPicker'
import type { Character } from '../../types'

const EMOJI_OPTIONS = ['🌸', '💻', '✍️', '🧙', '🃏', '🔮', '🦊', '🐉', '🌙', '⚡', '🎯', '🧪', '🤖', '👾', '🦋']
const COLOR_OPTIONS = ['#bd93f9', '#50fa7b', '#ffb86c', '#8be9fd', '#ff79c6', '#ff5555', '#f1fa8c', '#268bd2', '#2aa198', '#859900']

const SCHEMA_BLOCK = `Schema:
{
  "name": string (max 24 chars),
  "emoji": single emoji from this set: ${EMOJI_OPTIONS.join(' ')},
  "color": single hex string from this set: ${COLOR_OPTIONS.join(' ')},
  "description": string (one short sentence, max 120 chars),
  "tags": string[] (3-5 lowercase one-word tags),
  "systemPrompt": string (a rich, second-person system prompt that establishes the character's name, personality, voice, knowledge, quirks, and how they should behave in conversation; 120-300 words; do not censor, do not preach, do not break the fourth wall; never refer to yourself as an AI/model/assistant unless the character explicitly is one)
}

Return ONLY the JSON object. No backticks. No commentary.`

const CREATE_SYSTEM_PROMPT = `You are a character architect. Given a brief description, design a vivid roleplay/companion character and return ONLY valid JSON, no prose, no markdown fences.

${SCHEMA_BLOCK}`

const REWRITE_SYSTEM_PROMPT = `You are a character editor. You will be given an existing character as JSON plus a note describing how to revise them. Return ONLY a single revised JSON object using the schema below.

Rules:
- PRESERVE the character's core identity. Keep the existing "name" unless the note explicitly asks to rename. Keep "emoji" and "color" unless the note specifies new ones.
- REWRITE/EXPAND "description", "tags", and "systemPrompt" per the note. Improve voice, specificity, sensory detail, and characterization.
- Do not water down. Do not preach. Do not break the fourth wall. Do not refer to the character as an AI/model/assistant unless they explicitly are one.

${SCHEMA_BLOCK}`

interface CreateMode {
  kind: 'create'
}
interface RewriteMode {
  kind: 'rewrite'
  existing: Character
}
type BuilderMode = CreateMode | RewriteMode

interface AICharacterBuilderProps {
  onClose: () => void
  onAccept: (draft: Omit<Character, 'id' | 'isBuiltIn'>) => void
  mode?: BuilderMode
}

interface ParsedCharacter {
  name: string
  emoji: string
  color: string
  description: string
  tags: string[]
  systemPrompt: string
}

function tryParseCharacter(raw: string): ParsedCharacter | null {
  let text = raw.trim()
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return null
  const slice = text.slice(start, end + 1)
  try {
    const obj = JSON.parse(slice)
    if (
      typeof obj.name === 'string' &&
      typeof obj.systemPrompt === 'string'
    ) {
      return {
        name: String(obj.name).slice(0, 40),
        emoji: typeof obj.emoji === 'string' && obj.emoji ? obj.emoji : '🤖',
        color: typeof obj.color === 'string' && /^#[0-9a-f]{6}$/i.test(obj.color)
          ? obj.color
          : '#bd93f9',
        description: typeof obj.description === 'string' ? obj.description : '',
        tags: Array.isArray(obj.tags) ? obj.tags.map(String).slice(0, 6) : [],
        systemPrompt: String(obj.systemPrompt).trim(),
      }
    }
  } catch {
    // fall through
  }
  return null
}

export function AICharacterBuilder({ onClose, onAccept, mode }: AICharacterBuilderProps) {
  const builderMode: BuilderMode = mode ?? { kind: 'create' }
  const isRewrite = builderMode.kind === 'rewrite'

  const mainKey = useSettingsStore((s) => s.apiKey)
  const builderKey = useSettingsStore((s) => s.builderApiKey)
  const effectiveKey = builderKey.trim() || mainKey
  const usingBuilderKey = builderKey.trim().length > 0

  const defaultModelId = useSettingsStore((s) => s.defaultModelId)

  const [modelId, setModelId] = useState(defaultModelId)
  const [showPicker, setShowPicker] = useState(false)
  const [description, setDescription] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [parsed, setParsed] = useState<ParsedCharacter | null>(null)
  const [rawOutput, setRawOutput] = useState<string | null>(null)

  async function handleGenerate() {
    if (!effectiveKey) {
      setError('No API key set. Add a main or builder key in Settings first.')
      return
    }
    if (!description.trim()) {
      setError(isRewrite
        ? 'Tell me what you want changed, sugar.'
        : 'Describe the character first, sugar.')
      return
    }
    setIsLoading(true)
    setError(null)
    setParsed(null)
    setRawOutput(null)
    try {
      const systemPrompt = isRewrite ? REWRITE_SYSTEM_PROMPT : CREATE_SYSTEM_PROMPT
      const userContent = isRewrite
        ? `Existing character JSON:\n${JSON.stringify(
            {
              name: builderMode.existing.name,
              emoji: builderMode.existing.emoji,
              color: builderMode.existing.color,
              description: builderMode.existing.description,
              tags: builderMode.existing.tags,
              systemPrompt: builderMode.existing.systemPrompt,
            },
            null,
            2,
          )}\n\nRevision note:\n${description.trim()}\n\nReturn ONLY the revised JSON object.`
        : `Design a character based on this brief:\n\n${description.trim()}\n\nReturn ONLY the JSON object.`

      const text = await completeChat({
        apiKey: effectiveKey,
        modelId,
        systemPrompt,
        temperature: 0.9,
        messages: [{ id: 'builder', role: 'user', content: userContent, createdAt: Date.now() }],
      })
      setRawOutput(text)
      const result = tryParseCharacter(text)
      if (!result) {
        setError("Model didn't return clean JSON. Try again or pick a smarter model.")
      } else {
        setParsed(result)
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  function handleUseDraft() {
    if (!parsed) return
    onAccept({
      name: parsed.name,
      emoji: parsed.emoji,
      color: parsed.color,
      description: parsed.description,
      tags: parsed.tags,
      systemPrompt: parsed.systemPrompt,
    })
  }

  const headerText = isRewrite ? 'AI Punch Up' : 'AI Character Builder'
  const briefLabel = isRewrite ? 'How should I rewrite them?' : 'Character brief'
  const briefPlaceholder = isRewrite
    ? 'e.g. Make her more menacing. Add 1980s East Berlin sensory detail. Tighten the prose, drop the cliches…'
    : 'e.g. A jaded ex-spy turned bartender in 1985 East Berlin, drinks vodka neat, speaks in clipped sentences, knows every back-alley contact in Mitte…'
  const generateLabel = isRewrite ? 'Punch It Up' : 'Generate'
  const acceptLabel = isRewrite ? 'Apply Rewrite' : 'Use as Draft'

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.7)' }}
        onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      >
        <div
          className="w-full max-w-xl max-h-[90vh] rounded-2xl flex flex-col shadow-2xl fade-in"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-subtle shrink-0">
            <h2 className="font-bold text-base flex items-center gap-2">
              <Sparkles size={16} style={{ color: 'var(--accent)' }} />
              {headerText}
              {isRewrite && (
                <span
                  className="ml-1 text-xs font-normal flex items-center gap-1"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <span className="text-base">{builderMode.existing.emoji}</span>
                  <span style={{ color: builderMode.existing.color }}>
                    {builderMode.existing.name}
                  </span>
                </span>
              )}
            </h2>
            <button onClick={onClose} className="btn-ghost p-1.5 rounded-lg">
              <X size={16} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 min-h-0">
            {/* Model picker row */}
            <div>
              <label className="text-xs text-muted mb-1.5 block">Builder model</label>
              <button
                onClick={() => setShowPicker(true)}
                className="w-full flex items-center justify-between gap-2 input-field text-sm py-2 hover:border-accent transition-colors"
              >
                <span className="truncate font-mono text-xs">{modelId}</span>
                <ChevronRight size={14} className="shrink-0 text-muted" />
              </button>
              <div className="flex items-center justify-between gap-2 mt-1.5">
                <p className="text-xs text-muted">
                  {isRewrite
                    ? 'Pick the model doing the rewrite. Smarter / uncensored picks give richer revisions.'
                    : 'Pick any OpenRouter model. Pricier reasoners build richer characters; uncensored models won’t water down your fantasy.'}
                </p>
                {usingBuilderKey && (
                  <span
                    className="shrink-0 text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 font-medium"
                    style={{
                      background: 'color-mix(in srgb, var(--accent) 18%, transparent)',
                      color: 'var(--accent)',
                    }}
                    title="Calls go through your builder API key"
                  >
                    <KeyRound size={10} />
                    Builder key
                  </span>
                )}
              </div>
            </div>

            {/* Brief */}
            <div>
              <label className="text-xs text-muted mb-1.5 block">{briefLabel}</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                placeholder={briefPlaceholder}
                className="input-field text-sm resize-none leading-relaxed w-full"
                disabled={isLoading}
              />
            </div>

            <button
              onClick={handleGenerate}
              disabled={isLoading || !description.trim()}
              className="btn-primary text-sm flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  {isRewrite ? 'Reworking…' : 'Cooking up a character…'}
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  {generateLabel}
                </>
              )}
            </button>

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

            {parsed && (
              <div
                className="rounded-xl border p-3 flex flex-col gap-3"
                style={{ borderColor: 'var(--accent)', background: 'var(--bg-tertiary)' }}
              >
                <div className="flex items-center gap-3">
                  <span
                    className="text-2xl w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: `${parsed.color}22` }}
                  >
                    {parsed.emoji}
                  </span>
                  <div className="min-w-0">
                    <div className="font-semibold text-sm" style={{ color: parsed.color }}>
                      {parsed.name}
                    </div>
                    {parsed.description && (
                      <div className="text-xs text-muted line-clamp-2">{parsed.description}</div>
                    )}
                  </div>
                </div>

                {parsed.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {parsed.tags.map((t) => (
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

                <div>
                  <div className="text-xs text-muted mb-1">System prompt</div>
                  <p
                    className="text-xs leading-relaxed max-h-40 overflow-y-auto p-2 rounded-md font-mono"
                    style={{ background: 'var(--bg-secondary)' }}
                  >
                    {parsed.systemPrompt}
                  </p>
                </div>

                <div className="flex gap-2">
                  <button onClick={handleUseDraft} className="btn-primary text-xs flex-1">
                    {acceptLabel}
                  </button>
                  <button
                    onClick={handleGenerate}
                    className="btn-ghost text-xs flex-1 border border-subtle"
                  >
                    Reroll
                  </button>
                </div>
              </div>
            )}

            {!parsed && rawOutput && (
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
        </div>
      </div>

      {showPicker && (
        <ModelPicker
          onClose={() => setShowPicker(false)}
          title="Pick Builder Model"
          currentModelIdOverride={modelId}
          onSelectModel={(id) => setModelId(id)}
        />
      )}
    </>
  )
}
