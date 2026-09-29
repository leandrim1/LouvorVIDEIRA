import { useEffect } from 'react'

/** Mantém a tela acesa enquanto `active` (leitura de cifra em tela cheia) */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return
    let sentinel: WakeLockSentinel | null = null
    let cancelled = false
    const request = async () => {
      try {
        sentinel = await navigator.wakeLock.request('screen')
        if (cancelled) void sentinel.release()
      } catch {
        /* não suportado ou negado */
      }
    }
    void request()
    const onVisibility = () => document.visibilityState === 'visible' && void request()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibility)
      void sentinel?.release()
    }
  }, [active])
}
