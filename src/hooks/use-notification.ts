'use client'

import { useCallback } from 'react'
import {
  useNotificationStore,
  type NotificationType,
} from '@/lib/notification-store'

interface NotifyInput {
  type: NotificationType
  title: string
  message: string
  duration?: number
}

export function useNotification() {
  const addNotification = useNotificationStore((s) => s.addNotification)
  const removeNotification = useNotificationStore((s) => s.removeNotification)
  const clearAll = useNotificationStore((s) => s.clearAll)

  const notify = useCallback(
    (input: NotifyInput): string => {
      return addNotification({
        type: input.type,
        title: input.title,
        message: input.message,
        duration: input.duration ?? 5000,
      })
    },
    [addNotification]
  )

  const dismiss = useCallback(
    (id: string) => {
      removeNotification(id)
    },
    [removeNotification]
  )

  return { notify, dismiss, clearAll }
}
