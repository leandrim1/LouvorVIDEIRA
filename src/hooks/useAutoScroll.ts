import { useEffect, useRef, type RefObject } from 'react'

/**
 * Rolagem automática suave (para leitura de cifras durante o louvor).
 * `speed` de 1 a 10. Sem container, rola a página.
 */
export function useAutoScroll(
  active: boolean,
  speed: number,
  container: RefObject<HTMLElement | null> | null,
  onEnd?: () => void,
) {
  const onEndRef = useRef(onEnd)
  useEffect(() => {
    onEndRef.current = onEnd
  })

  useEffect(() => {
    if (!active) return
    let frame = 0
    let last = performance.now()
    let carry = 0
    const pxPerSecond = 8 + speed * 7

    const tick = (now: number) => {
      const el = container?.current ?? document.scrollingElement
      if (!el) return
      const delta = ((now - last) / 1000) * pxPerSecond + carry
      last = now
      const step = Math.floor(delta)
      carry = delta - step
      if (step > 0) {
        if (container?.current) container.current.scrollTop += step
        else window.scrollBy(0, step)
      }
      const atEnd = el.scrollTop + el.clientHeight >= el.scrollHeight - 2
      if (atEnd) {
        onEndRef.current?.()
        return
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [active, speed, container])
}
