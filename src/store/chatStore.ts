import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Chat, Message, Character, Prompt, ChatFolder } from '../types'
import { BUILT_IN_PROMPTS } from '../data/builtInPrompts'
import { BUILT_IN_CHARACTERS } from '../data/builtInCharacters'
import { useSettingsStore } from './settingsStore'
import { downloadFile } from '../utils/download'

function nanoid(): string {
  return Math.random().toString(36).slice(2, 11) + Date.now().toString(36)
}

interface ChatState {
  chats: Chat[]
  activeChatId: string | null
  prompts: Prompt[]
  characters: Character[]
  folders: ChatFolder[]

  // Chat actions
  createChat: (modelId: string) => string
  updateChat: (id: string, updates: Partial<Omit<Chat, 'id'>>) => void
  renameChat: (id: string, title: string) => void
  deleteChat: (id: string) => void
  setActiveChatId: (id: string | null) => void
  addMessage: (chatId: string, message: Omit<Message, 'id' | 'createdAt'>) => Message
  updateMessage: (chatId: string, messageId: string, content: string) => void
  patchMessage: (chatId: string, messageId: string, updates: Partial<Message>) => void
  finalizeMessage: (chatId: string, messageId: string, tokenCount?: number) => void
  deleteMessage: (chatId: string, messageId: string) => void
  toggleBookmarkMessage: (chatId: string, messageId: string) => void
  truncateMessagesAfter: (chatId: string, messageId: string) => void
  togglePinChat: (id: string) => void
  branchChat: (chatId: string, upToMessageId: string) => string
  exportChats: () => void
  exportChatsMarkdown: () => void
  exportChatsText: () => void
  exportAll: () => void
  importChats: (chats: Chat[]) => void
  importAll: (data: string) => boolean
  setChatTags: (chatId: string, tags: string[]) => void
  setChatFolder: (chatId: string, folderId: string | null) => void

  // Folder actions
  addFolder: (name: string, color?: string) => string
  renameFolder: (id: string, name: string) => void
  deleteFolder: (id: string) => void

  // Prompt actions
  addPrompt: (p: Omit<Prompt, 'id'>) => void
  updatePrompt: (id: string, updates: Partial<Prompt>) => void
  deletePrompt: (id: string) => void

  // Character actions
  addCharacter: (c: Omit<Character, 'id'>) => void
  updateCharacter: (id: string, updates: Partial<Character>) => void
  deleteCharacter: (id: string) => void
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      chats: [],
      activeChatId: null,
      prompts: BUILT_IN_PROMPTS,
      characters: BUILT_IN_CHARACTERS,
      folders: [],

      createChat: (modelId) => {
        const id = nanoid()
        const chat: Chat = {
          id,
          title: 'New Chat',
          modelId,
          characterId: null,
          systemPrompt: '',
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          pinned: false,
        }
        set((s) => ({ chats: [chat, ...s.chats], activeChatId: id }))
        return id
      },

      updateChat: (id, updates) => {
        set((s) => ({
          chats: s.chats.map((c) =>
            c.id === id ? { ...c, ...updates, updatedAt: Date.now() } : c
          ),
        }))
      },

      renameChat: (id, title) => {
        set((s) => ({
          chats: s.chats.map((c) =>
            c.id === id ? { ...c, title, updatedAt: Date.now() } : c
          ),
        }))
      },

      deleteChat: (id) => {
        set((s) => {
          const chats = s.chats.filter((c) => c.id !== id)
          const activeChatId =
            s.activeChatId === id ? (chats[0]?.id ?? null) : s.activeChatId
          return { chats, activeChatId }
        })
      },

      setActiveChatId: (id) => set({ activeChatId: id }),

      addMessage: (chatId, msg) => {
        const message: Message = {
          ...msg,
          id: nanoid(),
          createdAt: Date.now(),
        }
        set((s) => ({
          chats: s.chats.map((c) => {
            if (c.id !== chatId) return c
            const messages = [...c.messages, message]
            const useAiTitles = useSettingsStore.getState().useAiChatTitles
            const title =
              c.title === 'New Chat' && msg.role === 'user'
                ? useAiTitles
                  ? c.title
                  : msg.content.slice(0, 52).trim()
                : c.title
            return { ...c, messages, title, updatedAt: Date.now() }
          }),
        }))
        return message
      },

      updateMessage: (chatId, messageId, content) => {
        set((s) => ({
          chats: s.chats.map((c) => {
            if (c.id !== chatId) return c
            return {
              ...c,
              messages: c.messages.map((m) =>
                m.id === messageId ? { ...m, content } : m
              ),
              updatedAt: Date.now(),
            }
          }),
        }))
      },

      patchMessage: (chatId, messageId, updates) => {
        set((s) => ({
          chats: s.chats.map((c) => {
            if (c.id !== chatId) return c
            return {
              ...c,
              messages: c.messages.map((m) =>
                m.id === messageId ? { ...m, ...updates } : m
              ),
              updatedAt: Date.now(),
            }
          }),
        }))
      },

      finalizeMessage: (chatId, messageId, tokenCount) => {
        set((s) => ({
          chats: s.chats.map((c) => {
            if (c.id !== chatId) return c
            return {
              ...c,
              messages: c.messages.map((m) =>
                m.id === messageId
                  ? { ...m, isStreaming: false, ...(tokenCount !== undefined ? { tokenCount } : {}) }
                  : m
              ),
            }
          }),
        }))
      },

      deleteMessage: (chatId, messageId) => {
        set((s) => ({
          chats: s.chats.map((c) => {
            if (c.id !== chatId) return c
            return {
              ...c,
              messages: c.messages.filter((m) => m.id !== messageId),
              updatedAt: Date.now(),
            }
          }),
        }))
      },

      toggleBookmarkMessage: (chatId, messageId) => {
        set((s) => ({
          chats: s.chats.map((c) => {
            if (c.id !== chatId) return c
            return {
              ...c,
              messages: c.messages.map((m) =>
                m.id === messageId ? { ...m, bookmarked: !m.bookmarked } : m
              ),
            }
          }),
        }))
      },

      truncateMessagesAfter: (chatId, messageId) => {
        set((s) => ({
          chats: s.chats.map((c) => {
            if (c.id !== chatId) return c
            const idx = c.messages.findIndex((m) => m.id === messageId)
            if (idx === -1) return c
            return {
              ...c,
              messages: c.messages.slice(0, idx),
              updatedAt: Date.now(),
            }
          }),
        }))
      },

      togglePinChat: (id) => {
        set((s) => ({
          chats: s.chats.map((c) =>
            c.id === id ? { ...c, pinned: !c.pinned } : c
          ),
        }))
      },

      branchChat: (chatId, upToMessageId) => {
        const { chats } = get()
        const source = chats.find((c) => c.id === chatId)
        if (!source) return chatId

        const idx = source.messages.findIndex((m) => m.id === upToMessageId)
        const messages = source.messages.slice(0, idx + 1).map((m) => ({
          ...m,
          id: nanoid(),
          createdAt: Date.now(),
        }))

        const newId = nanoid()
        const newChat: Chat = {
          ...source,
          id: newId,
          title: `${source.title} (branch)`,
          messages,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          pinned: false,
        }
        set((s) => ({ chats: [newChat, ...s.chats], activeChatId: newId }))
        return newId
      },

      exportChats: () => {
        const { chats } = get()
        const date = new Date().toISOString().slice(0, 10)
        downloadFile(JSON.stringify(chats, null, 2), `openstarchat-${date}.json`, 'application/json')
      },

      exportChatsMarkdown: () => {
        const { chats } = get()
        const lines: string[] = []
        for (const chat of chats) {
          lines.push(`# ${chat.title}`)
          lines.push(`*Model: ${chat.modelId} | ${new Date(chat.createdAt).toLocaleString()}*`)
          lines.push('')
          for (const msg of chat.messages) {
            if (msg.role === 'system') continue
            lines.push(`### ${msg.role === 'user' ? 'You' : 'AI'}`)
            lines.push(msg.content)
            lines.push('')
          }
          lines.push('---')
          lines.push('')
        }
        const date = new Date().toISOString().slice(0, 10)
        downloadFile(lines.join('\n'), `openstarchat-${date}.md`, 'text/markdown')
      },

      exportChatsText: () => {
        const { chats } = get()
        const lines: string[] = []
        for (const chat of chats) {
          lines.push(`=== ${chat.title} ===`)
          lines.push(`Model: ${chat.modelId} | ${new Date(chat.createdAt).toLocaleString()}`)
          lines.push('')
          for (const msg of chat.messages) {
            if (msg.role === 'system') continue
            lines.push(`[${msg.role === 'user' ? 'You' : 'AI'}]`)
            lines.push(msg.content)
            lines.push('')
          }
          lines.push('')
        }
        const date = new Date().toISOString().slice(0, 10)
        downloadFile(lines.join('\n'), `openstarchat-${date}.txt`, 'text/plain')
      },

      exportAll: () => {
        const { chats, prompts, characters, folders } = get()
        const settings = useSettingsStore.getState()
        const bundle = {
          version: 1,
          exportedAt: new Date().toISOString(),
          chats,
          folders,
          prompts: prompts.filter((p) => !p.isBuiltIn),
          characters: characters.filter((c) => !c.isBuiltIn),
          settings: {
            theme: settings.theme,
            defaultModelId: settings.defaultModelId,
            favoriteModelIds: settings.favoriteModelIds,
            idleAnimation: settings.idleAnimation,
            customThemeVars: settings.customThemeVars,
            freeProvider: settings.freeProvider,
            predictiveText: settings.predictiveText,
          },
        }
        const date = new Date().toISOString().slice(0, 10)
        downloadFile(JSON.stringify(bundle, null, 2), `openstarchat-full-backup-${date}.json`, 'application/json')
      },

      importChats: (incoming) => {
        set((s) => {
          const existingIds = new Set(s.chats.map((c) => c.id))
          const newChats = incoming.filter((c) => !existingIds.has(c.id))
          return { chats: [...newChats, ...s.chats] }
        })
      },

      importAll: (raw) => {
        try {
          const bundle = JSON.parse(raw)
          if (bundle.version !== 1 || !Array.isArray(bundle.chats)) return false

          // Import chats
          const existingIds = new Set(get().chats.map((c) => c.id))
          const newChats = (bundle.chats as Chat[]).filter((c) => !existingIds.has(c.id))
          const existingPromptIds = new Set(get().prompts.map((p) => p.id))
          const newPrompts = Array.isArray(bundle.prompts)
            ? (bundle.prompts as Prompt[]).filter((p) => !existingPromptIds.has(p.id))
            : []
          const existingCharIds = new Set(get().characters.map((c) => c.id))
          const newCharacters = Array.isArray(bundle.characters)
            ? (bundle.characters as Character[]).filter((c) => !existingCharIds.has(c.id))
            : []

          set((s) => ({
            chats: [...newChats, ...s.chats],
            prompts: [...s.prompts, ...newPrompts],
            characters: [...s.characters, ...newCharacters],
          }))

          // Import settings
          if (bundle.settings) {
            const ss = useSettingsStore.getState()
            const s = bundle.settings
            if (s.theme) ss.setTheme(s.theme)
            if (s.defaultModelId) ss.setDefaultModelId(s.defaultModelId)
            if (s.idleAnimation) ss.setIdleAnimation(s.idleAnimation)
            if (s.customThemeVars) ss.setCustomThemeVars(s.customThemeVars)
            if (s.freeProvider) ss.setFreeProvider(s.freeProvider)
            if (s.predictiveText !== undefined) ss.setPredictiveText(s.predictiveText)
            if (Array.isArray(s.favoriteModelIds)) {
              for (const id of s.favoriteModelIds) {
                if (!ss.isFavoriteModel(id)) ss.toggleFavoriteModel(id)
              }
            }
          }

          return true
        } catch {
          return false
        }
      },

      setChatTags: (chatId, tags) => {
        set((s) => ({
          chats: s.chats.map((c) =>
            c.id === chatId ? { ...c, tags, updatedAt: Date.now() } : c
          ),
        }))
      },

      setChatFolder: (chatId, folderId) => {
        set((s) => ({
          chats: s.chats.map((c) =>
            c.id === chatId ? { ...c, folderId, updatedAt: Date.now() } : c
          ),
        }))
      },

      addFolder: (name, color) => {
        const id = nanoid()
        const folder: ChatFolder = { id, name, color: color ?? '#7c6af7', createdAt: Date.now() }
        set((s) => ({ folders: [...s.folders, folder] }))
        return id
      },

      renameFolder: (id, name) => {
        set((s) => ({
          folders: s.folders.map((f) => (f.id === id ? { ...f, name } : f)),
        }))
      },

      deleteFolder: (id) => {
        set((s) => ({
          folders: s.folders.filter((f) => f.id !== id),
          chats: s.chats.map((c) =>
            c.folderId === id ? { ...c, folderId: null } : c
          ),
        }))
      },

      addPrompt: (p) => {
        const prompt: Prompt = { ...p, id: nanoid() }
        set((s) => ({ prompts: [...s.prompts, prompt] }))
      },

      updatePrompt: (id, updates) => {
        set((s) => ({
          prompts: s.prompts.map((p) => (p.id === id ? { ...p, ...updates } : p)),
        }))
      },

      deletePrompt: (id) => {
        set((s) => ({ prompts: s.prompts.filter((p) => p.id !== id) }))
      },

      addCharacter: (c) => {
        const character: Character = { ...c, id: nanoid() }
        set((s) => ({ characters: [...s.characters, character] }))
      },

      updateCharacter: (id, updates) => {
        set((s) => ({
          characters: s.characters.map((c) =>
            c.id === id ? { ...c, ...updates } : c
          ),
        }))
      },

      deleteCharacter: (id) => {
        set((s) => ({ characters: s.characters.filter((c) => c.id !== id) }))
      },
    }),
    {
      name: 'openstarchat-chats',
      version: 1,
      migrate: (persisted, version) => {
        const p = persisted as { chats?: Chat[] } | undefined
        if (version < 1 && p?.chats) {
          for (const c of p.chats) {
            for (const m of c.messages ?? []) {
              if (m.imageUrl && !m.imageUrls?.length) {
                m.imageUrls = [m.imageUrl]
              }
            }
          }
        }
        return persisted as never
      },
      partialize: (state) => ({
        chats: state.chats.map((c) => ({
          ...c,
          messages: c.messages.map((m) => ({ ...m, isStreaming: false })),
        })),
        activeChatId: state.activeChatId,
        folders: state.folders,
        prompts: state.prompts.filter((p) => !p.isBuiltIn),
        characters: state.characters.filter((c) => !c.isBuiltIn),
      }),
      merge: (persisted, current) => {
        const p = persisted as Partial<ChatState>
        return {
          ...current,
          chats: p.chats ?? [],
          activeChatId: p.activeChatId ?? null,
          folders: (p as Record<string, unknown>).folders as ChatFolder[] ?? [],
          prompts: [
            ...BUILT_IN_PROMPTS,
            ...(p.prompts ?? []),
          ],
          characters: [
            ...BUILT_IN_CHARACTERS,
            ...(p.characters ?? []),
          ],
        }
      },
    }
  )
)
