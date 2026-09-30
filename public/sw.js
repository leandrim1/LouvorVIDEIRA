/*
 * Service worker do Louvor Videira: recebe notificações push (mesmo com o site fechado),
 * mostra a notificação nativa e abre o conteúdo ao tocar.
 * Não guarda páginas em cache: o site sempre carrega a versão publicada mais recente.
 */
const APP_NAME = 'Louvor Videira'
const ICON = '/icon-192.png'
const BADGE = '/badge-96.png'

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

/** Só caminhos internos (evita que uma mensagem abra um site externo) */
function safeUrl(url) {
  try {
    const target = new URL(url || '/', self.location.origin)
    return target.origin === self.location.origin ? target.href : self.location.origin + '/'
  } catch {
    return self.location.origin + '/'
  }
}

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }
  const title = data.title || APP_NAME
  const options = {
    body: data.body || 'Você tem uma nova notificação.',
    icon: ICON,
    badge: BADGE,
    // Mesma tag = substitui a anterior em vez de empilhar notificações iguais
    tag: data.tag || data.notificationId || undefined,
    renotify: false,
    lang: 'pt-BR',
    timestamp: Date.now(),
    data: { url: safeUrl(data.url), notificationId: data.notificationId || null },
  }
  event.waitUntil(
    (async () => {
      await self.registration.showNotification(title, options)
      // Com o app aberto, atualiza o sino na hora
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      windows.forEach((c) => c.postMessage({ type: 'push-received' }))
    })(),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const { url, notificationId } = event.notification.data || {}
  const target = safeUrl(url)
  event.waitUntil(
    (async () => {
      // Marca como lida (usa a sessão do navegador; sem sessão, a central marca ao abrir)
      if (notificationId) {
        fetch('/api/notifications/read', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ id: notificationId }),
        }).catch(() => undefined)
      }
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const existing = windows.find((c) => new URL(c.url).origin === self.location.origin)
      if (existing) {
        // App já aberto: foca a janela e leva até o conteúdo
        await existing.focus().catch(() => undefined)
        existing.postMessage({ type: 'open-url', url: new URL(target).pathname + new URL(target).search })
        return
      }
      await self.clients.openWindow(target)
    })(),
  )
})

// O navegador renovou a inscrição: registra a nova no servidor
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      const options = event.oldSubscription ? event.oldSubscription.options : null
      if (!options || !options.applicationServerKey) return
      const subscription = await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: options.applicationServerKey })
      await fetch('/api/notifications/subscribe', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ subscription: subscription.toJSON(), auto: true }),
      })
    })().catch(() => undefined),
  )
})
