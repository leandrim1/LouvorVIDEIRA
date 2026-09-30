import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { Outlet, ScrollRestoration, useLocation } from 'react-router-dom'
import { CommandPaletteContext } from '@/contexts/commandPalette'
import { useNotifications } from '@/hooks/useData'
import { CommandPalette } from '@/components/search/CommandPalette'
import { NotificationPrompt } from '@/components/notifications/NotificationPrompt'
import { PushBridge } from '@/components/notifications/PushBridge'
import { isServerMode } from '@/services/config'
import { LoadingState } from '@/components/ui'
import { BottomNav } from './BottomNav'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

function isTypingTarget(target: EventTarget | null) {
  const el = target as HTMLElement | null
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)
}

export function AppLayout() {
  const [searchOpen, setSearchOpen] = useState(false)
  const { data: notifications = [] } = useNotifications()
  const unread = notifications.filter((n) => !n.read).length

  const open = useCallback(() => setSearchOpen(true), [])
  const close = useCallback(() => setSearchOpen(false), [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen((o) => !o)
      } else if (e.key === '/' && !isTypingTarget(e.target) && !document.querySelector('[data-overlay-root]')) {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const palette = useMemo(() => ({ open, close, isOpen: searchOpen }), [open, close, searchOpen])

  return (
    <CommandPaletteContext.Provider value={palette}>
      <div className="min-h-dvh">
        <a
          href="#conteudo"
          className="sr-only z-50 rounded-lg bg-brand-600 px-4 py-2 font-semibold text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          Pular para o conteúdo
        </a>
        <Sidebar unread={unread} />
        <div className="lg:pl-64">
          <Topbar onSearch={open} />
          <main id="conteudo" className="mx-auto w-full max-w-7xl px-4 pt-5 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-6 sm:pt-7 lg:px-8 lg:pb-14">
            <Suspense fallback={<LoadingState />}>
              <Outlet />
            </Suspense>
          </main>
        </div>
        <BottomNav unread={unread} />
        <CommandPalette open={searchOpen} onClose={close} />
        {isServerMode && (
          <>
            <PushBridge />
            <NotificationPrompt />
          </>
        )}
        {import.meta.env.VITE_ROUTER === 'memory' ? <ScrollToTop /> : <ScrollRestoration />}
      </div>
    </CommandPaletteContext.Provider>
  )
}

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}
