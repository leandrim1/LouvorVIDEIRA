/**
 * Ciclo de vida das contas:
 *
 *   Cadastro → e-mail de confirmação → link confirmado (email_verified = true)
 *            → aguardando aprovação → administrador aprova → login liberado
 *
 * Nenhuma conta entra no sistema sem confirmar o e-mail E sem aprovação do administrador
 * (exceto a primeira conta, que vira administrador ao confirmar o e-mail).
 */
import { and, count, eq, inArray, isNotNull, isNull, lt, ne, sql } from 'drizzle-orm'
import { z } from 'zod'
import type { Database } from '../db/index.js'
import { notifications, sessions, users } from '../db/schema.js'
import { hasPermission } from '../lib/permissions.js'
import {
  clearSessionCookie,
  createSession,
  createVerificationToken,
  deleteSession,
  deleteUserSessions,
  dummyPasswordCheck,
  hashPassword,
  publicUser,
  requireApproved,
  requireSession,
  sessionCookie,
  sha256,
  temporaryPassword,
  verifyPassword,
  type Session,
  type UserRow,
} from './auth.js'
import { approvalEmail, assertEmailConfigured, rejectionEmail, sendEmail, verificationEmail } from './email.js'
import { EMAIL_PROBLEM_MESSAGES, checkEmailAddress, isValidEmailFormat } from './emailValidation.js'
import { ApiError, json, noContent, readJson } from './http.js'
import { LIMITS, RESEND_COOLDOWN_SECONDS, clientIp, enforce, hit } from './rateLimit.js'

export interface AccountContext {
  request: Request
  method: string
  db: Database
  session: () => Promise<Session | null>
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const methodNotAllowed = () => new ApiError(405, 'METHOD_NOT_ALLOWED', 'Método não permitido.')

/* ------------------------------------------------------------------ */
/* Validação                                                           */
/* ------------------------------------------------------------------ */

const emailField = z
  .string()
  .trim()
  .max(254, 'E-mail muito longo.')
  .refine(isValidEmailFormat, EMAIL_PROBLEM_MESSAGES.format)
  .transform((v) => v.toLowerCase())
const password = z.string().min(8, 'A senha precisa ter pelo menos 8 caracteres.').max(200, 'Senha muito longa.')

const signupSchema = z.object({ name: z.string().trim().min(2, 'Informe seu nome.').max(120), email: emailField, password })
const loginSchema = z.object({ email: z.string().trim().toLowerCase().max(254), password: z.string().min(1, 'Informe a senha.').max(200) })
const emailOnlySchema = z.object({ email: z.string().trim().toLowerCase().max(254) })
const verifySchema = z.object({ token: z.string().min(20).max(200) })
const changeEmailSchema = z.object({ email: z.string().trim().toLowerCase().max(254), password: z.string().min(1).max(200), newEmail: emailField })
const passwordSchema = z.object({ currentPassword: z.string().max(200).default(''), newPassword: password })
const rejectSchema = z.object({ reason: z.string().trim().max(500).optional().default(''), notify: z.boolean().optional().default(false) })

/** Formato, domínio descartável e registros de e-mail do domínio */
async function assertDeliverable(email: string, field = 'email') {
  const problem = await checkEmailAddress(email)
  if (problem) throw ApiError.badRequest(EMAIL_PROBLEM_MESSAGES[problem], { [field]: [EMAIL_PROBLEM_MESSAGES[problem]] })
}

/* ------------------------------------------------------------------ */
/* Consultas                                                           */
/* ------------------------------------------------------------------ */

const byEmail = (value: string) => sql`lower(${users.email}) = ${value.toLowerCase()}`

async function findByEmail(db: Database, email: string): Promise<UserRow | undefined> {
  const [row] = await db.select().from(users).where(byEmail(email)).limit(1)
  return row
}

/** Existe um administrador com acesso? Se não, a primeira conta confirmada vira administrador. */
export async function hasActiveAdmin(db: Database) {
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.role, 'admin'), eq(users.status, 'APPROVED'), eq(users.emailVerified, true), isNotNull(users.passwordHash)))
    .limit(1)
  return Boolean(row)
}

async function approvedAdminCount(db: Database) {
  const [row] = await db
    .select({ total: count() })
    .from(users)
    .where(and(eq(users.role, 'admin'), eq(users.status, 'APPROVED')))
  return row?.total ?? 0
}

/* ------------------------------------------------------------------ */
/* E-mail de confirmação                                               */
/* ------------------------------------------------------------------ */

/**
 * Gera um novo token (o anterior deixa de valer), grava apenas o hash e envia o link.
 * O limite por endereço evita que alguém dispare dezenas de e-mails para a mesma caixa.
 */
async function issueVerification(db: Database, user: Pick<UserRow, 'id' | 'name' | 'email'>) {
  const retryAfter = await hit(db, 'verify-email:address', user.email, LIMITS.emailPerAddress)
  if (retryAfter !== null) {
    throw ApiError.tooManyRequests(retryAfter, 'Limite de e-mails de confirmação atingido para este endereço. Tente novamente mais tarde.')
  }
  const { token, hash, expiresAt } = createVerificationToken()
  await db
    .update(users)
    .set({ emailVerificationTokenHash: hash, emailVerificationExpiresAt: expiresAt, emailVerificationSentAt: new Date(), updatedAt: new Date() })
    .where(eq(users.id, user.id))
  await sendEmail(verificationEmail(user.name, user.email, token))
}

const pendingResponse = (email: string) => ({
  email,
  status: 'PENDING_EMAIL_VERIFICATION' as const,
  resendAfter: RESEND_COOLDOWN_SECONDS,
})

/* ------------------------------------------------------------------ */
/* Rotas /api/auth/*                                                   */
/* ------------------------------------------------------------------ */

export async function authRoute(ctx: AccountContext, action: string | undefined): Promise<Response> {
  const { db, request } = ctx
  const expect = (method: string) => {
    if (ctx.method !== method) throw methodNotAllowed()
  }

  switch (action) {
    case 'session': {
      expect('GET')
      const session = await ctx.session()
      return json({ user: session ? publicUser(session.user) : null, setupRequired: !(await hasActiveAdmin(db)) })
    }

    /* Cadastro: cria a solicitação e envia o e-mail. NÃO cria sessão. */
    case 'signup': {
      expect('POST')
      const input = signupSchema.parse(await readJson(request))
      await enforce(db, 'signup:ip', clientIp(request), LIMITS.signupPerIp)
      await assertDeliverable(input.email)

      const existing = await findByEmail(db, input.email)
      const abandoned =
        existing?.passwordHash &&
        existing.status === 'PENDING_EMAIL_VERIFICATION' &&
        (!existing.emailVerificationExpiresAt || existing.emailVerificationExpiresAt < new Date())
      if (existing?.passwordHash && !abandoned) {
        if (existing.status === 'PENDING_EMAIL_VERIFICATION') {
          throw new ApiError(
            409,
            'VERIFICATION_PENDING',
            'Já existe um cadastro aguardando a confirmação deste e-mail. Abra o link que enviamos ou reenvie o e-mail de confirmação.',
          )
        }
        throw new ApiError(409, 'EMAIL_ALREADY_REGISTERED', 'Este e-mail já está cadastrado. Entre com sua senha.')
      }

      const noAdmin = !(await hasActiveAdmin(db))
      const allowedAdmin = process.env.ADMIN_EMAIL?.trim().toLowerCase()
      if (noAdmin && allowedAdmin && allowedAdmin !== input.email) {
        throw ApiError.forbidden('O primeiro acesso é reservado ao administrador configurado no servidor.')
      }
      // Sem envio de e-mail configurado não há como confirmar: falha antes de gravar qualquer coisa
      assertEmailConfigured()

      const fields = {
        name: input.name,
        passwordHash: await hashPassword(input.password),
        status: 'PENDING_EMAIL_VERIFICATION' as const,
        emailVerified: false,
        emailVerifiedAt: null,
        rejectedAt: null,
        rejectedBy: null,
        rejectionReason: null,
        updatedAt: new Date(),
      }
      let user: UserRow | undefined
      let created = false
      if (existing) {
        // Convite do administrador (sem senha) ou cadastro abandonado com link vencido
        ;[user] = await db
          .update(users)
          .set({
            ...fields,
            name: existing.passwordHash ? input.name : existing.name || input.name,
            ...(noAdmin ? { role: 'admin' as const } : {}),
          })
          .where(and(eq(users.id, existing.id), existing.passwordHash ? eq(users.status, 'PENDING_EMAIL_VERIFICATION') : isNull(users.passwordHash)))
          .returning()
        if (!user) throw new ApiError(409, 'EMAIL_ALREADY_REGISTERED', 'Este e-mail já está cadastrado. Entre com sua senha.')
      } else {
        ;[user] = await db
          .insert(users)
          .values({ ...fields, email: input.email, role: noAdmin ? 'admin' : 'member' })
          .returning()
        created = true
      }
      if (!user) throw new Error('Falha ao registrar o cadastro')

      try {
        await issueVerification(db, user)
      } catch (error) {
        // Sem e-mail enviado, a solicitação nova não fica "presa" ao endereço
        if (created) await db.delete(users).where(eq(users.id, user.id))
        throw error
      }
      return json(pendingResponse(user.email), 201)
    }

    /* Link do e-mail: token de uso único, com validade de 24 horas */
    case 'verify-email': {
      expect('POST')
      await enforce(db, 'verify:ip', clientIp(request), LIMITS.verifyPerIp)
      const { token } = verifySchema.parse(await readJson(request))
      const hash = sha256(token)
      const [row] = await db.select().from(users).where(eq(users.emailVerificationTokenHash, hash)).limit(1)
      if (!row) throw new ApiError(400, 'TOKEN_INVALID', 'Este link de confirmação é inválido ou já foi utilizado.')
      if (!row.emailVerificationExpiresAt || row.emailVerificationExpiresAt < new Date()) {
        throw new ApiError(400, 'TOKEN_EXPIRED', 'Este link de confirmação expirou. Solicite um novo e-mail.')
      }

      // Primeira conta do sistema: vira administrador sem depender de outra aprovação
      const becomesAdmin = row.role === 'admin' && !(await hasActiveAdmin(db))
      const nextStatus = row.status === 'PENDING_EMAIL_VERIFICATION' ? (becomesAdmin ? 'APPROVED' : 'PENDING_ADMIN_APPROVAL') : row.status
      const [user] = await db
        .update(users)
        .set({
          emailVerified: true,
          emailVerifiedAt: new Date(),
          emailVerificationTokenHash: null,
          emailVerificationExpiresAt: null,
          status: nextStatus,
          ...(becomesAdmin && nextStatus === 'APPROVED' ? { approvedAt: new Date() } : {}),
          updatedAt: new Date(),
        })
        // Uso único: só atualiza se o token ainda for o mesmo
        .where(and(eq(users.id, row.id), eq(users.emailVerificationTokenHash, hash)))
        .returning()
      if (!user) throw new ApiError(400, 'TOKEN_INVALID', 'Este link de confirmação é inválido ou já foi utilizado.')

      if (user.status === 'PENDING_ADMIN_APPROVAL') await notifyAdmins(db, user)
      return json({ email: user.email, name: user.name, status: user.status })
    }

    /* Reenvio: resposta sempre igual, exista ou não o cadastro (não revela e-mails cadastrados) */
    case 'resend-verification': {
      expect('POST')
      const { email } = emailOnlySchema.parse(await readJson(request))
      await enforce(db, 'resend:ip', clientIp(request), LIMITS.emailPerIp)
      assertEmailConfigured()
      const user = await findByEmail(db, email)
      const waiting =
        user?.passwordHash && !user.emailVerified && (user.status === 'PENDING_EMAIL_VERIFICATION' || user.status === 'APPROVED')
      const cooledDown =
        !user?.emailVerificationSentAt || Date.now() - user.emailVerificationSentAt.getTime() >= RESEND_COOLDOWN_SECONDS * 1000
      if (user && waiting && cooledDown) {
        try {
          await issueVerification(db, user)
        } catch (error) {
          // Excesso de reenvios para o endereço: silencioso, para não revelar se ele existe
          if (!(error instanceof ApiError && error.status === 429)) throw error
        }
      }
      return json({ resendAfter: RESEND_COOLDOWN_SECONDS })
    }

    /* Corrigir o e-mail antes da aprovação (exige a senha); o novo endereço precisa ser confirmado */
    case 'change-email': {
      expect('POST')
      await enforce(db, 'change-email:ip', clientIp(request), LIMITS.changeEmailPerIp)
      const input = changeEmailSchema.parse(await readJson(request))
      const user = await findByEmail(db, input.email)
      const valid = user?.passwordHash ? await verifyPassword(input.password, user.passwordHash) : await dummyPasswordCheck(input.password).then(() => false)
      if (!user || !valid) throw ApiError.unauthorized('E-mail ou senha incorretos.')
      if (user.status !== 'PENDING_EMAIL_VERIFICATION' && user.status !== 'PENDING_ADMIN_APPROVAL') {
        throw ApiError.conflict('O e-mail só pode ser alterado aqui antes da aprovação. Fale com o administrador.')
      }
      if (input.newEmail === user.email) throw ApiError.badRequest('Informe um e-mail diferente do atual.', { newEmail: ['Use outro e-mail.'] })
      await assertDeliverable(input.newEmail, 'newEmail')
      if (await findByEmail(db, input.newEmail)) {
        throw new ApiError(409, 'EMAIL_ALREADY_REGISTERED', 'Este e-mail já está cadastrado.')
      }
      assertEmailConfigured()
      const [updated] = await db
        .update(users)
        .set({
          email: input.newEmail,
          emailVerified: false,
          emailVerifiedAt: null,
          status: 'PENDING_EMAIL_VERIFICATION',
          emailVerificationTokenHash: null,
          emailVerificationExpiresAt: null,
          emailVerificationSentAt: null,
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id))
        .returning()
      await issueVerification(db, updated!)
      return json(pendingResponse(updated!.email))
    }

    /* Login: senha correta + e-mail confirmado + conta aprovada */
    case 'login': {
      expect('POST')
      const input = loginSchema.parse(await readJson(request))
      await enforce(db, 'login:ip', clientIp(request), LIMITS.loginPerIp)
      await enforce(db, 'login:email', input.email, LIMITS.loginPerEmail, 'Muitas tentativas de login para este e-mail. Aguarde alguns minutos.')
      const user = await findByEmail(db, input.email)
      const valid = user?.passwordHash ? await verifyPassword(input.password, user.passwordHash) : await dummyPasswordCheck(input.password).then(() => false)
      if (!user || !valid) throw ApiError.unauthorized('E-mail ou senha incorretos.')

      // A situação da conta só é revelada para quem acertou a senha
      if (!user.emailVerified || user.status === 'PENDING_EMAIL_VERIFICATION') {
        throw new ApiError(403, 'EMAIL_NOT_VERIFIED', 'Confirme seu e-mail antes de entrar.')
      }
      if (user.status === 'PENDING_ADMIN_APPROVAL') {
        throw new ApiError(403, 'PENDING_APPROVAL', 'Seu e-mail foi confirmado. Sua conta está aguardando aprovação do administrador.')
      }
      if (user.status === 'REJECTED') throw new ApiError(403, 'ACCOUNT_REJECTED', 'Seu pedido de acesso não foi aprovado.')
      if (user.status === 'SUSPENDED') {
        throw new ApiError(403, 'ACCOUNT_SUSPENDED', 'Seu acesso está suspenso. Fale com o administrador da equipe.')
      }

      await db.delete(sessions).where(and(eq(sessions.userId, user.id), lt(sessions.expiresAt, new Date())))
      const token = await createSession(db, user.id, request)
      return json({ user: publicUser(user) }, 200, { 'set-cookie': sessionCookie(token, request) })
    }

    case 'logout': {
      expect('POST')
      const session = await ctx.session()
      if (session) await deleteSession(db, session.sessionId)
      return noContent({ 'set-cookie': clearSessionCookie(request) })
    }

    case 'password': {
      expect('POST')
      const session = requireSession(await ctx.session())
      const input = passwordSchema.parse(await readJson(request))
      const current = session.user.passwordHash
      if (current && !(await verifyPassword(input.currentPassword, current))) {
        throw ApiError.badRequest('Senha atual incorreta.', { currentPassword: ['Senha atual incorreta.'] })
      }
      if (input.currentPassword === input.newPassword) {
        throw ApiError.badRequest('A nova senha precisa ser diferente da atual.', { newPassword: ['Use uma senha diferente.'] })
      }
      await db.update(users).set({ passwordHash: await hashPassword(input.newPassword), updatedAt: new Date() }).where(eq(users.id, session.user.id))
      // Encerra as sessões em outros aparelhos
      await db.delete(sessions).where(and(eq(sessions.userId, session.user.id), ne(sessions.id, session.sessionId)))
      return noContent()
    }
  }
  throw ApiError.notFound('Rota não encontrada.')
}

/** Aviso no sino dos administradores quando alguém confirma o e-mail */
async function notifyAdmins(db: Database, user: UserRow) {
  const admins = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.role, 'admin'), eq(users.status, 'APPROVED')))
  if (admins.length === 0) return
  await db.insert(notifications).values(
    admins.map((admin) => ({
      userId: admin.id,
      type: 'system' as const,
      title: 'Nova solicitação de acesso',
      message: `${user.name} confirmou o e-mail e aguarda aprovação.`,
      link: '/admin',
    })),
  )
}

/* ------------------------------------------------------------------ */
/* Ações do administrador: /api/users/:id/<ação>                       */
/* ------------------------------------------------------------------ */

export const USER_ACTIONS = ['approve', 'reject', 'suspend', 'reset-password'] as const
export type UserAction = (typeof USER_ACTIONS)[number]

/** E-mails de aviso não impedem a ação do administrador se o envio falhar */
async function trySend(send: () => Promise<void>): Promise<boolean> {
  try {
    await send()
    return true
  } catch (error) {
    console.error('[email] aviso não enviado:', error instanceof Error ? error.message : error)
    return false
  }
}

export async function userAction(ctx: AccountContext, id: string, action: UserAction): Promise<Response> {
  if (ctx.method !== 'POST') throw methodNotAllowed()
  const session = requireApproved(await ctx.session())
  if (!hasPermission(session.user.role, 'users:manage')) throw ApiError.forbidden()
  if (!UUID.test(id)) throw ApiError.notFound('Usuário não encontrado.')
  const { db } = ctx
  const [target] = await db.select().from(users).where(eq(users.id, id)).limit(1)
  if (!target) throw ApiError.notFound('Usuário não encontrado.')
  const isSelf = target.id === session.user.id

  switch (action) {
    case 'approve': {
      if (!target.passwordHash) throw ApiError.conflict('Esta pessoa ainda não criou a conta com o e-mail do convite.')
      if (!target.emailVerified) throw new ApiError(409, 'EMAIL_NOT_VERIFIED', 'Este usuário ainda não confirmou o e-mail.')
      if (target.status === 'APPROVED') return json({ user: publicUser(target), emailSent: false })
      const [user] = await db
        .update(users)
        .set({
          status: 'APPROVED',
          approvedAt: new Date(),
          approvedBy: session.user.id,
          rejectedAt: null,
          rejectedBy: null,
          rejectionReason: null,
          updatedAt: new Date(),
        })
        .where(and(eq(users.id, id), eq(users.emailVerified, true), inArray(users.status, ['PENDING_ADMIN_APPROVAL', 'REJECTED', 'SUSPENDED'])))
        .returning()
      if (!user) throw ApiError.conflict('A situação desta conta mudou. Atualize a página.')
      const emailSent = target.status === 'SUSPENDED' ? false : await trySend(() => sendEmail(approvalEmail(user.name, user.email)))
      return json({ user: publicUser(user), emailSent })
    }

    case 'reject': {
      const input = rejectSchema.parse(await readJson(ctx.request))
      if (isSelf) throw ApiError.forbidden('Você não pode recusar o próprio acesso.')
      if (target.status !== 'PENDING_EMAIL_VERIFICATION' && target.status !== 'PENDING_ADMIN_APPROVAL') {
        throw ApiError.conflict('Só solicitações pendentes podem ser recusadas. Para contas aprovadas, use "Suspender acesso".')
      }
      const [user] = await db
        .update(users)
        .set({
          status: 'REJECTED',
          rejectedAt: new Date(),
          rejectedBy: session.user.id,
          rejectionReason: input.reason || null,
          emailVerificationTokenHash: null,
          emailVerificationExpiresAt: null,
          updatedAt: new Date(),
        })
        .where(eq(users.id, id))
        .returning()
      await deleteUserSessions(db, id)
      // Só avisa endereços confirmados (nunca envia e-mail para quem não comprovou ser dono do endereço)
      const emailSent =
        input.notify && user!.emailVerified ? await trySend(() => sendEmail(rejectionEmail(user!.name, user!.email, user!.rejectionReason))) : false
      return json({ user: publicUser(user!), emailSent })
    }

    case 'suspend': {
      if (isSelf) throw ApiError.forbidden('Você não pode suspender o próprio acesso.')
      if (target.status !== 'APPROVED') throw ApiError.conflict('Só contas aprovadas podem ser suspensas.')
      if (target.role === 'admin' && (await approvedAdminCount(db)) <= 1) {
        throw ApiError.conflict('É necessário manter pelo menos um administrador com acesso.')
      }
      const [user] = await db.update(users).set({ status: 'SUSPENDED', updatedAt: new Date() }).where(eq(users.id, id)).returning()
      await deleteUserSessions(db, id)
      return json({ user: publicUser(user!), emailSent: false })
    }

    case 'reset-password': {
      // Senha temporária só para quem já comprovou ser dono do e-mail
      if (!target.emailVerified) throw new ApiError(409, 'EMAIL_NOT_VERIFIED', 'Este usuário ainda não confirmou o e-mail.')
      const newPassword = temporaryPassword(10)
      const [user] = await db.update(users).set({ passwordHash: await hashPassword(newPassword), updatedAt: new Date() }).where(eq(users.id, id)).returning()
      if (!isSelf) await deleteUserSessions(db, id)
      return json({ user: publicUser(user!), temporaryPassword: newPassword })
    }
  }
}

/**
 * Troca de e-mail feita pelo administrador (PATCH /api/users/:id): o novo endereço
 * volta a exigir confirmação e as sessões abertas são encerradas.
 */
export async function afterEmailChange(db: Database, user: UserRow) {
  await deleteUserSessions(db, user.id)
  if (!user.passwordHash) return
  await trySend(() => issueVerification(db, user))
}
