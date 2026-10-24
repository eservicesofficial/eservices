'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  BookOpen, Plus, Search, ArrowLeft, Trash2, Phone, UserCircle, TrendingUp,
  TrendingDown, Scale, Loader2, Wallet, FileText, CalendarDays, Clock,
  ArrowDownLeft, ArrowUpRight, Users, Receipt, CreditCard, Tag, StickyNote,
  FileUp, Download, Printer, GitBranch, History, ChevronRight, AlertTriangle,
  CheckCircle, XCircle, ArrowRightLeft, Split, Percent, LogOut, Shield,
  Crown, Star, Eye, EyeOff, Copy, Filter, SortAsc, SortDesc, RefreshCw,
  MoreVertical, Edit3, Archive, Undo2, Lock, Unlock, IndianRupee,
  Briefcase, Building2, UserCheck, BadgeCheck, Activity, FileSearch,
  ChevronDown, Upload, Send, MessageSquare, AlertCircle, Info, Zap,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { notify } from '@/lib/notification-store'
import { useAuth } from '@/components/auth-provider'
import ReadOnlyBanner from '@/components/read-only-banner'

// ─── Types ───
interface Customer {
  id: string; unitCode: string; customerId: string; primaryFolioId: string
  fullName: string; mobile: string; whatsapp: string; email: string
  customerType: string; creditLimit: number; internalNotes: string; status: string
  gstNumber: string; panNumber: string; aadhaarNumber: string; openingBalance: number
  balance: number; totalVisits: number; lastTxnDate: string; tags: CustomerTagAssignment[]
  createdAt: string; updatedAt: string
}

interface Folio { id: string; folioId: string; customerId: string; visitNumber: number; status: string; lockedAt: string | null }

interface LedgerEntry {
  id: string; folioId: string; customerId: string; date: string; docNo: string; invoiceNo: string
  type: string; description: string; debit: number; credit: number; tax: number
  discount: number; balance: number; userId: string; userName: string; status: string; createdAt: string
}

interface CustomerDocument { id: string; customerId: string; type: string; name: string; url: string; notes: string; createdAt: string }
interface CustomerNote { id: string; customerId: string; type: string; content: string; isPrivate: boolean; userId: string; userName: string; createdAt: string }
interface CustomerTagAssignment { id: string; customerId: string; tagName: string }
interface CustomerVisit { id: string; visitNumber: number; checkInAt: string; checkOutAt: string | null }
interface FolioAuditLog { id: string; action: string; target: string; details: string; userId: string; userName: string; ipAddress: string; device: string; createdAt: string }
interface Settlement { id: string; amount: number; mode: string; reference: string; description: string; userName: string; createdAt: string }

interface CustomerDetail extends Customer {
  folios: Folio[]; ledgerEntries: LedgerEntry[]; documents: CustomerDocument[]
  notes: CustomerNote[]; visits: CustomerVisit[]; settlements: Settlement[]
  auditLogs: FolioAuditLog[]; lifetimeRevenue: number; lifetimePayments: number
  lifetimeRefunds: number; totalBills: number; totalTransactions: number
  lastVisitDate: string; lastCheckoutDate: string; activeFolio: Folio | null
}

// ─── Helpers ───
const fmtCur = (v: number) => `₹${Math.abs(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
const fmtDate = (s: string) => { if (!s) return '—'; try { const d = new Date(s); return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}` } catch { return s } }
const fmtDateTime = (s: string) => { if (!s) return '—'; try { const d = new Date(s); return `${fmtDate(s)} ${d.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}` } catch { return s } }
const relTime = (s: string) => {
  if (!s) return ''; const n = new Date(); const d = new Date(s); const ms = n.getTime()-d.getTime(); const m = Math.floor(ms/60000); const h = Math.floor(m/60); const dy = Math.floor(h/24)
  if (m < 1) return 'Just now'; if (m < 60) return `${m}m ago`; if (h < 24) return `${h}h ago`; if (dy < 7) return `${dy}d ago`; return fmtDate(s)
}

function getAvatarGrad(name: string): string {
  const g = ['from-emerald-400 to-teal-500','from-teal-400 to-cyan-500','from-green-400 to-emerald-600','from-cyan-400 to-green-500','from-emerald-500 to-green-600']
  let h = 0; for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h); return g[Math.abs(h) % g.length]
}

const TYPE_BADGE: Record<string, string> = {
  Retail: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  Wholesale: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
  Supplier: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400',
  Corporate: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400',
  VIP: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400',
}

const STATUS_BADGE: Record<string, string> = {
  Active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400',
  Settled: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-400',
  CheckedOut: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  Archived: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
}

const TAG_COLORS: Record<string, string> = {
  VIP: 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400',
  Premium: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400',
  Regular: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400',
  Wholesale: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400',
  Supplier: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400',
  'High Risk': 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400',
  Blocked: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400',
}

const ALL_TAGS = ['VIP', 'Premium', 'Regular', 'Wholesale', 'Supplier', 'High Risk', 'Blocked']
const FILTER_TABS = ['All', 'Active', 'Due', 'Settled', 'CheckedOut', 'Archived', 'VIP']

// ─── Component ───
interface Props { onRefreshData: () => void; dataVersion?: number }
export default function CustomerFolioSection({ onRefreshData, dataVersion }: Props) {
  const { token, hasPermission, currentUser } = useAuth()
  const hdr: Record<string, string> = token ? { 'Authorization': `Bearer ${token}` } : {}
  const canAccess = hasPermission('khata', 'access')
  const canCreate = hasPermission('khata', 'create')
  const canEdit = hasPermission('khata', 'edit')
  const canDelete = hasPermission('khata', 'delete')
  const isAdmin = currentUser?.role === 'Admin' || currentUser?.role === 'SuperAdmin'

  // State: list view
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [filter, setFilter] = useState('All')
  const [sort, setSort] = useState('newest')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // State: detail view
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<CustomerDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')

  // Dialogs
  const [addOpen, setAddOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [chargeOpen, setChargeOpen] = useState(false)
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [refundOpen, setRefundOpen] = useState(false)
  const [transferOpen, setTransferOpen] = useState(false)
  const [discountOpen, setDiscountOpen] = useState(false)
  const [docOpen, setDocOpen] = useState(false)
  const [noteOpen, setNoteOpen] = useState(false)
  const [tagsOpen, setTagsOpen] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [statementOpen, setStatementOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [timelineOpen, setTimelineOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Form states
  const [form, setForm] = useState({ fullName: '', mobile: '', whatsapp: '', email: '', customerType: 'Retail', creditLimit: 0, internalNotes: '', gstNumber: '', panNumber: '', aadhaarNumber: '', openingBalance: 0 })
  const [chargeForm, setChargeForm] = useState({ description: '', amount: '', chargeType: 'Product', tax: '0', invoiceNo: '' })
  const [paymentForm, setPaymentForm] = useState({ amount: '', mode: 'Cash', reference: '', description: '' })
  const [refundForm, setRefundForm] = useState({ amount: '', reason: 'Partial Refund', description: '', invoiceNo: '' })
  const [transferForm, setTransferForm] = useState({ targetCustomerId: '', targetName: '', amount: '', description: '' })
  const [transferResults, setTransferResults] = useState<Customer[]>([])
  const [discountForm, setDiscountForm] = useState({ discountType: 'Fixed', amount: '', description: '', requiresApproval: false })
  const [docForm, setDocForm] = useState({ type: 'Aadhaar', name: '', url: '', notes: '' })
  const [noteForm, setNoteForm] = useState({ type: 'Internal', content: '' })
  const [stmtFrom, setStmtFrom] = useState('')
  const [stmtTo, setStmtTo] = useState('')
  const [stmtData, setStmtData] = useState<any>(null)
  const [stmtLoading, setStmtLoading] = useState(false)
  const [duplicate, setDuplicate] = useState<Customer | null>(null)
  const [customerTags, setCustomerTags] = useState<string[]>([])

  // Debounce search
  useEffect(() => { if (debounceRef.current) clearTimeout(debounceRef.current); debounceRef.current = setTimeout(() => setDebounced(search), 300); return () => { if (debounceRef.current) clearTimeout(debounceRef.current) } }, [search])

  // Fetch customers
  const fetchCustomers = useCallback(async (silent?: boolean) => {
    try { if (!silent) setLoading(true)
      const params = new URLSearchParams()
      if (filter !== 'All') params.set('status', filter === 'Due' ? 'Active' : filter)
      if (debounced) params.set('search', debounced)
      if (sort) params.set('sort', sort)
      if (filter === 'VIP') params.set('tag', 'VIP')
      if (filter === 'Due') params.set('hasDue', 'true')
      const res = await fetch(`/api/folio/customers?${params}`, { headers: hdr })
      if (res.ok) {
        const data = await res.json()
        // API returns { customers: [...], pagination: {...} } — extract the array
        const list = Array.isArray(data) ? data : (data.customers || [])
        setCustomers(list.map((c: any) => ({
          ...c,
          balance: c.balance ?? c.currentBalance ?? 0,
          lastTxnDate: c.lastTxnDate ?? c.lastTransactionDate ?? '',
          tags: Array.isArray(c.tags) ? c.tags : [],
        })))
      }
    } catch { } finally { setLoading(false) }
  }, [debounced, filter, sort])

  useEffect(() => { fetchCustomers() }, [fetchCustomers])
  const prevDataVer = useRef(dataVersion)
  useEffect(() => { if (dataVersion !== undefined && dataVersion !== prevDataVer.current) { prevDataVer.current = dataVersion; fetchCustomers(true); if (selectedId) fetchDetail(selectedId, true) } }, [dataVersion])

  // Fetch customer detail
  const fetchDetail = useCallback(async (id: string, silent?: boolean) => {
    try { if (!silent) setDetailLoading(true)
      const res = await fetch(`/api/folio/customers/${id}`, { headers: hdr })
      if (res.ok) {
        const d = await res.json()
        // API returns nested: { customer, activeFolio, folios, documents, notes, visits, settlements, tags: string[], lifetimeStats }
        // Transform into flat CustomerDetail format that the component expects
        const customer = d.customer || d
        const activeFolio = d.activeFolio
        const lifetimeStats = d.lifetimeStats || {}

        // Build tags as CustomerTagAssignment objects from string[]
        const tagAssignments: CustomerTagAssignment[] = Array.isArray(d.tags)
          ? d.tags.map((tagName: string, i: number) => ({ id: `tag-${i}`, customerId: customer.id, tagName }))
          : []

        // Get active folio ledger entries
        const ledgerEntries: LedgerEntry[] = activeFolio?.ledgerEntries || []

        // Compute balance from last ledger entry or lifetime stats
        const balance = lifetimeStats.currentBalance ??
          (ledgerEntries.length > 0 ? ledgerEntries[ledgerEntries.length - 1].balance : customer.openingBalance ?? 0)

        const detailObj: CustomerDetail = {
          ...customer,
          balance,
          totalVisits: d.visits?.length ?? lifetimeStats.totalVisits ?? 0,
          lastTxnDate: lifetimeStats.lastTransactionDate || '',
          tags: tagAssignments,
          folios: d.folios || [],
          ledgerEntries,
          documents: d.documents || [],
          notes: d.notes || [],
          visits: d.visits || [],
          settlements: d.settlements || [],
          auditLogs: [],
          lifetimeRevenue: lifetimeStats.totalCharges ?? 0,
          lifetimePayments: lifetimeStats.totalPayments ?? 0,
          lifetimeRefunds: lifetimeStats.totalRefunds ?? 0,
          totalBills: 0,
          totalTransactions: ledgerEntries.length,
          lastVisitDate: d.visits?.[0]?.checkInAt || '',
          lastCheckoutDate: '',
          activeFolio: activeFolio ? {
            id: activeFolio.id,
            folioId: activeFolio.folioId,
            customerId: customer.id,
            visitNumber: activeFolio.visitNumber,
            status: activeFolio.status,
            lockedAt: activeFolio.lockedAt || null,
          } : null,
        }

        setDetail(detailObj)
        setCustomerTags(tagAssignments.map(t => t.tagName))
      }
    } catch { } finally { setDetailLoading(false) }
  }, [])

  // Migrate legacy data
  const migrateLegacy = useCallback(async () => {
    try { setSubmitting(true)
      const res = await fetch('/api/folio/migrate', { method: 'POST', headers: { ...hdr, 'Content-Type': 'application/json' }, body: JSON.stringify({ dryRun: false }) })
      if (res.ok) { const d = await res.json(); notify({ type: 'success', title: 'Migration Complete', message: `Migrated ${d.migrated} customers` }); fetchCustomers() }
      else { const e = await res.json(); notify({ type: 'info', title: 'Migration', message: e.message || e.error || 'No legacy data to migrate' }) }
    } catch { notify({ type: 'error', title: 'Error', message: 'Migration failed' }) } finally { setSubmitting(false) }
  }, [])

  // Open customer
  const openCustomer = (id: string) => { setSelectedId(id); setActiveTab('overview'); fetchDetail(id) }
  const goBack = () => { setSelectedId(null); setDetail(null); setActiveTab('overview') }

  // Create customer
  const handleCreate = async () => {
    if (!form.fullName.trim() || !form.mobile.trim()) { notify({ type: 'error', title: 'Error', message: 'Name and Mobile are required' }); return }
    try { setSubmitting(true)
      const res = await fetch('/api/folio/customers', { method: 'POST', headers: { ...hdr, 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      if (res.ok) { notify({ type: 'success', title: 'Customer Created', message: 'New customer profile added' }); setAddOpen(false); resetForm(); fetchCustomers(); onRefreshData() }
      else { const e = await res.json(); if (e.duplicate) { setDuplicate(e.duplicate); notify({ type: 'warning', title: 'Duplicate Found', message: 'A customer with similar details exists' }) } else { notify({ type: 'error', title: 'Error', message: e.error || 'Failed to create' }) } }
    } catch { notify({ type: 'error', title: 'Error', message: 'Failed to create customer' }) } finally { setSubmitting(false) }
  }

  // Update customer
  const handleUpdate = async () => {
    if (!detail || !form.fullName.trim()) return
    try { setSubmitting(true)
      const res = await fetch(`/api/folio/customers/${detail.id}`, { method: 'PUT', headers: { ...hdr, 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      if (res.ok) { notify({ type: 'success', title: 'Updated', message: 'Customer profile updated' }); setEditOpen(false); fetchDetail(detail.id); fetchCustomers(true) }
      else { const e = await res.json(); notify({ type: 'error', title: 'Error', message: e.error || 'Update failed' }) }
    } catch { notify({ type: 'error', title: 'Error', message: 'Update failed' }) } finally { setSubmitting(false) }
  }

  // Add ledger entry (charge/payment/refund/discount)
  const addLedgerEntry = async (type: string, data: any) => {
    if (!detail) return
    try { setSubmitting(true)
      const res = await fetch(`/api/folio/customers/${detail.id}/ledger`, { method: 'POST', headers: { ...hdr, 'Content-Type': 'application/json' }, body: JSON.stringify({ type, ...data }) })
      if (res.ok) { notify({ type: 'success', title: 'Entry Added', message: `${type} recorded successfully` }); closeDialogs(); fetchDetail(detail.id); fetchCustomers(true); onRefreshData() }
      else { const e = await res.json(); notify({ type: 'error', title: 'Error', message: e.error || 'Failed to add entry' }) }
    } catch { notify({ type: 'error', title: 'Error', message: 'Failed to add entry' }) } finally { setSubmitting(false) }
  }

  const handleCharge = () => { if (!chargeForm.amount || !chargeForm.description) { notify({ type: 'error', title: 'Error', message: 'Amount and description required' }); return } addLedgerEntry('Charge', { description: chargeForm.description, amount: parseFloat(chargeForm.amount), tax: parseFloat(chargeForm.tax) || 0, invoiceNo: chargeForm.invoiceNo }) }
  const handlePayment = () => { if (!paymentForm.amount) { notify({ type: 'error', title: 'Error', message: 'Amount required' }); return } addLedgerEntry('Payment', { description: paymentForm.description || `Payment via ${paymentForm.mode}`, amount: parseFloat(paymentForm.amount), paymentMode: paymentForm.mode, reference: paymentForm.reference }) }
  const handleRefund = () => { if (!refundForm.amount || !refundForm.description) { notify({ type: 'error', title: 'Error', message: 'Amount and reason required' }); return } addLedgerEntry('Refund', { description: `${refundForm.reason}: ${refundForm.description}`, amount: parseFloat(refundForm.amount), invoiceNo: refundForm.invoiceNo }) }
  const handleDiscount = () => { if (!discountForm.amount) { notify({ type: 'error', title: 'Error', message: 'Amount required' }); return } const amt = discountForm.discountType === 'Percentage' ? parseFloat(discountForm.amount) : parseFloat(discountForm.amount); addLedgerEntry('Discount', { description: discountForm.description || 'Discount applied', amount: amt, discountType: discountForm.discountType }) }

  // Transfer
  const handleTransfer = async () => {
    if (!detail || !transferForm.targetCustomerId || !transferForm.amount) { notify({ type: 'error', title: 'Error', message: 'Target customer and amount required' }); return }
    try { setSubmitting(true)
      const res = await fetch(`/api/folio/customers/${detail.id}/transfer`, { method: 'POST', headers: { ...hdr, 'Content-Type': 'application/json' }, body: JSON.stringify({ targetCustomerId: transferForm.targetCustomerId, amount: parseFloat(transferForm.amount), description: transferForm.description }) })
      if (res.ok) { notify({ type: 'success', title: 'Transfer Complete', message: 'Balance transferred successfully' }); closeDialogs(); fetchDetail(detail.id); fetchCustomers(true); onRefreshData() }
      else { const e = await res.json(); notify({ type: 'error', title: 'Error', message: e.error || 'Transfer failed' }) }
    } catch { notify({ type: 'error', title: 'Error', message: 'Transfer failed' }) } finally { setSubmitting(false) }
  }

  // Search transfer targets
  const searchTransferTargets = async (q: string) => {
    if (q.length < 2) { setTransferResults([]); return }
    try { const res = await fetch(`/api/folio/customers?search=${encodeURIComponent(q)}&limit=10`, { headers: hdr }); if (res.ok) { const data = await res.json(); const list = Array.isArray(data) ? data : (data.customers || []); setTransferResults(list.filter((c: Customer) => c.id !== detail?.id)) } } catch { }
  }

  // Settlement
  const handleSettle = async () => {
    if (!detail || !paymentForm.amount) return
    try { setSubmitting(true)
      const res = await fetch(`/api/folio/customers/${detail.id}/settle`, { method: 'POST', headers: { ...hdr, 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: parseFloat(paymentForm.amount), mode: paymentForm.mode, reference: paymentForm.reference, description: paymentForm.description }) })
      if (res.ok) { notify({ type: 'success', title: 'Settlement Complete', message: 'Folio settled successfully' }); closeDialogs(); fetchDetail(detail.id); fetchCustomers(true); onRefreshData() }
      else { const e = await res.json(); notify({ type: 'error', title: 'Error', message: e.error || 'Settlement failed' }) }
    } catch { notify({ type: 'error', title: 'Error', message: 'Settlement failed' }) } finally { setSubmitting(false) }
  }

  // Checkout
  const handleCheckout = async () => {
    if (!detail) return
    try { setSubmitting(true)
      const res = await fetch(`/api/folio/customers/${detail.id}/checkout`, { method: 'POST', headers: { ...hdr, 'Content-Type': 'application/json' } })
      if (res.ok) { notify({ type: 'success', title: 'Checkout Complete', message: 'Customer checked out' }); setCheckoutOpen(false); fetchDetail(detail.id); fetchCustomers(true); onRefreshData() }
      else { const e = await res.json(); notify({ type: 'error', title: 'Error', message: e.error || 'Checkout failed' }) }
    } catch { notify({ type: 'error', title: 'Error', message: 'Checkout failed' }) } finally { setSubmitting(false) }
  }

  // Reopen
  const handleReopen = async () => {
    if (!detail) return
    try { setSubmitting(true)
      const res = await fetch(`/api/folio/customers/${detail.id}/reopen`, { method: 'POST', headers: { ...hdr, 'Content-Type': 'application/json' } })
      if (res.ok) { notify({ type: 'success', title: 'Reopened', message: 'Customer folio reopened with new visit' }); fetchDetail(detail.id); fetchCustomers(true) }
      else { const e = await res.json(); notify({ type: 'error', title: 'Error', message: e.error || 'Failed to reopen' }) }
    } catch { } finally { setSubmitting(false) }
  }

  // Documents
  const handleAddDoc = async () => {
    if (!detail || !docForm.name) { notify({ type: 'error', title: 'Error', message: 'Document name required' }); return }
    try { setSubmitting(true)
      const res = await fetch(`/api/folio/customers/${detail.id}/documents`, { method: 'POST', headers: { ...hdr, 'Content-Type': 'application/json' }, body: JSON.stringify(docForm) })
      if (res.ok) { notify({ type: 'success', title: 'Document Added', message: 'Document added successfully' }); setDocOpen(false); setDocForm({ type: 'Aadhaar', name: '', url: '', notes: '' }); fetchDetail(detail.id) }
      else { notify({ type: 'error', title: 'Error', message: 'Failed to add document' }) }
    } catch { } finally { setSubmitting(false) }
  }

  const handleDeleteDoc = async (docId: string) => {
    if (!detail) return
    try { await fetch(`/api/folio/customers/${detail.id}/documents/${docId}`, { method: 'DELETE', headers: hdr }); notify({ type: 'success', title: 'Deleted', message: 'Document removed' }); fetchDetail(detail.id) } catch { }
  }

  // Notes
  const handleAddNote = async () => {
    if (!detail || !noteForm.content) { notify({ type: 'error', title: 'Error', message: 'Note content required' }); return }
    try { setSubmitting(true)
      const res = await fetch(`/api/folio/customers/${detail.id}/notes`, { method: 'POST', headers: { ...hdr, 'Content-Type': 'application/json' }, body: JSON.stringify(noteForm) })
      if (res.ok) { notify({ type: 'success', title: 'Note Added', message: 'Note added successfully' }); setNoteOpen(false); setNoteForm({ type: 'Internal', content: '' }); fetchDetail(detail.id) }
      else { notify({ type: 'error', title: 'Error', message: 'Failed to add note' }) }
    } catch { } finally { setSubmitting(false) }
  }

  const handleDeleteNote = async (noteId: string) => {
    if (!detail) return
    try { await fetch(`/api/folio/customers/${detail.id}/notes/${noteId}`, { method: 'DELETE', headers: hdr }); notify({ type: 'success', title: 'Deleted', message: 'Note removed' }); fetchDetail(detail.id) } catch { }
  }

  // Tags
  const handleToggleTag = async (tagName: string) => {
    if (!detail) return
    const has = customerTags.includes(tagName)
    try {
      if (has) { await fetch(`/api/folio/customers/${detail.id}/tags?tagName=${encodeURIComponent(tagName)}`, { method: 'DELETE', headers: hdr }); setCustomerTags(prev => prev.filter(t => t !== tagName)) }
      else { await fetch(`/api/folio/customers/${detail.id}/tags`, { method: 'POST', headers: { ...hdr, 'Content-Type': 'application/json' }, body: JSON.stringify({ tagName }) }); setCustomerTags(prev => [...prev, tagName]) }
      fetchDetail(detail.id, true); fetchCustomers(true)
    } catch { }
  }

  // Delete customer (archive)
  const handleDelete = async () => {
    if (!detail) return
    try { setSubmitting(true)
      const res = await fetch(`/api/folio/customers/${detail.id}`, { method: 'DELETE', headers: hdr })
      if (res.ok) { notify({ type: 'success', title: 'Archived', message: 'Customer archived' }); setDeleteOpen(false); goBack(); fetchCustomers(); onRefreshData() }
      else { notify({ type: 'error', title: 'Error', message: 'Failed to archive' }) }
    } catch { } finally { setSubmitting(false) }
  }

  // Statement
  const fetchStatement = async () => {
    if (!detail) return
    try { setStmtLoading(true)
      const params = new URLSearchParams()
      if (stmtFrom) params.set('from', stmtFrom)
      if (stmtTo) params.set('to', stmtTo)
      const res = await fetch(`/api/folio/customers/${detail.id}/statement?${params}`, { headers: hdr })
      if (res.ok) setStmtData(await res.json()); else notify({ type: 'error', title: 'Error', message: 'Failed to load statement' })
    } catch { } finally { setStmtLoading(false) }
  }

  // Helpers
  const resetForm = () => setForm({ fullName: '', mobile: '', whatsapp: '', email: '', customerType: 'Retail', creditLimit: 0, internalNotes: '', gstNumber: '', panNumber: '', aadhaarNumber: '', openingBalance: 0 })
  const closeDialogs = () => { setChargeOpen(false); setPaymentOpen(false); setRefundOpen(false); setTransferOpen(false); setDiscountOpen(false); setChargeForm({ description: '', amount: '', chargeType: 'Product', tax: '0', invoiceNo: '' }); setPaymentForm({ amount: '', mode: 'Cash', reference: '', description: '' }); setRefundForm({ amount: '', reason: 'Partial Refund', description: '', invoiceNo: '' }); setTransferForm({ targetCustomerId: '', targetName: '', amount: '', description: '' }); setDiscountForm({ discountType: 'Fixed', amount: '', description: '', requiresApproval: false }) }
  const populateEditForm = () => { if (!detail) return; setForm({ fullName: detail.fullName, mobile: detail.mobile, whatsapp: detail.whatsapp, email: detail.email, customerType: detail.customerType, creditLimit: detail.creditLimit, internalNotes: detail.internalNotes, gstNumber: detail.gstNumber, panNumber: detail.panNumber, aadhaarNumber: detail.aadhaarNumber, openingBalance: detail.openingBalance }) }

  // Computed
  const totalOutstanding = customers.reduce((s, c) => s + (c.balance > 0 ? c.balance : 0), 0)
  const filteredCustomers = customers
  const activeCount = customers.filter(c => c.status === 'Active').length
  const dueCount = customers.filter(c => c.status === 'Active' && c.balance > 0).length
  const settledCount = customers.filter(c => c.status === 'Settled').length
  const checkedOutCount = customers.filter(c => c.status === 'CheckedOut').length

  // Print statement
  const printStatement = () => {
    if (!detail || !stmtData) return
    const w = window.open('', '_blank'); if (!w) { notify({ type: 'error', title: 'Error', message: 'Allow popups to print' }); return }
    const entries = (stmtData.entries || []).map((e: LedgerEntry, i: number) => `<tr style="background:${i%2===0?'#fff':'#fafafa'}"><td style="padding:8px 12px;font-size:12px;border-bottom:1px solid #eee">${i+1}</td><td style="padding:8px 12px;font-size:12px;border-bottom:1px solid #eee">${fmtDate(e.date)}</td><td style="padding:8px 12px;font-size:12px;border-bottom:1px solid #eee">${e.type}</td><td style="padding:8px 12px;font-size:12px;border-bottom:1px solid #eee">${e.description}</td><td style="padding:8px 12px;font-size:12px;text-align:right;border-bottom:1px solid #eee;color:#dc2626">${e.debit>0?'-₹'+e.debit.toLocaleString('en-IN'):''}</td><td style="padding:8px 12px;font-size:12px;text-align:right;border-bottom:1px solid #eee;color:#059669">${e.credit>0?'+₹'+e.credit.toLocaleString('en-IN'):''}</td><td style="padding:8px 12px;font-size:12px;text-align:right;font-weight:700;border-bottom:1px solid #eee;color:${e.balance>=0?'#059669':'#dc2626'}">${fmtCur(e.balance)}</td></tr>`).join('')
    w.document.write(`<!DOCTYPE html><html><head><title>Statement - ${detail.fullName}</title><style>body{font-family:system-ui;padding:20px}table{width:100%;border-collapse:collapse;margin-top:16px}th{background:#f3f4f6;padding:10px;font-size:11px;text-transform:uppercase;letter-spacing:.5px;border-bottom:2px solid #e5e7eb}</style></head><body><h2>Customer Statement</h2><p><strong>${detail.fullName}</strong> | ${detail.customerId} | ${detail.mobile}</p><p>Period: ${stmtFrom||'Beginning'} to ${stmtTo||'Today'}</p><table><tr><th>#</th><th>Date</th><th>Type</th><th>Description</th><th>Debit</th><th>Credit</th><th>Balance</th></tr>${entries}</table><p style="margin-top:20px">Opening: ${fmtCur(stmtData.openingBalance)} | Total Debits: ${fmtCur(stmtData.totalDebits)} | Total Credits: ${fmtCur(stmtData.totalCredits)} | Closing: ${fmtCur(stmtData.closingBalance)}</p><p style="color:#999;font-size:11px;margin-top:30px">Generated by Eservices</p></body></html>`)
    w.document.close(); w.print()
  }

  // ─── DETAIL VIEW LOADING ───
  if (selectedId && detailLoading && !detail) {
    return (
      <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
        <Loader2 className="size-8 animate-spin text-emerald-500 mb-3" />
        <p className="text-sm text-muted-foreground">Loading customer details...</p>
      </div>
    )
  }

  // ─── DETAIL VIEW ───
  if (selectedId && detail) {
    const bal = detail?.balance ?? 0
    const detailCreditLimit = detail?.creditLimit ?? 0
    const creditPct = detailCreditLimit > 0 ? Math.min(Math.round((Math.abs(bal) / detailCreditLimit) * 100), 100) : 0

    return (
      <div className="space-y-4 animate-fade-in">
        {!canAccess && <ReadOnlyBanner module="Customer Folio" noAccess />}
        {/* Back Button */}
        <Button variant="ghost" size="sm" onClick={goBack} className="gap-2"><ArrowLeft className="size-4" /> Back to All Customers</Button>

        {/* Customer Header */}
        <Card className="overflow-hidden border-0 shadow-md">
          <div className="h-2 bg-gradient-to-r from-emerald-400 via-teal-500 to-cyan-500" />
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className={`flex size-16 shrink-0 items-center justify-center rounded-full text-2xl font-bold text-white shadow-lg bg-gradient-to-br ${getAvatarGrad(detail.fullName)}`}>{detail.fullName.charAt(0).toUpperCase()}</div>
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-bold truncate">{detail.fullName}</h2>
                  <Badge variant="outline" className="text-[10px] font-mono">{detail.customerId}</Badge>
                  <Badge variant="outline" className="text-[10px] font-mono">{detail.primaryFolioId}</Badge>
                  <Badge className={STATUS_BADGE[detail.status] || ''}>{detail.status}</Badge>
                  <Badge className={TYPE_BADGE[detail.customerType] || TYPE_BADGE.Retail}>{detail.customerType}</Badge>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  {detail.mobile && <span className="flex items-center gap-1"><Phone className="size-3" />{detail.mobile}</span>}
                  {detail.whatsapp && <span className="flex items-center gap-1"><MessageSquare className="size-3" />{detail.whatsapp}</span>}
                  {detail.email && <span className="flex items-center gap-1"><Receipt className="size-3" />{detail.email}</span>}
                </div>
                <div className="flex flex-wrap gap-1">{detail.tags?.map(t => <span key={t.id} className={`text-[10px] px-2 py-0.5 rounded-full border ${TAG_COLORS[t.tagName] || TAG_COLORS.Regular}`}>{t.tagName}</span>)}</div>
              </div>
              <div className="text-left sm:text-right shrink-0">
                <p className="text-xs text-muted-foreground">Current Balance</p>
                <p className={`text-2xl font-bold tabular-nums ${bal > 0 ? 'text-green-600 dark:text-green-400' : bal < 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>{bal < 0 ? '-' : bal > 0 ? '+' : ''}{fmtCur(bal)}</p>
                <p className={`text-xs ${bal > 0 ? 'text-green-500' : bal < 0 ? 'text-red-500' : 'text-muted-foreground'}`}>{bal > 0 ? '↑ They owe you' : bal < 0 ? '↓ Advance balance' : '✓ Settled'}</p>
                {detail.creditLimit > 0 && <div className="mt-2"><Progress value={creditPct} className="h-1.5 w-32" /><p className="text-[10px] text-muted-foreground mt-0.5">Credit: {fmtCur(bal)}/{fmtCur(detail.creditLimit)}</p></div>}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t">
              <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => { populateEditForm(); setEditOpen(true) }}><Edit3 className="size-3" />Edit</Button>
              <Button size="sm" className="gap-1 text-xs bg-emerald-600 hover:bg-emerald-700" onClick={() => setChargeOpen(true)}><Plus className="size-3" />Charge</Button>
              <Button size="sm" className="gap-1 text-xs bg-teal-600 hover:bg-teal-700" onClick={() => setPaymentOpen(true)}><Wallet className="size-3" />Payment</Button>
              <Button size="sm" variant="outline" className="gap-1 text-xs text-red-600 border-red-200 hover:bg-red-50" onClick={() => setRefundOpen(true)}><Undo2 className="size-3" />Refund</Button>
              <Button size="sm" variant="outline" className="gap-1 text-xs text-amber-600 border-amber-200 hover:bg-amber-50" onClick={() => setDiscountOpen(true)}><Percent className="size-3" />Discount</Button>
              <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => setTransferOpen(true)}><ArrowRightLeft className="size-3" />Transfer</Button>
              <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => setDocOpen(true)}><FileUp className="size-3" />Docs</Button>
              <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => setNoteOpen(true)}><StickyNote className="size-3" />Note</Button>
              <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => setTagsOpen(true)}><Tag className="size-3" />Tags</Button>
              {(detail.status === 'Active' || detail.status === 'Settled') && isAdmin && <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={handleSettle} disabled={!paymentForm.amount}><CheckCircle className="size-3" />Settle</Button>}
              {isAdmin && detail.status !== 'Active' && <Button size="sm" variant="outline" className="gap-1 text-xs text-teal-600 border-teal-200" onClick={handleReopen}><Undo2 className="size-3" />Reopen</Button>}
              <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => { setStmtFrom(''); setStmtTo(''); setStmtData(null); setStatementOpen(true) }}><Printer className="size-3" />Statement</Button>
              <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => setHistoryOpen(true)}><History className="size-3" />History</Button>
              <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => setTimelineOpen(true)}><GitBranch className="size-3" />Timeline</Button>
              {isAdmin && detail.status === 'Active' && <Button size="sm" variant="outline" className="gap-1 text-xs text-orange-600 border-orange-200" onClick={() => { if (detail) setCheckoutOpen(true) }}><LogOut className="size-3" />Checkout</Button>}
              {isAdmin && <Button size="sm" variant="outline" className="gap-1 text-xs text-red-500 border-red-200" onClick={() => setDeleteOpen(true)}><Trash2 className="size-3" />Archive</Button>}
            </div>
          </CardContent>
        </Card>

        {/* Main Content: Tabs + Overview Panel */}
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Tabs */}
          <div className="flex-1 min-w-0">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
                <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
                <TabsTrigger value="folio" className="text-xs">Current Folio</TabsTrigger>
                <TabsTrigger value="ledger" className="text-xs">Ledger</TabsTrigger>
                <TabsTrigger value="bills" className="text-xs">Bills</TabsTrigger>
                <TabsTrigger value="payments" className="text-xs">Payments</TabsTrigger>
                <TabsTrigger value="documents" className="text-xs">Documents</TabsTrigger>
                <TabsTrigger value="notes" className="text-xs">Notes</TabsTrigger>
                <TabsTrigger value="audit" className="text-xs">Audit</TabsTrigger>
              </TabsList>

              {/* Overview Tab */}
              <TabsContent value="overview" className="mt-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    { label: 'Customer Since', value: fmtDate(detail.createdAt), icon: CalendarDays },
                    { label: 'Status', value: detail.status, icon: BadgeCheck },
                    { label: 'Customer Type', value: detail.customerType, icon: Briefcase },
                    { label: 'Lifetime Revenue', value: fmtCur(detail.lifetimeRevenue || 0), icon: TrendingUp, color: 'text-green-600' },
                    { label: 'Lifetime Payments', value: fmtCur(detail.lifetimePayments || 0), icon: Wallet, color: 'text-teal-600' },
                    { label: 'Lifetime Refunds', value: fmtCur(detail.lifetimeRefunds || 0), icon: Undo2, color: 'text-red-500' },
                    { label: 'Total Bills', value: String(detail.totalBills || 0), icon: FileText },
                    { label: 'Total Transactions', value: String(detail.totalTransactions || detail.ledgerEntries?.length || 0), icon: Activity },
                    { label: 'Total Visits', value: String(detail.totalVisits || detail.visits?.length || 0), icon: Users },
                    { label: 'Outstanding', value: fmtCur(bal), icon: Scale, color: bal > 0 ? 'text-green-600' : bal < 0 ? 'text-red-500' : '' },
                    { label: 'Credit Limit', value: fmtCur(detail.creditLimit), icon: CreditCard },
                    { label: 'Last Activity', value: detail.ledgerEntries?.length > 0 ? relTime(detail.ledgerEntries[detail.ledgerEntries.length - 1].createdAt) : '—', icon: Clock },
                  ].map((item, i) => (
                    <Card key={i} className="border-0 shadow-sm"><CardContent className="p-3"><div className="flex items-center gap-2 mb-1"><item.icon className={`size-4 text-muted-foreground ${item.color || ''}`} /><span className="text-[10px] text-muted-foreground uppercase tracking-wider">{item.label}</span></div><p className={`text-sm font-bold tabular-nums ${item.color || ''}`}>{item.value}</p></CardContent></Card>
                  ))}
                </div>
              </TabsContent>

              {/* Current Folio Tab */}
              <TabsContent value="folio" className="mt-4">
                <Card className="border-0 shadow-sm">
                  <CardHeader className="pb-2 flex flex-row items-center justify-between">
                    <CardTitle className="text-sm">Current Folio — Visit #{detail.visits?.length || 1}</CardTitle>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => { setStmtFrom(''); setStmtTo(''); setStmtData(null); setStatementOpen(true) }}><Printer className="size-3" />Print</Button>
                      <Button size="sm" className="gap-1 text-xs bg-emerald-600 hover:bg-emerald-700" onClick={() => setChargeOpen(true)}><Plus className="size-3" />Add Entry</Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ScrollArea className="max-h-[500px]">
                      <Table>
                        <TableHeader><TableRow><TableHead className="w-8">#</TableHead><TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Debit</TableHead><TableHead className="text-right">Credit</TableHead><TableHead className="text-right">Balance</TableHead><TableHead className="w-8">Status</TableHead></TableRow></TableHeader>
                        <TableBody>
                          {!detail.ledgerEntries?.length ? <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground text-sm">No entries in current folio</TableCell></TableRow> :
                          detail.ledgerEntries.map((e, i) => (
                            <TableRow key={e.id}><TableCell className="text-xs text-muted-foreground">{i+1}</TableCell><TableCell className="text-xs whitespace-nowrap">{fmtDate(e.date)}</TableCell><TableCell><Badge variant="outline" className="text-[10px]">{e.type}</Badge></TableCell><TableCell className="text-xs max-w-[200px] truncate">{e.description || '—'}</TableCell><TableCell className={`text-xs text-right font-medium ${e.debit > 0 ? 'text-red-600' : 'text-muted-foreground'}`}>{e.debit > 0 ? fmtCur(e.debit) : '—'}</TableCell><TableCell className={`text-xs text-right font-medium ${e.credit > 0 ? 'text-green-600' : 'text-muted-foreground'}`}>{e.credit > 0 ? fmtCur(e.credit) : '—'}</TableCell><TableCell className={`text-xs text-right font-bold tabular-nums ${e.balance >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmtCur(e.balance)}</TableCell><TableCell><Badge variant={e.status === 'Active' ? 'default' : 'secondary'} className="text-[9px]">{e.status}</Badge></TableCell></TableRow>
                          ))
                          }
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Ledger Tab */}
              <TabsContent value="ledger" className="mt-4">
                <Card className="border-0 shadow-sm">
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Full Ledger History</CardTitle></CardHeader>
                  <CardContent className="p-0">
                    <ScrollArea className="max-h-[500px]">
                      <Table>
                        <TableHeader><TableRow><TableHead className="w-8">#</TableHead><TableHead>Date</TableHead><TableHead>Doc</TableHead><TableHead>Type</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Debit</TableHead><TableHead className="text-right">Credit</TableHead><TableHead className="text-right">Balance</TableHead></TableRow></TableHeader>
                        <TableBody>
                          {!detail.ledgerEntries?.length ? <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground text-sm">No ledger entries</TableCell></TableRow> :
                          detail.ledgerEntries.map((e, i) => (
                            <TableRow key={e.id}><TableCell className="text-xs text-muted-foreground">{i+1}</TableCell><TableCell className="text-xs">{fmtDate(e.date)}</TableCell><TableCell className="text-xs font-mono text-muted-foreground">{e.docNo || '—'}</TableCell><TableCell><Badge variant="outline" className="text-[10px]">{e.type}</Badge></TableCell><TableCell className="text-xs max-w-[150px] truncate">{e.description || '—'}</TableCell><TableCell className={`text-xs text-right font-medium ${e.debit > 0 ? 'text-red-600' : ''}`}>{e.debit > 0 ? fmtCur(e.debit) : '—'}</TableCell><TableCell className={`text-xs text-right font-medium ${e.credit > 0 ? 'text-green-600' : ''}`}>{e.credit > 0 ? fmtCur(e.credit) : '—'}</TableCell><TableCell className={`text-xs text-right font-bold tabular-nums ${e.balance >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmtCur(e.balance)}</TableCell></TableRow>
                          ))
                          }
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Bills Tab */}
              <TabsContent value="bills" className="mt-4">
                <Card className="border-0 shadow-sm">
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Linked Invoices</CardTitle></CardHeader>
                  <CardContent><p className="text-sm text-muted-foreground text-center py-10">Invoices linked by customer phone will appear here. Use Bill History for complete invoice management.</p></CardContent>
                </Card>
              </TabsContent>

              {/* Payments Tab */}
              <TabsContent value="payments" className="mt-4">
                <Card className="border-0 shadow-sm">
                  <CardHeader className="pb-2 flex flex-row items-center justify-between">
                    <CardTitle className="text-sm">Payment History</CardTitle>
                    <Badge variant="secondary">{detail.ledgerEntries?.filter(e => e.type === 'Payment').length || 0} payments</Badge>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ScrollArea className="max-h-[400px]">
                      {!detail.ledgerEntries?.filter(e => e.type === 'Payment').length ? <p className="text-sm text-muted-foreground text-center py-8">No payments recorded</p> :
                      <div className="divide-y">
                        {detail.ledgerEntries.filter(e => e.type === 'Payment').reverse().map(e => (
                          <div key={e.id} className="flex items-center gap-3 p-3">
                            <div className="flex size-8 rounded-full bg-green-100 dark:bg-green-900/30 items-center justify-center"><ArrowDownLeft className="size-4 text-green-600" /></div>
                            <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{e.description}</p><p className="text-xs text-muted-foreground">{fmtDateTime(e.createdAt)}{e.userName ? ` · ${e.userName}` : ''}</p></div>
                            <p className="text-sm font-bold text-green-600 tabular-nums">+{fmtCur(e.credit)}</p>
                          </div>
                        ))}
                      </div>
                      }
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Documents Tab */}
              <TabsContent value="documents" className="mt-4">
                <Card className="border-0 shadow-sm">
                  <CardHeader className="pb-2 flex flex-row items-center justify-between"><CardTitle className="text-sm">Documents</CardTitle><Button size="sm" className="gap-1 text-xs bg-emerald-600 hover:bg-emerald-700" onClick={() => setDocOpen(true)}><Upload className="size-3" />Upload</Button></CardHeader>
                  <CardContent>
                    {!detail.documents?.length ? <p className="text-sm text-muted-foreground text-center py-8">No documents uploaded</p> :
                    <div className="space-y-2">{detail.documents.map(d => (
                      <div key={d.id} className="flex items-center gap-3 p-3 rounded-lg border"><div className="flex size-8 rounded-lg bg-muted items-center justify-center"><FileText className="size-4 text-muted-foreground" /></div><div className="flex-1 min-w-0"><p className="text-sm font-medium">{d.name || d.type}</p><p className="text-xs text-muted-foreground">{d.type} · {fmtDate(d.createdAt)}{d.notes ? ` · ${d.notes}` : ''}</p></div>{canDelete && <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-600" onClick={() => handleDeleteDoc(d.id)}><Trash2 className="size-3" /></Button>}</div>
                    ))}</div>
                    }
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Notes Tab */}
              <TabsContent value="notes" className="mt-4">
                <Card className="border-0 shadow-sm">
                  <CardHeader className="pb-2 flex flex-row items-center justify-between"><CardTitle className="text-sm">Notes</CardTitle><Button size="sm" className="gap-1 text-xs bg-emerald-600 hover:bg-emerald-700" onClick={() => setNoteOpen(true)}><Plus className="size-3" />Add Note</Button></CardHeader>
                  <CardContent>
                    {!detail.notes?.length ? <p className="text-sm text-muted-foreground text-center py-8">No notes yet</p> :
                    <div className="space-y-2">{detail.notes.map(n => (
                      <div key={n.id} className="p-3 rounded-lg border"><div className="flex items-center justify-between mb-1"><Badge variant="outline" className="text-[10px]">{n.type}</Badge><div className="flex items-center gap-2"><span className="text-[10px] text-muted-foreground">{n.userName} · {relTime(n.createdAt)}</span>{isAdmin && <Button size="sm" variant="ghost" className="size-6 text-red-500" onClick={() => handleDeleteNote(n.id)}><Trash2 className="size-3" /></Button>}</div></div><p className="text-sm">{n.content}</p></div>
                    ))}</div>
                    }
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Audit Tab */}
              <TabsContent value="audit" className="mt-4">
                <Card className="border-0 shadow-sm">
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Audit Trail</CardTitle></CardHeader>
                  <CardContent className="p-0">
                    <ScrollArea className="max-h-[400px]">
                      {!detail.auditLogs?.length ? <p className="text-sm text-muted-foreground text-center py-8">No audit logs</p> :
                      <Table>
                        <TableHeader><TableRow><TableHead className="w-8">#</TableHead><TableHead>Date</TableHead><TableHead>Action</TableHead><TableHead>User</TableHead><TableHead>Target</TableHead></TableRow></TableHeader>
                        <TableBody>
                          {detail.auditLogs.map((a, i) => (
                            <TableRow key={a.id}><TableCell className="text-xs">{i+1}</TableCell><TableCell className="text-xs">{fmtDateTime(a.createdAt)}</TableCell><TableCell><Badge variant="outline" className="text-[10px]">{a.action}</Badge></TableCell><TableCell className="text-xs">{a.userName}</TableCell><TableCell className="text-xs text-muted-foreground truncate max-w-[200px]">{a.target || '—'}</TableCell></TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      }
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Overview Panel (Right Side) */}
          <div className="hidden lg:block w-72 shrink-0">
            <Card className="border-0 shadow-md sticky top-16">
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Eye className="size-4" />Overview</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: 'Customer Since', value: fmtDate(detail.createdAt) },
                  { label: 'Lifetime Revenue', value: fmtCur(detail.lifetimeRevenue || 0), color: 'text-green-600' },
                  { label: 'Lifetime Payments', value: fmtCur(detail.lifetimePayments || 0), color: 'text-teal-600' },
                  { label: 'Outstanding', value: fmtCur(bal), color: bal > 0 ? 'text-green-600' : bal < 0 ? 'text-red-500' : '' },
                  { label: 'Total Bills', value: String(detail.totalBills || 0) },
                  { label: 'Total Transactions', value: String(detail.ledgerEntries?.length || 0) },
                  { label: 'Total Visits', value: String(detail.visits?.length || 0) },
                  { label: 'Last Visit', value: detail.lastVisitDate ? relTime(detail.lastVisitDate) : '—' },
                  { label: 'Last Checkout', value: detail.lastCheckoutDate ? relTime(detail.lastCheckoutDate) : '—' },
                ].map((item, i) => (
                  <div key={i} className="flex justify-between items-center"><span className="text-xs text-muted-foreground">{item.label}</span><span className={`text-xs font-semibold tabular-nums ${item.color || ''}`}>{item.value}</span></div>
                ))}
                {detail.creditLimit > 0 && (
                  <div className="pt-2 border-t"><div className="flex justify-between text-xs mb-1"><span className="text-muted-foreground">Credit Limit</span><span className="font-semibold">{fmtCur(bal)}/{fmtCur(detail.creditLimit)}</span></div><Progress value={creditPct} className="h-1.5" /></div>
                )}
                <div className="pt-2 border-t"><p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Tags</p><div className="flex flex-wrap gap-1">{detail.tags?.length > 0 ? detail.tags.map(t => <span key={t.id} className={`text-[10px] px-2 py-0.5 rounded-full border ${TAG_COLORS[t.tagName] || TAG_COLORS.Regular}`}>{t.tagName}</span>) : <span className="text-xs text-muted-foreground">No tags</span>}</div></div>
                {detail.internalNotes && <div className="pt-2 border-t"><p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Internal Notes</p><p className="text-xs text-muted-foreground">{detail.internalNotes}</p></div>}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  // ─── LIST VIEW ───
  return (
    <div className="space-y-4 animate-fade-in">
      {!canAccess && <ReadOnlyBanner module="Customer Folio" noAccess />}
      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Total Customers', value: customers.length, icon: Users, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20' },
          { label: 'Active', value: activeCount, icon: UserCheck, color: 'text-green-600 bg-green-50 dark:bg-green-900/20' },
          { label: 'Due', value: dueCount, icon: AlertCircle, color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20' },
          { label: 'Settled', value: settledCount, icon: CheckCircle, color: 'text-teal-600 bg-teal-50 dark:bg-teal-900/20' },
          { label: 'Checked Out', value: checkedOutCount, icon: LogOut, color: 'text-gray-600 bg-gray-50 dark:bg-gray-800/50' },
          { label: 'Outstanding', value: fmtCur(totalOutstanding), icon: IndianRupee, color: 'text-red-600 bg-red-50 dark:bg-red-900/20' },
        ].map((s, i) => (
          <Card key={i} className="border-0 shadow-sm"><CardContent className="p-3 text-center"><s.icon className={`size-5 mx-auto mb-1 ${s.color.split(' ')[1]}`} /><p className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</p><p className={`text-lg font-bold tabular-nums ${s.color.split(' ')[0]}`}>{s.value}</p></CardContent></Card>
        ))}
      </div>

      {/* Filters + Search + Actions */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="flex gap-1 flex-wrap">
          {FILTER_TABS.map(f => (
            <Button key={f} size="sm" variant={filter === f ? 'default' : 'outline'} className={`text-xs rounded-full px-3 ${filter === f ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`} onClick={() => setFilter(f)}>{f === 'Due' ? 'Due' : f}</Button>
          ))}
        </div>
        <div className="flex-1" />
        <div className="flex gap-2 items-center w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64"><Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" /><Input placeholder="Search customers..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm" /></div>
          <Select value={sort} onValueChange={setSort}><SelectTrigger className="h-9 w-36 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="newest">Newest First</SelectItem><SelectItem value="oldest">Oldest First</SelectItem><SelectItem value="name-asc">Name A-Z</SelectItem><SelectItem value="name-desc">Name Z-A</SelectItem><SelectItem value="balance-high">Balance High</SelectItem><SelectItem value="balance-low">Balance Low</SelectItem></SelectContent></Select>
          <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={migrateLegacy} disabled={submitting}><RefreshCw className={`size-3 ${submitting ? 'animate-spin' : ''}`} />Migrate</Button>
          {canCreate && <Button size="sm" className="gap-1 text-xs bg-emerald-600 hover:bg-emerald-700" onClick={() => { resetForm(); setDuplicate(null); setAddOpen(true) }}><Plus className="size-3" />Add Customer</Button>}
        </div>
      </div>

      {/* Customer Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}</div>
      ) : filteredCustomers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex size-20 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-100 dark:from-emerald-900/20 dark:to-teal-900/30 mb-4"><BookOpen className="size-10 text-emerald-400" /></div>
          <p className="text-base font-semibold">No customers found</p>
          <p className="text-sm text-muted-foreground mt-1">{filter !== 'All' ? `No ${filter.toLowerCase()} customers` : 'Start by adding your first customer'}</p>
          {canCreate && <Button className="mt-4 bg-emerald-600 hover:bg-emerald-700 gap-2" onClick={() => { resetForm(); setAddOpen(true) }}><Plus className="size-4" />Add Customer</Button>}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filteredCustomers.map(c => {
            const b = c.balance || 0
            return (
              <Card key={c.id} className="border-0 shadow-sm hover:shadow-md transition-all cursor-pointer hover:-translate-y-0.5 group" onClick={() => openCustomer(c.id)}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white bg-gradient-to-br ${getAvatarGrad(c.fullName)}`}>{c.fullName.charAt(0).toUpperCase()}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-sm font-semibold truncate">{c.fullName}</p>
                        <Badge variant="outline" className="text-[9px] font-mono shrink-0">{c.customerId}</Badge>
                      </div>
                      {c.mobile && <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1"><Phone className="size-3" />{c.mobile}</p>}
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        <Badge className={`text-[10px] px-1.5 ${TYPE_BADGE[c.customerType] || TYPE_BADGE.Retail}`}>{c.customerType}</Badge>
                        <Badge className={`text-[10px] px-1.5 ${STATUS_BADGE[c.status] || STATUS_BADGE.Active}`}>{c.status}</Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t">
                    <div>
                      <p className="text-[10px] text-muted-foreground">Balance</p>
                      <p className={`text-sm font-bold tabular-nums ${b > 0 ? 'text-green-600' : b < 0 ? 'text-red-500' : 'text-muted-foreground'}`}>{b < 0 ? '-' : b > 0 ? '+' : ''}{fmtCur(b)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-muted-foreground">Last Activity</p>
                      <p className="text-xs text-muted-foreground">{c.lastTxnDate ? relTime(c.lastTxnDate) : '—'}</p>
                    </div>
                  </div>
                  {c.tags?.length > 0 && <div className="flex flex-wrap gap-1 mt-2">{c.tags.map(t => <span key={t.id} className={`text-[9px] px-1.5 py-0.5 rounded-full border ${TAG_COLORS[t.tagName] || TAG_COLORS.Regular}`}>{t.tagName}</span>)}</div>}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* ─── ALL DIALOGS ─── */}

      {/* Add Customer Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-lg">Add New Customer</DialogTitle><DialogDescription>Create a permanent customer profile with folio</DialogDescription></DialogHeader>
          {duplicate && <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 flex items-center gap-3"><AlertTriangle className="size-4 text-amber-600 shrink-0" /><div className="flex-1 min-w-0"><p className="text-sm font-medium text-amber-800 dark:text-amber-300">Existing Customer Found</p><p className="text-xs text-amber-600">{duplicate.fullName} — {duplicate.mobile}</p></div><Button size="sm" variant="outline" className="text-amber-600 border-amber-200 shrink-0" onClick={() => { setAddOpen(false); setDuplicate(null); openCustomer(duplicate.id) }}>Open Profile</Button></div>}
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Full Name *</Label><Input value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} placeholder="Enter full name" /></div>
              <div className="space-y-1"><Label>Mobile *</Label><Input value={form.mobile} onChange={e => setForm(f => ({ ...f, mobile: e.target.value }))} placeholder="Enter mobile" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>WhatsApp</Label><Input value={form.whatsapp} onChange={e => setForm(f => ({ ...f, whatsapp: e.target.value }))} placeholder="WhatsApp number" /></div>
              <div className="space-y-1"><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="Email address" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Customer Type</Label><Select value={form.customerType} onValueChange={v => setForm(f => ({ ...f, customerType: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['Retail','Wholesale','Supplier','Corporate','VIP'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1"><Label>Credit Limit</Label><Input type="number" value={form.creditLimit || ''} onChange={e => setForm(f => ({ ...f, creditLimit: parseFloat(e.target.value) || 0 }))} placeholder="0" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>GST Number</Label><Input value={form.gstNumber} onChange={e => setForm(f => ({ ...f, gstNumber: e.target.value }))} placeholder="Optional" /></div>
              <div className="space-y-1"><Label>PAN Number</Label><Input value={form.panNumber} onChange={e => setForm(f => ({ ...f, panNumber: e.target.value }))} placeholder="Optional" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Aadhaar Number</Label><Input value={form.aadhaarNumber} onChange={e => setForm(f => ({ ...f, aadhaarNumber: e.target.value }))} placeholder="Optional" /></div>
              <div className="space-y-1"><Label>Opening Balance</Label><Input type="number" value={form.openingBalance || ''} onChange={e => setForm(f => ({ ...f, openingBalance: parseFloat(e.target.value) || 0 }))} placeholder="0" /></div>
            </div>
            <div className="space-y-1"><Label>Internal Notes</Label><Textarea value={form.internalNotes} onChange={e => setForm(f => ({ ...f, internalNotes: e.target.value }))} placeholder="Internal notes (not visible to customer)" rows={2} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button><Button onClick={handleCreate} disabled={submitting} className="bg-emerald-600 hover:bg-emerald-700">{submitting && <Loader2 className="size-4 animate-spin mr-2" />}Create Customer</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Customer Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Customer</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Full Name</Label><Input value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} /></div>
              <div className="space-y-1"><Label>Mobile</Label><Input value={form.mobile} onChange={e => setForm(f => ({ ...f, mobile: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>WhatsApp</Label><Input value={form.whatsapp} onChange={e => setForm(f => ({ ...f, whatsapp: e.target.value }))} /></div>
              <div className="space-y-1"><Label>Email</Label><Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Customer Type</Label><Select value={form.customerType} onValueChange={v => setForm(f => ({ ...f, customerType: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['Retail','Wholesale','Supplier','Corporate','VIP'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1"><Label>Credit Limit</Label><Input type="number" value={form.creditLimit || ''} onChange={e => setForm(f => ({ ...f, creditLimit: parseFloat(e.target.value) || 0 }))} /></div>
            </div>
            <div className="space-y-1"><Label>Internal Notes</Label><Textarea value={form.internalNotes} onChange={e => setForm(f => ({ ...f, internalNotes: e.target.value }))} rows={2} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button><Button onClick={handleUpdate} disabled={submitting}>{submitting && <Loader2 className="size-4 animate-spin mr-2" />}Save Changes</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Charge Dialog */}
      <Dialog open={chargeOpen} onOpenChange={setChargeOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Charge</DialogTitle><DialogDescription>Add a product, service, or manual charge</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-1"><Label>Description *</Label><Input value={chargeForm.description} onChange={e => setChargeForm(f => ({ ...f, description: e.target.value }))} placeholder="Charge description" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Amount *</Label><Input type="number" value={chargeForm.amount} onChange={e => setChargeForm(f => ({ ...f, amount: e.target.value }))} placeholder="0" /></div>
              <div className="space-y-1"><Label>Type</Label><Select value={chargeForm.chargeType} onValueChange={v => setChargeForm(f => ({ ...f, chargeType: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['Product','Service','Manual Charge','Penalty','Miscellaneous'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Tax</Label><Input type="number" value={chargeForm.tax} onChange={e => setChargeForm(f => ({ ...f, tax: e.target.value }))} placeholder="0" /></div>
              <div className="space-y-1"><Label>Invoice No</Label><Input value={chargeForm.invoiceNo} onChange={e => setChargeForm(f => ({ ...f, invoiceNo: e.target.value }))} placeholder="Optional" /></div>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setChargeOpen(false)}>Cancel</Button><Button onClick={handleCharge} disabled={submitting} className="bg-emerald-600 hover:bg-emerald-700">{submitting && <Loader2 className="size-4 animate-spin mr-2" />}Add Charge</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Record Payment</DialogTitle><DialogDescription>Record a payment received from customer</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-1"><Label>Amount *</Label><Input type="number" value={paymentForm.amount} onChange={e => setPaymentForm(f => ({ ...f, amount: e.target.value }))} placeholder="0" /></div>
            <div className="space-y-1"><Label>Payment Mode</Label><Select value={paymentForm.mode} onValueChange={v => setPaymentForm(f => ({ ...f, mode: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['Cash','UPI','Card','Bank','Wallet','Mixed'].map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1"><Label>Reference</Label><Input value={paymentForm.reference} onChange={e => setPaymentForm(f => ({ ...f, reference: e.target.value }))} placeholder="Transaction reference" /></div>
            <div className="space-y-1"><Label>Description</Label><Input value={paymentForm.description} onChange={e => setPaymentForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional description" /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setPaymentOpen(false)}>Cancel</Button><Button onClick={handlePayment} disabled={submitting} className="bg-teal-600 hover:bg-teal-700">{submitting && <Loader2 className="size-4 animate-spin mr-2" />}Record Payment</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Refund Dialog */}
      <Dialog open={refundOpen} onOpenChange={setRefundOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Process Refund</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-1"><Label>Amount *</Label><Input type="number" value={refundForm.amount} onChange={e => setRefundForm(f => ({ ...f, amount: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Reason</Label><Select value={refundForm.reason} onValueChange={v => setRefundForm(f => ({ ...f, reason: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['Full Refund','Partial Refund','Return Adjustment','Other'].map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1"><Label>Description *</Label><Input value={refundForm.description} onChange={e => setRefundForm(f => ({ ...f, description: e.target.value }))} placeholder="Refund reason" /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setRefundOpen(false)}>Cancel</Button><Button onClick={handleRefund} disabled={submitting} className="bg-red-600 hover:bg-red-700">{submitting && <Loader2 className="size-4 animate-spin mr-2" />}Process Refund</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer Dialog */}
      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Transfer Balance</DialogTitle><DialogDescription>Transfer outstanding balance to another customer</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-1"><Label>Search Customer</Label><Input value={transferForm.targetName} onChange={e => { setTransferForm(f => ({ ...f, targetName: e.target.value })); searchTransferTargets(e.target.value) }} placeholder="Search by name or mobile" /></div>
            {transferResults.length > 0 && <div className="border rounded-lg max-h-40 overflow-y-auto">{transferResults.map(c => <button key={c.id} className={`w-full flex items-center gap-3 p-2 hover:bg-muted text-left ${transferForm.targetCustomerId === c.id ? 'bg-muted' : ''}`} onClick={() => setTransferForm(f => ({ ...f, targetCustomerId: c.id, targetName: c.fullName }))}><div className={`flex size-6 rounded-full bg-gradient-to-br ${getAvatarGrad(c.fullName)} items-center justify-center text-white text-[10px] font-bold`}>{c.fullName.charAt(0)}</div><div><p className="text-xs font-medium">{c.fullName}</p><p className="text-[10px] text-muted-foreground">{c.mobile} · {c.customerId}</p></div></button>)}</div>}
            <div className="space-y-1"><Label>Amount *</Label><Input type="number" value={transferForm.amount} onChange={e => setTransferForm(f => ({ ...f, amount: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Description</Label><Input value={transferForm.description} onChange={e => setTransferForm(f => ({ ...f, description: e.target.value }))} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setTransferOpen(false)}>Cancel</Button><Button onClick={handleTransfer} disabled={submitting || !transferForm.targetCustomerId} className="bg-purple-600 hover:bg-purple-700">{submitting && <Loader2 className="size-4 animate-spin mr-2" />}Transfer</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Discount Dialog */}
      <Dialog open={discountOpen} onOpenChange={setDiscountOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Apply Discount</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Type</Label><Select value={discountForm.discountType} onValueChange={v => setDiscountForm(f => ({ ...f, discountType: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Fixed">Fixed</SelectItem><SelectItem value="Percentage">Percentage</SelectItem></SelectContent></Select></div>
              <div className="space-y-1"><Label>Amount / % *</Label><Input type="number" value={discountForm.amount} onChange={e => setDiscountForm(f => ({ ...f, amount: e.target.value }))} /></div>
            </div>
            <div className="space-y-1"><Label>Description</Label><Input value={discountForm.description} onChange={e => setDiscountForm(f => ({ ...f, description: e.target.value }))} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDiscountOpen(false)}>Cancel</Button><Button onClick={handleDiscount} disabled={submitting} className="bg-amber-600 hover:bg-amber-700">{submitting && <Loader2 className="size-4 animate-spin mr-2" />}Apply Discount</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Document Dialog */}
      <Dialog open={docOpen} onOpenChange={setDocOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Upload Document</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-1"><Label>Type</Label><Select value={docForm.type} onValueChange={v => setDocForm(f => ({ ...f, type: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['Aadhaar','PAN','GST','Agreement','Receipt','Custom'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1"><Label>Document Name *</Label><Input value={docForm.name} onChange={e => setDocForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Aadhaar Card Front" /></div>
            <div className="space-y-1"><Label>Notes</Label><Input value={docForm.notes} onChange={e => setDocForm(f => ({ ...f, notes: e.target.value }))} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDocOpen(false)}>Cancel</Button><Button onClick={handleAddDoc} disabled={submitting}>{submitting && <Loader2 className="size-4 animate-spin mr-2" />}Add Document</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Note Dialog */}
      <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Note</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-1"><Label>Type</Label><Select value={noteForm.type} onValueChange={v => setNoteForm(f => ({ ...f, type: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['Internal','Customer','Staff','Private'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1"><Label>Content *</Label><Textarea value={noteForm.content} onChange={e => setNoteForm(f => ({ ...f, content: e.target.value }))} rows={3} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setNoteOpen(false)}>Cancel</Button><Button onClick={handleAddNote} disabled={submitting}>{submitting && <Loader2 className="size-4 animate-spin mr-2" />}Add Note</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tags Dialog */}
      <Dialog open={tagsOpen} onOpenChange={setTagsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Manage Tags</DialogTitle></DialogHeader>
          <div className="flex flex-wrap gap-2 py-4">{ALL_TAGS.map(tag => (
            <button key={tag} onClick={() => handleToggleTag(tag)} className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${customerTags.includes(tag) ? (TAG_COLORS[tag] || '') + ' ring-2 ring-offset-1' : 'border-muted-foreground/20 text-muted-foreground hover:border-muted-foreground/40'}`}>{tag}</button>
          ))}</div>
        </DialogContent>
      </Dialog>

      {/* Checkout Confirmation */}
      <AlertDialog open={checkoutOpen && !!detail} onOpenChange={setCheckoutOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Confirm Checkout</AlertDialogTitle><AlertDialogDescription>This will checkout the customer and archive the current folio. Customer profile will remain in the database.</AlertDialogDescription></AlertDialogHeader>
          {detail && <div className="grid gap-2 py-2">
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Outstanding Balance</span><span className={`font-semibold ${(detail?.balance ?? 0) > 0 ? 'text-green-600' : ''}`}>{fmtCur(detail?.balance ?? 0)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Pending Entries</span><span className="font-semibold">{detail?.ledgerEntries?.length || 0}</span></div>
          </div>}
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleCheckout} disabled={submitting} className="bg-orange-600 hover:bg-orange-700">{submitting && <Loader2 className="size-4 animate-spin mr-2" />}Confirm Checkout</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete/Archive Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Archive Customer</AlertDialogTitle><AlertDialogDescription>This will archive the customer profile. The data will be preserved and can be restored later.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDelete} disabled={submitting} className="bg-red-600 hover:bg-red-700">{submitting && <Loader2 className="size-4 animate-spin mr-2" />}Archive</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Statement Dialog */}
      <Dialog open={statementOpen} onOpenChange={open => { setStatementOpen(open); if (!open) setStmtData(null) }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Customer Statement</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>From Date</Label><Input type="date" value={stmtFrom} onChange={e => setStmtFrom(e.target.value)} /></div>
            <div className="space-y-1"><Label>To Date</Label><Input type="date" value={stmtTo} onChange={e => setStmtTo(e.target.value)} /></div>
          </div>
          <div className="flex gap-2">
            <Button onClick={fetchStatement} disabled={stmtLoading} className="gap-2 bg-emerald-600 hover:bg-emerald-700">{stmtLoading ? <Loader2 className="size-4 animate-spin" /> : <FileSearch className="size-4" />}Generate Statement</Button>
            {stmtData && <Button onClick={printStatement} variant="outline" className="gap-2"><Printer className="size-4" />Print</Button>}
          </div>
          {stmtData && (
            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-4 gap-3">
                <div className="p-3 rounded-lg bg-muted/50 text-center"><p className="text-[10px] text-muted-foreground uppercase">Opening</p><p className="text-sm font-bold tabular-nums">{fmtCur(stmtData.openingBalance)}</p></div>
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-center"><p className="text-[10px] text-muted-foreground uppercase">Debits</p><p className="text-sm font-bold text-red-600 tabular-nums">{fmtCur(stmtData.totalDebits)}</p></div>
                <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 text-center"><p className="text-[10px] text-muted-foreground uppercase">Credits</p><p className="text-sm font-bold text-green-600 tabular-nums">{fmtCur(stmtData.totalCredits)}</p></div>
                <div className="p-3 rounded-lg bg-muted text-center"><p className="text-[10px] text-muted-foreground uppercase">Closing</p><p className="text-sm font-bold tabular-nums">{fmtCur(stmtData.closingBalance)}</p></div>
              </div>
              <ScrollArea className="max-h-[300px]">
                <Table>
                  <TableHeader><TableRow><TableHead className="w-8">#</TableHead><TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Debit</TableHead><TableHead className="text-right">Credit</TableHead><TableHead className="text-right">Balance</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {(stmtData.entries || []).map((e: LedgerEntry, i: number) => (
                      <TableRow key={e.id}><TableCell className="text-xs">{i+1}</TableCell><TableCell className="text-xs">{fmtDate(e.date)}</TableCell><TableCell><Badge variant="outline" className="text-[10px]">{e.type}</Badge></TableCell><TableCell className="text-xs">{e.description || '—'}</TableCell><TableCell className={`text-xs text-right ${e.debit > 0 ? 'text-red-600' : ''}`}>{e.debit > 0 ? fmtCur(e.debit) : '—'}</TableCell><TableCell className={`text-xs text-right ${e.credit > 0 ? 'text-green-600' : ''}`}>{e.credit > 0 ? fmtCur(e.credit) : '—'}</TableCell><TableCell className={`text-xs text-right font-bold ${e.balance >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmtCur(e.balance)}</TableCell></TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* History Sheet */}
      <Sheet open={historyOpen && !!detail} onOpenChange={setHistoryOpen}>
        <SheetContent className="w-full sm:w-[500px] overflow-y-auto">
          <SheetHeader><SheetTitle>History Center</SheetTitle></SheetHeader>
          <div className="mt-4 space-y-4">
            <div>
              <h3 className="text-sm font-semibold mb-2">Visits</h3>
              {(detail?.visits || []).length === 0 ? <p className="text-xs text-muted-foreground">No visit history</p> :
              <div className="space-y-2">{(detail?.visits || []).map(v => (
                <div key={v.id} className="p-3 rounded-lg border"><div className="flex items-center justify-between"><Badge variant="outline" className="text-[10px]">Visit #{v.visitNumber}</Badge><Badge variant={v.checkOutAt ? 'secondary' : 'default'} className="text-[10px]">{v.checkOutAt ? 'Completed' : 'Active'}</Badge></div><p className="text-xs text-muted-foreground mt-1">Check-in: {fmtDateTime(v.checkInAt)}{v.checkOutAt ? ` · Check-out: ${fmtDateTime(v.checkOutAt)}` : ''}</p></div>
              ))}</div>
              }
            </div>
            <div>
              <h3 className="text-sm font-semibold mb-2">Settlements</h3>
              {(detail?.settlements || []).length === 0 ? <p className="text-xs text-muted-foreground">No settlements</p> :
              <div className="space-y-2">{(detail?.settlements || []).map(s => (
                <div key={s.id} className="p-3 rounded-lg border flex items-center gap-3"><div className="flex size-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 items-center justify-center"><CheckCircle className="size-4 text-emerald-600" /></div><div className="flex-1"><p className="text-sm font-medium">{fmtCur(s.amount)} via {s.mode}</p><p className="text-xs text-muted-foreground">{s.description || 'Settlement'} · {s.userName} · {fmtDateTime(s.createdAt)}</p></div></div>
              ))}</div>
              }
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Timeline Sheet */}
      <Sheet open={timelineOpen && !!detail} onOpenChange={setTimelineOpen}>
        <SheetContent className="w-full sm:w-[500px] overflow-y-auto">
          <SheetHeader><SheetTitle>Activity Timeline</SheetTitle></SheetHeader>
          <div className="mt-6">
            {(detail?.ledgerEntries || []).length === 0 && (detail?.auditLogs || []).length === 0 ? <p className="text-sm text-muted-foreground text-center py-10">No activity recorded</p> :
            <div className="relative pl-6">
              <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-border" />
              {[...(detail?.auditLogs || []).map(a => ({ date: a.createdAt, type: a.action, desc: a.target || a.action, user: a.userName })), ...(detail?.ledgerEntries || []).map(e => ({ date: e.createdAt, type: e.type, desc: e.description || e.type, user: e.userName }))].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((event, i) => {
                const iconMap: Record<string, React.ReactNode> = { Payment: <ArrowDownLeft className="size-3" />, Charge: <ArrowUpRight className="size-3" />, Refund: <Undo2 className="size-3" />, Discount: <Percent className="size-3" />, Settlement: <CheckCircle className="size-3" />, Checkout: <LogOut className="size-3" />, CREATE: <Plus className="size-3" /> }
                const colorMap: Record<string, string> = { Payment: 'bg-green-500', Charge: 'bg-red-500', Refund: 'bg-orange-500', Discount: 'bg-amber-500', Settlement: 'bg-emerald-500', Checkout: 'bg-gray-500', CREATE: 'bg-teal-500' }
                return (
                  <div key={i} className="relative pb-6 last:pb-0">
                    <div className={`absolute -left-5 size-4 rounded-full ${colorMap[event.type] || 'bg-muted-foreground'} flex items-center justify-center text-white ring-2 ring-background`}>{iconMap[event.type] || <Activity className="size-2.5" />}</div>
                    <div><p className="text-sm font-medium">{event.type}</p><p className="text-xs text-muted-foreground">{event.desc}{event.user ? ` · ${event.user}` : ''}</p><p className="text-[10px] text-muted-foreground">{relTime(event.date)}</p></div>
                  </div>
                )
              })}
            </div>
            }
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
