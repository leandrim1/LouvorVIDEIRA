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
}
