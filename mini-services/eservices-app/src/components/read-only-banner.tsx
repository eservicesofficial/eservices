'use client'

import React from 'react'
import { Lock, Eye, ShieldOff } from 'lucide-react'

interface ReadOnlyBannerProps {
  module?: string
  message?: string
  /** When true, shows a "No Access" variant instead of "View Only" */
  noAccess?: boolean
}

export default function ReadOnlyBanner({ module, message, noAccess }: ReadOnlyBannerProps) {
  const label = noAccess
    ? module
      ? `No Access — ${module}`
      : 'No Access'
    : module
      ? `View Only — No permission to modify ${module}`
      : 'View Only Mode'

  const description = message || (noAccess
    ? 'You don\'t have access permission for this section. You can view data but cannot make any changes. Contact your administrator for access.'
    : 'You don\'t have permission to make changes in this section. Contact your administrator for access.')

  const iconBg = noAccess
    ? 'bg-red-100 dark:bg-red-900/40'
    : 'bg-amber-100 dark:bg-amber-900/40'
  const iconClass = noAccess
    ? 'text-red-600 dark:text-red-400'
    : 'text-amber-600 dark:text-amber-400'
  const containerBg = noAccess
    ? 'bg-red-50 dark:bg-red-950/20 border border-red-200/60 dark:border-red-800/40'
    : 'bg-amber-50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/40'
  const textClass = noAccess
    ? 'text-red-800 dark:text-red-300'
    : 'text-amber-800 dark:text-amber-300'
  const descClass = noAccess
    ? 'text-red-600/80 dark:text-red-400/70'
    : 'text-amber-600/80 dark:text-amber-400/70'

  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border ${containerBg} mb-4`}>
      <div className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${iconBg}`}>
        {noAccess ? (
          <ShieldOff className={`size-4 ${iconClass}`} />
        ) : (
          <Lock className={`size-4 ${iconClass}`} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold ${textClass} flex items-center gap-1.5`}>
          {noAccess ? <ShieldOff className="size-3.5" /> : <Eye className="size-3.5" />}
          {label}
        </p>
        <p className={`text-xs ${descClass} mt-0.5`}>
          {description}
        </p>
      </div>
    </div>
  )
}
