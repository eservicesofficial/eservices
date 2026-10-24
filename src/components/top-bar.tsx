'use client'

import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '@/components/auth-provider'
import { useNotification } from '@/hooks/use-notification'
import { useNotificationStore } from '@/lib/notification-store'
import { ThemeToggle } from '@/components/theme-toggle'
import ActivityLogSheet from '@/components/activity-log-sheet'
import NotificationCenter from '@/components/notification-center'
import {
  Settings,
  LogOut,
  Bell,
  X,
  ChevronDown,
  ClipboardList,
  ArrowRightLeft,
  Loader2,
  Zap,
  Shield,
  Fingerprint,
  Search,
} from 'lucide-react'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'

type PageId = 'dashboard' | 'new-bill' | 'bill-history' | 'cash-manager' | 'khata' | 'attendance' | 'calculator' | 'item-management' | 'reports' | 'settings' | 'table-management'

interface TopBarProps {
  onNavigate: (id: PageId) => void
  onLogout: () => void
}

export default function TopBar({ onNavigate, onLogout }: TopBarProps) {
  const { currentUser, hasPermission, switchUser, token } = useAuth()
  const { notify } = useNotification()
  const [time, setTime] = useState<string>('')
  const [date, setDate] = useState<string>('')
  const [notifOpen, setNotifOpen] = useState(false)
  const [pendingBills, setPendingBills] = useState(0)
  const [lowStockCount, setLowStockCount] = useState(0)
  const unreadNotifs = useNotificationStore((s) => s.unreadCount)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [activityLogOpen, setActivityLogOpen] = useState(false)
  const [switchDialogOpen, setSwitchDialogOpen] = useState(false)
  const [switchUsers, setSwitchUsers] = useState<Array<{ id: string; loginId: string; name: string; role: string; isActive: boolean }>>([])
  const [switchLoading, setSwitchLoading] = useState(false)
  const [switchingUserId, setSwitchingUserId] = useState<string | null>(null)
  const [switchSearch, setSwitchSearch] = useState('')
  const userMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const update = () => {
      const now = new Date()
      setTime(now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }))
      setDate(now.toLocaleDateString('en-US', { weekday: 'short', day: '2-digit', month: 'short' }))
    }
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [])

  // Fetch notification counts (requires auth token — API returns 401 without it)
  useEffect(() => {
    if (!token) return // Wait until session is restored
    const fetchCounts = async () => {
      try {
        const currentToken = token;
        if (!currentToken) return;
        const headers: Record<string, string> = { 'Authorization': `Bearer ${currentToken}` };
        const [dashRes, itemsRes] = await Promise.all([
          fetch('/api/dashboard', { headers }),
          fetch('/api/items', { headers }),
        ])
        if (dashRes.ok) {
          const dashData = await dashRes.json()
          setPendingBills(dashData.overall?.pendingBills ?? 0)
        }
        if (itemsRes.ok) {
          const items = await itemsRes.json()
          const lowStock = Array.isArray(items) ? items.filter((item: { quantity: number | null }) => item.quantity != null && item.quantity <= 5).length : 0
          setLowStockCount(lowStock)
        }
      } catch {
        // silent fail
      }
    }
    fetchCounts()
    const poll = setInterval(fetchCounts, 30000)
    return () => clearInterval(poll)
  }, [token])

  // Close menus on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setUserMenuOpen(false)
    }
    if (userMenuOpen) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [userMenuOpen])

  const totalAlerts = pendingBills + lowStockCount

  const roleColor = currentUser?.role === 'Admin' ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400'
    : currentUser?.role === 'Manager' ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400'
    : currentUser?.role === 'Cashier' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
    : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'

  const roleGradient = currentUser?.role === 'Admin' ? 'from-red-500 via-rose-500 to-pink-500'
    : currentUser?.role === 'Manager' ? 'from-blue-500 via-indigo-500 to-violet-500'
    : currentUser?.role === 'Cashier' ? 'from-amber-500 via-orange-500 to-yellow-500'
    : 'from-gray-400 via-gray-500 to-slate-500'

  const roleRing = currentUser?.role === 'Admin' ? 'ring-red-500/30 shadow-red-500/20 shadow-sm'
    : currentUser?.role === 'Manager' ? 'ring-blue-500/30 shadow-blue-500/20 shadow-sm'
    : currentUser?.role === 'Cashier' ? 'ring-amber-500/30 shadow-amber-500/20 shadow-sm'
    : 'ring-gray-400/30 shadow-gray-400/20 shadow-sm'

  const canViewLogs = hasPermission('auditLogs', 'access')

  return (
    <>
    <header className="sticky top-0 z-30 flex h-12 items-center gap-2 border-b bg-background/95 backdrop-blur-sm px-3 lg:px-5">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-1 h-4" />
      <div className="flex items-center gap-1.5">
        <img src="/icon-192.png" alt="Eservices" className="h-5 w-5 rounded object-cover" />
        <span className="text-sm font-semibold text-foreground hidden sm:inline">Eservices</span>
      </div>
      <div className="flex-1" />

      {/* Notification Bell */}
      <button
        onClick={() => setNotifOpen(true)}
        className="relative p-2 rounded-lg hover:bg-muted transition-colors"
        aria-label="Notifications"
      >
        <Bell className={`h-[1.15rem] w-[1.15rem] text-muted-foreground ${(totalAlerts + unreadNotifs) > 0 ? 'animate-[swing_0.5s_ease-in-out]' : ''}`} />
        {(totalAlerts + unreadNotifs) > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-none animate-pulse">
            {(totalAlerts + unreadNotifs) > 9 ? '9+' : (totalAlerts + unreadNotifs)}
          </span>
        )}
      </button>

      {/* Activity Log Button */}
      {canViewLogs && (
        <button
          onClick={() => setActivityLogOpen(true)}
          className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-blue-50 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-800/40 hover:bg-blue-100 dark:hover:bg-blue-950/60 transition-all duration-200 group"
          title="View Activity Log"
        >
          <ClipboardList className="size-3.5 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform" />
          <span className="text-[11px] font-medium text-blue-700 dark:text-blue-400">Activity Log</span>
        </button>
      )}

      {/* ── User Active Button — Dynamic Stylish Account Pill ── */}
      {currentUser && (
        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="relative flex items-center gap-2 pl-1 pr-3 py-1 rounded-full transition-all duration-300 group hover:scale-[1.02] active:scale-[0.98]"
            style={{
              background: 'linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(52,211,153,0.12) 50%, rgba(20,184,166,0.08) 100%)',
              border: '1px solid rgba(16,185,129,0.25)',
              boxShadow: '0 1px 3px rgba(16,185,129,0.08), 0 0 0 1px rgba(255,255,255,0.6)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'rgba(16,185,129,0.5)'
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(16,185,129,0.15), 0 0 0 1px rgba(255,255,255,0.8)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'rgba(16,185,129,0.25)'
              e.currentTarget.style.boxShadow = '0 1px 3px rgba(16,185,129,0.08), 0 0 0 1px rgba(255,255,255,0.6)'
            }}
          >
            {/* Animated glow ring */}
            <span className="absolute inset-0 rounded-full animate-pulse opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
              style={{ boxShadow: '0 0 20px rgba(16,185,129,0.15), inset 0 0 20px rgba(16,185,129,0.05)' }} />

            {/* Avatar with animated ring */}
            <div className={`relative flex size-8 rounded-full bg-gradient-to-br ${roleGradient} items-center justify-center text-white text-sm font-extrabold ring-[2.5px] ring-offset-1 ring-offset-background ${roleRing} transition-all duration-300 group-hover:scale-110 group-hover:ring-[3px]`}>
              {currentUser.loginId.charAt(0).toUpperCase()}
              {/* Online pulse */}
              <span className="absolute -bottom-0.5 -right-0.5 flex size-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex rounded-full size-3 bg-emerald-500 ring-2 ring-background" />
              </span>
            </div>

            {/* User info */}
            <div className="hidden md:flex items-center gap-2">
              <div className="flex flex-col items-start">
                <span className="text-[11px] font-bold text-foreground leading-none tracking-tight">
                  {currentUser.name}
                </span>
                <span className="text-[10px] text-muted-foreground font-mono leading-tight mt-0.5">
                  @{currentUser.loginId}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {/* Role badge */}
                <span className={`relative inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md ${roleColor}`}>
                  <Shield className="size-2.5" />
                  {currentUser.role}
                </span>
                {/* Active indicator */}
                <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded-md border border-emerald-200/50 dark:border-emerald-800/50">
                  <span className="size-1 rounded-full bg-emerald-500 animate-pulse" />
                  LIVE
                </span>
              </div>
            </div>

            {/* Chevron */}
            <ChevronDown className={`size-3.5 text-emerald-600/60 dark:text-emerald-400/60 transition-transform duration-300 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 ${userMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* ── Dropdown Menu ── */}
          {userMenuOpen && (
            <div className="absolute right-0 top-full mt-2 w-72 rounded-2xl border bg-popover/95 backdrop-blur-xl shadow-2xl shadow-black/[0.08] z-50 overflow-hidden animate-in fade-in-0 zoom-in-[0.98] slide-in-from-top-2 duration-200">
              {/* User Profile Card Header */}
              <div className="relative overflow-hidden">
                {/* Animated gradient bg */}
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 opacity-[0.07]" />
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-emerald-400/10 to-transparent rounded-full -translate-y-1/2 translate-x-1/2" />
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-teal-400/10 to-transparent rounded-full translate-y-1/2 -translate-x-1/2" />

                <div className="relative px-5 pt-5 pb-4 border-b">
                  <div className="flex items-start gap-3.5">
                    {/* Large avatar */}
                    <div className={`relative flex size-14 rounded-2xl bg-gradient-to-br ${roleGradient} items-center justify-center text-white text-xl font-extrabold ring-4 ring-white dark:ring-gray-900 shadow-lg`}>
                      {currentUser.loginId.charAt(0).toUpperCase()}
                      {/* Online dot */}
                      <span className="absolute -bottom-1 -right-1 flex size-4">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
                        <span className="relative inline-flex rounded-full size-4 bg-emerald-500 ring-[3px] ring-white dark:ring-gray-900" />
                      </span>
                    </div>
                    <div className="flex-1 min-w-0 pt-0.5">
                      <p className="text-[15px] font-extrabold text-foreground truncate leading-tight">{currentUser.name}</p>
                      <p className="text-xs text-muted-foreground font-mono mt-0.5">@{currentUser.loginId}</p>
                      <div className="flex items-center gap-2 mt-2.5">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-lg ${roleColor}`}>
                          <Shield className="size-3" />
                          {currentUser.role}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/50 px-2 py-0.5 rounded-lg">
                          <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Online
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Menu Items */}
              <div className="p-2 space-y-0.5">
                <button
                  onClick={() => { setUserMenuOpen(false); onNavigate('settings') }}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium hover:bg-muted/80 transition-all duration-150 group/item"
                >
                  <div className="flex size-8 rounded-lg bg-muted/80 items-center justify-center group-hover/item:bg-background group-hover/item:shadow-sm transition-all">
                    <Settings className="size-4 text-muted-foreground group-hover/item:text-foreground transition-colors" />
                  </div>
                  <span>Settings</span>
                </button>
                {canViewLogs && (
                  <button
                    onClick={() => { setUserMenuOpen(false); setActivityLogOpen(true) }}
                    className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium hover:bg-muted/80 transition-all duration-150 group/item"
                  >
                    <div className="flex size-8 rounded-lg bg-muted/80 items-center justify-center group-hover/item:bg-background group-hover/item:shadow-sm transition-all">
                      <ClipboardList className="size-4 text-muted-foreground group-hover/item:text-foreground transition-colors" />
                    </div>
                    <span>Activity Log</span>
                  </button>
                )}
                {(currentUser?.role === 'Admin' || currentUser?.role === 'Manager') && (
                  <button
                    onClick={async () => {
                      setUserMenuOpen(false)
                      setSwitchDialogOpen(true)
                      setSwitchSearch('')
                      setSwitchLoading(true)
                      try {
                        const res = await fetch('/api/auth/list-users', { headers: { 'Authorization': `Bearer ${token}` } })
                        if (res.ok) {
                          const data = await res.json()
                          setSwitchUsers(Array.isArray(data) ? data : [])
                        } else {
                          const err = await res.json().catch(() => ({}))
                          notify({ type: 'error', title: 'Error', message: err.error || 'Failed to load accounts' })
                          setSwitchUsers([])
                        }
                      } catch {
                        notify({ type: 'error', title: 'Error', message: 'Network error loading accounts' })
                        setSwitchUsers([])
                      } finally {
                        setSwitchLoading(false)
                      }
                    }}
                    className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium hover:bg-violet-50 dark:hover:bg-violet-950/30 transition-all duration-150 group/item"
                  >
                    <div className="flex size-8 rounded-lg bg-violet-100 dark:bg-violet-950/50 items-center justify-center group-hover/item:bg-violet-200 dark:group-hover/item:bg-violet-900/50 transition-all">
                      <ArrowRightLeft className="size-4 text-violet-600 dark:text-violet-400" />
                    </div>
                    <div className="flex-1 text-left">
                      <span className="text-violet-700 dark:text-violet-300">Switch User</span>
                      <p className="text-[10px] text-muted-foreground font-normal">Instant — no password</p>
                    </div>
                    <Fingerprint className="size-3.5 text-violet-400 dark:text-violet-500" />
                  </button>
                )}

                {/* Sign Out */}
                <div className="pt-1 mt-1 border-t">
                  <button
                    onClick={() => { setUserMenuOpen(false); onLogout(); }}
                    className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium hover:bg-red-50 dark:hover:bg-red-950/30 transition-all duration-150 group/item"
                  >
                    <div className="flex size-8 rounded-lg bg-red-100 dark:bg-red-950/50 items-center justify-center group-hover/item:bg-red-200 dark:group-hover/item:bg-red-900/50 transition-all">
                      <LogOut className="size-4 text-red-600 dark:text-red-400" />
                    </div>
                    <span className="text-red-600 dark:text-red-400">Sign Out</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {time && (
        <div className="hidden lg:flex flex-col items-end text-right min-w-[90px]">
          <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">{date}</span>
          <span className="text-xs text-gray-800 dark:text-gray-200 font-semibold tabular-nums">{time}</span>
        </div>
      )}
      <ThemeToggle />

      {/* Activity Log Sheet */}
      <ActivityLogSheet open={activityLogOpen} onOpenChange={setActivityLogOpen} />
    </header>

    {/* Notification Center Panel — rendered outside header to escape stacking context */}
    <NotificationCenter
      open={notifOpen}
      onClose={() => setNotifOpen(false)}
      pendingBills={pendingBills}
      lowStockCount={lowStockCount}
      onNavigate={(page) => onNavigate(page as PageId)}
    />

    {/* ── Switch User Dialog — Rendered via Portal to escape header stacking context ── */}
    {switchDialogOpen && typeof document !== 'undefined' && document.body && createPortal(
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ zIndex: 9999 }}>
        {/* Backdrop */}
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md" onClick={() => setSwitchDialogOpen(false)} />

        {/* Dialog */}
        <div className="relative w-full max-w-[440px] rounded-3xl bg-background border border-white/10 dark:border-white/5 shadow-[0_25px_60px_-12px_rgba(0,0,0,0.35)] animate-in fade-in-0 zoom-in-[0.97] slide-in-from-bottom-6 duration-300 overflow-hidden" style={{ zIndex: 10000 }}>

          {/* Animated gradient header */}
          <div className="relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.15),transparent_60%)]" />
            <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-white/[0.08] blur-2xl" />
            <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-white/[0.05] blur-2xl" />

            <div className="relative px-6 pt-5 pb-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative flex size-12 rounded-2xl bg-white/15 backdrop-blur-sm items-center justify-center ring-1 ring-white/20">
                    <ArrowRightLeft className="size-5 text-white" />
                    <span className="absolute -top-1 -right-1 size-4 rounded-full bg-emerald-400 flex items-center justify-center ring-2 ring-white/30">
                      <Zap className="size-2.5 text-white" />
                    </span>
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-white tracking-tight">Switch Account</h3>
                    <p className="text-[11px] text-white/60 mt-0.5">Instant access — no password required</p>
                  </div>
                </div>
                {/* Close button — highly visible */}
                <button
                  onClick={() => setSwitchDialogOpen(false)}
                  className="relative z-10 flex size-9 items-center justify-center rounded-xl bg-white/10 hover:bg-white/25 backdrop-blur-sm transition-all duration-200 hover:rotate-90 active:scale-90 border border-white/10"
                  aria-label="Close"
                >
                  <X className="size-4 text-white" strokeWidth={2.5} />
                </button>
              </div>

              {/* Current user indicator */}
              <div className="mt-4 flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-white/10 backdrop-blur-sm border border-white/10">
                <div className={`flex size-6 rounded-lg bg-gradient-to-br ${roleGradient} items-center justify-center text-white text-[10px] font-extrabold`}>
                  {currentUser?.loginId.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[11px] font-semibold text-white truncate">{currentUser?.name}</span>
                </div>
                <span className="text-[9px] font-bold uppercase tracking-wider text-white/80 bg-white/15 px-2 py-0.5 rounded-md">Current</span>
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="px-5 py-3 border-b bg-muted/30">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by name or ID..."
                value={switchSearch}
                onChange={(e) => setSwitchSearch(e.target.value)}
                className="w-full h-10 pl-10 pr-4 text-sm rounded-xl border bg-background/80 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-300 transition-all placeholder:text-muted-foreground/50"
                autoFocus
              />
              {switchSearch && (
                <button onClick={() => setSwitchSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* User List */}
          <div className="max-h-[340px] overflow-y-auto">
            {switchLoading ? (
              <div className="flex flex-col items-center justify-center py-14 gap-3">
                <div className="relative">
                  <div className="size-10 rounded-2xl bg-violet-100 dark:bg-violet-950/40 flex items-center justify-center">
                    <Loader2 className="size-5 text-violet-500 animate-spin" />
                  </div>
                </div>
                <span className="text-xs text-muted-foreground font-medium">Loading accounts...</span>
              </div>
            ) : (
              <div className="p-3 space-y-1.5">
                {switchUsers
                  .filter(u =>
                    switchSearch === '' ||
                    u.loginId.toLowerCase().includes(switchSearch.toLowerCase()) ||
                    u.name.toLowerCase().includes(switchSearch.toLowerCase())
                  )
                  .map((u) => {
                    const isCurrent = u.id === currentUser?.userId
                    const uRoleColor = u.role === 'Admin' ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400'
                      : u.role === 'Manager' ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400'
                      : u.role === 'Cashier' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
                      : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
                    const uGradient = u.role === 'Admin' ? 'from-red-500 via-rose-500 to-pink-500'
                      : u.role === 'Manager' ? 'from-blue-500 via-indigo-500 to-violet-500'
                      : u.role === 'Cashier' ? 'from-amber-500 via-orange-500 to-yellow-500'
                      : 'from-gray-400 via-gray-500 to-slate-500'

                    return (
                      <button
                        key={u.id}
                        disabled={isCurrent || switchingUserId === u.id || !u.isActive}
                        onClick={async () => {
                          if (isCurrent) return
                          setSwitchingUserId(u.id)
                          try {
                            const res = await fetch('/api/auth/switch-user', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                              body: JSON.stringify({ targetUserId: u.id }),
                            })
                            if (res.ok) {
                              const data = await res.json()
                              switchUser(data.token, data.user)
                              setSwitchDialogOpen(false)
                            } else {
                              const err = await res.json().catch(() => null)
                              notify({ type: 'error', title: 'Error', message: err?.error || 'Failed to switch user' })
                            }
                          } catch {
                            notify({ type: 'error', title: 'Error', message: 'Network error while switching account' })
                          } finally {
                            setSwitchingUserId(null)
                          }
                        }}
                        className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl text-left transition-all duration-200 ${
                          isCurrent
                            ? 'bg-violet-50 dark:bg-violet-950/20 border-2 border-violet-200 dark:border-violet-700/40 cursor-default'
                            : u.isActive
                              ? 'border-2 border-transparent hover:bg-muted/60 hover:border-muted-foreground/10 active:scale-[0.98]'
                              : 'opacity-40 cursor-not-allowed border-2 border-transparent'
                        }`}
                      >
                        {/* User avatar */}
                        <div className={`relative flex size-10 rounded-xl bg-gradient-to-br ${uGradient} items-center justify-center text-white text-sm font-extrabold shrink-0 shadow-md ring-2 ring-white dark:ring-gray-900`}>
                          {u.loginId.charAt(0).toUpperCase()}
                          {/* Online indicator for active users */}
                          {u.isActive && !isCurrent && (
                            <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full bg-emerald-500 ring-2 ring-background" />
                          )}
                        </div>

                        {/* User info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold truncate">{u.name}</p>
                          </div>
                          <p className="text-[11px] text-muted-foreground font-mono mt-0.5">@{u.loginId}</p>
                        </div>

                        {/* Right side badges */}
                        <div className="flex items-center gap-2 shrink-0">
                          {isCurrent ? (
                            <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400 bg-violet-100 dark:bg-violet-950/40 px-2.5 py-1 rounded-lg">
                              <span className="size-1.5 rounded-full bg-violet-500 animate-pulse" />
                              Active
                            </span>
                          ) : switchingUserId === u.id ? (
                            <div className="flex size-7 items-center justify-center">
                              <Loader2 className="size-4 text-violet-500 animate-spin" />
                            </div>
                          ) : !u.isActive ? (
                            <span className="text-[10px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-md">Inactive</span>
                          ) : (
                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-lg ${uRoleColor}`}>
                              {u.role}
                            </span>
                          )}
                        </div>
                      </button>
                    )
                  })}
                {switchUsers.filter(u => switchSearch === '' || u.loginId.toLowerCase().includes(switchSearch.toLowerCase()) || u.name.toLowerCase().includes(switchSearch.toLowerCase())).length === 0 && (
                  <div className="flex flex-col items-center py-10 gap-2">
                    <div className="size-12 rounded-2xl bg-muted flex items-center justify-center">
                      <Search className="size-5 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">No accounts found</p>
                    <p className="text-[11px] text-muted-foreground/60">Try a different search term</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer hint */}
          <div className="px-5 py-3 border-t bg-muted/20">
            <div className="flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground">
              <Shield className="size-3" />
              <span>Admin & Manager feature — All actions are logged</span>
            </div>
          </div>
        </div>
      </div>,
      document.body
    )}
    </>
  )
}
