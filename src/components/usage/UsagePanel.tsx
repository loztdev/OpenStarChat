import { useMemo } from 'react'
import { X } from 'lucide-react'
import { useChatStore } from '../../store/chatStore'
import { useModelStore } from '../../store/modelStore'

function parsePricePerMillionUsd(s: string): number {
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : 0
}

export function UsagePanel({ onClose }: { onClose: () => void }) {
  const chats = useChatStore((s) => s.chats)
  const models = useModelStore((s) => s.models)

  const modelMap = useMemo(() => new Map(models.map((m) => [m.id, m])), [models])

  const rows = useMemo(() => {
    type Row = { modelId: string; completionTok: number; usd: number }
    const byModel = new Map<string, Row>()

    for (const c of chats) {
      for (const m of c.messages) {
        if (m.role !== 'assistant' || m.tokenCount == null) continue
        const modelId = c.modelId
        const r = byModel.get(modelId) ?? { modelId, completionTok: 0, usd: 0 }
        r.completionTok += m.tokenCount
        const pricing = modelMap.get(modelId)?.pricing
        if (pricing) {
          r.usd += (m.tokenCount / 1_000_000) * parsePricePerMillionUsd(pricing.completion)
        }
        byModel.set(modelId, r)
      }
    }
    return [...byModel.values()].sort((a, b) => b.completionTok - a.completionTok)
  }, [chats, modelMap])

  const totals = useMemo(() => {
    let tok = 0
    let usd = 0
    for (const r of rows) {
      tok += r.completionTok
      usd += r.usd
    }
    return { tok, usd }
  }, [rows])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.65)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col"
        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-subtle shrink-0">
          <h2 className="font-bold text-base">Usage (estimate)</h2>
          <button type="button" onClick={onClose} className="btn-ghost p-1.5 rounded-lg" title="Close">
            <X size={16} />
          </button>
        </div>
        <div className="p-5 overflow-y-auto text-sm flex flex-col gap-4">
          <p className="text-xs text-muted">
            Counts reflect <strong>assistant</strong> messages only (streamed output tokens). Cost uses each
            model&apos;s completion price from the last model list fetch. OpenRouter bills prompt + completion on
            their side; this panel is a rough local hint.
          </p>
          <div className="rounded-lg border border-subtle p-3" style={{ background: 'var(--bg-tertiary)' }}>
            <div className="text-xs text-muted">Assistant output (stored)</div>
            <div className="text-lg font-semibold mt-1">{totals.tok.toLocaleString()} tokens</div>
            <div className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              ~${totals.usd.toFixed(4)} USD <span className="text-xs">(completion rate only)</span>
            </div>
          </div>
          {rows.length === 0 ? (
            <p className="text-muted text-sm">No assistant token counts yet. Chat a bit, then reopen.</p>
          ) : (
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr style={{ color: 'var(--text-secondary)', textAlign: 'left' }}>
                  <th className="py-1 pr-2">Model</th>
                  <th className="py-1 pr-2">Out tokens</th>
                  <th className="py-1">~USD</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.modelId} style={{ borderTop: '1px solid var(--border)' }}>
                    <td className="py-1.5 pr-2 font-mono truncate max-w-[200px]" title={r.modelId}>
                      {r.modelId}
                    </td>
                    <td className="py-1.5 pr-2">{r.completionTok.toLocaleString()}</td>
                    <td className="py-1.5">${r.usd.toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
