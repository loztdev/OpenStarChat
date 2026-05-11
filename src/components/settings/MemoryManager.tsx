import { useState } from 'react'
import { Brain, Plus, Trash2, ToggleLeft, ToggleRight, Pencil } from 'lucide-react'
import { useMemoryStore } from '../../store/memoryStore'
import type { Memory } from '../../store/memoryStore'

export function MemoryManager() {
  const memories = useMemoryStore((s) => s.memories)
  const addMemory = useMemoryStore((s) => s.addMemory)
  const updateMemory = useMemoryStore((s) => s.updateMemory)
  const deleteMemory = useMemoryStore((s) => s.deleteMemory)
  const toggleMemory = useMemoryStore((s) => s.toggleMemory)

  const [newContent, setNewContent] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState('')

  function handleAdd() {
    const trimmed = newContent.trim()
    if (!trimmed) return
    addMemory(trimmed)
    setNewContent('')
  }

  function startEdit(memory: Memory) {
    setEditingId(memory.id)
    setEditDraft(memory.content)
  }

  function saveEdit(id: string) {
    const trimmed = editDraft.trim()
    if (trimmed) {
      updateMemory(id, { content: trimmed })
    }
    setEditingId(null)
    setEditDraft('')
  }

  function cancelEdit() {
    setEditingId(null)
    setEditDraft('')
  }

  return (
    <section>
      <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
        <Brain size={13} />
        Conversation Memory
      </h3>
      <p className="text-xs text-muted mb-3">
        Persistent facts auto-injected into all chats as system context.
      </p>

      {/* Add new memory */}
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="Add a memory (e.g. 'My name is Aaron')"
          className="flex-1 px-3 py-2 rounded-lg border border-subtle text-sm bg-transparent outline-none"
          style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
        />
        <button
          onClick={handleAdd}
          disabled={!newContent.trim()}
          className="btn-primary text-sm px-3 flex items-center gap-1.5 rounded-lg"
        >
          <Plus size={14} />
          Add
        </button>
      </div>

      {/* Memory list */}
      {memories.length === 0 ? (
        <p className="text-xs text-muted text-center py-4">
          No memories yet. Add facts you want the AI to always remember.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {memories.map((memory) => (
            <div
              key={memory.id}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-subtle"
              style={{ background: 'var(--bg-tertiary)' }}
            >
              {editingId === memory.id ? (
                <input
                  type="text"
                  value={editDraft}
                  onChange={(e) => setEditDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveEdit(memory.id)
                    if (e.key === 'Escape') cancelEdit()
                  }}
                  autoFocus
                  className="flex-1 bg-transparent outline-none text-sm"
                  style={{ color: 'var(--text-primary)' }}
                />
              ) : (
                <span
                  className="flex-1 text-sm"
                  style={{
                    color: memory.enabled ? 'var(--text-primary)' : 'var(--text-secondary)',
                    opacity: memory.enabled ? 1 : 0.6,
                  }}
                >
                  {memory.content}
                </span>
              )}

              {editingId === memory.id ? (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => saveEdit(memory.id)}
                    className="btn-ghost p-1.5 rounded-lg text-xs"
                    style={{ color: 'var(--accent)' }}
                  >
                    Save
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="btn-ghost p-1.5 rounded-lg text-xs"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => toggleMemory(memory.id)}
                    className="btn-ghost p-1.5 rounded-lg"
                    title={memory.enabled ? 'Disable' : 'Enable'}
                    style={{ color: memory.enabled ? 'var(--accent)' : 'var(--text-secondary)' }}
                  >
                    {memory.enabled ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                  </button>
                  <button
                    onClick={() => startEdit(memory)}
                    className="btn-ghost p-1.5 rounded-lg"
                    title="Edit"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => deleteMemory(memory.id)}
                    className="btn-ghost p-1.5 rounded-lg"
                    title="Delete"
                    style={{ color: 'var(--danger)' }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
