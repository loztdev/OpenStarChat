import { useState, useCallback, useEffect } from 'react'
import { AppLayout } from './components/layout/AppLayout'
import { ChatView } from './components/chat/ChatView'
import { ModelPicker } from './components/models/ModelPicker'
import { PromptLibrary } from './components/prompts/PromptLibrary'
import { CharacterSelector } from './components/characters/CharacterSelector'
import { CharactersPage } from './components/characters/CharactersPage'
import { SettingsModal } from './components/settings/SettingsModal'
import { BookmarksPanel } from './components/bookmarks/BookmarksPanel'
import { Starfield } from './components/Starfield'
import { useIdleTimer } from './hooks/useIdleTimer'
import { useChatStore } from './store/chatStore'
import { useSettingsStore } from './store/settingsStore'

type MainView = 'chat' | 'characters'

export default function App() {
  const [showSettings, setShowSettings] = useState(false)
  const [showModelPicker, setShowModelPicker] = useState(false)
  const [showPrompts, setShowPrompts] = useState(false)
  const [showCharacters, setShowCharacters] = useState(false)
  const [showBookmarks, setShowBookmarks] = useState(false)
  const [isIdle, setIsIdle] = useState(false)
  const [view, setView] = useState<MainView>('chat')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const activeChatId = useChatStore((s) => s.activeChatId)
  const createChat = useChatStore((s) => s.createChat)
  const setActiveChatId = useChatStore((s) => s.setActiveChatId)
  const idleAnimation = useSettingsStore((s) => s.idleAnimation)
  const defaultModelId = useSettingsStore((s) => s.defaultModelId)
  const apiKey = useSettingsStore((s) => s.apiKey)
  const freeProviderEnabled = useSettingsStore((s) => s.freeProvider.enabled)

  const handleIdle = useCallback(() => setIsIdle(true), [])
  const handleActive = useCallback(() => setIsIdle(false), [])

  useIdleTimer(15_000, handleIdle, handleActive)

  // Global keyboard shortcuts
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const ctrl = e.ctrlKey || e.metaKey
      const tag = (e.target as HTMLElement).tagName.toLowerCase()
      const isInput = tag === 'input' || tag === 'textarea'

      if (e.key === 'Escape') {
        setShowSettings(false)
        setShowModelPicker(false)
        setShowPrompts(false)
        setShowCharacters(false)
        setShowBookmarks(false)
        setIsIdle(false)
        return
      }

      if (ctrl && !isInput) {
        if (e.key === 'k' || e.key === 'K') {
          e.preventDefault()
          setShowModelPicker((v) => !v)
        } else if (e.key === 'n' || e.key === 'N') {
          e.preventDefault()
          setView('chat')
          if (apiKey || freeProviderEnabled) createChat(defaultModelId)
          else setShowSettings(true)
        } else if (e.key === '/') {
          e.preventDefault()
          setShowPrompts((v) => !v)
        } else if (e.key === 'b' || e.key === 'B') {
          e.preventDefault()
          setShowBookmarks((v) => !v)
        } else if (e.key === ',') {
          e.preventDefault()
          setShowSettings((v) => !v)
        } else if ((e.key === 'p' || e.key === 'P') && e.shiftKey) {
          e.preventDefault()
          setView((v) => (v === 'characters' ? 'chat' : 'characters'))
        }
      }
    }

    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [apiKey, freeProviderEnabled, createChat, defaultModelId])

  function handleNavigateToChat(chatId: string) {
    setActiveChatId(chatId)
    setView('chat')
  }

  return (
    <>
      <AppLayout
        onOpenSettings={() => setShowSettings(true)}
        onOpenBookmarks={() => setShowBookmarks(true)}
        view={view}
        onChangeView={setView}
        sidebarOpen={sidebarOpen}
        onSidebarOpenChange={setSidebarOpen}
      >
        {view === 'chat' ? (
          <ChatView
            onOpenModelPicker={() => setShowModelPicker(true)}
            onOpenPrompts={() => setShowPrompts(true)}
            onOpenCharacters={() => setShowCharacters(true)}
            onOpenCharactersPage={() => setView('characters')}
            onNeedApiKey={() => setShowSettings(true)}
            onOpenSidebar={() => setSidebarOpen(true)}
          />
        ) : (
          <CharactersPage
            onBackToChat={() => setView('chat')}
            onOpenSidebar={() => setSidebarOpen(true)}
          />
        )}
      </AppLayout>

      {/* Modals */}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      {showModelPicker && (
        <ModelPicker onClose={() => setShowModelPicker(false)} chatId={activeChatId} />
      )}
      {showPrompts && <PromptLibrary onClose={() => setShowPrompts(false)} />}
      {showCharacters && (
        <CharacterSelector
          onClose={() => setShowCharacters(false)}
          onOpenManager={() => {
            setShowCharacters(false)
            setView('characters')
          }}
        />
      )}
      {showBookmarks && (
        <BookmarksPanel
          onClose={() => setShowBookmarks(false)}
          onNavigateToChat={handleNavigateToChat}
        />
      )}

      {/* Idle animation */}
      {isIdle && (
        <Starfield
          onDismiss={() => setIsIdle(false)}
          animationType={idleAnimation}
        />
      )}
    </>
  )
}
