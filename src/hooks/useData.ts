/**
 * Hooks de leitura por domínio. Cada hook declara as tabelas das quais depende,
 * garantindo revalidação automática após qualquer alteração.
 */
import { useSession } from '@/contexts/session'
import {
  dashboardService,
  eventService,
  favoriteService,
  historyService,
  memberService,
  noteService,
  notificationService,
  rehearsalService,
  repertoireService,
  scheduleService,
  songService,
  userService,
} from '@/services'
import { useQuery } from './useQuery'

export const useSongs = () => useQuery('songs', () => songService.listWithVideos(), ['songs', 'song_videos'])

export const useSong = (id: string | undefined) =>
  useQuery(id ? `song:${id}` : null, () => songService.getById(id!), ['songs', 'song_videos', 'song_links'])

export const useSongUsage = () =>
  useQuery('song-usage', () => songService.getUsage(), ['repertoire_songs', 'repertoires', 'events'])

export const useSongNotes = (songId: string | undefined) =>
  useQuery(songId ? `song-notes:${songId}` : null, () => noteService.listBySong(songId!), ['song_notes', 'members'])

export function useFavorites() {
  const { user } = useSession()
  return useQuery(user ? `favorites:${user.id}` : null, () => favoriteService.listSongIds(user!.id), ['favorites'])
}

export function useRecentViews() {
  const { user } = useSession()
  return useQuery(user ? `views:${user.id}` : null, () => historyService.recent(user!.id), ['song_views'])
}

export const useRepertoires = () =>
  useQuery('repertoires', () => repertoireService.listSummaries(), ['repertoires', 'events', 'repertoire_songs', 'songs'])

export function useRepertoire(id: string | undefined) {
  const { member } = useSession()
  return useQuery(
    id ? `repertoire:${id}:${member?.id ?? 'anon'}` : null,
    () => repertoireService.getDetail(id!, member?.id),
    [
      'repertoires',
      'events',
      'repertoire_songs',
      'songs',
      'song_videos',
      'members',
      'song_preparations',
      'schedules',
      'schedule_members',
      'rehearsals',
    ],
  )
}

const EVENT_TABLES = [
  'events',
  'repertoires',
  'repertoire_songs',
  'songs',
  'schedules',
  'schedule_members',
  'members',
  'rehearsals',
] as const

export const useEvents = () => useQuery('events', () => eventService.listDetails(), [...EVENT_TABLES])

export const useMembers = () => useQuery('members', () => memberService.list(), ['members'])

export const useUsers = () => useQuery('users', () => userService.list(), ['users'])

export const useSchedules = () =>
  useQuery('schedules', () => scheduleService.list(), ['schedules', 'schedule_members', 'members', 'events'])

export const useSchedule = (id: string | undefined) =>
  useQuery(id ? `schedule:${id}` : null, () => scheduleService.get(id!), ['schedules', 'schedule_members', 'members', 'events'])

export const useRehearsals = () =>
  useQuery('rehearsals', () => rehearsalService.list(), ['rehearsals', 'events', 'repertoires', 'repertoire_songs', 'songs'])

export function useNotifications() {
  const { user } = useSession()
  return useQuery(user ? `notifications:${user.id}` : null, () => notificationService.listForUser(user!.id), ['notifications'])
}

export function useDashboard() {
  const { member } = useSession()
  return useQuery(`dashboard:${member?.id ?? 'anon'}`, () => dashboardService.get(member?.id ?? null), [
    ...EVENT_TABLES,
    'song_preparations',
    'song_videos',
  ])
}
