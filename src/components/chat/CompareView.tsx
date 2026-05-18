import { useState, useRef, useCallback, useImperativeHandle, forwardRef } from 'react'
import { X, Send, Plus, RefreshCw, Loader } from 'lucide-react'
import clsx from 'clsx'
import { streamChat } from '../../api/openrouter'
import { streamFree, getPollinationsProvider, getCustomProvider } from '../../api/freeProvider'
import { useSettingsStore } from '../../store/settingsStore'
import type { Message } from '../../types'

interface CompareViewProps {
  onClose: () => void
  onOpenModelPicker: (slot: number) => void
}

export interface CompareViewHandle {
  setModelAtSlot: (slot: number, modelId: string) => void
}

interface ResponseEntry {
  modelId: string
  content: string
  isStreaming: boolean
  error?: string
}

export const CompareView = forwardRef<CompareViewHandle, CompareViewProps>(
  function CompareView({ onClose, onOpenModelPicker }, ref) {
  const [models, setModels] = useState<string[]>([])
  const [input, setInput] = useState('')
  const [responses, setResponses] = useState<ResponseEntry[]>([])

  const apiKey = useSettingsStore((s) => s.apiKey)
  const freeProvider = useSettingsStore((s) => s.freeProvider)

  const cancelFnsRef = useRef<(() => void)[]>([])

  const setModelAtSlot = useCallback((slot: number, modelId: string) => {
    setModels((prev) => {
      const next = [...prev]
      next[slot] = modelId
      return next
    })
  }, [])

  useImperativeHandle(ref, () => ({ setModelAtSlot }), [setModelAtSlot])

  const addModelSlot = useCallback(() => {
    if (models.length < 3) {
      setModels((prev) => [...prev, ''])
      onOpenModelPicker(models.length)
    }
  }, [models.length, onOpenModelPicker])
  void setModelAtSlot

  const removeModelSlot = useCallback((slot: number) => {
    setModels((prev) => prev.filter((_, i) => i !== slot))
    setResponses((prev) => prev.filter((_, i) => i !== slot))
  }, [])

  const sendToAll = useCallback(() => {
    const activeModels = models.filter((m) => m)
    if (!activeModels.length || !input.trim()) return

    cancelFnsRef.current.forEach((fn) => fn())
    cancelFnsRef.current = []

    const initial: ResponseEntry[] = activeModels.map((modelId) => ({
      modelId,
      content: '',
      isStreaming: true,
    }))
    setResponses(initial)

    activeModels.forEach((modelId, idx) => {
      const messages: Message[] = [
        { id: 'compare', role: 'user', content: input.trim(), createdAt: Date.now() },
      ]

      const onDelta = (delta: string) => {
        setResponses((prev) => {
          const next = [...prev]
          if (next[idx]) {
            next[idx] = { ...next[idx], content: next[idx].content + delta }
          }
          return next
        })
      }

      const onDone = () => {
        setResponses((prev) => {
          const next = [...prev]
          if (next[idx]) {
            next[idx] = { ...next[idx], isStreaming: false }
          }
          return next
        })
      }

      const onError = (err: Error) => {
        setResponses((prev) => {
          const next = [...prev]
          if (next[idx]) {
            next[idx] = { ...next[idx], isStreaming: false, error: err.message }
          }
          return next
        })
      }

      let cancel: () => void

      if (freeProvider.enabled && !apiKey) {
        const provider =
          freeProvider.type === 'pollinations'
            ? getPollinationsProvider(freeProvider.pollinationsKey, freeProvider.pollinationsModel)
            : getCustomProvider(freeProvider.customUrl, freeProvider.customKey, freeProvider.customModel)

        cancel = streamFree({ provider, messages, onDelta, onDone, onError })
      } else {
        cancel = streamChat({ apiKey, modelId, messages, onDelta, onDone, onError })
      }

      cancelFnsRef.current.push(cancel)
    })
  }, [models, input, apiKey, freeProvider])

  const canSend = models.some((m) => m) && input.trim().length > 0
  const isAnyStreaming = responses.some((r) => r.isStreaming)

  return (
    <div
      className="fixed inset-0 z-40 flex flex-col"
      style={{ background: 'var(--bg-secondary)' }}
    >
      {/* Header */}
      <header
        className="flex items-center justify-between px-4 py-3 border-b shrink-0"
        style={{ borderColor: 'var(--border)' }}
      >
        <h2 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>
          Compare Models
        </h2>
        <button
          onClick={onClose}
          className="btn-ghost p-1.5 rounded-lg"
          aria-label="Close"
        >
          <X size={18} />
        </button>
      </header>

      {/* Model selectors */}
      <div
        className="flex flex-wrap items-center gap-2 px-4 py-3 border-b shrink-0"
        style={{ borderColor: 'var(--border)' }}
      >
        {models.map((modelId, idx) => (
          <div key={idx} className="flex items-center gap-1">
            <button
              onClick={() => onOpenModelPicker(idx)}
              className={clsx(
                'text-xs px-3 py-1.5 rounded-lg font-medium transition-all truncate max-w-[200px]',
                modelId ? 'btn-ghost' : 'btn-ghost'
              )}
              style={modelId ? {
                background: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border)',
              } : {
                background: 'var(--bg-tertiary)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border)',
              }}
              title={modelId || 'Select model'}
            >
              {modelId ? modelId.split('/').pop() : `Slot ${idx + 1}`}
            </button>
            <button
              onClick={() => removeModelSlot(idx)}
              className="btn-ghost p-1 rounded"
              aria-label="Remove model"
            >
              <X size={12} />
            </button>
          </div>
        ))}
        {models.length < 3 && (
          <button
            onClick={addModelSlot}
            className="btn-ghost flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg font-medium"
            style={{ color: 'var(--accent)' }}
          >
            <Plus size={14} />
            Add Model
          </button>
        )}
      </div>

      {/* Input area */}
      <div
        className="flex items-end gap-2 px-4 py-3 border-b shrink-0"
        style={{ borderColor: 'var(--border)' }}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message to send to all models…"
          rows={2}
          className="flex-1 min-w-0 rounded-lg px-3 py-2 text-sm resize-none outline-none"
          style={{
            background: 'var(--bg-tertiary)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border)',
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && canSend) {
              e.preventDefault()
              sendToAll()
            }
          }}
        />
        <button
          onClick={sendToAll}
          disabled={!canSend || isAnyStreaming}
          className={clsx(
            'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all shrink-0',
            canSend && !isAnyStreaming ? 'btn-primary' : 'btn-ghost opacity-50 cursor-not-allowed'
          )}
        >
          {isAnyStreaming ? (
            <>
              <RefreshCw size={14} className="animate-spin" />
              Streaming…
            </>
          ) : (
            <>
              <Send size={14} />
              Send to All
            </>
          )}
        </button>
      </div>

      {/* Responses */}
      <div className="flex-1 overflow-y-auto min-h-0 p-4">
        {responses.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Add models above, type a message, and hit "Send to All" to compare responses side by side.
            </p>
          </div>
        ) : (
          <div className={clsx(
            'grid gap-4 h-full',
            responses.length === 1 && 'grid-cols-1',
            responses.length === 2 && 'grid-cols-1 md:grid-cols-2',
            responses.length >= 3 && 'grid-cols-1 md:grid-cols-3',
          )}>
            {responses.map((resp, idx) => (
              <div
                key={`${resp.modelId}-${idx}`}
                className="flex flex-col rounded-xl overflow-hidden min-h-[200px]"
                style={{ border: '1px solid var(--border)', background: 'var(--bg-tertiary)' }}
              >
                {/* Column header */}
                <div
                  className="flex items-center justify-between px-3 py-2 border-b shrink-0"
                  style={{ borderColor: 'var(--border)', background: 'var(--bg-secondary)' }}
                >
                  <span
                    className="text-xs font-semibold truncate"
                    style={{ color: 'var(--accent)' }}
                    title={resp.modelId}
                  >
                    {resp.modelId.split('/').pop()}
                  </span>
                  {resp.isStreaming && (
                    <Loader size={12} className="animate-spin" style={{ color: 'var(--accent)' }} />
                  )}
                  {resp.error && (
                    <span className="text-xs" style={{ color: 'var(--danger, #ef4444)' }}>Error</span>
                  )}
                </div>

                {/* Response body */}
                <div className="flex-1 overflow-y-auto p-3">
                  {resp.error ? (
                    <p className="text-xs" style={{ color: 'var(--danger, #ef4444)' }}>
                      {resp.error}
                    </p>
                  ) : resp.content ? (
                    <pre
                      className="text-sm leading-relaxed whitespace-pre-wrap break-words"
                      style={{ color: 'var(--text-primary)', fontFamily: 'inherit' }}
                    >
                      {resp.content}
                    </pre>
                  ) : resp.isStreaming ? (
                    <div className="flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                      <Loader size={14} className="animate-spin" />
                      <span className="text-xs">Streaming…</span>
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
})

export { type CompareViewProps }
