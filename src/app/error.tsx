'use client'

import React from 'react'
import { AlertCircle, RefreshCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'

// Route-level error boundary — catches errors that SectionErrorBoundary misses
// (e.g. errors in AppContent itself, layout issues, etc.)
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  React.useEffect(() => {
    console.error('[Route Error]', error?.name, error?.message, error?.stack)
  }, [error])

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-red-100 dark:bg-red-950/30 mx-auto">
          <AlertCircle className="size-8 text-red-500" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-foreground">Something went wrong</h2>
          <p className="text-sm text-muted-foreground">{error?.message || 'An unexpected error occurred.'}</p>
          {(error?.stack || '').split('\n').filter(l => l.includes('src/')).slice(0, 3).length > 0 && (
            <pre className="text-[10px] text-slate-400 dark:text-slate-500 text-left overflow-x-auto mt-2 whitespace-pre-wrap max-h-24">
              {(error?.stack || '').split('\n').filter(l => l.includes('src/')).slice(0, 3).join('\n')}
            </pre>
          )}
        </div>
        <Button onClick={reset} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
          <RefreshCcw className="size-4" />
          Try Again
        </Button>
      </div>
    </div>
  )
}