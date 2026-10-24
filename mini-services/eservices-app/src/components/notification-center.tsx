'use client'

import React, { useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  CheckCircle,
  XCircle,
  Info,
  AlertTriangle,
  Bell,
  Trash2,
  CheckCheck,
  FileText,
  PackageX,
  Clock,
} from 'lucide-react'
import {
  useNotificationStore,
  type Notification,
  type NotificationType,
} from '@/lib/notification-store'

/* ------------------------------------------------------------------ */
/*  Config                                                              */
/* ------------------------------------------------------------------ */

const TYPE_CONFIG: Record<
  NotificationType,
  { icon: React.ElementType; accent: string; accentBg: string; iconColor: string; dotColor: string }
> = {
  success: {
    icon: CheckCircle,
    accent: 'border-l-emerald-500',
    accentBg: 'bg-emerald-500/10',
    iconColor: 'text-emerald-500',
    dotColor: 'bg-emerald-500',
  },
  error: {
    icon: XCircle,
    accent: 'border-l-red-500',
    accentBg: 'bg-red-500/10',
    iconColor: 'text-red-500',
    dotColor: 'bg-red-500',
  },
  info: {
    icon: Info,
    accent: 'border-l-sky-500',
    accentBg: 'bg-sky-500/10',
    iconColor: 'text-sky-500',
    dotColor: 'bg-sky-500',
  },
  warning: {
    icon: AlertTriangle,
    accent: 'border-l-amber-500',
    accentBg: 'bg-amber-500/10',
    iconColor: 'text-amber-500',
    dotColor: 'bg-amber-500',
  },
}

/* ------------------------------------------------------------------ */
/*  Time formatting                                                     */
/* ------------------------------------------------------------------ */

function formatTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  if (diff < 60000) return 'Just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/* ------------------------------------------------------------------ */
/*  Alert item (system alerts like pending bills, low stock)            */
/* ------------------------------------------------------------------ */

interface AlertItem {
  id: string
  type: 'pending-bills' | 'low-stock'
  count: number
  onNavigate: () => void
  onClose: () => void
}

function AlertCard({ alert }: { alert: AlertItem }) {
  const isBills = alert.type === 'pending-bills'
  const Icon = isBills ? FileText : PackageX
  const bg = isBills ? 'bg-amber-500/10' : 'bg-red-500/10'
  const iconColor = isBills ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'
  const accent = isBills ? 'border-l-amber-500' : 'border-l-red-500'
  const label = isBills
    ? `${alert.count} bill${alert.count !== 1 ? 's' : ''} pending payment`
    : `${alert.count} item${alert.count !== 1 ? 's' : ''} low stock`
  const sub = isBills ? 'Requires your attention' : 'Stock ≤ 5 units'

  return (
    <button
      onClick={alert.onNavigate}
      className="w-full flex items-center gap-3 rounded-lg border-l-[3px] px-3 py-2.5 text-left hover:bg-muted/60 transition-colors group"
    >
      <div className={`flex size-8 shrink-0 items-center justify-center rounded-full ${bg}`}>
        <Icon className={`size-4 ${iconColor}`} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
          {label}
        </p>
        <p className="text-[11px] text-muted-foreground">{sub}</p>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); alert.onClose() }}
        className="shrink-0 p-1 rounded-md hover:bg-muted transition-colors"
      >
        <X className="size-3 text-muted-foreground" />
      </button>
    </button>
  )
}

/* ------------------------------------------------------------------ */
/*  Notification card (in-panel)                                        */
/* ------------------------------------------------------------------ */

function NotificationCard({
  notification,
  onDismiss,
  onMarkRead,
}: {
  notification: Notification
  onDismiss: (id: string) => void
  onMarkRead: (id: string) => void
}) {
  const { id, type, title, message, createdAt, read } = notification
  const config = TYPE_CONFIG[type]
  const Icon = config.icon

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 60, transition: { duration: 0.2 } }}
      className={`
        relative rounded-lg border-l-[3px] ${config.accent}
        ${!read ? config.accentBg : 'bg-muted/20'}
        border border-white/10 dark:border-white/5
        hover:bg-muted/40 transition-colors
      `}
      onClick={() => { if (!read) onMarkRead(id) }}
    >
      <div className="flex items-start gap-3 p-3">
        {/* Unread dot */}
        {!read && (
          <span className={`absolute top-3 right-3 size-2 rounded-full ${config.dotColor} animate-pulse`} />
        )}

        {/* Icon */}
        <div className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${config.accentBg}`}>
          <Icon className={`size-4 ${config.iconColor}`} strokeWidth={2} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h4 className={`text-sm leading-tight ${!read ? 'font-semibold text-foreground' : 'font-medium text-foreground/80'}`}>
            {title}
          </h4>
          <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed line-clamp-2">
            {message}
          </p>
          <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground/60">
            <Clock className="size-2.5" />
            {formatTime(createdAt)}
          </div>
        </div>

        {/* Dismiss */}
        <button
          onClick={(e) => { e.stopPropagation(); onDismiss(id) }}
          className="shrink-0 flex size-6 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          aria-label="Dismiss"
        >
          <X className="size-3" strokeWidth={2.5} />
        </button>
      </div>
    </motion.div>
  )
}

/* ------------------------------------------------------------------ */
/*  Notification Center Panel                                           */
/* ------------------------------------------------------------------ */

interface NotificationCenterProps {
  open: boolean
  onClose: () => void
  pendingBills: number
  lowStockCount: number
  onNavigate: (page: string) => void
}

export default function NotificationCenter({
  open,
  onClose,
  pendingBills,
  lowStockCount,
  onNavigate,
}: NotificationCenterProps) {
  const notifications = useNotificationStore((s) => s.notifications)
  const unreadCount = useNotificationStore((s) => s.unreadCount)
  const removeNotification = useNotificationStore((s) => s.removeNotification)
  const markAsRead = useNotificationStore((s) => s.markAsRead)
  const markAllAsRead = useNotificationStore((s) => s.markAllAsRead)
  const clearAll = useNotificationStore((s) => s.clearAll)

  const handleDismiss = useCallback(
    (id: string) => {
      removeNotification(id)
    },
    [removeNotification]
  )

  const handleMarkRead = useCallback(
    (id: string) => {
      markAsRead(id)
    },
    [markAsRead]
  )

  const totalAlerts = pendingBills + lowStockCount
  const hasContent = totalAlerts > 0 || notifications.length > 0

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-[60] bg-black/20 backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <div
        className={`
          fixed top-0 right-0 z-[70] h-full w-full sm:w-[400px]
          bg-background border-l shadow-2xl
          transform transition-transform duration-300 ease-out
          ${open ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <Bell className="size-5 text-emerald-500" />
              <h2 className="text-base font-bold text-foreground">Notifications</h2>
              {unreadCount > 0 && (
                <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-emerald-500 text-white text-[10px] font-bold">
                  {unreadCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {notifications.length > 0 && (
                <>
                  <button
                    onClick={markAllAsRead}
                    className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                    title="Mark all read"
                  >
                    <CheckCheck className="size-4 text-muted-foreground" />
                  </button>
                  <button
                    onClick={clearAll}
                    className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                    title="Clear all"
                  >
                    <Trash2 className="size-4 text-muted-foreground hover:text-red-500" />
                  </button>
                </>
              )}
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-muted transition-colors ml-1"
              >
                <X className="size-4 text-muted-foreground" />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto h-[calc(100%-60px)] p-3 space-y-2">
          {/* System Alerts */}
          {totalAlerts > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-1 mb-1">
                Alerts
              </p>
              {pendingBills > 0 && (
                <AlertCard
                  alert={{
                    id: 'pending-bills',
                    type: 'pending-bills',
                    count: pendingBills,
                    onNavigate: () => { onClose(); onNavigate('bill-history') },
                    onClose: () => {},
                  }}
                />
              )}
              {lowStockCount > 0 && (
                <AlertCard
                  alert={{
                    id: 'low-stock',
                    type: 'low-stock',
                    count: lowStockCount,
                    onNavigate: () => { onClose(); onNavigate('item-management') },
                    onClose: () => {},
                  }}
                />
              )}
              <div className="border-t my-2" />
            </div>
          )}

          {/* Notification History */}
          {notifications.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-1 mb-1">
                Recent
              </p>
              <AnimatePresence mode="popLayout">
                {notifications.map((n) => (
                  <NotificationCard
                    key={n.id}
                    notification={n}
                    onDismiss={handleDismiss}
                    onMarkRead={handleMarkRead}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}

          {/* Empty State */}
          {!hasContent && (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <div className="size-16 rounded-2xl bg-muted/30 flex items-center justify-center mb-4">
                <Bell className="size-8 opacity-30" />
              </div>
              <p className="text-sm font-medium">No notifications</p>
              <p className="text-xs text-muted-foreground/60 mt-1">You're all caught up!</p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
