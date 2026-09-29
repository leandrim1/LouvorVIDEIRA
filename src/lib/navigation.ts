import {
  Bell,
  CalendarDays,
  ClipboardList,
  Heart,
  LayoutDashboard,
  ListMusic,
  Music2,
  Settings,
  ShieldCheck,
  Users,
  Mic2,
  type LucideIcon,
} from 'lucide-react'
import type { Permission } from './permissions'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  permission?: Permission
  /** Considera ativo apenas na rota exata */
  end?: boolean
}

export const MAIN_NAV: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/repertorios', label: 'Repertórios', icon: ListMusic },
  { to: '/musicas', label: 'Músicas', icon: Music2 },
  { to: '/calendario', label: 'Calendário', icon: CalendarDays },
  { to: '/escalas', label: 'Escalas', icon: ClipboardList },
  { to: '/ensaios', label: 'Ensaios', icon: Mic2 },
  { to: '/equipe', label: 'Equipe', icon: Users },
  { to: '/favoritos', label: 'Favoritos', icon: Heart },
]

export const SECONDARY_NAV: NavItem[] = [
  { to: '/notificacoes', label: 'Notificações', icon: Bell },
  { to: '/configuracoes', label: 'Configurações', icon: Settings },
  { to: '/admin', label: 'Administração', icon: ShieldCheck, permission: 'admin:access' },
]

/** Bottom navigation (celular) — 4 atalhos + "Mais" */
export const MOBILE_NAV: NavItem[] = [
  { to: '/', label: 'Início', icon: LayoutDashboard, end: true },
  { to: '/repertorios', label: 'Repertórios', icon: ListMusic },
  { to: '/musicas', label: 'Músicas', icon: Music2 },
  { to: '/calendario', label: 'Calendário', icon: CalendarDays },
]

export const MORE_NAV: NavItem[] = [
  { to: '/escalas', label: 'Escalas', icon: ClipboardList },
  { to: '/ensaios', label: 'Ensaios', icon: Mic2 },
  { to: '/equipe', label: 'Equipe', icon: Users },
  { to: '/favoritos', label: 'Minhas músicas', icon: Heart },
  ...SECONDARY_NAV,
]
