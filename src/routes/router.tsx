import type { ComponentType } from 'react'
import { createBrowserRouter } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { RouteError } from './RouteError'

/** Carrega a página sob demanda (code splitting por rota) */
const page = (loader: () => Promise<{ default: ComponentType }>) => async () => ({ Component: (await loader()).default })

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    errorElement: <RouteError />,
    hydrateFallbackElement: null,
    children: [
      {
        errorElement: <RouteError inline />,
        children: [
          { index: true, lazy: page(() => import('@/pages/DashboardPage')) },
          { path: 'repertorios', lazy: page(() => import('@/pages/repertoires/RepertoiresPage')) },
          { path: 'repertorios/novo', lazy: page(() => import('@/pages/repertoires/RepertoireFormPage')) },
          { path: 'repertorios/:id', lazy: page(() => import('@/pages/repertoires/RepertoireDetailPage')) },
          { path: 'repertorios/:id/editar', lazy: page(() => import('@/pages/repertoires/RepertoireFormPage')) },
          { path: 'musicas', lazy: page(() => import('@/pages/songs/SongsPage')) },
          { path: 'musicas/nova', lazy: page(() => import('@/pages/songs/SongFormPage')) },
          { path: 'musicas/:id', lazy: page(() => import('@/pages/songs/SongDetailPage')) },
          { path: 'musicas/:id/editar', lazy: page(() => import('@/pages/songs/SongFormPage')) },
          { path: 'calendario', lazy: page(() => import('@/pages/CalendarPage')) },
          { path: 'escalas', lazy: page(() => import('@/pages/schedules/SchedulesPage')) },
          { path: 'escalas/nova', lazy: page(() => import('@/pages/schedules/ScheduleFormPage')) },
          { path: 'escalas/:id', lazy: page(() => import('@/pages/schedules/ScheduleDetailPage')) },
          { path: 'escalas/:id/editar', lazy: page(() => import('@/pages/schedules/ScheduleFormPage')) },
          { path: 'ensaios', lazy: page(() => import('@/pages/RehearsalsPage')) },
          { path: 'equipe', lazy: page(() => import('@/pages/TeamPage')) },
          { path: 'favoritos', lazy: page(() => import('@/pages/FavoritesPage')) },
          { path: 'notificacoes', lazy: page(() => import('@/pages/NotificationsPage')) },
          { path: 'busca', lazy: page(() => import('@/pages/SearchPage')) },
          { path: 'configuracoes', lazy: page(() => import('@/pages/SettingsPage')) },
          { path: 'admin', lazy: page(() => import('@/pages/AdminPage')) },
          { path: 'mais', lazy: page(() => import('@/pages/MorePage')) },
          { path: '*', lazy: page(() => import('@/pages/NotFoundPage')) },
        ],
      },
    ],
  },
])
