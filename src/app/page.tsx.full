'use client'

import React, { useState, useCallback, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import LoginPage from '@/components/login-page'
import { AuthProvider, useAuth } from '@/components/auth-provider'
import { SyncProvider, useSync } from '@/components/sync-provider'
import { PWAInstallPrompt } from '@/components/pwa-install-prompt'
import { registerServiceWorker } from '@/lib/pwa'
import type { UserSession } from '@/components/auth-provider'
import { useNavigationHistory } from '@/hooks/use-navigation-history'
import { useIdleTimeout } from '@/hooks/use-idle-timeout'
import { notify as notifyStandalone } from '@/lib/notification-store'
import {
  LogOut,
  Receipt,
  AlertCircle,
  RefreshCcw,
  Zap,
  Shield,
  Fingerprint,
  ShieldAlert,
  Clock,
  Ban,
} from 'lucide-react'
import {
  SidebarProvider,
  SidebarInset,
} from '@/components/ui/sidebar'

import { Button } from '@/components/ui/button'
import AppSidebar, { type PageId } from '@/components/app-sidebar'
import dynamic from 'next/dynamic'

import TopBar from '@/components/top-bar'

const DashboardSection = dynamic(() => import('@/components/sections/dashboard-section'), { ssr: false })
const BillGeneratorSection = dynamic(() => import('@/components/sections/bill-generator-section'), { ssr: false })
const BillHistorySection = dynamic(() => import('@/components/sections/bill-history-section'), { ssr: false })
const CashManagerSection = dynamic(() => import('@/components/sections/cash-manager-section'), { ssr: false })
const KhataSection = dynamic(() => import('@/components/sections/customer-folio-section'), { ssr: false })
const AttendanceSection = dynamic(() => import('@/components/sections/attendance-section'), { ssr: false })
const CalculatorSection = dynamic(() => import('@/components/sections/calculator-section'), { ssr: false })
const ItemManagementSection = dynamic(() => import('@/components/sections/item-management-section'), { ssr: false })
const TableManagementSection = dynamic(() => import('@/components/sections/table-management-section'), { ssr: false })
const ReportsSection = dynamic(() => import('@/components/sections/reports-section'), { ssr: false })
const SettingsSection = dynamic(() => import('@/components/sections/settings-section'), { ssr: false })
const SuperAdminSection = dynamic(() => import('@/components/sections/super-admin-section'), { ssr: false })

export default function Home() {
  // Register service worker for PWA
  React.useEffect(() => {
    registerServiceWorker();
  }, []);

  return (
    <AuthProvider>
      <SyncProvider>
      <AppContent />
      <PWAInstallPrompt />
      </SyncProvider>
    </AuthProvider>
  )
}

function AppContent() {
  const { isAuthenticated, currentUser, token, login, logout, isSuperAdmin } = useAuth()
  const { syncVersion } = useSync()
  const [activePage, setActivePage] = useState<PageId>('dashboard')
  const [refreshKey, setRefreshKey] = useState(0)
  const [editInvoiceData, setEditInvoiceData] = useState<any>(null)
  const [pageKey, setPageKey] = useState(0)
  const [hasError, setHasError] = useState(false)
  const [isExpired, setIsExpired] = useState(false)
  const [isSuspended, setIsSuspended] = useState(false)
  const [expiryDate, setExpiryDate] = useState<string | null>(null)
  const navHistory = useNavigationHistory()
  // Track whether navigation history has been initialized after authentication
  const navInitializedRef = useRef(false)
  // backExitToast removed — now uses notify() for consistency

  // When sync version changes (another tab/device changed data), refresh current section
  // Use useMemo to compute refreshKey from syncVersion instead of setState in effect


  // Override fetch to include auth token
  // Uses a ref for the token so we don't re-create the fetch wrapper on every token change.
  // The wrapper reads the latest token from the ref at call time.
  const fetchTokenRef = useRef(token);
  useEffect(() => { fetchTokenRef.current = token; }, [token]);

  useEffect(() => {
    if (token) {
      const originalFetch = window.fetch
      window.fetch = function(input: RequestInfo | URL, init?: RequestInit) {
        const headers = new Headers(init?.headers)
        // Use the ref to get the latest token (avoids stale closure)
        const currentToken = fetchTokenRef.current;
        if (!headers.has('Authorization') && currentToken) {
          headers.set('Authorization', `Bearer ${currentToken}`)
        }
        return originalFetch(input, { ...init, headers })
      }
      return () => {
        window.fetch = originalFetch
      }
    }
  }, [token])

  // Auto-Rotation control using screen.orientation.lock/unlock
  // Default: OFF (portrait locked). Saved in localStorage + DB for persistence.
  useEffect(() => {
    if (!isAuthenticated) return;

    const applyOrientation = async () => {
      try {
        // Check localStorage first for immediate response
        const stored = localStorage.getItem('fp_auto_rotate');
        // Default OFF (portrait locked) if not set
        const autoRotate = stored !== null ? stored === 'true' : false;

        if (autoRotate) {
          // Allow rotation
          if (screen.orientation && screen.orientation.unlock) {
            screen.orientation.unlock();
          }
        } else {
          // Lock to portrait
          if (screen.orientation && screen.orientation.lock) {
            try {
              await screen.orientation.lock('portrait');
            } catch {
              // screen.orientation.lock() may fail in some browsers/contexts
              // (e.g., not in fullscreen/standalone PWA, or not supported). That's okay.
            }
          }
        }
      } catch {
        // Ignore errors
      }
    };

    applyOrientation();

    // Listen for storage changes from other tabs/settings page
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'fp_auto_rotate') {
        applyOrientation();
      }
    };
    window.addEventListener('storage', handleStorageChange);

    // Poll for DB setting changes periodically (in case changed from another device)
    const interval = setInterval(async () => {
      try {
        const currentToken = fetchTokenRef.current;
        if (!currentToken) return;
        const res = await fetch('/api/settings', {
          headers: { 'Authorization': `Bearer ${currentToken}` },
        });
        if (res.ok) {
          const settings = await res.json();
          const dbAutoRotate = settings.autoRotate ?? false;
          const stored = localStorage.getItem('fp_auto_rotate');
          const localAutoRotate = stored !== null ? stored === 'true' : false;
          // Sync: if DB differs from localStorage, update localStorage
          if (dbAutoRotate !== localAutoRotate) {
            localStorage.setItem('fp_auto_rotate', String(dbAutoRotate));
            applyOrientation();
          }
        }
      } catch {
        // Ignore
      }
    }, 60000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, [isAuthenticated]);

  const handleLoginSuccess = useCallback((newToken: string, user: UserSession) => {
    login(newToken, user)
    // After login, clean the browser history to remove the pre-login entry
    // so the back button never returns to the login page
    if (typeof window !== 'undefined') {
      window.history.replaceState({ page: 'dashboard', index: 0 }, '')
      window.history.pushState({ page: 'dashboard', index: 0 }, '')
    }
  }, [login])

  const handleLogout = useCallback(() => {
    logout()
    setActivePage('dashboard')
    setPageKey(0)
    setEditInvoiceData(null)
    navHistory.clear()
    // Reset nav initialized flag so navigation history is re-set up on next login
    navInitializedRef.current = false
  }, [logout, navHistory])

  // Auto-logout after 10 minutes of inactivity
  const handleIdleLogout = useCallback(() => {
    handleLogout()
    notifyStandalone({ type: 'warning', title: 'Session Expired', message: 'You were logged out due to 10 minutes of inactivity.' })
  }, [handleLogout])
  const { showWarning: idleWarning, secondsLeft: idleSecondsLeft, resetIdle } = useIdleTimeout(isAuthenticated, handleIdleLogout)

  const handleNavigate = useCallback((page: PageId) => {
    setActivePage(page)
    setPageKey((prev) => prev + 1)
    navHistory.push(page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [navHistory])

  const handleEditInvoice = useCallback((invoice: any) => {
    setEditInvoiceData(invoice)
    setActivePage('new-bill')
    setPageKey((prev) => prev + 1)
    navHistory.push('new-bill')
  }, [navHistory])

  const handleClearEditInvoice = useCallback(() => {
    setEditInvoiceData(null)
  }, [])

  const handleRefreshData = useCallback(() => {
    setRefreshKey((prev) => prev + 1)
  }, [])

  // ── Back-button handling for PWA ──
  const handleBackButton = useCallback(() => {
    // 1. Close open modals / dialogs / sheets / popups first
    const anyDialogOpen =
      document.querySelector('[data-state="open"][role="dialog"]') !== null
    const anySheetOpen =
      document.querySelector(
        '[data-state="open"][role="dialog"][data-vaul-drawer]'
      ) !== null
    const sidebarExpanded =
      document.querySelector('[data-state="expanded"]') !== null

    if (anyDialogOpen || anySheetOpen) {
      // Dispatch Escape to let Radix / Vaul close their overlays
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
      )
      return
    }

    if (sidebarExpanded) {
      // Collapse the sidebar
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
      )
      return
    }

    // 2. Navigate back through our history
    const result = navHistory.handleBackPress()

    if (result.action === 'navigate' && result.previousPage) {
      setActivePage(result.previousPage as PageId)
      setPageKey((prev) => prev + 1)
    } else if (result.action === 'wait') {
      // Show "Press back again to exit" via swipeable notification
      notifyStandalone({ type: 'warning', title: 'Exit?', message: 'Press back again to exit the app', duration: 2000 })
    } else if (result.action === 'exit') {
      // Go back in browser history to let the browser handle exit
      // window.close() doesn't work in most browsers/PWAs
      window.history.back()
    }
  }, [navHistory])

  // Listen for browser/hardware back button via popstate
  useEffect(() => {
    const handlePopState = (_e: PopStateEvent) => {
      // Push state back so the browser never actually navigates away
      window.history.pushState(null, '')
      handleBackButton()
      // After handling, update the history state to match our internal state
      const currentPage = navHistory.getCurrentPage()
      if (currentPage) {
        window.history.replaceState({ page: currentPage }, '')
      }
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [handleBackButton, navHistory])

  // Push the initial page into history ONLY after authentication is confirmed
  // This prevents the pre-login history entry from remaining in the browser history stack
  useEffect(() => {
    if (!isAuthenticated || navInitializedRef.current) return
    navInitializedRef.current = true
    navHistory.push('dashboard')
    // Replace the current history entry so the very first state is ours
    // (removes the pre-login/pre-auth entry from browser history)
    window.history.replaceState({ page: 'dashboard', index: 0 }, '')
    // Also push an extra entry so the first hardware back press triggers popstate
    window.history.pushState({ page: 'dashboard', index: 0 }, '')
  }, [isAuthenticated])

  // Data version: tracks both manual refresh and sync-triggered changes
  // This is passed as a prop so components can re-fetch data WITHOUT remounting
  const dataVersion = refreshKey + (syncVersion > 0 ? syncVersion : 0)

  // Check if the client's subscription has expired or been suspended (for business users)
  // Also uses the response to keep the session in sync with the DB (rolling refresh)
  // NOTE: Uses refs for token/login so the interval doesn't restart on every token change.
  // Previously, `login(data.token, data.user)` would change the token, which re-triggered
  // this effect, which called login() again — causing a cascade of re-renders that
  // overwrote user input in Settings and other sections.
  const checkStatusTokenRef = useRef(token);
  useEffect(() => { checkStatusTokenRef.current = token; }, [token]);
  const loginRef = useRef(login);
  useEffect(() => { loginRef.current = login; }, [login]);

  useEffect(() => {
    if (!isAuthenticated || isSuperAdmin) return;
    const checkStatus = async () => {
      const currentToken = checkStatusTokenRef.current;
      if (!currentToken) return;
      try {
        const res = await fetch('/api/auth', {
          headers: { 'Authorization': `Bearer ${currentToken}` },
        });
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          if (data.valid && data.token && data.user) {
            // Rolling refresh: update session with fresh data from DB
            loginRef.current(data.token, data.user as UserSession);
          }
        } else {
          const data = await res.json().catch(() => ({}));
          if (data.expired) {
            setIsExpired(true);
            setExpiryDate(data.expiresAt || null);
          } else if (data.suspended) {
            setIsSuspended(true);
          }
        }
      } catch {
        // Network error — don't block
      }
    };
    checkStatus();
    // Check every 5 minutes
    const interval = setInterval(checkStatus, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [isAuthenticated, isSuperAdmin]);

  // Clean up browser history after auto-login to prevent back button from going to login
  useEffect(() => {
    if (isAuthenticated) {
      // Small delay to ensure React has finished rendering the app
      const timer = setTimeout(() => {
        window.history.replaceState({ page: 'dashboard', index: 0 }, '')
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [isAuthenticated])

  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />
  }

  // Super Admin gets their own panel (not affected by expiry)
  if (isSuperAdmin && token) {
    return <SuperAdminSection token={token} onLogout={handleLogout} />
  }

  // ── Suspended Account Screen ──
  if (isSuspended) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-gray-900 to-slate-950 p-4 relative overflow-hidden">
        {/* Background Effects */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-amber-500/5 blur-[120px]" />
          <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-orange-500/5 blur-[100px]" />
          <div className="absolute inset-0 opacity-[0.02]" style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: '40px 40px',
          }} />
        </div>

        <div className="relative z-10 max-w-[480px] w-full">
          {/* Notice Card */}
          <div className="relative rounded-2xl overflow-hidden shadow-2xl shadow-black/40">
            {/* Animated top border */}
            <div className="h-1 bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-500" style={{
              animation: 'shimmer 3s ease-in-out infinite',
              backgroundSize: '200% 100%',
            }} />

            <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-b-2xl">
              {/* Header Section */}
              <div className="relative px-8 pt-8 pb-6 text-center">
                {/* Pulsing ring icon */}
                <div className="relative inline-flex mb-5">
                  <div className="absolute inset-0 rounded-full bg-amber-500/20" style={{ animation: 'ping-slow 2s cubic-bezier(0, 0, 0.2, 1) infinite' }} />
                  <div className="relative flex size-20 items-center justify-center rounded-full bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 backdrop-blur-sm">
                    <Ban className="size-10 text-amber-400" />
                  </div>
                </div>

                <h1 className="text-2xl font-bold text-white tracking-tight">Account Suspended</h1>
                <p className="text-sm text-gray-400 mt-1.5">Your account has been temporarily suspended</p>
              </div>

              {/* Divider */}
              <div className="mx-8 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

              {/* Alert Banner */}
              <div className="mx-6 mt-6 p-4 rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20">
                <div className="flex items-start gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/20">
                    <AlertCircle className="size-5 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-amber-300">Your account has been suspended</p>
                    <p className="text-xs text-amber-400/70 mt-1 leading-relaxed">
                      Your administrator has temporarily suspended this account. Please contact them to restore access.
                    </p>
                  </div>
                </div>
              </div>

              {/* Account Details Card */}
              {currentUser && (
                <div className="mx-6 mt-4 rounded-xl border border-white/[0.08] overflow-hidden">
                  <div className="px-4 py-2 bg-white/[0.03] border-b border-white/[0.06]">
                    <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Account Details</span>
                  </div>
                  <div className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        <Receipt className="size-3.5" />
                        <span>Business</span>
                      </div>
                      <span className="text-sm font-semibold text-white">
                        {currentUser.unitName}
                      </span>
                    </div>
                    <div className="h-px bg-white/[0.04]" />
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        <Fingerprint className="size-3.5" />
                        <span>Client ID</span>
                      </div>
                      <span className="text-sm font-mono font-semibold text-white bg-white/[0.06] px-2 py-0.5 rounded">
                        {currentUser.unitCode}
                      </span>
                    </div>
                    <div className="h-px bg-white/[0.04]" />
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        <ShieldAlert className="size-3.5" />
                        <span>Status</span>
                      </div>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/25">
                        <span className="size-1.5 rounded-full bg-amber-400" style={{ animation: 'blink 1.5s ease-in-out infinite' }} />
                        Suspended
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Steps to Resolve */}
              <div className="mx-6 mt-4 space-y-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Steps to Resolve</p>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                  <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-[10px] font-bold text-amber-400">1</div>
                  <div>
                    <p className="text-sm text-gray-300">Contact your administrator</p>
                    <p className="text-xs text-gray-500 mt-0.5">Reach out to your system admin or IT team</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                  <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-[10px] font-bold text-amber-400">2</div>
                  <div>
                    <p className="text-sm text-gray-300">Request account reactivation</p>
                    <p className="text-xs text-gray-500 mt-0.5">Ask for your Client ID to be reactivated</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                  <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-[10px] font-bold text-emerald-400">3</div>
                  <div>
                    <p className="text-sm text-gray-300">Log back in</p>
                    <p className="text-xs text-gray-500 mt-0.5">Sign in again once your access is restored</p>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="px-6 pt-5 pb-6">
                <Button
                  onClick={handleLogout}
                  className="w-full h-12 bg-gradient-to-r from-gray-800 to-gray-900 hover:from-gray-700 hover:to-gray-800 text-white font-semibold text-sm gap-2.5 transition-all duration-300 shadow-lg shadow-black/30 hover:shadow-xl rounded-xl border border-white/[0.08]"
                >
                  <LogOut className="size-4" />
                  Sign Out
                </Button>
                <p className="text-center text-[11px] text-gray-600 mt-3">
                  If you believe this is an error, please contact support.
                </p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-center gap-4 mt-5">
            <div className="flex items-center gap-1.5 text-[11px] text-gray-600">
              <Shield className="size-3" />
              <span>256-bit Encrypted</span>
            </div>
            <div className="w-1 h-1 rounded-full bg-gray-700" />
            <div className="flex items-center gap-1.5 text-[11px] text-gray-600">
              <Zap className="size-3" />
              <span>Eservices v3.0</span>
            </div>
          </div>
        </div>

        {/* Animations */}
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes shimmer {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
          }
          @keyframes ping-slow {
            0% { transform: scale(1); opacity: 0.4; }
            75%, 100% { transform: scale(1.6); opacity: 0; }
          }
          @keyframes blink {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.3; }
          }
        ` }} />
      </div>
    )
  }

  // ── Expired Subscription Screen ──
  if (isExpired) {
    const expDate = expiryDate
      ? new Date(expiryDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
      : null;

    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-gray-900 to-slate-950 p-4 relative overflow-hidden">
        {/* Background Effects */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-red-500/5 blur-[120px]" />
          <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-amber-500/5 blur-[100px]" />
          <div className="absolute inset-0 opacity-[0.02]" style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: '40px 40px',
          }} />
        </div>

        <div className="relative z-10 max-w-[480px] w-full">
          {/* Notice Card */}
          <div className="relative rounded-2xl overflow-hidden shadow-2xl shadow-black/40">
            {/* Animated top border */}
            <div className="h-1 bg-gradient-to-r from-red-500 via-orange-500 to-amber-500" style={{
              animation: 'shimmer 3s ease-in-out infinite',
              backgroundSize: '200% 100%',
            }} />

            <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-b-2xl">
              {/* Header Section */}
              <div className="relative px-8 pt-8 pb-6 text-center">
                {/* Pulsing ring icon */}
                <div className="relative inline-flex mb-5">
                  <div className="absolute inset-0 rounded-full bg-red-500/20" style={{ animation: 'ping-slow 2s cubic-bezier(0, 0, 0.2, 1) infinite' }} />
                  <div className="relative flex size-20 items-center justify-center rounded-full bg-gradient-to-br from-red-500/20 to-orange-500/20 border border-red-500/30 backdrop-blur-sm">
                    <ShieldAlert className="size-10 text-red-400" />
                  </div>
                </div>

                <h1 className="text-2xl font-bold text-white tracking-tight">Subscription Expired</h1>
                <p className="text-sm text-gray-400 mt-1.5">Your access has been temporarily suspended</p>
              </div>

              {/* Divider */}
              <div className="mx-8 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

              {/* Alert Banner */}
              <div className="mx-6 mt-6 p-4 rounded-xl bg-gradient-to-br from-red-500/10 to-orange-500/10 border border-red-500/20">
                <div className="flex items-start gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-red-500/20">
                    <AlertCircle className="size-5 text-red-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-red-300">Your subscription has expired</p>
                    <p className="text-xs text-red-400/70 mt-1 leading-relaxed">
                      Please contact your administrator for renewal to restore full access to your account and data.
                    </p>
                  </div>
                </div>
              </div>

              {/* Account Details Card */}
              {currentUser && (
                <div className="mx-6 mt-4 rounded-xl border border-white/[0.08] overflow-hidden">
                  <div className="px-4 py-2 bg-white/[0.03] border-b border-white/[0.06]">
                    <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Account Details</span>
                  </div>
                  <div className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        <Receipt className="size-3.5" />
                        <span>Business</span>
                      </div>
                      <span className="text-sm font-semibold text-white">
                        {currentUser.unitName}
                      </span>
                    </div>
                    <div className="h-px bg-white/[0.04]" />
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        <Fingerprint className="size-3.5" />
                        <span>Client ID</span>
                      </div>
                      <span className="text-sm font-mono font-semibold text-white bg-white/[0.06] px-2 py-0.5 rounded">
                        {currentUser.unitCode}
                      </span>
                    </div>
                    {expDate && (
                      <>
                        <div className="h-px bg-white/[0.04]" />
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-sm text-gray-400">
                            <Clock className="size-3.5" />
                            <span>Expired On</span>
                          </div>
                          <span className="text-sm font-semibold text-red-400">
                            {expDate}
                          </span>
                        </div>
                      </>
                    )}
                    <div className="h-px bg-white/[0.04]" />
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        <ShieldAlert className="size-3.5" />
                        <span>Status</span>
                      </div>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-500/15 text-red-400 border border-red-500/25">
                        <span className="size-1.5 rounded-full bg-red-400" style={{ animation: 'blink 1.5s ease-in-out infinite' }} />
                        Expired
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Steps to Renew */}
              <div className="mx-6 mt-4 space-y-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Steps to Renew</p>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                  <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-[10px] font-bold text-amber-400">1</div>
                  <div>
                    <p className="text-sm text-gray-300">Contact your administrator</p>
                    <p className="text-xs text-gray-500 mt-0.5">Reach out to your system admin or IT team</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                  <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-[10px] font-bold text-amber-400">2</div>
                  <div>
                    <p className="text-sm text-gray-300">Request subscription renewal</p>
                    <p className="text-xs text-gray-500 mt-0.5">Ask for your Client ID to be reactivated</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                  <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-[10px] font-bold text-emerald-400">3</div>
                  <div>
                    <p className="text-sm text-gray-300">Log back in</p>
                    <p className="text-xs text-gray-500 mt-0.5">Sign in again once your access is restored</p>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="px-6 pt-5 pb-6">
                <Button
                  onClick={handleLogout}
                  className="w-full h-12 bg-gradient-to-r from-gray-800 to-gray-900 hover:from-gray-700 hover:to-gray-800 text-white font-semibold text-sm gap-2.5 transition-all duration-300 shadow-lg shadow-black/30 hover:shadow-xl rounded-xl border border-white/[0.08]"
                >
                  <LogOut className="size-4" />
                  Sign Out
                </Button>
                <p className="text-center text-[11px] text-gray-600 mt-3">
                  If you believe this is an error, please contact support.
                </p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-center gap-4 mt-5">
            <div className="flex items-center gap-1.5 text-[11px] text-gray-600">
              <Shield className="size-3" />
              <span>256-bit Encrypted</span>
            </div>
            <div className="w-1 h-1 rounded-full bg-gray-700" />
            <div className="flex items-center gap-1.5 text-[11px] text-gray-600">
              <Zap className="size-3" />
              <span>Eservices v3.0</span>
            </div>
          </div>
        </div>

        {/* Animations */}
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes shimmer {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
          }
          @keyframes ping-slow {
            0% { transform: scale(1); opacity: 0.4; }
            75%, 100% { transform: scale(1.6); opacity: 0; }
          }
          @keyframes blink {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.3; }
          }
        ` }} />
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-red-100 dark:bg-red-950/30 mx-auto">
            <AlertCircle className="size-8 text-red-500" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-foreground">Something went wrong</h2>
            <p className="text-sm text-muted-foreground">An unexpected error occurred. Please try refreshing the page.</p>
          </div>
          <Button onClick={() => { setHasError(false); setPageKey((prev) => prev + 1); }} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
            <RefreshCcw className="size-4" />
            Try Again
          </Button>
        </div>
      </div>
    )
  }

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard':
        return <DashboardSection key="dashboard" dataVersion={dataVersion} onNavigate={(p: string) => handleNavigate(p as PageId)} />
      case 'new-bill':
        return (
          <BillGeneratorSection
            key={`bill-gen-${pageKey}`}
            onNavigate={(p: string) => handleNavigate(p as PageId)}
            onRefreshData={handleRefreshData}
            editInvoice={editInvoiceData}
            onClearEditInvoice={handleClearEditInvoice}
          />
        )
      case 'bill-history':
        return (
          <BillHistorySection
            key="bill-history"
            dataVersion={dataVersion}
            onNavigate={(p: string) => handleNavigate(p as PageId)}
            onEditInvoice={handleEditInvoice}
            onRefreshData={handleRefreshData}
          />
        )
      case 'cash-manager':
        return <CashManagerSection key="cash-manager" dataVersion={dataVersion} onRefreshData={handleRefreshData} />
      case 'khata':
        return <KhataSection key="khata" dataVersion={dataVersion} onRefreshData={handleRefreshData} />
      case 'attendance':
        return <AttendanceSection key="attendance" dataVersion={dataVersion} onRefreshData={handleRefreshData} />
      case 'calculator':
        return <CalculatorSection key="calculator" />
      case 'item-management':
        return <ItemManagementSection key="item-management" dataVersion={dataVersion} onRefreshData={handleRefreshData} />
      case 'table-management':
        return <TableManagementSection key="table-management" dataVersion={dataVersion} />
      case 'reports':
        return <ReportsSection key="reports" dataVersion={dataVersion} />
      case 'settings':
        return <SettingsSection key="settings" dataVersion={dataVersion} />
      default:
        return <DashboardSection key="dashboard" dataVersion={dataVersion} onNavigate={(p: string) => handleNavigate(p as PageId)} />
    }
  }

  return (
    <>
    <SidebarProvider>
      <AppSidebar activePage={activePage} onNavigate={handleNavigate} />
      <SidebarInset>
        <TopBar onNavigate={handleNavigate} onLogout={handleLogout} />
        <main className="flex-1 p-4 lg:p-6 animate-fade-in-up">
          {renderPage()}
        </main>
        <footer className="mt-auto border-t bg-background px-4 lg:px-6 py-3">
          <div className="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500">
            <div className="flex items-center gap-1.5">
              <img src="/icon-192.png" alt="Eservices" className="h-3 w-3 rounded object-cover" />
              <span className="font-medium text-gray-500 dark:text-gray-400">Eservices</span>
              <span>&copy; {new Date().getFullYear()}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-emerald-500">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                Secured
              </span>
              <span className="text-gray-300 dark:text-gray-600">v3.0</span>
            </div>
          </div>
        </footer>
      </SidebarInset>
    </SidebarProvider>

    {/* ── Idle Timeout Warning Dialog ── */}
    {idleWarning && typeof document !== 'undefined' && document.body && createPortal(
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ zIndex: 9999 }}>
        {/* Backdrop */}
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md" />

        {/* Dialog */}
        <div className="relative w-full max-w-[380px] rounded-3xl bg-background border border-white/10 dark:border-white/5 shadow-[0_25px_60px_-12px_rgba(0,0,0,0.35)] animate-in fade-in-0 zoom-in-[0.97] slide-in-from-bottom-6 duration-300 overflow-hidden" style={{ zIndex: 10000 }}>

          {/* Amber gradient header */}
          <div className="relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-amber-500 via-orange-500 to-red-500" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.15),transparent_60%)]" />

            <div className="relative px-6 pt-5 pb-5">
              <div className="flex items-center gap-3">
                <div className="relative flex size-12 rounded-2xl bg-white/15 backdrop-blur-sm items-center justify-center ring-1 ring-white/20">
                  <Clock className="size-5 text-white" />
                  {/* Pulsing countdown ring */}
                  <svg className="absolute inset-0 size-12 -rotate-90" viewBox="0 0 48 48">
                    <circle cx="24" cy="24" r="20" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2" />
                    <circle cx="24" cy="24" r="20" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeDasharray={`${(idleSecondsLeft / 60) * 125.6} 125.6`} className="transition-all duration-1000" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white tracking-tight">Session Expiring</h3>
                  <p className="text-[11px] text-white/60 mt-0.5">Auto-logout due to inactivity</p>
                </div>
              </div>
            </div>
          </div>

          {/* Countdown Body */}
          <div className="px-6 py-5 text-center space-y-4">
            <div className="flex flex-col items-center gap-2">
              <div className="relative flex size-20 items-center justify-center">
                <span className="text-4xl font-black text-amber-600 dark:text-amber-400 tabular-nums">{idleSecondsLeft}</span>
                <span className="absolute -bottom-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">seconds left</span>
              </div>
              <p className="text-sm text-muted-foreground">
                You've been inactive for 10 minutes.
                <br />
                <span className="text-amber-600 dark:text-amber-400 font-semibold">You'll be logged out automatically.</span>
              </p>
            </div>

            <Button
              onClick={resetIdle}
              className="w-full h-11 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-sm shadow-lg shadow-emerald-500/25 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
            >
              <Zap className="size-4 mr-2" />
              Stay Logged In
            </Button>

            <button
              onClick={handleLogout}
              className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
            >
              Logout now
            </button>
          </div>
        </div>
      </div>,
      document.body
    )}

    </>
  )
}
