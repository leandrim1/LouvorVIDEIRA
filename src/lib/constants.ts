import type {
  EventType,
  MemberRole,
  NotificationType,
  PreparationStatus,
  RepertoireStatus,
  SongLinkType,
  SongVideoType,
  UserRole,
  VoiceType,
} from '../types/index'

export const APP_NAME = 'Louvor Videira'

export const MEMBER_ROLE_LABELS: Record<MemberRole, string> = {
  leader: 'Líder de louvor',
  vocal: 'Vocal',
  backing_vocal: 'Backing vocal',
  acoustic_guitar: 'Violão',
  electric_guitar: 'Guitarra',
  bass: 'Baixo',
  keys: 'Teclado',
  drums: 'Bateria',
  percussion: 'Percussão',
  sound: 'Sonoplastia',
  media: 'Mídia',
  other: 'Outro',
}

/** Ordem de exibição das funções nas escalas */
export const MEMBER_ROLES: MemberRole[] = [
  'leader',
  'vocal',
  'backing_vocal',
  'acoustic_guitar',
  'electric_guitar',
  'bass',
  'keys',
  'drums',
  'percussion',
  'sound',
  'media',
  'other',
]

export const VOICE_LABELS: Record<VoiceType, string> = {
  soprano: 'Soprano',
  mezzo: 'Mezzo-soprano',
  contralto: 'Contralto',
  tenor: 'Tenor',
  baritone: 'Barítono',
  bass: 'Baixo',
  none: 'Não canta',
}

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  service: 'Culto',
  rehearsal: 'Ensaio',
  special: 'Evento especial',
  conference: 'Conferência',
  vigil: 'Vigília',
  communion: 'Ceia',
  other: 'Outro',
}

export const EVENT_TYPES: EventType[] = ['service', 'rehearsal', 'special', 'conference', 'vigil', 'communion', 'other']

/** Classes de cor por tipo de evento (ponto/indicador e badge) */
export const EVENT_TYPE_STYLES: Record<EventType, { dot: string; badge: string; bar: string }> = {
  service: {
    dot: 'bg-brand-500',
    badge: 'bg-brand-50 text-brand-700 ring-brand-600/15 dark:bg-brand-500/10 dark:text-brand-300 dark:ring-brand-400/20',
    bar: 'border-l-brand-500',
  },
  rehearsal: {
    dot: 'bg-leaf-500',
    badge: 'bg-leaf-50 text-leaf-700 ring-leaf-600/20 dark:bg-leaf-500/10 dark:text-leaf-300 dark:ring-leaf-400/20',
    bar: 'border-l-leaf-500',
  },
  special: {
    dot: 'bg-amber-500',
    badge: 'bg-amber-50 text-amber-700 ring-amber-600/15 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-400/20',
    bar: 'border-l-amber-500',
  },
  conference: {
    dot: 'bg-teal-500',
    badge: 'bg-teal-50 text-teal-700 ring-teal-600/15 dark:bg-teal-500/10 dark:text-teal-300 dark:ring-teal-400/20',
    bar: 'border-l-teal-500',
  },
  vigil: {
    dot: 'bg-grape-500',
    badge: 'bg-indigo-50 text-grape-600 ring-grape-500/20 dark:bg-grape-500/15 dark:text-grape-400 dark:ring-grape-400/25',
    bar: 'border-l-grape-500',
  },
  communion: {
    dot: 'bg-rose-500',
    badge: 'bg-rose-50 text-rose-700 ring-rose-600/15 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-400/20',
    bar: 'border-l-rose-500',
  },
  other: {
    dot: 'bg-zinc-400',
    badge: 'bg-zinc-100 text-zinc-700 ring-zinc-600/15 dark:bg-zinc-500/10 dark:text-zinc-300 dark:ring-zinc-400/20',
    bar: 'border-l-zinc-400',
  },
}

export const REPERTOIRE_STATUS_LABELS: Record<RepertoireStatus, string> = {
  draft: 'Rascunho',
  published: 'Publicado',
}

export const PREPARATION_STATUS_LABELS: Record<PreparationStatus, string> = {
  not_studied: 'Não estudada',
  studying: 'Estudando',
  ready: 'Pronta',
}

export const PREPARATION_CHECKLIST_LABELS = {
  videoWatched: 'Vídeo assistido',
  chordsStudied: 'Cifra estudada',
  keyConfirmed: 'Tom confirmado',
  rehearsed: 'Música ensaiada',
} as const

export const VIDEO_TYPE_LABELS: Record<SongVideoType, string> = {
  official: 'Vídeo oficial',
  study: 'Vídeo para estudo',
  rehearsal: 'Vídeo do ensaio',
  live: 'Ao vivo',
  other: 'Outro vídeo',
}

export const LINK_TYPE_LABELS: Record<SongLinkType, string> = {
  youtube: 'YouTube',
  spotify: 'Spotify',
  apple_music: 'Apple Music',
  cifraclub: 'Cifra Club',
  deezer: 'Deezer',
  other: 'Outro link',
}

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrador',
  leader: 'Líder',
  member: 'Integrante',
}

export const USER_ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  admin: 'Acesso total: músicas, repertórios, eventos, equipe, escalas e permissões.',
  leader: 'Gerencia músicas, repertórios, eventos, escalas e ensaios.',
  member: 'Consulta repertórios, músicas e escalas; registra sua preparação.',
}

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  repertoire: 'Repertório',
  key_change: 'Tonalidade',
  rehearsal: 'Ensaio',
  schedule: 'Escala',
  song: 'Música',
  system: 'Sistema',
}

export const INSTRUMENTATION_OPTIONS = [
  'Banda completa',
  'Acústico',
  'Voz e violão',
  'Voz e teclado',
  'Teclado e pad',
  'Percussão e voz',
  'A cappella',
]

export const TUNING_OPTIONS = ['Padrão (E A D G B E)', 'Meio tom abaixo (Eb)', 'Drop D', 'Um tom abaixo (D)', 'Open G', 'DADGAD']

export const TIME_SIGNATURES = ['4/4', '3/4', '6/8', '2/4', '12/8']
