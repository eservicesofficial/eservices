'use client'

import { create } from 'zustand'

export type NotificationType = 'success' | 'error' | 'info' | 'warning'

export interface Notification {
  id: string
  type: NotificationType
  title: string
  message: string
  duration: number
  createdAt: number
  read: boolean
}

interface NotificationState {
  notifications: Notification[]
  unreadCount: number
  addNotification: (notification: Omit<Notification, 'id' | 'createdAt' | 'read'>) => string
  removeNotification: (id: string) => void
  markAsRead: (id: string) => void
  markAllAsRead: () => void
  clearAll: () => void
}

let notificationCounter = 0

function generateId(): string {
  notificationCounter += 1
  return `notif-${Date.now()}-${notificationCounter}`
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,

  addNotification: (input) => {
    const id = generateId()
    const notification: Notification = {
      ...input,
      id,
      createdAt: Date.now(),
      read: false,
    }
    set((state) => {
      const updated = [notification, ...state.notifications]
      return {
        notifications: updated,
        unreadCount: updated.filter(n => !n.read).length,
      }
    })
    return id
  },

  removeNotification: (id) => {
    set((state) => {
      const updated = state.notifications.filter((n) => n.id !== id)
      return {
        notifications: updated,
        unreadCount: updated.filter(n => !n.read).length,
      }
    })
  },

  markAsRead: (id) => {
    set((state) => {
      const updated = state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      )
      return {
        notifications: updated,
        unreadCount: updated.filter(n => !n.read).length,
      }
    })
  },

  markAllAsRead: () => {
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    }))
  },

  clearAll: () => {
    set({ notifications: [], unreadCount: 0 })
  },
}))

/** Standalone helper — can be imported anywhere (no hook required) */
export function notify(input: {
  type: NotificationType
  title: string
  message: string
  duration?: number
}): string {
  return useNotificationStore.getState().addNotification({
    type: input.type,
    title: input.title,
    message: input.message,
    duration: input.duration ?? 5000,
  })
}

/** Dismiss a single notification by id */
export function dismissNotification(id: string): void {
  useNotificationStore.getState().removeNotification(id)
}

/** Clear all notifications */
export function clearAllNotifications(): void {
  useNotificationStore.getState().clearAll()
}
