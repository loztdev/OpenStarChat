import { X, Bookmark, MessageSquare } from 'lucide-react'
import { useChatStore } from '../../store/chatStore'

interface BookmarksPanelProps {
  onClose: () => void
  onNavigateToChat: (chatId: string) => void
}

export function BookmarksPanel({ onClose, onNavigateToChat }: BookmarksPanelProps) {
  const chats = useChatStore((s) => s.chats)
  const toggleBookmarkMessage = useChatStore((s) => s.toggleBookmarkMessage)

  const bookmarked = chats.flatMap((chat) =>
    chat.messages
      .filter((m) => m.bookmarked && m.role !== 'system')
      .map((m) => ({ chat, message: m }))
  ).sort((a, b) => b.message.createdAt - a.message.createdAt)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.65)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-lg rounded-2xl shadow-2xl fade-in overflow-hidden max-h-[85vh] flex flex-col"
        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-subtle shrink-0">
          <h2 className="font-bold text-base flex items-center gap-2">
            <Bookmark size={16} className="accent-text" />
            Bookmarked Messages
          </h2>
          <button onClick={onClose} className="btn-ghost p-1.5 rounded-lg"><X size={16} /></button>
        </div>

        <div className="overflow-y-auto flex-1">
          {bookmarked.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted">
              <Bookmark size={32} className="opacity-30" />
              <p className="text-sm">No bookmarks yet.</p>
              <p className="text-xs opacity-70">Hover over any message and click the bookmark icon.</p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {bookmarked.map(({ chat, message }) => (
                <div key={message.id} className="p-4 group hover:bg-tertiary transition-colors" style={{ background: 'transparent' }}>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <button
                      onClick={() => { onNavigateToChat(chat.id); onClose() }}
                      className="flex items-center gap-1.5 text-xs btn-ghost px-2 py-0.5 rounded-md"
                      title="Go to chat"
                    >
                      <MessageSquare size={11} />
                      <span className="truncate max-w-[200px]">{chat.title}</span>
                    </button>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-muted">
                        {message.role === 'user' ? 'You' : message.role === 'tool' ? 'Tool' : 'AI'}
                      </span>
                      <button
                        onClick={() => toggleBookmarkMessage(chat.id, message.id)}
                        className="p-1 btn-ghost rounded opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Remove bookmark"
                        style={{ color: 'var(--accent)' }}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  </div>
                  <p
                    className="text-sm leading-relaxed line-clamp-4 whitespace-pre-wrap"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {message.content}
                  </p>
                  <p className="text-xs text-muted mt-1.5">
                    {new Date(message.createdAt).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
