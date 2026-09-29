import type { UserRole } from '../types/index'

export type Permission =
  | 'songs:write'
  | 'songs:delete'
  | 'repertoires:write'
  | 'events:write'
  | 'schedules:write'
  | 'rehearsals:write'
  | 'members:write'
  | 'users:manage'
  | 'admin:access'

export const PERMISSION_LABELS: Record<Permission, string> = {
  'songs:write': 'Criar e editar músicas',
  'songs:delete': 'Excluir músicas',
  'repertoires:write': 'Criar, editar e duplicar repertórios',
  'events:write': 'Criar e editar eventos',
  'schedules:write': 'Montar escalas',
  'rehearsals:write': 'Agendar ensaios',
  'members:write': 'Gerenciar integrantes',
  'users:manage': 'Alterar permissões',
  'admin:access': 'Acessar a administração',
}

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: Object.keys(PERMISSION_LABELS) as Permission[],
  leader: [
    'songs:write',
    'songs:delete',
    'repertoires:write',
    'events:write',
    'schedules:write',
    'rehearsals:write',
    'members:write',
  ],
  member: [],
}

export function hasPermission(role: UserRole | undefined | null, permission: Permission): boolean {
  if (!role) return false
  return ROLE_PERMISSIONS[role].includes(permission)
}
