import { completeChat } from './openrouter'

export async function generateChatTitle(
  apiKey: string,
  userExcerpt: string,
  assistantExcerpt: string,
): Promise<string> {
  const sys =
    'You name chat conversations. Reply with a short title only: 2-7 words. No quotes. No trailing punctuation.'
  const u = `User (excerpt): ${userExcerpt.slice(0, 500)}\n\nAssistant (excerpt): ${assistantExcerpt.slice(0, 500)}`
  const raw = await completeChat({
    apiKey,
    modelId: 'openai/gpt-4o-mini',
    messages: [{ id: 'title', role: 'user', content: u, createdAt: Date.now() }],
    systemPrompt: sys,
    temperature: 0.35,
    maxTokens: 32,
  })
  return (
    raw
      .replace(/^["'«»]+|["'«»]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 64) || 'Chat'
  )
}
