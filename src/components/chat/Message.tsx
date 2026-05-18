import { useState, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import {
  Copy,
  Check,
  Bookmark,
  BookmarkCheck,
  Edit2,
  RefreshCw,
  GitBranch,
  X,
  Volume2,
} from 'lucide-react'
import clsx from 'clsx'
import type { Message as MessageType, Character } from '../../types'
import { MarkdownContent } from './MarkdownContent'
import { useSettingsStore } from '../../store/settingsStore'
import { elevenLabsSpeak } from '../../api/elevenlabs'

interface MessageProps {
  message: MessageType
  chatId: string
  character?: Character | null
  isLast?: boolean
  isStreaming?: boolean
  onBookmark: (messageId: string) => void
  onEdit: (messageId: string, newContent: string) => void
  onRegenerate: () => void
  onBranch: (messageId: string) => void
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  async function handleCopy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }
  return (
    <button
      onClick={handleCopy}
      className="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity btn-ghost"
      title="Copy message"
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
    </button>
  )
}

function estimateCost(tokenCount: number): string | null {
  if (!tokenCount) return null
  return `~${tokenCount} tokens`
}

function userImageUrls(m: MessageType): string[] {
  if (m.imageUrls?.length) return m.imageUrls
  if (m.imageUrl) return [m.imageUrl]
  return []
}

function stripMdForSpeech(s: string): string {
  return s.replace(/```[\s\S]*?```/g, ' ').replace(/`+/g, '').replace(/\*\*|__/g, '').replace(/[*_]/g, '').trim()
}

export function Message({
  message,
  chatId: _chatId,
  character,
  isLast,
  isStreaming,
  onBookmark,
  onEdit,
  onRegenerate,
  onBranch,
}: MessageProps) {
  const isUser = message.role === 'user'
  const isTool = message.role === 'tool'
  const showCharAvatar = !isUser && !isTool && !!character
  const [editing, setEditing] = useState(false)
  const [editDraft, setEditDraft] = useState(message.content)
  const [ttsBusy, setTtsBusy] = useState(false)

  const ttsProvider = useSettingsStore((s) => s.ttsProvider)
  const elevenLabsApiKey = useSettingsStore((s) => s.elevenLabsApiKey)
  const elevenLabsVoiceId = useSettingsStore((s) => s.elevenLabsVoiceId)

  const speakAssistant = useCallback(async () => {
    const plain = stripMdForSpeech(message.content)
    if (!plain) return
    window.speechSynthesis.cancel()
    setTtsBusy(true)
    try {
      if (ttsProvider === 'elevenlabs' && elevenLabsApiKey.trim() && elevenLabsVoiceId.trim()) {
        await elevenLabsSpeak({
          apiKey: elevenLabsApiKey.trim(),
          voiceId: elevenLabsVoiceId.trim(),
          text: plain.slice(0, 2500),
        })
      } else {
        await new Promise<void>((resolve, reject) => {
          const u = new SpeechSynthesisUtterance(plain.slice(0, 8000))
          u.onend = () => resolve()
          u.onerror = () => reject(new Error('speech'))
          window.speechSynthesis.speak(u)
        })
      }
    } catch {
      const u = new SpeechSynthesisUtterance(plain.slice(0, 8000))
      window.speechSynthesis.speak(u)
    } finally {
      setTtsBusy(false)
    }
  }, [message.content, ttsProvider, elevenLabsApiKey, elevenLabsVoiceId])

  function submitEdit() {
    const trimmed = editDraft.trim()
    if (trimmed && trimmed !== message.content) {
      onEdit(message.id, trimmed)
    }
    setEditing(false)
  }

  function cancelEdit() {
    setEditDraft(message.content)
    setEditing(false)
  }

  if (isTool) {
    return (
      <div className="group flex gap-2 px-6 py-1 text-xs font-mono opacity-90" style={{ color: 'var(--text-secondary)' }}>
        <span className="shrink-0">🔧 tool</span>
        <pre className="whitespace-pre-wrap break-words flex-1 m-0">{message.content}</pre>
        <CopyButton text={message.content} />
      </div>
    )
  }

  return (
    <div className={clsx('flex gap-3 px-4 py-3 group', isUser ? 'flex-row-reverse' : 'flex-row')}>
      {showCharAvatar && character ? (
        character.avatarUrl ? (
          <img
            src={character.avatarUrl}
            alt={character.name}
            className="shrink-0 w-7 h-7 rounded-full object-cover mt-0.5"
            style={{ border: `1.5px solid ${character.color}` }}
            title={character.name}
          />
        ) : (
          <div
            className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-base mt-0.5"
            style={{ background: `${character.color}22` }}
            title={character.name}
          >
            {character.emoji}
          </div>
        )
      ) : (
        <div
          className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold mt-0.5"
          style={
            isUser
              ? { background: 'var(--accent)', color: 'white' }
              : { background: 'var(--surface)', color: 'var(--text-secondary)' }
          }
        >
          {isUser ? 'U' : 'AI'}
        </div>
      )}

      <div className={clsx('flex flex-col gap-1 max-w-[80%]', isUser ? 'items-end' : 'items-start')}>
        {!isUser && message.reasoning?.trim() && (
          <details className="text-xs w-full max-w-xl rounded-lg border border-subtle px-2 py-1.5" style={{ background: 'var(--bg-tertiary)' }}>
            <summary className="cursor-pointer select-none" style={{ color: 'var(--text-secondary)' }}>
              Thinking
            </summary>
            <pre className="mt-1 whitespace-pre-wrap break-words m-0 font-sans" style={{ color: 'var(--text-primary)' }}>
              {message.reasoning}
            </pre>
          </details>
        )}

        <div
          className="rounded-2xl px-4 py-2.5 text-sm leading-relaxed relative"
          style={{
            background: isUser ? 'var(--user-bubble)' : 'var(--surface)',
            borderRadius: isUser ? '1rem 0.25rem 1rem 1rem' : '0.25rem 1rem 1rem 1rem',
          }}
        >
          {userImageUrls(message).map((url) => (
            <img
              key={url.slice(0, 40)}
              src={url}
              alt="Attached"
              className="max-w-xs max-h-48 rounded-lg mb-2 object-contain"
            />
          ))}

          {editing && isUser ? (
            <div className="flex flex-col gap-2">
              <textarea
                value={editDraft}
                onChange={(e) => setEditDraft(e.target.value)}
                className="bg-transparent outline-none resize-none text-sm leading-relaxed w-full min-h-[3rem]"
                style={{ color: 'var(--text-primary)' }}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    submitEdit()
                  }
                  if (e.key === 'Escape') cancelEdit()
                }}
              />
              <div className="flex gap-1.5 justify-end">
                <button onClick={cancelEdit} className="btn-ghost text-xs px-2 py-0.5 flex items-center gap-1">
                  <X size={11} /> Cancel
                </button>
                <button onClick={submitEdit} className="btn-primary text-xs px-2 py-0.5">
                  Send
                </button>
              </div>
            </div>
          ) : isUser ? (
            <div className="text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>
              <MarkdownContent text={message.content} variant="user" />
            </div>
          ) : (
            <div
              className={clsx(
                'prose prose-sm max-w-none',
                message.isStreaming && !message.content && 'streaming-cursor',
              )}
              style={{ color: 'var(--text-primary)' }}
            >
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkBreaks]}
                components={{
                  code({ className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || '')
                    const isBlock = match !== null
                    if (isBlock) {
                      return (
                        <SyntaxHighlighter
                          style={oneDark as never}
                          language={match[1]}
                          PreTag="div"
                          customStyle={{ borderRadius: '0.5rem', fontSize: '0.8rem' }}
                        >
                          {String(children).replace(/\n$/, '')}
                        </SyntaxHighlighter>
                      )
                    }
                    return (
                      <code
                        className={className}
                        style={{
                          background: 'var(--bg-tertiary)',
                          padding: '0.15em 0.4em',
                          borderRadius: '0.25rem',
                          fontSize: '0.85em',
                        }}
                        {...props}
                      >
                        {children}
                      </code>
                    )
                  },
                  p({ children }) {
                    return <p style={{ margin: '0.4em 0' }}>{children}</p>
                  },
                  a({ href, children }) {
                    return (
                      <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>
                        {children}
                      </a>
                    )
                  },
                  table({ children }) {
                    return (
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.85rem' }}>
                          {children}
                        </table>
                      </div>
                    )
                  },
                  th({ children }) {
                    return (
                      <th
                        style={{
                          borderBottom: '1px solid var(--border)',
                          padding: '0.4rem 0.75rem',
                          textAlign: 'left',
                          color: 'var(--text-secondary)',
                          fontWeight: 600,
                        }}
                      >
                        {children}
                      </th>
                    )
                  },
                  td({ children }) {
                    return (
                      <td style={{ borderBottom: '1px solid var(--border)', padding: '0.4rem 0.75rem' }}>
                        {children}
                      </td>
                    )
                  },
                }}
              >
                {message.content}
              </ReactMarkdown>
              {message.isStreaming && message.content ? <span className="streaming-cursor" /> : null}
            </div>
          )}
        </div>

        <div className={clsx('flex items-center gap-0.5', isUser ? 'flex-row-reverse' : 'flex-row')}>
          <CopyButton text={message.content} />

          {!isUser && !isStreaming && message.content.trim() && (
            <button
              type="button"
              onClick={() => void speakAssistant()}
              disabled={ttsBusy}
              className="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity btn-ghost disabled:opacity-40"
              title={ttsProvider === 'elevenlabs' ? 'Read aloud (ElevenLabs or browser fallback)' : 'Read aloud (browser)'}
            >
              <Volume2 size={13} />
            </button>
          )}

          <button
            onClick={() => onBookmark(message.id)}
            className={clsx(
              'p-1 rounded transition-opacity btn-ghost',
              message.bookmarked ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
            )}
            style={message.bookmarked ? { color: 'var(--accent)' } : undefined}
            title={message.bookmarked ? 'Remove bookmark' : 'Bookmark'}
          >
            {message.bookmarked ? <BookmarkCheck size={13} /> : <Bookmark size={13} />}
          </button>

          {isUser && !isStreaming && (
            <button
              onClick={() => {
                setEditDraft(message.content)
                setEditing(true)
              }}
              className="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity btn-ghost"
              title="Edit message"
            >
              <Edit2 size={13} />
            </button>
          )}

          {!isUser && isLast && !isStreaming && (
            <button
              onClick={onRegenerate}
              className="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity btn-ghost"
              title="Regenerate response"
            >
              <RefreshCw size={13} />
            </button>
          )}

          <button
            onClick={() => onBranch(message.id)}
            className="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity btn-ghost"
            title="Branch from here"
          >
            <GitBranch size={13} />
          </button>

          {message.tokenCount != null && (
            <span
              className="text-xs opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ color: 'var(--text-secondary)' }}
            >
              {estimateCost(message.tokenCount)}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
