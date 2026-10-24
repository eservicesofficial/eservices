'use client'

import { useEffect, useState, useCallback } from 'react'
import { X, CheckCircle, XCircle, Info, AlertTriangle } from 'lucide-react'
import { useNotificationStore } from '@/lib/notification-store'
import type { NotificationType } from '@/lib/notification-store'

const TYPE_CONFIG: Record<NotificationType, { icon: React.ElementType; bg: string; border: string; iconColor: string }> = {
  success: { icon: CheckCircle, bg: 'bg-emerald-50 dark:bg-emerald-950/50', border: 'border-emerald-200 dark:border-emerald-800', iconColor: 'text-emerald-600 dark:text-emerald-400' },
  error: { icon: XCircle, bg: 'bg-red-50 dark:bg-red-950/50', border: 'border-red-200 dark:border-red-800', iconColor: 'text-red-600 dark:text-red-400' },
  info: { icon: Info, bg: 'bg-sky-50 dark:bg-sky-950/50', border: 'border-sky-200 dark:border-sky-800', iconColor: 'text-sky-600 dark:text-sky-400' },
  warning: { icon: AlertTriangle, bg: 'bg-amber-50 dark:bg-amber-950/50', border: 'border-amber-200 dark:border-amber-800', iconColor: 'text-amber-600 dark:text-amber-400' },
}

export default function NotificationToasts() {
  const { notifications, removeNotification } = useNotificationStore()
  const [exiting, setExiting] = useState<Set<string>>(new Set())

  const dismiss = useCallback((id: string) => {
    setExiting(prev => new Set(prev).add(id))
    setTimeout(() => {
      removeNotification(id)
      setExiting(prev => { const n = new Set(prev); n.delete(id); return n })
    }, 200)
  }, [removeNotification])

  // Auto-dismiss based on duration
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []
    notifications.slice(0, 3).forEach(n => {
      if (n.duration > 0 && !exiting.has(n.id)) {
        timers.push(setTimeout(() => dismiss(n.id), n.duration))
      }
    })
    return () => timers.forEach(clearTimeout)
  }, [notifications, exiting, dismiss])

  // Show max 3 most recent
  const visible = notifications.slice(0, 3)

  if (visible.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-[50] flex flex-col gap-2 w-80 max-w-[calc(100vw-2rem)] pointer-events-none">
      {visible.map(n => {
        const config = TYPE_CONFIG[n.type] || TYPE_CONFIG.info
        const Icon = config.icon
        const isExiting = exiting.has(n.id)
        return (
          <div
            key={n.id}
            className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl border shadow-lg backdrop-blur-sm transition-all duration-200 ${config.bg} ${config.border} ${
              isExiting ? 'opacity-0 translate-x-8 scale-95' : 'opacity-100 translate-x-0 scale-100 animate-in slide-in-from-right-full fade-in-0 duration-200'
            }`}
            role="alert"
          >
            <Icon className={`size-5 shrink-0 mt-0.5 ${config.iconColor}`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 leading-tight">{n.title}</p>
              {n.message && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">{n.message}</p>}
            </div>
            <button
              onClick={() => dismiss(n.id)}
              className="shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-0.5 rounded"
            >
              <X className="size-3.5" />
            </button>
          </div>
        )
      })}
    </div>
  )
}