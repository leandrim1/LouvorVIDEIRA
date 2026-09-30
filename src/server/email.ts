/**
 * Envio de e-mails transacionais pela API do Resend (https://resend.com).
 * Variáveis (somente no servidor): RESEND_API_KEY, EMAIL_FROM e APP_URL.
 * Sem elas, o envio falha com uma mensagem clara do que configurar; nada é simulado.
 */
import { ApiError } from './http.js'

export interface EmailMessage {
  to: string
  subject: string
  html: string
  text: string
}

export type EmailTransport = (message: EmailMessage & { from: string }) => Promise<void>

export class EmailNotConfiguredError extends ApiError {
  constructor(missing: string[]) {
    super(503, 'EMAIL_NOT_CONFIGURED', `Envio de e-mails não configurado no servidor. Defina: ${missing.join(', ')}.`)
    this.name = 'EmailNotConfiguredError'
  }
}

const RESEND_URL = () => `${(process.env.RESEND_API_URL || 'https://api.resend.com').replace(/\/$/, '')}/emails`

/** Transporte real: API HTTP do Resend */
const sendFailed = () => new ApiError(502, 'EMAIL_SEND_FAILED', 'Não foi possível enviar o e-mail agora. Tente novamente em instantes.')

const resendTransport: EmailTransport = async (message) => {
  let response: Response
  try {
    response = await fetch(RESEND_URL(), {
      method: 'POST',
      headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from: message.from, to: [message.to], subject: message.subject, html: message.html, text: message.text }),
      signal: AbortSignal.timeout(10_000),
    })
  } catch (error) {
    console.error('[email] falha de conexão com o Resend:', error instanceof Error ? error.message : error)
    throw sendFailed()
  }
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    // O detalhe fica só no log do servidor; o usuário recebe uma mensagem genérica
    console.error(`[email] Resend respondeu ${response.status}: ${detail.slice(0, 300)}`)
    throw sendFailed()
  }
}

let transport: EmailTransport = resendTransport
/** Substitui o transporte (somente testes automatizados capturam as mensagens) */
export function setEmailTransport(custom: EmailTransport | null) {
  transport = custom ?? resendTransport
}

/** Endereço público do site, usado nos links dos e-mails (nunca derivado do cabeçalho Host) */
export function appUrl(): string | null {
  const configured = process.env.APP_URL?.trim()
  if (configured) return configured.replace(/\/$/, '')
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim()
  return vercel ? `https://${vercel}` : null
}

/** Confere a configuração antes de criar registros que dependem do envio */
export function assertEmailConfigured() {
  const missing: string[] = []
  if (transport === resendTransport && !process.env.RESEND_API_KEY) missing.push('RESEND_API_KEY')
  if (!process.env.EMAIL_FROM) missing.push('EMAIL_FROM')
  if (!appUrl()) missing.push('APP_URL')
  if (missing.length > 0) throw new EmailNotConfiguredError(missing)
}

export async function sendEmail(message: EmailMessage) {
  assertEmailConfigured()
  await transport({ ...message, from: process.env.EMAIL_FROM! })
}

/* ------------------------------------------------------------------ */
/* Modelos                                                             */
/* ------------------------------------------------------------------ */

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

interface LayoutOptions {
  preheader: string
  heading: string
  paragraphs: string[]
  button?: { label: string; url: string }
  footnote?: string
}

/** Layout com a identidade do Louvor Videira, compatível com os principais clientes de e-mail */
function layout({ preheader, heading, paragraphs, button, footnote }: LayoutOptions): string {
  const base = appUrl() ?? ''
  const body = paragraphs.map((p) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155">${p}</p>`).join('')
  const cta = button
    ? `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:8px 0 24px"><tr><td style="border-radius:12px;background:#2f5fb3">
         <a href="${escapeHtml(button.url)}" style="display:inline-block;padding:14px 28px;font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:12px">${escapeHtml(button.label)}</a>
       </td></tr></table>
       <p style="margin:0 0 16px;font-size:13px;line-height:1.5;color:#64748b">Se o botão não funcionar, copie e cole este endereço no navegador:<br><a href="${escapeHtml(button.url)}" style="color:#2f5fb3;word-break:break-all">${escapeHtml(button.url)}</a></p>`
    : ''
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(heading)}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(preheader)}</span>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:32px 16px"><tr><td align="center">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #e2e8f0">
    <tr><td style="background:linear-gradient(135deg,#3f9a5b,#2f5fb3 60%,#4338ca);background-color:#2f5fb3;padding:28px 32px">
      <table role="presentation" cellspacing="0" cellpadding="0"><tr>
        ${base ? `<td style="padding-right:12px"><img src="${escapeHtml(base)}/icon-192.png" width="40" height="40" alt="" style="display:block;border-radius:10px"></td>` : ''}
        <td style="font-size:20px;font-weight:800;color:#ffffff">Louvor Videira</td>
      </tr></table>
    </td></tr>
    <tr><td style="padding:32px">
      <h1 style="margin:0 0 20px;font-size:22px;line-height:1.3;color:#0f172a">${escapeHtml(heading)}</h1>
      ${body}${cta}
      ${footnote ? `<p style="margin:24px 0 0;padding-top:16px;border-top:1px solid #e2e8f0;font-size:13px;line-height:1.5;color:#64748b">${footnote}</p>` : ''}
    </td></tr>
  </table>
  <p style="margin:16px 0 0;font-size:12px;color:#94a3b8">Equipe de louvor · Igreja Videira</p>
</td></tr></table></body></html>`
}

export function verificationEmail(name: string, to: string, token: string): EmailMessage {
  const url = `${appUrl()}/verify-email?token=${encodeURIComponent(token)}`
  const first = escapeHtml(name.split(' ')[0] || name)
  return {
    to,
    subject: 'Confirme seu e-mail — Louvor Videira',
    html: layout({
      preheader: 'Confirme seu endereço de e-mail para continuar o cadastro.',
      heading: 'Confirme seu e-mail',
      paragraphs: [`Olá, ${first}.`, 'Recebemos uma solicitação para criar uma conta no Louvor Videira.', 'Clique no botão abaixo para confirmar seu endereço de e-mail:'],
      button: { label: 'Confirmar meu e-mail', url },
      footnote: 'Este link expira em 24 horas. Se você não solicitou esta conta, ignore este e-mail.',
    }),
    text: `Olá, ${name}.\n\nRecebemos uma solicitação para criar uma conta no Louvor Videira.\n\nConfirme seu endereço de e-mail abrindo o link abaixo:\n${url}\n\nEste link expira em 24 horas.\n\nSe você não solicitou esta conta, ignore este e-mail.`,
  }
}

export function approvalEmail(name: string, to: string): EmailMessage {
  const url = `${appUrl()}/`
  const first = escapeHtml(name.split(' ')[0] || name)
  return {
    to,
    subject: 'Seu acesso foi aprovado — Louvor Videira',
    html: layout({
      preheader: 'Sua conta foi aprovada. Você já pode entrar.',
      heading: 'Seu acesso foi aprovado',
      paragraphs: [`Olá, ${first}.`, 'Sua conta foi aprovada pelo administrador.', 'Agora você já pode acessar o sistema.'],
      button: { label: 'Acessar sistema', url },
    }),
    text: `Olá, ${name}.\n\nSua conta foi aprovada pelo administrador.\n\nAgora você já pode acessar o sistema:\n${url}`,
  }
}

export function rejectionEmail(name: string, to: string, reason: string | null): EmailMessage {
  const first = escapeHtml(name.split(' ')[0] || name)
  const paragraphs = [`Olá, ${first}.`, 'Sua solicitação de acesso ao Louvor Videira não foi aprovada.']
  if (reason) paragraphs.push(`<strong>Motivo:</strong> ${escapeHtml(reason)}`)
  paragraphs.push('Se acredita que houve um engano, fale com a liderança da equipe de louvor.')
  return {
    to,
    subject: 'Sua solicitação de acesso — Louvor Videira',
    html: layout({ preheader: 'Sua solicitação de acesso não foi aprovada.', heading: 'Solicitação não aprovada', paragraphs }),
    text: `Olá, ${name}.\n\nSua solicitação de acesso ao Louvor Videira não foi aprovada.${reason ? `\n\nMotivo: ${reason}` : ''}\n\nSe acredita que houve um engano, fale com a liderança da equipe de louvor.`,
  }
}
