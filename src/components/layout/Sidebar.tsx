import { useState, useRef, useEffect } from 'react'
import {
  MessageSquare, Plus, Trash2, Settings, ChevronLeft, ChevronRight,
  Download, Upload, Pin, PinOff, Search, Bookmark, ChevronDown, Users, X, Archive,
} from 'lucide-react'
import { useChatStore } from '../../store/chatStore'
import { useSettingsStore } from '../../store/settingsStore'
import clsx from 'clsx'
import type { Chat } from '../../types'

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
  onOpenSettings: () => void
  onOpenBookmarks: () => void
  view: 'chat' | 'characters'
  onChangeView: (v: 'chat' | 'characters') => void
  /** Whether the mobile overlay is open. Ignored on >= md screens. */
  mobileOpen?: boolean
  /** Close handler for the mobile overlay. */
  onMobileClose?: () => void
}

export function Sidebar({
  collapsed, onToggle, onOpenSettings, onOpenBookmarks, view, onChangeView,
  mobileOpen = false, onMobileClose,
}: SidebarProps) {
  const chats = useChatStore((s) => s.chats)
  const activeChatId = useChatStore((s) => s.activeChatId)
  const createChat = useChatStore((s) => s.createChat)
  const deleteChat = useChatStore((s) => s.deleteChat)
  const setActiveChatId = useChatStore((s) => s.setActiveChatId)
  const exportChats = useChatStore((s) => s.exportChats)
  const exportChatsMarkdown = useChatStore((s) => s.exportChatsMarkdown)
  const exportChatsText = useChatStore((s) => s.exportChatsText)
  const exportAll = useChatStore((s) => s.exportAll)
  const importChats = useChatStore((s) => s.importChats)
  const importAll = useChatStore((s) => s.importAll)
  const togglePinChat = useChatStore((s) => s.togglePinChat)
  const defaultModelId = useSettingsStore((s) => s.defaultModelId)

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [importToast, setImportToast] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const importAllRef = useRef<HTMLInputElement>(null)

  // Collapsed icon-only mode only applies on desktop. On mobile, the overlay
  // always shows full labels regardless of the `collapsed` setting.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(max-width: 767px)')
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  const effectiveCollapsed = collapsed && !isMobile

  function handleNewChat() {
    createChat(defaultModelId)
    onChangeView('chat')
  }

  function handleDeleteChat(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (deleteConfirmId === id) {
      deleteChat(id)
      setDeleteConfirmId(null)
    } else {
      setDeleteConfirmId(id)
      setTimeout(() => setDeleteConfirmId(null), 2500)
    }
  }

  function handlePinChat(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    togglePinChat(id)
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string)
        if (Array.isArray(data)) {
          importChats(data as Chat[])
        }
      } catch {
        // invalid JSON — ignore
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  function handleImportAll(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const ok = importAll(reader.result as string)
      setImportToast(ok ? 'Full backup imported!' : 'Invalid backup file.')
      setTimeout(() => setImportToast(null), 3000)
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const q = searchQuery.toLowerCase().trim()
  const filtered = chats.filter((c) => {
    if (!q) return true
    if (c.title.toLowerCase().includes(q)) return true
    return c.messages.some((m) => m.content.toLowerCase().includes(q))
  })

  const pinned = filtered.filter((c) => c.pinned).sort((a, b) => b.updatedAt - a.updatedAt)
  const unpinned = filtered.filter((c) => !c.pinned).sort((a, b) => b.updatedAt - a.updatedAt)
  const sorted = [...pinned, ...unpinned]

  function ChatRow({ chat }: { chat: Chat }) {
    const isActive = activeChatId === chat.id
    return (
      <button
        key={chat.id}
        onClick={() => { setActiveChatId(chat.id); onChangeView('chat') }}
        className={clsx(
          'w-full flex items-center gap-2 px-2 py-2 mx-0 rounded-md text-left text-sm group transition-colors relative',
          isActive ? 'bg-accent text-white' : 'hover:bg-tertiary'
        )}
        style={isActive ? { background: 'var(--accent)', color: 'white' } : undefined}
        title={effectiveCollapsed ? chat.title : undefined}
      >
        {chat.pinned ? (
          <Pin size={13} className="shrink-0" style={{ color: isActive ? 'white' : 'var(--accent)' }} />
        ) : (
          <MessageSquare size={14} className="shrink-0" style={{ color: isActive ? 'white' : 'var(--text-secondary)' }} />
        )}
        {!effectiveCollapsed && (
          <>
            <span className="truncate flex-1 min-w-0">{chat.title}</span>
            <div className="shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={(e) => handlePinChat(chat.id, e)}
                className="p-0.5 rounded"
                style={{ color: chat.pinned ? 'var(--accent)' : undefined }}
                title={chat.pinned ? 'Unpin' : 'Pin'}
              >
                {chat.pinned ? <PinOff size={11} /> : <Pin size={11} />}
              </button>
              <button
                onClick={(e) => handleDeleteChat(chat.id, e)}
                className={clsx(
                  'p-0.5 rounded',
                  deleteConfirmId === chat.id ? 'opacity-100' : ''
                )}
                style={{ color: deleteConfirmId === chat.id ? 'var(--danger)' : undefined }}
                title={deleteConfirmId === chat.id ? 'Click again to confirm' : 'Delete chat'}
              >
                <Trash2 size={11} />
              </button>
            </div>
          </>
        )}
      </button>
    )
  }

  return (
    <aside
      className={clsx(
        'sidebar-aside flex flex-col h-full border-r border-subtle',
        // Mobile: off-canvas overlay
        'fixed left-0 top-0 bottom-0 z-40 w-72 max-w-[85vw] transition-transform duration-200',
        mobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full',
        // Desktop: docked, override fixed positioning + translation
        'md:static md:translate-x-0 md:shadow-none md:max-w-none md:transition-[width]',
        collapsed ? 'md:w-12' : 'md:w-64',
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-subtle shrink-0">
        {!effectiveCollapsed && (
          <span className="font-bold text-lg tracking-tight accent-text truncate">OpenStarChat</span>
        )}
        {/* Mobile-only close button */}
        <button
          onClick={onMobileClose}
          className="btn-ghost p-1.5 rounded-md md:hidden"
          title="Close sidebar"
          aria-label="Close sidebar"
        >
          <X size={16} />
        </button>
        {/* Desktop-only collapse toggle */}
        <button
          onClick={onToggle}
          className={clsx('btn-ghost p-1.5 rounded-md hidden md:inline-flex', collapsed && 'mx-auto')}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* New Chat */}
      <div className="p-2 shrink-0">
        <button
          onClick={handleNewChat}
          className={clsx(
            'btn-primary flex items-center gap-2 w-full justify-center text-sm',
            effectiveCollapsed ? 'p-2' : 'px-3 py-2'
          )}
          title="New Chat (Ctrl+N)"
        >
          <Plus size={16} />
          {!effectiveCollapsed && <span>New Chat</span>}
        </button>
      </div>

      {/* View tabs */}
      <div className="px-2 pb-2 shrink-0 flex flex-col gap-1">
        <button
          onClick={() => onChangeView('chat')}
          className={clsx(
            'flex items-center gap-2 w-full text-sm rounded-lg px-2 py-1.5 transition-colors',
            effectiveCollapsed ? 'justify-center' : 'justify-start',
            view === 'chat' ? 'tab-active' : 'btn-ghost'
          )}
          style={view === 'chat'
            ? { background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }
            : undefined}
          title="Chats"
        >
          <MessageSquare size={15} />
          {!effectiveCollapsed && <span className="font-medium">Chats</span>}
        </button>
        <button
          onClick={() => onChangeView('characters')}
          className={clsx(
            'flex items-center gap-2 w-full text-sm rounded-lg px-2 py-1.5 transition-colors',
            effectiveCollapsed ? 'justify-center' : 'justify-start',
            view === 'characters' ? '' : 'btn-ghost'
          )}
          style={view === 'characters'
            ? { background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }
            : undefined}
          title="Characters (Ctrl+Shift+P)"
        >
          <Users size={15} />
          {!effectiveCollapsed && <span className="font-medium">Characters</span>}
        </button>
      </div>

      {/* Search */}
      {!effectiveCollapsed && (
        <div className="px-2 pb-1 shrink-0">
          <div
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-subtle"
            style={{ background: 'var(--bg-tertiary)' }}
          >
            <Search size={13} className="text-muted shrink-0" />
            <input
              type="text"
              placeholder="Search chats…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent outline-none text-xs flex-1 min-w-0"
              style={{ color: 'var(--text-primary)' }}
            />
          </div>
        </div>
      )}

      {/* Chat list */}
      <div className="flex-1 overflow-y-auto min-h-0 py-1 px-1">
        {sorted.length === 0 && !effectiveCollapsed && (
          <p className="text-center text-muted text-xs px-4 py-8">
            {searchQuery ? 'No matching chats.' : 'No chats yet. Start a new one!'}
          </p>
        )}
        {sorted.map((chat) => (
          <ChatRow key={chat.id} chat={chat} />
        ))}
      </div>

      {/* Footer */}
      <div className="border-t border-subtle p-2 shrink-0 flex flex-col gap-1">
        {/* Bookmarks */}
        <button
          onClick={onOpenBookmarks}
          className={clsx('btn-ghost flex items-center gap-2 w-full text-sm', effectiveCollapsed ? 'justify-center' : '')}
          title="Bookmarked messages"
        >
          <Bookmark size={15} />
          {!effectiveCollapsed && <span>Bookmarks</span>}
        </button>

        {/* Export with submenu */}
        <div className="relative">
          <button
            onClick={() => setShowExportMenu((v) => !v)}
            className={clsx('btn-ghost flex items-center gap-2 w-full text-sm', effectiveCollapsed ? 'justify-center' : '')}
            title="Export chats"
          >
            <Download size={15} />
            {!effectiveCollapsed && (
              <>
                <span className="flex-1 text-left">Export Chats</span>
                <ChevronDown size={12} className={clsx('transition-transform', showExportMenu && 'rotate-180')} />
              </>
            )}
          </button>
          {showExportMenu && !effectiveCollapsed && (
            <div
              className="absolute bottom-full left-0 mb-1 w-full rounded-lg border border-subtle shadow-lg overflow-hidden z-10"
              style={{ background: 'var(--bg-secondary)' }}
            >
              {[
                { label: 'JSON (Chats)', fn: exportChats },
                { label: 'Markdown', fn: exportChatsMarkdown },
                { label: 'Plain Text', fn: exportChatsText },
                { label: '📦 Full Backup (All Data)', fn: exportAll },
              ].map(({ label, fn }) => (
                <button
                  key={label}
                  onClick={() => { fn(); setShowExportMenu(false) }}
                  className="w-full text-left px-3 py-2 text-xs btn-ghost rounded-none"
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Import */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className={clsx('btn-ghost flex items-center gap-2 w-full text-sm', effectiveCollapsed ? 'justify-center' : '')}
          title="Import chats from JSON"
        >
          <Upload size={15} />
          {!effectiveCollapsed && <span>Import Chats</span>}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={handleImport}
        />

        {/* Import Full Backup */}
        <button
          onClick={() => importAllRef.current?.click()}
          className={clsx('btn-ghost flex items-center gap-2 w-full text-sm', effectiveCollapsed ? 'justify-center' : '')}
          title="Import full backup (chats + settings)"
        >
          <Archive size={15} />
          {!effectiveCollapsed && <span>Import Backup</span>}
        </button>
        <input
          ref={importAllRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={handleImportAll}
        />

        {/* Settings */}
        <button
          onClick={onOpenSettings}
          className={clsx('btn-ghost flex items-center gap-2 w-full text-sm', effectiveCollapsed ? 'justify-center' : '')}
          title="Settings"
        >
          <Settings size={15} />
          {!effectiveCollapsed && <span>Settings</span>}
        </button>

        {/* Import toast */}
        {importToast && !effectiveCollapsed && (
          <div
            className="text-xs text-center py-1.5 rounded-lg mt-1 fade-in"
            style={{ background: 'var(--accent)', color: 'white' }}
          >
            {importToast}
          </div>
        )}
      </div>
    </aside>
  )
}
