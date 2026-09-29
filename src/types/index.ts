/**
 * Domain model — espelha as tabelas do banco (ver supabase/migrations).
 * Datas são strings ISO: `date` = YYYY-MM-DD, `time` = HH:mm, timestamps = ISO completo.
 */

export type ID = string

export interface Timestamps {
  createdAt: string
  updatedAt: string
}

/* ------------------------------------------------------------------ */
/* Usuários, permissões e integrantes                                  */
/* ------------------------------------------------------------------ */

export type UserRole = 'admin' | 'leader' | 'member'

export interface User extends Timestamps {
  id: ID
  /** Conta no Supabase Auth (null = convite ainda não aceito / modo demonstração) */
  authUserId: ID | null
  memberId: ID | null
  name: string
  email: string
  role: UserRole
  /** Acesso liberado pelo administrador */
  approved: boolean
}

export type MemberRole =
  | 'leader'
  | 'vocal'
  | 'backing_vocal'
  | 'acoustic_guitar'
  | 'electric_guitar'
  | 'bass'
  | 'keys'
  | 'drums'
  | 'percussion'
  | 'sound'
  | 'media'
  | 'other'

export type VoiceType = 'soprano' | 'mezzo' | 'contralto' | 'tenor' | 'baritone' | 'bass' | 'none'

export interface Member extends Timestamps {
  id: ID
  name: string
  photoUrl: string | null
  roles: MemberRole[]
  instrument: string
  voice: VoiceType
  phone: string
  email: string
  notes: string
  active: boolean
}

/* ------------------------------------------------------------------ */
/* Músicas                                                             */
/* ------------------------------------------------------------------ */

export interface Song extends Timestamps {
  id: ID
  title: string
  artist: string
  album: string
  composer: string
  originalKey: string
  teamKey: string
  bpm: number | null
  capo: number | null
  tuning: string
  timeSignature: string
  lyrics: string
  chords: string
  notes: string
  coverUrl: string | null
  tags: string[]
}

export type SongVideoType = 'official' | 'study' | 'rehearsal' | 'live' | 'other'

export interface SongVideo {
  id: ID
  songId: ID
  type: SongVideoType
  title: string
  url: string
  createdAt: string
}

export type SongLinkType = 'youtube' | 'spotify' | 'apple_music' | 'cifraclub' | 'deezer' | 'other'

export interface SongLink {
  id: ID
  songId: ID
  type: SongLinkType
  label: string
  url: string
  createdAt: string
}

export interface SongNote {
  id: ID
  songId: ID
  authorId: ID | null
  content: string
  createdAt: string
}

export interface Favorite {
  id: ID
  userId: ID
  songId: ID
  createdAt: string
}

export interface SongView {
  id: ID
  userId: ID
  songId: ID
  viewedAt: string
}

/* ------------------------------------------------------------------ */
/* Eventos, repertórios, escalas e ensaios                             */
/* ------------------------------------------------------------------ */

export type EventType =
  | 'service'
  | 'rehearsal'
  | 'special'
  | 'conference'
  | 'vigil'
  | 'communion'
  | 'other'

export interface ChurchEvent extends Timestamps {
  id: ID
  title: string
  type: EventType
  date: string
  startTime: string
  endTime: string | null
  location: string
  description: string
}

export type RepertoireStatus = 'draft' | 'published'

export interface Repertoire extends Timestamps {
  id: ID
  eventId: ID
  name: string
  description: string
  notes: string
  status: RepertoireStatus
  createdBy: ID | null
}

export interface RepertoireSong {
  id: ID
  repertoireId: ID
  songId: ID
  position: number
  key: string
  leadVocalId: ID | null
  instrumentation: string
  notes: string
}

export interface Schedule extends Timestamps {
  id: ID
  eventId: ID
  notes: string
}

export interface ScheduleMember {
  id: ID
  scheduleId: ID
  memberId: ID
  role: MemberRole
}

export interface Rehearsal extends Timestamps {
  id: ID
  eventId: ID
  repertoireId: ID | null
  notes: string
}

export type PreparationStatus = 'not_studied' | 'studying' | 'ready'

export interface PreparationChecklist {
  videoWatched: boolean
  chordsStudied: boolean
  keyConfirmed: boolean
  rehearsed: boolean
}

export interface SongPreparation extends PreparationChecklist {
  id: ID
  repertoireSongId: ID
  memberId: ID
  status: PreparationStatus
  updatedAt: string
}

/* ------------------------------------------------------------------ */
/* Notificações                                                        */
/* ------------------------------------------------------------------ */

export type NotificationType = 'repertoire' | 'key_change' | 'rehearsal' | 'schedule' | 'song' | 'system'

export interface AppNotification {
  id: ID
  /** null = notificação para toda a equipe */
  userId: ID | null
  type: NotificationType
  title: string
  message: string
  link: string | null
  readBy: ID[]
  createdAt: string
}

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
