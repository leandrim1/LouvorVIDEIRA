/**
 * Notificações push no navegador (Web Push + service worker).
 * Só a chave pública VAPID chega ao navegador; o envio é sempre feito pelo servidor.
 */
import { apiFetch } from './apiClient'
import { isServerMode } from './config'

export type PushState =
  /** Navegador sem suporte (ou modo demonstração) */
  | 'unsupported'
  /** iPhone/iPad fora da tela inicial: precisa instalar o app para receber push */
  | 'needs-install'
  /** Servidor sem chaves VAPID */
  | 'server-disabled'
  | 'denied'
  /** Permissão ainda não pedida */
  | 'default'
  /** Permissão concedida, mas este aparelho não está inscrito */
  | 'off'
  | 'on'

export interface PushDevice {
  id: string
  deviceName: string
  browser: string
  platform: string
  createdAt: string
  lastUsedAt: string | null
  updatedAt: string
  endpointHash: string
}

export interface NotificationPreferences {
  repertoires: boolean
  repertoireUpdates: boolean
  rehearsals: boolean
  schedules: boolean
  general: boolean
  pushEnabled: boolean
}

export interface PushTestResult {
  created: number
  /** Botão geral "Notificações push" */
  pushEnabled: boolean
  /** Aparelhos ativos da pessoa no servidor */
  devices: number
  pushed: number
  failed: number
  /** Motivos informados pelo serviço de push (FCM, Apple, Mozilla) */
  errors: string[]
}

export interface PushStats {
  enabled: boolean
  usersWithPush: number
  devices: number
  sent: number
  failed: number
  expired: number
}

const isIos = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true

export const pushSupported = () =>
  isServerMode && typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

let registration: Promise<ServiceWorkerRegistration | null> | null = null
let publicKey: Promise<string | null> | null = null

/** Registra o service worker (uma vez) */
export function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isServerMode || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return Promise.resolve(null)
  registration ??= navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => null)
  return registration
}

function vapidKey(): Promise<string | null> {
  publicKey ??= apiFetch<{ publicKey: string | null }>('notifications/config')
    .then((c) => c.publicKey)
    .catch(() => {
      publicKey = null
      return null
    })
  return publicKey
}

function toUint8(base64url: string): Uint8Array<ArrayBuffer> {
  const padded = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(padded)
  const bytes = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const reg = await registerServiceWorker()
  return reg ? reg.pushManager.getSubscription() : null
}

function sameKey(a: ArrayBuffer | null | undefined, b: Uint8Array): boolean {
  if (!a || a.byteLength !== b.byteLength) return false
  const view = new Uint8Array(a)
  return view.every((byte, i) => byte === b[i])
}

/**
 * Inscrição atual com a chave VAPID em uso no servidor. Uma inscrição criada com outra chave
 * (ex.: chaves trocadas no servidor) é recusada pelo serviço de push, então é refeita.
 */
async function subscribeWithKey(reg: ServiceWorkerRegistration, key: string): Promise<PushSubscription> {
  const serverKey = toUint8(key)
  const existing = await reg.pushManager.getSubscription()
  if (existing && sameKey(existing.options.applicationServerKey, serverKey)) return existing
  if (existing) await existing.unsubscribe().catch(() => undefined)
  return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: serverKey })
}

/** SHA-256 do endpoint, para reconhecer este aparelho na lista */
export async function currentEndpointHash(): Promise<string | null> {
  const sub = await currentSubscription().catch(() => null)
  if (!sub) return null
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(sub.endpoint))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

export const pushService = {
  async state(): Promise<PushState> {
    if (!isServerMode || typeof window === 'undefined') return 'unsupported'
    if (isIos() && !isStandalone()) return 'needs-install'
    if (!pushSupported()) return 'unsupported'
    if (!(await vapidKey())) return 'server-disabled'
    if (Notification.permission === 'denied') return 'denied'
    if (Notification.permission === 'default') return 'default'
    return (await currentSubscription()) ? 'on' : 'off'
  },

  /** Pede a permissão (sempre a partir de um clique) e inscreve este aparelho */
  async enable(): Promise<PushState> {
    if (!pushSupported()) return 'unsupported'
    const key = await vapidKey()
    if (!key) return 'server-disabled'
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'default'
    const reg = await registerServiceWorker()
    if (!reg) return 'unsupported'
    await navigator.serviceWorker.ready
    const sub = await subscribeWithKey(reg, key)
    await apiFetch('notifications/subscribe', { method: 'POST', body: { subscription: sub.toJSON(), auto: false } })
    return 'on'
  },

  /** Desativa as notificações neste aparelho */
  async disable(): Promise<void> {
    const sub = await currentSubscription()
    if (!sub) return
    await apiFetch('notifications/subscribe', { method: 'DELETE', body: { endpoint: sub.endpoint, remove: true } }).catch(() => undefined)
    await sub.unsubscribe().catch(() => undefined)
  },

  /**
   * Ao entrar no sistema: se este aparelho já autorizou, garante que a inscrição esteja
   * ligada à conta logada (o servidor não reativa aparelhos removidos pela pessoa).
   */
  async sync(): Promise<void> {
    if (!pushSupported() || Notification.permission !== 'granted') return
    const reg = await registerServiceWorker()
    const key = await vapidKey()
    if (!reg || !key || !(await reg.pushManager.getSubscription())) return
    const sub = await subscribeWithKey(reg, key).catch(() => null)
    if (sub) await apiFetch('notifications/subscribe', { method: 'POST', body: { subscription: sub.toJSON(), auto: true } }).catch(() => undefined)
  },

  /** Ao sair: este aparelho para de receber avisos da conta (a permissão continua) */
  async detach(): Promise<void> {
    const sub = await currentSubscription().catch(() => null)
    if (sub) await apiFetch('notifications/subscribe', { method: 'DELETE', body: { endpoint: sub.endpoint, remove: false } }).catch(() => undefined)
  },

  devices: () => apiFetch<PushDevice[]>('notifications/devices'),
  removeDevice: (id: string) => apiFetch(`notifications/devices/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  preferences: () => apiFetch<NotificationPreferences>('notifications/preferences'),
  savePreferences: (patch: Partial<NotificationPreferences>) => apiFetch<NotificationPreferences>('notifications/preferences', { method: 'PUT', body: patch }),
  sendTest: () => apiFetch<PushTestResult>('notifications/test', { method: 'POST', body: {} }),
  stats: () => apiFetch<PushStats>('notifications/stats'),
}

/** Avisa o servidor de que um repertório/ensaio/escala foi criado ou alterado (ele decide quem recebe) */
export type NotificationEvent =
  | 'REPERTOIRE_CREATED'
  | 'REPERTOIRE_UPDATED'
  | 'REHEARSAL_CREATED'
  | 'REHEARSAL_UPDATED'
  | 'SCHEDULE_CREATED'
  | 'SCHEDULE_UPDATED'

export function dispatchNotification(event: NotificationEvent, entityId: string): void {
  if (!isServerMode) return
  // Não bloqueia nem desfaz o salvamento: o envio acontece no servidor e falhas ficam registradas lá
  void apiFetch('notifications/dispatch', { method: 'POST', body: { event, entityId } }).catch(() => undefined)
}
