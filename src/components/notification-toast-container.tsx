'use client'

import { useEffect, useState, useCallback } from 'react'
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react'
import { useNotificationStore, dismissNotification } from '@/lib/notification-store'
import type { NotificationType } from '@/lib/notification-store'

const ICON_MAP: Record<NotificationType, React.ElementType> = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
}

const COLOR_MAP: Record<NotificationType, string> = {
  success: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200',
  error: 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200',
  info: 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200',
  warning: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200',
}

const ICON_COLOR: Record<NotificationType, string> = {
  success: 'text-emerald-500',
  error: 'text-red-500',
  info: 'text-blue-500',
  warning: 'text-amber-500',
}

function ToastItem({ id, type, title, message }: { id: string; type: NotificationType; title: string; message: string }) {
  const Icon = ICON_MAP[type]

  const handleDismiss = useCallback(() => {
    dismissNotification(id)
  }, [id])

  return (
    <div
      className={`
        flex items-start gap-2.5 px-3.5 py-2.5 rounded-lg border shadow-lg
        min-w-[280px] max-w-[380px] w-full
        animate-in slide-in-from-top-2 fade-in-0 duration-200
        ${COLOR_MAP[type]}
      `}
      role="alert"
    >
      <Icon className={`size-4 shrink-0 mt-0.5 ${ICON_COLOR[type]}`} />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold">{title}</div>
        {message && (
          <div className="text-[11px] mt-0.5 opacity-80 leading-relaxed">{message}</div>
        )}
      </div>
      <button
        onClick={handleDismiss}
        className="shrink-0 p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
        aria-label="Dismiss"
      >
        <X className="size-3.5 opacity-60 hover:opacity-100" />
      </button>
    </div>
  )
}

export function NotificationToastContainer() {
  const notifications = useNotificationStore(s => s.notifications)

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none" aria-live="polite">
      {notifications.slice(0, 5).map(n => (
        <div key={n.id} className="pointer-events-auto">
          <ToastItem id={n.id} type={n.type} title={n.title} message={n.message} />
        </div>
      ))}
    </div>
  )
}
