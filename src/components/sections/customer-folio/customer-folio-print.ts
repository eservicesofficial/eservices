// ─── Customer Folio Print Functions ───
// Unified print system with professional headers, TXN IDs, and payment summaries

import { fmtDate, fmtDateTime, fmtINR, stripInternalDescriptions, fmtFolioNum, roundBal } from './customer-folio-helpers'
import type { LedgerEntry, CustomerDetail } from './customer-folio-types'
import type { RefObject } from 'react'
import { notify } from '@/lib/notification-store'
import { fetchThermalSettings, buildRichThermalHtml, type ThermalReceiptData } from '@/lib/thermal-settings'
import { getTemplateCSS, type InvoiceCustomizations } from '@/lib/invoice-templates'

// ─── Helper: Convert number to Indian Rupee words ───
function numberToIndianWords(num: number): string {
  if (num === 0) return 'ZERO'
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
  if (num < 0) return 'MINUS ' + numberToIndianWords(-num)
  let words = ''
  function convertBelowThousand(n: number): string {
    let w = ''
    if (n >= 100) { w += ones[Math.floor(n / 100)] + ' Hundred'; n %= 100; if (n > 0) w += ' and ' }
    if (n >= 20) { w += tens[Math.floor(n / 10)]; n %= 10; if (n > 0) w += ' ' + ones[n] }
    else if (n > 0) { w += ones[n] }
    return w
  }
  if (num >= 10000000) { words += convertBelowThousand(Math.floor(num / 10000000)) + ' Crore '; num %= 10000000 }
  if (num >= 100000) { words += convertBelowThousand(Math.floor(num / 100000)) + ' Lakh '; num %= 100000 }
  if (num >= 1000) { words += convertBelowThousand(Math.floor(num / 1000)) + ' Thousand '; num %= 1000 }
  if (num > 0) { words += convertBelowThousand(num) }
  return words.trim().toUpperCase() + ' ONLY'
}

// Professional CSS for receipt/bill
const PRINT_CSS = `
body{font-family:system-ui,-apple-system,sans-serif;padding:20px;max-width:210mm;margin:0 auto;color:#1a1a1a}
/* --- Legacy .bill-header (kept for backward compat) --- */
.bill-header{text-align:center;margin-bottom:20px;padding-bottom:16px;border-bottom:2px solid #16a34a}
.bill-header h1{margin:0 0 2px 0;font-size:22px;font-weight:800;color:#16a34a;letter-spacing:0.5px}
.bill-header .biz-address{font-size:11px;color:#555;margin:2px 0}
.bill-header .gst-line{font-size:10px;color:#888;margin-top:6px;font-weight:600}
/* --- New unified print header --- */
.print-header{display:flex;gap:16px;align-items:flex-start;margin-bottom:16px;padding-bottom:12px;border-bottom:2px solid #16a34a}
.print-header .logo-area{flex-shrink:0}
.print-header .logo-area img{max-width:80px;max-height:60px;object-fit:contain;border-radius:4px}
.print-header .info-area{flex:1;min-width:0}
.print-header .info-area h1{margin:0 0 2px;font-size:22px;font-weight:800;color:#16a34a;letter-spacing:0.5px}
.print-header .info-area .biz-address{font-size:11px;color:#555;margin:1px 0}
.print-header .info-area .gst-line{font-size:10px;color:#888;margin-top:4px;font-weight:600}
.doc-title{text-align:center;font-size:16px;font-weight:800;color:#1a1a1a;letter-spacing:2px;text-transform:uppercase;margin:12px 0 4px;padding:6px 0;border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb}
.txn-meta{display:flex;justify-content:space-between;align-items:center;margin:8px 0 12px;font-size:10px;color:#888}
.txn-meta .txn-id{font-family:monospace;background:#f3f4f6;padding:2px 8px;border-radius:4px;font-weight:600;color:#374151}
.payment-summary{margin-top:16px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden}
.payment-summary .ps-title{background:#f9fafb;padding:6px 12px;font-size:10px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e5e7eb}
.payment-summary table{margin:0}
.payment-summary th{background:#f9fafb !important;font-size:9px !important;padding:6px 10px !important}
.payment-summary td{font-size:11px !important;padding:6px 10px !important}
.payment-summary .ps-total{background:#f0fdf4 !important;font-weight:700 !important}
.divider{border:none;border-top:1px dashed #ccc;margin:12px 0}
.customer-info{display:flex;justify-content:space-between;margin:12px 0;font-size:12px}
.customer-info .label{color:#888;font-size:10px;text-transform:uppercase;letter-spacing:0.5px}
.customer-info .value{font-weight:700;color:#222;font-size:13px}
.customer-block{margin:12px 0 8px 0;padding:14px 16px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;box-shadow:0 1px 2px rgba(0,0,0,0.04)}
.customer-block .cb-title{font-size:9px;font-weight:800;color:#16a34a;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:10px;padding-bottom:6px;border-bottom:2px solid #16a34a}
.customer-block table{margin:0;border-collapse:collapse}
.customer-block td{padding:3px 8px;font-size:11px;border:none;vertical-align:top;text-align:left}
.customer-block td.lbl{color:#6b7280;font-size:9.5px;text-transform:uppercase;letter-spacing:0.5px;width:85px;white-space:nowrap;padding-top:4px}
.customer-block td.val{font-weight:600;color:#111;font-size:12px}
table{width:100%;border-collapse:collapse;margin-top:10px}
th{background:#16a34a;color:#fff;padding:8px 10px;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;text-align:left}
th:last-child,th:nth-child(n+3){text-align:right}
td{font-size:11px;padding:7px 10px;border-bottom:1px solid #f0f0f0}
td:last-child,td:nth-child(n+3){text-align:right}
tr:nth-child(even){background:#f8faf8}
tr.totals{background:#f0fdf4 !important;font-weight:700;border-top:2px solid #16a34a}
.totals td{padding:10px;font-size:12px}
.summary-box{display:flex;gap:12px;margin-top:16px}
.summary-item{flex:1;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:10px;text-align:center}
.summary-item .s-label{font-size:9px;color:#888;text-transform:uppercase;letter-spacing:0.5px}
.summary-item .s-value{font-size:16px;font-weight:800;margin-top:2px;color:#111}
.tax-summary{margin-top:12px;display:flex;gap:12px}
.tax-summary .tax-item{flex:1;text-align:right;font-size:11px}
.tax-summary .tax-label{color:#666}
.tax-summary .tax-val{font-weight:700;color:#111}
.footer{text-align:center;margin-top:24px;padding-top:12px;border-top:1px solid #e5e7eb;color:#999;font-size:10px;line-height:1.6}
.footer .thanks{font-size:12px;font-weight:600;color:#555;margin-bottom:2px}
.datetime{text-align:right;font-size:10px;color:#999;margin-bottom:12px}
.invoice-meta{display:flex;justify-content:space-between;align-items:flex-start;margin:12px 0 8px 0;padding:10px 14px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px}
.invoice-meta .inv-label{font-size:9px;color:#888;text-transform:uppercase;letter-spacing:0.5px}
.invoice-meta .inv-value{font-size:13px;font-weight:700;color:#222;margin-top:2px}
.signature-section{display:flex;justify-content:space-between;margin-top:40px;padding:0 20px}
.signature-box{width:45%;text-align:center}
.signature-line{border-top:1px solid #333;margin-top:50px;padding-top:6px}
.signature-line .sig-label{font-size:11px;font-weight:600;color:#333}
.signature-line .sig-sub{font-size:9px;color:#888;margin-top:2px}
`

// ═══════════════════════════════════════════════════════════════════
// HOTEL-STYLE TAX INVOICE CSS (Redesigned to match professional hotel invoice)
// ═══════════════════════════════════════════════════════════════════
export const INVOICE_CSS = `
@page{size:A4;margin:8mm 10mm}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',system-ui,-apple-system,sans-serif;padding:0;max-width:210mm;margin:0 auto;color:#1a1a1a;font-size:10px;line-height:1.5;-webkit-print-color-adjust:exact;print-color-adjust:exact}

/* ── Outer container with subtle border ── */
.inv-wrap{border:1.5px solid #d1d5db;border-radius:0;padding:0;margin:0;min-height:100vh;box-shadow:0 0 0 4px #fff;overflow:hidden}

/* ── Header Section — white background, flex layout ── */
.inv-header{padding:16px 20px 14px;display:flex;align-items:center;gap:16px;background:#fff;position:relative}
.inv-header::after{content:'';position:absolute;bottom:0;left:0;right:0;height:2.5px;background:#16a34a}
.inv-header .header-logo{flex-shrink:0}
.inv-header .header-logo img{max-width:80px;max-height:60px;object-fit:contain;border-radius:4px}
.inv-header .header-info{flex:1;min-width:0;text-align:left}
.inv-header .biz-name{font-size:20px;font-weight:800;color:#16a34a;letter-spacing:0.5px;margin-bottom:2px}
.inv-header .biz-subtitle{font-size:11px;color:#555;margin-bottom:4px;font-weight:400}
.inv-header .biz-address{font-size:10px;color:#555;line-height:1.5}
.inv-header .biz-contact{font-size:10px;color:#555;margin-top:2px}
.inv-header .biz-gstin{font-size:10px;color:#16a34a;font-weight:700;margin-top:4px;background:#f0fdf4;display:inline-block;padding:2px 10px;border-radius:4px}

/* ── Title Bar ── */
.inv-title-section{border-bottom:1.5px solid #d1d5db;padding:12px 20px 10px;text-align:center;background:#f0fdf4}
.inv-title-section .doc-title{font-size:15px;font-weight:800;color:#065f46;letter-spacing:4px;text-transform:uppercase;display:inline-block}
.inv-title-section .title-underline{border:none;height:2px;background:linear-gradient(90deg,transparent,#059669,transparent);width:280px;margin:6px auto 8px}
.inv-title-section .meta-row{display:flex;justify-content:space-between;font-size:10px;color:#374151}
.inv-title-section .meta-row span{min-width:0}
.inv-title-section .meta-row strong{font-weight:700;color:#111}

/* ── Customer Info Table ── */
.inv-cust-section{padding:0;border-bottom:1.5px solid #d1d5db}
.inv-cust-section table{width:100%;border-collapse:collapse}
.inv-cust-section td{padding:4px 10px;font-size:10px;border:1px solid #e5e7eb;vertical-align:middle;color:#1f2937}
.inv-cust-section .lbl{background:#f9fafb;font-weight:700;color:#374151;text-transform:uppercase;font-size:8.5px;letter-spacing:0.5px;white-space:nowrap}
.inv-cust-section .val{font-weight:400;font-size:10px}
.inv-cust-section .name-val{font-weight:700;font-size:11px;color:#111}

/* ── Transaction Table ── */
.inv-txn-section{padding:0}
.inv-txn-table{width:100%;border-collapse:collapse}
.inv-txn-table th{background:linear-gradient(180deg,#059669,#047857);color:#fff;padding:6px 7px;font-size:8.5px;text-transform:uppercase;letter-spacing:0.5px;font-weight:700;border:1px solid #065f46;text-align:left}
.inv-txn-table th.r{text-align:right}
.inv-txn-table td{padding:3px 7px;font-size:10px;border:1px solid #e5e7eb;color:#1f2937}
.inv-txn-table td.r{text-align:right}
.inv-txn-table tr:nth-child(even) td{background:#f0fdf4}
.inv-txn-table .txn-no{font-family:'Courier New',Courier,monospace;font-size:8px;color:#6b7280}

/* ── Subtotal / Tax / Grand Total Section ── */
.inv-calcs{padding:10px 20px 6px;background:#fff}
.inv-calc-row{display:flex;justify-content:flex-end;align-items:center;padding:2px 0;font-size:10px}
.inv-calc-row .calc-label{flex:1;text-align:right;padding-right:14px;color:#374151}
.inv-calc-row .calc-value{width:130px;text-align:right;font-weight:600}
.inv-calc-divider{border:none;border-top:1px dashed #d1d5db;margin:4px 0}
.inv-calc-divider-thick{border:none;border-top:3px double #059669;margin:6px 0}
.inv-grand-row .calc-label{font-size:12px;font-weight:800;color:#065f46;text-transform:uppercase;letter-spacing:0.5px}
.inv-grand-row .calc-value{font-size:14px;font-weight:800;color:#065f46}
.inv-gst-include-note{display:flex;justify-content:flex-end;padding:3px 0;font-size:9px;color:#6b7280;font-style:italic}
.inv-gst-include-note span{width:130px;text-align:right}

/* ── Payment Info ── */
.inv-payment-info{padding:6px 20px;border-top:1.5px solid #d1d5db;font-size:10px;color:#374151;background:#f9fafb}
.inv-payment-info strong{font-weight:700}

/* ── GST/HSN Summary Table ── */
.inv-gst-section{padding:0;border-top:1.5px solid #d1d5db}
.inv-gst-table{width:100%;border-collapse:collapse}
.inv-gst-table th{background:#f9fafb;color:#374151;padding:4px 6px;font-size:8px;text-transform:uppercase;letter-spacing:0.5px;font-weight:700;border:1px solid #e5e7eb;text-align:left}
.inv-gst-table th.r{text-align:right}
.inv-gst-table td{padding:3px 6px;font-size:9px;border:1px solid #e5e7eb;color:#374151}
.inv-gst-table td.r{text-align:right}

/* ── Footer Section (2-column) ── */
.inv-footer-section{border-top:1.5px solid #d1d5db;padding:10px 20px;font-size:9px;line-height:1.5;color:#374151;background:#fff}
.inv-footer-section .amount-words{font-weight:700;color:#111;font-size:10px;margin-bottom:8px;padding:6px 10px;background:#f0fdf4;border-left:3px solid #059669;border-radius:0 6px 6px 0}
.inv-footer-section .footer-grid{display:flex;justify-content:space-between;margin-top:4px;gap:16px}
.inv-footer-section .footer-col{flex:1}
.inv-footer-section .footer-col h4{font-size:9px;font-weight:700;color:#065f46;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;padding-bottom:3px;border-bottom:2px solid #059669}
.inv-footer-section .footer-col p{margin:2px 0;font-size:8.5px;color:#4b5563}

/* ── Bottom Bar ── */
.inv-bottom-bar{display:flex;justify-content:space-between;align-items:flex-end;border-top:1.5px solid #d1d5db;padding:12px 20px;background:#f9fafb}
.inv-bottom-bar .state-info{font-size:8.5px;color:#4b5563;line-height:1.6;max-width:52%}
.inv-bottom-bar .state-info strong{font-weight:700}
.inv-bottom-bar .state-info .declaration{font-style:italic;margin-top:4px;color:#6b7280}
.inv-bottom-bar .signatures{display:flex;gap:50px}
.inv-bottom-bar .sig-block{text-align:center;min-width:120px}
.inv-bottom-bar .sig-line{border-top:1.5px solid #374151;margin-top:45px;padding-top:5px;font-size:9px;font-weight:600;color:#111}

/* ── Legal Line ── */
.inv-legal{padding:6px 20px;border-top:1.5px solid #d1d5db;font-size:8px;color:#6b7280;font-style:italic;background:#f9fafb}

/* ── Multi-Page Support (P8) ── */
.inv-txn-table thead{display:table-header-group}
.inv-txn-table tr{page-break-inside:avoid;page-break-after:auto}
.inv-txn-section{page-break-inside:auto}
.inv-cust-section,.inv-calcs,.inv-gst-section,.inv-footer-section,.inv-bottom-bar,.inv-legal{page-break-inside:avoid;page-break-before:auto}
.inv-header,.inv-title-section,.inv-cust-section{page-break-after:avoid}
.inv-wrap{min-height:auto}
/* P8: CSS page counter — shown in title bar */
body{counter-reset:page}
.page-counter::after{content:'Page: ' counter(page)}

@media print{
  body{-webkit-print-color-adjust:exact;print-color-adjust:exact;counter-reset:page}
  .inv-wrap{border:1.5px solid #999;box-shadow:none;min-height:auto}
  @page{size:A4;margin:8mm 10mm}
  /* P8: Repeat table header on each printed page */
  thead{display:table-header-group}
  .inv-txn-table tr{page-break-inside:avoid;page-break-after:auto}
}
`

// ─── Helper: Compute the most-used payment mode from credit entries ───
function computeMostUsedPaymentMode(entries: { credit?: number; paymentMode?: string }[]): string {
  const creditEntries = entries.filter(e => (e.credit || 0) > 0)
  if (creditEntries.length === 0) return 'N/A'
  const modeCounts: Record<string, number> = {}
  for (const e of creditEntries) {
    const mode = e.paymentMode || 'Cash'
    modeCounts[mode] = (modeCounts[mode] || 0) + (e.credit || 0)
  }
  let bestMode = 'Cash'
  let bestAmount = 0
  for (const [mode, amount] of Object.entries(modeCounts)) {
    if (amount > bestAmount) {
      bestAmount = amount
      bestMode = mode
    }
  }
  return bestMode
}

// ─── Helper: Build payment summary HTML ───
function buildPaymentSummary(entries: { credit?: number; paymentMode?: string }[]): string {
  const creditEntries = entries.filter(e => (e.credit || 0) > 0)
  if (creditEntries.length === 0) {
    return `<div class="payment-summary"><div class="ps-title">Payment Summary</div><div style="padding:10px 12px;font-size:11px;color:#888">No payments recorded</div></div>`
  }

  const modeTotals: Record<string, number> = {}
  for (const e of creditEntries) {
    const mode = e.paymentMode || 'Cash'
    modeTotals[mode] = (modeTotals[mode] || 0) + (e.credit || 0)
  }

  const modes = Object.entries(modeTotals)
  const grandTotal = modes.reduce((s, [, amt]) => s + amt, 0)

  if (modes.length === 1) {
    const [mode, amount] = modes[0]
    return `<div class="payment-summary"><div class="ps-title">Payment Summary</div><div style="padding:10px 12px;font-size:12px;font-weight:600;color:#374151">Payment Mode: <span style="color:#16a34a">${mode}</span> — ${fmtINR(amount)}</div></div>`
  }

  const rows = modes.map(([mode, amount]) => {
    return `<tr><td style="text-align:left">${mode}</td><td style="text-align:right;font-weight:600;color:#374151">${fmtINR(amount)}</td></tr>`
  }).join('')

  return `<div class="payment-summary"><div class="ps-title">Payment Summary</div><table><tr><th style="text-align:left">Mode</th><th style="text-align:right">Amount</th></tr>${rows}<tr class="ps-total"><td style="text-align:left">Total</td><td style="text-align:right">${fmtINR(grandTotal)}</td></tr></table></div>`
}

// ─── Helper: Get stable document number from entries (never regenerate) ───
// Searches ALL entries for the first non-empty docNo to avoid N/A
function getStableDocId(entries: { docNo?: string; invoiceNo?: string; id?: string; createdAt?: string }[]): string {
  if (entries.length === 0) return `DOC-${Date.now()}`
  for (const e of entries) {
    if (e.docNo && e.docNo.trim() !== '' && e.docNo !== 'N/A') return e.docNo
  }
  for (const e of entries) {
    if (e.invoiceNo && e.invoiceNo.trim() !== '' && e.invoiceNo !== 'N/A') return e.invoiceNo
  }
  // Fallback: use entry ID truncated or timestamp — never show N/A
  const fallback = entries[0].id ? `DOC-${entries[0].id.slice(0, 8).toUpperCase()}` : `DOC-${Date.now()}`
  return fallback
}

// ─── Build Unified Professional Header ───
function buildUnifiedHeader(
  settings: Record<string, string>,
  documentTitle: string,
  txnId: string
): string {
  const bizName = settings.shopName || 'Eservices'
  const bizAddress = settings.shopAddress || ''
  const bizPhone = settings.shopPhone || ''
  const bizEmail = settings.shopEmail || ''
  const gstNumber = settings.gstNumber || settings.gstin || ''
  const shopLogo = settings.shopLogo || settings.logo || settings.thermalLogo || ''

  const logoHtml = shopLogo
    ? `<div class="logo-area"><img src="${shopLogo}" alt="Logo" /></div>`
    : ''

  const infoHtml = `
    <h1>${bizName}</h1>
    ${bizAddress ? `<div class="biz-address">${bizAddress}</div>` : ''}
    ${bizPhone ? `<div class="biz-address">${bizPhone}${bizEmail ? ` | ${bizEmail}` : ''}</div>` : ''}
    ${gstNumber ? `<div class="gst-line">GSTIN: ${gstNumber}</div>` : ''}
  `

  const docTitleHtml = `<div class="doc-title">${documentTitle}</div>`
  const txnIdHtml = `<div class="txn-meta"><span class="txn-id">Doc No: ${txnId}</span><span>Generated: ${fmtDateTime(new Date().toISOString())}</span></div>`

  return `<div class="print-header">${logoHtml}<div class="info-area">${infoHtml}</div></div>${docTitleHtml}${txnIdHtml}`
}

// Build entry rows HTML (shared across print templates)
function buildEntryRows(entries: { date: string; description?: string; type?: string; debit: number; credit: number; balance: number; tax?: number }[]): string {
  return entries.map((e, i) => {
    const desc = stripInternalDescriptions(e.description || e.type || '—')
    return `<tr><td>${i + 1}</td><td>${fmtDate(e.date)}</td><td>${desc}</td><td style="text-align:right;color:#dc2626;font-weight:600">${e.debit > 0 ? fmtINR(e.debit) : '—'}</td><td style="text-align:right;color:#16a34a;font-weight:600">${e.credit > 0 ? fmtINR(e.credit) : '—'}</td><td style="font-weight:700;color:${e.balance > 0 ? '#dc2626' : e.balance < 0 ? '#16a34a' : '#666'}">${fmtINR(e.balance)}</td></tr>`
  }).join('')
}

function openPrintWindow(title: string): Window | null {
  const w = window.open('', '_blank')
  if (!w) {
    notify({ type: 'error', title: 'Error', message: 'Please allow popups to print' })
  }
  return w
}

async function fetchSettingsForPrint(hdrRef: RefObject<Record<string, string>>): Promise<Record<string, string>> {
  try {
    const res = await fetch('/api/settings', { headers: hdrRef.current })
    if (res.ok) return await res.json()
  } catch { /* ignore */ }
  return {}
}

// Build template-specific CSS from settings
function buildTemplateCSSFromSettings(settings: Record<string, string>): string {
  const templateId = settings.invoiceTemplate || 'modern'
  let customizations: InvoiceCustomizations = {}
  try {
    if (settings.invoiceCustomizations) {
      customizations = JSON.parse(settings.invoiceCustomizations)
    }
  } catch { /* ignore */ }
  return getTemplateCSS(templateId, customizations)
}

// Backward-compatible header: delegates to buildUnifiedHeader
function buildHeader(settings: Record<string, string>, title: string): string {
  return buildUnifiedHeader(settings, title, 'N/A')
}

// Build professional customer info block for invoices
function buildCustomerInfoBlock(detail: CustomerDetail): string {
  const d = detail as any
  const addr = d.address || ''
  const mobile = d.mobile || ''
  const whatsapp = d.whatsapp || ''
  const email = d.email || ''
  const gstNo = d.gstNumber || ''
  const gstAddr = d.gstAddress || ''
  const custId = d.customerId || ''

  // Left column: Name, ID, Phone, Email, Address
  let leftRows = ''
  leftRows += `<tr><td class="lbl">Name</td><td class="val" style="font-size:13px">${d.fullName}</td></tr>`
  if (custId) leftRows += `<tr><td class="lbl">Customer ID</td><td class="val" style="font-family:monospace;font-size:11px">${custId}</td></tr>`
  if (mobile) leftRows += `<tr><td class="lbl">Phone</td><td class="val">${mobile}${whatsapp && whatsapp !== mobile ? ` <span style="color:#888;font-weight:400;font-size:10px">| W: ${whatsapp}</span>` : ''}</td></tr>`
  if (email) leftRows += `<tr><td class="lbl">Email</td><td class="val" style="font-size:11px">${email}</td></tr>`
  if (addr) leftRows += `<tr><td class="lbl">Address</td><td class="val" style="font-size:11px;line-height:1.4">${addr}</td></tr>`

  // Right column: GST Number, GST Address
  let rightRows = ''
  if (gstNo) rightRows += `<tr><td class="lbl">GST No.</td><td class="val" style="font-family:monospace;font-size:11px">${gstNo}</td></tr>`
  if (gstAddr) rightRows += `<tr><td class="lbl">GST Address</td><td class="val" style="font-size:11px;line-height:1.4">${gstAddr}</td></tr>`

  if (!rightRows) {
    return `<div class="customer-block"><div class="cb-title">Bill To</div><table>${leftRows}</table></div>`
  }

  return `<div class="customer-block"><div class="cb-title">Bill To</div>
    <table style="width:100%"><tr>
      <td style="width:55%;vertical-align:top;padding-right:16px;border-right:1px solid #e5e7eb"><table>${leftRows}</table></td>
      <td style="width:45%;vertical-align:top;padding-left:16px"><table>${rightRows}</table></td>
    </tr></table></div>`
}

function buildFooter(): string {
  return `<div class="footer"><div class="thanks">Thank you for your business!</div><div>Powered by Eservices</div><div>This is a computer-generated document.</div></div>`
}

// ═══════════════════════════════════════════════════════════════════
// BUILD HOTEL-STYLE TAX INVOICE (Redesigned professional layout)
// Supports: P4 specific folio, P8 multi-page, P10a GST inclusive, P11 amount in words
// ═══════════════════════════════════════════════════════════════════
export function buildHotelStyleInvoice(
  settings: Record<string, string>,
  detail: CustomerDetail,
  entries: any[],
  invoiceNo: string,
  invoiceDate: string,
  docTitle: string,
  extraMeta?: { openingBalance?: number; closingBalance?: number; periodFrom?: string; periodTo?: string; specificFolioNumber?: string | number },
  printedBy?: string
): string {
  const d = detail as any
  const bizName = settings.shopName || 'Eservices'
  const bizAddress = settings.shopAddress || ''
  const bizPhone = settings.shopPhone || ''
  const bizEmail = settings.shopEmail || ''
  const gstNumber = settings.gstNumber || settings.gstin || ''
  const panNumber = settings.panNumber || d.panNumber || ''
  const gstState = settings.gstState || settings.gstStateCode || ''
  const stateCode = gstState ? gstState.split('-')[0] || gstState : ''
  const shopLogo = settings.shopLogo || settings.logo || settings.thermalLogo || ''

  // P10a: GST settings
  const gstEnabled = settings.enableGst === 'true'
  const gstRate = parseFloat(settings.gstRate) || 0

  // Customer info
  const custName = d.fullName || ''
  const custId = d.customerId || ''
  const custMobile = d.mobile || ''
  const custEmail = d.email || ''
  const custAddr = d.address || ''
  const custGst = d.gstNumber || ''
  const custType = d.customerType || ''
  const custPan = d.panNumber || ''
  const custCompany = d.companyName || d.company || ''

  // Calculate totals
  const chargeEntries = entries.filter((e: any) => (e.debit || 0) > 0 && e.type !== 'Refund')
  const paymentEntries = entries.filter((e: any) => (e.credit || 0) > 0)
  const refundEntries = entries.filter((e: any) => e.type === 'Refund')
  const totalDebits = chargeEntries.reduce((s: number, e: any) => s + (e.debit || 0), 0)
  const totalCredits = paymentEntries.reduce((s: number, e: any) => s + (e.credit || 0), 0)
  const totalRefunds = refundEntries.reduce((s: number, e: any) => s + (e.debit || 0), 0)

  // P10a: GST Inclusive calculation
  // If GST is enabled in settings, compute GST from charge amounts even if individual entries have tax=0
  let totalTax = 0
  let computedTaxFromSettings = false
  if (gstEnabled && gstRate > 0) {
    // Check if any charge has explicit tax > 0
    const hasExplicitTax = chargeEntries.some((e: any) => (e.tax || 0) > 0)
    if (hasExplicitTax) {
      // Use the explicit tax values from entries
      totalTax = entries.reduce((s: number, e: any) => s + (e.tax || 0), 0)
    } else {
      // P10a: No explicit GST on charges — compute from inclusive amounts using settings GST rate
      // For inclusive GST: GST = Amount × Rate / (100 + Rate), Taxable = Amount - GST
      totalTax = Math.round((totalDebits * gstRate / (100 + gstRate)) * 100) / 100
      computedTaxFromSettings = true
    }
  } else {
    // GST not enabled — use whatever tax is on entries (usually 0)
    totalTax = entries.reduce((s: number, e: any) => s + (e.tax || 0), 0)
  }

  const totalDiscount = entries.reduce((s: number, e: any) => s + (e.discount || 0), 0)
  const closingBal = roundBal(extraMeta?.closingBalance ?? (entries.length > 0 ? entries[entries.length - 1].balance : 0))
  const openingBal = roundBal(extraMeta?.openingBalance ?? 0)

  // Tax calculation (CGST/SGST split from total tax)
  const cgstAmount = Math.round(totalTax / 2 * 100) / 100
  const sgstAmount = Math.round((totalTax - cgstAmount) * 100) / 100
  const netAmount = totalDebits - totalDiscount
  const effectiveGstRate = netAmount > 0 ? ((totalTax / netAmount) * 100) : 0
  const halfRate = effectiveGstRate > 0 ? +(effectiveGstRate / 2).toFixed(2) : 0
  // Grand total = debits (tax-inclusive) - discount - credits + refunds
  const grandTotal = roundBal(totalDebits - totalDiscount - totalCredits + totalRefunds)

  // Payment mode info
  const mostUsedMode = computeMostUsedPaymentMode(entries)
  const lastPayment = paymentEntries.length > 0 ? paymentEntries[paymentEntries.length - 1] : null
  const paymentDate = lastPayment ? fmtDate(lastPayment.date) : invoiceDate

  // Arrival / departure from entries
  const firstEntry = entries.length > 0 ? entries[0] : null
  const lastEntry = entries.length > 0 ? entries[entries.length - 1] : null
  const arrivalDate = firstEntry ? fmtDate(firstEntry.date) : '—'
  const departureDate = lastEntry ? fmtDate(lastEntry.date) : '—'

  // ── Build HTML ──
  // P4: Use specificFolioNumber if provided (for proforma/single folio printing)
  const specificFolioNo = extraMeta?.specificFolioNumber
  let folioNo: string
  if (specificFolioNo != null) {
    folioNo = typeof specificFolioNo === 'number' ? fmtFolioNum(specificFolioNo) : String(specificFolioNo)
  } else {
    const rawFolioNo = d.folioNumber || (d.folios && d.folios[0] ? d.folios[0].folioNumber : null) || d.folioNo || null
    folioNo = rawFolioNo != null ? (typeof rawFolioNo === 'number' ? fmtFolioNum(rawFolioNo) : String(rawFolioNo)) : 'Master Folio'
  }

  const visitNo = d.visitNumber || (d.activeFolio && d.activeFolio.visitNumber) || (d.folios && d.folios[0] && d.folios[0].visitNumber) || d.totalVisits || d.visitNo || '—'

  // P8: Determine invoice number label based on docTitle
  const invoiceLabel = docTitle.toUpperCase().includes('PROFORMA') ? 'Proforma No' : 'Invoice No'

  let html = `<div class="inv-wrap">`

  // 1) HEADER — white background, flex layout with logo
  html += `<div class="inv-header">`
  if (shopLogo) {
    html += `<div class="header-logo"><img src="${shopLogo}" alt="Logo" /></div>`
  }
  html += `<div class="header-info">`
  html += `<div class="biz-name">${bizName}</div>`
  if (settings.shopTagline || settings.shopSubtitle) html += `<div class="biz-subtitle">${settings.shopTagline || settings.shopSubtitle}</div>`
  if (bizAddress) html += `<div class="biz-address">${bizAddress}</div>`
  if (bizPhone || bizEmail) html += `<div class="biz-contact">${bizPhone}${bizPhone && bizEmail ? ' | ' : ''}${bizEmail}</div>`
  if (gstNumber && gstEnabled) html += `<div class="biz-gstin">GSTIN: ${gstNumber}</div>`
  html += `</div>`
  html += `</div>`

  // 2) TITLE BAR
  html += `<div class="inv-title-section">`
  html += `<div class="doc-title">${docTitle}</div>`
  html += `<hr class="title-underline">`
  html += `<div class="meta-row">`
  html += `<span>${invoiceLabel}: <strong>${invoiceNo}</strong></span>`
  html += `<span>Date: <strong>${invoiceDate}</strong></span>`
  // P8: Use CSS counter for page numbers
  html += `<span class="page-counter"></span>`
  html += `</div>`
  html += `</div>`

  // 3) CUSTOMER INFO TABLE
  html += `<div class="inv-cust-section"><table>`
  html += `<tr>
    <td class="lbl">Customer Id</td><td class="val">${custId || '—'}</td>
    <td class="lbl">Type</td><td class="val">${custType || '—'}</td>
  </tr>`
  html += `<tr>
    <td class="lbl">Folio No</td><td class="val">${folioNo}</td>
    <td class="lbl">Visit No</td><td class="val">${visitNo}</td>
  </tr>`
  html += `<tr>
    <td class="lbl">Name</td>
    <td class="val name-val" colspan="3">${custName}${custCompany ? ` <span style="font-weight:400;font-size:9px;color:#6b7280">( ${custCompany} )</span>` : ''}</td>
  </tr>`
  html += `<tr>
    <td class="lbl">Mobile</td><td class="val">${custMobile || '—'}</td>
    <td class="lbl">Email</td><td class="val">${custEmail || '—'}</td>
  </tr>`
  if (gstEnabled) {
  html += `<tr>
    <td class="lbl">GST No</td><td class="val" style="font-family:'Courier New',monospace;font-size:9px">${custGst || '—'}</td>
    <td class="lbl">PAN</td><td class="val" style="font-family:'Courier New',monospace;font-size:9px">${custPan || '—'}</td>
  </tr>`
  }
  html += `<tr>
    <td class="lbl">Arrival</td><td class="val">${arrivalDate}</td>
    <td class="lbl">Departure</td><td class="val">${departureDate}</td>
  </tr>`
  if (custAddr) {
    html += `<tr>
      <td class="lbl">Address</td>
      <td class="val" colspan="3">${custAddr}</td>
    </tr>`
  }
  html += `</table></div>`

  // 4) TRANSACTION TABLE
  html += `<div class="inv-txn-section"><table class="inv-txn-table">`
  html += `<tr>
    <th style="width:28px">#</th>
    <th style="width:72px">Date</th>
    <th>Description</th>
    <th class="r" style="width:85px">Transaction No</th>
    <th class="r" style="width:78px">Debit</th>
    <th class="r" style="width:78px">Credit</th>
    <th class="r" style="width:88px">Balance</th>
  </tr>`

  for (let i = 0; i < entries.length; i++) {
    const e = entries[i]
    const desc = stripInternalDescriptions(e.description || e.type || '—')
    const debitVal = (e.debit || 0) > 0 ? e.debit : 0
    const creditVal = (e.credit || 0) > 0 ? e.credit : 0
    const balColor = e.balance > 0 ? 'color:#dc2626' : e.balance < 0 ? 'color:#059669' : 'color:#6b7280'
    html += `<tr>
      <td style="text-align:center">${i + 1}</td>
      <td>${fmtDate(e.date)}</td>
      <td>${desc}</td>
      <td class="r txn-no">${e.docNo || ''}</td>
      <td class="r" style="color:#dc2626;font-weight:600">${debitVal > 0 ? fmtINR(debitVal) : ''}</td>
      <td class="r" style="color:#059669;font-weight:600">${creditVal > 0 ? fmtINR(creditVal) : ''}</td>
      <td class="r" style="${balColor};font-weight:600">${fmtINR(e.balance)}</td>
    </tr>`
  }
  html += `</table></div>`

  // 5) CALCULATIONS SECTION
  html += `<div class="inv-calcs">`
  html += `<hr class="inv-calc-divider">`
  html += `<div class="inv-calc-row"><span class="calc-label">Sub-Total</span><span class="calc-value">${fmtINR(totalDebits)}</span></div>`

  if (totalDiscount > 0) {
    html += `<div class="inv-calc-row"><span class="calc-label">Discount</span><span class="calc-value" style="color:#059669">- ${fmtINR(totalDiscount)}</span></div>`
  }

  html += `<hr class="inv-calc-divider">`
  html += `<div class="inv-calc-row"><span class="calc-label">Net Amount</span><span class="calc-value">${fmtINR(netAmount)}</span></div>`

  // GST breakdown — only show when GST enabled AND tax > 0
  if (gstEnabled && totalTax > 0) {
    const gstNote = computedTaxFromSettings
      ? `Amount is inclusive of GST @ ${gstRate}%`
      : `Amount includes GST of ${fmtINR(totalTax)} (CGST ${fmtINR(cgstAmount)} + SGST ${fmtINR(sgstAmount)})`
    html += `<div class="inv-gst-include-note"><span>${gstNote}</span></div>`
  }



  // Payments offset
  if (totalCredits > 0) {
    html += `<hr class="inv-calc-divider">`
    html += `<div class="inv-calc-row"><span class="calc-label">Total Payments Received</span><span class="calc-value" style="color:#059669">- ${fmtINR(totalCredits)}</span></div>`
  }

  if (totalRefunds > 0) {
    html += `<div class="inv-calc-row"><span class="calc-label">Refunds</span><span class="calc-value">+ ${fmtINR(totalRefunds)}</span></div>`
  }

  html += `<hr class="inv-calc-divider-thick">`
  html += `<div class="inv-calc-row inv-grand-row"><span class="calc-label">Grand Total</span><span class="calc-value">${fmtINR(grandTotal)}</span></div>`
  html += `</div>`

  // 6) PAYMENT INFO
  if (paymentEntries.length > 0) {
    html += `<div class="inv-payment-info">`
    html += `<strong>Payment Date:</strong> ${paymentDate} &nbsp;&nbsp;|&nbsp;&nbsp; <strong>Mode:</strong> ${mostUsedMode}`
    html += `</div>`
  }

  // 7) GST/HSN SUMMARY TABLE — only show when GST enabled AND tax > 0
  if (gstEnabled && totalTax > 0) {
    html += `<div class="inv-gst-section"><table class="inv-gst-table">`
    html += `<tr>
      <th>HSN/SAC</th>
      <th class="r">Taxable Amt</th>
      <th class="r">SGST Rate</th>
      <th class="r">SGST</th>
      <th class="r">CGST Rate</th>
      <th class="r">CGST</th>
      <th class="r">Total GST</th>
      <th class="r">Total (Incl. GST)</th>
    </tr>`
    const baseAmount = Math.max(0, netAmount - totalTax)
    html += `<tr>
      <td>996311</td>
      <td class="r">${fmtINR(baseAmount)}</td>
      <td class="r">${halfRate > 0 ? halfRate + '%' : '—'}</td>
      <td class="r">${fmtINR(sgstAmount)}</td>
      <td class="r">${halfRate > 0 ? halfRate + '%' : '—'}</td>
      <td class="r">${fmtINR(cgstAmount)}</td>
      <td class="r" style="font-weight:700">${fmtINR(totalTax)}</td>
      <td class="r" style="font-weight:700">${fmtINR(netAmount)}</td>
    </tr>`
    html += `</table></div>`
  }

  // 8) FOOTER SECTION
  html += `<div class="inv-footer-section">`
  // P11: Amount in Words shows Total Payments Received
  if (totalCredits > 0) {
    html += `<div class="amount-words">Total Payments Received in Words: ${numberToIndianWords(totalCredits)}</div>`
  }
  // Also show Grand Total in words
  html += `<div class="amount-words" style="margin-top:4px;background:#fef9c3;border-left-color:#ca8a04">Grand Total in Words: ${numberToIndianWords(Math.abs(grandTotal))}</div>`

  html += `<div class="footer-grid">`
  html += `<div class="footer-col"><h4>${bizName}</h4>`
  if (bizAddress) html += `<p>${bizAddress}</p>`
  if (gstEnabled) {
  if (stateCode) html += `<p>State Code: ${stateCode}</p>`
  if (gstNumber) html += `<p>GSTIN: ${gstNumber}</p>`
  if (panNumber) html += `<p>PAN: ${panNumber}</p>`
  }
  html += `</div>`

  if (custCompany || (gstEnabled && custGst)) {
    html += `<div class="footer-col"><h4>Billing Party</h4>`
    if (custCompany) html += `<p>${custCompany}</p>`
    if (custAddr) html += `<p>${custAddr}</p>`
    if (gstEnabled && custGst) html += `<p>GSTIN: ${custGst}</p>`
    if (gstEnabled && custPan) html += `<p>PAN: ${custPan}</p>`
    html += `</div>`
  } else {
    html += `<div class="footer-col"></div>`
  }
  html += `</div>`
  html += `</div>`

  // 9) BOTTOM BAR
  html += `<div class="inv-bottom-bar">`
  html += `<div class="state-info">`
  if (gstEnabled && stateCode) html += `<div><strong>State Code:</strong> ${stateCode}</div>`
  html += `<div class="declaration">We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.</div>`
  html += `</div>`
  html += `<div class="signatures">`
  html += `<div class="sig-block"><div class="sig-line">Customer Signature</div></div>`
  html += `<div class="sig-block"><div class="sig-line">Authorized Signature</div></div>`
  html += `</div>`
  html += `</div>`

  // 10) LEGAL LINE
  const now = new Date()
  html += `<div class="inv-legal">Powered by Eservices &nbsp;|&nbsp; Date: ${fmtDateTime(now.toISOString())}${printedBy ? ` &nbsp;|&nbsp; Printed by: ${printedBy}` : ''}</div>`

  html += `</div>`
  return html
}

// ─── Print Folio Invoice (formerly "Receipt") ───
// Uses stable doc IDs from existing entries — NEVER regenerates numbers on reprint
// Accepts optional invoiceNumber for permanent invoice numbers from checkout records
export async function printReceipt(
  detail: CustomerDetail,
  entries: LedgerEntry[],
  hdrRef: RefObject<Record<string, string>>,
  printedBy?: string,
  invoiceNumber?: string
) {
  if (!detail) return
  const activeEntries = entries.length > 0 ? entries : detail.ledgerEntries
  if (activeEntries.length === 0) { notify({ type: 'warning', title: 'No Entries', message: 'No entries to print' }); return }
  const shopSettings = await fetchSettingsForPrint(hdrRef)
  const docId = invoiceNumber || getStableDocId(activeEntries)
  const now = new Date()

  const w = openPrintWindow(`Folio Invoice - ${detail.fullName}`)
  if (!w) return

  w.document.write(
    `<!DOCTYPE html><html><head><title>Folio Invoice</title><style>${INVOICE_CSS}</style><style>${buildTemplateCSSFromSettings(shopSettings)}</style></head><body>` +
    buildHotelStyleInvoice(shopSettings, detail, activeEntries as any[], docId, fmtDate(now.toISOString()), 'TAX INVOICE', undefined, printedBy) +
    `</body></html>`
  )
  w.document.close()
  w.print()
}

// ─── Print Invoice (Professional Hotel-Style) ───
export async function printInvoice(
  detail: CustomerDetail,
  invoiceData: { entries?: any[]; closingBalance?: number; openingBalance?: number },
  invoiceFrom: string,
  invoiceTo: string,
  hdrRef: RefObject<Record<string, string>>,
  printedBy?: string,
  invoiceNumber?: string
) {
  if (!detail || !invoiceData) return
  const entries = invoiceData.entries || []
  if (entries.length === 0) return
  const shopSettings = await fetchSettingsForPrint(hdrRef)
  // Point 1: Use permanent invoice number if provided, otherwise derive from entries
  const docId = invoiceNumber || getStableDocId(entries)
  const now = new Date()

  const w = openPrintWindow(`Tax Invoice - ${detail.fullName}`)
  if (!w) return

  w.document.write(
    `<!DOCTYPE html><html><head><title>Tax Invoice</title><style>${INVOICE_CSS}</style><style>${buildTemplateCSSFromSettings(shopSettings)}</style></head><body>` +
    buildHotelStyleInvoice(shopSettings, detail, entries, docId, fmtDate(now.toISOString()), 'TAX INVOICE', {
      openingBalance: invoiceData.openingBalance ?? 0,
      closingBalance: invoiceData.closingBalance ?? 0,
      periodFrom: invoiceFrom,
      periodTo: invoiceTo,
    }, printedBy) +
    `</body></html>`
  )
  w.document.close()
  w.print()
}

// ─── Print Single Folio Statement (Proforma) ───
// P4: Passes specificFolioNumber so the correct folio is shown (not always master)
export async function printSingleFolio(
  detail: CustomerDetail,
  folioStatementData: { entries?: any[]; folioId?: string; openingBalance?: number; closingBalance?: number; folioNumber?: number },
  hdrRef: RefObject<Record<string, string>>,
  printedBy?: string
) {
  if (!detail || !folioStatementData) return
  const entries = folioStatementData.entries || []
  if (entries.length === 0) return
  const shopSettings = await fetchSettingsForPrint(hdrRef)
  // P4: Use "N/A" as proforma number — proforma is not a real invoice
  const docId = 'N/A'
  const now = new Date()

  // P4: Find the specific folio number from the detail's folios list
  let specificFolioNumber: number | undefined
  if (folioStatementData.folioId && (detail as any).folios) {
    const matchFolio = (detail as any).folios.find((f: any) => f.id === folioStatementData.folioId)
    if (matchFolio) specificFolioNumber = matchFolio.folioNumber
  }
  if (folioStatementData.folioNumber) specificFolioNumber = folioStatementData.folioNumber

  const w = openPrintWindow(`Proforma - ${detail.fullName}`)
  if (!w) return

  w.document.write(
    `<!DOCTYPE html><html><head><title>Proforma</title><style>${INVOICE_CSS}</style><style>${buildTemplateCSSFromSettings(shopSettings)}</style></head><body>` +
    buildHotelStyleInvoice(shopSettings, detail, entries, docId, fmtDate(now.toISOString()), 'PROFORMA INVOICE', {
      openingBalance: folioStatementData.openingBalance ?? 0,
      closingBalance: folioStatementData.closingBalance ?? 0,
      specificFolioNumber,
    }, printedBy) +
    `</body></html>`
  )
  w.document.close()
  w.print()
}

// ─── Print Voucher / Payment History ───
// P5: Uses invoiceNo from payment entries (VOU-xxxx) as permanent voucher number
export async function printVoucherHistory(
  detail: CustomerDetail,
  paymentEntries: LedgerEntry[],
  hdrRef: RefObject<Record<string, string>>,
  printedBy?: string
) {
  if (!detail) return
  if (paymentEntries.length === 0) { notify({ type: 'warning', title: 'No Entries', message: 'No payment entries to print' }); return }
  const shopSettings = await fetchSettingsForPrint(hdrRef)
  const now = new Date()

  const sorted = [...paymentEntries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  const totalAmount = sorted.reduce((s, e) => s + (e.credit || 0), 0)

  // P5: Use first payment's invoiceNo (VOU-xxxx) as permanent voucher number
  // Fallback to docNo if invoiceNo is empty (for entries created before this fix)
  const voucherNo = sorted[0]?.invoiceNo || sorted[0]?.docNo || getStableDocId(sorted)

  // Build entries in the format expected by buildHotelStyleInvoice
  const voucherEntries = sorted.map(e => ({
    ...e,
    debit: 0,
    credit: e.credit || 0,
    balance: 0,
    type: 'Payment',
    description: e.description || `Payment via ${e.paymentMode || 'Cash'}`,
  }))

  // Compute running balance for display
  let runBal = 0
  for (const e of voucherEntries) {
    runBal -= (e.credit || 0)
    e.balance = Math.round(runBal * 100) / 100
  }

  const w = openPrintWindow(`Payment Voucher - ${detail.fullName}`)
  if (!w) return

  w.document.write(
    `<!DOCTYPE html><html><head><title>Payment Voucher</title><style>${INVOICE_CSS}</style><style>${buildTemplateCSSFromSettings(shopSettings)}</style></head><body>` +
    buildHotelStyleInvoice(shopSettings, detail, voucherEntries, voucherNo, fmtDate(now.toISOString()), 'PAYMENT VOUCHER', {
      openingBalance: 0,
      closingBalance: -totalAmount,
    }, printedBy) +
    `</body></html>`
  )
  w.document.close()
  w.print()
}

// ─── Thermal Print Helpers ───

interface ShopSettings {
  shopName: string
  shopAddress: string
  shopPhone: string
  shopGst: string
  shopGstState: string
  shopLogo: string
}

async function fetchShopSettings(hdrRef?: RefObject<Record<string, string>>): Promise<ShopSettings> {
  try {
    const headers = hdrRef?.current || undefined
    const res = await fetch('/api/settings', headers ? { headers } : undefined)
    if (res.ok) {
      const db = (await res.json()) as Record<string, string>
      return {
        shopName: db.shopName || 'Eservices',
        shopAddress: db.shopAddress || '',
        shopPhone: db.shopPhone || '',
        shopGst: db.gstNumber || db.gstin || '',
        shopGstState: db.gstState || '',
        shopLogo: db.shopLogo || db.logo || '',
      }
    }
  } catch { /* ignore */ }
  return { shopName: 'Eservices', shopAddress: '', shopPhone: '', shopGst: '', shopGstState: '', shopLogo: '' }
}

function openThermalPrintWindow(thermalHtml: string, title: string): Window | null {
  const w = window.open('', '_blank', 'width=350,height=700')
  if (!w) {
    notify({ type: 'error', title: 'Error', message: 'Please allow pop-ups to print thermal receipts' })
    return null
  }
  w.document.write(thermalHtml)
  w.document.close()
  setTimeout(() => {
    try { if (!w.closed) w.print() } catch { /* window closed */ }
  }, 600)
  return w
}

// ─── Thermal Print Receipt ───
export async function thermalPrintReceipt(
  detail: CustomerDetail,
  entries: LedgerEntry[],
  hdrRef: RefObject<Record<string, string>>,
  invoiceNumber?: string
) {
  if (!detail) return
  const activeEntries = entries.length > 0 ? entries : detail.ledgerEntries
  if (activeEntries.length === 0) { notify({ type: 'warning', title: 'No Entries', message: 'No entries to print' }); return }

  const [tConfig, shop] = await Promise.all([
    fetchThermalSettings(),
    fetchShopSettings(hdrRef),
  ])
  // Point 3: Fallback to shopLogo if thermal logo is not set
  if (!tConfig.logo && shop.shopLogo) { tConfig.logo = shop.shopLogo; tConfig.showLogo = true }

  const totalDebits = activeEntries.reduce((s, e) => s + (e.debit || 0), 0)
  const totalCredits = activeEntries.reduce((s, e) => s + (e.credit || 0), 0)
  const finalBal = activeEntries[activeEntries.length - 1].balance

  const items: ThermalReceiptData['items'] = activeEntries.map(e => ({
    name: stripInternalDescriptions(e.description || e.type || '—'),
    qty: 1,
    rate: e.debit > 0 ? e.debit : e.credit,
    total: e.debit > 0 ? e.debit : e.credit,
  }))

  const actualPaymentMethod = computeMostUsedPaymentMode(activeEntries)
  const docId = invoiceNumber || getStableDocId(activeEntries)

  const receiptData: ThermalReceiptData = {
    shopName: shop.shopName,
    shopAddress: shop.shopAddress,
    shopPhone: shop.shopPhone,
    shopGst: shop.shopGst,
    shopGstState: shop.shopGstState,
    showGst: false,
    invoiceNumber: docId,
    date: fmtDate(new Date().toISOString()),
    orderType: 'PAYMENT RECEIPT',
    customerName: detail.fullName,
    customerPhone: detail.mobile,
    customerAddress: (detail as any).address || '',
    items,
    subtotal: totalDebits,
    cgst: 0,
    sgst: 0,
    gstRate: 0,
    deliveryCharge: 0,
    discountAmount: 0,
    grandTotal: totalDebits - totalCredits,
    paidAmount: totalCredits,
    balanceAmount: finalBal,
    paymentMethod: actualPaymentMethod,
    billStatus: finalBal <= 0 ? 'Paid' : 'Balance',
  }

  const thermalHtml = buildRichThermalHtml(receiptData, tConfig, `Receipt - ${detail.fullName}`)
  openThermalPrintWindow(thermalHtml, `Receipt - ${detail.fullName}`)
}

// ─── Thermal Print Invoice ───
export async function thermalPrintInvoice(
  detail: CustomerDetail,
  invoiceData: { entries?: any[]; closingBalance?: number; openingBalance?: number },
  invoiceFrom: string,
  invoiceTo: string,
  invoiceNumber?: string
) {
  if (!detail || !invoiceData) return
  const entries = invoiceData.entries || []
  if (entries.length === 0) return

  const [tConfig, shop] = await Promise.all([
    fetchThermalSettings(),
    fetchShopSettings(),
  ])
  // Point 3: Fallback to shopLogo if thermal logo is not set
  if (!tConfig.logo && shop.shopLogo) { tConfig.logo = shop.shopLogo; tConfig.showLogo = true }

  const totalDebits = entries.reduce((s: number, e: any) => s + (e.debit || 0), 0)
  const totalCredits = entries.reduce((s: number, e: any) => s + (e.credit || 0), 0)
  const closingBal = invoiceData.closingBalance ?? 0

  const items: ThermalReceiptData['items'] = entries.map((e: any) => ({
    name: stripInternalDescriptions(e.description || e.type || '—'),
    qty: 1,
    rate: e.debit > 0 ? e.debit : e.credit,
    total: e.debit > 0 ? e.debit : e.credit,
  }))

  const actualPaymentMethod = computeMostUsedPaymentMode(entries)
  const docId = invoiceNumber || getStableDocId(entries)

  const title = 'TAX INVOICE'

  const receiptData: ThermalReceiptData = {
    shopName: shop.shopName,
    shopAddress: shop.shopAddress,
    shopPhone: shop.shopPhone,
    shopGst: shop.shopGst,
    shopGstState: shop.shopGstState,
    showGst: !!shop.shopGst,
    invoiceNumber: docId,
    date: `${invoiceFrom || ''} to ${invoiceTo || fmtDate(new Date().toISOString())}`,
    orderType: title,
    customerName: detail.fullName,
    customerPhone: detail.mobile,
    customerAddress: (detail as any).address || '',
    items,
    subtotal: totalDebits,
    cgst: 0,
    sgst: 0,
    gstRate: 0,
    deliveryCharge: 0,
    discountAmount: 0,
    grandTotal: totalDebits - totalCredits,
    paidAmount: totalCredits,
    balanceAmount: closingBal,
    paymentMethod: actualPaymentMethod,
    billStatus: closingBal <= 0 ? 'Paid' : 'Balance',
  }

  const thermalHtml = buildRichThermalHtml(receiptData, tConfig, `${title} - ${detail.fullName}`)
  openThermalPrintWindow(thermalHtml, `${title} - ${detail.fullName}`)
}

// ─── Thermal Print Folio Statement ───
export async function thermalPrintFolioStatement(
  detail: CustomerDetail,
  folioStatementData: { entries?: any[]; folioId?: string; openingBalance?: number; closingBalance?: number }
) {
  if (!detail || !folioStatementData) return
  const entries = folioStatementData.entries || []
  if (entries.length === 0) return

  const [tConfig, shop] = await Promise.all([
    fetchThermalSettings(),
    fetchShopSettings(),
  ])
  // Point 3: Fallback to shopLogo if thermal logo is not set
  if (!tConfig.logo && shop.shopLogo) { tConfig.logo = shop.shopLogo; tConfig.showLogo = true }

  const totalDebits = entries.reduce((s: number, e: any) => s + (e.debit || 0), 0)
  const totalCredits = entries.reduce((s: number, e: any) => s + (e.credit || 0), 0)
  const closingBal = folioStatementData.closingBalance || 0

  const items: ThermalReceiptData['items'] = entries.map((e: any) => ({
    name: stripInternalDescriptions(e.description || '—'),
    qty: 1,
    rate: e.debit > 0 ? e.debit : e.credit,
    total: e.debit > 0 ? e.debit : e.credit,
  }))

  const actualPaymentMethod = computeMostUsedPaymentMode(entries)

  const receiptData: ThermalReceiptData = {
    shopName: shop.shopName,
    shopAddress: shop.shopAddress,
    shopPhone: shop.shopPhone,
    shopGst: shop.shopGst,
    shopGstState: shop.shopGstState,
    showGst: false,
    invoiceNumber: folioStatementData.folioId || detail.customerId,
    date: fmtDate(new Date().toISOString()),
    orderType: 'PROFORMA',
    customerName: detail.fullName,
    customerPhone: detail.mobile,
    customerAddress: (detail as any).address || '',
    items,
    subtotal: totalDebits,
    cgst: 0,
    sgst: 0,
    gstRate: 0,
    deliveryCharge: 0,
    discountAmount: 0,
    grandTotal: totalDebits - totalCredits,
    paidAmount: totalCredits,
    balanceAmount: closingBal,
    paymentMethod: actualPaymentMethod,
    billStatus: closingBal <= 0 ? 'Paid' : 'Balance',
  }

  const thermalHtml = buildRichThermalHtml(receiptData, tConfig, `Proforma - ${detail.fullName}`)
  openThermalPrintWindow(thermalHtml, `Proforma - ${detail.fullName}`)
}

// ─── Thermal Print Voucher / Payment History ───
export async function thermalPrintVoucherHistory(
  detail: CustomerDetail,
  paymentEntries: LedgerEntry[],
  hdrRef: RefObject<Record<string, string>>
) {
  if (!detail) return
  if (paymentEntries.length === 0) { notify({ type: 'warning', title: 'No Entries', message: 'No payment entries to print' }); return }

  const [tConfig, shop] = await Promise.all([
    fetchThermalSettings(),
    fetchShopSettings(hdrRef),
  ])
  // Point 3: Fallback to shopLogo if thermal logo is not set
  if (!tConfig.logo && shop.shopLogo) { tConfig.logo = shop.shopLogo; tConfig.showLogo = true }

  const sorted = [...paymentEntries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  const totalAmount = sorted.reduce((s, e) => s + (e.credit || 0), 0)

  // P5: Use first payment's invoiceNo (VOU-xxxx) as permanent voucher number
  const voucherDocNo = sorted[0]?.invoiceNo || sorted[0]?.docNo || detail.customerId

  const items: ThermalReceiptData['items'] = sorted.map(e => ({
    name: stripInternalDescriptions(e.description || '—'),
    qty: 1,
    rate: e.credit || 0,
    total: e.credit || 0,
  }))

  const actualPaymentMethod = computeMostUsedPaymentMode(sorted)

  const receiptData: ThermalReceiptData = {
    shopName: shop.shopName,
    shopAddress: shop.shopAddress,
    shopPhone: shop.shopPhone,
    shopGst: shop.shopGst,
    shopGstState: shop.shopGstState,
    showGst: false,
    invoiceNumber: voucherDocNo,
    date: fmtDate(new Date().toISOString()),
    orderType: 'PAYMENT VOUCHER',
    customerName: detail.fullName,
    customerPhone: detail.mobile,
    customerAddress: (detail as any).address || '',
    items,
    subtotal: totalAmount,
    cgst: 0,
    sgst: 0,
    gstRate: 0,
    deliveryCharge: 0,
    discountAmount: 0,
    grandTotal: totalAmount,
    paidAmount: totalAmount,
    balanceAmount: 0,
    paymentMethod: actualPaymentMethod,
    billStatus: 'Paid',
  }

  const thermalHtml = buildRichThermalHtml(receiptData, tConfig, `Voucher History - ${detail.fullName}`)
  openThermalPrintWindow(thermalHtml, `Voucher History - ${detail.fullName}`)
}

// ─── Print History Invoice (Professional invoice for historical folios) ───
export async function printHistoryInvoice(
  detail: CustomerDetail,
  entries: any[],
  openingBalance: number,
  closingBalance: number,
  invoiceFrom: string,
  invoiceTo: string,
  hdrRef: RefObject<Record<string, string>>,
  printedBy?: string,
  invoiceNumber?: string
) {
  if (!detail || !entries?.length) return

  const shopSettings = await fetchSettingsForPrint(hdrRef)
  // Point 1: Use permanent invoice number if provided, otherwise derive from entries
  const docId = invoiceNumber || getStableDocId(entries)
  const now = new Date()

  const w = openPrintWindow(`Invoice - ${detail.fullName}`)
  if (!w) return

  w.document.write(
    `<!DOCTYPE html><html><head><title>Tax Invoice</title><style>${INVOICE_CSS}</style><style>${buildTemplateCSSFromSettings(shopSettings)}</style></head><body>` +
    buildHotelStyleInvoice(shopSettings, detail, entries, docId, fmtDate(now.toISOString()), 'Tax Invoice', {
      openingBalance,
      closingBalance,
      periodFrom: invoiceFrom,
      periodTo: invoiceTo,
    }, printedBy) +
    `</body></html>`
  )
  w.document.close()
  w.print()
}
