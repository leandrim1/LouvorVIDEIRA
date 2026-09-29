import { generateId } from '@/lib/utils'
import type { AppNotification, NotificationType } from '@/types'
import { db } from './db'

export interface NotificationView extends AppNotification {
  read: boolean
}

export interface CreateNotificationInput {
  type: NotificationType
  title: string
  message: string
  link?: string | null
  userId?: string | null
}

export const notificationService = {
  async listForUser(userId: string): Promise<NotificationView[]> {
    const all = await db.list('notifications')
    return all
      .filter((n) => n.userId === null || n.userId === userId)
      .map((n) => ({ ...n, read: n.readBy.includes(userId) }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  },

  async create(input: CreateNotificationInput): Promise<AppNotification> {
    return db.insert('notifications', {
      id: generateId(),
      type: input.type,
      title: input.title,
      message: input.message,
      link: input.link ?? null,
      userId: input.userId ?? null,
      readBy: [],
      createdAt: new Date().toISOString(),
    })
  },

  async markRead(id: string, userId: string): Promise<void> {
    const notification = await db.get('notifications', id)
    if (!notification || notification.readBy.includes(userId)) return
    await db.update('notifications', id, { readBy: [...notification.readBy, userId] })
  },

  async markAllRead(userId: string): Promise<void> {
    const list = await this.listForUser(userId)
    await Promise.all(
      list.filter((n) => !n.read).map((n) => db.update('notifications', n.id, { readBy: [...n.readBy, userId] })),
    )
  },

  async remove(id: string): Promise<void> {
    await db.remove('notifications', id)
  },
}
