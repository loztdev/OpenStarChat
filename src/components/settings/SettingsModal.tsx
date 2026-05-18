import { useState } from 'react'
import { X, Eye, EyeOff, Check, AlertCircle, Loader, KeyRound, Palette, Type, Globe } from 'lucide-react'
import { useSettingsStore } from '../../store/settingsStore'
import type { FreeProviderConfig } from '../../store/settingsStore'
import { fetchModels } from '../../api/openrouter'
import { POLLINATIONS_MODELS } from '../../api/freeProvider'
import { THEME_SWATCHES } from '../../types'
import type { ThemeName, IdleAnimation, CustomThemeVars } from '../../types'
import { MemoryManager } from './MemoryManager'
import clsx from 'clsx'

interface SettingsModalProps {
  onClose: () => void
}

type TestStatus = 'idle' | 'loading' | 'ok' | 'error'

interface ApiKeyFieldProps {
  label: string
  helper: React.ReactNode
  value: string
  onSave: (key: string) => void
  placeholder?: string
}

function ApiKeyField({ label, helper, value, onSave, placeholder }: ApiKeyFieldProps) {
  const [draft, setDraft] = useState(value)
  const [show, setShow] = useState(false)
  const [status, setStatus] = useState<TestStatus>('idle')
  const [message, setMessage] = useState('')

  async function handleTest() {
    if (!draft.trim()) { setMessage('Enter a key first.'); setStatus('error'); return }
    setStatus('loading'); setMessage('')
    try {
      const models = await fetchModels(draft.trim())
      setStatus('ok')
      setMessage(`Connected! ${models.length} models available.`)
    } catch (e) {
      setStatus('error')
      setMessage((e as Error).message)
    }
  }

  return (
    <section>
      <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
        <KeyRound size={13} />
        {label}
      </h3>
      <div className="flex gap-2 mb-2">
        <div
          className="flex items-center flex-1 rounded-lg border border-subtle overflow-hidden"
          style={{ background: 'var(--bg-tertiary)' }}
        >
          <input
            type={show ? 'text' : 'password'}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={placeholder ?? 'sk-or-v1-…'}
            className="flex-1 bg-transparent outline-none px-3 py-2 text-sm font-mono"
            style={{ color: 'var(--text-primary)' }}
            onKeyDown={(e) => e.key === 'Enter' && onSave(draft.trim())}
          />
          <button onClick={() => setShow((v) => !v)} className="px-2 py-2 btn-ghost" title={show ? 'Hide' : 'Show'}>
            {show ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
        <button onClick={() => onSave(draft.trim())} className="btn-primary text-sm px-3">Save</button>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={handleTest}
          disabled={status === 'loading'}
          className="flex items-center gap-1.5 text-xs btn-ghost border border-subtle px-3 py-1.5 rounded-lg"
        >
          {status === 'loading' ? <Loader size={12} className="animate-spin" /> : <span>Test Connection</span>}
        </button>
        {status === 'ok' && <span className="flex items-center gap-1 text-xs" style={{ color: '#22c55e' }}><Check size={12} /> {message}</span>}
        {status === 'error' && <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--danger)' }}><AlertCircle size={12} /> {message}</span>}
      </div>
      <div className="text-xs text-muted mt-2">{helper}</div>
    </section>
  )
}

const THEME_CUSTOM_FIELDS: { key: keyof CustomThemeVars; label: string }[] = [
  { key: 'bgPrimary', label: 'Background' },
  { key: 'bgSecondary', label: 'Sidebar / panels' },
  { key: 'bgTertiary', label: 'Input / tertiary' },
  { key: 'textPrimary', label: 'Primary text' },
  { key: 'textSecondary', label: 'Secondary text' },
  { key: 'accent', label: 'Accent color' },
  { key: 'border', label: 'Border color' },
  { key: 'surface', label: 'Message surface' },
  { key: 'userBubble', label: 'User bubble' },
  { key: 'danger', label: 'Danger / red' },
]

const IDLE_OPTIONS: { value: IdleAnimation; label: string }[] = [
  { value: 'random', label: '🎲 Random' },
  { value: 'starfield', label: '✨ Starfield' },
  { value: 'shooting', label: '🌠 Shooting Stars' },
  { value: 'aurora', label: '🌌 Aurora' },
]

export function SettingsModal({ onClose }: SettingsModalProps) {
  const apiKey = useSettingsStore((s) => s.apiKey)
  const builderApiKey = useSettingsStore((s) => s.builderApiKey)
  const theme = useSettingsStore((s) => s.theme)
  const idleAnimation = useSettingsStore((s) => s.idleAnimation)
  const customThemeVars = useSettingsStore((s) => s.customThemeVars)
  const freeProvider = useSettingsStore((s) => s.freeProvider)
  const predictiveText = useSettingsStore((s) => s.predictiveText)
  const useAiChatTitles = useSettingsStore((s) => s.useAiChatTitles)
  const ttsProvider = useSettingsStore((s) => s.ttsProvider)
  const elevenLabsApiKey = useSettingsStore((s) => s.elevenLabsApiKey)
  const elevenLabsVoiceId = useSettingsStore((s) => s.elevenLabsVoiceId)
  const setApiKey = useSettingsStore((s) => s.setApiKey)
  const setBuilderApiKey = useSettingsStore((s) => s.setBuilderApiKey)
  const setTheme = useSettingsStore((s) => s.setTheme)
  const setIdleAnimation = useSettingsStore((s) => s.setIdleAnimation)
  const setCustomThemeVars = useSettingsStore((s) => s.setCustomThemeVars)
  const setFreeProvider = useSettingsStore((s) => s.setFreeProvider)
  const setPredictiveText = useSettingsStore((s) => s.setPredictiveText)
  const setUseAiChatTitles = useSettingsStore((s) => s.setUseAiChatTitles)
  const setTtsProvider = useSettingsStore((s) => s.setTtsProvider)
  const setElevenLabsApiKey = useSettingsStore((s) => s.setElevenLabsApiKey)
  const setElevenLabsVoiceId = useSettingsStore((s) => s.setElevenLabsVoiceId)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.65)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-md rounded-2xl shadow-2xl fade-in overflow-hidden max-h-[90vh] flex flex-col"
        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-subtle shrink-0">
          <h2 className="font-bold text-base">⚙️ Settings</h2>
          <button onClick={onClose} className="btn-ghost p-1.5 rounded-lg"><X size={16} /></button>
        </div>

        <div className="p-5 flex flex-col gap-6 overflow-y-auto">
          <ApiKeyField
            label="OpenRouter API Key"
            value={apiKey}
            onSave={setApiKey}
            helper={<>Get your key at <span className="accent-text">openrouter.ai/keys</span>. Stored locally in your browser only.</>}
          />

          <ApiKeyField
            label="Builder API Key (optional)"
            value={builderApiKey}
            onSave={setBuilderApiKey}
            helper={<>If set, AI Character Builder uses this key. Leave blank to fall back to your main key.</>}
          />

          {/* Free Provider */}
          <FreeProviderSection config={freeProvider} onChange={setFreeProvider} hasApiKey={!!apiKey} />

          {/* Predictive Text */}
          <section>
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
              <Type size={13} />
              Predictive Text
            </h3>
            <label className="flex items-center gap-3 cursor-pointer">
              <div
                onClick={() => setPredictiveText(!predictiveText)}
                className={clsx(
                  'w-10 h-5 rounded-full relative transition-colors cursor-pointer',
                  predictiveText ? '' : ''
                )}
                style={{
                  background: predictiveText ? 'var(--accent)' : 'var(--bg-tertiary)',
                  border: '1px solid var(--border)',
                }}
              >
                <div
                  className="absolute top-0.5 w-3.5 h-3.5 rounded-full transition-transform"
                  style={{
                    background: predictiveText ? 'white' : 'var(--text-secondary)',
                    transform: predictiveText ? 'translateX(22px)' : 'translateX(3px)',
                  }}
                />
              </div>
              <span className="text-sm">{predictiveText ? 'On' : 'Off'}</span>
            </label>
            <p className="text-xs text-muted mt-2">
              Shows AI-powered text suggestions as you type. Press <strong>Tab</strong> to accept.
              {!apiKey && !freeProvider.enabled && ' Requires an API key or free provider to be configured.'}
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-sm mb-3">Chat titles</h3>
            <label className="flex items-center gap-3 cursor-pointer">
              <div
                onClick={() => setUseAiChatTitles(!useAiChatTitles)}
                className="w-10 h-5 rounded-full relative transition-colors cursor-pointer"
                style={{
                  background: useAiChatTitles ? 'var(--accent)' : 'var(--bg-tertiary)',
                  border: '1px solid var(--border)',
                }}
              >
                <div
                  className="absolute top-0.5 w-3.5 h-3.5 rounded-full transition-transform"
                  style={{
                    background: useAiChatTitles ? 'white' : 'var(--text-secondary)',
                    transform: useAiChatTitles ? 'translateX(22px)' : 'translateX(3px)',
                  }}
                />
              </div>
              <span className="text-sm">{useAiChatTitles ? 'AI titles' : 'First line as title'}</span>
            </label>
            <p className="text-xs text-muted mt-2">
              When on, new chats stay named &quot;New Chat&quot; until the first reply, then a small model suggests a
              short title. When off, the first user message still seeds the title (legacy behavior).
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-sm mb-3">Read aloud (assistant)</h3>
            <div className="flex flex-col gap-2 text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="tts"
                  checked={ttsProvider === 'browser'}
                  onChange={() => setTtsProvider('browser')}
                />
                Browser voices (free, offline-capable)
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="tts"
                  checked={ttsProvider === 'elevenlabs'}
                  onChange={() => setTtsProvider('elevenlabs')}
                />
                ElevenLabs (API key; may be blocked by CORS in some browsers — falls back to browser)
              </label>
            </div>
            {ttsProvider === 'elevenlabs' && (
              <div className="mt-3 space-y-2">
                <div>
                  <label className="text-xs text-muted block mb-1">ElevenLabs API key</label>
                  <input
                    type="password"
                    value={elevenLabsApiKey}
                    onChange={(e) => setElevenLabsApiKey(e.target.value)}
                    placeholder="xi-api-key…"
                    className="w-full px-3 py-2 rounded-lg border border-subtle text-sm font-mono bg-transparent outline-none"
                    style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1">Voice ID</label>
                  <input
                    type="text"
                    value={elevenLabsVoiceId}
                    onChange={(e) => setElevenLabsVoiceId(e.target.value)}
                    placeholder="21m00Tcm4TlvDq8ikWAM"
                    className="w-full px-3 py-2 rounded-lg border border-subtle text-sm font-mono bg-transparent outline-none"
                    style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
                  />
                </div>
              </div>
            )}
          </section>

          {/* Conversation Memory */}
          <MemoryManager />

          {/* Theme */}
          <section>
            <h3 className="font-semibold text-sm mb-3">Theme</h3>
            <div className="grid grid-cols-4 gap-2">
              {THEME_SWATCHES.map((s) => (
                <ThemeSwatchBtn key={s.name} swatch={s} active={theme === s.name} onSelect={setTheme} />
              ))}
              {/* Custom theme swatch */}
              <button
                onClick={() => setTheme('custom')}
                className={clsx(
                  'relative rounded-xl overflow-hidden border-2 transition-all aspect-square flex flex-col',
                  theme === 'custom' ? 'scale-105' : 'border-transparent hover:scale-105'
                )}
                style={{ borderColor: theme === 'custom' ? customThemeVars.accent : 'transparent' }}
                title="Custom"
              >
                <div className="flex-1 flex">
                  <div className="flex-1" style={{ background: customThemeVars.bgPrimary }} />
                  <div className="flex-1" style={{ background: customThemeVars.bgSecondary }} />
                </div>
                <div className="h-4" style={{ background: customThemeVars.accent }} />
                <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold" style={{ color: '#ffffff', textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>
                  Custom
                </span>
                {theme === 'custom' && (
                  <span className="absolute top-1 right-1 w-4 h-4 rounded-full flex items-center justify-center" style={{ background: customThemeVars.accent }}>
                    <Check size={10} color="white" />
                  </span>
                )}
              </button>
            </div>
          </section>

          {/* Custom theme editor */}
          {theme === 'custom' && (
            <section>
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <Palette size={13} /> Custom Theme Colors
              </h3>
              <div className="grid grid-cols-1 gap-2">
                {THEME_CUSTOM_FIELDS.map(({ key, label }) => (
                  <div key={key} className="flex items-center gap-3">
                    <input
                      type="color"
                      value={customThemeVars[key]}
                      onChange={(e) => setCustomThemeVars({ [key]: e.target.value })}
                      className="w-8 h-8 rounded cursor-pointer border-0 p-0"
                      style={{ background: 'none' }}
                    />
                    <span className="text-xs flex-1" style={{ color: 'var(--text-secondary)' }}>{label}</span>
                    <span className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>{customThemeVars[key]}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Idle Animation */}
          <section>
            <h3 className="font-semibold text-sm mb-3">Idle Animation</h3>
            <div className="flex flex-wrap gap-2">
              {IDLE_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setIdleAnimation(value)}
                  className={clsx(
                    'text-xs px-3 py-1.5 rounded-lg border transition-all',
                    idleAnimation === value ? 'border-accent accent-text' : 'border-subtle btn-ghost'
                  )}
                  style={idleAnimation === value ? { borderColor: 'var(--accent)' } : undefined}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted mt-2">Appears after 15 seconds of inactivity. Click to dismiss.</p>
          </section>
        </div>
      </div>
    </div>
  )
}

function ThemeSwatchBtn({
  swatch,
  active,
  onSelect,
}: {
  swatch: { name: ThemeName; label: string; bg: string; accent: string }
  active: boolean
  onSelect: (t: ThemeName) => void
}) {
  return (
    <button
      onClick={() => onSelect(swatch.name)}
      className={clsx(
        'relative rounded-xl overflow-hidden border-2 transition-all aspect-square flex flex-col',
        active ? 'scale-105' : 'border-transparent hover:scale-105'
      )}
      style={{ borderColor: active ? swatch.accent : 'transparent' }}
      title={swatch.label}
    >
      <div className="flex-1" style={{ background: swatch.bg }} />
      <div className="h-4" style={{ background: swatch.accent }} />
      <span
        className="absolute inset-0 flex items-center justify-center text-xs font-semibold"
        style={{ color: swatch.bg === '#f5f5f5' ? '#1a1a1a' : '#ffffff', textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}
      >
        {swatch.label}
      </span>
      {active && (
        <span className="absolute top-1 right-1 w-4 h-4 rounded-full flex items-center justify-center" style={{ background: swatch.accent }}>
          <Check size={10} color="white" />
        </span>
      )}
    </button>
  )
}

function FreeProviderSection({
  config,
  onChange,
  hasApiKey,
}: {
  config: FreeProviderConfig
  onChange: (updates: Partial<FreeProviderConfig>) => void
  hasApiKey: boolean
}) {
  return (
    <section>
      <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
        <Globe size={13} />
        Free LLM Provider
      </h3>

      <label className="flex items-center gap-3 cursor-pointer mb-3">
        <div
          onClick={() => onChange({ enabled: !config.enabled })}
          className="w-10 h-5 rounded-full relative transition-colors cursor-pointer"
          style={{
            background: config.enabled ? 'var(--accent)' : 'var(--bg-tertiary)',
            border: '1px solid var(--border)',
          }}
        >
          <div
            className="absolute top-0.5 w-3.5 h-3.5 rounded-full transition-transform"
            style={{
              background: config.enabled ? 'white' : 'var(--text-secondary)',
              transform: config.enabled ? 'translateX(22px)' : 'translateX(3px)',
            }}
          />
        </div>
        <span className="text-sm">{config.enabled ? 'Enabled' : 'Disabled'}</span>
      </label>

      {hasApiKey && config.enabled && (
        <p className="text-xs mb-3 px-2 py-1.5 rounded-lg" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
          You have an OpenRouter key set. The free provider will only be used when the OpenRouter key is removed.
        </p>
      )}

      {config.enabled && (
        <div className="flex flex-col gap-3">
          {/* Provider type selector */}
          <div className="flex gap-2">
            {(['pollinations', 'custom'] as const).map((type) => (
              <button
                key={type}
                onClick={() => onChange({ type })}
                className={clsx(
                  'text-xs px-3 py-1.5 rounded-lg border transition-all flex-1',
                  config.type === type ? 'border-accent accent-text' : 'border-subtle btn-ghost'
                )}
                style={config.type === type ? { borderColor: 'var(--accent)' } : undefined}
              >
                {type === 'pollinations' ? '🌸 Pollinations.ai' : '🔧 Custom Endpoint'}
              </button>
            ))}
          </div>

          {config.type === 'pollinations' && (
            <>
              <div>
                <label className="text-xs text-muted mb-1 block">API Key (optional for basic use)</label>
                <input
                  type="password"
                  value={config.pollinationsKey}
                  onChange={(e) => onChange({ pollinationsKey: e.target.value })}
                  placeholder="pk_… or sk_… (from enter.pollinations.ai)"
                  className="w-full px-3 py-2 rounded-lg border border-subtle text-sm bg-transparent outline-none font-mono"
                  style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
                />
              </div>
              <div>
                <label className="text-xs text-muted mb-1 block">Model</label>
                <select
                  value={config.pollinationsModel}
                  onChange={(e) => onChange({ pollinationsModel: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-subtle text-sm outline-none cursor-pointer"
                  style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
                >
                  {POLLINATIONS_MODELS.map((m) => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-muted">
                Pollinations.ai offers free AI models. Get a key at{' '}
                <a href="https://enter.pollinations.ai" target="_blank" rel="noreferrer" className="accent-text underline">
                  enter.pollinations.ai
                </a>{' '}
                for higher rate limits, or try without one first.
              </p>
            </>
          )}

          {config.type === 'custom' && (
            <>
              <div>
                <label className="text-xs text-muted mb-1 block">Base URL (OpenAI-compatible)</label>
                <input
                  type="text"
                  value={config.customUrl}
                  onChange={(e) => onChange({ customUrl: e.target.value })}
                  placeholder="https://api.example.com"
                  className="w-full px-3 py-2 rounded-lg border border-subtle text-sm bg-transparent outline-none font-mono"
                  style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
                />
              </div>
              <div>
                <label className="text-xs text-muted mb-1 block">API Key (optional)</label>
                <input
                  type="password"
                  value={config.customKey}
                  onChange={(e) => onChange({ customKey: e.target.value })}
                  placeholder="sk-…"
                  className="w-full px-3 py-2 rounded-lg border border-subtle text-sm bg-transparent outline-none font-mono"
                  style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
                />
              </div>
              <div>
                <label className="text-xs text-muted mb-1 block">Model ID</label>
                <input
                  type="text"
                  value={config.customModel}
                  onChange={(e) => onChange({ customModel: e.target.value })}
                  placeholder="gpt-3.5-turbo"
                  className="w-full px-3 py-2 rounded-lg border border-subtle text-sm bg-transparent outline-none font-mono"
                  style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
                />
              </div>
              <p className="text-xs text-muted">
                Point to any OpenAI-compatible endpoint (e.g. Ollama, LM Studio, vLLM, or any free proxy).
                The URL should support <code className="font-mono">/v1/chat/completions</code>.
              </p>
            </>
          )}
        </div>
      )}

      {!config.enabled && (
        <p className="text-xs text-muted">
          Enable this to use free LLM providers without an OpenRouter API key.
          Supports Pollinations.ai and any OpenAI-compatible endpoint.
        </p>
      )}
    </section>
  )
}
