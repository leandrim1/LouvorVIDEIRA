import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSession } from '@/contexts/session'
import { emitChange } from '@/services/db'
import { pushService, registerServiceWorker } from '@/services/pushService'
import { isServerMode } from '@/services/config'

/**
 * Liga o service worker ao app aberto:
 * - registra o service worker e mantém a inscrição deste aparelho ligada à conta logada;
 * - ao tocar numa notificação com o app já aberto, navega até o conteúdo;
 * - quando chega um push com o app aberto, atualiza o sino.
 */
export function PushBridge() {
  const navigate = useNavigate()
  const { user } = useSession()
  const userId = user?.approved ? user.id : null

  useEffect(() => {
    if (!isServerMode || !userId) return
    void registerServiceWorker().then(() => pushService.sync())
  }, [userId])

  useEffect(() => {
    if (!isServerMode || !('serviceWorker' in navigator)) return
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; url?: string } | null
      if (data?.type === 'open-url' && typeof data.url === 'string' && data.url.startsWith('/')) {
        emitChange('notifications')
        navigate(data.url)
      } else if (data?.type === 'push-received') {
        emitChange('notifications')
      }
    }
    navigator.serviceWorker.addEventListener('message', onMessage)
    return () => navigator.serviceWorker.removeEventListener('message', onMessage)
  }, [navigate])

  return null
}
