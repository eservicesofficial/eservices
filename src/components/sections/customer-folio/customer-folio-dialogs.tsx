'use client'

import React from 'react'

// Safe JSON parse: handles cases where server returns HTML instead of JSON
const safeJson = async (res: Response): Promise<Record<string, unknown>> => {
  try { return await res.json() } catch { return { error: `Server error (${res.status})` } }
}

import {
  UserPlus, Edit3, CircleDollarSign, Landmark, ArrowDownLeft, ArrowRightLeft,
  Trash2, FileCheck2, FileText, FileUp, StickyNote, Tag, Loader2, Eye, Phone,
  Layers, Wallet, CreditCard, Building2, BedDouble, Bitcoin, QrCode, CheckCircle2, Printer,
  Flame, Hash, Stamp, Receipt, IndianRupee, CircleCheck, PartyPopper, ArrowLeft, Plus, X,
  History, ChevronDown, LogOut, Lock,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/checkbox'
import { fmtCur, fmtDate, fmtINR, fmtDateTime, relTime, TYPE_BADGE, STATUS_BADGE, ALL_TAGS, TAG_COLORS, fmtFolioNum, ALL_PAYMENT_MODES, stripInternalDescriptions, TYPE_ICON } from './customer-folio-helpers'
import { notify } from '@/lib/notification-store'
import { buildHotelStyleInvoice, INVOICE_CSS } from './customer-folio-print'
import { getTemplateCSS, type InvoiceCustomizations } from '@/lib/invoice-templates'
import type {
  CustomerDetail, Folio, Customer, CustomerForm, ChargeForm, PaymentForm,
  RefundForm, TransferForm, DiscountForm, DocForm, NoteForm, SplitAmountForm,
  CheckoutRecord, CustomerHistory,
} from './customer-folio-types'

// ─── Document type color map ───
const DOC_TYPE_COLORS: Record<string, string> = {
  Aadhaar: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  PAN: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
  GST: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
  Agreement: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
  Receipt: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
  Invoice: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300',
  Contract: 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300',
  Photo: 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300',
  'ID Proof': 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300',
  'Address Proof': 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300',
  Medical: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
  Custom: 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400',
}

// ─── Note type color map ───
const NOTE_TYPE_COLORS: Record<string, string> = {
  Internal: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300',
  Customer: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
  Staff: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  Private: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
  Complaint: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
  Feedback: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
  FollowUp: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300',
}

// ─── Props interface for all dialogs ───
interface DialogsProps {
  detail: CustomerDetail | null
  allFolios: Folio[]
  selectedEntries: Set<string>
  submitting: boolean
  settlingMode: boolean
  selectedFolioId: string | null
  bal: number
  selectedEntryObj: any
  isActive: boolean
  isCheckedOut: boolean
  invoiceData: any
  invoiceLoading: boolean
  folioStatementData: any
  customerTags: string[]
  transferResults: Customer[]
  paymentEntries: any[]

  // Dialog open states
  addOpen: boolean; editOpen: boolean; chargeOpen: boolean; paymentOpen: boolean
  refundOpen: boolean; transferOpen: boolean; discountOpen: boolean; docOpen: boolean
  noteOpen: boolean; tagsOpen: boolean; checkoutOpen: boolean; deleteOpen: boolean
  splitAmountOpen: boolean; shiftOpen: boolean; removeOpen: boolean; voucherOpen: boolean
  invoiceOpen: boolean; detailsSheetOpen: boolean

  // Form values
  form: CustomerForm; chargeForm: ChargeForm; paymentForm: PaymentForm
  refundForm: RefundForm; transferForm: TransferForm; discountForm: DiscountForm
  docForm: DocForm; noteForm: NoteForm; splitAmountForm: SplitAmountForm
  invoiceFrom: string; invoiceTo: string
  shiftTargetFolioId: string; duplicate: Customer | null; profileMatch: any; onPhoneChange: (phone: string) => void

  deleteFolioOpen: boolean; folioToDelete: string | null
  setDeleteFolioOpen: (v: boolean) => void; handleDeleteFolio: () => void

  // Setters
  setAddOpen: (v: boolean) => void; setEditOpen: (v: boolean) => void
  setChargeOpen: (v: boolean) => void; setPaymentOpen: (v: boolean) => void
  setRefundOpen: (v: boolean) => void; setTransferOpen: (v: boolean) => void
  setDiscountOpen: (v: boolean) => void; setDocOpen: (v: boolean) => void
  setNoteOpen: (v: boolean) => void; setTagsOpen: (v: boolean) => void
  setCheckoutOpen: (v: boolean) => void; setDeleteOpen: (v: boolean) => void
  setSplitAmountOpen: (v: boolean) => void; setShiftOpen: (v: boolean) => void
  setRemoveOpen: (v: boolean) => void; setVoucherOpen: (v: boolean) => void
  setInvoiceOpen: (v: boolean) => void; setDetailsSheetOpen: (v: boolean) => void
  setForm: (f: CustomerForm) => void; setChargeForm: (f: ChargeForm) => void
  setPaymentForm: (f: PaymentForm) => void; setRefundForm: (f: RefundForm) => void
  setTransferForm: (f: TransferForm) => void; setDiscountForm: (f: DiscountForm) => void
  setDocForm: (f: DocForm) => void; setNoteForm: (f: NoteForm) => void
  setSplitAmountForm: (f: SplitAmountForm) => void
  setInvoiceFrom: (v: string) => void; setInvoiceTo: (v: string) => void
  setShiftTargetFolioId: (v: string) => void
  setDuplicate: (v: Customer | null) => void

  // Handlers
  handleCreate: () => void; handleUpdate: () => void; handleCharge: () => void
  handlePayment: () => void; handleSettle: () => void; handleRefund: () => void
  handleDiscount: () => void; handleTransfer: () => void; handleShift: () => void
  handleSplitAmount: () => void; handleRemove: () => void; handleCheckout: (invoiceNumber?: string) => void
  handleDelete: () => void; handleAddDoc: () => void; handleAddNote: () => void
  handleToggleTag: (tagName: string) => void; handleDeleteDoc: (docId: string) => void
  handleDeleteNote: (noteId: string) => void
  fetchInvoiceData: () => void; fetchFolioStatement: (folioId: string) => void
  printInvoice: (invoiceNumber?: string) => void; printCompleteInvoice: (invoiceNumber?: string) => void; printSingleFolio: () => void; printVoucherHistory: (entries?: any[]) => void
  closeDialogs: () => void
  searchTransferTargets: (q: string) => void

  // Enhanced props (optional — for TXN numbers, invoice generation, post-checkout)
  apiHeaders?: Record<string, string>
  onRefresh?: () => void
  canDelete?: boolean
  isAdmin?: boolean
  onPrintReceipt?: () => void
  onThermalPrintReceipt?: () => void
  onThermalPrintInvoice?: (invoiceNumber?: string) => void
  onThermalPrintVoucher?: (entries?: any[]) => void
  lastCreatedDocNo?: string | null
  lastCreatedType?: string | null

  // UNIFIED INVOICE NUMBER: pre-generated in parent, same number used everywhere
  folioInvoiceNumber?: string
  folioInvoiceLoading?: boolean

  // History
  historyOpen: boolean
  setHistoryOpen: (v: boolean) => void
  onPrintHistoryFolio?: (folioData: { entries: any[]; openingBalance: number; closingBalance: number }) => void
}

// ─── StatBox for checkout history summary ───
function StatBox({ label, value, color = 'text-foreground' }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-muted/50 rounded-md p-1.5 text-center">
      <div className="text-[8px] text-muted-foreground uppercase">{label}</div>
      <div className={`text-[11px] font-bold ${color}`}>{value}</div>
    </div>
  )
}

export function CustomerFolioDialogs({
  detail, allFolios, selectedEntries, submitting, settlingMode,
  selectedFolioId, bal, selectedEntryObj, isActive, isCheckedOut,
  invoiceData, invoiceLoading, folioStatementData, customerTags,
  transferResults, paymentEntries,
  addOpen, editOpen, chargeOpen, paymentOpen, refundOpen, transferOpen,
  discountOpen, docOpen, noteOpen, tagsOpen, checkoutOpen, deleteOpen,
  splitAmountOpen, shiftOpen, removeOpen, voucherOpen, invoiceOpen,
  detailsSheetOpen,
  form, chargeForm, paymentForm, refundForm, transferForm, discountForm,
  docForm, noteForm, splitAmountForm, invoiceFrom, invoiceTo,
  shiftTargetFolioId, duplicate, profileMatch, onPhoneChange,
  setAddOpen, setEditOpen, setChargeOpen, setPaymentOpen, setRefundOpen,
  setTransferOpen, setDiscountOpen, setDocOpen, setNoteOpen, setTagsOpen,
  setCheckoutOpen, setDeleteOpen, setSplitAmountOpen, setShiftOpen,
  setRemoveOpen, setVoucherOpen, setInvoiceOpen, setDetailsSheetOpen,
  setForm, setChargeForm, setPaymentForm, setRefundForm, setTransferForm,
  setDiscountForm, setDocForm, setNoteForm, setSplitAmountForm,
  setInvoiceFrom, setInvoiceTo, setShiftTargetFolioId, setDuplicate,
  handleCreate, handleUpdate, handleCharge, handlePayment, handleSettle,
  handleRefund, handleDiscount, handleTransfer, handleShift, handleSplitAmount,
  handleRemove, handleCheckout, handleDelete, handleAddDoc, handleAddNote,
  handleToggleTag, handleDeleteDoc, handleDeleteNote,
  fetchInvoiceData, fetchFolioStatement, printInvoice, printCompleteInvoice, printSingleFolio, printVoucherHistory,
  closeDialogs, searchTransferTargets,
  deleteFolioOpen, folioToDelete,
  setDeleteFolioOpen, handleDeleteFolio,
  // Enhanced props
  apiHeaders, onRefresh, canDelete = false, isAdmin = false, onPrintReceipt, onThermalPrintReceipt,
  onThermalPrintInvoice, onThermalPrintVoucher,
  lastCreatedDocNo, lastCreatedType,
  // UNIFIED INVOICE NUMBER
  folioInvoiceNumber, folioInvoiceLoading,
  // History
  historyOpen, setHistoryOpen, onPrintHistoryFolio,
}: DialogsProps) {

  // ─── Internal State ───
  // Invoice number is now pre-generated in parent (folioInvoiceNumber prop) — NO local fetch
  const invNo = folioInvoiceNumber || ''
  const invNumLoading = folioInvoiceLoading || false
  const [localSubmitting, setLocalSubmitting] = React.useState(false)
  const [entrySuccess, setEntrySuccess] = React.useState<{ show: boolean; docNo: string; type: string } | null>(null)
  const [postCheckoutOpen, setPostCheckoutOpen] = React.useState(false)
  // ─── History state ───
  const [historyLoading, setHistoryLoading] = React.useState(false)
  const [customerHistory, setCustomerHistory] = React.useState<CustomerHistory | null>(null)
  const [expandedFolioId, setExpandedFolioId] = React.useState<string | null>(null)
  const [selectedVoucherIds, setSelectedVoucherIds] = React.useState<Set<string>>(new Set())
  const [editingInvoiceId, setEditingInvoiceId] = React.useState<string | null>(null)
  const [editInvoiceValue, setEditInvoiceValue] = React.useState('')
  const [savingInvoiceNum, setSavingInvoiceNum] = React.useState(false)

  // Fetch history for the CURRENT customer (all records, no date filter)
  const fetchCustomerHistory = React.useCallback(async () => {
    if (!detail || !apiHeaders) return
    try {
      setHistoryLoading(true)
      const res = await fetch(`/api/folio/customers/${detail.id}/history`, { headers: apiHeaders })
      if (res.ok) {
        const data = await res.json() as CustomerHistory
        setCustomerHistory(data)
      }
    } catch { notify({ type: 'error', title: 'Error', message: 'Failed to fetch checkout history' }) } finally { setHistoryLoading(false) }
  }, [detail?.id, apiHeaders])

  React.useEffect(() => {
    if (historyOpen && detail && apiHeaders && fetchCustomerHistory) {
      fetchCustomerHistory()
    } else if (!historyOpen) {
      setCustomerHistory(null)
      setExpandedFolioId(null)
    }
  }, [historyOpen, detail?.id, fetchCustomerHistory, apiHeaders])

  // ─── Print helpers for checkout records ───
  const getTplCSS = (s: Record<string, string>) => {
    const tid = s.invoiceTemplate || 'modern'
    let cust: InvoiceCustomizations = {}
    try { if (s.invoiceCustomizations) cust = JSON.parse(s.invoiceCustomizations) } catch { /* */ }
    return getTemplateCSS(tid, cust)
  }

  // Build frozen customer detail from checkout snapshot (P2: never use live data for reprint)
  const buildFrozenDetail = (co: CheckoutRecord): CustomerDetail => {
    const base = detail || {} as CustomerDetail
    return {
      ...base,
      fullName: co.customerName || base.fullName,
      mobile: co.customerMobile || base.mobile,
      email: co.customerEmail || base.email,
      address: co.customerAddress || base.address,
      customerType: co.customerType || base.customerType,
      customerId: co.customerIdRef || base.customerId,
      gstNumber: co.customerGstNumber || base.gstNumber || '',
      gstAddress: co.customerGstAddress || base.gstAddress || '',
      panNumber: co.customerPanNumber || base.panNumber || '',
      companyName: co.customerCompanyName || base.companyName || '',
      totalVisits: co.visitNumber || base.totalVisits,
    } as CustomerDetail
  }

  const printCheckoutFolioBill = async (co: CheckoutRecord) => {
    if (!co.transactions.length) return
    let shopSettings: Record<string, string> = {}
    try {
      shopSettings = await fetch('/api/settings', { headers: apiHeaders || undefined }).then(r => r.ok ? r.json() : {})
    } catch { /* use defaults */ }
    const tplCss = getTplCSS(shopSettings)
    const printDetail = buildFrozenDetail(co)
    const invNo = co.customInvoiceNumber || co.invoiceNumber || co.checkoutNumber
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(`<!DOCTYPE html><html><head><title>Folio Bill - ${invNo}</title><style>${INVOICE_CSS}</style><style>${tplCss}</style></head><body>${buildHotelStyleInvoice(shopSettings, printDetail, co.transactions, invNo, new Date(co.checkoutDate).toLocaleDateString('en-IN'), 'FOLIO BILL', undefined, co.checkoutUser)}</body></html>`)
    w.document.close(); w.print()
  }

  const printCheckoutInvoice = async (co: CheckoutRecord) => {
    if (!co.transactions.length) return
    let shopSettings: Record<string, string> = {}
    try {
      shopSettings = await fetch('/api/settings', { headers: apiHeaders || undefined }).then(r => r.ok ? r.json() : {})
    } catch { /* use defaults */ }
    const tplCss = getTplCSS(shopSettings)
    const printDetail = buildFrozenDetail(co)
    const invNo = co.customInvoiceNumber || co.invoiceNumber || co.checkoutNumber
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(`<!DOCTYPE html><html><head><title>Tax Invoice - ${invNo}</title><style>${INVOICE_CSS}</style><style>${tplCss}</style></head><body>${buildHotelStyleInvoice(shopSettings, printDetail, co.transactions, invNo, new Date(co.checkoutDate).toLocaleDateString('en-IN'), 'Tax Invoice', { openingBalance: co.openingBalance, closingBalance: co.closingBalance }, co.checkoutUser)}</body></html>`)
    w.document.close(); w.print()
  }

  const saveCustomInvoiceNumber = async (co: CheckoutRecord) => {
    if (!detail || !apiHeaders) return
    setSavingInvoiceNum(true)
    try {
      const res = await fetch(`/api/folio/customers/${detail.id}/history`, {
        method: 'PATCH',
        headers: { ...apiHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkoutRecordId: co.id, customInvoiceNumber: editInvoiceValue }),
      })
      if (res.ok) {
        notify({ type: 'success', title: 'Saved', message: 'Invoice number updated' })
        setEditingInvoiceId(null)
        fetchCustomerHistory()
      } else {
        notify({ type: 'error', title: 'Error', message: 'Failed to save' })
      }
    } catch { notify({ type: 'error', title: 'Error', message: 'Failed to save' }) }
    finally { setSavingInvoiceNum(false) }
  }

  // ─── Track checkout transition ───
  const wasCheckedOut = React.useRef(isCheckedOut)
  React.useEffect(() => {
    if (isCheckedOut && !wasCheckedOut.current) {
      setPostCheckoutOpen(true)
    }
    wasCheckedOut.current = isCheckedOut
  }, [isCheckedOut])

  // ─── Show TXN number when lastCreatedDocNo changes ───
  React.useEffect(() => {
    if (lastCreatedDocNo && lastCreatedType) {
      setEntrySuccess({ show: true, docNo: lastCreatedDocNo, type: lastCreatedType })
      const timer = setTimeout(() => setEntrySuccess(null), 4000)
      return () => clearTimeout(timer)
    }
  }, [lastCreatedDocNo, lastCreatedType])

  // ─── Items for charge selector (Req 5) ───
  const [items, setItems] = React.useState<{ id: string; name: string; price: number }[]>([])
  const [itemsLoading, setItemsLoading] = React.useState(false)
  React.useEffect(() => {
    if (chargeOpen && apiHeaders) {
      setItemsLoading(true)
      fetch('/api/items', { headers: apiHeaders }).then(r => r.ok ? r.json() : []).then((list: any[]) => {
        setItems((list || []).map((it: any) => ({ id: it.id, name: it.name, price: it.price || 0 })))
      }).catch(() => {}).finally(() => setItemsLoading(false))
    }
  }, [chargeOpen, apiHeaders])

  // Handle item selection
  const handleItemSelect = React.useCallback((itemId: string) => {
    const item = items.find(it => it.id === itemId)
    if (item) {
      setChargeForm({
        ...chargeForm,
        selectedItem: itemId,
        selectedItemPrice: String(item.price),
        description: item.name,
        amount: item.price > 0 ? String(item.price) : chargeForm.amount,
      })
    }
  }, [items, chargeForm])

  // ─── Invoice number is now handled by parent via folioInvoiceNumber prop ───
  // No local fetch needed — the parent pre-generates it when customer loads

  React.useEffect(() => {
    if (invoiceOpen && !invoiceData && detail && selectedFolioId) {
      fetchInvoiceData()
    }
  }, [invoiceOpen, invoiceData, detail?.id, selectedFolioId])

  // ─── Entry creation with TXN tracking ───
  const createEntryWithTxn = React.useCallback(async (type: string, data: any) => {
    if (!detail || !selectedFolioId || !apiHeaders) {
      return null
    }
    try {
      setLocalSubmitting(true)
      const res = await fetch(`/api/folio/customers/${detail.id}/ledger`, {
        method: 'POST',
        headers: { ...apiHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, folioId: selectedFolioId, ...data }),
      })
      if (res.ok) {
        const entry = await res.json()
        const docNo = entry?.docNo || ''
        setEntrySuccess({ show: true, docNo, type })
        notify({ type: 'success', title: `${type} ${docNo}`, message: `${type} entry ${docNo} created successfully` })
        closeDialogs()
        onRefresh?.()
        setTimeout(() => setEntrySuccess(null), 4000)
        return entry
      } else {
        const e = await safeJson(res)
        notify({ type: 'error', title: 'Error', message: (e.error as string) || 'Failed' })
        return null
      }
    } catch {
      notify({ type: 'error', title: 'Error', message: 'Network error' })
      return null
    } finally {
      setLocalSubmitting(false)
    }
  }, [detail?.id, selectedFolioId, apiHeaders, closeDialogs, onRefresh])

  // ─── Settlement with TXN tracking ───
  const settleWithTxn = React.useCallback(async () => {
    if (!detail || !paymentForm.amount || !apiHeaders) {
      handleSettle()
      return
    }
    try {
      setLocalSubmitting(true)
      // When master folio is selected, use autoAllocate to distribute across all folios
      const isMaster = selectedFolioId === 'master'
      const payload = isMaster
        ? { amount: parseFloat(paymentForm.amount), mode: paymentForm.mode, reference: paymentForm.reference, description: paymentForm.description || `Settlement via ${paymentForm.mode}`, autoAllocate: true }
        : { amount: parseFloat(paymentForm.amount), mode: paymentForm.mode, reference: paymentForm.reference, description: paymentForm.description || `Settlement via ${paymentForm.mode}`, folioId: selectedFolioId }
      const res = await fetch(`/api/folio/customers/${detail.id}/settle`, {
        method: 'POST',
        headers: { ...apiHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        const data = await res.json()
        // Auto-allocate may return settledFolios array instead of single ledgerEntry
        const docNo = data?.ledgerEntry?.docNo || (data?.settledFolios?.[0] ? 'Multi-Folio' : '')
        setEntrySuccess({ show: true, docNo, type: 'Settlement' })
        notify({ type: 'success', title: `Settlement ${docNo}`, message: data.message || `Settlement ${docNo} processed successfully` })
        closeDialogs()
        onRefresh?.()
        setTimeout(() => setEntrySuccess(null), 4000)
      } else {
        const e = await safeJson(res)
        notify({ type: 'error', title: 'Settlement Failed', message: (e.error as string) || 'Failed to process settlement' })
      }
    } catch {
      notify({ type: 'error', title: 'Error', message: 'Network error' })
    } finally {
      setLocalSubmitting(false)
    }
  }, [detail?.id, selectedFolioId, apiHeaders, paymentForm, handleSettle, closeDialogs, onRefresh])

  // ─── Transfer with TXN tracking ───
  const transferWithTxn = React.useCallback(async () => {
    if (!detail || !transferForm.targetCustomerId || !apiHeaders) {
      handleTransfer()
      return
    }
    try {
      setLocalSubmitting(true)
      // If entries are selected, transfer only those; otherwise pure balance transfer
      const selectedEntryIds = selectedEntries.size > 0 ? Array.from(selectedEntries) : undefined
      const res = await fetch(`/api/folio/customers/${detail.id}/transfer`, {
        method: 'POST',
        headers: { ...apiHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetCustomerId: transferForm.targetCustomerId,
          amount: parseFloat(transferForm.amount) || 0,
          description: transferForm.description,
          entryIds: selectedEntryIds,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        const docNo = data?.source?.entry?.docNo || ''
        setEntrySuccess({ show: true, docNo, type: 'Transfer' })
        notify({ type: 'success', title: `Transfer ${docNo}`, message: data.message || `Transfer ${docNo} processed successfully` })
        closeDialogs()
        onRefresh?.()
        setTimeout(() => setEntrySuccess(null), 4000)
      } else {
        const e = await safeJson(res)
        notify({ type: 'error', title: 'Error', message: (e.error as string) || 'Failed' })
      }
    } catch {
      notify({ type: 'error', title: 'Error', message: 'Network error' })
    } finally {
      setLocalSubmitting(false)
    }
  }, [detail?.id, apiHeaders, transferForm, handleTransfer, closeDialogs, onRefresh, selectedEntries])

  // ─── Computed GST data from invoiceData ───
  const gstData = React.useMemo(() => {
    if (!invoiceData?.entries) return null
    const entries = invoiceData.entries as any[]
    const taxableEntries = entries.filter((e: any) => e.debit > 0)
    const taxableAmount = taxableEntries.reduce((sum: number, e: any) => sum + (e.debit || 0) - (e.tax || 0) - (e.discount || 0), 0)
    const totalTax = entries.reduce((sum: number, e: any) => sum + (e.tax || 0), 0)
    const totalDiscount = entries.reduce((sum: number, e: any) => sum + (e.discount || 0), 0)
    const totalCharges = entries.reduce((sum: number, e: any) => sum + (e.debit || 0), 0)
    const cgst = totalTax / 2
    const sgst = totalTax / 2
    const totalPayments = entries.reduce((sum: number, e: any) => sum + (e.credit || 0), 0)
    const advancePayment = bal < 0 ? Math.abs(bal) : 0
    return { taxableAmount, totalTax, totalDiscount, totalCharges, cgst, sgst, totalPayments, advancePayment, entryCount: taxableEntries.length }
  }, [invoiceData, bal])

  // ─── Active submitting state (local or prop) ───
  const isSubmitting = localSubmitting || submitting

  // ─── Entry success banner component ───
  const EntrySuccessBanner = () => {
    if (!entrySuccess?.show) return null
    return (
      <div className="fixed bottom-4 right-4 z-[100] animate-in slide-in-from-bottom-2 fade-in duration-300">
        <div className="bg-emerald-600 text-white rounded-xl shadow-lg px-4 py-3 flex items-center gap-3 min-w-[260px]">
          <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
            <CircleCheck className="size-4 text-white" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold">{entrySuccess.type} Created</div>
            <div className="text-[11px] text-emerald-100 flex items-center gap-1 mt-0.5">
              <Hash className="size-3" />
              <span className="font-mono font-bold">{entrySuccess.docNo}</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ─── Tax calculation preview ───
  const TaxPreview = ({ chargeForm }: { chargeForm: ChargeForm }) => {
    if (!chargeForm.taxEnabled || !chargeForm.amount || parseFloat(chargeForm.amount) <= 0) return null
    const taxPct = parseFloat(chargeForm.tax) || 0
    const amt = parseFloat(chargeForm.amount) || 0
    if (taxPct <= 0) return null
    if (chargeForm.taxType === 'exclude') {
      const taxAmt = amt * (taxPct / 100)
      const total = amt + taxAmt
      return <div className="pl-6 bg-emerald-50 dark:bg-emerald-900/20 rounded-md p-2 text-[11px] space-y-0.5"><div className="text-muted-foreground">Base: <span className="font-semibold text-foreground">₹{amt.toLocaleString('en-IN')}</span></div><div className="text-muted-foreground">Tax ({taxPct}%): <span className="font-semibold text-emerald-600">+₹{taxAmt.toFixed(2)}</span></div><div className="font-bold">Total Charge: ₹{total.toFixed(2)}</div></div>
    }
    const taxAmt = amt - (amt / (1 + taxPct / 100))
    const base = amt - taxAmt
    return <div className="pl-6 bg-emerald-50 dark:bg-emerald-900/20 rounded-md p-2 text-[11px] space-y-0.5"><div className="text-muted-foreground">Total (incl. tax): <span className="font-semibold text-foreground">₹{amt.toLocaleString('en-IN')}</span></div><div className="text-muted-foreground">Base Amount: <span className="font-semibold">₹{base.toFixed(2)}</span></div><div className="text-muted-foreground">Tax ({taxPct}%): <span className="font-semibold text-emerald-600">₹{taxAmt.toFixed(2)}</span></div></div>
  }

  // ─── Per-entry-type success wrapper ───
  const SuccessOverlay = ({ docNo, type, label }: { docNo: string; type: string; label: string }) => (
    <div className="flex flex-col items-center justify-center py-6 gap-3">
      <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
        <PartyPopper className="size-7 text-emerald-600 dark:text-emerald-400" />
      </div>
      <div className="text-center">
        <div className="text-sm font-bold text-slate-800 dark:text-slate-100">{label}</div>
        <div className="mt-2 inline-flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg px-4 py-2.5">
          <Hash className="size-4 text-emerald-600 dark:text-emerald-400" />
          <span className="font-mono text-base font-bold text-emerald-700 dark:text-emerald-300">{docNo}</span>
        </div>
        <div className="text-[11px] text-slate-400 mt-2">Transaction recorded successfully</div>
      </div>
    </div>
  )

  return (
    <>
    {/* Entry Success Banner (floating) */}
    <EntrySuccessBanner />

    {/* Add Customer Dialog */}
    <Dialog open={addOpen} onOpenChange={setAddOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><UserPlus className="size-4 text-emerald-600" />New Guest</DialogTitle></DialogHeader>
        <div className="grid gap-3 py-2">
          <div><Label className="text-xs">Full Name *</Label><Input value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} placeholder="Guest name" /></div>
          <div><Label className="text-xs">Mobile *</Label><Input value={form.mobile} onChange={e => { const v = e.target.value.replace(/\D/g, '').slice(0, 10); setForm({ ...form, mobile: v }); onPhoneChange(v) }} placeholder="10-digit mobile" maxLength={10} inputMode="numeric" /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">WhatsApp</Label><Input value={form.whatsapp} onChange={e => setForm({ ...form, whatsapp: e.target.value })} /></div>
            <div><Label className="text-xs">Email</Label><Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">Type</Label><Select value={form.customerType} onValueChange={v => setForm({ ...form, customerType: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Retail">Retail</SelectItem><SelectItem value="Wholesale">Wholesale</SelectItem><SelectItem value="Corporate">Corporate</SelectItem><SelectItem value="VIP">VIP</SelectItem><SelectItem value="Supplier">Supplier</SelectItem></SelectContent></Select></div>
            <div><Label className="text-xs">Credit Limit</Label><Input type="number" value={form.creditLimit || ''} onChange={e => setForm({ ...form, creditLimit: parseFloat(e.target.value) || 0 })} /></div>
          </div>
          <div><Label className="text-xs">Address</Label><Textarea value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} rows={2} placeholder="Customer address" /></div>
          <div><Label className="text-xs">GST Number</Label><Input value={form.gstNumber} onChange={e => setForm({ ...form, gstNumber: e.target.value })} /></div>
          <div><Label className="text-xs">GST Address</Label><Textarea value={form.gstAddress} onChange={e => setForm({ ...form, gstAddress: e.target.value })} rows={2} placeholder="Separate billing address for GST invoices" /></div>
          {profileMatch ? (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-2 text-[11px]">
              <span className="font-semibold text-blue-700 dark:text-blue-400">Profile auto-filled</span> from previous record: {profileMatch.fullName} ({profileMatch.customerId})
              <div className="text-[10px] text-blue-600/70 mt-0.5">You can edit any field before creating the new profile.</div>
            </div>
          ) : duplicate ? (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md p-2 text-[11px]">
              <span className="font-semibold text-amber-700 dark:text-amber-400">Duplicate:</span> {duplicate.fullName} ({duplicate.mobile}) — ID: {duplicate.customerId}
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { setAddOpen(false); setDuplicate(null) }}>Cancel</Button>
          <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleCreate} disabled={submitting}>{submitting ? <Loader2 className="size-3 animate-spin" /> : 'Create'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Edit Customer Dialog */}
    <Dialog open={editOpen} onOpenChange={setEditOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Edit3 className="size-4 text-emerald-600" />Edit Guest</DialogTitle></DialogHeader>
        <div className="grid gap-3 py-2">
          <div><Label className="text-xs">Full Name</Label><Input value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">Mobile</Label><Input value={form.mobile} onChange={e => setForm({ ...form, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) })} maxLength={10} inputMode="numeric" /></div>
            <div><Label className="text-xs">WhatsApp</Label><Input value={form.whatsapp} onChange={e => setForm({ ...form, whatsapp: e.target.value })} /></div>
          </div>
          <div><Label className="text-xs">Email</Label><Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
          <div><Label className="text-xs">Address</Label><Textarea value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} rows={2} placeholder="Customer address" /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">Type</Label><Select value={form.customerType} onValueChange={v => setForm({ ...form, customerType: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Retail">Retail</SelectItem><SelectItem value="Wholesale">Wholesale</SelectItem><SelectItem value="Corporate">Corporate</SelectItem><SelectItem value="VIP">VIP</SelectItem><SelectItem value="Supplier">Supplier</SelectItem></SelectContent></Select></div>
            <div><Label className="text-xs">Credit Limit</Label><Input type="number" value={form.creditLimit || ''} onChange={e => setForm({ ...form, creditLimit: parseFloat(e.target.value) || 0 })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">GST Number</Label><Input value={form.gstNumber} onChange={e => setForm({ ...form, gstNumber: e.target.value })} /></div>
            <div><Label className="text-xs">PAN</Label><Input value={form.panNumber} onChange={e => setForm({ ...form, panNumber: e.target.value })} /></div>
          </div>
          <div><Label className="text-xs">GST Address</Label><Textarea value={form.gstAddress} onChange={e => setForm({ ...form, gstAddress: e.target.value })} rows={2} placeholder="Separate billing address for GST invoices" /></div>
          <div><Label className="text-xs">Notes</Label><Textarea value={form.internalNotes} onChange={e => setForm({ ...form, internalNotes: e.target.value })} rows={2} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
          <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleUpdate} disabled={submitting}>{submitting ? <Loader2 className="size-3 animate-spin" /> : 'Save'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Charge Dialog */}
    <Dialog open={chargeOpen} onOpenChange={setChargeOpen}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><CircleDollarSign className="size-4 text-emerald-600" />Post Charge</DialogTitle>
          <DialogDescription>Add a new charge to the selected folio</DialogDescription>
        </DialogHeader>
        {entrySuccess?.show && entrySuccess.type === 'Charge' ? (
          <SuccessOverlay docNo={entrySuccess.docNo} type="Charge" label="Charge Posted" />
        ) : (
          <>
            <div className="grid gap-3 py-2">
              <div><Label className="text-xs">Select Item</Label>
                <Select value={chargeForm.selectedItem} onValueChange={(v) => { if (v === '__custom__') { setChargeForm({ ...chargeForm, selectedItem: '', selectedItemPrice: '', description: '', amount: '' }) } else { handleItemSelect(v) } }}>
                  <SelectTrigger className="h-9 text-xs w-full"><SelectValue placeholder="Choose item or type custom..." /></SelectTrigger>
                  <SelectContent className="max-h-[320px] overflow-y-auto min-w-[300px]">
                    {itemsLoading ? <div className="px-3 py-4 text-xs text-muted-foreground text-center">Loading items...</div> : (
                      <>
                        <SelectItem value="__custom__" className="text-xs py-2.5">
                          <span className="flex items-center gap-1.5">✏️ <span>Custom Description</span></span>
                        </SelectItem>
                        {items.length === 0 && (
                          <div className="px-3 py-3 text-xs text-muted-foreground text-center">No items configured. Use Custom.</div>
                        )}
                        {items.map(it => (
                          <SelectItem key={it.id} value={it.id} className="text-xs py-2.5 pr-10">
                            <span className="flex items-center justify-between gap-3 min-w-0 w-full">
                              <span className="truncate min-w-0 flex-1" title={it.name}>{it.name}</span>
                              <span className="text-muted-foreground whitespace-nowrap shrink-0 tabular-nums font-medium">₹{it.price.toLocaleString('en-IN')}</span>
                            </span>
                          </SelectItem>
                        ))}
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Description *</Label><Input value={chargeForm.description} onChange={e => setChargeForm({ ...chargeForm, description: e.target.value })} placeholder="e.g. Room Rent" /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">Amount *</Label><Input type="number" value={chargeForm.amount} onChange={e => setChargeForm({ ...chargeForm, amount: e.target.value })} /></div>
                <div><Label className="text-xs">Invoice No</Label><Input value={chargeForm.invoiceNo} onChange={e => setChargeForm({ ...chargeForm, invoiceNo: e.target.value })} placeholder="Auto-generated if empty" /></div>
              </div>
              {/* Tax Options */}
              <div className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox checked={chargeForm.taxEnabled} onCheckedChange={(v: boolean) => setChargeForm({ ...chargeForm, taxEnabled: v, tax: v ? (chargeForm.tax === '0' ? '18' : chargeForm.tax) : '0' })} />
                  <Label className="text-xs font-semibold">Enable Tax</Label>
                </div>
                {chargeForm.taxEnabled && (
                  <div className="space-y-2 pl-6">
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                        <input type="radio" name="taxType" className="accent-emerald-600" checked={chargeForm.taxType === 'include'} onChange={() => setChargeForm({ ...chargeForm, taxType: 'include' })} />
                        Include Tax
                      </label>
                      <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                        <input type="radio" name="taxType" className="accent-emerald-600" checked={chargeForm.taxType === 'exclude'} onChange={() => setChargeForm({ ...chargeForm, taxType: 'exclude' })} />
                        Exclude Tax
                      </label>
                    </div>
                    {chargeForm.taxType === 'exclude' && (
                      <div className="flex items-center gap-2">
                        <Label className="text-xs w-16 shrink-0">Tax %</Label>
                        <Select value={chargeForm.tax} onValueChange={v => setChargeForm({ ...chargeForm, tax: v })}>
                          <SelectTrigger className="h-8 text-xs w-full"><SelectValue placeholder="Select" /></SelectTrigger>
                          <SelectContent>
                            {['5', '10', '12', '14', '18', '28'].map(p => <SelectItem key={p} value={p}>{p}%</SelectItem>)}
                          <SelectItem value="custom">Custom...</SelectItem>
                          </SelectContent>
                        </Select>
                        {chargeForm.tax === 'custom' && (
                          <Input type="number" className="h-8 text-xs w-20" placeholder="%" value={chargeForm.tax === 'custom' ? '' : chargeForm.tax} onChange={e => setChargeForm({ ...chargeForm, tax: e.target.value })} />
                        )}
                      </div>
                    )}
                    {chargeForm.taxType === 'include' && (
                      <div className="flex items-center gap-2">
                        <Label className="text-xs w-16 shrink-0">Tax %</Label>
                        <Select value={chargeForm.tax} onValueChange={v => setChargeForm({ ...chargeForm, tax: v })}>
                          <SelectTrigger className="h-8 text-xs w-full"><SelectValue placeholder="Select" /></SelectTrigger>
                          <SelectContent>
                            {['5', '10', '12', '14', '18', '28'].map(p => <SelectItem key={p} value={p}>{p}%</SelectItem>)}
                            <SelectItem value="custom">Custom...</SelectItem>
                          </SelectContent>
                        </Select>
                        {chargeForm.tax === 'custom' && (
                          <Input type="number" className="h-8 text-xs w-20" placeholder="%" value={chargeForm.tax === 'custom' ? '' : chargeForm.tax} onChange={e => setChargeForm({ ...chargeForm, tax: e.target.value })} />
                        )}
                        <p className="text-[10px] text-muted-foreground">Amount includes tax</p>
                      </div>
                    )}
                  </div>
                )}
                <TaxPreview chargeForm={chargeForm} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setChargeOpen(false)}>Cancel</Button>
              <Button className="bg-red-600 hover:bg-red-700" onClick={() => {
                if (!chargeForm.amount || !chargeForm.description) {
                  notify({ type: 'error', title: 'Error', message: 'Amount and description required' }); return
                }
                let taxAmt = 0
                let finalAmount = parseFloat(chargeForm.amount) || 0
                if (chargeForm.taxEnabled) {
                  const taxPct = parseFloat(chargeForm.tax) || 0
                  const amt = parseFloat(chargeForm.amount) || 0
                  if (chargeForm.taxType === 'exclude') {
                    // Tax is extra on top of amount — final = base + tax
                    taxAmt = amt * (taxPct / 100)
                    finalAmount = amt + taxAmt
                  } else {
                    // Tax included in amount — final stays same, calc tax portion
                    taxAmt = amt - (amt / (1 + taxPct / 100))
                    finalAmount = amt
                  }
                }
                if (apiHeaders) {
                  createEntryWithTxn('Charge', {
                    description: chargeForm.description,
                    amount: finalAmount,
                    tax: taxAmt,
                    invoiceNo: chargeForm.invoiceNo,
                  })
                } else {
                  handleCharge()
                }
              }} disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="size-3 animate-spin" /> : 'Charge'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>

    {/* Payment / Settlement Dialog */}
    <Dialog open={paymentOpen} onOpenChange={v => { if (!v) closeDialogs(); setPaymentOpen(v) }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Landmark className="size-4 text-emerald-600" />{settlingMode ? 'Settle Folio' : 'Record Payment'}</DialogTitle>
          <DialogDescription>{settlingMode ? `Outstanding: ${fmtCur(bal)}` : 'Add a payment transaction'}</DialogDescription>
        </DialogHeader>
        {entrySuccess?.show && (entrySuccess.type === 'Payment' || entrySuccess.type === 'Settlement') ? (
          <SuccessOverlay docNo={entrySuccess.docNo} type={entrySuccess.type} label={settlingMode ? 'Folio Settled' : 'Payment Recorded'} />
        ) : (
          <>
            <div className="grid gap-3 py-2">
              <div><Label className="text-xs">Amount *</Label><Input type="number" value={paymentForm.amount} onChange={e => setPaymentForm({ ...paymentForm, amount: e.target.value })} placeholder={settlingMode ? String(Math.abs(bal)) : ''} /></div>
              <div><Label className="text-xs">Mode</Label><Select value={paymentForm.mode} onValueChange={v => setPaymentForm({ ...paymentForm, mode: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{ALL_PAYMENT_MODES.map(m => (<SelectItem key={m} value={m}>{m}</SelectItem>))}</SelectContent></Select></div>
              <div><Label className="text-xs">Reference</Label><Input value={paymentForm.reference} onChange={e => setPaymentForm({ ...paymentForm, reference: e.target.value })} /></div>
              <div><Label className="text-xs">Description</Label><Input value={paymentForm.description} onChange={e => setPaymentForm({ ...paymentForm, description: e.target.value })} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { closeDialogs(); setPaymentOpen(false) }}>Cancel</Button>
              <Button className={settlingMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-emerald-600 hover:bg-emerald-700'} onClick={() => {
                if (!paymentForm.amount) { notify({ type: 'error', title: 'Error', message: 'Amount required' }); return }
                if (settlingMode) {
                  if (apiHeaders) settleWithTxn()
                  else handleSettle()
                } else {
                  if (apiHeaders) {
                    createEntryWithTxn('Payment', {
                      description: paymentForm.description || `Payment via ${paymentForm.mode}`,
                      amount: parseFloat(paymentForm.amount),
                      paymentMode: paymentForm.mode,
                      reference: paymentForm.reference,
                    })
                  } else {
                    handlePayment()
                  }
                }
              }} disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="size-3 animate-spin" /> : settlingMode ? 'Settle' : 'Pay'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>

    {/* Refund Dialog */}
    <Dialog open={refundOpen} onOpenChange={setRefundOpen}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Process Refund</DialogTitle></DialogHeader>
        {entrySuccess?.show && entrySuccess.type === 'Refund' ? (
          <SuccessOverlay docNo={entrySuccess.docNo} type="Refund" label="Refund Processed" />
        ) : (
          <>
            <div className="grid gap-3 py-2">
              {/* Credit balance indicator */}
              <div className={`rounded-lg p-3 ${bal < 0 ? 'bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800' : 'bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700'}`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Credit Balance Available</span>
                  <span className={`text-sm font-bold tabular-nums ${bal < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}`}>
                    {bal < 0 ? fmtCur(Math.abs(bal)) : fmtCur(0)}
                  </span>
                </div>
                {bal >= 0 && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1.5 font-medium">No credit balance available for refund. Customer has outstanding balance of {fmtCur(bal)}.</p>
                )}
              </div>
              <div><Label className="text-xs">Amount *</Label><Input type="number" value={refundForm.amount} onChange={e => setRefundForm({ ...refundForm, amount: e.target.value })} /></div>
              <div><Label className="text-xs">Reason</Label><Select value={refundForm.reason} onValueChange={v => setRefundForm({ ...refundForm, reason: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Partial Refund">Partial Refund</SelectItem><SelectItem value="Full Refund">Full Refund</SelectItem><SelectItem value="Cancellation">Cancellation</SelectItem><SelectItem value="Error Correction">Error Correction</SelectItem></SelectContent></Select></div>
              <div><Label className="text-xs">Description *</Label><Input value={refundForm.description} onChange={e => setRefundForm({ ...refundForm, description: e.target.value })} /></div>
              <div><Label className="text-xs">Invoice No</Label><Input value={refundForm.invoiceNo} onChange={e => setRefundForm({ ...refundForm, invoiceNo: e.target.value })} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRefundOpen(false)}>Cancel</Button>
              <Button className="bg-orange-600 hover:bg-orange-700" onClick={() => {
                if (!refundForm.amount || !refundForm.description) { notify({ type: 'error', title: 'Error', message: 'Amount and description required' }); return }
                if (apiHeaders) {
                  createEntryWithTxn('Refund', {
                    description: `${refundForm.reason}: ${refundForm.description}`,
                    amount: parseFloat(refundForm.amount),
                    invoiceNo: refundForm.invoiceNo,
                  })
                } else {
                  handleRefund()
                }
              }} disabled={isSubmitting || bal >= 0}>
                {isSubmitting ? <Loader2 className="size-3 animate-spin" /> : 'Refund'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>

    {/* Discount Dialog */}
    <Dialog open={discountOpen} onOpenChange={setDiscountOpen}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Apply Discount</DialogTitle></DialogHeader>
        {entrySuccess?.show && entrySuccess.type === 'Discount' ? (
          <SuccessOverlay docNo={entrySuccess.docNo} type="Discount" label="Discount Applied" />
        ) : (
          <>
            <div className="grid gap-3 py-2">
              <div><Label className="text-xs">Type</Label><Select value={discountForm.discountType} onValueChange={v => setDiscountForm({ ...discountForm, discountType: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Fixed">Fixed</SelectItem><SelectItem value="Percentage">Percentage</SelectItem></SelectContent></Select></div>
              <div><Label className="text-xs">Amount *</Label><Input type="number" value={discountForm.amount} onChange={e => setDiscountForm({ ...discountForm, amount: e.target.value })} /></div>
              <div><Label className="text-xs">Description</Label><Input value={discountForm.description} onChange={e => setDiscountForm({ ...discountForm, description: e.target.value })} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDiscountOpen(false)}>Cancel</Button>
              <Button className="bg-teal-600 hover:bg-teal-700" onClick={() => {
                if (!discountForm.amount) { notify({ type: 'error', title: 'Error', message: 'Amount required' }); return }
                if (apiHeaders) {
                  createEntryWithTxn('Discount', {
                    description: discountForm.description || 'Discount applied',
                    amount: parseFloat(discountForm.amount),
                    discountType: discountForm.discountType,
                  })
                } else {
                  handleDiscount()
                }
              }} disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="size-3 animate-spin" /> : 'Apply'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>

    {/* Transfer Dialog */}
    <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ArrowRightLeft className="size-4 text-purple-600" />Transfer Folio</DialogTitle>
          <DialogDescription>Transfer balance and transactions to another customer</DialogDescription>
        </DialogHeader>
        {entrySuccess?.show && entrySuccess.type === 'Transfer' ? (
          <SuccessOverlay docNo={entrySuccess.docNo} type="Transfer" label="Transfer Complete" />
        ) : (
          <>
            <div className="grid gap-3 py-2">
              <div>
                <Label className="text-xs">Search Customer *</Label>
                <Input value={transferForm.targetName} onChange={e => { setTransferForm({ ...transferForm, targetName: e.target.value, targetCustomerId: '' }); searchTransferTargets(e.target.value) }} placeholder="Type name or mobile..." />
                {transferResults.length > 0 && (
                  <div className="border border-slate-200 dark:border-slate-700 rounded-md mt-1 max-h-32 overflow-auto">
                    {transferResults.map(c => (
                      <button key={c.id} onClick={() => setTransferForm({ ...transferForm, targetCustomerId: c.id, targetName: c.fullName })} className="w-full text-left px-3 py-1.5 text-[11px] hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                        {c.fullName} — {c.mobile} <span className="text-muted-foreground">({(c as any).primaryFolioId || c.customerId})</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div><Label className="text-xs">Amount (optional — 0 transfers only transactions)</Label><Input type="number" value={transferForm.amount} onChange={e => setTransferForm({ ...transferForm, amount: e.target.value })} /></div>
              <div><Label className="text-xs">Description</Label><Input value={transferForm.description} onChange={e => setTransferForm({ ...transferForm, description: e.target.value })} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setTransferOpen(false)}>Cancel</Button>
              <Button className="bg-purple-600 hover:bg-purple-700" onClick={() => {
                if (!transferForm.targetCustomerId) { notify({ type: 'error', title: 'Error', message: 'Target customer required' }); return }
                if (apiHeaders) transferWithTxn()
                else handleTransfer()
              }} disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="size-3 animate-spin" /> : 'Transfer'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>

    {/* Shift Dialog */}
    <Dialog open={shiftOpen} onOpenChange={setShiftOpen}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Shift Transactions</DialogTitle>
          <DialogDescription>Move {selectedEntries.size} selected entries to another folio</DialogDescription>
        </DialogHeader>
        <div className="py-2">
          <Label className="text-xs">Target Folio *</Label>
          <Select value={shiftTargetFolioId} onValueChange={setShiftTargetFolioId}>
            <SelectTrigger><SelectValue placeholder="Select folio" /></SelectTrigger>
            <SelectContent>{allFolios.filter(f => f.id !== selectedFolioId && f.status === 'Active').map(f => (<SelectItem key={f.id} value={f.id}>{fmtFolioNum(f.folioNumber)} ({f.status})</SelectItem>))}</SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShiftOpen(false)}>Cancel</Button>
          <Button onClick={handleShift} disabled={submitting || !shiftTargetFolioId}>{submitting ? <Loader2 className="size-3 animate-spin" /> : 'Shift'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Split Amount Dialog */}
    <Dialog open={splitAmountOpen} onOpenChange={setSplitAmountOpen}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Split Amount</DialogTitle>
          <DialogDescription>Split amount from selected entry to another folio</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          {selectedEntryObj && <div className="bg-slate-50 dark:bg-slate-800 rounded-md p-2 text-[11px]"><strong>Entry:</strong> {selectedEntryObj.description} — {fmtCur(selectedEntryObj.debit || selectedEntryObj.credit)}</div>}
          <div><Label className="text-xs">Amount *</Label><Input type="number" value={splitAmountForm.amount} onChange={e => setSplitAmountForm({ ...splitAmountForm, amount: e.target.value })} /></div>
          <div>
            <Label className="text-xs">Target Folio *</Label>
            <Select value={splitAmountForm.targetFolioId} onValueChange={v => setSplitAmountForm({ ...splitAmountForm, targetFolioId: v })}>
              <SelectTrigger><SelectValue placeholder="Select folio" /></SelectTrigger>
              <SelectContent>{allFolios.filter(f => f.id !== selectedFolioId && f.status === 'Active').map(f => (<SelectItem key={f.id} value={f.id}>{fmtFolioNum(f.folioNumber)}</SelectItem>))}</SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setSplitAmountOpen(false)}>Cancel</Button>
          <Button onClick={handleSplitAmount} disabled={submitting}>{submitting ? <Loader2 className="size-3 animate-spin" /> : 'Split'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Remove Entries Alert */}
    <AlertDialog open={removeOpen} onOpenChange={setRemoveOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove {selectedEntries.size} Entries?</AlertDialogTitle>
          <AlertDialogDescription>This will cancel the selected entries. This action cannot be undone.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={handleRemove} disabled={submitting}>{submitting ? <Loader2 className="size-3 animate-spin" /> : 'Remove'}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    {/* ══════════════════════════════════════════════════════════ */}
    {/* ─── CHECKOUT DIALOG (Simplified: Invoice + Proceed) ── */}
    {/* ══════════════════════════════════════════════════════════ */}
    <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><LogOut className="size-4 text-orange-600" />Checkout Customer</DialogTitle>
          <DialogDescription>
            {detail?.fullName} — Balance: <strong>{fmtCur(bal)}</strong>
          </DialogDescription>
        </DialogHeader>
        <div className="py-2">
          <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg p-3 text-center mb-3">
            <CheckCircle2 className="size-6 text-emerald-500 mx-auto mb-1" />
            <div className="text-xs font-bold text-emerald-700 dark:text-emerald-300">Balance Settled</div>
            <div className="text-[10px] text-emerald-600/70 mt-0.5">No outstanding balance. Ready for checkout.</div>
          </div>
          {invNo && (
            <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-2.5 text-center border border-slate-200 dark:border-slate-700">
              <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-medium">Invoice Number</div>
              <div className="text-sm font-mono font-bold text-slate-800 dark:text-slate-200 mt-0.5">{invNo}</div>
            </div>
          )}
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button variant="outline" className="flex-1 gap-1.5" onClick={() => { setCheckoutOpen(false); printCompleteInvoice(invNo || undefined) }}>
            <Stamp className="size-3.5" />Invoice
          </Button>
          <Button className="flex-1 gap-1.5 bg-orange-600 hover:bg-orange-700" onClick={() => handleCheckout(invNo)} disabled={submitting || invNumLoading || !invNo}>
            {submitting ? <Loader2 className="size-3 animate-spin" /> : <><LogOut className="size-3.5" />Proceed Checkout</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* ══════════════════════════════════════════════════════════ */}
    {/* ─── POST-CHECKOUT SUCCESS DIALOG ──────────────────────── */}
    {/* ══════════════════════════════════════════════════════════ */}
    <Dialog open={postCheckoutOpen} onOpenChange={setPostCheckoutOpen}>
      <DialogContent className="max-w-md w-[92vw]">
        <div className="flex flex-col items-center justify-center py-4 gap-3">
          {/* Success Icon */}
          <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center animate-in zoom-in duration-500">
            <CheckCircle2 className="size-8 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-center">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Checkout Complete</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{detail?.fullName} has been checked out successfully</p>
          </div>
          {detail && (
            <div className="w-full bg-slate-50 dark:bg-slate-800 rounded-xl p-3 border border-slate-200 dark:border-slate-700">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 dark:text-slate-400">Final Balance</span>
                <span className={`font-bold text-sm tabular-nums ${bal > 0 ? 'text-red-600' : bal < 0 ? 'text-emerald-600' : 'text-slate-500'}`}>
                  {bal > 0 ? '+' : bal < 0 ? '-' : ''}{fmtCur(bal)}
                </span>
              </div>
              {bal < 0 && (
                <div className="text-[10px] text-amber-600 dark:text-amber-400 mt-1.5 flex items-center gap-1">
                  <Wallet className="size-3" />Customer has {fmtCur(Math.abs(bal))} credit balance
                </div>
              )}
            </div>
          )}
          <div className="w-full space-y-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button className="w-full h-10 bg-emerald-600 hover:bg-emerald-700 text-white gap-2 text-sm font-semibold">
                  <Printer className="size-4" />Print Folio <ChevronDown className="size-3" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-44 p-1" side="top">
                <button onClick={() => { setPostCheckoutOpen(false); onPrintReceipt?.() }} className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md">
                  <Printer className="size-3.5 text-slate-500" /><div className="text-left"><div className="font-medium">A4 Print Folio</div><div className="text-[9px] text-slate-400">Standard paper</div></div>
                </button>
                <button onClick={() => { setPostCheckoutOpen(false); onThermalPrintReceipt?.() }} className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md">
                  <Flame className="size-3.5 text-orange-500" /><div className="text-left"><div className="font-medium">Thermal Print Folio</div><div className="text-[9px] text-slate-400">Receipt printer</div></div>
                </button>
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button className="w-full h-10 bg-orange-600 hover:bg-orange-700 text-white gap-2 text-sm font-semibold">
                  <Stamp className="size-4" />Print Invoice <ChevronDown className="size-3" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-44 p-1" side="top">
                <button onClick={() => { setPostCheckoutOpen(false); printCompleteInvoice() }} className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md">
                  <Printer className="size-3.5 text-slate-500" /><div className="text-left"><div className="font-medium">A4 Print Invoice</div><div className="text-[9px] text-slate-400">Complete transaction history</div></div>
                </button>
                <button onClick={() => { setPostCheckoutOpen(false); onThermalPrintInvoice?.() }} className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md">
                  <Flame className="size-3.5 text-orange-500" /><div className="text-left"><div className="font-medium">Thermal Print Invoice</div><div className="text-[9px] text-slate-400">Receipt printer</div></div>
                </button>
              </PopoverContent>
            </Popover>
            <Button variant="outline" className="w-full h-10 gap-2 text-sm" onClick={() => setPostCheckoutOpen(false)}>
              <ArrowLeft className="size-4" />Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* Delete / Archive Alert */}
    <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Archive Customer?</AlertDialogTitle>
          <AlertDialogDescription>Archive {detail?.fullName}? Their data will be preserved but hidden from active lists.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={(e) => { e.preventDefault(); handleDelete() }} disabled={submitting}>{submitting ? <Loader2 className="size-3 animate-spin" /> : 'Archive'}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    {/* Voucher / Payment History Dialog */}
    <Dialog open={voucherOpen} onOpenChange={(v) => { if (!v) setSelectedVoucherIds(new Set()); setVoucherOpen(v) }}>
      <DialogContent className="max-w-xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileCheck2 className="size-4 text-emerald-600" />Voucher / Payment History</DialogTitle>
          <DialogDescription>Select payments to print vouchers for</DialogDescription>
        </DialogHeader>
        <ScrollArea className="flex-1 max-h-64">
          {paymentEntries.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-xs">No payment entries found</div>
          ) : (
            <table className="w-full text-[11px]">
              <thead><tr className="border-b dark:border-slate-700">
                <th className="p-2 w-8"><Checkbox checked={selectedVoucherIds.size === paymentEntries.length && paymentEntries.length > 0} onCheckedChange={(c) => { if (c) setSelectedVoucherIds(new Set(paymentEntries.map(e => e.id))); else setSelectedVoucherIds(new Set()) }} /></th>
                <th className="text-left p-2">Date</th><th className="text-left p-2">Description</th><th className="text-right p-2">Amount</th><th className="text-left p-2">Mode</th>
              </tr></thead>
              <tbody>
                {paymentEntries.map(e => (
                  <tr key={e.id} className={`border-b border-slate-100 dark:border-slate-800 ${selectedVoucherIds.has(e.id) ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}>
                    <td className="p-2"><Checkbox checked={selectedVoucherIds.has(e.id)} onCheckedChange={(c) => { const s = new Set(selectedVoucherIds); if (c) s.add(e.id); else s.delete(e.id); setSelectedVoucherIds(s) }} /></td>
                    <td className="p-2">{fmtDate(e.date)}</td>
                    <td className="p-2">{e.description}</td>
                    <td className="p-2 text-right font-semibold text-emerald-600">{fmtCur(e.credit)}</td>
                    <td className="p-2"><Badge variant="outline" className="text-[9px]">{e.paymentMode || '—'}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </ScrollArea>
        <DialogFooter>
          {selectedVoucherIds.size > 0 && <span className="text-[10px] text-slate-500 mr-2">{selectedVoucherIds.size} selected</span>}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" disabled={paymentEntries.length === 0} className="gap-1.5">
                <Printer className="size-3.5" />Print <ChevronDown className="size-3" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-44 p-1" side="top">
              <button onClick={() => { const sel = selectedVoucherIds.size > 0 ? paymentEntries.filter(e => selectedVoucherIds.has(e.id)) : undefined; setVoucherOpen(false); printVoucherHistory(sel) }} className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md">
                <Printer className="size-3.5 text-slate-500" /><div className="text-left"><div className="font-medium">A4 Print</div><div className="text-[9px] text-slate-400">Standard paper</div></div>
              </button>
              <button onClick={() => { const sel = selectedVoucherIds.size > 0 ? paymentEntries.filter(e => selectedVoucherIds.has(e.id)) : undefined; setVoucherOpen(false); onThermalPrintVoucher?.(sel) }} className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md">
                <Flame className="size-3.5 text-orange-500" /><div className="text-left"><div className="font-medium">Thermal Print</div><div className="text-[9px] text-slate-400">Receipt printer</div></div>
              </button>
            </PopoverContent>
          </Popover>
          <Button variant="outline" size="sm" onClick={() => setVoucherOpen(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* ══════════════════════════════════════════════════════════ */}
    {/* ─── INVOICE DIALOG (Redesigned) ───────────────────────── */}
    {/* ══════════════════════════════════════════════════════════ */}
    <Dialog open={invoiceOpen} onOpenChange={setInvoiceOpen}>
      <DialogContent className="max-w-2xl w-[95vw] max-h-[90vh] flex flex-col">
        <ScrollArea className="flex-1 min-h-0">
          {/* Invoice Header */}
          <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 px-5 sm:px-6 pt-5 pb-4 rounded-t-lg">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <DialogTitle className="flex items-center gap-2 text-white text-sm sm:text-base">
                  <Stamp className="size-4 sm:size-5 shrink-0" />
                  Tax Invoice
                </DialogTitle>
                <DialogDescription className="text-emerald-100 text-[11px] sm:text-xs mt-1">
                  Professional invoice for this transaction
                </DialogDescription>
              </div>
              {/* Invoice Number */}
              <div className="bg-white/15 backdrop-blur-sm rounded-lg px-3 py-2 text-right shrink-0">
                {invNumLoading ? (
                  <div className="flex items-center gap-1.5 text-white/80 text-[11px]">
                    <Loader2 className="size-3 animate-spin" />Generating...
                  </div>
                ) : invNo ? (
                  <div>
                    <div className="text-[9px] text-emerald-100 uppercase tracking-wider font-semibold">Invoice No</div>
                    <div className="text-sm sm:text-base font-mono font-bold text-white">{invNo}</div>
                  </div>
                ) : (
                  <div className="text-[10px] text-white/60">No invoice no</div>
                )}
              </div>
            </div>
          </div>

          <div className="px-5 sm:px-6 py-4 space-y-4">
            {/* Business & Customer Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Business Details */}
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 sm:p-4 border border-slate-200 dark:border-slate-700">
                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2">From (Business)</div>
                <div className="text-xs font-bold text-slate-800 dark:text-slate-100 mb-1">Your Business</div>
                <div className="space-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <Building2 className="size-3 text-emerald-500" />
                    <span className="font-mono text-[10px]">GSTIN: —</span>
                  </div>
                </div>
              </div>

              {/* Customer Details */}
              <div className="bg-emerald-50 dark:bg-emerald-950/20 rounded-xl p-3 sm:p-4 border border-emerald-200 dark:border-emerald-800">
                <div className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-2">Bill To (Customer)</div>
                <div className="text-xs font-bold text-slate-800 dark:text-slate-100">{detail?.fullName}</div>
                {detail?.mobile && <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{detail.mobile}</div>}
                {detail?.gstNumber && (
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <Building2 className="size-3 text-emerald-500" />
                    <span className="font-mono text-[10px] text-slate-600 dark:text-slate-300 font-semibold">GSTIN: {detail.gstNumber}</span>
                  </div>
                )}
                {!detail?.gstNumber && (
                  <div className="text-[10px] text-slate-400 mt-1 italic">No GSTIN on file</div>
                )}
              </div>
            </div>

            {/* Date Range Filter */}
            <div className="bg-white dark:bg-slate-800/50 rounded-xl p-3 border border-slate-200 dark:border-slate-700">
              <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2">Invoice Period</div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-[10px]">From</Label><Input type="date" className="h-8 text-xs" value={invoiceFrom} onChange={e => setInvoiceFrom(e.target.value)} /></div>
                <div><Label className="text-[10px]">To</Label><Input type="date" className="h-8 text-xs" value={invoiceTo} onChange={e => setInvoiceTo(e.target.value)} /></div>
              </div>
              <Button variant="outline" size="sm" className="mt-2 h-7 text-[10px] gap-1.5" onClick={() => { if (detail && selectedFolioId) fetchFolioStatement(selectedFolioId) }} disabled={!selectedFolioId}>
                <FileText className="size-3" />Fetch Statement
              </Button>
            </div>

            {/* Invoice Data Display */}
            {invoiceLoading && (
              <div className="flex items-center justify-center py-8 gap-2 text-slate-400">
                <Loader2 className="size-4 animate-spin" />
                <span className="text-xs">Loading invoice data...</span>
              </div>
            )}

            {invoiceData && !invoiceLoading && (
              <>
                {/* Line Items Table */}
                <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                  <div className="bg-slate-50 dark:bg-slate-800 px-3 py-2">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Line Items ({gstData?.entryCount || 0} charge{gstData && gstData.entryCount !== 1 ? 's' : ''})
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[11px]">
                      <thead>
                        <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30">
                          <th className="text-left px-3 py-2 text-slate-500 font-semibold text-[10px]">#</th>
                          <th className="text-left px-3 py-2 text-slate-500 font-semibold text-[10px]">Description</th>
                          <th className="text-right px-3 py-2 text-slate-500 font-semibold text-[10px] whitespace-nowrap">Amount</th>
                          <th className="text-right px-3 py-2 text-slate-500 font-semibold text-[10px] whitespace-nowrap">Tax</th>
                          <th className="text-right px-3 py-2 text-slate-500 font-semibold text-[10px] whitespace-nowrap">Discount</th>
                          <th className="text-right px-3 py-2 text-slate-500 font-semibold text-[10px] whitespace-nowrap">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(invoiceData.entries as any[]).filter((e: any) => e.debit > 0).map((entry: any, idx: number) => (
                          <tr key={entry.id} className="border-b border-slate-50 dark:border-slate-800 last:border-b-0 hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                            <td className="px-3 py-2 text-slate-400">{idx + 1}</td>
                            <td className="px-3 py-2 text-slate-700 dark:text-slate-300 max-w-[200px] truncate" title={entry.description}>{entry.description}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{fmtINR(entry.debit - (entry.tax || 0) - (entry.discount || 0))}</td>
                            <td className="px-3 py-2 text-right text-amber-600 tabular-nums">{entry.tax > 0 ? fmtINR(entry.tax) : '—'}</td>
                            <td className="px-3 py-2 text-right text-teal-600 tabular-nums">{entry.discount > 0 ? fmtINR(entry.discount) : '—'}</td>
                            <td className="px-3 py-2 text-right font-bold tabular-nums text-slate-800 dark:text-slate-100">{fmtINR(entry.debit)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* GST Summary */}
                {gstData && gstData.totalTax > 0 && (
                  <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 sm:p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Landmark className="size-4 text-amber-600 dark:text-amber-400" />
                      <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wider">GST Summary</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div className="bg-white dark:bg-slate-800 rounded-lg p-2.5 text-center">
                        <div className="text-[9px] text-slate-400 uppercase font-semibold">Taxable Amt</div>
                        <div className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 tabular-nums mt-0.5">{fmtINR(gstData.taxableAmount)}</div>
                      </div>
                      <div className="bg-white dark:bg-slate-800 rounded-lg p-2.5 text-center">
                        <div className="text-[9px] text-slate-400 uppercase font-semibold">CGST</div>
                        <div className="text-xs sm:text-sm font-bold text-amber-700 dark:text-amber-300 tabular-nums mt-0.5">{fmtINR(gstData.cgst)}</div>
                      </div>
                      <div className="bg-white dark:bg-slate-800 rounded-lg p-2.5 text-center">
                        <div className="text-[9px] text-slate-400 uppercase font-semibold">SGST</div>
                        <div className="text-xs sm:text-sm font-bold text-amber-700 dark:text-amber-300 tabular-nums mt-0.5">{fmtINR(gstData.sgst)}</div>
                      </div>
                      <div className="bg-white dark:bg-slate-800 rounded-lg p-2.5 text-center">
                        <div className="text-[9px] text-slate-400 uppercase font-semibold">Total Tax</div>
                        <div className="text-xs sm:text-sm font-bold text-amber-700 dark:text-amber-300 tabular-nums mt-0.5">{fmtINR(gstData.totalTax)}</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Advance / Payment Summary */}
                <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-xl p-3 sm:p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Wallet className="size-4 text-blue-600 dark:text-blue-400" />
                    <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wider">Advance & Payment Details</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="bg-white dark:bg-slate-800 rounded-lg p-2.5 text-center">
                      <div className="text-[9px] text-slate-400 uppercase font-semibold">Opening Bal</div>
                      <div className={`text-xs sm:text-sm font-bold tabular-nums mt-0.5 ${(invoiceData.openingBalance || 0) >= 0 ? 'text-slate-700 dark:text-slate-200' : 'text-emerald-600'}`}>
                        {fmtINR(invoiceData.openingBalance || 0)}
                      </div>
                    </div>
                    <div className="bg-white dark:bg-slate-800 rounded-lg p-2.5 text-center">
                      <div className="text-[9px] text-slate-400 uppercase font-semibold">Total Charges</div>
                      <div className="text-xs sm:text-sm font-bold text-red-600 dark:text-red-400 tabular-nums mt-0.5">{fmtINR(gstData?.totalCharges || 0)}</div>
                    </div>
                    <div className="bg-white dark:bg-slate-800 rounded-lg p-2.5 text-center">
                      <div className="text-[9px] text-slate-400 uppercase font-semibold">Payments</div>
                      <div className="text-xs sm:text-sm font-bold text-emerald-600 dark:text-emerald-400 tabular-nums mt-0.5">{fmtINR(gstData?.totalPayments || 0)}</div>
                    </div>
                    <div className="bg-white dark:bg-slate-800 rounded-lg p-2.5 text-center">
                      <div className="text-[9px] text-slate-400 uppercase font-semibold">Credit/Advance</div>
                      <div className={`text-xs sm:text-sm font-bold tabular-nums mt-0.5 ${(gstData?.advancePayment || 0) > 0 ? 'text-emerald-600' : 'text-slate-500'}`}>
                        {gstData?.advancePayment ? fmtINR(gstData.advancePayment) : '₹0.00'}
                      </div>
                    </div>
                  </div>
                  {detail && detail.openingBalance != null && detail.openingBalance !== 0 && (
                    <div className="mt-2 text-[10px] text-slate-500 dark:text-slate-400">
                      Opening balance of {fmtINR(Math.abs(detail.openingBalance))} carried forward from previous period
                    </div>
                  )}
                </div>

                {/* Grand Total */}
                <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl p-3 sm:p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[9px] text-emerald-600 dark:text-emerald-400 uppercase tracking-wider font-bold">Grand Total</div>
                      <div className="text-xl sm:text-2xl font-bold text-emerald-700 dark:text-emerald-300 tabular-nums mt-0.5">
                        {fmtINR(gstData?.totalCharges || 0)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[9px] text-slate-400">Discount</div>
                      <div className="text-xs font-bold text-teal-600 dark:text-teal-400 tabular-nums">-{fmtINR(gstData?.totalDiscount || 0)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[9px] text-slate-400">Closing Bal</div>
                      <div className={`text-xs font-bold tabular-nums ${(invoiceData.closingBalance || 0) > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                        {fmtINR(invoiceData.closingBalance || 0)}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {!invoiceData && !invoiceLoading && (
              <div className="text-center py-6 text-slate-400">
                <FileText className="size-8 mx-auto mb-2 opacity-40" />
                <p className="text-xs">Select a date range and click "Fetch Statement" to preview the invoice</p>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="px-5 sm:px-6 py-3 border-t border-slate-200 dark:border-slate-700 flex flex-wrap gap-2 shrink-0">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setInvoiceOpen(false)}>
            <X className="size-3" />Cancel
          </Button>
          <div className="flex-1" />
          <Popover>
            <PopoverTrigger asChild>
              <Button className="bg-emerald-600 hover:bg-emerald-700 gap-1.5" disabled={!invoiceData}>
                {invoiceLoading ? <Loader2 className="size-3 animate-spin" /> : <Printer className="size-3" />}
                Print Invoice <ChevronDown className="size-3" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-44 p-1" side="top">
              <button onClick={() => { setInvoiceOpen(false); printInvoice(invNo || undefined) }} className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md">
                <Printer className="size-3.5 text-slate-500" /><div className="text-left"><div className="font-medium">A4 Print Invoice</div><div className="text-[9px] text-slate-400">Standard paper</div></div>
              </button>
              <button onClick={() => { setInvoiceOpen(false); onThermalPrintInvoice?.(invNo || undefined) }} className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md">
                <Flame className="size-3.5 text-orange-500" /><div className="text-left"><div className="font-medium">Thermal Print</div><div className="text-[9px] text-slate-400">Receipt printer</div></div>
              </button>
            </PopoverContent>
          </Popover>
        </div>
      </DialogContent>
    </Dialog>

    {/* Document Dialog */}
    <Dialog open={docOpen} onOpenChange={setDocOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><FileUp className="size-4 text-emerald-600" />Documents</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">Type</Label><Select value={docForm.type} onValueChange={v => setDocForm({ ...docForm, type: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Aadhaar"><span>Aadhaar</span></SelectItem><SelectItem value="PAN"><span>PAN</span></SelectItem><SelectItem value="GST"><span>GST</span></SelectItem><SelectItem value="Agreement"><span>Agreement</span></SelectItem><SelectItem value="Receipt"><span>Receipt</span></SelectItem><SelectItem value="Invoice"><span>Invoice</span></SelectItem><SelectItem value="Contract"><span>Contract</span></SelectItem><SelectItem value="Photo"><span>Photo</span></SelectItem><SelectItem value="ID Proof"><span>ID Proof</span></SelectItem><SelectItem value="Address Proof"><span>Address Proof</span></SelectItem><SelectItem value="Medical"><span>Medical</span></SelectItem><SelectItem value="Custom"><span>Custom</span></SelectItem></SelectContent></Select></div>
            <div><Label className="text-xs">Name *</Label><Input value={docForm.name} onChange={e => setDocForm({ ...docForm, name: e.target.value })} placeholder="Document name" /></div>
          </div>
          <div><Label className="text-xs">URL / File Link</Label><Input value={docForm.url} onChange={e => setDocForm({ ...docForm, url: e.target.value })} placeholder="https://..." /></div>
          <div><Label className="text-xs">Notes</Label><Input value={docForm.notes} onChange={e => setDocForm({ ...docForm, notes: e.target.value })} placeholder="Optional notes" /></div>
        </div>
        <div className="max-h-56 overflow-auto border border-slate-100 dark:border-slate-700 rounded-lg mt-2">
          {detail?.documents.length === 0 ? (
            <div className="py-4 text-center text-muted-foreground text-[10px]">No documents uploaded yet</div>
          ) : detail?.documents.map(doc => (
            <div key={doc.id} className="flex items-center justify-between px-2.5 py-2.5 text-[11px] border-b border-slate-50 dark:border-slate-800 last:border-b-0">
              <div className="min-w-0 flex-1">
                <div className="font-medium text-slate-700 dark:text-slate-300 truncate flex items-center gap-1.5">
                  {doc.url ? (
                    <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-emerald-600 dark:text-emerald-400 hover:underline truncate" title="Click to preview">{doc.name}</a>
                  ) : (
                    <span className="truncate">{doc.name}</span>
                  )}
                </div>
                <div className="text-[9px] text-slate-400 mt-0.5 flex items-center gap-1.5">
                  <span className={`px-1.5 py-0.5 rounded text-[8px] font-medium ${DOC_TYPE_COLORS[doc.type] || 'bg-slate-100 dark:bg-slate-700 text-slate-500'}`}>{doc.type}</span>
                  <span>{fmtDate(doc.createdAt)}</span>
                  {doc.fileSize > 0 && <span>({(doc.fileSize / 1024).toFixed(1)} KB)</span>}
                </div>
                {doc.notes && <div className="text-[9px] text-slate-400 italic mt-0.5 truncate">{doc.notes}</div>}
              </div>
              <div className="flex items-center gap-1.5 shrink-0 ml-2">
                {doc.url && (
                  <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-emerald-600 transition-colors" title="Open/Preview">
                    <Eye className="size-3.5" />
                  </a>
                )}
                {canDelete && (
                  <button onClick={() => handleDeleteDoc(doc.id)} className="text-red-500 hover:text-red-700 transition-colors" title="Delete document">
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setDocOpen(false)}>Cancel</Button>
          <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleAddDoc} disabled={submitting || !docForm.name}>{submitting ? <Loader2 className="size-3 animate-spin" /> : 'Add Document'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Note Dialog */}
    <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><StickyNote className="size-4 text-emerald-600" />Notes</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">Type</Label><Select value={noteForm.type} onValueChange={v => setNoteForm({ ...noteForm, type: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Internal"><span>Internal</span></SelectItem><SelectItem value="Customer"><span>Customer</span></SelectItem><SelectItem value="Staff"><span>Staff</span></SelectItem><SelectItem value="Private"><span>Private</span></SelectItem><SelectItem value="Complaint"><span>Complaint</span></SelectItem><SelectItem value="Feedback"><span>Feedback</span></SelectItem><SelectItem value="FollowUp"><span>Follow Up</span></SelectItem></SelectContent></Select></div>
            {isAdmin && (
              <div className="flex items-center gap-2 pt-5">
                <Label className="text-xs flex items-center gap-1.5 cursor-pointer select-none">
                  <input type="checkbox" checked={noteForm.isPrivate} onChange={e => setNoteForm({ ...noteForm, isPrivate: e.target.checked })} className="rounded border-slate-300" />
                  <Lock className="size-3 text-slate-400" />
                  Private
                </Label>
              </div>
            )}
          </div>
          <div><Label className="text-xs">Content *</Label><Textarea value={noteForm.content} onChange={e => setNoteForm({ ...noteForm, content: e.target.value })} rows={3} placeholder="Write your note..." /></div>
        </div>
        <div className="max-h-56 overflow-auto border border-slate-100 dark:border-slate-700 rounded-lg mt-2">
          {detail?.notes.length === 0 ? (
            <div className="py-4 text-center text-muted-foreground text-[10px]">No notes added yet</div>
          ) : detail?.notes.map(note => (
            <div key={note.id} className="px-2.5 py-2.5 text-[11px] border-b border-slate-50 dark:border-slate-800 last:border-b-0">
              <div className="flex justify-between items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-slate-700 dark:text-slate-300 break-all flex items-center gap-1.5">
                    {note.isPrivate && <Lock className="size-3 text-amber-500 shrink-0" />}
                    <span className="break-all">{note.content}</span>
                  </div>
                  <div className="text-[9px] text-slate-400 mt-0.5 flex items-center gap-1.5">
                    <span className={`px-1.5 py-0.5 rounded text-[8px] font-medium ${NOTE_TYPE_COLORS[note.type] || 'bg-slate-100 dark:bg-slate-700 text-slate-500'}`}>{note.type}</span>
                    <span>{note.userName || ''}</span>
                    <span>— {fmtDate(note.createdAt)}</span>
                  </div>
                </div>
                {canDelete && (
                  <button onClick={() => handleDeleteNote(note.id)} className="text-red-500 hover:text-red-700 transition-colors shrink-0" title="Delete note">
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setNoteOpen(false)}>Cancel</Button>
          <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleAddNote} disabled={submitting || !noteForm.content}>{submitting ? <Loader2 className="size-3 animate-spin" /> : 'Add Note'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Delete Folio Confirmation */}
    <AlertDialog open={deleteFolioOpen} onOpenChange={setDeleteFolioOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Empty Folio?</AlertDialogTitle>
          <AlertDialogDescription>Permanently delete this empty folio? This cannot be undone.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={(e) => { e.preventDefault(); handleDeleteFolio() }} disabled={submitting}>{submitting ? <Loader2 className="size-3 animate-spin" /> : 'Delete Folio'}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    {/* Tags Dialog */}
    <Dialog open={tagsOpen} onOpenChange={setTagsOpen}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Tag className="size-4 text-emerald-600" />Customer Tags</DialogTitle></DialogHeader>
        <div className="flex flex-wrap gap-2 py-3">
          {ALL_TAGS.map(tag => {
            const active = customerTags.includes(tag)
            return (
              <button key={tag} onClick={() => handleToggleTag(tag)}
                className={`text-[11px] font-medium px-3 py-1.5 rounded-full border transition-all
                  ${active ? TAG_COLORS[tag] || TAG_COLORS.Regular : 'bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700 hover:border-slate-400'}`}
              >
                {active && '✓ '}{tag}
              </button>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>

    {/* ══════════════════════════════════════════════════════════ */}
    {/* ─── HISTORY FULL-SCREEN OVERLAY (per-customer checkout history) ──── */}
    {/* ══════════════════════════════════════════════════════════ */}
    {historyOpen && (
      <div className="fixed inset-0 z-[70] bg-background flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b bg-background shrink-0 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <History className="size-4 text-teal-600 shrink-0" />
            <div className="min-w-0">
              <h2 className="text-sm font-bold truncate">{detail?.fullName} — Checkout History</h2>
              <p className="text-[10px] text-muted-foreground truncate">
                {customerHistory ? `${customerHistory.totalRecords} checkout record${customerHistory.totalRecords !== 1 ? 's' : ''}` : 'Loading...'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setHistoryOpen(false)} className="p-1.5 rounded-md hover:bg-muted text-lg leading-none">✕</button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-4">
            {historyLoading ? (
              <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
                <Loader2 className="size-5 animate-spin" />
                <span className="text-sm">Loading history...</span>
              </div>
            ) : !customerHistory || customerHistory.checkoutRecords.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <History className="size-10 opacity-30 mb-3" />
                <p className="text-sm font-medium">No checkout history found</p>
                <p className="text-xs mt-1">Completed checkouts will appear here permanently</p>
              </div>
            ) : (
              customerHistory.checkoutRecords.map((co: CheckoutRecord, idx: number) => {
                const isExpanded = expandedFolioId === co.checkoutNumber
                return (
                  <div key={co.id} className="border rounded-xl overflow-hidden shadow-sm">
                    {/* Checkout Header */}
                    <button
                      onClick={() => setExpandedFolioId(isExpanded ? null : co.checkoutNumber)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-teal-100 dark:bg-teal-900/40 flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-teal-700 dark:text-teal-300">{idx + 1}</span>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold">Checkout #{idx + 1}</span>
                            <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{co.checkoutNumber}</span>
                            {(co.customInvoiceNumber || co.invoiceNumber) ? (
                              <span className="text-[10px] font-mono text-teal-600 bg-teal-50 dark:bg-teal-900/20 px-1.5 py-0.5 rounded font-semibold">Inv: {co.customInvoiceNumber || co.invoiceNumber}</span>
                            ) : null}
                          </div>
                          <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                            <span>{fmtDateTime(co.checkoutDate)}</span>
                            <span>•</span>
                            <span>Visit #{co.visitNumber}</span>
                            <span>•</span>
                            <span>Folios: {co.folioNumbers.map(n => `#${n}`).join(', ')}</span>
                            <span>•</span>
                            <span>{co.checkoutUser}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{fmtCur(co.totalPayments)}</span>
                        <ChevronDown className={`size-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </div>
                    </button>

                    {/* Financial Summary (always visible) */}
                    <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5 px-4 pb-3">
                      <StatBox label="Charges" value={fmtCur(co.totalCharges)} color="text-red-600" />
                      <StatBox label="Payments" value={fmtCur(co.totalPayments)} color="text-emerald-600" />
                      <StatBox label="Tax" value={fmtCur(co.totalTax)} color="text-amber-600" />
                      <StatBox label="Discount" value={fmtCur(co.totalDiscount)} color="text-orange-600" />
                      <StatBox label="Settlements" value={fmtCur(co.totalSettlements)} color="text-blue-600" />
                      <StatBox label="Refunds" value={fmtCur(co.totalRefunds)} color="text-purple-600" />
                      <StatBox label="Opening" value={fmtCur(co.openingBalance)} color="text-muted-foreground" />
                      <StatBox label="Closing" value={fmtCur(co.closingBalance)} color={co.closingBalance > 0 ? 'text-red-600' : 'text-emerald-600'} />
                    </div>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="border-t">
                        {/* Customer & Checkout Info */}
                        <div className="px-4 py-3 bg-muted/20 grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
                          <div>
                            <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Customer Details</div>
                            <div className="space-y-0.5">
                              <div><span className="text-muted-foreground">Name:</span> <span className="font-medium">{co.customerName}</span></div>
                              {co.customerMobile && <div><span className="text-muted-foreground">Mobile:</span> {co.customerMobile}</div>}
                              {co.customerEmail && <div><span className="text-muted-foreground">Email:</span> {co.customerEmail}</div>}
                              {co.customerAddress && <div><span className="text-muted-foreground">Address:</span> {co.customerAddress}</div>}
                              {co.customerGstNumber && <div><span className="text-muted-foreground">GSTIN:</span> <span className="font-mono">{co.customerGstNumber}</span></div>}
                              {co.customerType && <div><span className="text-muted-foreground">Type:</span> {co.customerType}</div>}
                            </div>
                          </div>
                          <div>
                            <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Checkout Info</div>
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1.5">
                                <span className="text-muted-foreground">Set Invoice No:</span>
                                {editingInvoiceId === co.id ? (
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="text"
                                      value={editInvoiceValue}
                                      onChange={(e) => setEditInvoiceValue(e.target.value)}
                                      onKeyDown={(e) => { if (e.key === 'Enter') saveCustomInvoiceNumber(co); if (e.key === 'Escape') setEditingInvoiceId(null) }}
                                      className="h-6 text-[10px] font-mono border rounded px-1.5 w-[140px] bg-background"
                                      autoFocus
                                    />
                                    {savingInvoiceNum ? <Loader2 className="size-3 animate-spin text-muted-foreground" /> : (
                                      <>
                                        <button onClick={() => saveCustomInvoiceNumber(co)} className="p-0.5 rounded hover:bg-green-100 text-green-600"><CheckCircle2 className="size-3" /></button>
                                        <button onClick={() => setEditingInvoiceId(null)} className="p-0.5 rounded hover:bg-red-100 text-red-500"><X className="size-3" /></button>
                                      </>
                                    )}
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => { setEditingInvoiceId(co.id); setEditInvoiceValue(co.customInvoiceNumber || '') }}
                                    className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-dashed border-muted-foreground/40 hover:border-teal-500 hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-colors min-w-[80px] text-left"
                                    title="Click to set custom invoice number"
                                  >
                                    {co.customInvoiceNumber || <span className="text-muted-foreground italic">Click to set...</span>}
                                  </button>
                                )}
                              </div>
                              <div><span className="text-muted-foreground">Date:</span> {fmtDateTime(co.checkoutDate)}</div>
                              <div><span className="text-muted-foreground">User:</span> {co.checkoutUser}</div>
                              <div><span className="text-muted-foreground">Transactions:</span> {co.transactions.length}</div>
                              {co.remarks && <div><span className="text-muted-foreground">Remarks:</span> {co.remarks}</div>}
                            </div>
                          </div>
                        </div>

                        {/* Payment Mode Breakdown */}
                        {Object.keys(co.paymentBreakdown).length > 0 && (
                          <div className="px-4 py-2 border-t bg-muted/10">
                            <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Payment Mode Breakdown</div>
                            <div className="flex flex-wrap gap-2">
                              {Object.entries(co.paymentBreakdown).map(([mode, amount]) => (
                                <span key={mode} className="text-[10px] bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 px-2 py-1 rounded-md font-medium">
                                  {mode}: {fmtCur(amount)}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Print Buttons */}
                        <div className="px-4 py-2 border-t flex items-center gap-2 flex-wrap">
                          <button
                            onClick={() => printCheckoutFolioBill(co)}
                            className="flex items-center gap-1.5 text-[10px] px-3 py-1.5 rounded-md bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-900/30 font-medium transition-colors"
                          >
                            <Receipt className="size-3" />Folio Bill (All Txns)
                          </button>
                          <button
                            onClick={() => printCheckoutInvoice(co)}
                            className="flex items-center gap-1.5 text-[10px] px-3 py-1.5 rounded-md bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-900/30 font-medium transition-colors"
                          >
                            <Stamp className="size-3" />Tax Invoice (With Balances)
                          </button>
                        </div>

                        {/* Transaction Table */}
                        {co.transactions.length > 0 && (
                          <div className="border-t">
                            <div className="px-4 py-1.5 bg-muted/30 text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
                              All Checkout Transactions ({co.transactions.length})
                            </div>
                            <div className="max-h-80 overflow-auto">
                              <table className="w-full text-[10px]">
                                <thead className="sticky top-0 bg-muted/80">
                                  <tr>
                                    <th className="text-left px-2 py-1.5 font-semibold text-muted-foreground">#</th>
                                    <th className="text-left px-2 py-1.5 font-semibold text-muted-foreground">Date</th>
                                    <th className="text-left px-2 py-1.5 font-semibold text-muted-foreground">Type</th>
                                    <th className="text-left px-2 py-1.5 font-semibold text-muted-foreground">Description</th>
                                    <th className="text-left px-2 py-1.5 font-semibold text-muted-foreground">Mode</th>
                                    <th className="text-right px-2 py-1.5 font-semibold text-muted-foreground">Dr</th>
                                    <th className="text-right px-2 py-1.5 font-semibold text-muted-foreground">Cr</th>
                                    <th className="text-right px-2 py-1.5 font-semibold text-muted-foreground">Bal</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {co.transactions.map((e: any, i: number) => (
                                    <tr key={e.id || i} className="border-t hover:bg-muted/30">
                                      <td className="px-2 py-1 text-muted-foreground">{i + 1}</td>
                                      <td className="px-2 py-1 whitespace-nowrap">{e.date}</td>
                                      <td className="px-2 py-1"><span className={`text-[8px] px-1 py-0.5 rounded font-medium ${TYPE_ICON[e.type] || 'bg-muted text-muted-foreground'}`}>{e.type}</span></td>
                                      <td className="px-2 py-1 truncate max-w-[200px]">{stripInternalDescriptions(e.description)}</td>
                                      <td className="px-2 py-1 text-muted-foreground whitespace-nowrap">{e.paymentMode || '—'}</td>
                                      <td className="px-2 py-1 text-right text-red-600 tabular-nums">{e.debit > 0 ? fmtINR(e.debit) : ''}</td>
                                      <td className="px-2 py-1 text-right text-emerald-600 tabular-nums">{e.credit > 0 ? fmtINR(e.credit) : ''}</td>
                                      <td className={`px-2 py-1 text-right font-bold tabular-nums ${e.balance > 0 ? 'text-red-600' : e.balance < 0 ? 'text-emerald-600' : 'text-muted-foreground'}`}>{fmtINR(e.balance)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {/* Settlements */}
                        {co.settlements.length > 0 && (
                          <div className="border-t">
                            <div className="px-4 py-1.5 bg-muted/30 text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
                              Settlements ({co.settlements.length})
                            </div>
                            <div className="px-4 py-2">
                              <table className="w-full text-[10px]">
                                <thead>
                                  <tr className="bg-muted/50">
                                    <th className="text-left px-2 py-1.5 font-semibold text-muted-foreground">Date</th>
                                    <th className="text-left px-2 py-1.5 font-semibold text-muted-foreground">Mode</th>
                                    <th className="text-left px-2 py-1.5 font-semibold text-muted-foreground">Reference</th>
                                    <th className="text-left px-2 py-1.5 font-semibold text-muted-foreground">Description</th>
                                    <th className="text-right px-2 py-1.5 font-semibold text-muted-foreground">Amount</th>
                                    <th className="text-left px-2 py-1.5 font-semibold text-muted-foreground">By</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {co.settlements.map((s: any, i: number) => (
                                    <tr key={s.id || i} className="border-t">
                                      <td className="px-2 py-1 whitespace-nowrap">{s.createdAt ? fmtDate(String(s.createdAt).split('T')[0]) : '—'}</td>
                                      <td className="px-2 py-1">{s.mode}</td>
                                      <td className="px-2 py-1 text-muted-foreground">{s.reference || '—'}</td>
                                      <td className="px-2 py-1 truncate max-w-[150px]">{s.description || '—'}</td>
                                      <td className="px-2 py-1 text-right font-bold text-emerald-600 tabular-nums">{fmtCur(s.amount)}</td>
                                      <td className="px-2 py-1 text-muted-foreground">{s.userName || '—'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    )}

    {/* ══════════════════════════════════════════════════════════ */}
    {/* ─── DETAILS SHEET (slides in from right) ─────────────────── */}
    {/* ══════════════════════════════════════════════════════════ */}
    {detail && (
      <Sheet open={detailsSheetOpen} onOpenChange={setDetailsSheetOpen}>
        <SheetContent className="w-[320px] sm:w-[360px] p-0 overflow-y-auto">
          <SheetHeader className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 sticky top-0 z-10">
            <SheetTitle className="flex items-center gap-2 text-sm font-bold">
              <Eye className="size-4 text-slate-500 dark:text-slate-400" /> Customer Details
            </SheetTitle>
          </SheetHeader>
          <div className="p-4 space-y-4">
            {/* Guest Info */}
            <div className="space-y-2.5">
              <h4 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Guest Information</h4>
              <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 space-y-2 border border-slate-100 dark:border-slate-700">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-800 dark:bg-slate-600 flex items-center justify-center text-sm font-bold text-white">{detail.fullName.charAt(0).toUpperCase()}</div>
                  <div>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{detail.fullName}</p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">{detail.customerId}</p>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="text-[11px]"><span className="text-slate-500 dark:text-slate-400">Type</span><div><span className={`font-semibold text-[10px] px-2 py-0.5 rounded-md ${TYPE_BADGE[detail.customerType] || TYPE_BADGE.Retail}`}>{detail.customerType}</span></div></div>
                <div className="text-[11px]"><span className="text-slate-500 dark:text-slate-400">Status</span><div><span className={`font-semibold text-[10px] px-2 py-0.5 rounded-md ${STATUS_BADGE[detail.status] || STATUS_BADGE.Active}`}>{detail.status}</span></div></div>
                {detail.mobile && <div className="text-[11px]"><span className="text-slate-500 dark:text-slate-400">Mobile</span><div className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1"><Phone className="size-3 text-slate-400" />{detail.mobile}</div></div>}
                {detail.email && <div className="text-[11px]"><span className="text-slate-500 dark:text-slate-400">Email</span><div className="font-semibold text-slate-700 dark:text-slate-300 text-[10px] truncate">{detail.email}</div></div>}
              </div>
              {/* GST, PAN, Aadhaar Details */}
              {(detail.gstNumber || detail.panNumber || detail.aadhaarNumber) && (
                <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-600">
                  <div className="grid grid-cols-1 gap-1.5">
                    {detail.gstNumber && <div className="flex items-center gap-2 text-[11px] bg-emerald-50 dark:bg-emerald-900/20 rounded-lg px-2.5 py-1.5 border border-emerald-100 dark:border-emerald-800/50"><span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">GSTIN</span><span className="font-mono font-semibold text-slate-700 dark:text-slate-300 text-[10px]">{detail.gstNumber}</span></div>}
                    {detail.panNumber && <div className="flex items-center gap-2 text-[11px]"><span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">PAN</span><span className="font-mono font-semibold text-slate-700 dark:text-slate-300 text-[10px]">{detail.panNumber}</span></div>}
                    {detail.aadhaarNumber && <div className="flex items-center gap-2 text-[11px]"><span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Aadhaar</span><span className="font-mono font-semibold text-slate-700 dark:text-slate-300 text-[10px]">{detail.aadhaarNumber}</span></div>}
                  </div>
                </div>
              )}
              {/* Advance / Credit Balance */}
              {bal < 0 && (
                <div className="mt-2 flex items-center gap-2 text-[11px] bg-green-50 dark:bg-green-900/20 rounded-lg px-2.5 py-1.5 border border-green-200 dark:border-green-800/50">
                  <Wallet className="size-3.5 text-green-600 dark:text-green-400" />
                  <span className="font-bold text-green-700 dark:text-green-300">Advance: {fmtCur(Math.abs(bal))}</span>
                </div>
              )}
            </div>

            <Separator className="bg-slate-100 dark:bg-slate-700" />

            {/* Folio Info */}
            <div className="space-y-2.5">
              <h4 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Folio</h4>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div><span className="text-slate-500 dark:text-slate-400">Folio No</span><div className="font-mono font-semibold text-slate-700 dark:text-slate-300">{fmtFolioNum(detail.activeFolio?.folioNumber)}</div></div>
                <div><span className="text-slate-500 dark:text-slate-400">Status</span><div><span className={`font-semibold text-[10px] px-2 py-0.5 rounded-md ${detail.activeFolio?.status === 'Active' ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'}`}>{detail.activeFolio?.status || '—'}</span></div></div>
                <div><span className="text-slate-500 dark:text-slate-400">Total Folios</span><div className="font-semibold text-slate-700 dark:text-slate-300">{allFolios.length}</div></div>
              </div>
            </div>

            <Separator className="bg-slate-100 dark:bg-slate-700" />

            {/* Balance Card */}
            <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 space-y-2 border border-slate-100 dark:border-slate-700">
              <h4 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Balance Summary</h4>
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-slate-500 dark:text-slate-400">Current Balance</span>
                <span className={`font-bold text-base tabular-nums ${bal > 0 ? 'text-red-600' : bal < 0 ? 'text-green-600' : 'text-slate-500 dark:text-slate-400'}`}>
                  {bal > 0 ? '+' : bal < 0 ? '-' : ''}{fmtCur(bal)}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-white dark:bg-slate-700 rounded-lg p-2 text-center">
                  <div className="text-[9px] text-slate-400 dark:text-slate-500">Revenue</div>
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-300">{fmtCur(detail.lifetimeRevenue)}</div>
                </div>
                <div className="bg-white dark:bg-slate-700 rounded-lg p-2 text-center">
                  <div className="text-[9px] text-slate-400 dark:text-slate-500">Payments</div>
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-300">{fmtCur(detail.lifetimePayments)}</div>
                </div>
                <div className="bg-white dark:bg-slate-700 rounded-lg p-2 text-center">
                  <div className="text-[9px] text-slate-400 dark:text-slate-500">Refunds</div>
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-300">{fmtCur(detail.lifetimeRefunds)}</div>
                </div>
                <div className="bg-white dark:bg-slate-700 rounded-lg p-2 text-center">
                  <div className="text-[9px] text-slate-400 dark:text-slate-500">Transactions</div>
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-300">{detail.totalTransactions}</div>
                </div>
              </div>
            </div>

            <Separator className="bg-slate-100 dark:bg-slate-700" />

            {/* Visits */}
            <div className="space-y-2.5">
              <h4 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Activity</h4>
              <div className="text-[11px]"><span className="text-slate-500 dark:text-slate-400">Total Visits</span><div className="font-semibold text-slate-700 dark:text-slate-300">{detail.totalVisits}</div></div>
              {detail.lastVisitDate && <div className="text-[11px]"><span className="text-slate-500 dark:text-slate-400">Last Visit</span><div className="font-semibold text-slate-700 dark:text-slate-300">{relTime(detail.lastVisitDate)}</div></div>}
              {detail.lastTxnDate && <div className="text-[11px]"><span className="text-slate-500 dark:text-slate-400">Last Txn</span><div className="font-semibold text-slate-700 dark:text-slate-300">{relTime(detail.lastTxnDate)}</div></div>}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    )}
    </>
  )
}