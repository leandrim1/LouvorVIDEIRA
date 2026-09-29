import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AArrowDown, AArrowUp, Maximize2, Minimize2, Pause, Play, ChevronsDown } from 'lucide-react'
import { useAutoScroll } from '@/hooks/useAutoScroll'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { useWakeLock } from '@/hooks/useWakeLock'
import { cn } from '@/lib/utils'

const MIN_FONT = 11
const MAX_FONT = 34

interface ReaderFrameProps {
  title: string
  subtitle?: string
  /** Chave para lembrar o tamanho da fonte neste dispositivo */
  storageKey: string
  defaultFontSize: number
  /** Controles extras (ex.: seletor de tom) exibidos na barra */
  controls?: ReactNode
  children: (fontSize: number) => ReactNode
  className?: string
}

function ToolButton({ label, onClick, children, active, disabled }: { label: string; onClick: () => void; children: ReactNode; active?: boolean; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={cn(
        'flex size-10 items-center justify-center rounded-xl transition-colors disabled:opacity-40 [&_svg]:size-[18px]',
        active ? 'bg-brand-600 text-white dark:bg-brand-600' : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
      )}
    >
      {children}
    </button>
  )
}

/**
 * Moldura de leitura para letra/cifra: tamanho da fonte, rolagem automática,
 * tela cheia (com tela sempre acesa) e rolagem confortável.
 */
export function ReaderFrame({ title, subtitle, storageKey, defaultFontSize, controls, children, className }: ReaderFrameProps) {
  const [fontSize, setFontSize] = useLocalStorage(`reader:${storageKey}`, defaultFontSize)
  const [fullscreen, setFullscreen] = useState(false)
  const [scrolling, setScrolling] = useState(false)
  const [speed, setSpeed] = useLocalStorage('reader:scrollSpeed', 3)
  const overlayRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useAutoScroll(scrolling, speed, fullscreen ? scrollRef : null, () => setScrolling(false))
  useWakeLock(fullscreen || scrolling)

  const exitFullscreen = useCallback(() => {
    setFullscreen(false)
    setScrolling(false)
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined)
  }, [])

  const enterFullscreen = () => {
    setScrolling(false)
    setFullscreen(true)
  }

  useEffect(() => {
    if (!fullscreen) return
    const el = overlayRef.current
    el?.requestFullscreen?.().catch(() => undefined)
    const onChange = () => {
      if (!document.fullscreenElement) setFullscreen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') exitFullscreen()
      if (e.key === ' ' && e.target === document.body) {
        e.preventDefault()
        setScrolling((s) => !s)
      }
    }
    document.addEventListener('fullscreenchange', onChange)
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('fullscreenchange', onChange)
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [fullscreen, exitFullscreen])

  const toolbar = (
    <div className="flex flex-wrap items-center gap-1">
      <div className="flex items-center rounded-xl ring-1 ring-line ring-inset">
        <ToolButton label="Diminuir fonte" onClick={() => setFontSize((s) => Math.max(MIN_FONT, s - 1))} disabled={fontSize <= MIN_FONT}>
          <AArrowDown />
        </ToolButton>
        <span className="tabular w-8 text-center text-xs font-semibold text-ink-2" aria-live="polite" aria-label={`Fonte ${fontSize}`}>
          {fontSize}
        </span>
        <ToolButton label="Aumentar fonte" onClick={() => setFontSize((s) => Math.min(MAX_FONT, s + 1))} disabled={fontSize >= MAX_FONT}>
          <AArrowUp />
        </ToolButton>
      </div>
      <div className="flex items-center rounded-xl ring-1 ring-line ring-inset">
        <ToolButton label={scrolling ? 'Pausar rolagem automática' : 'Rolagem automática'} onClick={() => setScrolling((s) => !s)} active={scrolling}>
          {scrolling ? <Pause /> : <ChevronsDown />}
        </ToolButton>
        <label className="flex items-center gap-1.5 pr-3 pl-1 text-xs font-semibold text-ink-3">
          <span className="sr-only">Velocidade da rolagem</span>
          <input
            type="range"
            min={1}
            max={10}
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            className="h-1 w-16 cursor-pointer accent-brand-600 sm:w-20"
            aria-label="Velocidade da rolagem"
          />
          <span className="tabular w-3">{speed}</span>
        </label>
      </div>
      <ToolButton label={fullscreen ? 'Sair da tela cheia' : 'Tela cheia'} onClick={fullscreen ? exitFullscreen : enterFullscreen}>
        {fullscreen ? <Minimize2 /> : <Maximize2 />}
      </ToolButton>
    </div>
  )

  return (
    <>
      <div className={cn('rounded-2xl border border-line bg-surface', className)}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2">
          {controls ?? <span />}
          {toolbar}
        </div>
        <div className="scrollbar-thin relative overflow-x-auto px-4 py-5 sm:px-6">{children(fontSize)}</div>
      </div>

      {fullscreen &&
        createPortal(
          <div ref={overlayRef} data-overlay-root className="fixed inset-0 z-[55] flex animate-fade-in flex-col bg-canvas">
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-line bg-surface px-3 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 sm:px-5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-bold text-ink">{title}</p>
                {subtitle && <p className="truncate text-xs text-ink-3">{subtitle}</p>}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {controls}
                {toolbar}
              </div>
            </div>
            <div
              ref={scrollRef}
              className="scrollbar-thin flex-1 overflow-auto overscroll-contain px-5 py-6 sm:px-10"
              onClick={() => scrolling && setScrolling(false)}
            >
              <div className="mx-auto max-w-4xl pb-[40vh]">{children(fontSize)}</div>
            </div>
            {!scrolling && (
              <button
                type="button"
                onClick={() => setScrolling(true)}
                className="pb-safe fixed right-5 bottom-5 flex size-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-xl transition-transform active:scale-95 dark:bg-brand-600"
                aria-label="Iniciar rolagem automática"
              >
                <Play className="ml-0.5 size-6 fill-current" />
              </button>
            )}
          </div>,
          document.body,
        )}
    </>
  )
}
