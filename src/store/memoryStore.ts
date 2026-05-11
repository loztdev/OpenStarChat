import { create } from 'zustand'
import { persist } from 'zustand/middleware'

function nanoid(): string {
  return Math.random().toString(36).slice(2, 11) + Date.now().toString(36)
}

export interface Memory {
  id: string
  content: string
  createdAt: number
  enabled: boolean
}

interface MemoryState {
  memories: Memory[]

  addMemory: (content: string) => void
  updateMemory: (id: string, updates: Partial<Memory>) => void
  deleteMemory: (id: string) => void
  toggleMemory: (id: string) => void
  getActiveMemoryPrompt: () => string
}

export const useMemoryStore = create<MemoryState>()(
  persist(
    (set, get) => ({
      memories: [],

      addMemory: (content) => {
        const memory: Memory = {
          id: nanoid(),
          content,
          createdAt: Date.now(),
          enabled: true,
        }
        set((s) => ({ memories: [memory, ...s.memories] }))
      },

      updateMemory: (id, updates) => {
        set((s) => ({
          memories: s.memories.map((m) =>
            m.id === id ? { ...m, ...updates } : m
          ),
        }))
      },

      deleteMemory: (id) => {
        set((s) => ({ memories: s.memories.filter((m) => m.id !== id) }))
      },

      toggleMemory: (id) => {
        set((s) => ({
          memories: s.memories.map((m) =>
            m.id === id ? { ...m, enabled: !m.enabled } : m
          ),
        }))
      },

      getActiveMemoryPrompt: () => {
        const { memories } = get()
        const active = memories.filter((m) => m.enabled)
        if (active.length === 0) return ''
        const lines = active.map((m) => `- ${m.content}`)
        return `User context (always remember):\n${lines.join('\n')}`
      },
    }),
    {
      name: 'openstarchat-memories',
    }
  )
)
