/**
 * Modelo de domínio usado pelo frontend.
 * As entidades são DERIVADAS do schema do banco (src/db/schema.ts): uma única fonte de verdade.
 * Na API, datas trafegam como string: `date` = YYYY-MM-DD, `time` = HH:mm, timestamps = ISO completo.
 */
import type * as schema from '../db/schema'

export type ID = string

/** Converte o tipo do Drizzle para o formato JSON recebido da API (Date → string ISO) */
type Serialized<T> = { [K in keyof T]: T[K] extends Date ? string : T[K] extends Date | null ? string | null : T[K] }
type Row<T extends { $inferSelect: object }> = Serialized<T['$inferSelect']>

/* ------------------------------------------------------------------ */
/* Enums                                                               */
/* ------------------------------------------------------------------ */

export type UserRole = (typeof schema.userRole.enumValues)[number]
export type UserStatus = (typeof schema.userStatus.enumValues)[number]
export type MemberRole = (typeof schema.memberRole.enumValues)[number]
export type VoiceType = (typeof schema.voiceType.enumValues)[number]
export type EventType = (typeof schema.eventType.enumValues)[number]
export type RepertoireStatus = (typeof schema.repertoireStatus.enumValues)[number]
export type PreparationStatus = (typeof schema.preparationStatus.enumValues)[number]
export type SongVideoType = (typeof schema.songVideoType.enumValues)[number]
export type SongLinkType = (typeof schema.songLinkType.enumValues)[number]
export type NotificationType = (typeof schema.notificationType.enumValues)[number]
export type FileKind = (typeof schema.fileKind.enumValues)[number]

/* ------------------------------------------------------------------ */
/* Entidades (linhas das tabelas)                                      */
/* ------------------------------------------------------------------ */

/** Usuário como a API expõe: sem hashes de senha e de token, com campos calculados */
export type User = Serialized<
  Omit<typeof schema.users.$inferSelect, 'passwordHash' | 'emailVerificationTokenHash' | 'emailVerificationExpiresAt' | 'emailVerificationSentAt'>
> & {
  /** `false` = convite criado pelo administrador, a pessoa ainda não criou a senha */
  registered: boolean
  /** Conta liberada: e-mail confirmado e status APPROVED */
  approved: boolean
}
export type Member = Row<typeof schema.members>
export type Song = Row<typeof schema.songs>
export type SongVideo = Row<typeof schema.songVideos>
export type SongLink = Row<typeof schema.songLinks>
export type SongNote = Row<typeof schema.songNotes>
export type Favorite = Row<typeof schema.favorites>
export type SongView = Row<typeof schema.songViews>
export type ChurchEvent = Row<typeof schema.events>
export type Repertoire = Row<typeof schema.repertoires>
export type RepertoireSong = Row<typeof schema.repertoireSongs>
export type Schedule = Row<typeof schema.schedules>
export type ScheduleMember = Row<typeof schema.scheduleMembers>
export type Rehearsal = Row<typeof schema.rehearsals>
export type SongPreparation = Row<typeof schema.songPreparations>
type NotificationRow = Row<typeof schema.notifications>
/** Notificação da central; os campos de origem (evento, entidade, envio) vêm do servidor */
export type AppNotification = Omit<NotificationRow, 'dedupeKey' | 'event' | 'entityType' | 'entityId' | 'metadata' | 'sentAt'> &
  Partial<Pick<NotificationRow, 'event' | 'entityType' | 'entityId' | 'metadata' | 'sentAt'>>
export type StoredFile = Row<typeof schema.files>

export type PreparationChecklist = Pick<SongPreparation, 'videoWatched' | 'chordsStudied' | 'keyConfirmed' | 'rehearsed'>

/* ------------------------------------------------------------------ */
/* Agregados (view models montados pelos services)                     */
/* ------------------------------------------------------------------ */

export interface SongWithRelations extends Song {
  videos: SongVideo[]
  links: SongLink[]
}

export interface RepertoireSongDetail extends RepertoireSong {
  song: Song
  leadVocal: Member | null
  videos: SongVideo[]
  preparation: SongPreparation | null
}

export interface ScheduleMemberDetail extends ScheduleMember {
  member: Member
}

export interface ScheduleDetail extends Schedule {
  event: ChurchEvent
  members: ScheduleMemberDetail[]
}

export interface RepertoireSummary extends Repertoire {
  event: ChurchEvent
  songCount: number
  songTitles: string[]
}

export interface RepertoireDetail extends Repertoire {
  event: ChurchEvent
  songs: RepertoireSongDetail[]
  schedule: ScheduleDetail | null
  rehearsals: RehearsalDetail[]
}

export interface RehearsalDetail extends Rehearsal {
  event: ChurchEvent
  repertoire: RepertoireSummary | null
}

export interface EventDetail extends ChurchEvent {
  repertoire: RepertoireSummary | null
  schedule: ScheduleDetail | null
  rehearsal: Rehearsal | null
}

export interface SongUsage {
  songId: ID
  count: number
  lastUsed: string | null
  nextUse: string | null
  repertoires: Array<{ id: ID; name: string; date: string }>
}

/* ------------------------------------------------------------------ */
/* Inputs de formulários                                               */
/* ------------------------------------------------------------------ */

export interface SongVideoInput {
  id?: ID
  type: SongVideoType
  title: string
  url: string
}

export interface SongLinkInput {
  id?: ID
  type: SongLinkType
  label: string
  url: string
}

export type SongInput = Omit<Song, 'id' | 'createdAt' | 'updatedAt'> & {
  videos: SongVideoInput[]
  links: SongLinkInput[]
}

export interface RepertoireSongInput {
  songId: ID
  key: string
  leadVocalId: ID | null
  instrumentation: string
  notes: string
}

export interface RepertoireInput {
  name: string
  date: string
  startTime: string
  eventType: EventType
  location: string
  description: string
  notes: string
  status: RepertoireStatus
  /** Quando informado, vincula o repertório a um evento já existente */
  eventId?: ID | null
  songs: RepertoireSongInput[]
}

export type EventInput = Omit<ChurchEvent, 'id' | 'createdAt' | 'updatedAt'>

export type MemberInput = Omit<Member, 'id' | 'createdAt' | 'updatedAt'>

export interface ScheduleInput {
  eventId: ID
  notes: string
  members: Array<{ memberId: ID; role: MemberRole }>
}

export interface RehearsalInput {
  date: string
  startTime: string
  endTime: string | null
  location: string
  notes: string
  repertoireId: ID | null
  title: string
}

/* ------------------------------------------------------------------ */
/* Busca                                                               */
/* ------------------------------------------------------------------ */

export type SearchResultKind = 'song' | 'repertoire' | 'event' | 'member'

export interface SearchResult {
  kind: SearchResultKind
  id: ID
  title: string
  subtitle: string
  meta?: string
  href: string
  keyLabel?: string
}
