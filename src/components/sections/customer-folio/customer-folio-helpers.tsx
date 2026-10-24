// ─── Customer Folio Helpers, Constants & Shared Components ───

import React from 'react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { RefreshCw, AlertCircle } from 'lucide-react'

// ─── Formatters ───
export const roundBal = (v: number) => Math.round((v || 0) * 100) / 100

export const fmtCur = (v: number) => `₹${Math.round(Math.abs(v || 0)).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`

export const fmtDate = (s: string) => {
  if (!s) return '—'
  try {
    const d = new Date(s)
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
  } catch { return s }
}

export const fmtDateTime = (s: string) => {
  if (!s) return '—'
  try {
    const d = new Date(s)
    return `${fmtDate(s)} ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`
  } catch { return s }
}

export const fmtINR = (v: number) => `₹${Math.round(Math.abs(v || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

// ─── Folio Number Formatter ───
// folioNumber 0 → "0000" (legacy Master Folio)
// folioNumber 1-9999 → padded to 4 digits: "0001", "0002", ... "9999"
// folioNumber 10000-9999999 → raw number (max 7 digits)
// Master Folio tab is a virtual concept showing all folios combined
export const fmtFolioNum = (n: number | undefined) => {
  if (n === undefined || n === null) return '—'
  if (n <= 0) return '0000'
  const str = String(n)
  if (str.length > 7) return str.slice(-7) // Cap at 7 digits
  return str.padStart(4, '0')  // Pad to 4 digits for clean display
}

// ─── All Payment Modes ───
export const ALL_PAYMENT_MODES = [
  'Cash', 'UPI', 'Credit Card', 'Debit Card', 'Bank Transfer', 'Wallet',
  'Cheque', 'Bill to Staff', 'Bill to Company', 'Room Charge',
  'BTC (Bitcoin)', 'Other Cryptocurrency', 'Other',
] as const

// Strip ALL internal/system-generated descriptions from printed output
export const stripInternalDescriptions = (desc: string) => {
  if (!desc) return '—'
  return desc
    .replace(/\s*\[Transferred[^\]]*\]/gi, '')
    .replace(/\s*\[Shifted to [^\]]+\]/g, '')
    .replace(/\s*\[Split[^\]]*\]/gi, '')
    .replace(/^Split payment via .+/i, '')
    .replace(/^Auto-settlement via .+/i, '')
    .replace(/^\[Split: Split Amount\]/gi, '')
    .replace(/\s*\(shifted\)/gi, '')
    .trim() || '—'
}
// Keep old name for backward compat
export const stripShiftText = stripInternalDescriptions

export const relTime = (s: string) => {
  if (!s) return ''
  const n = new Date()
  const d = new Date(s)
  const ms = n.getTime() - d.getTime()
  const m = Math.floor(ms / 60000)
  const h = Math.floor(m / 60)
  const dy = Math.floor(h / 24)
  if (m < 1) return 'Just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (dy < 7) return `${dy}d ago`
  return fmtDate(s)
}

// ─── Badge Colors (dark-mode-safe) ───
export const TYPE_BADGE: Record<string, string> = {
  Retail: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  Wholesale: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
  Supplier: 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300',
  Corporate: 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300',
  VIP: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300',
}

export const STATUS_BADGE: Record<string, string> = {
  Active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
  Settled: 'bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-300',
  CheckedOut: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  Archived: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300',
}

export const TAG_COLORS: Record<string, string> = {
  VIP: 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/50 dark:text-yellow-300 dark:border-yellow-700',
  Premium: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/50 dark:text-purple-300 dark:border-purple-700',
  Regular: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700',
  Wholesale: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/50 dark:text-amber-300 dark:border-amber-700',
  Supplier: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/50 dark:text-orange-300 dark:border-orange-700',
  'High Risk': 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/50 dark:text-red-300 dark:border-red-700',
  Blocked: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/50 dark:text-red-300 dark:border-red-700',
}

export const ALL_TAGS = ['VIP', 'Premium', 'Regular', 'Wholesale', 'Supplier', 'High Risk', 'Blocked']
export const FILTER_TABS = ['All', 'Active', 'Due', 'Settled', 'Checkout', 'Archived', 'VIP']

export const TYPE_ICON: Record<string, string> = {
  Charge: 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/40',
  Payment: 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-900/40',
  Refund: 'text-orange-600 bg-orange-50 dark:text-orange-400 dark:bg-orange-900/40',
  Discount: 'text-teal-600 bg-teal-50 dark:text-teal-400 dark:bg-teal-900/40',
  Settlement: 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/40',
  Transfer: 'text-purple-600 bg-purple-50 dark:text-purple-400 dark:bg-purple-900/40',
  Opening: 'text-gray-600 bg-gray-50 dark:text-gray-400 dark:bg-gray-800',
}

// ─── Default form values ───
export const DEFAULT_CUSTOMER_FORM = {
  fullName: '', mobile: '', whatsapp: '', email: '', address: '', customerType: 'Retail' as string,
  creditLimit: 0, internalNotes: '', gstNumber: '', gstAddress: '', panNumber: '', aadhaarNumber: '', openingBalance: 0,
}

export const DEFAULT_CHARGE_FORM = { description: '', amount: '', chargeType: 'Product', tax: '18', invoiceNo: '', taxEnabled: false, taxType: 'exclude' as const, selectedItem: '', selectedItemPrice: '' }
export const DEFAULT_PAYMENT_FORM = { amount: '', mode: 'Cash', reference: '', description: '' }
export const DEFAULT_REFUND_FORM = { amount: '', reason: 'Partial Refund', description: '', invoiceNo: '' }
export const DEFAULT_TRANSFER_FORM = { targetCustomerId: '', targetName: '', amount: '', description: '' }
export const DEFAULT_DISCOUNT_FORM = { discountType: 'Fixed', amount: '', description: '', requiresApproval: false }
export const DEFAULT_DOC_FORM = { type: 'Aadhaar', name: '', url: '', notes: '' }
export const DEFAULT_NOTE_FORM = { type: 'Internal', content: '', isPrivate: false, isImportant: false }
export const DEFAULT_SPLIT_AMOUNT_FORM = { amount: '', targetFolioId: '' }

// ─── Toolbar Button (defined OUTSIDE component to avoid re-creation) ───
export function ToolBtn({ icon: Icon, label, color, onClick, disabled, badge }: {
  icon: React.ElementType; label: string; color?: string; onClick: () => void; disabled?: boolean; badge?: number
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onClick() }}
          disabled={disabled}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-all whitespace-nowrap border
            ${disabled ? 'opacity-35 cursor-not-allowed text-slate-300 dark:text-slate-600 border-slate-100 dark:border-slate-800' : 'cursor-pointer text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-100 hover:border-slate-300 dark:hover:border-slate-700 border-transparent'}
            ${color === 'red' && !disabled ? 'text-red-500 bg-red-50 border-red-200/60 hover:bg-red-100 hover:text-red-600 dark:text-red-400 dark:bg-red-900/30 dark:border-red-800/60 dark:hover:bg-red-900/50 dark:hover:text-red-300' : ''}
            ${color === 'amber' && !disabled ? 'text-amber-600 bg-amber-50 border-amber-200/60 hover:bg-amber-100 hover:text-amber-700 dark:text-amber-400 dark:bg-amber-900/30 dark:border-amber-800/60 dark:hover:bg-amber-900/50 dark:hover:text-amber-300' : ''}
            ${color === 'orange' && !disabled ? 'text-orange-600 bg-orange-50 border-orange-200/60 hover:bg-orange-100 hover:text-orange-700 dark:text-orange-400 dark:bg-orange-900/30 dark:border-orange-800/60 dark:hover:bg-orange-900/50 dark:hover:text-orange-300' : ''}
            ${color === 'teal' && !disabled ? 'text-teal-600 bg-teal-50 border-teal-200/60 hover:bg-teal-100 hover:text-teal-700 dark:text-teal-400 dark:bg-teal-900/30 dark:border-teal-800/60 dark:hover:bg-teal-900/50 dark:hover:text-teal-300' : ''}
          `}
        >
          <Icon className="size-3.5 shrink-0" />
          <span className="hidden sm:inline">{label}</span>
          {badge != null && badge > 0 && (
            <span className="ml-0.5 px-1 py-0 text-[8px] font-bold rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 min-w-[14px] text-center">{badge}</span>
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-[10px]">{label}</TooltipContent>
    </Tooltip>
  )
}

// ─── Error Boundary ───
export class FolioErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: Error | null }> {
  state = { hasError: false, error: null as Error | null }
  static getDerivedStateFromError(error: Error) { return { hasError: true, error } }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[CustomerFolio] Error:', error?.name, error?.message, error?.stack, info.componentStack)
    // Also expose error details on window for debugging
    if (typeof window !== 'undefined') {
      (window as any).__folioError = { name: error?.name, message: error?.message, stack: error?.stack, componentStack: info.componentStack }
    }
  }
  render() {
    if (this.state.hasError) {
      const errMsg = this.state.error?.message || this.state.error?.name || 'An unexpected error occurred'
      const errStack = this.state.error?.stack || ''
      // Extract the meaningful line from stack trace
      const stackLines = errStack.split('\n').filter((l: string) => l.includes('src/')).slice(0, 3).map((l: string) => l.trim())
      return (
        <div className="flex flex-col items-center justify-center py-16 p-6">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-red-100 dark:bg-red-900/30 mb-4"><AlertCircle className="size-7 text-red-500" /></div>
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">Something went wrong</h3>
          <p className="text-xs text-red-500 dark:text-red-400 mb-2 max-w-lg text-center font-mono break-all">{errMsg}</p>
          {stackLines.length > 0 && (
            <pre className="text-[10px] text-slate-400 dark:text-slate-500 max-w-lg text-center overflow-x-auto mb-4 whitespace-pre-wrap">{stackLines.join('\n')}</pre>
          )}
          <Button variant="outline" size="sm" onClick={() => this.setState({ hasError: false, error: null })} className="gap-1.5"><RefreshCw className="size-3" />Retry</Button>
        </div>
      )
    }
    return this.props.children
  }
}
