/**
 * Validação de endereços de e-mail ANTES do envio da confirmação.
 *
 * Importante: passar por aqui NÃO significa que o e-mail é verdadeiro. A única prova de que a
 * pessoa controla o endereço é abrir o link de confirmação enviado para ele (ver auth.ts).
 * Estas etapas só evitam cadastros com endereços claramente inválidos ou descartáveis.
 */
import { resolveMx } from 'node:dns/promises'

export type EmailProblem = 'format' | 'disposable' | 'domain'

export const EMAIL_PROBLEM_MESSAGES: Record<EmailProblem, string> = {
  format: 'Informe um e-mail válido (ex.: nome@gmail.com).',
  disposable: 'E-mails temporários ou descartáveis não são aceitos. Use o seu e-mail pessoal.',
  domain: 'O domínio deste e-mail não recebe mensagens. Confira se foi digitado corretamente.',
}

/* ------------------------------------------------------------------ */
/* 1. Formato                                                          */
/* ------------------------------------------------------------------ */

const LOCAL_PART = /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/i
const DOMAIN_LABEL = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/i

/** Formato estrutural: parte local válida, domínio com pelo menos um ponto e extensão alfabética */
export function isValidEmailFormat(value: string): boolean {
  const email = value.trim()
  if (email.length > 254) return false
  const at = email.lastIndexOf('@')
  if (at <= 0 || at !== email.indexOf('@')) return false
  const local = email.slice(0, at)
  const domain = email.slice(at + 1)
  if (local.length > 64 || !LOCAL_PART.test(local)) return false
  const labels = domain.split('.')
  if (labels.length < 2 || !labels.every((label) => DOMAIN_LABEL.test(label))) return false
  return /^[a-z]{2,63}$/i.test(labels[labels.length - 1]!)
}

/* ------------------------------------------------------------------ */
/* 2. Domínios descartáveis                                            */
/* ------------------------------------------------------------------ */

/** Provedores conhecidos de e-mail temporário (domínio exato ou subdomínio) */
const DISPOSABLE_DOMAINS = new Set([
  '10minutemail.com', '10minutemail.net', '10minutemail.co.uk', '10minemail.com', '20minutemail.com', '33mail.com',
  'anonbox.net', 'burnermail.io', 'byom.de', 'deadaddress.com', 'discard.email', 'discardmail.com', 'dispostable.com',
  'dropmail.me', 'emailondeck.com', 'emailfake.com', 'emltmp.com', 'fakeinbox.com', 'fakemail.net', 'fakemailgenerator.com',
  'getairmail.com', 'getnada.com', 'nada.email', 'guerrillamail.com', 'guerrillamail.net', 'guerrillamail.org',
  'guerrillamail.biz', 'guerrillamail.de', 'guerrillamail.info', 'guerrillamailblock.com', 'grr.la', 'sharklasers.com',
  'spam4.me', 'pokemail.net', 'harakirimail.com', 'incognitomail.org', 'inboxbear.com', 'jetable.org', 'mailcatch.com',
  'maildrop.cc', 'mailinator.com', 'mailinator.net', 'mailinator2.com', 'mailnesia.com', 'mailnull.com', 'mailpoof.com',
  'mailsac.com', 'mailtemp.net', 'mintemail.com', 'moakt.com', 'mohmal.com', 'mytemp.email', 'mytrashmail.com',
  'no-spam.ws', 'nowmymail.com', 'owlymail.com', 'rootfest.net', 'spambog.com', 'spambox.us', 'spamgourmet.com',
  'spamex.com', 'spamfree24.org', 'temp-mail.org', 'temp-mail.io', 'tempail.com', 'tempinbox.com', 'tempmail.com',
  'tempmail.net', 'tempmail.dev', 'tempmailo.com', 'tempmail.plus', 'tempr.email', 'tempmailaddress.com', 'throwam.com',
  'throwawaymail.com', 'tmail.ws', 'tmpmail.net', 'tmpmail.org', 'tmpeml.com', 'trash-mail.com', 'trashmail.com',
  'trashmail.de', 'trashmail.net', 'trashmail.io', 'trbvm.com', 'wegwerfmail.de', 'yopmail.com', 'yopmail.net',
  'yopmail.fr', 'cool.fr.nf', 'jetable.fr.nf', 'mvrht.net', 'luxusmail.org', 'fexpost.com', 'fextemp.com', 'minuteinbox.com',
  'emailtemporario.com.br', 'emailtemporal.org', 'correotemporal.org', 'linshiyouxiang.net', 'mail.tm', 'mail.gw',
  'inboxkitten.com', 'mailforspam.com', 'spamdecoy.net', 'tempmailer.com', 'crazymailing.com', 'etranquil.com',
])

/** Trechos típicos de serviços descartáveis, para variações não listadas */
const DISPOSABLE_PATTERNS = [
  /(^|\.)(10|20|30)minute?s?mail/,
  /tempm(ail|ailer)/,
  /temp-?mail/,
  /guerrillamail/,
  /mailinator/,
  /throwaway/,
  /trash-?mail/,
  /yopmail/,
  /disposable/,
  /fakeinbox|fake-?mail/,
  /emailtemporario|emailtemporal|correotemporal/,
]

export function isDisposableEmailDomain(domain: string): boolean {
  const d = domain.trim().toLowerCase().replace(/\.$/, '')
  const parts = d.split('.')
  for (let i = 0; i < parts.length - 1; i++) {
    if (DISPOSABLE_DOMAINS.has(parts.slice(i).join('.'))) return true
  }
  return DISPOSABLE_PATTERNS.some((pattern) => pattern.test(d))
}

/* ------------------------------------------------------------------ */
/* 3. Domínio recebe e-mail? (registros MX, quando possível)           */
/* ------------------------------------------------------------------ */

export type MxResolver = (domain: string) => Promise<{ exchange: string; priority: number }[]>

let mxResolver: MxResolver = resolveMx
/** Troca o resolvedor de DNS (usado nos testes automatizados) */
export function setMxResolver(resolver: MxResolver | null) {
  mxResolver = resolver ?? resolveMx
}

const DNS_TIMEOUT_MS = 3000
/** Respostas definitivas de que o domínio não existe ou não tem servidor de e-mail */
const NO_MAIL_CODES = new Set(['ENOTFOUND', 'ENODATA', 'NXDOMAIN'])

/**
 * `false` somente quando o DNS confirma que o domínio não recebe e-mails
 * (inexistente, sem MX ou com "null MX"). Falhas temporárias de DNS não bloqueiam o cadastro.
 */
export async function domainAcceptsEmail(domain: string): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const records = await Promise.race([
      mxResolver(domain),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(Object.assign(new Error('timeout'), { code: 'ETIMEOUT' })), DNS_TIMEOUT_MS)
      }),
    ])
    // RFC 7505: um único MX "." significa que o domínio não aceita e-mails
    return records.some((r) => r.exchange && r.exchange !== '.')
  } catch (error) {
    const code = (error as { code?: string }).code
    return !(code && NO_MAIL_CODES.has(code))
  } finally {
    clearTimeout(timer)
  }
}

/* ------------------------------------------------------------------ */
/* Todas as etapas                                                     */
/* ------------------------------------------------------------------ */

export async function checkEmailAddress(value: string): Promise<EmailProblem | null> {
  if (!isValidEmailFormat(value)) return 'format'
  const domain = value.trim().slice(value.trim().lastIndexOf('@') + 1).toLowerCase()
  if (isDisposableEmailDomain(domain)) return 'disposable'
  if (!(await domainAcceptsEmail(domain))) return 'domain'
  return null
}
