'use client'

import React, { useState, useCallback, useMemo } from 'react'
import {
  FileBarChart, Download, Printer, Loader2, Users, IndianRupee,
  CreditCard, Receipt, Crown, HandCoins, RotateCcw, Calculator,
  CalendarDays, Filter, X, FileSpreadsheet, LogOut, TrendingDown,
  BookOpen, ClipboardList, BarChart3, FileCheck2, Shield, CalendarRange, ArrowLeft,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { notify } from '@/lib/notification-store'
import { fmtCur, fmtDate, fmtINR, fmtDateTime } from './customer-folio-helpers'

type ReportType =
  | 'summary' | 'outstanding' | 'payments' | 'transactions' | 'vip' | 'settlements' | 'refunds' | 'gst'
  | 'activeFolio' | 'checkoutHistory' | 'creditBalance' | 'chargeSummary'
  | 'discounts' | 'userCollections' | 'dailyCollections' | 'monthlyCollections' | 'audit'

const REPORTS: { value: ReportType; label: string; icon: React.ElementType; desc: string; group: string }[] = [
  { value: 'activeFolio', label: 'Active Folio', icon: BookOpen, desc: 'Active folio customers', group: 'Folio' },
  { value: 'checkoutHistory', label: 'Checkout History', icon: LogOut, desc: 'Checked out customers', group: 'Folio' },
  { value: 'outstanding', label: 'Outstanding Balance', icon: IndianRupee, desc: 'Positive balance customers', group: 'Balance' },
  { value: 'creditBalance', label: 'Credit Balance', icon: TrendingDown, desc: 'Negative balance customers', group: 'Balance' },
  { value: 'summary', label: 'Customer Summary', icon: Users, desc: 'All customers overview', group: 'Customer' },
  { value: 'vip', label: 'VIP Customers', icon: Crown, desc: 'VIP analytics', group: 'Customer' },
  { value: 'settlements', label: 'Settlement Report', icon: HandCoins, desc: 'All settlements', group: 'Financial' },
  { value: 'payments', label: 'Payment Collection', icon: CreditCard, desc: 'All payments', group: 'Financial' },
  { value: 'refunds', label: 'Refund Report', icon: RotateCcw, desc: 'All refunds', group: 'Financial' },
  { value: 'chargeSummary', label: 'Charge Summary', icon: Receipt, desc: 'Charges by type', group: 'Financial' },
  { value: 'discounts', label: 'Discount Report', icon: Calculator, desc: 'All discounts', group: 'Financial' },
  { value: 'transactions', label: 'Transaction History', icon: ClipboardList, desc: 'All transactions', group: 'Financial' },
  { value: 'gst', label: 'Tax Report', icon: FileCheck2, desc: 'Tax/GST breakdown', group: 'Financial' },
  { value: 'userCollections', label: 'User-wise Collection', icon: BarChart3, desc: 'By user', group: 'Collection' },
  { value: 'dailyCollections', label: 'Daily Collection', icon: CalendarDays, desc: 'By date', group: 'Collection' },
  { value: 'monthlyCollections', label: 'Monthly Collection', icon: CalendarRange, desc: 'By month', group: 'Collection' },
  { value: 'audit', label: 'Audit Report', icon: Shield, desc: 'Audit log', group: 'System' },
]

const GROUPS = ['Folio', 'Balance', 'Customer', 'Financial', 'Collection', 'System']
const STATUS_OPTS = ['All', 'Active', 'CheckedOut', 'Settled', 'Archived']
const TXN_OPTS = ['All', 'Charge', 'Payment', 'Refund', 'Discount', 'Settlement', 'Transfer', 'Opening']
const PMODE_OPTS = ['All', 'Cash', 'UPI', 'Credit Card', 'Debit Card', 'Bank Transfer', 'Wallet', 'Cheque', 'Other']

const STATUS_CLS: Record<string, string> = {
  Active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
  CheckedOut: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  Settled: 'bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-300',
  Archived: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300',
  true: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300',
  false: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
  Charge: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300',
  Payment: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
  Refund: 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300',
  Discount: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
}

interface Props { open: boolean; onClose: () => void; token: string | null }

// Column name patterns that indicate monetary values (should get ₹ symbol)
const MONETARY_PATTERNS = /(?:amount|balance|charge[s]?$|payment|credit|debit|tax|discount|refund|revenue|total|outstanding|settlement|advance|opening|closing|net|price|cost|due|payable|receivable|profit|loss|earning|salary|wage|commission|fee|fine|penalty|interest|deposit|withdrawal)/i
const NON_MONETARY_PATTERNS = /(?:folio[nN]umber|invoice[nN]umber|checkout[nN]umber|visit[nN]umber|customerId|customer[idID]|count|quantity|qty|percent|percentage|rate|days|duration|age|[a-z]Number|[a-z]Id|[a-z]No$|seq|serial|visit|totalEntries|totalRecords|totalCheckedOut|totalWithBalance|totalWithCredit|avg[A-Z])/i

export function CustomerFolioReports({ open, onClose, token }: Props) {
  const [selType, setSelType] = useState<ReportType | null>(null)
  const [filters, setFilters] = useState({ from: '', to: '', customer: '', folioNumber: '', user: '', status: 'All', paymentType: 'All', paymentMode: 'All' })
  const [showFilters, setShowFilters] = useState(false)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<{ reportType: string; summary: Record<string, unknown>; data: any[] } | null>(null)
  const [shopInfo, setShopInfo] = useState<Record<string, string>>({})

  const hdrs = useMemo(() => token ? { Authorization: `Bearer ${token}` } : {} as Record<string, string>, [token])

  // Fetch shop info when component opens
  React.useEffect(() => {
    if (open) {
      fetch('/api/settings', { headers: hdrs }).then(r => r.ok ? r.json() : {}).then((s: any) => {
        setShopInfo(s || {})
      }).catch(() => {})
    }
  }, [open, hdrs])

  const shopName = shopInfo.shopName || 'My Business'
  const shopAddress = shopInfo.shopAddress || ''
  const shopPhone = shopInfo.shopPhone || ''
  const shopGst = shopInfo.gstNumber || shopInfo.gstin || ''

  // Auto-set date to today when checkoutHistory is selected and no date is set
  React.useEffect(() => {
    if (selType === 'checkoutHistory' && !filters.from && !filters.to) {
      const today = new Date().toISOString().split('T')[0]
      setFilters(prev => ({ ...prev, from: today, to: today }))
    }
  }, [selType])

  const q = useCallback(() => {
    const p = new URLSearchParams()
    if (selType) p.set('type', selType)
    if (filters.from) p.set('from', filters.from)
    if (filters.to) p.set('to', filters.to)
    if (filters.customer) p.set('customer', filters.customer)
    if (filters.folioNumber) p.set('folioNumber', filters.folioNumber)
    if (filters.user) p.set('user', filters.user)
    if (filters.status !== 'All') p.set('status', filters.status)
    if (filters.paymentType !== 'All') p.set('paymentType', filters.paymentType)
    if (filters.paymentMode !== 'All') p.set('paymentMode', filters.paymentMode)
    return p.toString()
  }, [selType, filters])

  const fetchReport = useCallback(async () => {
    if (!selType) return
    try {
      setLoading(true)
      const res = await fetch(`/api/folio/reports?${q()}`, { headers: hdrs })
      if (res.ok) setData(await res.json())
      else { const e = await res.json().catch(() => ({})); notify({ type: 'error', title: 'Error', message: (e as any).error || 'Failed' }) }
    } catch { notify({ type: 'error', title: 'Error', message: 'Failed' }) }
    finally { setLoading(false) }
  }, [selType, q, hdrs])

  React.useEffect(() => { if (open && selType) fetchReport() }, [open, selType, fetchReport])

  const reset = () => { setSelType(null); setFilters({ from: '', to: '', customer: '', folioNumber: '', user: '', status: 'All', paymentType: 'All', paymentMode: 'All' }); setData(null); setShowFilters(false) }
  const close = () => { reset(); onClose() }

  const exportCSV = () => {
    if (!data?.data?.length) return
    const cols = Object.keys(data.data[0])
    const shopHeader = [`Report: ${selOpt?.label || selType}`, `Shop: ${shopName}${shopAddress ? ' | ' + shopAddress : ''}${shopPhone ? ' | ' + shopPhone : ''}${shopGst ? ' | GSTIN: ' + shopGst : ''}`, `Generated: ${new Date().toLocaleString('en-IN')}`, `Records: ${data.data.length}`, '']
    const csv = '\uFEFF' + shopHeader.join('\n') + '\n' + cols.join(',') + '\n' + data.data.map((r: any) => cols.map(c => { const v = r[c]; return typeof v === 'string' && (v.includes(',') || v.includes('"')) ? `"${v.replace(/"/g, '""')}"` : (v ?? '') }).join(',')).join('\n')
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' })); a.download = `${selType}_${new Date().toISOString().split('T')[0]}.csv`; a.click()
    notify({ type: 'success', title: 'CSV exported' })
  }

  const exportPDF = () => {
    if (!data?.data?.length || !selOpt) return
    const cols = Object.keys(data.data[0])
    const shopInfoHtml = `<div style="text-align:center;margin-bottom:16px;padding-bottom:12px;border-bottom:2px solid #16a34a;">
      <h1 style="margin:0 0 2px;font-size:20px;font-weight:800;color:#16a34a;">${shopName}</h1>
      ${shopAddress ? `<p style="margin:1px 0;font-size:11px;color:#555;">${shopAddress}</p>` : ''}
      ${shopPhone ? `<p style="margin:1px 0;font-size:11px;color:#555;">${shopPhone}</p>` : ''}
      ${shopGst ? `<p style="margin:4px 0 0;font-size:10px;color:#888;font-weight:600;">GSTIN: ${shopGst}</p>` : ''}
    </div>`
    const summaryHtml = summaryItems.map(it => `<div style="display:inline-block;margin:4px 12px 4px 0;padding:6px 12px;background:#f1f5f9;border-radius:6px;font-size:11px;"><span style="color:#64748b;">${it.label}</span><br/><strong>${it.value}</strong></div>`).join('')
    const tableRows = data.data.map((row: any, i: number) =>
      `<tr style="background:${i % 2 ? '#f8fafc' : '#fff'}">${cols.map(c => {
        const v = row[c]
        let cellContent = v == null ? '—' : typeof v === 'number' ? v.toLocaleString('en-IN') : String(v)
        return `<td style="padding:5px 8px;border-bottom:1px solid #e2e8f0;font-size:10px;word-wrap:break-word;overflow-wrap:break-word;max-width:300px;vertical-align:top;">${cellContent}</td>`
      }).join('')}</tr>`
    ).join('')
    const html = `<!DOCTYPE html><html><head><title>${selOpt.label} Report</title><style>*{box-sizing:border-box;}body{font-family:system-ui,sans-serif;margin:20px;color:#1e293b;}table{border-collapse:collapse;width:100%;table-layout:auto;}th{background:#f1f5f9;padding:6px 8px;text-align:left;font-size:9px;font-weight:600;border-bottom:2px solid #e2e8f0;text-transform:uppercase;letter-spacing:0.5px;white-space:nowrap;}td{word-wrap:break-word;overflow-wrap:break-word;}@media print{body{margin:10px;}th{background:#f1f5f9!important;-webkit-print-color-adjust:exact;print-color-adjust:exact;}tr{page-break-inside:avoid;}@page{size:landscape;margin:10mm;}}</style></head><body>${shopInfoHtml}<h2 style="margin:0 0 4px;font-size:16px;">${selOpt.label} Report</h2><p style="margin:0 0 12px;color:#64748b;font-size:11px;">Generated: ${new Date().toLocaleString('en-IN')} | Records: ${data.data.length}</p>${summaryHtml ? `<div style="margin-bottom:16px;">${summaryHtml}</div>` : ''}<table><thead><tr>${cols.map(c => `<th>${c.replace(/([A-Z])/g, ' $1').trim()}</th>`).join('')}</tr></thead><tbody>${tableRows}</tbody></table></body></html>`
    const w = window.open('', '_blank')
    if (w) { w.document.write(html); w.document.close(); w.print() }
    notify({ type: 'success', title: 'PDF export opened' })
  }

  const summaryItems = useMemo(() => {
    if (!data?.summary) return []
    return Object.entries(data.summary).filter(([k]) => k !== 'modeBreakdown' && k !== 'typeBreakdown').map(([k, v]) => {
      const isMonetary = MONETARY_PATTERNS.test(k) && !NON_MONETARY_PATTERNS.test(k)
      return {
        key: k, label: k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()),
        value: typeof v === 'number' && isMonetary ? fmtCur(v) : typeof v === 'number' ? v.toLocaleString('en-IN') : String(v),
        isNum: typeof v === 'number'
      }
    })
  }, [data])

  const cell = (colName: string) => (v: unknown) => {
    if (v == null) return <span className="text-muted-foreground">—</span>
    if (typeof v === 'boolean') return <Badge variant="outline" className={STATUS_CLS[String(v)]}>{v ? 'Yes' : 'No'}</Badge>
    const s = String(v)
    if (STATUS_CLS[s]) return <Badge variant="outline" className={STATUS_CLS[s]}>{s}</Badge>
    if (s.match(/^\d{4}-\d{2}-\d{2}/)) return <span className="text-xs">{s.includes('T') ? fmtDateTime(s) : fmtDate(s)}</span>
    if (typeof v === 'number') {
      // Only format as currency for monetary columns
      const isMonetary = MONETARY_PATTERNS.test(colName) && !NON_MONETARY_PATTERNS.test(colName)
      if (isMonetary) return <span className="tabular-nums font-medium">{fmtCur(v)}</span>
      return <span className="tabular-nums">{v.toLocaleString('en-IN')}</span>
    }
    return <span className="text-xs">{s}</span>
  }

  const cols = data?.data?.[0] ? Object.keys(data.data[0]) : []
  const selOpt = REPORTS.find(o => o.value === selType)
  const f = (k: string) => (v: string) => setFilters(prev => ({ ...prev, [k]: v }))

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[70] bg-background flex flex-col overflow-hidden print:relative print:overflow-visible print:block">
      <style>{`@media print {.print-hide{display:none!important} .print-full{position:static!important;height:auto!important;overflow:visible!important} table{page-break-inside:auto} tr{page-break-inside:avoid} thead{display:table-header-group} @page{size:landscape;margin:5mm;} body{margin:0;} .print-shop-header{display:block!important;text-align:center;margin-bottom:12px;padding-bottom:10px;border-bottom:2px solid #16a34a;} .print-shop-header h1{margin:0 0 2px;font-size:18px;font-weight:800;color:#16a34a;} .print-shop-header p{margin:1px 0;font-size:10px;color:#555;} .print-shop-header .gst{margin-top:3px;font-size:9px;color:#888;font-weight:600;}}`}</style>
      {/* Print-only shop header (hidden on screen, shown in print) */}
      <div className="print-shop-header" style={{display:'none'}} dangerouslySetInnerHTML={{__html:`<h1>${shopName}</h1>${shopAddress?`<p>${shopAddress}</p>`:''}${shopPhone?`<p>${shopPhone}</p>`:''}${shopGst?`<p class="gst">GSTIN: ${shopGst}</p>`:''}`}} />
      {/* Header */}
      <div className="px-4 py-3 border-b bg-background shrink-0 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {selType ? <button onClick={() => { setSelType(null); setData(null) }} className="p-1.5 rounded-md hover:bg-muted"><ArrowLeft className="size-4" /></button> : null}
          <div className="min-w-0">
            <h2 className="text-sm font-bold flex items-center gap-1.5 truncate">
              <FileBarChart className="size-4 text-emerald-600 shrink-0" />
              {selOpt ? selOpt.label : 'Folio Reports'}
            </h2>
            {selOpt && <p className="text-[10px] text-muted-foreground truncate">{selOpt.desc}{data?.data ? ` (${data.data.length} records)` : ''}</p>}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 print-hide">
          {data && (<><Button variant="outline" size="sm" className="h-7 gap-1 text-[11px]" onClick={() => window.print()}><Printer className="size-3" />Print</Button>
            <Button variant="outline" size="sm" className="h-7 gap-1 text-[11px]" onClick={exportPDF}><Download className="size-3" />PDF</Button>
            <Button variant="outline" size="sm" className="h-7 gap-1 text-[11px]" onClick={exportCSV}><FileSpreadsheet className="size-3" />Excel</Button></>)}
          <Button variant="outline" size="sm" className={`h-7 gap-1 text-[11px] ${showFilters ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30' : ''}`} onClick={() => setShowFilters(!showFilters)}><Filter className="size-3" />Filters</Button>
          {selType && <Button variant="ghost" size="sm" className="h-7 gap-1 text-[11px]" onClick={reset}><X className="size-3" />Reset</Button>}
          <Button variant="ghost" size="sm" className="h-7" onClick={close}>✕</Button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="px-4 py-2.5 border-b bg-muted/30 shrink-0 print-hide">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div><label className="text-[9px] text-muted-foreground font-medium uppercase">From</label><Input type="date" className="h-7 mt-0.5 text-[11px]" value={filters.from} onChange={e => f('from')(e.target.value)} /></div>
            <div><label className="text-[9px] text-muted-foreground font-medium uppercase">To</label><Input type="date" className="h-7 mt-0.5 text-[11px]" value={filters.to} onChange={e => f('to')(e.target.value)} /></div>
            <div><label className="text-[9px] text-muted-foreground font-medium uppercase">Customer</label><Input placeholder="Name or ID" className="h-7 mt-0.5 text-[11px]" value={filters.customer} onChange={e => f('customer')(e.target.value)} /></div>
            <div><label className="text-[9px] text-muted-foreground font-medium uppercase">Folio No</label><Input placeholder="Folio #" className="h-7 mt-0.5 text-[11px]" value={filters.folioNumber} onChange={e => f('folioNumber')(e.target.value)} /></div>
            <div><label className="text-[9px] text-muted-foreground font-medium uppercase">User</label><Input placeholder="User name" className="h-7 mt-0.5 text-[11px]" value={filters.user} onChange={e => f('user')(e.target.value)} /></div>
            <div><label className="text-[9px] text-muted-foreground font-medium uppercase">Status</label><Select value={filters.status} onValueChange={v => f('status')(v)}><SelectTrigger className="h-7 mt-0.5 text-[11px]"><SelectValue /></SelectTrigger><SelectContent>{STATUS_OPTS.map(s => <SelectItem key={s} value={s}><span>{s}</span></SelectItem>)}</SelectContent></Select></div>
            <div><label className="text-[9px] text-muted-foreground font-medium uppercase">Txn Type</label><Select value={filters.paymentType} onValueChange={v => f('paymentType')(v)}><SelectTrigger className="h-7 mt-0.5 text-[11px]"><SelectValue /></SelectTrigger><SelectContent>{TXN_OPTS.map(s => <SelectItem key={s} value={s}><span>{s}</span></SelectItem>)}</SelectContent></Select></div>
            <div><label className="text-[9px] text-muted-foreground font-medium uppercase">Payment Mode</label><Select value={filters.paymentMode} onValueChange={v => f('paymentMode')(v)}><SelectTrigger className="h-7 mt-0.5 text-[11px]"><SelectValue /></SelectTrigger><SelectContent>{PMODE_OPTS.map(s => <SelectItem key={s} value={s}><span>{s}</span></SelectItem>)}</SelectContent></Select></div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Sidebar — report selector */}
        {!selType && (
          <div className="w-64 lg:w-72 border-r shrink-0 overflow-y-auto bg-background">
            <div className="p-3 space-y-4">
              {GROUPS.map(g => (
                <div key={g}>
                  <h3 className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 px-1">{g}</h3>
                  <div className="space-y-1">
                    {REPORTS.filter(r => r.group === g).map(r => (
                      <button key={r.value} onClick={() => setSelType(r.value)} className="flex items-center gap-2 w-full p-2 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-colors text-left group">
                        <div className="shrink-0 p-1.5 rounded-md bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 group-hover:bg-emerald-200"><r.icon className="size-3.5" /></div>
                        <div className="min-w-0">
                          <div className="text-[11px] font-medium truncate">{r.label}</div>
                          <div className="text-[9px] text-muted-foreground truncate">{r.desc}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Main area */}
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {!selType ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center px-6"><FileBarChart className="size-12 text-muted-foreground/20 mx-auto mb-3" /><p className="text-sm text-muted-foreground">Select a report from the sidebar</p></div>
            </div>
          ) : loading ? (
            <div className="flex-1 flex items-center justify-center"><div className="text-center space-y-2"><Loader2 className="size-6 animate-spin text-emerald-600 mx-auto" /><p className="text-xs text-muted-foreground">Loading...</p></div></div>
          ) : data?.data?.length ? (
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              {summaryItems.length > 0 && (
                <div className="px-4 py-2 border-b shrink-0">
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                    {summaryItems.map(it => (
                      <div key={it.key} className="bg-muted/50 rounded-lg p-2"><div className="text-[9px] text-muted-foreground uppercase font-medium truncate">{it.label}</div><div className={`text-xs font-bold mt-0.5 truncate ${it.isNum ? 'tabular-nums' : ''}`}>{it.value}</div></div>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex-1 min-h-0 overflow-auto">
                <div className="p-4 print:p-2">
                  <div className="rounded-lg border print:rounded-none print:border-0">
                    <table className="w-full border-collapse text-[11px] print:text-[10px] table-auto">
                      <thead className="sticky top-0 bg-muted/80 print:bg-muted/30 z-10">
                        <tr>{cols.map(c => <th key={c} className="text-[9px] uppercase font-semibold px-2.5 py-2 text-left border-b-2 border-border whitespace-nowrap">{c.replace(/([A-Z])/g, ' $1').trim()}</th>)}</tr>
                      </thead>
                      <tbody>{data.data.map((row: any, i: number) => (
                        <tr key={i} className={`${i % 2 ? 'bg-muted/20' : ''} hover:bg-muted/30 print:hover:bg-transparent`}>
                          {cols.map(c => <td key={c} className="px-2.5 py-1.5 border-b border-border/50 break-words whitespace-nowrap">{cell(c)(row[c])}</td>)}
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center"><div className="text-center"><FileBarChart className="size-10 text-muted-foreground/20 mx-auto mb-2" /><p className="text-xs text-muted-foreground">No data found</p></div></div>
          )}
        </div>
      </div>
    </div>
  )
}
