export type ThemeName = 'dark' | 'amoled' | 'light' | 'dracula' | 'nord' | 'cyberpunk' | 'solarized' | 'custom'

export interface Model {
  id: string
  name: string
  created: number
  context_length: number
  max_completion_tokens: number | null
  pricing: {
    prompt: string
    completion: string
  }
  description?: string
  architecture?: {
    modality?: string
  }
}

export type MessageRole = 'user' | 'assistant' | 'system' | 'tool'

export interface Message {
  id: string
  role: MessageRole
  content: string
  /** @deprecated Prefer imageUrls; kept for persisted chats */
  imageUrl?: string
  /** Data URLs or https URLs — multimodal user turns */
  imageUrls?: string[]
  createdAt: number
  isStreaming?: boolean
  bookmarked?: boolean
  tokenCount?: number
  /** Model reasoning trace (streamed), when the provider exposes it */
  reasoning?: string
  /** OpenAI-style tool_calls JSON on an assistant message */
  assistantToolCalls?: string
  /** For role === 'tool' — links the tool output to the assistant tool_calls id */
  toolCallId?: string
}

export interface Chat {
  id: string
  title: string
  modelId: string
  characterId: string | null
  systemPrompt: string
  messages: Message[]
  createdAt: number
  updatedAt: number
  pinned?: boolean
  folderId?: string | null
  tags?: string[]
  temperature?: number
  maxTokens?: number
  /** When true, register built-in tools (time, random int) the model may call */
  experimentalTools?: boolean
  /** Optional extra OpenAI-format tool definitions (JSON array). Merged with built-ins when experimentalTools is on. */
  toolsJson?: string
  /** When set, request JSON that matches this JSON Schema object (OpenRouter structured outputs). */
  jsonSchemaText?: string
}

export interface ChatFolder {
  id: string
  name: string
  color: string
  createdAt: number
}

export interface Character {
  id: string
  name: string
  emoji: string
  color: string
  systemPrompt: string
  tags: string[]
  description: string
  avatarUrl?: string
  notes?: string
  isBuiltIn?: boolean
}

export interface Prompt {
  id: string
  name: string
  content: string
  isBuiltIn?: boolean
}

export type ModelCategory =
  | 'all'
  | 'favorites'
  | 'recent'
  | 'coding'
  | 'writing'
  | 'roleplay'
  | 'reasoning'
  | 'uncensored'
  | 'general'

export type ModelSortKey =
  | 'popular'
  | 'new'
  | 'price-asc'
  | 'price-desc'
  | 'context-asc'
  | 'context-desc'
  | 'params-asc'
  | 'params-desc'

export interface ThemeSwatch {
  name: ThemeName
  label: string
  bg: string
  accent: string
}

export const THEME_SWATCHES: ThemeSwatch[] = [
  { name: 'dark', label: 'Dark', bg: '#1a1a1a', accent: '#7c6af7' },
  { name: 'amoled', label: 'AMOLED', bg: '#000000', accent: '#7c6af7' },
  { name: 'light', label: 'Light', bg: '#f5f5f5', accent: '#6b59e6' },
  { name: 'dracula', label: 'Dracula', bg: '#282a36', accent: '#bd93f9' },
  { name: 'nord', label: 'Nord', bg: '#2e3440', accent: '#88c0d0' },
  { name: 'cyberpunk', label: 'Cyberpunk', bg: '#0d0d0d', accent: '#00ffff' },
  { name: 'solarized', label: 'Solarized', bg: '#002b36', accent: '#268bd2' },
]

export type IdleAnimation = 'starfield' | 'shooting' | 'aurora' | 'random'

export interface CustomThemeVars {
  bgPrimary: string
  bgSecondary: string
  bgTertiary: string
  textPrimary: string
  textSecondary: string
  accent: string
  border: string
  surface: string
  userBubble: string
  danger: string
}

export const DEFAULT_CUSTOM_THEME: CustomThemeVars = {
  bgPrimary: '#1a1a2e',
  bgSecondary: '#16213e',
  bgTertiary: '#0f3460',
  textPrimary: '#e0e0e0',
  textSecondary: '#a0a0b0',
  accent: '#e94560',
  border: '#1a3a5c',
  surface: '#0f3460',
  userBubble: '#2d1b3d',
  danger: '#ef4444',
}
