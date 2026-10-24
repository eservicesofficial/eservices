'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Download, X, Smartphone, Monitor, CheckCircle2, Share, Plus, MoreHorizontal, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const [isInstalled, setIsInstalled] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(display-mode: standalone)').matches
  })
  const [platform, setPlatform] = useState<'mobile' | 'desktop'>(() => {
    if (typeof window === 'undefined') return 'desktop'
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ? 'mobile' : 'desktop'
  })

  useEffect(() => {
    if (isInstalled) return

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)

      const dismissed = localStorage.getItem('pwa_prompt_dismissed')
      if (!dismissed) {
        setTimeout(() => setShowPrompt(true), 3000)
      }
    }

    window.addEventListener('beforeinstallprompt', handler)

    window.addEventListener('appinstalled', () => {
      setIsInstalled(true)
      setShowPrompt(false)
      setDeferredPrompt(null)
    })

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
    }
  }, [isInstalled])

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return

    try {
      await deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') {
        setIsInstalled(true)
      }
    } catch {
      // Fallback: show manual instructions
    }
    setDeferredPrompt(null)
    setShowPrompt(false)
  }, [deferredPrompt])

  const handleDismiss = useCallback(() => {
    setShowPrompt(false)
    localStorage.setItem('pwa_prompt_dismissed', 'true')
  }, [])

  if (isInstalled || !showPrompt) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-96 z-50 animate-in slide-in-from-bottom-4 duration-500">
      <Card className="shadow-2xl border-green-200 dark:border-green-800 bg-white/95 dark:bg-gray-900/95 backdrop-blur-lg">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 text-white shrink-0">
              {platform === 'mobile' ? (
                <Smartphone className="size-5" />
              ) : (
                <Monitor className="size-5" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-foreground">Install Eservices</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  className="size-6 p-0 text-muted-foreground hover:text-foreground"
                  onClick={handleDismiss}
                >
                  <X className="size-3.5" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Install this app on your {platform === 'mobile' ? 'phone' : 'device'} for quick access, offline support, and a native app experience.
              </p>
              <div className="flex items-center gap-2 mt-3">
                <Button
                  size="sm"
                  onClick={handleInstall}
                  className="gap-1.5 bg-green-600 hover:bg-green-700 text-white text-xs h-8"
                >
                  <Download className="size-3.5" />
                  Install App
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDismiss}
                  className="text-xs text-muted-foreground h-8"
                >
                  Not now
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export function PWAInstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(display-mode: standalone)').matches
  })
  const [showInstructions, setShowInstructions] = useState(false)
  const [platform, setPlatform] = useState<'android' | 'ios' | 'desktop'>(() => {
    if (typeof window === 'undefined') return 'desktop'
    const ua = navigator.userAgent
    if (/iPhone|iPad|iPod/i.test(ua)) return 'ios'
    if (/Android/i.test(ua)) return 'android'
    return 'desktop'
  })
  const [promptAvailable, setPromptAvailable] = useState(false)

  useEffect(() => {
    if (isInstalled) return

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setPromptAvailable(true)
    }

    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true)
      setDeferredPrompt(null)
      setPromptAvailable(false)
    })

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
    }
  }, [isInstalled])

  const handleInstall = useCallback(async () => {
    // If native prompt is available, use it
    if (deferredPrompt) {
      await deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') {
        setIsInstalled(true)
      }
      setDeferredPrompt(null)
      setPromptAvailable(false)
      return
    }
    // Otherwise, show manual instructions
    setShowInstructions(true)
  }, [deferredPrompt])

  if (isInstalled) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
        <CheckCircle2 className="size-3.5" />
        <span>App Installed</span>
      </div>
    )
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={handleInstall}
        className="gap-1.5 text-xs border-green-300 dark:border-green-700 text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/30"
      >
        <Download className="size-3.5" />
        Install App
      </Button>

      {/* Manual Install Instructions Dialog */}
      {showInstructions && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowInstructions(false)}>
          <div className="w-full max-w-md bg-background rounded-2xl border shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 p-5 text-white">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-white/20 shrink-0">
                  <Download className="size-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Install Eservices</h3>
                  <p className="text-xs text-green-100">Add to your device for the best experience</p>
                </div>
              </div>
            </div>

            {/* Instructions */}
            <div className="p-5 space-y-4">
              {platform === 'android' && (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-foreground">Install on Android</p>
                  <div className="space-y-2">
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                      <span className="flex size-6 items-center justify-center rounded-full bg-green-100 text-green-700 text-xs font-bold shrink-0">1</span>
                      <div>
                        <p className="text-sm text-foreground">Tap the <strong>three dots</strong> menu <MoreHorizontal className="inline size-4" /> in Chrome</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                      <span className="flex size-6 items-center justify-center rounded-full bg-green-100 text-green-700 text-xs font-bold shrink-0">2</span>
                      <div>
                        <p className="text-sm text-foreground">Tap <strong>&quot;Add to Home screen&quot;</strong> or <strong>&quot;Install app&quot;</strong></p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                      <span className="flex size-6 items-center justify-center rounded-full bg-green-100 text-green-700 text-xs font-bold shrink-0">3</span>
                      <div>
                        <p className="text-sm text-foreground">Tap <strong>&quot;Install&quot;</strong> to confirm</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {platform === 'ios' && (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-foreground">Install on iPhone/iPad</p>
                  <div className="space-y-2">
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                      <span className="flex size-6 items-center justify-center rounded-full bg-green-100 text-green-700 text-xs font-bold shrink-0">1</span>
                      <div>
                        <p className="text-sm text-foreground">Tap the <strong>Share</strong> button <Share className="inline size-4" /> at the bottom</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                      <span className="flex size-6 items-center justify-center rounded-full bg-green-100 text-green-700 text-xs font-bold shrink-0">2</span>
                      <div>
                        <p className="text-sm text-foreground">Scroll down and tap <strong>&quot;Add to Home Screen&quot;</strong></p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                      <span className="flex size-6 items-center justify-center rounded-full bg-green-100 text-green-700 text-xs font-bold shrink-0">3</span>
                      <div>
                        <p className="text-sm text-foreground">Tap <strong>&quot;Add&quot;</strong> to confirm</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {platform === 'desktop' && (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-foreground">Install on Desktop</p>
                  <div className="space-y-2">
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                      <span className="flex size-6 items-center justify-center rounded-full bg-green-100 text-green-700 text-xs font-bold shrink-0">1</span>
                      <div>
                        <p className="text-sm text-foreground">Click the <strong>install icon</strong> <Plus className="inline size-4" /> in the address bar in Chrome/Edge</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                      <span className="flex size-6 items-center justify-center rounded-full bg-green-100 text-green-700 text-xs font-bold shrink-0">2</span>
                      <div>
                        <p className="text-sm text-foreground">Or click <strong>three dots menu</strong> → <strong>&quot;Install Eservices&quot;</strong></p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                      <span className="flex size-6 items-center justify-center rounded-full bg-green-100 text-green-700 text-xs font-bold shrink-0">3</span>
                      <div>
                        <p className="text-sm text-foreground">Click <strong>&quot;Install&quot;</strong> to confirm</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                <Info className="size-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  The app works offline, opens like a native app, and gets its own icon on your home screen.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t bg-muted/20">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setShowInstructions(false)}
              >
                Got it
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
