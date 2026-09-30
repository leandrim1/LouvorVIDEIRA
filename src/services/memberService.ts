import { generateId } from '@/lib/utils'
import type { Member, MemberInput, User, UserRole } from '@/types'
import { apiFetch } from './apiClient'
import { NotFoundError, db, emitChange, isServerMode } from './db'

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'pt-BR')

export const memberService = {
  async list(): Promise<Member[]> {
    const members = await db.list('members')
    return members.sort(byName)
  },

  async get(id: string): Promise<Member> {
    const member = await db.get('members', id)
    if (!member) throw new NotFoundError('Integrante')
    return member
  },

  async create(input: MemberInput): Promise<Member> {
    const now = new Date().toISOString()
    return db.insert('members', { ...input, name: input.name.trim(), id: generateId(), createdAt: now, updatedAt: now })
  },

  async update(id: string, input: MemberInput): Promise<Member> {
    const member = await db.update('members', id, { ...input, name: input.name.trim(), updatedAt: new Date().toISOString() })
    // Mantém o nome do usuário vinculado sincronizado
    const users = await db.list('users', { memberId: id })
    await Promise.all(users.map((u) => db.update('users', u.id, { name: member.name, updatedAt: member.updatedAt })))
    return member
  },

  /** Remove o integrante e desfaz os vínculos (escalas, vocais, preparação) */
  async remove(id: string): Promise<void> {
    const [items, users, notes] = await Promise.all([
      db.list('repertoire_songs', { leadVocalId: id }),
      db.list('users', { memberId: id }),
      db.list('song_notes', { authorId: id }),
    ])
    await Promise.all([
      ...items.map((i) => db.update('repertoire_songs', i.id, { leadVocalId: null })),
      ...users.map((u) => db.update('users', u.id, { memberId: null })),
      ...notes.map((n) => db.update('song_notes', n.id, { authorId: null })),
      db.removeWhere('schedule_members', { memberId: id }),
      db.removeWhere('song_preparations', { memberId: id }),
    ])
    await db.remove('members', id)
  },
}

export interface AccountActionResult {
  user: User
  /** O aviso por e-mail foi enviado (aprovação ou recusa) */
  emailSent: boolean
}

/** Ações de aprovação: no servidor, rotas próprias com todas as regras; na demonstração, atualização local */
async function accountAction(id: string, action: 'approve' | 'reject' | 'suspend', body: object, demoPatch: Partial<User>): Promise<AccountActionResult> {
  if (isServerMode) {
    const result = await apiFetch<AccountActionResult>(`users/${encodeURIComponent(id)}/${action}`, { method: 'POST', body })
    emitChange('users')
    return result
  }
  const user = await db.update('users', id, { ...demoPatch, updatedAt: new Date().toISOString() })
  return { user, emailSent: false }
}

export const userService = {
  async list(): Promise<User[]> {
    const users = await db.list('users')
    return users.sort(byName)
  },

  async get(id: string): Promise<User | null> {
    return db.get('users', id)
  },

  async updateRole(id: string, role: UserRole): Promise<User> {
    const users = await db.list('users')
    const admins = users.filter((u) => u.role === 'admin')
    const target = users.find((u) => u.id === id)
    if (target?.role === 'admin' && role !== 'admin' && admins.length <= 1) {
      throw new Error('É necessário manter pelo menos um administrador.')
    }
    return db.update('users', id, { role, updatedAt: new Date().toISOString() })
  },

  /** Cria um acesso para um integrante que ainda não possui usuário */
  async createForMember(member: Member, role: UserRole): Promise<User> {
    const now = new Date().toISOString()
    return db.insert('users', {
      id: generateId(),
      memberId: member.id,
      name: member.name,
      email: member.email.trim().toLowerCase(),
      role,
      // No servidor, estes campos são ignorados: o convite nasce aguardando a confirmação do e-mail
      status: 'APPROVED',
      emailVerified: true,
      emailVerifiedAt: now,
      approvedAt: now,
      approvedBy: null,
      rejectedAt: null,
      rejectedBy: null,
      rejectionReason: null,
      approved: true,
      registered: false,
      createdAt: now,
      updatedAt: now,
    })
  },

  /** Gera uma senha temporária (somente administradores, no servidor). A pessoa troca depois em Configurações. */
  async resetPassword(id: string): Promise<string> {
    if (!isServerMode) throw new Error('Disponível apenas com o banco de dados real.')
    const result = await apiFetch<{ temporaryPassword: string }>(`users/${encodeURIComponent(id)}/reset-password`, { method: 'POST', body: {} })
    emitChange('users')
    return result.temporaryPassword
  },

  /** Aprova uma solicitação (exige e-mail confirmado) ou reativa uma conta suspensa */
  async approve(id: string): Promise<AccountActionResult> {
    return accountAction(id, 'approve', {}, { status: 'APPROVED', approved: true, approvedAt: new Date().toISOString(), rejectedAt: null, rejectionReason: null })
  },

  /** Recusa uma solicitação pendente; o motivo e o aviso por e-mail são opcionais */
  async reject(id: string, reason: string, notify: boolean): Promise<AccountActionResult> {
    return accountAction(id, 'reject', { reason, notify }, { status: 'REJECTED', approved: false, rejectedAt: new Date().toISOString(), rejectionReason: reason || null })
  },

  /** Suspende uma conta aprovada (a pessoa é desconectada) */
  async suspend(id: string): Promise<AccountActionResult> {
    if (!isServerMode) {
      const users = await db.list('users')
      const target = users.find((u) => u.id === id)
      if (target?.role === 'admin' && users.filter((u) => u.role === 'admin' && u.approved).length <= 1) {
        throw new Error('É necessário manter pelo menos um administrador com acesso.')
      }
    }
    return accountAction(id, 'suspend', {}, { status: 'SUSPENDED', approved: false })
  },

  async linkMember(id: string, memberId: string | null): Promise<User> {
    return db.update('users', id, { memberId, updatedAt: new Date().toISOString() })
  },

  /** Remove o acesso (a pessoa perde o login; o cadastro de integrante continua) */
  async remove(id: string): Promise<void> {
    await db.removeWhere('favorites', { userId: id })
    await db.removeWhere('song_views', { userId: id })
    await db.remove('users', id)
  },
}
