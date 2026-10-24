'use client'

import React from 'react'
import {
  ArrowLeft, BookOpen, Plus, Loader2, TrendingUp, TrendingDown, CheckCircle,
  ReceiptText, FileCheck2, FileText, CircleDollarSign, Landmark, Wallet,
  LogOut, ArrowDownLeft, ArrowRightLeft, ArrowDownToLine, Split, Trash2,
  Edit3, Eye, Tag, StickyNote, FileUp, Percent, Printer,
  Phone, Mail, Calendar, CreditCard, User, Layers, Flame,
  History, ChevronDown, ShieldAlert, Star,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { fmtCur, fmtDate, fmtINR, TYPE_ICON, fmtFolioNum } from './customer-folio-helpers'
import type { CustomerDetail, Folio, LedgerEntry } from './customer-folio-types'

// ─── Action Button for bottom bar (light-mode safe) ───
function ActionBtn({ icon: Icon, label, color, onClick, disabled, badge }: {
  icon: React.ElementType; label: string; color?: string; onClick: () => void; disabled?: boolean; badge?: number
}) {
  const colorMap: Record<string, string> = {
    red: 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100 hover:text-red-800 hover:border-red-300 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-900/50 dark:hover:text-red-300',
    amber: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 hover:text-amber-800 hover:border-amber-300 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800 dark:hover:bg-amber-900/50 dark:hover:text-amber-300',
    orange: 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100 hover:text-orange-800 hover:border-orange-300 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-800 dark:hover:bg-orange-900/50 dark:hover:text-orange-300',
    teal: 'bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100 hover:text-teal-800 hover:border-teal-300 dark:bg-teal-950/40 dark:text-teal-400 dark:border-teal-800 dark:hover:bg-teal-900/50 dark:hover:text-teal-300',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 hover:text-emerald-800 hover:border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800 dark:hover:bg-emerald-900/50 dark:hover:text-emerald-300',
  }

  const baseClass = 'flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap border cursor-pointer select-none'
  const disabledClass = 'opacity-35 cursor-not-allowed bg-slate-100 text-slate-400 border-slate-200 dark:bg-slate-800 dark:text-slate-600 dark:border-slate-700'
  const activeClass = colorMap[color || ''] || 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200 hover:text-slate-800 hover:border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-200'

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onClick() }}
          disabled={disabled}
          className={`${baseClass} ${disabled ? disabledClass : activeClass}`}
        >
          <Icon className="size-3.5 shrink-0" />
          <span className="hidden sm:inline">{label}</span>
          {badge != null && badge > 0 && (
            <span className="ml-0.5 px-1.5 py-0.5 text-[9px] font-bold rounded-full bg-slate-200 text-slate-700 dark:bg-slate-600 dark:text-slate-200 min-w-[16px] text-center">{badge}</span>
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-[10px]">{label}</TooltipContent>
    </Tooltip>
  )
}

// ─── Print Options Dropdown (Popover with A4 + Thermal) ───
function PrintOptionsBtn({ icon: Icon, label, color, onA4, onThermal, disabled }: {
  icon: React.ElementType; label: string; color?: string;
  onA4: () => void; onThermal: () => void; disabled?: boolean
}) {
  const colorMap: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 hover:text-emerald-800 hover:border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800 dark:hover:bg-emerald-900/50 dark:hover:text-emerald-300',
    teal: 'bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100 hover:text-teal-800 hover:border-teal-300 dark:bg-teal-950/40 dark:text-teal-400 dark:border-teal-800 dark:hover:bg-teal-900/50 dark:hover:text-teal-300',
  }

  const baseClass = 'flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap border cursor-pointer select-none'
  const disabledClass = 'opacity-35 cursor-not-allowed bg-slate-100 text-slate-400 border-slate-200 dark:bg-slate-800 dark:text-slate-600 dark:border-slate-700'
  const activeClass = colorMap[color || ''] || 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200 hover:text-slate-800 hover:border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-200'

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              type="button"
              disabled={disabled}
              className={`${baseClass} ${disabled ? disabledClass : activeClass}`}
            >
              <Icon className="size-3.5 shrink-0" />
              <span className="hidden sm:inline">{label}</span>
              <ChevronDown className="size-3 shrink-0 opacity-50" />
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-[10px]">{label}</TooltipContent>
      </Tooltip>
      <PopoverContent className="w-44 p-1" side="top" align="start">
        <button
          onClick={(e) => { e.stopPropagation(); onA4() }}
          className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors"
        >
          <Printer className="size-3.5 text-slate-500" />
          <div className="text-left">
            <div className="font-medium">A4 Print</div>
            <div className="text-[9px] text-slate-400">Standard paper size</div>
          </div>
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onThermal() }}
          className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors"
        >
          <Flame className="size-3.5 text-orange-500" />
          <div className="text-left">
            <div className="font-medium">Thermal Print</div>
            <div className="text-[9px] text-slate-400">Receipt printer</div>
          </div>
        </button>
      </PopoverContent>
    </Popover>
  )
}

// ─── Props ───
interface FolioManagementProps {
  detail: CustomerDetail
  allFolios: Folio[]
  folioEntries: LedgerEntry[]
  selectedEntries: Set<string>
  selectedFolioId: string | null
  folioEntriesLoading: boolean
  submitting: boolean
  isFullscreen: boolean
  isAdmin: boolean
  isActive: boolean
  isCheckedOut: boolean
  forceEditMode: boolean
  canForceEdit: boolean
  canRemove: boolean
  canTransfer: boolean
  folioStatementData: any
  masterFolioEntries: LedgerEntry[]
  onCheckoutSettlement: () => void
  onToggleForceEdit: () => void

  // Handlers
  goBack: () => void
  setSelectedFolioId: (id: string) => void
  setSelectedEntries: (ids: Set<string>) => void
  fetchFolioEntries: (customerId: string, fId: string) => void
  toggleEntrySelection: (id: string) => void
  toggleAllEntries: () => void
  handleCreateFolio: () => void
  printReceipt: () => void
  printSingleFolio: () => void
  fetchFolioStatement: (folioId: string) => void
  onPrintFolioStatement?: (folioId: string) => void

  onDeleteFolio?: (folioId: string) => void

  // Dialog openers
  onVoucher: () => void
  onInvoice: () => void
  onCharge: () => void
  onSettlement: () => void
  onPayment: () => void
  onCheckout: () => void
  onRefund: () => void
  onDiscount: () => void
  onTransfer: () => void
  onShift: () => void
  onSplit: () => void
  onRemove: () => void
  onEdit: () => void
  onDetails: () => void
  onTags: () => void
  onNotes: () => void
  onDocs: () => void
  onDelete: () => void
  onPermanentDelete?: () => void
  onHistory: () => void

  // Thermal print handlers
  thermalPrintReceipt?: () => void
  thermalPrintInvoice?: () => void
  thermalPrintFolio?: () => void
  thermalPrintVoucher?: () => void
}

export function CustomerFolioManagement({
  detail, allFolios, folioEntries, selectedEntries, selectedFolioId,
  folioEntriesLoading, submitting, isFullscreen, isAdmin, isActive, isCheckedOut,
  forceEditMode, canForceEdit, canRemove, canTransfer,
  folioStatementData, masterFolioEntries, onCheckoutSettlement, onToggleForceEdit,
  goBack, setSelectedFolioId, setSelectedEntries, fetchFolioEntries,
  toggleEntrySelection, toggleAllEntries, handleCreateFolio,
  printReceipt, printSingleFolio, fetchFolioStatement, onPrintFolioStatement,
  onVoucher, onInvoice, onCharge, onSettlement, onPayment, onCheckout,
  onDeleteFolio,
  onRefund, onDiscount, onTransfer, onShift, onSplit, onRemove, onEdit,
  onDetails, onTags, onNotes, onDocs, onDelete, onPermanentDelete, onHistory,
  thermalPrintReceipt, thermalPrintInvoice, thermalPrintFolio, thermalPrintVoucher,
}: FolioManagementProps) {
  // Only show Active folios in tabs — old folios are accessible via History
  const activeFolios = allFolios.filter(f => f.status === 'Active')
  const bal = detail?.balance ?? 0
  const selectedFolio = allFolios.find(f => f.id === selectedFolioId)
  const selectedEntryObj = selectedEntries.size === 1 ? folioEntries.find(e => e.id === Array.from(selectedEntries)[0]) : null
  const displayEntries = selectedFolioId === 'master' ? masterFolioEntries : folioEntries

  const folioTotalDebits = displayEntries.reduce((s, e) => s + (e.debit || 0), 0)
  const folioTotalCredits = displayEntries.reduce((s, e) => s + (e.credit || 0), 0)
  const folioTotalTax = displayEntries.reduce((s, e) => s + (e.tax || 0), 0)
  const folioCurrentBalance = displayEntries.length > 0 ? displayEntries[displayEntries.length - 1].balance : 0

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* ── Customer Profile Header ── */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-4 py-3 shrink-0">
        <div className="flex items-center gap-3">
          {/* Back button */}
          <button onClick={goBack} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors font-medium">
            <ArrowLeft className="size-3.5" />
            <span className="hidden sm:inline">Back</span>
          </button>

          <Separator orientation="vertical" className="h-8 bg-slate-200 dark:bg-slate-700" />

          {/* Avatar */}
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-white text-sm font-bold shadow-sm shrink-0">
            {detail.fullName.charAt(0).toUpperCase()}
          </div>

          {/* Customer Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">{detail.fullName}</h3>
              <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">{detail.customerId}</span>
              <span className={`text-[9px] px-2 py-0.5 rounded-md font-semibold ${
                detail.status === 'Active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300' :
                detail.status === 'CheckedOut' ? 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400' :
                'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
              }`}>{detail.status === 'CheckedOut' ? 'Checked Out' : detail.status}</span>
            </div>
            <div className="flex items-center gap-4 mt-1 text-xs text-slate-500 dark:text-slate-400">
              {detail.mobile && (
                <span className="flex items-center gap-1"><Phone className="size-3" />{detail.mobile}</span>
              )}
              {detail.email && (
                <span className="flex items-center gap-1 hidden sm:flex"><Mail className="size-3" />{detail.email}</span>
              )}
              <span className="font-bold text-slate-700 dark:text-slate-300">{detail.customerType}</span>
            </div>
          </div>

          {/* Balance Badge */}
          <div className="text-right shrink-0">
            <div className="text-[10px] text-slate-400 dark:text-slate-500 font-medium uppercase tracking-wider">Balance</div>
            <div className={`text-lg font-bold tabular-nums ${
              bal > 0 ? 'text-red-600 dark:text-red-400' :
              bal < 0 ? 'text-green-600 dark:text-green-400' :
              'text-slate-400 dark:text-slate-500'
            }`}>
              {bal > 0 ? '+' : ''}{fmtCur(bal)}
            </div>
          </div>
        </div>

        {/* Quick stats */}
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
          <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
            <Calendar className="size-3" />
            <span>Visits: <strong className="text-slate-700 dark:text-slate-200">{detail.totalVisits || 0}</strong></span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
            <CreditCard className="size-3" />
            <span>Folios: <strong className="text-slate-700 dark:text-slate-200">{activeFolios.length}</strong></span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
            <User className="size-3" />
            <span>Type: <strong className="text-slate-700 dark:text-slate-200">{detail.customerType}</strong></span>
          </div>
        </div>

        {/* Important Notes Banner */}
        {detail.notes?.filter(n => n.isImportant).length > 0 && (
          <div className="mt-2 pt-2 border-t border-amber-200 dark:border-amber-800/50">
            <div className="flex items-center gap-1.5 mb-1">
              <Star className="size-3 text-amber-500" />
              <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Important Notes</span>
            </div>
            <div className="space-y-1">
              {detail.notes.filter(n => n.isImportant).slice(0, 3).map(note => (
                <div key={note.id} className="flex items-start gap-2 text-[11px] bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-lg px-2.5 py-1.5">
                  <span className="text-amber-500 mt-0.5 shrink-0">★</span>
                  <span className="text-amber-800 dark:text-amber-200 leading-tight line-clamp-2">{note.content}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Folio Tabs ── */}
      <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/50 px-4 py-2 shrink-0 overflow-x-auto border-b border-slate-200 dark:border-slate-700">
        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider mr-1 shrink-0">Folios</span>
        <button
          key="master"
          onClick={() => { setSelectedFolioId('master'); setSelectedEntries(new Set()) }}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
            selectedFolioId === 'master'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-600'
          }`}
        >
          <Layers className="size-3" />
          Master
          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
            selectedFolioId === 'master'
              ? 'bg-white/20 text-white'
              : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'
          }`}>
            ALL
          </span>
        </button>
        {activeFolios.map((f) => (
          <button key={f.id} onClick={() => { setSelectedFolioId(f.id); setSelectedEntries(new Set()); fetchFolioEntries(detail!.id, f.id) }}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
              selectedFolioId === f.id
                ? 'bg-slate-800 dark:bg-slate-600 text-white shadow-sm'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-600'
            }`}
          >
            <BookOpen className="size-3" />
            {fmtFolioNum(f.folioNumber)}
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
              selectedFolioId === f.id
                ? 'bg-white/20 text-white'
                : f.status === 'Active' ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300'
                : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
            }`}>
              {f.status}
            </span>
          </button>
        ))}
        {(isActive || isAdmin) && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button onClick={handleCreateFolio} disabled={submitting} className="flex items-center justify-center w-8 h-8 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 text-slate-400 dark:text-slate-500 hover:border-slate-500 dark:hover:border-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shrink-0">
                {submitting ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-[10px]">Create New Folio</TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* ── Multi-select info bar ── */}
      {selectedEntries.size > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800 px-4 py-2 flex items-center gap-3 shrink-0">
          <span className="text-xs font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
            <CheckCircle className="size-3.5" />
            {selectedEntries.size} {selectedEntries.size === 1 ? 'entry' : 'entries'} selected
          </span>
          <Separator orientation="vertical" className="h-4 bg-amber-300 dark:bg-amber-700" />
          <button onClick={onShift} disabled={allFolios.length < 2} className="text-xs text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-200 font-medium underline disabled:opacity-40">Shift to Folio</button>
          <button onClick={onSplit} disabled={selectedEntries.size !== 1} className="text-xs text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-200 font-medium underline disabled:opacity-40">Split Amount</button>
          <button onClick={onRemove} className="text-xs text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 font-medium underline">Remove</button>
          <div className="flex-1" />
          <button onClick={() => setSelectedEntries(new Set())} className="text-xs text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 font-medium">Clear Selection</button>
        </div>
      )}

      {/* ── Transaction Table ── */}
      <div className="flex-1 overflow-auto min-h-0">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
            <TableRow className="hover:bg-slate-50 dark:hover:bg-slate-800">
              <TableHead className="w-9 p-2"><Checkbox checked={displayEntries.length > 0 && selectedEntries.size === displayEntries.length} onCheckedChange={toggleAllEntries} /></TableHead>
              <TableHead className="w-8 p-2 text-[10px] text-slate-500 dark:text-slate-400 font-semibold">#</TableHead>
              <TableHead className="p-2 text-[10px] text-slate-500 dark:text-slate-400 font-semibold">Date</TableHead>
              <TableHead className="p-2 text-[10px] text-slate-500 dark:text-slate-400 font-semibold">Voucher</TableHead>
              <TableHead className="p-2 text-[10px] text-slate-500 dark:text-slate-400 font-semibold">Description</TableHead>
              <TableHead className="p-2 text-[10px] text-slate-500 dark:text-slate-400 font-semibold text-right">Debit</TableHead>
              <TableHead className="p-2 text-[10px] text-slate-500 dark:text-slate-400 font-semibold text-right">Credit</TableHead>
              <TableHead className="p-2 text-[10px] text-slate-500 dark:text-slate-400 font-semibold text-right hidden sm:table-cell">Tax</TableHead>
              <TableHead className="p-2 text-[10px] text-slate-500 dark:text-slate-400 font-semibold text-right">Balance</TableHead>
              <TableHead className="p-2 text-[10px] text-slate-500 dark:text-slate-400 font-semibold hidden md:table-cell">Mode</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {folioEntriesLoading
              ? <TableRow><TableCell colSpan={10} className="text-center py-10"><Loader2 className="size-5 animate-spin mx-auto text-emerald-500" /></TableCell></TableRow>
              : displayEntries.length === 0
                ? <TableRow><TableCell colSpan={10} className="text-center py-10">
                    <div className="text-slate-400 dark:text-slate-500 text-xs flex flex-col items-center gap-2"><BookOpen className="size-6 opacity-30" />No transactions in this folio</div>
                    {selectedFolioId !== 'master' && onDeleteFolio && allFolios.find(f => f.id === selectedFolioId)?.folioNumber !== 0 && (
                      <button onClick={(e) => { e.stopPropagation(); onDeleteFolio(selectedFolioId!) }} className="mt-2 text-xs text-red-500 hover:text-red-700 underline">Delete this empty folio</button>
                    )}
                  </TableCell></TableRow>
                : displayEntries.map((e, i) => (
                  <TableRow key={e.id} className={`transition-colors border-b border-slate-100 dark:border-slate-800 ${
                    selectedEntries.has(e.id) ? 'bg-blue-50 dark:bg-blue-900/20' : i % 2 === 1 ? 'bg-slate-50/80 dark:bg-slate-800/30' : ''
                  } hover:bg-slate-100 dark:hover:bg-slate-800/50`}>
                    <TableCell className="p-2"><Checkbox checked={selectedEntries.has(e.id)} onCheckedChange={() => toggleEntrySelection(e.id)} /></TableCell>
                    <TableCell className="p-2 text-[10px] text-slate-400 dark:text-slate-500 font-mono">{i + 1}</TableCell>
                    <TableCell className="p-2 text-xs whitespace-nowrap text-slate-600 dark:text-slate-300">{fmtDate(e.date)}</TableCell>
                    <TableCell className="p-2 text-[10px] font-mono text-slate-400 dark:text-slate-500">{e.invoiceNo || e.docNo || '—'}</TableCell>
                    <TableCell className="p-2">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium inline-flex items-center ${TYPE_ICON[e.type] || 'text-gray-600 bg-gray-50 dark:text-gray-400 dark:bg-gray-800'}`}>{e.type}</span>
                        <span className="text-xs truncate max-w-[220px] text-slate-700 dark:text-slate-200" title={e.description}>{e.description || '—'}</span>
                      </div>
                    </TableCell>
                    <TableCell className="p-2 text-xs text-right font-semibold text-red-600 dark:text-red-400 tabular-nums">{e.debit > 0 ? fmtINR(e.debit) : ''}</TableCell>
                    <TableCell className="p-2 text-xs text-right font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">{e.credit > 0 ? fmtINR(e.credit) : ''}</TableCell>
                    <TableCell className="p-2 text-[11px] text-right text-slate-400 dark:text-slate-500 tabular-nums hidden sm:table-cell">{e.tax > 0 ? fmtINR(e.tax) : ''}</TableCell>
                    <TableCell className={`p-2 text-xs text-right font-bold tabular-nums ${e.balance > 0 ? 'text-red-600 dark:text-red-400' : e.balance < 0 ? 'text-green-600 dark:text-green-400' : 'text-slate-500 dark:text-slate-400'}`}>{fmtINR(e.balance)}</TableCell>
                    <TableCell className="p-2 hidden md:table-cell">{e.paymentMode ? <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400">{e.paymentMode}</Badge> : <span className="text-[10px] text-slate-300 dark:text-slate-600">—</span>}</TableCell>
                  </TableRow>
                ))
            }
          </TableBody>
        </Table>
      </div>

      {/* ── Summary Footer ── */}
      <div className="border-t-2 border-slate-800 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/50 px-4 py-2.5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-5 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">Entries</span>
            <span className="text-xs text-slate-800 dark:text-slate-200 font-bold tabular-nums">{displayEntries.length}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <TrendingUp className="size-3 text-red-500 dark:text-red-400" />
            <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">Debit</span>
            <span className="text-xs text-red-600 dark:text-red-400 font-bold tabular-nums">{fmtCur(folioTotalDebits)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <TrendingDown className="size-3 text-green-600 dark:text-green-400" />
            <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">Credit</span>
            <span className="text-xs text-green-600 dark:text-green-400 font-bold tabular-nums">{fmtCur(folioTotalCredits)}</span>
          </div>
          <div className="flex items-center gap-1.5 hidden sm:flex">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">Tax</span>
            <span className="text-xs text-slate-700 dark:text-slate-300 font-bold tabular-nums">{fmtCur(folioTotalTax)}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {selectedEntries.size > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-slate-800 dark:bg-slate-600 text-white text-[10px] font-bold">{selectedEntries.size} selected</span>
          )}
          <Separator orientation="vertical" className="h-5 bg-slate-300 dark:bg-slate-600" />
          <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">Balance</span>
          <span className={`text-sm font-bold tabular-nums ${folioCurrentBalance > 0 ? 'text-red-600 dark:text-red-400' : folioCurrentBalance < 0 ? 'text-green-600 dark:text-green-400' : 'text-slate-500 dark:text-slate-400'}`}>{fmtCur(folioCurrentBalance)}</span>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          ── ACTION BUTTONS BAR — Always visible, sticky at bottom ──
          ═══════════════════════════════════════════════════════════════ */}
      <div className="border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 sm:py-3 shrink-0 overflow-x-auto">
        <div className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider mb-2">Actions</div>

        <div className="flex flex-wrap gap-1.5">
          {/* Row 1: Billing & Print — using PrintOptionsBtn for dropdown */}
          <PrintOptionsBtn
            icon={ReceiptText}
            label="Folio Print"
            color="emerald"
            onA4={printReceipt}
            onThermal={thermalPrintReceipt || (() => {})}
          />
          <PrintOptionsBtn
            icon={FileCheck2}
            label="Voucher"
            onA4={onVoucher}
            onThermal={thermalPrintVoucher || (() => {})}
          />
          <PrintOptionsBtn
            icon={Printer}
            label="Proforma"
            color="teal"
            onA4={() => { if (selectedFolioId) onPrintFolioStatement?.(selectedFolioId) }}
            onThermal={thermalPrintFolio || (() => {})}
            disabled={!selectedFolioId}
          />

          <Separator orientation="vertical" className="h-9 bg-slate-200 dark:bg-slate-700 mx-1" />

          {/* Row 2: Transactions (active only — disabled with clear indication when checked out) */}
          <ActionBtn icon={CircleDollarSign} label="Charge" onClick={onCharge} color="red" disabled={!isActive} />
          <ActionBtn icon={Wallet} label="Payment" onClick={onPayment} color="emerald" disabled={!isActive} />
          <ActionBtn icon={ArrowDownLeft} label="Refund" onClick={onRefund} color="orange" disabled={!isActive} />
          <ActionBtn icon={Percent} label="Discount" onClick={onDiscount} color="teal" disabled={!isActive} />
          {isAdmin && <ActionBtn icon={LogOut} label="Checkout" onClick={onCheckoutSettlement} color="amber" disabled={!isActive} />}

          <Separator orientation="vertical" className="h-9 bg-slate-200 dark:bg-slate-700 mx-1" />

          {/* Row 3: Entry operations (permission-gated) */}
          <ActionBtn icon={ArrowRightLeft} label="Transfer" onClick={onTransfer} disabled={!isActive || !canTransfer} />
          <ActionBtn icon={ArrowDownToLine} label="Shift" onClick={onShift} disabled={!isActive || selectedEntries.size === 0 || allFolios.length < 2} badge={selectedEntries.size || undefined} />
          <ActionBtn icon={Split} label="Split" onClick={onSplit} disabled={!isActive || selectedEntries.size !== 1 || allFolios.length < 2} />
          <ActionBtn icon={Trash2} label="Remove" onClick={onRemove} disabled={!isActive || selectedEntries.size === 0 || !canRemove} color="red" badge={selectedEntries.size || undefined} />

          <Separator orientation="vertical" className="h-9 bg-slate-200 dark:bg-slate-700 mx-1" />

          <ActionBtn icon={History} label="History" onClick={onHistory} color="teal" />

          <Separator orientation="vertical" className="h-9 bg-slate-200 dark:bg-slate-700 mx-1" />

          {/* Row 4: Profile management — always available (works for checked-out customers) */}
          <ActionBtn icon={Edit3} label="Edit Profile" onClick={onEdit} />
          <ActionBtn icon={Eye} label="Details" onClick={onDetails} />
          <ActionBtn icon={Tag} label="Tags" onClick={onTags} />
          <ActionBtn icon={StickyNote} label="Notes" onClick={onNotes} />
          <ActionBtn icon={FileUp} label="Documents" onClick={onDocs} />
          {isAdmin && <ActionBtn icon={Trash2} label="Archive" onClick={onDelete} color="red" />}
          {isAdmin && onPermanentDelete && <ActionBtn icon={ShieldAlert} label="Permanent Delete" onClick={onPermanentDelete} color="red" />}
        </div>

        {/* Force Edit button for checked-out folios */}
        {isCheckedOut && (
          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 flex-wrap">
            {canForceEdit && (
              <Button size="sm" variant={forceEditMode ? 'default' : 'outline'} className={`gap-1.5 text-xs h-8 ${forceEditMode ? 'bg-amber-600 hover:bg-amber-700 text-white border-amber-600' : 'text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800 hover:bg-amber-50 dark:hover:bg-amber-900/30'}`} onClick={onToggleForceEdit}>
                {forceEditMode ? <><CheckCircle className="size-3.5" />Force Edit ON</> : <><Edit3 className="size-3.5" />Force Edit</>}
              </Button>
            )}
            {forceEditMode && (
              <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">⚠️ Edit mode active — all operations enabled</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}