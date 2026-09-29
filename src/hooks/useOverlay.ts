import { useEffect, useRef, type RefObject } from 'react'

let lockCount = 0

function lockScroll() {
  lockCount++
  if (lockCount === 1) {
    const scrollbar = window.innerWidth - document.documentElement.clientWidth
    document.body.style.overflow = 'hidden'
    if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`
  }
}

function unlockScroll() {
  lockCount = Math.max(0, lockCount - 1)
  if (lockCount === 0) {
    document.body.style.overflow = ''
    document.body.style.paddingRight = ''
  }
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Comportamento comum de Modal/Drawer: trava o scroll, fecha com Esc,
 * mantém o foco dentro do painel e devolve o foco ao fechar.
 */
export function useOverlay(open: boolean, onClose: () => void, containerRef: RefObject<HTMLElement | null>) {
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    if (!open) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    lockScroll()

    const frame = requestAnimationFrame(() => {
      const container = containerRef.current
      if (!container) return
      const autoFocus = container.querySelector<HTMLElement>('[data-autofocus]')
      const first = autoFocus ?? container.querySelector<HTMLElement>(FOCUSABLE)
      ;(first ?? container).focus({ preventScroll: true })
    })

    const onKeyDown = (event: KeyboardEvent) => {
      const container = containerRef.current
      if (!container) return
      // Apenas o overlay mais recente (último no DOM) responde
      const overlays = document.querySelectorAll('[data-overlay-root]')
      if (overlays[overlays.length - 1] !== container.closest('[data-overlay-root]')) return

      if (event.key === 'Escape') {
        event.stopPropagation()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab') return
      const focusables = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      )
      if (focusables.length === 0) {
        event.preventDefault()
        return
      }
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('keydown', onKeyDown)
      unlockScroll()
      previouslyFocused?.focus?.({ preventScroll: true })
    }
  }, [open, containerRef])
}
