import { useCallback } from 'react'
import { useSession } from '@/contexts/session'
import { useToast } from '@/contexts/toast'
import { favoriteService } from '@/services'
import { useFavorites } from './useData'

export function useFavoriteToggle() {
  const { user } = useSession()
  const toast = useToast()
  const { data: favoriteIds = [] } = useFavorites()

  const toggle = useCallback(
    async (songId: string, title?: string) => {
      if (!user) return
      try {
        const added = await favoriteService.toggle(user.id, songId)
        toast.success(added ? 'Adicionada aos favoritos' : 'Removida dos favoritos', title)
      } catch (err) {
        toast.error('Não foi possível atualizar os favoritos', err instanceof Error ? err.message : undefined)
      }
    },
    [user, toast],
  )

  const isFavorite = useCallback((songId: string) => favoriteIds.includes(songId), [favoriteIds])

  return { toggle, isFavorite, favoriteIds }
}
