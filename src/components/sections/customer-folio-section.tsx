'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Loader2, StickyNote } from 'lucide-react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { notify } from '@/lib/notification-store'
import { useAuth } from '@/components/auth-provider'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import ReadOnlyBanner from '@/components/read-only-banner'

// Safe JSON parse: handles cases where server returns HTML instead of JSON
const safeJson = async (res: Response): Promise<Record<string, unknown>> => {
  try {
    return await res.json()
  } catch {
    return { error: `Server error (${res.status})` }
  }
}

// Split module imports
import type {
  Customer, Folio, LedgerEntry, CustomerDetail, CustomerForm,
  ChargeForm, PaymentForm, RefundForm, TransferForm, DiscountForm,
  DocForm, NoteForm, SplitAmountForm, FolioSectionProps,
} from './customer-folio/customer-folio-types'
import {
  DEFAULT_CUSTOMER_FORM, DEFAULT_CHARGE_FORM, DEFAULT_PAYMENT_FORM,
  DEFAULT_REFUND_FORM, DEFAULT_TRANSFER_FORM, DEFAULT_DISCOUNT_FORM,
  DEFAULT_DOC_FORM, DEFAULT_NOTE_FORM, DEFAULT_SPLIT_AMOUNT_FORM,
  FolioErrorBoundary, fmtCur,
} from './customer-folio/customer-folio-helpers'
import { printReceipt as _printReceipt, printInvoice as _printInvoice, printSingleFolio as _printSingleFolio, printVoucherHistory as _printVoucherHistory, printHistoryInvoice as _printHistoryInvoice, thermalPrintReceipt as _thermalPrintReceipt, thermalPrintInvoice as _thermalPrintInvoice, thermalPrintFolioStatement as _thermalPrintFolioStatement, thermalPrintVoucherHistory as _thermalPrintVoucherHistory } from './customer-folio/customer-folio-print'
import { CustomerFolioDialogs } from './customer-folio/customer-folio-dialogs'
import { CustomerFolioProfileGrid } from './customer-folio/customer-folio-profile-grid'
import { CustomerFolioManagement } from './customer-folio/customer-folio-management'
import { CustomerFolioReports } from './customer-folio/customer-folio-reports'
import { CustomerFolioNotesDocs } from './customer-folio/customer-folio-documents'

// ─── Main Orchestrator Component ───
export default function CustomerFolioSection({ onRefreshData, dataVersion }: FolioSectionProps) {
  const { token, hasPermission, currentUser } = useAuth()
  const hdrRef = useRef<Record<string, string>>(token ? { 'Authorization': `Bearer ${token}` } : {})
  useEffect(() => { hdrRef.current = token ? { 'Authorization': `Bearer ${token}` } : {} }, [token])

  // Permission checks: use customerFolio if available, fall back to khata for backward compat
  const isAdmin = currentUser?.role === 'Admin' || currentUser?.role === 'SuperAdmin'
  const pf = (action: string) => hasPermission('customerFolio', action) || hasPermission('khata', action)
  const canAccess = pf('access') || isAdmin
  const canCreate = pf('create')
  const canEdit = pf('edit')
  const canDelete = pf('delete')

  // ── State: Customer list ──
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [filter, setFilter] = useState('All')
  const [sort, setSort] = useState('newest')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── State: Detail / folio management ──
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<CustomerDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [selectedFolioId, setSelectedFolioId] = useState<string>('master')
  const [folioEntries, setFolioEntries] = useState<LedgerEntry[]>([])
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set())
  const [folioEntriesLoading, setFolioEntriesLoading] = useState(false)
  const [allFolios, setAllFolios] = useState<Folio[]>([])
  const [isFullscreen, setIsFullscreen] = useState(true)
  const [detailsSheetOpen, setDetailsSheetOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // ── State: Dialogs ──
  const [addOpen, setAddOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [chargeOpen, setChargeOpen] = useState(false)
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [refundOpen, setRefundOpen] = useState(false)
  const [transferOpen, setTransferOpen] = useState(false)
  const [discountOpen, setDiscountOpen] = useState(false)
  const [docOpen, setDocOpen] = useState(false)
  const [noteOpen, setNoteOpen] = useState(false)
  const [notesDocsOpen, setNotesDocsOpen] = useState(false)
  const [notesDocsTab, setNotesDocsTab] = useState<'notes' | 'docs'>('notes')
  const [tagsOpen, setTagsOpen] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [permanentDeleteOpen, setPermanentDeleteOpen] = useState(false)
  const [settlingMode, setSettlingMode] = useState(false)
  const [splitAmountOpen, setSplitAmountOpen] = useState(false)
  const [shiftOpen, setShiftOpen] = useState(false)
  const [removeOpen, setRemoveOpen] = useState(false)
  const [voucherOpen, setVoucherOpen] = useState(false)
  const [invoiceOpen, setInvoiceOpen] = useState(false)
  const [reportsOpen, setReportsOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)

  // ── State: Force Edit mode for checked-out customers ──
  const [forceEditMode, setForceEditMode] = useState(false)
  const canForceEdit = isAdmin || pf('forceEdit')
  const canRemove = isAdmin || pf('removeTransaction')
  const canTransfer = isAdmin || pf('transferOperation')

  // ── State: Forms ──
  const [form, setForm] = useState<CustomerForm>({ ...DEFAULT_CUSTOMER_FORM })
  const [chargeForm, setChargeForm] = useState<ChargeForm>({ ...DEFAULT_CHARGE_FORM })
  const [paymentForm, setPaymentForm] = useState<PaymentForm>({ ...DEFAULT_PAYMENT_FORM })
  const [refundForm, setRefundForm] = useState<RefundForm>({ ...DEFAULT_REFUND_FORM })
  const [transferForm, setTransferForm] = useState<TransferForm>({ ...DEFAULT_TRANSFER_FORM })
  const [transferResults, setTransferResults] = useState<Customer[]>([])
  const [discountForm, setDiscountForm] = useState<DiscountForm>({ ...DEFAULT_DISCOUNT_FORM })
  const [docForm, setDocForm] = useState<DocForm>({ ...DEFAULT_DOC_FORM })
  const [noteForm, setNoteForm] = useState<NoteForm>({ ...DEFAULT_NOTE_FORM })
  const [duplicate, setDuplicate] = useState<Customer | null>(null)
  const [profileMatch, setProfileMatch] = useState<any>(null)
  const [customerTags, setCustomerTags] = useState<string[]>([])
  const [shiftTargetFolioId, setShiftTargetFolioId] = useState('')
  const [splitAmountForm, setSplitAmountForm] = useState<SplitAmountForm>({ ...DEFAULT_SPLIT_AMOUNT_FORM })
  const [invoiceFrom, setInvoiceFrom] = useState('')
  const [invoiceTo, setInvoiceTo] = useState('')
  const [invoiceData, setInvoiceData] = useState<any>(null)
  const [invoiceLoading, setInvoiceLoading] = useState(false)
  const [folioStatementData, setFolioStatementData] = useState<any>(null)

  // ── State: Master Folio & Checkout ──
  const [masterFolioEntries, setMasterFolioEntries] = useState<LedgerEntry[]>([])
  const [postCheckoutPrintData, setPostCheckoutPrintData] = useState<LedgerEntry[]>([])
  const [lastCheckoutInvoiceNumber, setLastCheckoutInvoiceNumber] = useState<string>('')
  // UNIFIED INVOICE NUMBER: Pre-generated when customer is loaded, used EVERYWHERE (before/after checkout/history)
  const [folioInvoiceNumber, setFolioInvoiceNumber] = useState<string>('')
  const [folioInvoiceLoading, setFolioInvoiceLoading] = useState(false)
  const [deleteFolioOpen, setDeleteFolioOpen] = useState(false)
  const [folioToDelete, setFolioToDelete] = useState<string | null>(null)

  // ── Refs ──
  const prevTokenRef = useRef(token)
  const prevDataVer = useRef(dataVersion)
  const selectedIdRef = useRef(selectedId)
  const selectedFolioIdRef = useRef(selectedFolioId)
  useEffect(() => { selectedIdRef.current = selectedId }, [selectedId])
  useEffect(() => { selectedFolioIdRef.current = selectedFolioId }, [selectedFolioId])

  // ── Debounce search ──
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setDebounced(search), 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [search])

  // ── Fetch customers ──
  const fetchCustomers = useCallback(async (silent?: boolean) => {
    try {
      if (!silent) setLoading(true)
      const params = new URLSearchParams()
      // VIP and Due are tag/balance filters — don't set status for them
      if (filter !== 'All' && filter !== 'VIP' && filter !== 'Due' && filter !== 'Checkout')
        params.set('status', filter)
      else if (filter === 'Checkout')
        params.set('status', 'CheckedOut')
      if (debounced) params.set('search', debounced)
      if (sort) params.set('sort', sort === 'name' ? 'name-asc' : sort)
      if (filter === 'VIP') params.set('tag', 'VIP')
      if (filter === 'Due') params.set('hasDue', 'true')
      const res = await fetch(`/api/folio/customers?${params}`, { headers: hdrRef.current })
      if (res.ok) {
        const data = await res.json()
        const list = Array.isArray(data) ? data : (data.customers || [])
        setCustomers(list.map((c: any) => ({ ...c, balance: c.balance ?? c.currentBalance ?? 0, lastTxnDate: c.lastTxnDate ?? c.lastTransactionDate ?? '', tags: Array.isArray(c.tags) ? c.tags : [] })))
      }
    } catch { /* ignore */ } finally { setLoading(false) }
  }, [debounced, filter, sort])

  useEffect(() => { fetchCustomers() }, [fetchCustomers])
  useEffect(() => {
    if (token && token !== prevTokenRef.current) { prevTokenRef.current = token; fetchCustomers(true) }
  }, [token, fetchCustomers])

  // ── Fetch folio entries ──
  const fetchFolioEntries = useCallback(async (customerId: string, fId: string) => {
    try { setFolioEntriesLoading(true)
      const res = await fetch(`/api/folio/customers/${customerId}/folios/${fId}/entries`, { headers: hdrRef.current })
      if (res.ok) { const data = await res.json(); setFolioEntries(data.entries || []) } else { setFolioEntries([]) }
    } catch { setFolioEntries([]) } finally { setFolioEntriesLoading(false) }
  }, [])

  // ── Fetch Master Folio entries (all folios combined) ──
  const fetchMasterFolioEntries = useCallback(async (customerId: string) => {
    try { setFolioEntriesLoading(true); setMasterFolioEntries([])
      const res = await fetch(`/api/folio/customers/${customerId}/statement?includeArchived=true`, { headers: hdrRef.current })
      if (res.ok) { const data = await res.json(); setMasterFolioEntries(data.entries || []) } else { setMasterFolioEntries([]) }
    } catch { setMasterFolioEntries([]) } finally { setFolioEntriesLoading(false) }
  }, [])

  // ── Safety: ALWAYS ensure Master Folio is selected when a customer is open ──
  useEffect(() => {
    if (selectedId && selectedFolioId !== 'master') {
      setSelectedFolioId('master')
    }
  }, [selectedId])

  // ── Watch for Master Folio selection ──
  useEffect(() => {
    if (selectedId && selectedFolioId === 'master') {
      fetchMasterFolioEntries(selectedId)
    }
  }, [selectedId, selectedFolioId, fetchMasterFolioEntries])

  // ── Fetch customer detail (with null safety for openingBalance, creditLimit, balance) ──
  const fetchDetail = useCallback(async (id: string, silent?: boolean) => {
    try {
      if (!silent) setDetailLoading(true)
      const res = await fetch(`/api/folio/customers/${id}`, { headers: hdrRef.current })
      if (res.ok) {
        const d = await res.json()
        const customer = d.customer || d
        const activeFolio = d.activeFolio
        const lifetimeStats = d.lifetimeStats || {}
        const tagAssignments = Array.isArray(d.tags) ? d.tags.map((tagName: string, i: number) => ({ id: `tag-${i}`, customerId: customer.id, tagName })) : []
        const ledgerEntries: LedgerEntry[] = activeFolio?.ledgerEntries || []
        const balance = lifetimeStats.currentBalance ?? (ledgerEntries.length > 0 ? ledgerEntries[ledgerEntries.length - 1].balance : 0)
        setDetail({
          ...customer,
          openingBalance: customer.openingBalance ?? 0,
          creditLimit: customer.creditLimit ?? 0,
          balance: balance ?? 0,
          totalVisits: d.visits?.length ?? lifetimeStats.totalVisits ?? 0,
          lastTxnDate: lifetimeStats.lastTransactionDate || '',
          tags: tagAssignments, folios: d.folios || [], ledgerEntries,
          documents: d.documents || [], notes: d.notes || [], visits: d.visits || [],
          settlements: d.settlements || [], auditLogs: [],
          lifetimeRevenue: lifetimeStats.totalCharges ?? 0,
          lifetimePayments: lifetimeStats.totalPayments ?? 0,
          lifetimeRefunds: lifetimeStats.totalRefunds ?? 0,
          totalBills: 0, totalTransactions: ledgerEntries.length,
          lastVisitDate: d.visits?.[0]?.checkInAt || '', lastCheckoutDate: '',
          activeFolio: activeFolio ? { id: activeFolio.id, folioId: activeFolio.folioId, customerId: customer.id, visitNumber: activeFolio.visitNumber, status: activeFolio.status, lockedAt: activeFolio.lockedAt || null, folioNumber: activeFolio.folioNumber } : null,
        })
        setCustomerTags(tagAssignments.map(t => t.tagName))
        setAllFolios(d.folios || [])
        // ALWAYS default to Master Folio — never show individual folio entries on load
        setSelectedFolioId('master')
        fetchMasterFolioEntries(id)
        setSelectedEntries(new Set())
      }
    } catch { /* ignore */ } finally { setDetailLoading(false) }
  }, [fetchFolioEntries, fetchMasterFolioEntries])

  useEffect(() => {
    if (dataVersion !== undefined && dataVersion !== prevDataVer.current) {
      prevDataVer.current = dataVersion; fetchCustomers(true)
      if (selectedIdRef.current) fetchDetail(selectedIdRef.current, true)
    }
  }, [dataVersion, fetchCustomers, fetchDetail])

  // ── Navigation ──
  const openCustomer = (id: string) => {
    setForceEditMode(false); setSelectedId(id); setSelectedFolioId('master'); setFolioEntries([]); setMasterFolioEntries([])
    setFolioInvoiceNumber(''); setLastCheckoutInvoiceNumber('')
    fetchDetail(id)
  }
  const goBack = () => {
    setSelectedId(null); setDetail(null); setSelectedFolioId('master'); setFolioEntries([])
    setMasterFolioEntries([]); setFolioInvoiceNumber(''); setLastCheckoutInvoiceNumber(''); setSelectedEntries(new Set()); setPostCheckoutDialogOpen(false); setHistoryOpen(false)
    setPostCheckoutPrintData([]); setForceEditMode(false)
  }

  // ── UNIFIED INVOICE NUMBER: Fetch once when Active customer is loaded ──
  // This number is used for ALL prints (before checkout, after checkout) and passed to checkout API
  // so the same number appears everywhere: pre-checkout prints, post-checkout prints, and history
  useEffect(() => {
    if (detail && detail.status === 'Active' && !folioInvoiceNumber && hdrRef.current) {
      setFolioInvoiceLoading(true)
      fetch(`/api/folio/customers/${detail.id}/invoice-number`, {
        method: 'POST',
        headers: hdrRef.current,
      })
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data?.invoiceNumber) setFolioInvoiceNumber(data.invoiceNumber) })
        .catch(() => {})
        .finally(() => setFolioInvoiceLoading(false))
    }
  }, [detail?.id, detail?.status, folioInvoiceNumber])

  // ── Entry selection ──
  const toggleEntrySelection = (id: string) => {
    setSelectedEntries(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }
  const toggleAllEntries = () => {
    const currentEntries = selectedFolioId === 'master' ? masterFolioEntries : folioEntries
    if (selectedEntries.size === currentEntries.length && currentEntries.length > 0) setSelectedEntries(new Set())
    else setSelectedEntries(new Set(currentEntries.map(e => e.id)))
  }

  // ── Form helpers ──
  const resetForm = () => { setForm({ ...DEFAULT_CUSTOMER_FORM }); setDuplicate(null); setProfileMatch(null) }
  const closeDialogs = () => {
    setChargeOpen(false); setPaymentOpen(false); setRefundOpen(false); setTransferOpen(false)
    setDiscountOpen(false); setSettlingMode(false)
    setChargeForm({ ...DEFAULT_CHARGE_FORM }); setPaymentForm({ ...DEFAULT_PAYMENT_FORM })
    setRefundForm({ ...DEFAULT_REFUND_FORM }); setTransferForm({ ...DEFAULT_TRANSFER_FORM })
    setDiscountForm({ ...DEFAULT_DISCOUNT_FORM })
  }
  const populateEditForm = () => {
    if (!detail) return
    setForm({ fullName: detail.fullName, mobile: detail.mobile, whatsapp: detail.whatsapp, email: detail.email, address: (detail as any).address || '', customerType: detail.customerType, creditLimit: detail.creditLimit, internalNotes: detail.internalNotes, gstNumber: detail.gstNumber, gstAddress: (detail as any).gstAddress || '', panNumber: detail.panNumber, aadhaarNumber: detail.aadhaarNumber, openingBalance: detail.openingBalance })
  }

  // ── Phone lookup: auto-fill profile from CheckedOut customer ──
  const lookupPhoneProfile = useCallback(async (phone: string) => {
    if (!phone || phone.length !== 10 || !/^\d{10}$/.test(phone)) { setProfileMatch(null); return }
    try {
      const res = await fetch(`/api/folio/customers?lookupPhone=${phone}`, { headers: hdrRef.current })
      if (res.ok) {
        const data = await res.json()
        if (data.profileMatch) {
          setProfileMatch(data.profileMatch)
          setForm(prev => ({
            ...prev,
            fullName: data.profileMatch.fullName || prev.fullName,
            mobile: data.profileMatch.mobile || prev.mobile,
            whatsapp: data.profileMatch.whatsapp || data.profileMatch.mobile || prev.whatsapp,
            email: data.profileMatch.email || '',
            address: data.profileMatch.address || '',
            customerType: data.profileMatch.customerType || prev.customerType,
            gstNumber: data.profileMatch.gstNumber || '',
            gstAddress: data.profileMatch.gstAddress || '',
            panNumber: data.profileMatch.panNumber || '',
            aadhaarNumber: data.profileMatch.aadhaarNumber || '',
          }))
        } else {
          setProfileMatch(null)
        }
      }
    } catch { /* ignore */ }
  }, [hdrRef])

  // ── Post-checkout dialog state (managed here so goBack can close it) ──
  const [postCheckoutDialogOpen, setPostCheckoutDialogOpen] = useState(false)

  // ── API Handlers ──
  const refreshAll = () => {
    fetchCustomers(true);
    if (selectedIdRef.current) {
      fetchDetail(selectedIdRef.current, true);
      fetchMasterFolioEntries(selectedIdRef.current);
      // Also refresh the currently selected folio entries for real-time updates
      const fId = selectedFolioIdRef.current
      if (fId && fId !== 'master') {
        fetchFolioEntries(selectedIdRef.current, fId);
      }
    }
    onRefreshData();
  }

  const handleCreateFolio = async () => {
    if (!detail) return
    try { setSubmitting(true)
      const res = await fetch(`/api/folio/customers/${detail.id}/folios`, { method: 'POST', headers: { ...hdrRef.current, 'Content-Type': 'application/json' } })
      if (res.ok) { notify({ type: 'success', title: 'Folio Created' }); fetchDetail(detail.id) }
      else { const e = await safeJson(res); notify({ type: 'error', title: 'Error', message: (e.error as string) || 'Failed' }) }
    } catch { notify({ type: 'error', title: 'Error', message: 'Failed to create folio' }) } finally { setSubmitting(false) }
  }

  const handleCreate = async () => {
    if (!form.fullName.trim() || !form.mobile.trim()) { notify({ type: 'error', title: 'Error', message: 'Name and Mobile required' }); return }
    try { setSubmitting(true)
      const res = await fetch('/api/folio/customers', { method: 'POST', headers: { ...hdrRef.current, 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      if (res.ok) { notify({ type: 'success', title: 'Customer Created' }); setAddOpen(false); resetForm(); fetchCustomers(); onRefreshData() }
      else { const e = await safeJson(res); if (e.duplicate) { setDuplicate(e.duplicate as Customer); notify({ type: 'warning', title: 'Duplicate', message: 'A customer with similar details exists' }) } else notify({ type: 'error', title: 'Error', message: (e.error as string) || 'Failed' }) }
    } catch { notify({ type: 'error', title: 'Error', message: 'Failed' }) } finally { setSubmitting(false) }
  }

  const handleUpdate = async () => {
    if (!detail || !form.fullName.trim()) return
    try { setSubmitting(true)
      const res = await fetch(`/api/folio/customers/${detail.id}`, { method: 'PUT', headers: { ...hdrRef.current, 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      if (res.ok) { notify({ type: 'success', title: 'Updated' }); setEditOpen(false); fetchDetail(detail.id); fetchCustomers(true) }
      else { const e = await safeJson(res); notify({ type: 'error', title: 'Error', message: (e.error as string) || 'Failed' }) }
    } catch { notify({ type: 'error', title: 'Error', message: 'Failed to update customer' }) } finally { setSubmitting(false) }
  }

  const addLedgerEntry = async (type: string, data: any) => {
    if (!detail || !selectedFolioId) return
    // Resolve master folio to actual active folio ID
    let targetFolioId = selectedFolioId
    if (targetFolioId === 'master') {
      const activeFolio = allFolios.find(f => f.status === 'Active')
      if (!activeFolio) {
        notify({ type: 'error', title: 'Error', message: 'No active folio. Create a folio first.' })
        return
      }
      targetFolioId = activeFolio.id
    }
    try { setSubmitting(true)
      const res = await fetch(`/api/folio/customers/${detail.id}/ledger`, { method: 'POST', headers: { ...hdrRef.current, 'Content-Type': 'application/json' }, body: JSON.stringify({ type, folioId: targetFolioId, ...data }) })
      if (res.ok) { notify({ type: 'success', title: 'Entry Added' }); closeDialogs(); fetchFolioEntries(detail.id, targetFolioId); fetchDetail(detail.id, true); refreshAll() }
      else { const e = await safeJson(res); notify({ type: 'error', title: 'Error', message: (e.error as string) || 'Failed' }) }
    } catch { notify({ type: 'error', title: 'Error', message: 'Operation failed' }) } finally { setSubmitting(false) }
  }

  const handleCharge = () => { if (!chargeForm.amount || !chargeForm.description) { notify({ type: 'error', title: 'Error', message: 'Amount and description required' }); return }; addLedgerEntry('Charge', { description: chargeForm.description, amount: parseFloat(chargeForm.amount), tax: parseFloat(chargeForm.tax) || 0, invoiceNo: chargeForm.invoiceNo }) }
  const handlePayment = () => { if (!paymentForm.amount) { notify({ type: 'error', title: 'Error', message: 'Amount required' }); return }; addLedgerEntry('Payment', { description: paymentForm.description || `Payment via ${paymentForm.mode}`, amount: parseFloat(paymentForm.amount), paymentMode: paymentForm.mode, reference: paymentForm.reference }) }
  const handleRefund = () => { if (!refundForm.amount || !refundForm.description) { notify({ type: 'error', title: 'Error', message: 'Amount and reason required' }); return }; addLedgerEntry('Refund', { description: `${refundForm.reason}: ${refundForm.description}`, amount: parseFloat(refundForm.amount), invoiceNo: refundForm.invoiceNo }) }
  const handleDiscount = () => { if (!discountForm.amount) { notify({ type: 'error', title: 'Error', message: 'Amount required' }); return }; addLedgerEntry('Discount', { description: discountForm.description || 'Discount applied', amount: parseFloat(discountForm.amount), discountType: discountForm.discountType }) }

  const handleSettle = async () => {
    if (!detail || !paymentForm.amount) return
    // Resolve master folio to actual active folio ID
    let targetFolioId = selectedFolioId
    if (targetFolioId === 'master') {
      const activeFolio = allFolios.find(f => f.status === 'Active')
      if (!activeFolio) {
        notify({ type: 'error', title: 'Error', message: 'No active folio. Create a folio first.' })
        return
      }
      targetFolioId = activeFolio.id
    }
    try { setSubmitting(true)
      const settleAmount = parseFloat(paymentForm.amount)
      const payload = { amount: settleAmount, mode: paymentForm.mode, reference: paymentForm.reference, description: paymentForm.description || `Settlement via ${paymentForm.mode}`, folioId: targetFolioId }
      const res = await fetch(`/api/folio/customers/${detail.id}/settle`, { method: 'POST', headers: { ...hdrRef.current, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (res.ok) {
        notify({ type: 'success', title: 'Settlement Complete' })
        closeDialogs()
        fetchFolioEntries(detail.id, targetFolioId)
        fetchMasterFolioEntries(detail.id)
        fetchDetail(detail.id, true)
        fetchCustomers(true)
        onRefreshData()
      }
      else { const e = await safeJson(res); notify({ type: 'error', title: 'Settlement Failed', message: (e.error as string) || 'Failed to process settlement' }) }
    } catch { notify({ type: 'error', title: 'Error', message: 'Network error during settlement' }) } finally { setSubmitting(false) }
  }

  const handleTransfer = async () => {
    if (!detail || !transferForm.targetCustomerId) { notify({ type: 'error', title: 'Error', message: 'Target customer required' }); return }
    // If entries are selected, transfer only those; otherwise pure balance transfer
    const selectedEntryIds = selectedEntries.size > 0 ? Array.from(selectedEntries) : undefined
    try { setSubmitting(true)
      const res = await fetch(`/api/folio/customers/${detail.id}/transfer`, { method: 'POST', headers: { ...hdrRef.current, 'Content-Type': 'application/json' }, body: JSON.stringify({ targetCustomerId: transferForm.targetCustomerId, amount: parseFloat(transferForm.amount) || 0, description: transferForm.description, entryIds: selectedEntryIds }) })
      if (res.ok) { notify({ type: 'success', title: 'Transfer Complete' }); setSelectedEntries(new Set()); closeDialogs(); refreshAll() }
      else { const e = await safeJson(res); notify({ type: 'error', title: 'Error', message: (e.error as string) || 'Failed' }) }
    } catch { notify({ type: 'error', title: 'Error', message: 'Transfer failed' }) } finally { setSubmitting(false) }
  }
  const searchTransferTargets = async (q: string) => {
    if (q.length < 2) { setTransferResults([]); return }
    try { const res = await fetch(`/api/folio/customers?search=${encodeURIComponent(q)}&limit=10`, { headers: hdrRef.current }); if (res.ok) { const data = await res.json(); const list = Array.isArray(data) ? data : (data.customers || []); setTransferResults(list.filter((c: Customer) => c.id !== detail?.id)) } } catch { /* ignore */ }
  }

  const handleShift = async () => {
    if (!detail || !shiftTargetFolioId || selectedEntries.size === 0) { notify({ type: 'error', title: 'Error', message: 'Select entries and target folio' }); return }
    try { setSubmitting(true)
      const res = await fetch(`/api/folio/customers/${detail.id}/shift`, { method: 'POST', headers: { ...hdrRef.current, 'Content-Type': 'application/json' }, body: JSON.stringify({ entryIds: Array.from(selectedEntries), targetFolioId: shiftTargetFolioId }) })
      if (res.ok) { notify({ type: 'success', title: 'Shift Complete' }); setShiftOpen(false); setShiftTargetFolioId(''); setSelectedEntries(new Set()); fetchFolioEntries(detail.id, selectedFolioId!); fetchDetail(detail.id, true) }
      else { const e = await safeJson(res); notify({ type: 'error', title: 'Error', message: (e.error as string) || 'Failed' }) }
    } catch { notify({ type: 'error', title: 'Error', message: 'Shift failed' }) } finally { setSubmitting(false) }
  }

  const handleRemove = async () => {
    if (!detail || selectedEntries.size === 0) return
    try { setSubmitting(true)
      const res = await fetch(`/api/folio/customers/${detail.id}/entries/remove`, { method: 'POST', headers: { ...hdrRef.current, 'Content-Type': 'application/json' }, body: JSON.stringify({ entryIds: Array.from(selectedEntries) }) })
      if (res.ok) { notify({ type: 'success', title: 'Removed' }); setRemoveOpen(false); setSelectedEntries(new Set()); fetchFolioEntries(detail.id, selectedFolioId!); fetchDetail(detail.id, true) }
      else { const e = await safeJson(res); notify({ type: 'error', title: 'Error', message: (e.error as string) || 'Failed' }) }
    } catch { notify({ type: 'error', title: 'Error', message: 'Removal failed' }) } finally { setSubmitting(false) }
  }

  const handleSplitAmount = async () => {
    if (!detail || selectedEntries.size !== 1 || !splitAmountForm.targetFolioId || !splitAmountForm.amount) { notify({ type: 'error', title: 'Error', message: 'Select one entry, target folio, and amount' }); return }
    try { setSubmitting(true)
      const entryId = Array.from(selectedEntries)[0]
      const res = await fetch(`/api/folio/customers/${detail.id}/split`, { method: 'POST', headers: { ...hdrRef.current, 'Content-Type': 'application/json' }, body: JSON.stringify({ entryId, targetFolioId: splitAmountForm.targetFolioId, splitAmount: parseFloat(splitAmountForm.amount), description: 'Split Amount' }) })
      if (res.ok) { notify({ type: 'success', title: 'Split Complete' }); setSplitAmountOpen(false); setSplitAmountForm({ ...DEFAULT_SPLIT_AMOUNT_FORM }); setSelectedEntries(new Set()); fetchFolioEntries(detail.id, selectedFolioId!); fetchDetail(detail.id, true) }
      else { const e = await safeJson(res); notify({ type: 'error', title: 'Error', message: (e.error as string) || 'Failed' }) }
    } catch { /* ignore */ } finally { setSubmitting(false) }
  }

  const handleCheckout = async (invoiceNumber?: string) => {
    if (!detail) return
    // Fetch ALL entries fresh before checkout for accurate invoice data
    let entriesToSave = [...masterFolioEntries]
    try {
      const stmtRes = await fetch(`/api/folio/customers/${detail.id}/statement?includeArchived=true`, { headers: hdrRef.current })
      if (stmtRes.ok) {
        const stmtData = await stmtRes.json()
        if (stmtData.entries && stmtData.entries.length > 0) {
          entriesToSave = stmtData.entries
        }
      }
    } catch { /* use existing masterFolioEntries as fallback */ }
    setPostCheckoutPrintData(entriesToSave)
    const currentBal = detail.balance ?? 0
    const currentOpeningBal = detail.openingBalance ?? 0
    try { setSubmitting(true)
      const body: Record<string, string> = {}
      if (invoiceNumber) body.invoiceNumber = invoiceNumber
      const res = await fetch(`/api/folio/customers/${detail.id}/checkout`, { method: 'POST', headers: { ...hdrRef.current, 'Content-Type': 'application/json' }, body: Object.keys(body).length > 0 ? JSON.stringify(body) : undefined })
      if (res.ok) {
        const result = await res.json()
        // CRITICAL: Use the ACTUAL invoice number stored in the database, not the pre-generated one.
        // The API may generate a different number if pre-generated wasn't passed or was invalid.
        const storedInvoiceNumber = result.checkoutRecord?.invoiceNumber || invoiceNumber || ''
        if (storedInvoiceNumber) setLastCheckoutInvoiceNumber(storedInvoiceNumber)
        // Populate invoiceData so post-checkout print invoice works immediately
        setInvoiceData({ entries: entriesToSave, closingBalance: currentBal, openingBalance: currentOpeningBal })
        if (entriesToSave.length > 0) {
          setInvoiceFrom(entriesToSave[0].date)
          setInvoiceTo(entriesToSave[entriesToSave.length - 1].date)
        }
        notify({ type: 'success', title: 'Checkout Complete' }); setCheckoutOpen(false); refreshAll()
      }
      else { const e = await safeJson(res); notify({ type: 'error', title: 'Error', message: (e.error as string) || 'Failed' }) }
    } catch { notify({ type: 'error', title: 'Error', message: 'Network error during checkout' }) } finally { setSubmitting(false) }
  }

  // ── Simplified Checkout: Check Master Folio balance only ──
  // Req 5: No Settlement Overview. Just check balance.
  // If balance > 0 → info message. If balance = 0 → show checkout dialog with Invoice + Checkout.
  const handleCheckoutSettlement = async () => {
    if (!detail) return
    const masterBal = detail.balance ?? 0
    if (masterBal > 0) {
      notify({ type: 'info', title: 'Outstanding Balance', message: `Balance: ${fmtCur(masterBal)}. Settle all outstanding amounts before checkout.` })
      return
    }
    if (masterBal < 0) {
      notify({ type: 'info', title: 'Credit Balance', message: `Credit balance: ${fmtCur(Math.abs(masterBal))}. Adjust before checkout.` })
      return
    }
    // Balance is zero — open checkout dialog (Invoice + Proceed to Checkout)
    setCheckoutOpen(true)
  }

  const handleDeleteFolio = async () => {
    if (!detail || !folioToDelete) return
    try { setSubmitting(true)
      const res = await fetch(`/api/folio/customers/${detail.id}/folios/${folioToDelete}`, { method: 'DELETE', headers: hdrRef.current })
      if (res.ok) { notify({ type: 'success', title: 'Folio Deleted' }); setDeleteFolioOpen(false); setFolioToDelete(null); fetchDetail(detail.id) }
      else { const e = await safeJson(res); notify({ type: 'error', title: 'Error', message: (e.error as string) || 'Failed' }) }
    } catch { notify({ type: 'error', title: 'Error', message: 'Failed to delete folio' }) } finally { setSubmitting(false) }
  }

  const handleDelete = async () => {
    if (!detail) return
    try { setSubmitting(true)
      const res = await fetch(`/api/folio/customers/${detail.id}`, { method: 'DELETE', headers: hdrRef.current })
      if (res.ok) { notify({ type: 'success', title: 'Archived' }); setDeleteOpen(false); goBack(); fetchCustomers(); onRefreshData() }
      else notify({ type: 'error', title: 'Error', message: 'Failed' })
    } catch { notify({ type: 'error', title: 'Error', message: 'Delete failed' }) } finally { setSubmitting(false) }
  }

  const handlePermanentDelete = async () => {
    if (!detail) return
    try { setSubmitting(true)
      const res = await fetch(`/api/folio/customers/${detail.id}?permanent=true`, { method: 'DELETE', headers: hdrRef.current })
      if (res.ok) { notify({ type: 'success', title: 'Permanently Deleted', message: 'All records removed' }); setPermanentDeleteOpen(false); goBack(); fetchCustomers(); onRefreshData() }
      else { const e = await safeJson(res); notify({ type: 'error', title: 'Error', message: (e.error as string) || 'Failed' }) }
    } catch { notify({ type: 'error', title: 'Error', message: 'Failed' }) } finally { setSubmitting(false) }
  }

  const handleAddDoc = async () => { if (!detail || !docForm.name) { notify({ type: 'error', title: 'Error', message: 'Name required' }); return } try { setSubmitting(true); const res = await fetch(`/api/folio/customers/${detail.id}/documents`, { method: 'POST', headers: { ...hdrRef.current, 'Content-Type': 'application/json' }, body: JSON.stringify(docForm) }); if (res.ok) { notify({ type: 'success', title: 'Document Added' }); setDocForm({ ...DEFAULT_DOC_FORM }); await fetchDetail(detail.id); } } catch { /* ignore */ } finally { setSubmitting(false) } }
  const handleDeleteDoc = async (docId: string) => { if (!detail) return; try { await fetch(`/api/folio/customers/${detail.id}/documents/${docId}`, { method: 'DELETE', headers: hdrRef.current }); notify({ type: 'success', title: 'Deleted' }); await fetchDetail(detail.id) } catch { /* ignore */ } }
  const handleAddNote = async () => { if (!detail || !noteForm.content) { notify({ type: 'error', title: 'Error', message: 'Content required' }); return } try { setSubmitting(true); const res = await fetch(`/api/folio/customers/${detail.id}/notes`, { method: 'POST', headers: { ...hdrRef.current, 'Content-Type': 'application/json' }, body: JSON.stringify(noteForm) }); if (res.ok) { notify({ type: 'success', title: 'Note Added' }); setNoteForm({ ...DEFAULT_NOTE_FORM }); await fetchDetail(detail.id); } } catch { /* ignore */ } finally { setSubmitting(false) } }
  const handleDeleteNote = async (noteId: string) => { if (!detail) return; try { await fetch(`/api/folio/customers/${detail.id}/notes/${noteId}`, { method: 'DELETE', headers: hdrRef.current }); notify({ type: 'success', title: 'Deleted' }); await fetchDetail(detail.id) } catch { /* ignore */ } }
  const handleToggleTag = async (tagName: string) => { if (!detail) return; const has = customerTags.includes(tagName); try { if (has) { await fetch(`/api/folio/customers/${detail.id}/tags?tagName=${encodeURIComponent(tagName)}`, { method: 'DELETE', headers: hdrRef.current }); setCustomerTags(prev => prev.filter(t => t !== tagName)) } else { await fetch(`/api/folio/customers/${detail.id}/tags`, { method: 'POST', headers: { ...hdrRef.current, 'Content-Type': 'application/json' }, body: JSON.stringify({ tagName }) }); setCustomerTags(prev => [...prev, tagName]) } fetchDetail(detail.id, true); fetchCustomers(true) } catch { /* ignore */ } }

  // ── Invoice / statement helpers ──
  const fetchInvoiceData = async () => {
    if (!detail) return
    try { setInvoiceLoading(true); const params = new URLSearchParams(); if (invoiceFrom) params.set('from', invoiceFrom); if (invoiceTo) params.set('to', invoiceTo); params.set('includeArchived', 'true')
      const res = await fetch(`/api/folio/customers/${detail.id}/statement?${params}`, { headers: hdrRef.current }); if (res.ok) setInvoiceData(await res.json()); else notify({ type: 'error', title: 'Error', message: 'Failed' })
    } catch { /* ignore */ } finally { setInvoiceLoading(false) }
  }
  const fetchFolioStatement = async (folioId: string) => {
    if (!detail) return
    try { setFolioStatementData(null)
      const res = await fetch(`/api/folio/customers/${detail.id}/statement?folioId=${folioId}`, { headers: hdrRef.current }); if (res.ok) setFolioStatementData(await res.json())
    } catch { /* ignore */ }
  }

  // ── Print wrappers (async, using ref) ──
  const bal = detail?.balance ?? 0
  const isActive = detail?.status === 'Active'
  const isCheckedOut = detail?.status === 'CheckedOut'
  // Include all payment/settlement/refund entries from ALL folios for voucher history
  const paymentEntries = masterFolioEntries.filter(e => e.type === 'Payment' || e.type === 'Settlement' || e.type === 'Refund')
  const currentEntries = selectedFolioId === 'master' ? masterFolioEntries : folioEntries
  const selectedEntryObj = selectedEntries.size === 1 ? currentEntries.find(e => e.id === Array.from(selectedEntries)[0]) : null

  const doPrintReceipt = async () => {
    if (!detail) return
    const entriesToPrint = postCheckoutPrintData.length > 0 ? postCheckoutPrintData : (folioEntries.length > 0 ? folioEntries : masterFolioEntries)
    const invNo = lastCheckoutInvoiceNumber || folioInvoiceNumber || undefined
    await _printReceipt(detail, entriesToPrint, hdrRef as any, currentUser?.name, invNo)
  }
  const doPrintInvoice = (overrideInvoiceNumber?: string) => {
    if (!detail) return
    const invNo = overrideInvoiceNumber || lastCheckoutInvoiceNumber || folioInvoiceNumber || undefined
    _printInvoice(detail, invoiceData, invoiceFrom, invoiceTo, hdrRef as any, currentUser?.name, invNo)
  }
  // Fetch ALL entries for the customer (including from archived folios) and print invoice
  // This ensures the checkout invoice shows the complete transaction history
  const doPrintCompleteInvoice = async (overrideInvoiceNumber?: string) => {
    if (!detail) return
    const invNo = overrideInvoiceNumber || lastCheckoutInvoiceNumber || folioInvoiceNumber || undefined
    try {
      // Fetch ALL active ledger entries for this customer (no date filter, no folio filter)
      const res = await fetch(`/api/folio/customers/${detail.id}/statement?includeArchived=true`, { headers: hdrRef.current })
      if (res.ok) {
        const data = await res.json()
        const allEntries = data.entries || []
        if (allEntries.length === 0) { notify({ type: 'info', title: 'Info', message: 'No transactions found' }); return }
        const firstDate = allEntries[0].date
        const lastDate = allEntries[allEntries.length - 1].date
        _printInvoice(detail, { entries: allEntries, closingBalance: data.closingBalance ?? detail.balance ?? 0, openingBalance: data.openingBalance ?? detail.openingBalance ?? 0 }, firstDate, lastDate, hdrRef as any, currentUser?.name, invNo)
      } else {
        notify({ type: 'error', title: 'Error', message: 'Failed to fetch invoice data' })
      }
    } catch { notify({ type: 'error', title: 'Error', message: 'Failed to print invoice' }) }
  }
  const doPrintSingleFolio = async () => { if (!detail) return; await _printSingleFolio(detail, folioStatementData, hdrRef as any, currentUser?.name) }
  // Combined fetch + print for folio statement (avoids confusing two-step UX)
  const handlePrintFolioStatement = async (folioId: string) => {
    if (!detail) return
    try {
      const res = await fetch(`/api/folio/customers/${detail.id}/statement?folioId=${folioId}`, { headers: hdrRef.current })
      if (res.ok) {
        const data = await res.json()
        setFolioStatementData(data)
        _printSingleFolio(detail!, data, hdrRef as any, currentUser?.name)
      } else {
        notify({ type: 'error', title: 'Error', message: 'Failed to fetch folio statement' })
      }
    } catch { notify({ type: 'error', title: 'Error', message: 'Failed to print folio statement' }) }
  }
  const doPrintVoucherHistory = async (selectedEntries?: any[]) => { if (!detail) return; const ents = selectedEntries && selectedEntries.length > 0 ? selectedEntries : paymentEntries; await _printVoucherHistory(detail, ents, hdrRef as any, currentUser?.name) }

  // ── Thermal Print wrappers ──
  const doThermalPrintReceipt = async () => {
    if (!detail) return
    const entriesToPrint = postCheckoutPrintData.length > 0 ? postCheckoutPrintData : (folioEntries.length > 0 ? folioEntries : masterFolioEntries)
    const invNo = lastCheckoutInvoiceNumber || folioInvoiceNumber || undefined
    await _thermalPrintReceipt(detail, entriesToPrint, hdrRef as any, invNo)
  }
  const doThermalPrintInvoice = (overrideInvoiceNumber?: string) => {
    if (!detail) return
    const invNo = overrideInvoiceNumber || lastCheckoutInvoiceNumber || folioInvoiceNumber || undefined
    _thermalPrintInvoice(detail, invoiceData, invoiceFrom, invoiceTo, invNo)
  }
  const doThermalPrintFolio = async () => {
    if (!detail || !selectedFolioId) return
    // P4: Fetch fresh data for this folio before thermal printing
    try {
      const res = await fetch(`/api/folio/customers/${detail.id}/statement?folioId=${selectedFolioId}`, { headers: hdrRef.current })
      if (res.ok) {
        const data = await res.json()
        setFolioStatementData(data)
        _thermalPrintFolioStatement(detail, data)
      } else {
        notify({ type: 'error', title: 'Error', message: 'Failed to fetch folio statement' })
      }
    } catch { notify({ type: 'error', title: 'Error', message: 'Failed to print folio statement' }) }
  }
  const doThermalPrintVoucher = async (entries?: any[]) => { if (!detail) return; await _thermalPrintVoucherHistory(detail, entries || paymentEntries, hdrRef as any) }

  const handlePrintHistoryFolio = async (folioData: { entries: any[]; openingBalance: number; closingBalance: number }) => {
    if (!detail || !folioData.entries?.length) return
    const from = folioData.entries[0].date || ''
    const to = folioData.entries[folioData.entries.length - 1].date || ''
    await _printHistoryInvoice(detail, folioData.entries, folioData.openingBalance, folioData.closingBalance, from, to, hdrRef as any, currentUser?.name)
  }

  // ── RENDER ──
  return (
    <FolioErrorBoundary>
    <TooltipProvider delayDuration={200}>
    <>
    {!canAccess && <ReadOnlyBanner module="Customer Folio" noAccess />}

    <div className={isFullscreen ? 'fixed inset-0 z-[60] flex flex-col' : ''}>
      <div className={`flex flex-col ${isFullscreen ? 'h-full' : 'min-h-0'} border border-slate-200 dark:border-slate-700 ${isFullscreen ? 'border-0 rounded-none' : 'rounded-lg'} overflow-hidden bg-white dark:bg-slate-900 shadow-sm`}>

        {/* ── HEADER BAR ── */}
        <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-4 py-2.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-700 flex items-center justify-center shadow-sm shadow-emerald-600/20">
              <span className="text-white text-sm font-bold">CF</span>
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">Customer Folio</h2>
              <p className="text-[10px] text-slate-400 dark:text-slate-500">Guest profiles &amp; billing management</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setIsFullscreen(!isFullscreen)} className="text-[10px] text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
              {isFullscreen ? 'Exit Full' : 'Fullscreen'}
            </button>
          </div>
        </div>

        {/* ── MAIN BODY ── */}
        <div className="flex flex-col flex-1 min-h-0">
          {/* CUSTOMER PROFILE GRID VIEW (when no customer selected) */}
          {!selectedId && (
            <CustomerFolioProfileGrid
              customers={customers} loading={loading} search={search} setSearch={setSearch}
              filter={filter} setFilter={setFilter} sort={sort} setSort={setSort}
              canCreate={canCreate} onAddCustomer={() => { resetForm(); setAddOpen(true) }}
              onSelectCustomer={openCustomer}
              onReports={() => setReportsOpen(true)}
            />
          )}

          {/* CUSTOMER DETAIL VIEW (when customer selected) — full width */}
          {selectedId && detail && detailLoading && !folioEntries.length ? (
            <div className="flex-1 flex flex-col items-center justify-center">
              <Loader2 className="size-8 animate-spin text-emerald-500 mb-3" />
              <p className="text-sm text-muted-foreground">Loading customer details...</p>
            </div>
          ) : selectedId && detail ? (
            <CustomerFolioManagement
              detail={detail} allFolios={allFolios} folioEntries={folioEntries}
              selectedEntries={selectedEntries} selectedFolioId={selectedFolioId}
              folioEntriesLoading={folioEntriesLoading} submitting={submitting}
              isAdmin={isAdmin} isActive={isActive || forceEditMode} isCheckedOut={isCheckedOut}
              forceEditMode={forceEditMode} canForceEdit={canForceEdit}
              canRemove={canRemove} canTransfer={canTransfer}
              folioStatementData={folioStatementData}
              masterFolioEntries={masterFolioEntries}
              onCheckoutSettlement={handleCheckoutSettlement}
              onToggleForceEdit={() => setForceEditMode(!forceEditMode)}
              goBack={goBack} setSelectedFolioId={setSelectedFolioId}
              setSelectedEntries={setSelectedEntries} fetchFolioEntries={fetchFolioEntries}
              toggleEntrySelection={toggleEntrySelection} toggleAllEntries={toggleAllEntries}
              handleCreateFolio={handleCreateFolio}
              printReceipt={doPrintReceipt} printSingleFolio={doPrintSingleFolio}
              onPrintFolioStatement={handlePrintFolioStatement}
              fetchFolioStatement={fetchFolioStatement}
              onVoucher={() => setVoucherOpen(true)}
              onInvoice={() => { setInvoiceFrom(''); setInvoiceTo(''); setInvoiceData(null); fetchInvoiceData(); setInvoiceOpen(true) }}
              onCharge={() => setChargeOpen(true)}
              onSettlement={() => handleCheckoutSettlement()}
              onPayment={() => { setPaymentForm({ ...DEFAULT_PAYMENT_FORM }); setSettlingMode(false); setPaymentOpen(true) }}
              onCheckout={() => setCheckoutOpen(true)}
              onRefund={() => { setRefundForm({ ...DEFAULT_REFUND_FORM }); setRefundOpen(true) }}
              onDiscount={() => { setDiscountForm({ ...DEFAULT_DISCOUNT_FORM }); setDiscountOpen(true) }}
              onTransfer={() => setTransferOpen(true)}
              onShift={() => setShiftOpen(true)}
              onSplit={() => { if (selectedEntries.size === 1) { setSplitAmountForm({ ...DEFAULT_SPLIT_AMOUNT_FORM }); setSplitAmountOpen(true) } else notify({ type: 'info', title: 'Info', message: 'Select 1 entry to split' }) }}
              onRemove={() => setRemoveOpen(true)}
              onEdit={() => { populateEditForm(); setEditOpen(true) }}
              onDetails={() => setDetailsSheetOpen(true)}
              onTags={() => setTagsOpen(true)}
              onNotes={() => { setNotesDocsTab('notes'); setNotesDocsOpen(true) }}
              onDocs={() => { setNotesDocsTab('docs'); setNotesDocsOpen(true) }}
              onDelete={() => setDeleteOpen(true)}
              onPermanentDelete={() => setPermanentDeleteOpen(true)}
              onHistory={() => setHistoryOpen(true)}
              onDeleteFolio={(folioId: string) => { setFolioToDelete(folioId); setDeleteFolioOpen(true) }}
              isFullscreen={isFullscreen}
              thermalPrintReceipt={doThermalPrintReceipt}
              thermalPrintInvoice={doThermalPrintInvoice}
              thermalPrintFolio={doThermalPrintFolio}
              thermalPrintVoucher={doThermalPrintVoucher}
            />
          ) : null}
        </div>
      </div>
    </div>

      {/* All Dialogs */}
        <CustomerFolioDialogs
          detail={detail || null} allFolios={allFolios} selectedEntries={selectedEntries}
          submitting={submitting} settlingMode={settlingMode} selectedFolioId={selectedFolioId}
          bal={bal} selectedEntryObj={selectedEntryObj} isActive={isActive}
          isCheckedOut={isCheckedOut} invoiceData={invoiceData} invoiceLoading={invoiceLoading}
          folioStatementData={folioStatementData} customerTags={customerTags}
          transferResults={transferResults} paymentEntries={paymentEntries}
          addOpen={addOpen} editOpen={editOpen} chargeOpen={chargeOpen}
          paymentOpen={paymentOpen} refundOpen={refundOpen} transferOpen={transferOpen}
          discountOpen={discountOpen} docOpen={docOpen} noteOpen={noteOpen}
          tagsOpen={tagsOpen} checkoutOpen={checkoutOpen} deleteOpen={deleteOpen}
          splitAmountOpen={splitAmountOpen} shiftOpen={shiftOpen} removeOpen={removeOpen}
          voucherOpen={voucherOpen} invoiceOpen={invoiceOpen} detailsSheetOpen={detailsSheetOpen}
          form={form} chargeForm={chargeForm} paymentForm={paymentForm}
          refundForm={refundForm} transferForm={transferForm} discountForm={discountForm}
          docForm={docForm} noteForm={noteForm} splitAmountForm={splitAmountForm}
          invoiceFrom={invoiceFrom} invoiceTo={invoiceTo} shiftTargetFolioId={shiftTargetFolioId}
          duplicate={duplicate}
          profileMatch={profileMatch}
          onPhoneChange={lookupPhoneProfile}
          setAddOpen={setAddOpen} setEditOpen={setEditOpen} setChargeOpen={setChargeOpen}
          setPaymentOpen={setPaymentOpen} setRefundOpen={setRefundOpen} setTransferOpen={setTransferOpen}
          setDiscountOpen={setDiscountOpen} setDocOpen={setDocOpen} setNoteOpen={setNoteOpen}
          setTagsOpen={setTagsOpen} setCheckoutOpen={setCheckoutOpen} setDeleteOpen={setDeleteOpen}
          setSplitAmountOpen={setSplitAmountOpen} setShiftOpen={setShiftOpen} setRemoveOpen={setRemoveOpen}
          setVoucherOpen={setVoucherOpen} setInvoiceOpen={setInvoiceOpen} setDetailsSheetOpen={setDetailsSheetOpen}
          setForm={setForm} setChargeForm={setChargeForm} setPaymentForm={setPaymentForm}
          setRefundForm={setRefundForm} setTransferForm={setTransferForm} setDiscountForm={setDiscountForm}
          setDocForm={setDocForm} setNoteForm={setNoteForm} setSplitAmountForm={setSplitAmountForm}
          setInvoiceFrom={setInvoiceFrom} setInvoiceTo={setInvoiceTo} setShiftTargetFolioId={setShiftTargetFolioId}
          setDuplicate={setDuplicate}
          handleCreate={handleCreate} handleUpdate={handleUpdate} handleCharge={handleCharge}
          handlePayment={handlePayment} handleSettle={handleSettle} handleRefund={handleRefund}
          handleDiscount={handleDiscount} handleTransfer={handleTransfer} handleShift={handleShift}
          handleSplitAmount={handleSplitAmount} handleRemove={handleRemove} handleCheckout={handleCheckout}
          handleDelete={handleDelete} handleAddDoc={handleAddDoc} handleAddNote={handleAddNote}
          handleToggleTag={handleToggleTag} handleDeleteDoc={handleDeleteDoc} handleDeleteNote={handleDeleteNote}
          fetchInvoiceData={fetchInvoiceData} fetchFolioStatement={fetchFolioStatement}
          printInvoice={doPrintInvoice} printCompleteInvoice={doPrintCompleteInvoice} printSingleFolio={doPrintSingleFolio} printVoucherHistory={doPrintVoucherHistory}
          closeDialogs={closeDialogs} searchTransferTargets={searchTransferTargets}
          onRefresh={refreshAll}
          deleteFolioOpen={deleteFolioOpen} folioToDelete={folioToDelete}
          setDeleteFolioOpen={setDeleteFolioOpen} handleDeleteFolio={handleDeleteFolio}
          onPrintReceipt={doPrintReceipt}
          onThermalPrintReceipt={doThermalPrintReceipt}
          onThermalPrintInvoice={doThermalPrintInvoice}
          onThermalPrintVoucher={doThermalPrintVoucher}
          folioInvoiceNumber={folioInvoiceNumber}
          folioInvoiceLoading={folioInvoiceLoading}
          historyOpen={historyOpen}
          setHistoryOpen={setHistoryOpen}
          onPrintHistoryFolio={handlePrintHistoryFolio}
          apiHeaders={hdrRef.current}
          canDelete={canDelete}
          isAdmin={isAdmin}
        />

        {/* Reports Full Screen */}
        <CustomerFolioReports
          open={reportsOpen}
          onClose={() => setReportsOpen(false)}
          token={token}
        />

        {/* Notes & Documents Full Screen */}
        {notesDocsOpen && detail && (
          <div className="fixed inset-0 z-[70] bg-background flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b bg-background shrink-0 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <StickyNote className="size-4 text-emerald-600 shrink-0" />
                <h2 className="text-sm font-bold truncate">{detail.fullName} — Notes & Documents</h2>
              </div>
              <button onClick={() => { setNotesDocsOpen(false); refreshAll() }} className="p-1.5 rounded-md hover:bg-muted text-lg leading-none">✕</button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-4">
              <div className="max-w-3xl mx-auto">
                <CustomerFolioNotesDocs
                  detail={detail}
                  submitting={submitting}
                  isAdmin={isAdmin}
                  canManageDocs={isAdmin || canEdit}
                  canDeleteDocs={isAdmin || canDelete}
                  token={token}
                  onRefresh={refreshAll}
                  initialTab={notesDocsTab}
                />
              </div>
            </div>
          </div>
        )}
        {/* Permanent Delete Confirmation Dialog */}
        <AlertDialog open={permanentDeleteOpen} onOpenChange={setPermanentDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Permanently Delete Customer?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. All customer information, folios, checkout history, invoices, payments, reports, and related records will be permanently removed from the system.
                <br /><br />
                <strong>Customer:</strong> {detail?.fullName} ({detail?.customerId})
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => { e.preventDefault(); handlePermanentDelete() }}
                disabled={submitting}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {submitting ? <Loader2 className="size-4 animate-spin mr-1" /> : null}
                Permanently Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
    </>
    </TooltipProvider>
    </FolioErrorBoundary>
  )
}