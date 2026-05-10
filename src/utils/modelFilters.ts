import type { Model, ModelCategory, ModelSortKey } from '../types'

const CODING_KW = [
  // Generic keywords
  'code', 'coder', 'codex', 'coding', 'programmer',
  // DeepSeek coding models
  'deepseek-coder', 'deepseekcoder',
  // Qwen coding models
  'qwen-coder', 'qwencoder', 'qwen3-coder',
  // Mistral coding models
  'devstral', 'codestral',
  // Meta / Code Llama
  'codellama', 'code-llama',
  // StarCoder family
  'starcoder', 'starcoder2',
  // WizardCoder
  'wizard-code', 'wizardcoder',
  // GLM coding
  'glm-5', 'glm5',
  // Poolside (coding-focused)
  'poolside', 'laguna',
  // Cursor models
  'cursor',
  // Misc coding-focused
  'codebooga', 'phind', 'openchat',
]
const WRITING_KW = [
  // Generic keywords
  'creative', 'story', 'novelist', 'writing', 'writer', 'fiction',
  // Roleplay/writing focused finetuned models
  'mythomax', 'rocinante', 'unslop', 'unslopnemo',
  // Major models good at writing
  'claude', 'opus', 'sonnet',
  'gpt-4', 'gpt-4o', 'gpt-5', 'chatgpt',
  'gemini',
  // Grok
  'grok',
  // EVA writing specialist
  'eva-unit', 'eva-qwen',
  // Llama
  'llama-3.3', 'llama-3.1',
  // MiniMax
  'minimax',
]
const ROLEPLAY_KW = [
  // Generic keywords
  'rp', 'roleplay',
  // Sao10K models (top RP creators)
  'sao10k', 'euryale', 'stheno', 'hanami',
  // NeverSleep models
  'neversleep', 'noromaid', 'lumimaid',
  // Anthracite models
  'anthracite', 'magnum',
  // TheDrummer models
  'thedrummer', 'rocinante', 'cydonia',
  // Pygmalion family
  'pygmalion', 'mythalion', 'metharme',
  // MythoMax
  'mytho', 'mythomax',
  // Hermes / Nous
  'hermes', 'nous', 'capybara',
  // Dolphin (chat/RP)
  'dolphin',
  // Airoboros
  'airoboros',
  // EVA (RP/storywriting specialist)
  'eva-unit', 'eva-qwen',
  // Infermatic (RP merge specialists)
  'infermatic', 'mn-inferor',
  // NothingiIsReal
  'nothingiisreal', 'nothingisreal',
  // Midnight Miqu
  'midnight', 'miqu',
  // Calme
  'calme',
  // Other RP finetunes
  'fimbulvetr', 'xwin', 'toppy',
]
const REASONING_KW = [
  // OpenAI reasoning models
  'o1', 'o3', 'o4',
  // Generic keywords
  'thinking', 'reason', 'reasoning', 'reflection',
  // DeepSeek reasoning
  'deepseek-r1', 'deepseek-r2', 'r1-0528',
  // Qwen reasoning
  'qwq', 'qwen-plus-2025',
  // Gemini thinking
  'gemini-2.5-pro', 'gemini-3',
  // Claude thinking
  ':thinking',
  // Kimi reasoning
  'kimi-k2',
  // GLM reasoning
  'glm-5',
  // DeepSeek V4
  'deepseek-v4',
  // MoE reasoning
  'nemotron',
]
const UNCENSORED_KW = [
  // Explicit labels
  'uncensored', 'nsfw', 'adult', 'abliterated', 'unfiltered',
  // Venice
  'venice', 'venice-edition',
  // Dolphin (uncensored chat finetunes)
  'dolphin-mistral', 'dolphin-2', 'dolphin-3', 'dolphin-llama',
  // NeverSleep (known for unrestricted models)
  'neversleep', 'lumimaid', 'noromaid',
  // Sao10K (unrestricted RP models)
  'sao10k', 'euryale', 'hanami', 'stheno',
  // Anthracite
  'anthracite', 'magnum',
  // TheDrummer (unrestricted creative)
  'thedrummer', 'rocinante', 'cydonia',
  // Unslop / NeverSleep variants
  'unslop', 'unslopnemo',
  // Other explicitly uncensored models
  'valkyrie', 'skyfall', 'behemoth',
  'mlewd', 'mythomax', 'mythalion', 'pygmalion',
  'nothingiisreal', 'nothingisreal',
  'cognitivecomputations', 'wizardlm-uncensored',
  // MN-Inferor (uncensored merge)
  'infermatic', 'mn-inferor',
  // Fimbulvetr
  'fimbulvetr',
  // Midnight Miqu
  'midnight',
]

export function detectCategory(model: Model): ModelCategory {
  const haystack = (model.id + ' ' + model.name).toLowerCase()
  if (UNCENSORED_KW.some((k) => haystack.includes(k))) return 'uncensored'
  if (REASONING_KW.some((k) => haystack.includes(k))) return 'reasoning'
  if (CODING_KW.some((k) => haystack.includes(k))) return 'coding'
  if (ROLEPLAY_KW.some((k) => haystack.includes(k))) return 'roleplay'
  if (WRITING_KW.some((k) => haystack.includes(k))) return 'writing'
  return 'general'
}

export function extractParamsBillions(model: Model): number {
  const haystack = model.id + ' ' + model.name
  const match = haystack.match(/(\d+\.?\d*)\s*[Bb](?:\b|[^a-zA-Z]|$)/)
  return match ? parseFloat(match[1]) : 0
}

export function formatContextLength(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}

export function formatPrice(priceStr: string): string {
  const price = parseFloat(priceStr)
  if (!price || price === 0) return 'Free'
  const perMillion = price * 1_000_000
  if (perMillion < 0.01) return `$${(perMillion * 100).toFixed(2)}¢/1M`
  return `$${perMillion.toFixed(2)}/1M`
}

export interface FilterOptions {
  searchQuery: string
  sortKey: ModelSortKey
  category: ModelCategory
  favoriteIds?: string[]
  recentIds?: string[]
}

export function filterAndSortModels(models: Model[], opts: FilterOptions): Model[] {
  const { searchQuery, sortKey, category, favoriteIds, recentIds } = opts
  const q = searchQuery.toLowerCase().trim()
  const favSet = new Set(favoriteIds ?? [])
  const recentList = recentIds ?? []
  const recentIndex = new Map(recentList.map((id, i) => [id, i] as const))

  let filtered = models.filter((m) => {
    if (q && !m.id.toLowerCase().includes(q) && !m.name.toLowerCase().includes(q)) {
      return false
    }
    if (category === 'favorites') {
      if (!favSet.has(m.id)) return false
    } else if (category === 'recent') {
      if (!recentIndex.has(m.id)) return false
    } else if (category !== 'all') {
      if (detectCategory(m) !== category) return false
    }
    return true
  })

  // Recent tab preserves usage order regardless of selected sortKey
  if (category === 'recent') {
    return [...filtered].sort(
      (a, b) => (recentIndex.get(a.id) ?? 0) - (recentIndex.get(b.id) ?? 0)
    )
  }

  filtered = [...filtered].sort((a, b) => {
    switch (sortKey) {
      case 'popular':
      case 'new':
        return b.created - a.created
      case 'price-asc':
        return parseFloat(a.pricing.prompt) - parseFloat(b.pricing.prompt)
      case 'price-desc':
        return parseFloat(b.pricing.prompt) - parseFloat(a.pricing.prompt)
      case 'context-asc':
        return a.context_length - b.context_length
      case 'context-desc':
        return b.context_length - a.context_length
      case 'params-asc':
        return extractParamsBillions(a) - extractParamsBillions(b)
      case 'params-desc':
        return extractParamsBillions(b) - extractParamsBillions(a)
      default:
        return 0
    }
  })

  return filtered
}
