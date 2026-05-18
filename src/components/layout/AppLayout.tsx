import { useState } from 'react'
import { Sidebar } from './Sidebar'

interface AppLayoutProps {
  children: React.ReactNode
  onOpenSettings: () => void
  onOpenBookmarks: () => void
  onOpenUsage: () => void
  view: 'chat' | 'characters'
  onChangeView: (v: 'chat' | 'characters') => void
  sidebarOpen: boolean
  onSidebarOpenChange: (open: boolean) => void
}

export function AppLayout({
  children,
  onOpenSettings,
  onOpenBookmarks,
  onOpenUsage,
  view,
  onChangeView,
  sidebarOpen,
  onSidebarOpenChange,
}: AppLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  function closeMobile() {
    onSidebarOpenChange(false)
  }

  function handleChangeView(v: 'chat' | 'characters') {
    onChangeView(v)
    closeMobile()
  }

  return (
    <div className="relative z-10 flex h-full overflow-hidden app-bg">
      {/* Mobile backdrop — covers main content while sidebar is open */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 md:hidden fade-in"
          style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)' }}
          onClick={closeMobile}
          aria-hidden
        />
      )}

      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((v) => !v)}
        onOpenSettings={() => { onOpenSettings(); closeMobile() }}
        onOpenBookmarks={() => { onOpenBookmarks(); closeMobile() }}
        onOpenUsage={() => { onOpenUsage(); closeMobile() }}
        view={view}
        onChangeView={handleChangeView}
        mobileOpen={sidebarOpen}
        onMobileClose={closeMobile}
      />

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {children}
      </main>
    </div>
  )
}
