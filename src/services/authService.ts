/**
 * Chamadas públicas do fluxo de cadastro (não exigem login).
 * A confirmação do e-mail só acontece no servidor, com o token recebido por e-mail.
 */
import type { UserStatus } from '@/types'
import { apiFetch } from './apiClient'

export interface PendingVerification {
  email: string
  /** Segundos até poder pedir outro e-mail */
  resendAfter: number
}

/** Resultado da etapa da senha: entrou direto (dispositivo confiável) ou precisa do código */
export type SignInResult = { otpRequired: false; trustedDevice: boolean } | { otpRequired: true; email: string; resendAfter: number }

export interface TrustedDevice {
  id: string
  deviceName: string
  browser: string
  os: string
  createdAt: string
  lastUsedAt: string
  expiresAt: string
  revokedAt: string | null
  lastIp: string
  status: 'active' | 'expired' | 'revoked'
  /** É este navegador */
  current?: boolean
}

export const authService = {
  signUp(name: string, email: string, password: string) {
    return apiFetch<PendingVerification>('auth/signup', { method: 'POST', body: { name: name.trim(), email: email.trim(), password } })
  },

  resendVerification(email: string) {
    return apiFetch<{ resendAfter: number }>('auth/resend-verification', { method: 'POST', body: { email: email.trim() } })
  },

  verifyEmail(token: string) {
    return apiFetch<{ email: string; name: string; status: UserStatus }>('auth/verify-email', { method: 'POST', body: { token } })
  },

  /** Corrige o e-mail antes da aprovação: o novo endereço recebe outro link de confirmação */
  changePendingEmail(email: string, password: string, newEmail: string) {
    return apiFetch<PendingVerification>('auth/change-email', { method: 'POST', body: { email: email.trim(), password, newEmail: newEmail.trim() } })
  },

  resendLoginCode() {
    return apiFetch<{ email: string; resendAfter: number }>('auth/login-resend', { method: 'POST', body: {} })
  },

  /* Dispositivos confiáveis da própria conta */
  devices() {
    return apiFetch<TrustedDevice[]>('auth/devices')
  },
  revokeDevice(id: string) {
    return apiFetch('auth/devices-revoke', { method: 'POST', body: { id } })
  },
  revokeCurrentDevice() {
    return apiFetch('auth/devices-revoke-current', { method: 'POST', body: {} })
  },
  revokeAllDevices() {
    return apiFetch<{ revoked: number }>('auth/devices-revoke-all', { method: 'POST', body: {} })
  },

  /* Administrador */
  userDevices(userId: string) {
    return apiFetch<TrustedDevice[]>(`users/${encodeURIComponent(userId)}/devices`)
  },
  revokeUserDevice(userId: string, deviceId: string) {
    return apiFetch(`users/${encodeURIComponent(userId)}/devices/${encodeURIComponent(deviceId)}/revoke`, { method: 'POST', body: {} })
  },
}
