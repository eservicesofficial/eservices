'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  BookOpen,
  Plus,
  Search,
  ArrowLeft,
  Trash2,
  Phone,
  UserCircle,
  TrendingUp,
  TrendingDown,
  Scale,
  Loader2,
  Printer,
  Wallet,
  FileText,
  CalendarDays,
  Clock,
  ArrowDownLeft,
  ArrowUpRight,
  Users,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ScrollArea } from '@/components/ui/scroll-area'
import { notify } from '@/lib/notification-store'
import { useAuth } from '@/components/auth-provider'
import ReadOnlyBanner from '@/components/read-only-banner'

// --- Types ---
interface KhataProfile {
  id: string
  name: string
  phone: string
  type: 'Customer' | 'Supplier'
  openingBalance: number
  transactions: KhataTransaction[]
  balance: number
  createdAt: string
}

interface KhataTransaction {
  id: string
  profileId: string
  date: string
  type: 'in' | 'out'
  amount: number
  description: string
  balanceSnapshot: number
  createdAt: string
  profile?: {
    name: string
  }
}

interface RecentTransaction {
  id: string
  profileId: string
  date: string
  type: 'in' | 'out'
  amount: number
  description: string
  createdAt: string
  profile?: {
    name: string
  }
}

interface KhataSectionProps {
  onRefreshData: () => void
  dataVersion?: number
}

// --- Helper: avatar gradient colors ---
function getAvatarColor(name: string): string {
  const colors = ['from-green-400 to-emerald-500', 'from-teal-400 to-cyan-500', 'from-emerald-400 to-green-500', 'from-lime-400 to-green-500']
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

function getAvatarGradient(name: string): string {
  const gradients = ['from-green-400 to-emerald-500', 'from-teal-400 to-cyan-500', 'from-emerald-400 to-green-600', 'from-lime-400 to-green-500']
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return gradients[Math.abs(hash) % gradients.length]
}

// --- Helper: format date nicely ---
function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  return `${day}/${month}/${year}`
}

// --- Helper: get last transaction date ---
function getLastTxnDate(profile: KhataProfile): string {
  if (profile.transactions.length === 0) return ''
  const sorted = [...profile.transactions].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )
  return sorted[0].date
}

// --- Empty State SVG ---
function EmptyStateIllustration() {
  return (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="opacity-40 mb-3">
      <rect x="20" y="25" width="80" height="70" rx="8" stroke="currentColor" strokeWidth="2" fill="none" />
      <rect x="32" y="38" width="56" height="6" rx="3" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <rect x="32" y="52" width="40" height="5" rx="2.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <rect x="32" y="63" width="50" height="5" rx="2.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <rect x="32" y="74" width="35" height="5" rx="2.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <circle cx="90" cy="35" r="12" stroke="currentColor" strokeWidth="2" fill="none" />
      <line x1="84" y1="35" x2="96" y2="35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="90" y1="29" x2="90" y2="41" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M25 95 C25 98 30 100 35 100 L85 100 C90 100 95 98 95 95" stroke="currentColor" strokeWidth="1.5" fill="none" />
    </svg>
  )
}

// --- Helper: relative time ---
function getRelativeTime(dateStr: string): string {
  if (!dateStr) return ''
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHr = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHr / 24)

  if (diffSec < 60) return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHr < 24) return `${diffHr}h ago`
  if (diffDay < 7) return `${diffDay}d ago`
  if (diffDay < 30) return `${Math.floor(diffDay / 7)}w ago`
  return formatDate(dateStr)
}

// --- Recent Transactions Widget ---
function RecentTransactionsWidget({ onAddClick }: { onAddClick?: () => void }) {
  const [transactions, setTransactions] = useState<RecentTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const { token } = useAuth()
  const authHeaders: Record<string, string> = token ? { 'Authorization': `Bearer ${token}` } : {}

  useEffect(() => {
    const fetchRecent = async () => {
      try {
        setLoading(true)
        const res = await fetch('/api/khata/transactions?limit=5', { headers: authHeaders })
        if (res.ok) {
          const data = await res.json()
          setTransactions(data)
        }
      } catch {
        // silently fail
      } finally {
        setLoading(false)
      }
    }
    fetchRecent()
  }, [])

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12 rounded-lg" />
        ))}
      </div>
    )
  }

  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-6 rounded-xl border-2 border-dashed border-muted-foreground/20 bg-gradient-to-br from-green-50/40 to-emerald-50/30 dark:from-green-950/20 dark:to-emerald-950/10">
        <Clock className="size-8 mb-2 opacity-30" />
        <p className="text-sm">No transactions yet</p>
        <p className="text-xs mt-1">Start tracking your credit/debit entries</p>
        <p className="text-[10px] text-muted-foreground/70 italic">💡 Tip: Add a profile first, then add transactions</p>
        {onAddClick && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs text-green-600 border-green-200 hover:bg-green-50 hover:text-green-700"
            onClick={onAddClick}
          >
            <Plus className="size-3.5" />
            Add Transaction
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {transactions.map((txn) => (
        <div
          key={txn.id}
          className={`flex items-center gap-3 p-3 rounded-lg border-l-3 transition-all hover:bg-muted/50 ${
            txn.type === 'in'
              ? 'border-l-teal-500 bg-teal-50/50 dark:bg-teal-950/20'
              : 'border-l-amber-500 bg-amber-50/50 dark:bg-amber-950/20'
          }`}
        >
          <div
            className={`flex size-9 shrink-0 items-center justify-center rounded-full ${
              txn.type === 'in'
                ? 'bg-teal-100 text-teal-600 dark:bg-teal-900/30'
                : 'bg-amber-100 text-amber-600 dark:bg-amber-900/30'
            }`}
          >
            {txn.type === 'in' ? (
              <ArrowDownLeft className="size-4" />
            ) : (
              <ArrowUpRight className="size-4" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{txn.description || '—'}</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
              <span className="truncate">{txn.profile?.name || 'Unknown'}</span>
              <span>•</span>
              <span>{getRelativeTime(txn.createdAt)}</span>
            </p>
          </div>
          <div className="text-right shrink-0">
            <Badge
              variant="secondary"
              className={`text-[10px] rounded-full ${
                txn.type === 'in'
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
              }`}
            >
              {txn.type === 'in' ? 'Credit' : 'Debit'}
            </Badge>
            <p
              className={`text-sm font-bold mt-0.5 ${
                txn.type === 'in' ? 'gradient-text' : 'text-red-500'
              }`}
            >
              {txn.type === 'in' ? '+' : '-'}₹{txn.amount.toLocaleString('en-IN')}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}

// --- Component ---
export default function KhataSection({ onRefreshData, dataVersion }: KhataSectionProps) {
  const { token, hasPermission } = useAuth()
  const authHeaders: Record<string, string> = token ? { 'Authorization': `Bearer ${token}` } : {}
  const canAccess = hasPermission('khata', 'access')
  const canCreate = hasPermission('khata', 'create')
  const canEdit = hasPermission('khata', 'edit')
  const canDelete = hasPermission('khata', 'delete')
  const noAccess = !canAccess
  const isReadOnly = !canAccess || (!canCreate && !canEdit && !canDelete)
  const [profiles, setProfiles] = useState<KhataProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [selectedProfile, setSelectedProfile] = useState<KhataProfile | null>(null)
  const [profileDetail, setProfileDetail] = useState<KhataProfile | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // Add Profile dialog
  const [addProfileOpen, setAddProfileOpen] = useState(false)
  const [newProfile, setNewProfile] = useState({
    name: '',
    phone: '',
    type: 'Customer' as 'Customer' | 'Supplier',
    openingBalance: 0,
  })
  const [submittingProfile, setSubmittingProfile] = useState(false)

  // Add Transaction dialog
  const [addTxnOpen, setAddTxnOpen] = useState(false)
  const [newTxn, setNewTxn] = useState({
    date: new Date().toISOString().split('T')[0],
    type: 'in' as 'in' | 'out',
    amount: '',
    description: '',
  })
  const [submittingTxn, setSubmittingTxn] = useState(false)

  // Delete dialogs
  const [deleteProfileOpen, setDeleteProfileOpen] = useState(false)
  const [deleteTxnId, setDeleteTxnId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Debounce ref
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  // --- Debounce search ---
  useEffect(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    debounceTimerRef.current = setTimeout(() => {
      setDebouncedQuery(searchQuery)
    }, 300)
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    }
  }, [searchQuery])

  // --- Fetch profiles ---
  const fetchProfiles = useCallback(async (silent?: boolean) => {
    try {
      if (!silent) setLoading(true)
      const res = await fetch('/api/khata/profiles', { headers: authHeaders })
      if (res.ok) {
        const data = await res.json()
        setProfiles(data)
      }
    } catch (err) {
      console.error('Failed to fetch profiles:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProfiles()
  }, [fetchProfiles])

  // Re-fetch data when dataVersion changes (sync from other tabs/devices)
  const prevDataVersion = useRef(dataVersion)
  useEffect(() => {
    if (dataVersion !== undefined && dataVersion !== prevDataVersion.current) {
      prevDataVersion.current = dataVersion
      fetchProfiles(true)  // silent=true for background sync
    }
  }, [dataVersion, fetchProfiles])

  // --- Fetch profile detail ---
  const fetchProfileDetail = useCallback(async (id: string) => {
    try {
      setDetailLoading(true)
      const res = await fetch(`/api/khata/profiles/${id}`, { headers: authHeaders })
      if (res.ok) {
        const data = await res.json()
        setProfileDetail(data)
      }
    } catch (err) {
      console.error('Failed to fetch profile detail:', err)
    } finally {
      setDetailLoading(false)
    }
  }, [])

  // --- Handlers ---
  const handleOpenProfile = (profile: KhataProfile) => {
    setSelectedProfile(profile)
    fetchProfileDetail(profile.id)
  }

  const handleBackToDashboard = () => {
    setSelectedProfile(null)
    setProfileDetail(null)
  }

  // Create profile
  const handleCreateProfile = async () => {
    if (!newProfile.name.trim()) return
    try {
      setSubmittingProfile(true)
      const res = await fetch('/api/khata/profiles', {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(newProfile),
      })
      if (res.ok) {
        notify({ type: 'success', title: 'Profile Created', message: 'Khata profile added successfully' })
        setAddProfileOpen(false)
        setNewProfile({ name: '', phone: '', type: 'Customer', openingBalance: 0 })
        fetchProfiles()
        onRefreshData()
      } else {
        notify({ type: 'error', title: 'Error', message: 'Failed to create profile' })
      }
    } catch (err) {
      console.error('Failed to create profile:', err)
      notify({ type: 'error', title: 'Error', message: 'Failed to create profile' })
    } finally {
      setSubmittingProfile(false)
    }
  }

  // Create transaction
  const handleCreateTransaction = async () => {
    if (!newTxn.amount || !selectedProfile) return
    try {
      setSubmittingTxn(true)
      const res = await fetch('/api/khata/transactions', {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileId: selectedProfile.id,
          date: newTxn.date,
          type: newTxn.type,
          amount: parseFloat(newTxn.amount),
          description: newTxn.description,
        }),
      })
      if (res.ok) {
        notify({ type: 'success', title: 'Transaction Added', message: 'Transaction recorded successfully' })
        setAddTxnOpen(false)
        setNewTxn({
          date: new Date().toISOString().split('T')[0],
          type: 'in',
          amount: '',
          description: '',
        })
        fetchProfileDetail(selectedProfile.id)
        fetchProfiles()
        onRefreshData()
      } else {
        notify({ type: 'error', title: 'Error', message: 'Failed to add transaction' })
      }
    } catch (err) {
      console.error('Failed to create transaction:', err)
      notify({ type: 'error', title: 'Error', message: 'Failed to add transaction' })
    } finally {
      setSubmittingTxn(false)
    }
  }

  // Delete profile
  const handleDeleteProfile = async () => {
    if (!selectedProfile) return
    try {
      setDeleting(true)
      const res = await fetch(`/api/khata/profiles/${selectedProfile.id}`, {
        method: 'DELETE',
        headers: authHeaders,
      })
      if (res.ok) {
        notify({ type: 'success', title: 'Profile Deleted', message: 'Khata profile removed' })
        setDeleteProfileOpen(false)
        handleBackToDashboard()
        fetchProfiles()
        onRefreshData()
      } else {
        notify({ type: 'error', title: 'Error', message: 'Failed to delete profile' })
      }
    } catch (err) {
      console.error('Failed to delete profile:', err)
      notify({ type: 'error', title: 'Error', message: 'Failed to delete profile' })
    } finally {
      setDeleting(false)
    }
  }

  // Delete transaction
  const handleDeleteTransaction = async () => {
    if (!deleteTxnId || !selectedProfile) return
    try {
      setDeleting(true)
      const res = await fetch(`/api/khata/transactions/${deleteTxnId}`, {
        method: 'DELETE',
        headers: authHeaders,
      })
      if (res.ok) {
        notify({ type: 'success', title: 'Transaction Deleted', message: 'Transaction removed' })
        setDeleteTxnId(null)
        fetchProfileDetail(selectedProfile.id)
        fetchProfiles()
        onRefreshData()
      } else {
        notify({ type: 'error', title: 'Error', message: 'Failed to delete transaction' })
      }
    } catch (err) {
      console.error('Failed to delete transaction:', err)
      notify({ type: 'error', title: 'Error', message: 'Failed to delete transaction' })
    } finally {
      setDeleting(false)
    }
  }

  // Print statement
  const handlePrintStatement = async () => {
    if (!selectedProfile || !profileDetail) return

    // Fetch shop settings for professional header
    let shopName = 'Eservices'
    let shopAddress = ''
    let shopPhone = ''
    try {
      const settingsRes = await fetch('/api/settings', { headers: authHeaders })
      if (settingsRes.ok) {
        const s = await settingsRes.json()
        shopName = s.shopName || 'Eservices'
        shopAddress = s.shopAddress || ''
        shopPhone = s.shopPhone || ''
      }
    } catch {
      // fall back to defaults
    }

    const profile = selectedProfile
    const detail = profileDetail

    // Safely compute balance with NaN/null protection
    const safeBalance = typeof detail.balance === 'number' && !isNaN(detail.balance)
      ? detail.balance
      : (typeof detail.openingBalance === 'number' && !isNaN(detail.openingBalance)
        ? detail.openingBalance
        : 0)

    // Escape HTML special characters in user-provided values
    const esc = (str: string | undefined | null) => {
      if (!str) return '—'
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
    }

    // Compute transaction-level balances safely
    const safeBalanceSnapshot = (val: number | undefined | null) =>
      typeof val === 'number' && !isNaN(val) ? val : 0

    // Compute summary values
    const totalIn = detail.transactions.filter((t: KhataTransaction) => t.type === 'in').reduce((s, t) => s + (t.amount || 0), 0)
    const totalOut = detail.transactions.filter((t: KhataTransaction) => t.type === 'out').reduce((s, t) => s + (t.amount || 0), 0)
    const netBalance = totalIn - totalOut
    const txnCount = detail.transactions.length

    // Date range
    const dates = detail.transactions.map((t: KhataTransaction) => t.date).filter(Boolean)
    const dateRange = dates.length > 0
      ? `${formatDate(dates.reduce((a: string, b: string) => a < b ? a : b))} — ${formatDate(dates.reduce((a: string, b: string) => a > b ? a : b))}`
      : formatDate(new Date().toISOString())

    const now = new Date()
    const printDate = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    const printTime = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

    const balanceColor = safeBalance >= 0 ? '#059669' : '#dc2626'
    const balanceBg = safeBalance >= 0 ? '#ecfdf5' : '#fef2f2'
    const balanceBorder = safeBalance >= 0 ? '#a7f3d0' : '#fecaca'
    const balanceSign = safeBalance < 0 ? '-' : safeBalance > 0 ? '+' : ''
    const balanceStatusText = safeBalance > 0 ? '⬆ They owe you' : safeBalance < 0 ? '⬇ You owe them' : '✓ Settled'

    // Build transaction rows with alternating colors
    const txnRows = detail.transactions.length === 0
      ? '<tr class="empty-row"><td colspan="6" style="text-align:center;color:#9ca3af;padding:32px 12px;font-style:italic;font-size:13px;">No transactions recorded</td></tr>'
      : detail.transactions.map((txn: KhataTransaction, idx: number) => {
          const rowBg = idx % 2 === 0 ? '#ffffff' : '#fafafa'
          const bSnap = safeBalanceSnapshot(txn.balanceSnapshot)
          const bColor = bSnap >= 0 ? '#059669' : '#dc2626'
          const bSign = bSnap < 0 ? '-' : bSnap > 0 ? '+' : ''
          const bAbs = Math.abs(bSnap).toLocaleString('en-IN')
          const moneyIn = txn.type === 'in' ? `<span style="color:#059669;font-weight:600;">+₹${(txn.amount || 0).toLocaleString('en-IN')}</span>` : ''
          const moneyOut = txn.type === 'out' ? `<span style="color:#dc2626;font-weight:600;">-₹${(txn.amount || 0).toLocaleString('en-IN')}</span>` : ''
          return `<tr style="background:${rowBg};">
            <td style="padding:10px 14px;font-size:12px;color:#6b7280;text-align:center;border-bottom:1px solid #f3f4f6;">${idx + 1}</td>
            <td style="padding:10px 14px;font-size:12px;color:#374151;white-space:nowrap;border-bottom:1px solid #f3f4f6;">${formatDate(txn.date)}</td>
            <td style="padding:10px 14px;font-size:13px;color:#1f2937;border-bottom:1px solid #f3f4f6;">${esc(txn.description)}</td>
            <td style="padding:10px 14px;font-size:13px;text-align:right;border-bottom:1px solid #f3f4f6;">${moneyIn}</td>
            <td style="padding:10px 14px;font-size:13px;text-align:right;border-bottom:1px solid #f3f4f6;">${moneyOut}</td>
            <td style="padding:10px 14px;font-size:13px;text-align:right;font-weight:700;color:${bColor};border-bottom:1px solid #f3f4f6;">${bSign}₹${bAbs}</td>
          </tr>`
        }).join('')

    const printHtml = `<!DOCTYPE html><html><head><title>Khata Statement - ${esc(profile.name)}</title>
<style>
  @page{size:A4;margin:12mm;}
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:'Segoe UI',Tahoma,Geneva,Verdana,Arial,sans-serif;color:#1a1a1a;padding:0;line-height:1.5;}

  /* ===== HEADER ===== */
  .header{display:flex;align-items:center;justify-content:space-between;padding-bottom:18px;margin-bottom:20px;border-bottom:3px solid #16a34a;}
  .header-left{display:flex;align-items:center;gap:14px;}
  .logo-box{width:56px;height:56px;background:linear-gradient(135deg,#16a34a 0%,#059669 50%,#047857 100%);border-radius:12px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(22,163,74,0.25);}
  .logo-text{color:#fff;font-size:18px;font-weight:800;font-family:'Segoe UI',Arial,sans-serif;letter-spacing:-0.5px;}
  .shop-info{display:flex;flex-direction:column;}
  .shop-name{font-size:22px;font-weight:700;color:#111827;letter-spacing:-0.3px;}
  .shop-detail{font-size:12px;color:#6b7280;margin-top:2px;}
  .header-right{text-align:right;display:flex;flex-direction:column;align-items:flex-end;}
  .header-date{font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;}

  /* ===== STATEMENT TITLE ===== */
  .statement-title{text-align:center;margin-bottom:24px;padding:14px 20px;background:linear-gradient(135deg,#f0fdf4 0%,#ecfdf5 100%);border:1px solid #bbf7d0;border-radius:10px;}
  .statement-title h1{font-size:16px;font-weight:700;color:#16a34a;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:2px;}
  .statement-title .date-range{font-size:12px;color:#6b7280;font-weight:400;}

  /* ===== CUSTOMER INFO BOX ===== */
  .customer-box{border:1px solid #e5e7eb;border-radius:10px;padding:18px 20px;margin-bottom:20px;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,0.04);}
  .customer-box-title{font-size:10px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #f3f4f6;}
  .customer-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px 24px;}
  .customer-field{display:flex;flex-direction:column;}
  .customer-label{font-size:10px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:.5px;}
  .customer-value{font-size:14px;font-weight:600;color:#111827;margin-top:2px;}

  /* ===== CURRENT BALANCE BOX ===== */
  .balance-box{padding:20px 24px;margin-bottom:20px;border-radius:10px;border:1.5px solid ${balanceBorder};background:${balanceBg};display:flex;align-items:center;justify-content:space-between;box-shadow:0 1px 4px rgba(0,0,0,0.03);}
  .balance-info{display:flex;flex-direction:column;}
  .balance-label{font-size:10px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:1px;}
  .balance-status{font-size:13px;font-weight:500;color:${balanceColor};margin-top:2px;}
  .balance-amount{font-size:28px;font-weight:800;color:${balanceColor};letter-spacing:-0.5px;}

  /* ===== SUMMARY CARDS ===== */
  .summary-row{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px;}
  .summary-card{padding:14px 16px;border-radius:10px;text-align:center;border:1px solid #e5e7eb;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,0.04);}
  .summary-card-icon{width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;margin:0 auto 8px auto;font-size:15px;}
  .summary-label{font-size:9px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:.6px;}
  .summary-value{font-size:16px;font-weight:700;margin-top:3px;letter-spacing:-0.3px;}

  /* ===== TABLE ===== */
  .table-container{border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;margin-bottom:20px;box-shadow:0 1px 3px rgba(0,0,0,0.04);}
  table{width:100%;border-collapse:collapse;}
  thead tr{background:#f3f4f6;}
  th{padding:12px 14px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:#6b7280;text-align:left;border-bottom:2px solid #e5e7eb;}
  th:last-child{text-align:right;}
  th:nth-child(5),th:nth-child(4){text-align:right;}
  th:first-child{text-align:center;}
  td{padding:10px 14px;font-size:13px;border-bottom:1px solid #f3f4f6;color:#1f2937;}

  /* ===== SIGNATURE LINE ===== */
  .signature-section{display:flex;justify-content:space-between;margin:28px 0 12px 0;padding-top:16px;border-top:1px solid #e5e7eb;}
  .signature-block{text-align:center;width:200px;}
  .signature-line{border-top:1.5px solid #374151;margin-top:40px;margin-bottom:6px;}
  .signature-label{font-size:11px;font-weight:600;color:#374151;text-transform:uppercase;letter-spacing:.5px;}
  .disclaimer{text-align:center;font-size:10px;color:#9ca3af;margin-top:14px;font-style:italic;}

  /* ===== FOOTER ===== */
  .footer{margin-top:8px;padding-top:14px;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:center;}
  .footer-left{font-size:11px;color:#9ca3af;}
  .footer-brand{font-weight:600;color:#16a34a;}
  .footer-right{font-size:11px;color:#9ca3af;text-align:right;}

  /* ===== PRINT ===== */
  @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}
  .empty-row td{text-align:center;color:#9ca3af;padding:32px 12px;font-style:italic;font-size:13px;}
</style></head><body style="padding:4px;">

<!-- ===== PROFESSIONAL HEADER ===== -->
<div class="header">
  <div class="header-left">
    <div class="logo-box">
      <span class="logo-text">E₹</span>
    </div>
    <div class="shop-info">
      <div class="shop-name">${esc(shopName)}</div>
      ${shopAddress ? `<div class="shop-detail">${esc(shopAddress)}</div>` : ''}
      ${shopPhone ? `<div class="shop-detail">${'&#9742;'} ${esc(shopPhone)}</div>` : ''}
    </div>
  </div>
  <div class="header-right">
    <div class="header-date">Date of Issue</div>
    <div style="font-size:13px;font-weight:600;color:#111827;">${printDate}</div>
    <div style="font-size:11px;color:#6b7280;">${printTime}</div>
  </div>
</div>

<!-- ===== STATEMENT TITLE ===== -->
<div class="statement-title">
  <h1>Khata Account Statement</h1>
  <div class="date-range">${dateRange}</div>
</div>

<!-- ===== CUSTOMER INFO BOX ===== -->
<div class="customer-box">
  <div class="customer-box-title">Customer / Supplier Information</div>
  <div class="customer-grid">
    <div class="customer-field">
      <span class="customer-label">Name</span>
      <span class="customer-value">${esc(profile.name)}</span>
    </div>
    <div class="customer-field">
      <span class="customer-label">Phone</span>
      <span class="customer-value">${esc(profile.phone)}</span>
    </div>
    <div class="customer-field">
      <span class="customer-label">Account Type</span>
      <span class="customer-value">${esc(profile.type)}</span>
    </div>
    <div class="customer-field">
      <span class="customer-label">Opening Balance</span>
      <span class="customer-value" style="color:${typeof profile.openingBalance === 'number' ? (profile.openingBalance >= 0 ? '#059669' : '#dc2626') : '#111827'}">₹${(profile.openingBalance || 0).toLocaleString('en-IN')}</span>
    </div>
  </div>
</div>

<!-- ===== CURRENT BALANCE BOX ===== -->
<div class="balance-box">
  <div class="balance-info">
    <div class="balance-label">Current Outstanding Balance</div>
    <div class="balance-status">${balanceStatusText}</div>
  </div>
  <div class="balance-amount">${balanceSign}₹${Math.abs(safeBalance).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</div>
</div>

<!-- ===== SUMMARY CARDS ===== -->
<div class="summary-row">
  <div class="summary-card">
    <div class="summary-card-icon" style="background:#ecfdf5;color:#059669;">&#8595;</div>
    <div class="summary-label">Money In</div>
    <div class="summary-value" style="color:#059669;">+₹${totalIn.toLocaleString('en-IN')}</div>
  </div>
  <div class="summary-card">
    <div class="summary-card-icon" style="background:#fef2f2;color:#dc2626;">&#8593;</div>
    <div class="summary-label">Money Out</div>
    <div class="summary-value" style="color:#dc2626;">-₹${totalOut.toLocaleString('en-IN')}</div>
  </div>
  <div class="summary-card">
    <div class="summary-card-icon" style="background:${netBalance >= 0 ? '#ecfdf5' : '#fef2f2'};color:${netBalance >= 0 ? '#059669' : '#dc2626'};">&#8801;</div>
    <div class="summary-label">Net Balance</div>
    <div class="summary-value" style="color:${netBalance >= 0 ? '#059669' : '#dc2626'};">${netBalance < 0 ? '-' : netBalance > 0 ? '+' : ''}₹${Math.abs(netBalance).toLocaleString('en-IN')}</div>
  </div>
  <div class="summary-card">
    <div class="summary-card-icon" style="background:#f3f4f6;color:#6b7280;">&#8801;</div>
    <div class="summary-label">Transactions</div>
    <div class="summary-value" style="color:#374151;">${txnCount}</div>
  </div>
</div>

<!-- ===== TRANSACTION TABLE ===== -->
<div class="table-container">
  <table>
    <thead>
      <tr>
        <th style="width:40px;text-align:center;">#</th>
        <th style="width:100px;">Date</th>
        <th>Description</th>
        <th style="width:110px;text-align:right;">Money In</th>
        <th style="width:110px;text-align:right;">Money Out</th>
        <th style="width:120px;text-align:right;">Balance</th>
      </tr>
    </thead>
    <tbody>
      ${txnRows}
    </tbody>
  </table>
</div>

<!-- ===== SIGNATURE / AUTHORIZATION ===== -->
<div class="signature-section">
  <div class="signature-block">
    <div class="signature-line"></div>
    <div class="signature-label">Authorized Signatory</div>
  </div>
  <div class="signature-block">
    <div class="signature-line"></div>
    <div class="signature-label">Customer / Supplier</div>
  </div>
</div>
<div class="disclaimer">This is a computer-generated statement and does not require a physical signature unless disputed.</div>

<!-- ===== FOOTER ===== -->
<div class="footer">
  <div class="footer-left">
    Generated by <span class="footer-brand">Eservices</span> &middot; v2.0
  </div>
  <div class="footer-right">
    Printed on ${printDate} at ${printTime}
  </div>
</div>

</body></html>`

    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      notify({ type: 'error', title: 'Error', message: 'Please allow pop-ups to print' })
      return
    }
    printWindow.document.write(printHtml)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => printWindow.print(), 600)
  }

  // --- Computed values ---
  const filteredProfiles = profiles.filter((p) => {
    const q = debouncedQuery.toLowerCase()
    return p.name.toLowerCase().includes(q) || p.phone.includes(q)
  })

  const totalReceivable = profiles
    .filter((p) => p.balance > 0)
    .reduce((sum, p) => sum + p.balance, 0)

  const totalPayable = profiles
    .filter((p) => p.balance < 0)
    .reduce((sum, p) => sum + Math.abs(p.balance), 0)

  const netBalance = totalReceivable - totalPayable

  const formatCurrency = (val: number) => {
    const sign = val < 0 ? '-' : val > 0 ? '+' : ''
    return `${sign}₹${Math.abs(val).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
  }

  // --- Detail View ---
  if (selectedProfile && profileDetail) {
    // Compute summary stats for the profile
    const totalIn = profileDetail.transactions.filter((t) => t.type === 'in').reduce((s, t) => s + t.amount, 0)
    const totalOut = profileDetail.transactions.filter((t) => t.type === 'out').reduce((s, t) => s + t.amount, 0)
    const txnCount = profileDetail.transactions.length
    const balance = typeof profileDetail.balance === 'number' && !isNaN(profileDetail.balance)
      ? profileDetail.balance
      : (typeof profileDetail.openingBalance === 'number' && !isNaN(profileDetail.openingBalance)
        ? profileDetail.openingBalance
        : 0)
    const isPositive = balance > 0
    const isNegative = balance < 0
    const isZero = balance === 0

    return (
      <div className="space-y-4">
        {isReadOnly && <ReadOnlyBanner module="Khata Book" noAccess={noAccess} />}
        {/* Back Button */}
        <Button variant="ghost" size="sm" onClick={handleBackToDashboard} className="gap-2">
          <ArrowLeft className="size-4" />
          Back to All Profiles
        </Button>

        {/* Profile Header */}
        <Card className="overflow-hidden border-0 shadow-md gradient-border">
          <div
            className={`h-2 ${
              selectedProfile.type === 'Customer'
                ? 'bg-gradient-to-r from-emerald-400 to-teal-600'
                : 'bg-gradient-to-r from-rose-400 to-pink-600'
            }`}
          />
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div
              className={`flex size-14 shrink-0 items-center justify-center rounded-full text-xl font-bold text-white shadow-md bg-gradient-to-br ${getAvatarColor(selectedProfile.name)}`}
              >
                {selectedProfile.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold truncate">{selectedProfile.name}</h2>
                  <Badge
                    variant={selectedProfile.type === 'Customer' ? 'default' : 'secondary'}
                    className={
                      selectedProfile.type === 'Customer'
                        ? 'bg-emerald-100 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                        : 'bg-pink-100 text-pink-800 border-pink-200'
                    }
                  >
                    {selectedProfile.type}
                  </Badge>
                </div>
                {selectedProfile.phone && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                    <Phone className="size-3.5" />
                    {selectedProfile.phone}
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Balance</p>
                <p
                  className={`text-2xl font-bold tabular-nums ${
                    isPositive ? 'text-green-600 dark:text-green-400' : isNegative ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'
                  }`}
                >
                  {balance < 0 ? '-' : balance > 0 ? '+' : ''}₹{Math.abs(balance).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                </p>
                <p className={`text-xs font-medium ${isPositive ? 'text-green-500' : isNegative ? 'text-red-500' : 'text-muted-foreground'}`}>
                  {isPositive ? '⬆ They owe you' : isNegative ? '⬇ You owe them' : '✓ Settled'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Summary Cards */}
        {txnCount > 0 && (
          <div className="grid grid-cols-3 gap-3">
            <Card className="border-0 shadow-sm">
              <CardContent className="p-3 text-center">
                <div className="flex size-8 mx-auto mb-1.5 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
                  <ArrowDownLeft className="size-4 text-green-600 dark:text-green-400" />
                </div>
                <p className="text-xs text-muted-foreground">Total In</p>
                <p className="text-sm font-bold tabular-nums text-green-600 dark:text-green-400">
                  +₹{totalIn.toLocaleString('en-IN')}
                </p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-3 text-center">
                <div className="flex size-8 mx-auto mb-1.5 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/30">
                  <ArrowUpRight className="size-4 text-red-600 dark:text-red-400" />
                </div>
                <p className="text-xs text-muted-foreground">Total Out</p>
                <p className="text-sm font-bold tabular-nums text-red-600 dark:text-red-400">
                  -₹{totalOut.toLocaleString('en-IN')}
                </p>
              </CardContent>
            </Card>
            <Card className={`border-0 shadow-sm ${isPositive ? 'bg-green-50/50 dark:bg-green-950/20' : isNegative ? 'bg-red-50/50 dark:bg-red-950/20' : ''}`}>
              <CardContent className="p-3 text-center">
                <div className={`flex size-8 mx-auto mb-1.5 items-center justify-center rounded-lg ${isPositive ? 'bg-green-200 dark:bg-green-800/40' : isNegative ? 'bg-red-200 dark:bg-red-800/40' : 'bg-muted'}`}>
                  <Scale className={`size-4 ${isPositive ? 'text-green-600' : isNegative ? 'text-red-600' : 'text-muted-foreground'}`} />
                </div>
                <p className="text-xs text-muted-foreground">Net Balance</p>
                <p className={`text-sm font-bold tabular-nums ${isPositive ? 'text-green-600' : isNegative ? 'text-red-600' : 'text-muted-foreground'}`}>
                  {balance < 0 ? '-' : balance > 0 ? '+' : ''}₹{Math.abs(balance).toLocaleString('en-IN')}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Ledger Table */}
        <Card className="py-0 gap-0 overflow-hidden">
          <CardHeader className="pb-0 pt-4 px-4 sm:px-6">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="size-4" />
                Transaction Ledger
              </CardTitle>
              {profileDetail.transactions.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs print:hidden"
                  onClick={handlePrintStatement}
                >
                  <Printer className="size-3.5" />
                  Print Statement
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {profileDetail.transactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground rounded-xl border-2 border-dashed border-muted-foreground/20 bg-gradient-to-br from-green-50/40 to-emerald-50/30 dark:from-green-950/20 dark:to-emerald-950/10">
                <EmptyStateIllustration />
                <p className="text-sm font-medium">No transactions yet</p>
                <p className="text-xs mt-1">Tap the + button to add your first transaction</p>
                <p className="text-[10px] text-muted-foreground/70 italic mt-1">💡 Tip: Use the floating action button below to get started</p>
              </div>
            ) : (
              <ScrollArea className="max-h-[60vh]">
                <Table>
                  <TableHeader>
                    <TableRow className="sticky top-0 bg-background z-10 hover:bg-background">
                      <TableHead className="pl-4">Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">In</TableHead>
                      <TableHead className="text-right">Out</TableHead>
                      <TableHead className="text-right pr-4">Running Balance</TableHead>
                      <TableHead className="w-10 print:hidden"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {profileDetail.transactions.map((txn) => (
                      <TableRow key={txn.id} className={`${txn.type === 'in' ? 'border-l-3 border-l-teal-500' : 'border-l-3 border-l-amber-500'} hover-lift`}>
                        <TableCell className="pl-4 text-xs text-muted-foreground whitespace-nowrap">
                          {formatDate(txn.date)}
                        </TableCell>
                        <TableCell className="max-w-[120px] sm:max-w-none truncate text-sm">
                          {txn.description || '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          {txn.type === 'in' && (
                            <span className="text-green-600 font-medium">
                              +₹{txn.amount.toLocaleString('en-IN')}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {txn.type === 'out' && (
                            <span className="text-red-600 font-medium">
                              -₹{txn.amount.toLocaleString('en-IN')}
                            </span>
                          )}
                        </TableCell>
                        <TableCell
                          className={`text-right font-semibold pr-4 whitespace-nowrap ${
                            txn.balanceSnapshot >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}
                        >
                          {formatCurrency(txn.balanceSnapshot)}
                        </TableCell>
                        <TableCell className="print:hidden">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-muted-foreground hover:text-red-600"
                            onClick={() => setDeleteTxnId(txn.id)}
                            disabled={!canDelete}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* FAB: Add Transaction */}
        {canCreate && (
        <Button
          className="fixed bottom-6 right-6 rounded-full size-14 shadow-lg z-40 print:hidden"
          style={{ backgroundColor: '#4CAF50', color: 'white' }}
          onClick={() => {
            setNewTxn({
              date: new Date().toISOString().split('T')[0],
              type: 'in',
              amount: '',
              description: '',
            })
            setAddTxnOpen(true)
          }}
        >
          <Plus className="size-6" />
        </Button>
        )}

        {/* Delete Profile Button */}
        <div className="flex justify-center pt-4 print:hidden">
          <Button
            variant="outline"
            size="sm"
            className="text-red-600 hover:text-red-700 hover:bg-red-50 gap-2"
            onClick={() => setDeleteProfileOpen(true)}
            disabled={!canDelete}
          >
            <Trash2 className="size-4" />
            Delete Profile
          </Button>
        </div>

        {/* Add Transaction Dialog */}
        <Dialog open={addTxnOpen} onOpenChange={setAddTxnOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Transaction</DialogTitle>
              <DialogDescription>Add a new transaction for {selectedProfile.name}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={newTxn.date}
                  onChange={(e) => setNewTxn({ ...newTxn, date: e.target.value })}
                  className="focus-visible:ring-2 focus-visible:ring-green-500/20 focus-visible:border-green-500 transition-all duration-200"
                />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <RadioGroup
                  value={newTxn.type}
                  onValueChange={(v) => setNewTxn({ ...newTxn, type: v as 'in' | 'out' })}
                  className="flex gap-4"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="in" id="txn-in" />
                    <Label htmlFor="txn-in" className="text-green-600 font-medium cursor-pointer">
                      Money In (You Get)
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="out" id="txn-out" />
                    <Label htmlFor="txn-out" className="text-red-600 font-medium cursor-pointer">
                      Money Out (You Give)
                    </Label>
                  </div>
                </RadioGroup>
              </div>
              <div className="space-y-2">
                <Label>Amount</Label>
                <Input
                  type="number"
                  placeholder="Enter amount"
                  value={newTxn.amount}
                  onChange={(e) => setNewTxn({ ...newTxn, amount: e.target.value })}
                  min="0"
                  step="0.01"
                  className="focus-visible:ring-2 focus-visible:ring-green-500/20 focus-visible:border-green-500 transition-all duration-200"
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  placeholder="Optional description"
                  value={newTxn.description}
                  onChange={(e) => setNewTxn({ ...newTxn, description: e.target.value })}
                  className="focus-visible:ring-2 focus-visible:ring-green-500/20 focus-visible:border-green-500 transition-all duration-200"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddTxnOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCreateTransaction}
                disabled={submittingTxn || !newTxn.amount}
                style={{ backgroundColor: '#4CAF50', color: 'white' }}
                className="transition-all duration-200 active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-green-500/30"
              >
                {submittingTxn && <Loader2 className="size-4 animate-spin" />}
                Add Transaction
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Transaction Confirmation */}
        <AlertDialog open={!!deleteTxnId} onOpenChange={() => setDeleteTxnId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Transaction</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure? This will delete this transaction and update the balance. This action
                cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteTransaction}
                disabled={deleting}
                className="bg-red-600 text-white hover:bg-red-700"
              >
                {deleting && <Loader2 className="size-4 animate-spin" />}
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete Profile Confirmation */}
        <AlertDialog open={deleteProfileOpen} onOpenChange={setDeleteProfileOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Profile</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete <strong>{selectedProfile.name}</strong> and all their
                transactions? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteProfile}
                disabled={deleting}
                className="bg-red-600 text-white hover:bg-red-700"
              >
                {deleting && <Loader2 className="size-4 animate-spin" />}
                Delete Profile
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    )
  }

  // --- Detail Loading ---
  if (selectedProfile && detailLoading) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={handleBackToDashboard} className="gap-2">
          <ArrowLeft className="size-4" />
          Back to All Profiles
        </Button>
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    )
  }

  // --- Dashboard View ---
  return (
    <div className="space-y-4">
      {isReadOnly && <ReadOnlyBanner module="Khata Book" noAccess={noAccess} />}
      {/* Gradient Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 p-5 md:p-6 text-white shadow-lg shadow-green-600/20">
        <div className="pointer-events-none absolute -right-8 -top-8 size-36 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-6 -left-6 size-28 rounded-full bg-white/5" />
        <div className="relative z-10">
          <h2 className="text-xl md:text-2xl font-bold tracking-tight flex items-center gap-2">
            <BookOpen className="size-6" />
            Khata Book
          </h2>
          <p className="text-green-100 text-sm mt-1">
            Manage credit/debit ledgers for customers and suppliers
          </p>
        </div>
      </div>

      {/* Sticky Summary Bar */}
      {!loading && (
        <div className="sticky top-0 z-20 -mx-1 px-1 py-2 backdrop-blur-md bg-background/80 border-b">
          <div className="grid grid-cols-3 gap-3 rounded-xl border bg-card p-3 shadow-sm">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-0.5">
                <Users className="size-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground font-medium">Total Profiles</span>
              </div>
              <p className="text-lg font-bold text-foreground tabular-nums">{profiles.length}</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-0.5">
                <TrendingDown className="size-3.5 text-amber-500" />
                <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">Total Receivable</span>
              </div>
              <p className="text-lg font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                ₹{totalReceivable.toLocaleString('en-IN')}
              </p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-0.5">
                <TrendingUp className="size-3.5 text-emerald-500" />
                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Total Payable</span>
              </div>
              <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                ₹{totalPayable.toLocaleString('en-IN')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Stats Cards with Gradient Backgrounds */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="overflow-hidden border-0 shadow-md card-hover-glow">
          <div className="h-1 bg-gradient-to-r from-emerald-400 to-teal-600" />
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">You Will Get</p>
                <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                  ₹{totalReceivable.toLocaleString('en-IN')}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">Receivable</p>
              </div>
              <div className="flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-100 to-teal-200 dark:from-emerald-900/40 dark:to-teal-900/40 shadow-sm">
                <TrendingUp className="size-6 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-0 shadow-md card-hover-glow">
          <div className="h-1 bg-gradient-to-r from-rose-400 to-red-600" />
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">You Will Give</p>
                <p className="text-xl font-bold text-red-600 mt-1">
                  ₹{totalPayable.toLocaleString('en-IN')}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">Payable</p>
              </div>
              <div className="flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-red-100 to-red-200 shadow-sm">
                <TrendingDown className="size-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-0 shadow-md card-hover-glow">
          <div
            className={`h-1 ${
              netBalance >= 0
                ? 'bg-gradient-to-r from-green-400 to-green-600'
                : 'bg-gradient-to-r from-red-400 to-red-600'
            }`}
          />
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">Net Balance</p>
                <p
                  className={`text-xl font-bold mt-1 ${
                    netBalance >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {formatCurrency(netBalance)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {netBalance >= 0 ? 'You are ahead' : 'You owe'}
                </p>
              </div>
              <div
                className={`flex size-12 items-center justify-center rounded-xl shadow-sm ${
                  netBalance >= 0
                    ? 'bg-gradient-to-br from-green-100 to-green-200'
                    : 'bg-gradient-to-br from-red-100 to-red-200'
                }`}
              >
                <Scale className={`size-6 ${netBalance >= 0 ? 'text-green-600' : 'text-red-600'}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* Recent Transactions Widget */}
      <Card className="overflow-hidden border-0 shadow-sm">
        <CardHeader className="pb-0 pt-4 px-4 sm:px-6">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="size-4 text-muted-foreground" />
            Recent Transactions
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <RecentTransactionsWidget onAddClick={() => {
            if (profiles.length > 0) {
              handleOpenProfile(profiles[0])
            } else {
              setAddProfileOpen(true)
            }
          }} />
        </CardContent>
      </Card>

      {/* Search and Add */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button
          onClick={() => {
            setNewProfile({ name: '', phone: '', type: 'Customer', openingBalance: 0 })
            setAddProfileOpen(true)
          }}
          style={{ backgroundColor: '#4CAF50', color: 'white' }}
          className="gap-2"
          disabled={!canCreate}
        >
          <Plus className="size-4" />
          Add Profile
        </Button>
      </div>

      {/* Search results count */}
      {searchQuery && !loading && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Search className="size-3" />
          {filteredProfiles.length} {filteredProfiles.length === 1 ? 'result' : 'results'} found for &ldquo;{searchQuery}&rdquo;
          {debouncedQuery !== searchQuery && (
            <Loader2 className="size-3 animate-spin ml-1" />
          )}
        </p>
      )}

      {/* Profiles Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : filteredProfiles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-6 text-center rounded-2xl border-2 border-dashed border-green-300/40 dark:border-green-700/30 bg-gradient-to-b from-green-50/50 to-emerald-50/30 dark:from-green-950/20 dark:to-emerald-950/10">
          <div className="rounded-full bg-green-100 dark:bg-green-900/40 p-5 animate-float">
            <BookOpen className="h-10 w-10 text-green-500 dark:text-green-400" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mt-1">
            {searchQuery ? 'No profiles match your search' : 'No profiles yet'}
          </h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs">
            {searchQuery
              ? 'Try a different search term'
              : 'Add your first customer or supplier to start tracking.'}
          </p>
          {!searchQuery && (
            <Button
              onClick={() => {
                setNewProfile({ name: '', phone: '', type: 'Customer', openingBalance: 0 })
                setAddProfileOpen(true)
              }}
              className="mt-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white transition-all duration-200 active:scale-[0.97] shadow-md hover:shadow-lg"
              disabled={!canCreate}
            >
              <Plus className="size-4 mr-2" />
              Add Profile
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProfiles.map((profile) => {
            const lastTxnDate = getLastTxnDate(profile)
            return (
              <Card
                key={profile.id}
                className="cursor-pointer transition-all py-0 gap-0 overflow-hidden border-0 shadow-sm hover-lift gradient-border"
                onClick={() => handleOpenProfile(profile)}
              >
                {/* Gradient top bar based on type */}
                <div
                  className={`h-1.5 ${
                    profile.type === 'Customer'
                      ? 'bg-gradient-to-r from-emerald-400 to-teal-600'
                      : 'bg-gradient-to-r from-pink-400 to-pink-600'
                  }`}
                />
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div
              className={`flex size-10 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white shadow-sm bg-gradient-to-br ${getAvatarGradient(profile.name)}`}
                    >
                      {profile.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-sm truncate">{profile.name}</p>
                        <Badge
                          variant="secondary"
                          className={`text-[10px] shrink-0 ${
                            profile.type === 'Customer'
                              ? 'bg-emerald-50 text-emerald-700 dark:text-emerald-300 border-emerald-100 dark:border-emerald-800'
                              : 'bg-pink-50 text-pink-700 border-pink-100'
                          }`}
                        >
                          {profile.type}
                        </Badge>
                      </div>
                      {profile.phone && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate flex items-center gap-1">
                          <Phone className="size-3" />
                          {profile.phone}
                        </p>
                      )}
                      <div className="flex items-center justify-between mt-2.5">
                        <p
                          className={`text-sm font-bold tabular-nums ${
                            profile.balance > 0 ? 'text-green-600 dark:text-green-400' : profile.balance < 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'
                          }`}
                        >
                          {profile.balance < 0 ? '-' : profile.balance > 0 ? '+' : ''}₹{Math.abs(profile.balance).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                        </p>
                        {lastTxnDate && (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                            <CalendarDays className="size-3" />
                            {formatDate(lastTxnDate)}
                          </span>
                        )}
                      </div>
                      {/* Balance indicator bar */}
                      <div className="mt-2 flex items-center gap-1.5">
                        <div className={`h-1 flex-1 rounded-full ${profile.balance > 0 ? 'bg-green-200 dark:bg-green-800' : profile.balance < 0 ? 'bg-red-200 dark:bg-red-800' : 'bg-muted'}`}>
                          <div
                            className={`h-full rounded-full transition-all ${
                              profile.balance > 0 ? 'bg-green-500' : profile.balance < 0 ? 'bg-red-500' : 'bg-muted-foreground/30'
                            }`}
                            style={{ width: `${Math.min(Math.abs(profile.balance) / Math.max(totalReceivable, totalPayable, 1) * 100, 100)}%` }}
                          />
                        </div>
                        <span className={`text-[10px] font-medium shrink-0 ${profile.balance > 0 ? 'text-green-500' : profile.balance < 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
                          {profile.balance > 0 ? 'Due' : profile.balance < 0 ? 'Owed' : 'Clear'}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Add Profile Dialog */}
      <Dialog open={addProfileOpen} onOpenChange={setAddProfileOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Profile</DialogTitle>
            <DialogDescription>Create a new ledger profile (Customer or Supplier)</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="profile-name">Name *</Label>
              <Input
                id="profile-name"
                placeholder="Enter name"
                value={newProfile.name}
                onChange={(e) => setNewProfile({ ...newProfile, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-phone">Phone</Label>
              <Input
                id="profile-phone"
                placeholder="Enter phone number"
                value={newProfile.phone}
                onChange={(e) => setNewProfile({ ...newProfile, phone: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <RadioGroup
                value={newProfile.type}
                onValueChange={(v) =>
                  setNewProfile({ ...newProfile, type: v as 'Customer' | 'Supplier' })
                }
                className="flex gap-4"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="Customer" id="type-customer" />
                  <Label htmlFor="type-customer" className="cursor-pointer">
                    Customer
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="Supplier" id="type-supplier" />
                  <Label htmlFor="type-supplier" className="cursor-pointer">
                    Supplier
                  </Label>
                </div>
              </RadioGroup>
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-balance">Opening Balance (₹)</Label>
              <Input
                id="profile-balance"
                type="number"
                placeholder="0"
                value={newProfile.openingBalance || ''}
                onChange={(e) =>
                  setNewProfile({ ...newProfile, openingBalance: parseFloat(e.target.value) || 0 })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddProfileOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateProfile}
              disabled={submittingProfile || !newProfile.name.trim()}
              style={{ backgroundColor: '#4CAF50', color: 'white' }}
            >
              {submittingProfile && <Loader2 className="size-4 animate-spin" />}
              Create Profile
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
