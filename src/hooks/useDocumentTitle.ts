import { useEffect } from 'react'
import { APP_NAME } from '@/lib/constants'

export function useDocumentTitle(title: string | null | undefined) {
  useEffect(() => {
    document.title = title ? `${title} · ${APP_NAME}` : `${APP_NAME} — Repertórios da equipe de louvor`
  }, [title])
}
