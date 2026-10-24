'use client'

import { useCallback, useRef } from 'react'

type PageId = string

interface NavigationHistoryEntry {
  page: PageId
  timestamp: number
}

export function useNavigationHistory() {
  const historyRef = useRef<NavigationHistoryEntry[]>([])
  const lastBackPressRef = useRef<number>(0)

  const push = useCallback((page: PageId) => {
    // Avoid pushing duplicates (same page navigated twice in a row)
    const current = historyRef.current[historyRef.current.length - 1]
    if (current && current.page === page) return

    historyRef.current.push({ page, timestamp: Date.now() })

    // Also push to browser history so the hardware back button triggers popstate
    if (typeof window !== 'undefined') {
      window.history.pushState(
        { page, index: historyRef.current.length - 1 },
        ''
      )
    }
  }, [])

  const pop = useCallback((): PageId | null => {
    if (historyRef.current.length <= 1) return null
    historyRef.current.pop()
    return historyRef.current[historyRef.current.length - 1]?.page || null
  }, [])

  const canGoBack = useCallback((): boolean => {
    return historyRef.current.length > 1
  }, [])

  const getCurrentPage = useCallback((): PageId | null => {
    return historyRef.current[historyRef.current.length - 1]?.page || null
  }, [])

  const clear = useCallback(() => {
    historyRef.current = []
  }, [])

  /**
   * Double-back-to-exit logic.
   *
   * Returns:
   *  - `{ action: 'navigate', previousPage }` when there is a previous page to go back to
   *  - `{ action: 'wait' }` when on the home/root screen and the user has pressed back once
   *    (show "Press back again to exit" toast)
   *  - `{ action: 'exit' }` when on the home/root screen and the user pressed back twice
   *    within 2 seconds
   */
  const handleBackPress = useCallback((): {
    action: 'navigate' | 'exit' | 'wait'
    previousPage?: PageId
  } => {
    const now = Date.now()
    const timeSinceLastPress = now - lastBackPressRef.current
    lastBackPressRef.current = now

    // If we can go back in our internal history, do that
    if (historyRef.current.length > 1) {
      historyRef.current.pop()
      const previousPage = historyRef.current[historyRef.current.length - 1]
        ?.page as PageId
      return { action: 'navigate', previousPage }
    }

    // On home screen — double back to exit
    if (timeSinceLastPress < 2000) {
      return { action: 'exit' }
    }

    return { action: 'wait' }
  }, [])

  return {
    push,
    pop,
    canGoBack,
    getCurrentPage,
    clear,
    handleBackPress,
  }
}
