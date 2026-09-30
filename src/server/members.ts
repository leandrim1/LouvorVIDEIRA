/**
 * Integrante da equipe ligado à conta. Toda conta aprovada passa a fazer parte da Equipe:
 * usa o integrante já cadastrado com o mesmo e-mail ou, sem e-mail igual, com o mesmo nome
 * (desde que nenhuma outra conta o use); se não houver, cria um novo.
 */
import { and, eq, isNull, or, sql } from 'drizzle-orm'
import type { Database } from '../db/index.js'
import { members, users } from '../db/schema.js'

type User = typeof users.$inferSelect

export async function ensureMember(db: Database, user: User): Promise<User> {
  if (user.memberId || user.status !== 'APPROVED') return user
  const email = user.email.trim().toLowerCase()
  const name = user.name.trim().toLowerCase()
  const [existing] = await db
    .select({ id: members.id })
    .from(members)
    .leftJoin(users, eq(users.memberId, members.id))
    .where(and(or(sql`lower(${members.email}) = ${email}`, sql`lower(trim(${members.name})) = ${name}`), isNull(users.id)))
    // E-mail igual tem prioridade sobre nome igual
    .orderBy(sql`lower(${members.email}) = ${email} desc`)
    .limit(1)
  const memberId =
    existing?.id ??
    (await db.insert(members).values({ name: user.name, email: user.email }).returning({ id: members.id }))[0]!.id
  const [linked] = await db
    .update(users)
    .set({ memberId, updatedAt: new Date() })
    // Só liga se ninguém tiver ligado a conta a outro integrante enquanto isso
    .where(and(eq(users.id, user.id), isNull(users.memberId)))
    .returning()
  return linked ?? user
}
