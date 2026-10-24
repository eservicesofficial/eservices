"use client"

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { format, isToday, isYesterday, parseISO, startOfMonth, endOfMonth, subDays, startOfDay } from "date-fns"
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronUp,
  Settings,
  ArrowUpCircle,
  ArrowDownCircle,
  FileText,
  Loader2,
  Filter,
  X,
  CircleDollarSign,
  CalendarRange,
  BarChart3,
} from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { notify } from '@/lib/notification-store'
import { useAuth } from '@/components/auth-provider'
import ReadOnlyBanner from '@/components/read-only-banner'

// ── Interfaces ──────────────────────────────────────────────
interface CashConfig {
  id: string
  amount: number
}

interface CashTransaction {
  id: string
  type: "income" | "expense"
  amount: number
  description: string
  date: string
  breakdown: string
  createdAt: string
  updatedAt: string
}

interface CashBreakdown {
  [key: string]: number
}

interface CashManagerSectionProps {
  onRefreshData: () => void
  dataVersion?: number
}

// ── Constants ───────────────────────────────────────────────
const DENOMINATIONS = [
  { key: "2000", label: "₹2000", value: 2000, emoji: "💰", color: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300 border-violet-300 dark:border-violet-700" },
  { key: "500", label: "₹500", value: 500, emoji: "🪙", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-amber-300 dark:border-amber-700" },
  { key: "200", label: "₹200", value: 200, emoji: "🪙", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 border-orange-300 dark:border-orange-700" },
  { key: "100", label: "₹100", value: 100, emoji: "💰", color: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 border-rose-300 dark:border-rose-700" },
  { key: "50", label: "₹50", value: 50, emoji: "💵", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 border-purple-300 dark:border-purple-700" },
  { key: "20", label: "₹20", value: 20, emoji: "💵", color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300 border-cyan-300 dark:border-cyan-700" },
  { key: "10", label: "₹10", value: 10, emoji: "🪙", color: "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300 border-teal-300 dark:border-teal-700" },
  { key: "5", label: "₹5", value: 5, emoji: "🪙", color: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 border-green-300 dark:border-green-700" },
  { key: "2", label: "₹2", value: 2, emoji: "🪙", color: "bg-lime-100 text-lime-700 dark:bg-lime-900/40 dark:text-lime-300 border-lime-300 dark:border-lime-700" },
  { key: "1", label: "₹1", value: 1, emoji: "🪙", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700" },
]

const QUICK_AMOUNTS = [100, 200, 500, 1000, 2000, 5000]

type FilterTab = "all" | "income" | "expense"
type DateFilter = "today" | "week" | "month" | "all"

const CATEGORIES = ["Food", "Transport", "Utilities", "Salary", "Rent", "Supplies", "Miscellaneous"] as const;
type CategoryType = (typeof CATEGORIES)[number];

const CATEGORY_COLORS: Record<string, string> = {
  Food: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 border-orange-200 dark:border-orange-800",
  Transport: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800",
  Utilities: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800",
  Salary: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 border-green-200 dark:border-green-800",
  Rent: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 border-rose-200 dark:border-rose-800",
  Supplies: "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300 border-teal-200 dark:border-teal-800",
  Miscellaneous: "bg-gray-100 text-gray-600 dark:bg-gray-800/40 dark:text-gray-400 border-gray-200 dark:border-gray-700",
};

function getCategoryFromDescription(description: string): { category: string; cleanDesc: string } {
  const match = description.match(/^\[(\w+)\]\s*(.*)/);
  if (match && CATEGORIES.includes(match[1] as CategoryType)) {
    return { category: match[1], cleanDesc: match[2] };
  }
  return { category: "", cleanDesc: description };
}

// ── Helpers ─────────────────────────────────────────────────
function formatCurrency(amount: number): string {
  return `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatDate(dateStr: string): string {
  try {
    return format(new Date(dateStr), "dd MMM yyyy")
  } catch {
    return dateStr
  }
}

function formatDateGroup(dateStr: string): string {
  try {
    const d = parseISO(dateStr)
    if (isToday(d)) return "Today"
    if (isYesterday(d)) return "Yesterday"
    return format(d, "dd MMM yyyy")
  } catch {
    return dateStr
  }
}

// CSS sparkline as a small bar component
function MiniSparkline({ values, color }: { values: number[]; color: string }) {
  const max = Math.max(...values, 1)
  const bars = values.slice(-7) // last 7 values
  return (
    <div className="flex items-end gap-[2px] h-6">
      {bars.map((v, i) => (
        <div
          key={i}
          className={`w-1 rounded-t-sm transition-all ${color}`}
          style={{ height: `${Math.max(2, (v / max) * 100)}%` }}
        />
      ))}
    </div>
  )
}

// ── Date Filter Helper ──────────────────────────────────────
function filterTransactionsByDate(transactions: CashTransaction[], filter: DateFilter): CashTransaction[] {
  if (filter === "all") return transactions
  const now = new Date()
  return transactions.filter((t) => {
    try {
      const date = parseISO(t.date)
      if (filter === "today") {
        return t.date === format(now, "yyyy-MM-dd")
      }
      if (filter === "week") {
        const weekStart = startOfDay(subDays(now, 6))
        return date >= weekStart
      }
      if (filter === "month") {
        return date >= startOfMonth(now) && date <= endOfMonth(now)
      }
      return true
    } catch {
      return true
    }
  })
}

// ── Component ───────────────────────────────────────────────
export default function CashManagerSection({ onRefreshData, dataVersion }: CashManagerSectionProps) {
  const { token, hasPermission } = useAuth()
  const authHeaders: Record<string, string> = token ? { 'Authorization': `Bearer ${token}` } : {};
  const canAccess = hasPermission('cashManager', 'access')
  const canCreate = hasPermission('cashManager', 'create')
  const canEdit = hasPermission('cashManager', 'edit')
  const canDelete = hasPermission('cashManager', 'delete')
  const noAccess = !canAccess
  const isReadOnly = !canAccess || (!canCreate && !canEdit && !canDelete)

  // ── Data State ──
  const [config, setConfig] = useState<CashConfig | null>(null)
  const [transactions, setTransactions] = useState<CashTransaction[]>([])
  const [loading, setLoading] = useState(true)

  // ── UI State ──
  const [searchQuery, setSearchQuery] = useState("")
  const [includePettyCash, setIncludePettyCash] = useState(true)
  const [breakdownOpen, setBreakdownOpen] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [filterTab, setFilterTab] = useState<FilterTab>("all")
  const [dateFilter, setDateFilter] = useState<DateFilter>("all")

  // ── Form State ──
  const [formType, setFormType] = useState<"income" | "expense">("income")
  const [formAmount, setFormAmount] = useState("")
  const [formDescription, setFormDescription] = useState("")
  const [formCategory, setFormCategory] = useState("Miscellaneous")
  const [formDate, setFormDate] = useState(format(new Date(), "yyyy-MM-dd"))
  const [submitting, setSubmitting] = useState(false)

  // ── Breakdown State ──
  const [breakdown, setBreakdown] = useState<Record<string, string>>({})

  // ── Dialog State ──
  const [showSetPettyCash, setShowSetPettyCash] = useState(false)
  const [pettyCashAmount, setPettyCashAmount] = useState("")
  const [settingPettyCash, setSettingPettyCash] = useState(false)

  const [editTarget, setEditTarget] = useState<CashTransaction | null>(null)
  const [editType, setEditType] = useState<"income" | "expense">("income")
  const [editAmount, setEditAmount] = useState("")
  const [editDescription, setEditDescription] = useState("")
  const [editDate, setEditDate] = useState("")
  const [editing, setEditing] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<CashTransaction | null>(null)
  const [deleting, setDeleting] = useState(false)

  // ── Report State ──
  const [showReport, setShowReport] = useState(false)
  const [reportFromDate, setReportFromDate] = useState(() => {
    const d = new Date()
    d.setDate(1) // First day of current month
    return format(d, 'yyyy-MM-dd')
  })
  const [reportToDate, setReportToDate] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [generatingReport, setGeneratingReport] = useState(false)

  // ── Fetch Data ──
  const fetchData = useCallback(async (silent?: boolean) => {
    try {
      if (!silent) setLoading(true)
      const res = await fetch("/api/petty-cash", { headers: authHeaders })
      if (!res.ok) throw new Error("Failed")
      const data = await res.json()
      setConfig(data.config)
      setTransactions(data.transactions || [])
    } catch {
      notify({ type: 'error', title: 'Error', message: 'Failed to load petty cash data' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Re-fetch data when dataVersion changes (sync from other tabs/devices)
  const prevDataVersion = useRef(dataVersion)
  useEffect(() => {
    if (dataVersion !== undefined && dataVersion !== prevDataVersion.current) {
      prevDataVersion.current = dataVersion
      fetchData(true)  // silent=true for background sync
    }
  }, [dataVersion, fetchData])

  // ── Computed Values ──
  const totalIncome = useMemo(
    () => transactions.filter((t) => t.type === "income").reduce((sum, t) => sum + t.amount, 0),
    [transactions]
  )

  const totalExpense = useMemo(
    () => transactions.filter((t) => t.type === "expense").reduce((sum, t) => sum + t.amount, 0),
    [transactions]
  )

  const pettyCashAmountValue = config?.amount || 0

  const availableBalance = useMemo(() => {
    const base = totalIncome - totalExpense
    return includePettyCash ? base + pettyCashAmountValue : base
  }, [totalIncome, totalExpense, includePettyCash, pettyCashAmountValue])

  const breakdownTotal = useMemo(() => {
    return DENOMINATIONS.reduce((sum, d) => {
      const count = parseInt(breakdown[d.key] || "0", 10)
      return sum + (isNaN(count) ? 0 : count * d.value)
    }, 0)
  }, [breakdown])

  // ── Filtered & Grouped Transactions ──
  const filteredTransactions = useMemo(() => {
    let result = filterTransactionsByDate(transactions, dateFilter)
    if (filterTab !== "all") {
      result = result.filter((t) => t.type === filterTab)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (t) =>
          t.description.toLowerCase().includes(q) ||
          t.type.toLowerCase().includes(q) ||
          String(t.amount).includes(q)
      )
    }
    return result
  }, [transactions, searchQuery, filterTab, dateFilter])

  // Group by date
  const groupedTransactions = useMemo(() => {
    const groups: { date: string; items: CashTransaction[] }[] = []
    const map = new Map<string, CashTransaction[]>()

    filteredTransactions.forEach((t) => {
      const dateKey = formatDateGroup(t.date)
      if (!map.has(dateKey)) {
        map.set(dateKey, [])
      }
      map.get(dateKey)!.push(t)
    })

    map.forEach((items, date) => {
      groups.push({ date, items })
    })

    return groups
  }, [filteredTransactions])

  // Running balance per transaction
  const transactionWithBalance = useMemo(() => {
    const allSorted = [...transactions].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime() || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )
    const balanceMap = new Map<string, number>()
    let running = pettyCashAmountValue
    allSorted.forEach((t) => {
      running += t.type === "income" ? t.amount : -t.amount
      balanceMap.set(`${t.id}-${t.createdAt}`, running)
    })
    return balanceMap
  }, [transactions, pettyCashAmountValue])

  // Sparkline data - compute last N daily totals for income and expense
  const incomeSparkline = useMemo(() => {
    const dailyMap = new Map<string, number>()
    transactions.forEach((t) => {
      if (t.type === "income") {
        dailyMap.set(t.date, (dailyMap.get(t.date) || 0) + t.amount)
      }
    })
    return Array.from(dailyMap.values())
  }, [transactions])

  const expenseSparkline = useMemo(() => {
    const dailyMap = new Map<string, number>()
    transactions.forEach((t) => {
      if (t.type === "expense") {
        dailyMap.set(t.date, (dailyMap.get(t.date) || 0) + t.amount)
      }
    })
    return Array.from(dailyMap.values())
  }, [transactions])

  // ── Today's Summary (for the summary card) ──
  const todaySummary = useMemo(() => {
    const todayStr = format(new Date(), "yyyy-MM-dd")
    const todayTxs = transactions.filter((t) => t.date === todayStr)
    const todayIncome = todayTxs.filter((t) => t.type === "income").reduce((sum, t) => sum + t.amount, 0)
    const todayExpense = todayTxs.filter((t) => t.type === "expense").reduce((sum, t) => sum + t.amount, 0)
    return {
      income: todayIncome,
      expense: todayExpense,
      net: todayIncome - todayExpense,
      count: todayTxs.length,
    }
  }, [transactions])

  // ── Handlers ──

  // Add Transaction
  const handleAddTransaction = async () => {
    const amount = parseFloat(formAmount)
    if (!amount || amount <= 0) {
      notify({ type: 'error', title: 'Validation Error', message: 'Please enter a valid amount' })
      return
    }
    if (!formDescription.trim()) {
      notify({ type: 'error', title: 'Validation Error', message: 'Please enter a description' })
      return
    }
    if (!formDate) {
      notify({ type: 'error', title: 'Validation Error', message: 'Please select a date' })
      return
    }

    try {
      setSubmitting(true)
      const breakdownObj: CashBreakdown = {}
      let hasBreakdown = false
      DENOMINATIONS.forEach((d) => {
        const count = parseInt(breakdown[d.key] || "0", 10)
        if (count > 0) {
          breakdownObj[d.key] = count
          hasBreakdown = true
        }
      })

      const body: Record<string, unknown> = {
        type: formType,
        amount,
        description: formCategory !== "Miscellaneous" ? `[${formCategory}] ${formDescription.trim()}` : formDescription.trim(),
        date: formDate,
      }
      if (hasBreakdown) {
        body.breakdown = breakdownObj
      }

      const res = await fetch("/api/petty-cash", {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!res.ok) throw new Error("Failed")
      notify({ type: 'success', title: 'Transaction Added', message: `${formType === "income" ? "Income" : "Expense"} of ${formatCurrency(amount)} recorded` })

      // Reset form
      setFormAmount("")
      setFormDescription("")
      setFormCategory("Miscellaneous")
      setFormDate(format(new Date(), "yyyy-MM-dd"))
      setBreakdown({})
      setBreakdownOpen(false)
      await fetchData()
      onRefreshData()
    } catch {
      notify({ type: 'error', title: 'Error', message: 'Failed to add transaction' })
    } finally {
      setSubmitting(false)
    }
  }

  // Set Petty Cash
  const handleSetPettyCash = async () => {
    const amount = parseFloat(pettyCashAmount)
    if (isNaN(amount) || amount < 0) {
      notify({ type: 'error', title: 'Validation Error', message: 'Please enter a valid amount' })
      return
    }

    try {
      setSettingPettyCash(true)
      const res = await fetch("/api/petty-cash/config", {
        method: "PUT",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      })
      if (!res.ok) throw new Error("Failed")
      setConfig((prev) => (prev ? { ...prev, amount } : prev))
      notify({ type: 'success', title: 'Updated', message: `Petty cash set to ${formatCurrency(amount)}` })
      setShowSetPettyCash(false)
      setPettyCashAmount("")
      onRefreshData()
    } catch {
      notify({ type: 'error', title: 'Error', message: 'Failed to update petty cash' })
    } finally {
      setSettingPettyCash(false)
    }
  }

  // Edit Transaction
  const openEditDialog = (t: CashTransaction) => {
    setEditTarget(t)
    setEditType(t.type as "income" | "expense")
    setEditAmount(String(t.amount))
    setEditDescription(t.description)
    setEditDate(t.date)
  }

  const handleEditTransaction = async () => {
    if (!editTarget) return
    const amount = parseFloat(editAmount)
    if (!amount || amount <= 0) {
      notify({ type: 'error', title: 'Validation Error', message: 'Please enter a valid amount' })
      return
    }
    if (!editDescription.trim()) {
      notify({ type: 'error', title: 'Validation Error', message: 'Please enter a description' })
      return
    }

    try {
      setEditing(true)

      // Delete old + create new (since no PUT endpoint for transactions)
      await fetch(`/api/petty-cash/${editTarget.id}?createdAt=${encodeURIComponent(editTarget.createdAt)}`, {
        method: "DELETE",
        headers: authHeaders,
      })

      const res = await fetch("/api/petty-cash", {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({
          type: editType,
          amount,
          description: editDescription.trim(),
          date: editDate,
          breakdown: editTarget.breakdown || "{}",
        }),
      })
      if (!res.ok) throw new Error("Failed")

      notify({ type: 'success', title: 'Updated', message: 'Transaction updated successfully' })
      setEditTarget(null)
      await fetchData()
      onRefreshData()
    } catch {
      notify({ type: 'error', title: 'Error', message: 'Failed to update transaction' })
    } finally {
      setEditing(false)
    }
  }

  // Delete Transaction
  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      setDeleting(true)
      const res = await fetch(
        `/api/petty-cash/${deleteTarget.id}?createdAt=${encodeURIComponent(deleteTarget.createdAt)}`,
        { method: "DELETE", headers: authHeaders }
      )
      if (!res.ok) throw new Error("Failed")
      notify({ type: 'success', title: 'Deleted', message: 'Transaction deleted successfully' })
      setTransactions((prev) =>
        prev.filter((t) => !(t.id === deleteTarget.id && t.createdAt === deleteTarget.createdAt))
      )
      setDeleteTarget(null)
      onRefreshData()
    } catch {
      notify({ type: 'error', title: 'Error', message: 'Failed to delete transaction' })
    } finally {
      setDeleting(false)
    }
  }

  // Generate PDF Report
  const generateCashReport = async () => {
    setGeneratingReport(true)
    try {
      // Filter transactions by date range
      const filtered = transactions.filter((t) => {
        return t.date >= reportFromDate && t.date <= reportToDate
      })

      const periodIncome = filtered.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0)
      const periodExpense = filtered.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0)
      const periodNet = periodIncome - periodExpense
      const periodBalance = periodNet + (includePettyCash ? pettyCashAmountValue : 0)

      // Group by category
      const categoryMap = new Map<string, { income: number; expense: number; count: number }>()
      filtered.forEach((t) => {
        const { category, cleanDesc } = getCategoryFromDescription(t.description)
        const key = category || "Uncategorized"
        const existing = categoryMap.get(key) || { income: 0, expense: 0, count: 0 }
        if (t.type === "income") existing.income += t.amount
        else existing.expense += t.amount
        existing.count++
        categoryMap.set(key, existing)
      })

      // Group by date
      const dateMap = new Map<string, { income: number; expense: number; count: number }>()
      filtered.forEach((t) => {
        const existing = dateMap.get(t.date) || { income: 0, expense: 0, count: 0 }
        if (t.type === "income") existing.income += t.amount
        else existing.expense += t.amount
        existing.count++
        dateMap.set(t.date, existing)
      })

      // Fetch shop name from settings
      let shopName = "Eservices"
      try {
        const settingsRes = await fetch('/api/settings', { headers: authHeaders })
        if (settingsRes.ok) {
          const settingsData = await settingsRes.json()
          shopName = settingsData.shopName || "Eservices"
        }
      } catch { /* use default */ }

      const reportHtml = `<!DOCTYPE html>
<html><head><title>Cash Report - ${reportFromDate} to ${reportToDate}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; padding: 0; background: #fff; color: #1f2937; }
  @page { size: A4; margin: 15mm; }
  @media print { body { padding: 0; } .no-print { display: none; } }
  .report { max-width: 210mm; margin: 0 auto; padding: 20px; }
  .header { background: linear-gradient(135deg, #059669, #047857); color: white; padding: 24px 28px; border-radius: 12px; margin-bottom: 20px; }
  .header h1 { font-size: 22px; font-weight: 700; margin-bottom: 4px; }
  .header .sub { font-size: 13px; opacity: 0.85; }
  .grid4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
  .stat { border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px; text-align: center; }
  .stat .label { font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
  .stat .value { font-size: 20px; font-weight: 700; }
  .stat .value.green { color: #059669; }
  .stat .value.red { color: #dc2626; }
  .stat .value.blue { color: #2563eb; }
  .section { margin-bottom: 20px; }
  .section-title { font-size: 14px; font-weight: 700; color: #374151; margin-bottom: 10px; padding-bottom: 6px; border-bottom: 2px solid #059669; display: flex; align-items: center; gap: 8px; }
  .section-title .icon { width: 18px; height: 18px; background: #059669; color: white; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { background: #f9fafb; font-weight: 600; text-align: left; padding: 8px 10px; border-bottom: 2px solid #e5e7eb; font-size: 11px; text-transform: uppercase; letter-spacing: 0.3px; color: #6b7280; }
  td { padding: 7px 10px; border-bottom: 1px solid #f3f4f6; }
  tr:last-child td { border-bottom: none; }
  .amount { font-family: 'Courier New', monospace; text-align: right; font-weight: 600; }
  .amount.green { color: #059669; }
  .amount.red { color: #dc2626; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 10px; font-weight: 600; }
  .badge.income { background: #dcfce7; color: #166534; }
  .badge.expense { background: #fee2e2; color: #991b1b; }
  .cat-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
  .cat-card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; }
  .cat-card .name { font-size: 12px; font-weight: 600; color: #374151; margin-bottom: 6px; }
  .cat-card .row { display: flex; justify-content: space-between; font-size: 11px; color: #6b7280; padding: 2px 0; }
  .footer { text-align: center; padding-top: 16px; margin-top: 16px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 11px; }
  .no-data { text-align: center; padding: 30px; color: #9ca3af; font-size: 13px; }
  .print-btn { position: fixed; top: 20px; right: 20px; background: #059669; color: white; border: none; padding: 10px 24px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; box-shadow: 0 2px 8px rgba(5,150,105,0.3); }
  .print-btn:hover { background: #047857; }
  .net-positive { color: #059669; }
  .net-negative { color: #dc2626; }
</style></head><body>
<button class="print-btn no-print" onclick="window.print()">🖨️ Print / Save PDF</button>
<div class="report">
  <div class="header">
    <h1>💰 Cash Flow Report</h1>
    <div class="sub">${shopName} • ${format(new Date(reportFromDate), "dd MMM yyyy")} — ${format(new Date(reportToDate), "dd MMM yyyy")}</div>
  </div>
  
  ${filtered.length === 0 ? '<div class="no-data">No transactions found in this date range.</div>' : `
  <div class="grid4">
    <div class="stat">
      <div class="label">Period Income</div>
      <div class="value green">₹${periodIncome.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</div>
    </div>
    <div class="stat">
      <div class="label">Period Expense</div>
      <div class="value red">₹${periodExpense.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</div>
    </div>
    <div class="stat">
      <div class="label">Net Cash Flow</div>
      <div class="value ${periodNet >= 0 ? 'green' : 'red'}">${periodNet >= 0 ? '+' : ''}₹${Math.abs(periodNet).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</div>
    </div>
    <div class="stat">
      <div class="label">Closing Balance</div>
      <div class="value blue">₹${periodBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</div>
    </div>
  </div>

  ${categoryMap.size > 0 ? `
  <div class="section">
    <div class="section-title"><span class="icon">📊</span> Category Breakdown</div>
    <div class="cat-grid">
      ${Array.from(categoryMap.entries()).map(([cat, data]) => `
        <div class="cat-card">
          <div class="name">${cat} <span style="color:#9ca3af;font-weight:400;font-size:11px">(${data.count})</span></div>
          <div class="row"><span>Income</span><span class="amount green">₹${data.income.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span></div>
          <div class="row"><span>Expense</span><span class="amount red">₹${data.expense.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span></div>
          <div class="row" style="border-top:1px solid #f3f4f6;padding-top:4px;margin-top:4px"><span style="font-weight:600">Net</span><span class="amount ${data.income - data.expense >= 0 ? 'green' : 'red'}" style="font-weight:700">${data.income - data.expense >= 0 ? '+' : ''}₹${Math.abs(data.income - data.expense).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span></div>
        </div>
      `).join('')}
    </div>
  </div>
  ` : ''}

  <div class="section">
    <div class="section-title"><span class="icon">📅</span> Daily Summary</div>
    <table>
      <thead><tr><th>Date</th><th>Transactions</th><th style="text-align:right">Income</th><th style="text-align:right">Expense</th><th style="text-align:right">Net</th></tr></thead>
      <tbody>
        ${Array.from(dateMap.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([date, data]) => `
          <tr>
            <td style="font-weight:500">${format(new Date(date), "dd MMM yyyy (EEE)")}</td>
            <td><span class="badge" style="background:#f3f4f6;color:#6b7280">${data.count}</span></td>
            <td class="amount green">₹${data.income.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
            <td class="amount red">₹${data.expense.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
            <td class="amount ${data.income - data.expense >= 0 ? 'green' : 'red'}">${data.income - data.expense >= 0 ? '+' : ''}₹${Math.abs(data.income - data.expense).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
          </tr>
        `).join('')}
        <tr style="background:#f9fafb;font-weight:700">
          <td colspan="2" style="font-weight:700">TOTAL</td>
          <td class="amount green">₹${periodIncome.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
          <td class="amount red">₹${periodExpense.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
          <td class="amount ${periodNet >= 0 ? 'green' : 'red'}">${periodNet >= 0 ? '+' : ''}₹${Math.abs(periodNet).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="section">
    <div class="section-title"><span class="icon">📋</span> All Transactions (${filtered.length})</div>
    <table>
      <thead><tr><th>Date</th><th>Type</th><th>Description</th><th style="text-align:right">Amount</th></tr></thead>
      <tbody>
        ${filtered.sort((a, b) => b.date.localeCompare(a.date) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((t) => `
          <tr>
            <td style="white-space:nowrap">${format(new Date(t.date), "dd MMM")}</td>
            <td><span class="badge ${t.type}">${t.type === 'income' ? '↑ Income' : '↓ Expense'}</span></td>
            <td>${t.description}</td>
            <td class="amount ${t.type === 'income' ? 'green' : 'red'}">${t.type === 'income' ? '+' : '-'}₹${t.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>
  `}
  
  <div class="footer">
    <p>Generated by Eservices Cash Manager • ${new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</p>
    <p style="margin-top:4px">This is a computer-generated report.</p>
  </div>
</div>
</body></html>`

      const printWindow = window.open('', '_blank', 'width=900,height=700')
      if (!printWindow) {
        notify({ type: 'error', title: 'Error', message: 'Pop-up blocked — please allow pop-ups' })
        setGeneratingReport(false)
        return
      }
      printWindow.document.write(reportHtml)
      printWindow.document.close()
      setShowReport(false)
      notify({ type: 'success', title: 'Report Generated', message: `${filtered.length} transactions from ${reportFromDate} to ${reportToDate}` })
    } catch {
      notify({ type: 'error', title: 'Error', message: 'Failed to generate report' })
    } finally {
      setGeneratingReport(false)
    }
  }

  // ── Render ───────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {isReadOnly && <ReadOnlyBanner module="Cash Manager" noAccess={noAccess} />}
      {/* ── Gradient Header Banner ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-green-600 via-emerald-600 to-teal-700 p-6 text-white shadow-lg">
        {/* Subtle pattern */}
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: 'radial-gradient(circle at 15% 30%, white 1px, transparent 1px), radial-gradient(circle at 85% 70%, white 1px, transparent 1px), radial-gradient(circle at 50% 10%, white 0.5px, transparent 0.5px)',
          backgroundSize: '40px 40px, 30px 30px, 25px 25px',
        }} />
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Wallet className="h-6 w-6" />
              Cash Manager
            </h2>
            <p className="text-green-100 text-sm mt-1">
              Track petty cash income, expenses, and balance
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowReport(true)} className="border-white/30 text-white hover:bg-white/10 hover:text-white bg-transparent gap-1.5">
              <BarChart3 className="h-4 w-4" />
              Report
            </Button>
            <Button
              size="sm"
              className="bg-white text-green-700 hover:bg-green-50 shadow-sm"
              onClick={() => {
                setPettyCashAmount(String(config?.amount || "0"))
                setShowSetPettyCash(true)
              }}
              disabled={!canEdit}
            >
              <Settings className="h-4 w-4 mr-2" />
              Set Petty Cash
            </Button>
          </div>
        </div>
        {/* Balance Display */}
        <div className="relative mt-4 rounded-xl bg-white/10 backdrop-blur-sm p-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-white/20">
              <CircleDollarSign className="h-5 w-5" />
            </div>
            <div>
              <p className="text-green-100 text-xs font-medium uppercase tracking-wider">Available Balance</p>
              <p className="text-2xl sm:text-3xl font-bold">{formatCurrency(availableBalance)}</p>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <Switch
              id="include-petty-banner"
              checked={includePettyCash}
              onCheckedChange={setIncludePettyCash}
              className="scale-75 data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
            />
            <Label htmlFor="include-petty-banner" className="text-[11px] text-green-100 cursor-pointer">
              Include Petty Cash ({formatCurrency(pettyCashAmountValue)})
            </Label>
          </div>
        </div>
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-7 w-32" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            {/* Petty Cash */}
            <Card className="border-l-4 border-l-amber-500 overflow-hidden card-hover-glow relative gradient-border-bottom">
              <div className="h-1 bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-400" />
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <div className="flex size-7 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/40">
                      <Wallet className="h-3.5 w-3.5 text-amber-600" />
                    </div>
                    <p className="text-xs text-muted-foreground font-medium">Petty Cash</p>
                  </div>
                </div>
                <p className="text-lg sm:text-xl font-bold">{formatCurrency(pettyCashAmountValue)}</p>
              </CardContent>
            </Card>

            {/* Total Income */}
            <Card className="border-l-4 border-l-green-500 overflow-hidden card-hover-glow relative gradient-border-bottom">
              <div className="h-1 bg-gradient-to-r from-green-400 via-green-300 to-emerald-400" />
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <div className="flex size-7 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/40">
                      <TrendingUp className="h-3.5 w-3.5 text-green-600" />
                    </div>
                    <p className="text-xs text-muted-foreground font-medium">Total Income</p>
                  </div>
                  {incomeSparkline.length > 1 && (
                    <MiniSparkline values={incomeSparkline} color="bg-green-400" />
                  )}
                </div>
                <p className="text-lg sm:text-xl font-bold text-green-600">{formatCurrency(totalIncome)}</p>
              </CardContent>
            </Card>

            {/* Total Expense */}
            <Card className="border-l-4 border-l-red-500 overflow-hidden card-hover-glow relative gradient-border-bottom">
              <div className="h-1 bg-gradient-to-r from-red-400 via-rose-400 to-pink-400" />
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <div className="flex size-7 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/40">
                      <TrendingDown className="h-3.5 w-3.5 text-red-500" />
                    </div>
                    <p className="text-xs text-muted-foreground font-medium">Total Expense</p>
                  </div>
                  {expenseSparkline.length > 1 && (
                    <MiniSparkline values={expenseSparkline} color="bg-red-400" />
                  )}
                </div>
                <p className="text-lg sm:text-xl font-bold text-red-500">{formatCurrency(totalExpense)}</p>
              </CardContent>
            </Card>

            {/* Available Balance */}
            <Card className={`border-l-4 overflow-hidden card-hover-glow relative gradient-border-bottom ${availableBalance < 0 ? "border-l-red-500" : "border-l-emerald-500"}`}>
              <div className="h-1 bg-gradient-to-r from-emerald-400 via-green-400 to-teal-400" />
              <DollarSign className={`absolute top-3 right-3 size-8 opacity-10 ${availableBalance < 0 ? "text-red-500" : "text-emerald-500"}`} />
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <div className={`flex size-7 items-center justify-center rounded-lg ${availableBalance < 0 ? "bg-red-100 dark:bg-red-900/40" : "bg-emerald-100 dark:bg-emerald-900/40"}`}>
                      <DollarSign className={`h-3.5 w-3.5 ${availableBalance < 0 ? "text-red-500" : "text-emerald-600"}`} />
                    </div>
                    <p className="text-xs text-muted-foreground font-medium">Available</p>
                  </div>
                </div>
                <p className={`text-lg sm:text-xl font-bold ${availableBalance < 0 ? "text-red-500" : "text-emerald-600"}`}>
                  {formatCurrency(availableBalance)}
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* ── Today's Summary Card ── */}
      {!loading && (
        <Card className="glass-green overflow-hidden border-0">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex size-8 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/50">
                <CalendarRange className="size-4 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">Today's Summary</h3>
              {todaySummary.count > 0 && (
                <Badge variant="secondary" className="text-[10px] ml-auto">{todaySummary.count} transaction{todaySummary.count !== 1 ? 's' : ''}</Badge>
              )}
            </div>
            {todaySummary.count === 0 ? (
              <p className="text-sm text-muted-foreground py-1">No activity today</p>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-2.5 rounded-lg bg-green-50/80 dark:bg-green-900/20 border border-green-100 dark:border-green-800/40">
                  <TrendingUp className="size-4 text-green-600 dark:text-green-400 mx-auto mb-1" />
                  <p className="text-sm font-bold tabular-nums text-green-700 dark:text-green-400">{formatCurrency(todaySummary.income)}</p>
                  <p className="text-[10px] text-green-600 dark:text-green-500 font-medium mt-0.5">Income</p>
                </div>
                <div className="text-center p-2.5 rounded-lg bg-red-50/80 dark:bg-red-900/20 border border-red-100 dark:border-red-800/40">
                  <TrendingDown className="size-4 text-red-500 dark:text-red-400 mx-auto mb-1" />
                  <p className="text-sm font-bold tabular-nums text-red-700 dark:text-red-400">{formatCurrency(todaySummary.expense)}</p>
                  <p className="text-[10px] text-red-600 dark:text-red-500 font-medium mt-0.5">Expense</p>
                </div>
                <div className={`text-center p-2.5 rounded-lg border ${todaySummary.net >= 0 ? 'bg-emerald-50/80 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800/40' : 'bg-orange-50/80 dark:bg-orange-900/20 border-orange-100 dark:border-orange-800/40'}`}>
                  <DollarSign className={`size-4 mx-auto mb-1 ${todaySummary.net >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-orange-600 dark:text-orange-400'}`} />
                  <p className={`text-sm font-bold tabular-nums ${todaySummary.net >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-orange-700 dark:text-orange-400'}`}>
                    {todaySummary.net >= 0 ? '+' : ''}{formatCurrency(todaySummary.net)}
                  </p>
                  <p className={`text-[10px] font-medium mt-0.5 ${todaySummary.net >= 0 ? 'text-emerald-600 dark:text-emerald-500' : 'text-orange-600 dark:text-orange-500'}`}>Net Flow</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Cash Position Indicator ── */}
      {!loading && (totalIncome > 0 || totalExpense > 0) && (
        <Card className="border-0 bg-gradient-to-r from-green-50 via-emerald-50/50 to-teal-50 dark:from-green-950/30 dark:via-emerald-950/20 dark:to-teal-950/30 overflow-hidden slide-in-right">
          <CardContent className="p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex size-8 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/50">
                  <CircleDollarSign className="size-4 text-green-600 dark:text-green-400" />
                </div>
                <span className="text-sm font-semibold">Cash Position</span>
              </div>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${availableBalance >= 0 ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400'}`}>
                {availableBalance >= 0 ? 'Positive' : 'Negative'}
              </span>
            </div>
            {/* Income vs Expense Progress Bar */}
            <div className="space-y-2">
              <div className="relative h-3 rounded-full overflow-hidden bg-muted/80">
                {(() => {
                  const total = totalIncome + totalExpense
                  if (total === 0) return null
                  const incomeRatio = (totalIncome / total) * 100
                  const expenseRatio = (totalExpense / total) * 100
                  return (
                    <>
                      {/* Expense bar (red, from right) */}
                      {totalExpense > 0 && (
                        <div
                          className="absolute top-0 right-0 h-full bg-gradient-to-l from-red-400 to-red-500 dark:from-red-500 dark:to-red-600 rounded-r-full transition-all duration-500"
                          style={{ width: `${expenseRatio}%` }}
                        />
                      )}
                      {/* Income bar (green, from left) */}
                      {totalIncome > 0 && (
                        <div
                          className="absolute top-0 left-0 h-full bg-gradient-to-r from-green-400 to-emerald-500 dark:from-green-500 dark:to-emerald-600 rounded-l-full transition-all duration-500"
                          style={{ width: `${incomeRatio}%` }}
                        />
                      )}
                      {/* Center divider marker */}
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 h-full w-0.5 bg-foreground/10 z-10" />
                    </>
                  )
                })()}
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <div className="size-2 rounded-full bg-green-500" />
                  <span>Income {formatCurrency(totalIncome)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span>Expense {formatCurrency(totalExpense)}</span>
                  <div className="size-2 rounded-full bg-red-500" />
                </div>
              </div>
            </div>
            {/* Net position summary */}
            <div className="flex items-center justify-between pt-1 border-t border-border/50">
              <span className="text-xs text-muted-foreground">Net Cash Flow</span>
              <span className={`text-sm font-bold ${availableBalance >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {availableBalance >= 0 ? '+' : ''}{formatCurrency(availableBalance)}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Transaction Form (Collapsible) ── */}
      {canCreate && (
      <Card className="overflow-hidden">
        <div className="header-gradient-line" />
        <Collapsible open={formOpen} onOpenChange={setFormOpen}>
          <CollapsibleTrigger asChild>
            <button className="w-full text-left">
              <CardHeader className="pb-3 cursor-pointer hover:bg-muted/30 transition-colors">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Plus className={`h-4 w-4 text-green-600 transition-transform ${formOpen ? "rotate-45" : ""}`} />
                    Add Transaction
                  </CardTitle>
                  <div className="h-1 w-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-t-lg -mt-4" />
                  {formOpen ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                {!formOpen && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Click to add a new income or expense transaction
                  </p>
                )}
              </CardHeader>
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 space-y-3">
              {/* Type Toggle */}
              <div className="flex items-center gap-1 p-1 bg-muted rounded-lg w-fit">
                <button
                  type="button"
                  onClick={() => setFormType("income")}
                  className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                    formType === "income"
                      ? "bg-green-600 text-white shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <ArrowUpCircle className="h-3.5 w-3.5" />
                  Income
                </button>
                <button
                  type="button"
                  onClick={() => setFormType("expense")}
                  className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                    formType === "expense"
                      ? "bg-red-500 text-white shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <ArrowDownCircle className="h-3.5 w-3.5" />
                  Expense
                </button>
              </div>

              {/* Quick Add Preset Buttons */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Quick Amount</Label>
                <div className="flex flex-wrap gap-2">
                  {QUICK_AMOUNTS.map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setFormAmount(String(amt))}
                      className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-all ${
                        formAmount === String(amt)
                          ? "border-green-500 bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400"
                          : "border-muted hover:border-green-300 hover:bg-green-50/50 text-foreground"
                      }`}
                    >
                      {formatCurrency(amt)}
                    </button>
                  ))}
                  {formAmount && (
                    <button
                      type="button"
                      onClick={() => setFormAmount("")}
                      className="rounded-lg border border-muted p-1.5 text-muted-foreground hover:bg-muted transition-colors"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Form Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="amount" className="text-xs">
                    Amount
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      ₹
                    </span>
                    <Input
                      id="amount"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={formAmount}
                      onChange={(e) => setFormAmount(e.target.value)}
                      className="pl-7 input-glow"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="desc" className="text-xs">
                    Description
                  </Label>
                  <Input
                    id="desc"
                    placeholder="Enter description..."
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    className="input-glow"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="category" className="text-xs">
                    Category
                  </Label>
                  <Select value={formCategory} onValueChange={setFormCategory}>
                    <SelectTrigger className="input-glow">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["Food", "Transport", "Utilities", "Salary", "Rent", "Supplies", "Miscellaneous"].map((cat) => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="date" className="text-xs">
                    Date
                  </Label>
                  <Input
                    id="date"
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="input-glow"
                  />
                </div>
              </div>

              {/* Cash Breakdown (Collapsible) */}
              <Collapsible open={breakdownOpen} onOpenChange={setBreakdownOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-1.5 text-xs p-0 h-auto">
                    {breakdownOpen ? (
                      <ChevronUp className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" />
                    )}
                    Cash Breakdown
                    {breakdownTotal > 0 && (
                      <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">
                        {formatCurrency(breakdownTotal)}
                      </Badge>
                    )}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-3">
                  <div className="bg-muted/50 rounded-xl p-3 sm:p-4">
                    {/* Visual Denomination Chips */}
                    <div className="flex flex-wrap gap-2 sm:gap-2.5">
                      {DENOMINATIONS.map((d, idx) => {
                        const count = parseInt(breakdown[d.key] || "0", 10)
                        const value = isNaN(count) ? 0 : count * d.value
                        const isActive = count > 0
                        return (
                          <div
                            key={d.key}
                            className={`relative flex items-center gap-1.5 rounded-full border-2 px-3 py-2 transition-all cursor-default ${
                              isActive
                                ? `${d.color} shadow-sm scale-[1.04] ring-1 ring-white/50`
                                : "border-muted/60 bg-gradient-to-br from-muted/40 to-muted/20"
                            }`}
                            style={!isActive ? { animationDelay: `${idx * 40}ms` } : undefined}
                          >
                            <span className="text-sm shrink-0">{d.emoji}</span>
                            <span className={`text-xs font-bold whitespace-nowrap ${isActive ? d.color.split(" ")[1] : "text-muted-foreground"}`}>{d.label}</span>
                            <Input
                              type="number"
                              min="0"
                              placeholder="0"
                              value={breakdown[d.key] || ""}
                              onChange={(e) =>
                                setBreakdown((prev) => ({ ...prev, [d.key]: e.target.value }))
                              }
                              className={`h-6 w-10 text-xs text-center border-0 focus-visible:ring-0 p-0 rounded-md bg-muted/60 font-mono ${isActive ? "font-bold" : ""}`}
                            />
                            {isActive && value > 0 && (
                              <span className="text-[9px] font-bold tabular-nums opacity-80">
                                {formatCurrency(value)}
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                    <Separator className="my-3" />
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">Breakdown Total</span>
                      <span className="font-bold text-green-600">{formatCurrency(breakdownTotal)}</span>
                    </div>
                    {formAmount && parseFloat(formAmount) > 0 && breakdownTotal > 0 && (
                      <div className="flex items-center justify-between text-xs mt-1">
                        <span className="text-muted-foreground">Difference from amount</span>
                        <span
                          className={
                            Math.abs(parseFloat(formAmount) - breakdownTotal) < 0.01
                              ? "text-green-600 font-medium"
                              : "text-amber-600 font-medium"
                          }
                        >
                          {formatCurrency(parseFloat(formAmount) - breakdownTotal)}
                          {Math.abs(parseFloat(formAmount) - breakdownTotal) < 0.01 && " ✓"}
                        </span>
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* Submit */}
              <Button
                onClick={handleAddTransaction}
                disabled={submitting}
                className={`w-full sm:w-auto hover-scale transition-all duration-200 active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-green-500/30 ${
                  formType === "income"
                    ? "bg-green-600 hover:bg-green-700 text-white"
                    : "bg-red-500 hover:bg-red-600 text-white"
                }`}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Add {formType === "income" ? "Income" : "Expense"}
                  </>
                )}
              </Button>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
      )}

      {/* ── Transaction History ── */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4 text-green-600" />
              Transaction History
              {!loading && (
                <Badge variant="secondary" className="text-[10px]">
                  {filteredTransactions.length}
                </Badge>
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative max-w-xs w-full">
                <Input
                  placeholder="Search transactions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 text-sm pl-8 input-glow"
                />
                <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              </div>
            </div>
          </div>
          {/* Filter Tabs */}
          {!loading && transactions.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 mt-3">
              <div className="flex items-center gap-1 p-1 bg-muted rounded-lg w-fit">
                {(["all", "income", "expense"] as FilterTab[]).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setFilterTab(tab)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                      filterTab === tab
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {tab === "all" && "All"}
                    {tab === "income" && <><ArrowUpCircle className="size-3" /> Income</>}
                    {tab === "expense" && <><ArrowDownCircle className="size-3" /> Expense</>}
                  </button>
                ))}
              </div>
              {/* Date Range Quick Filter */}
              <div className="flex items-center gap-1.5">
                <CalendarRange className="size-3.5 text-muted-foreground" />
                <div className="flex items-center gap-1">
                  {([
                    { key: "all" as DateFilter, label: "All Time" },
                    { key: "today" as DateFilter, label: "Today" },
                    { key: "week" as DateFilter, label: "This Week" },
                    { key: "month" as DateFilter, label: "This Month" },
                  ]).map((df) => (
                    <button
                      key={df.key}
                      type="button"
                      onClick={() => setDateFilter(df.key)}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                        dateFilter === df.key
                          ? "bg-green-600 text-white"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      {df.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-2">
                  <Skeleton className="h-9 w-9 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-5 w-20" />
                </div>
              ))}
            </div>
          ) : transactions.length === 0 ? (
            /* ── Empty State ── */
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <div className="relative mb-6 rounded-2xl border-2 border-dashed border-muted-foreground/20 bg-gradient-to-br from-green-50/60 to-emerald-50/40 dark:from-green-950/30 dark:to-emerald-950/20 p-6">
                <div className="relative">
                  <div className="flex size-20 items-center justify-center rounded-full bg-gradient-to-br from-green-100 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/30">
                    <Wallet className="size-10 text-green-500" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 flex size-8 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/50">
                    <DollarSign className="size-4 text-amber-600" />
                  </div>
                </div>
              </div>
              <h3 className="text-lg font-semibold mb-1">No Transactions Yet</h3>
              <p className="text-sm text-muted-foreground max-w-sm mb-1">
                Start tracking your cash flow by adding your first income or expense transaction.
              </p>
              <p className="text-xs text-muted-foreground/70 mb-4 italic">
                💡 Tip: Use the + button or the form above to add your first entry
              </p>
              <Button
                onClick={() => setFormOpen(true)}
                className="bg-green-600 hover:bg-green-700 transition-all duration-200 active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-green-500/30"
                disabled={!canCreate}
              >
                <Plus className="size-4 mr-2" />
                Add First Transaction
              </Button>
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center rounded-2xl border-2 border-dashed border-teal-300/40 dark:border-teal-700/30 bg-gradient-to-b from-teal-50/50 to-emerald-50/30 dark:from-teal-950/20 dark:to-emerald-950/10">
              <div className="rounded-full bg-teal-100 dark:bg-teal-900/40 p-5 animate-float">
                <Wallet className="h-10 w-10 text-teal-500 dark:text-teal-400" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-1">
                {searchQuery || filterTab !== 'all' || dateFilter !== 'all' ? 'No matching transactions' : 'No transactions yet'}
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                {searchQuery
                  ? `No transactions match "${searchQuery}".`
                  : filterTab !== 'all'
                    ? `No ${filterTab} transactions found.`
                    : 'Add your first cash transaction to get started.'}
              </p>
              {(searchQuery || filterTab !== 'all' || dateFilter !== 'all') && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => {
                    setSearchQuery("")
                    setFilterTab("all")
                    setDateFilter("all")
                  }}
                >
                  <X className="size-3.5 mr-1.5" />
                  Clear Filters
                </Button>
              )}
            </div>
          ) : (
            <div className="max-h-[500px] overflow-y-auto">
              {groupedTransactions.map((group) => (
                <div key={group.date}>
                  {/* Date Group Header */}
                  <div className="sticky top-0 z-10 flex items-center gap-3 border-b bg-muted/80 px-4 py-2 backdrop-blur-sm">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {group.date}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      ({group.items.length} transaction{group.items.length > 1 ? "s" : ""})
                    </span>
                  </div>

                  {/* Transactions in this group */}
                  {group.items.map((t, idx) => {
                    const balance = transactionWithBalance.get(`${t.id}-${t.createdAt}`)
                    const { category: txCategory, cleanDesc } = getCategoryFromDescription(t.description)
                    return (
                      <div
                        key={`${t.id}-${t.createdAt}`}
                        className={`flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors border-b last:border-0 hover-lift border-l-4 ${
                          t.type === "income" ? "border-l-green-400" : "border-l-red-400"
                        } ${idx % 2 === 1 ? "bg-muted/10" : ""}`}
                      >
                        {/* Icon */}
                        <div
                          className={`flex-shrink-0 h-9 w-9 rounded-full flex items-center justify-center ${
                            t.type === "income" ? "bg-green-100 dark:bg-green-900/30" : "bg-red-100 dark:bg-red-900/30"
                          }`}
                        >
                          {t.type === "income" ? (
                            <ArrowUpCircle className="h-4.5 w-4.5 text-green-600" />
                          ) : (
                            <ArrowDownCircle className="h-4.5 w-4.5 text-red-500" />
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-medium truncate">{cleanDesc}</p>
                            {txCategory && (
                              <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0 text-[10px] font-semibold whitespace-nowrap ${CATEGORY_COLORS[txCategory] || CATEGORY_COLORS.Miscellaneous}`}>
                                <span className="size-1.5 rounded-full bg-current opacity-60" />
                                {txCategory}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">{formatDate(t.date)}</p>
                        </div>

                        {/* Running Balance */}
                        {balance !== undefined && (
                          <div className="hidden sm:block text-right mr-2">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Balance</p>
                            <p className={`text-xs font-medium ${balance < 0 ? "text-red-500" : "text-muted-foreground"}`}>
                              {formatCurrency(balance)}
                            </p>
                          </div>
                        )}

                        {/* Amount */}
                        <p
                          className={`text-sm font-semibold flex-shrink-0 min-w-[80px] text-right tabular-nums ${
                            t.type === "income" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                          }`}
                        >
                          {t.type === "income" ? "+" : "-"}
                          {formatCurrency(t.amount)}
                        </p>

                        {/* Actions */}
                        <div className="flex items-center gap-0.5 flex-shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            onClick={() => openEditDialog(t)}
                            title="Edit"
                            disabled={!canEdit}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-destructive hover:text-destructive"
                            onClick={() => setDeleteTarget(t)}
                            title="Delete"
                            disabled={!canDelete}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Set Petty Cash Dialog ── */}
      <Dialog open={showSetPettyCash} onOpenChange={(open) => !open && setShowSetPettyCash(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-green-600" />
              Set Petty Cash Amount
            </DialogTitle>
            <DialogDescription>
              Set the base petty cash amount for your cash drawer.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="petty-cash-amount">Petty Cash Amount</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  ₹
                </span>
                <Input
                  id="petty-cash-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={pettyCashAmount}
                  onChange={(e) => setPettyCashAmount(e.target.value)}
                  className="pl-7"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSetPettyCash(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSetPettyCash}
              disabled={settingPettyCash}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {settingPettyCash ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Transaction Dialog ── */}
      <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-green-600" />
              Edit Transaction
            </DialogTitle>
            <DialogDescription>
              Update the transaction details below.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Type Toggle */}
            <div className="flex items-center gap-1 p-1 bg-muted rounded-lg w-fit">
              <button
                type="button"
                onClick={() => setEditType("income")}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                  editType === "income"
                    ? "bg-green-600 text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <ArrowUpCircle className="h-3.5 w-3.5" />
                Income
              </button>
              <button
                type="button"
                onClick={() => setEditType("expense")}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                  editType === "expense"
                    ? "bg-red-500 text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <ArrowDownCircle className="h-3.5 w-3.5" />
                Expense
              </button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-amount">Amount</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  ₹
                </span>
                <Input
                  id="edit-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                  className="pl-7"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-desc">Description</Label>
              <Input
                id="edit-desc"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-date">Date</Label>
              <Input
                id="edit-date"
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleEditTransaction}
              disabled={editing}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {editing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Update"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation ── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Transaction</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this{" "}
              <span className="font-semibold">
                {deleteTarget?.type === "income" ? "income" : "expense"}
              </span>{" "}
              of{" "}
              <span className="font-semibold">
                {formatCurrency(deleteTarget?.amount || 0)}
              </span>{" "}
              &mdash; &quot;{deleteTarget?.description}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Report Dialog */}
      <Dialog open={showReport} onOpenChange={setShowReport}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-green-600" />
              Cash Flow Report
            </DialogTitle>
            <DialogDescription>
              Generate a detailed PDF report for a specific date range
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="report-from" className="text-xs font-medium">From Date</Label>
                <Input
                  id="report-from"
                  type="date"
                  value={reportFromDate}
                  onChange={(e) => setReportFromDate(e.target.value)}
                  className="input-glow"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="report-to" className="text-xs font-medium">To Date</Label>
                <Input
                  id="report-to"
                  type="date"
                  value={reportToDate}
                  onChange={(e) => setReportToDate(e.target.value)}
                  className="input-glow"
                />
              </div>
            </div>
            {/* Quick date presets */}
            <div className="flex flex-wrap gap-2">
              {[
                { label: "Today", from: () => format(new Date(), "yyyy-MM-dd"), to: () => format(new Date(), "yyyy-MM-dd") },
                { label: "This Week", from: () => format(startOfDay(subDays(new Date(), 6)), "yyyy-MM-dd"), to: () => format(new Date(), "yyyy-MM-dd") },
                { label: "This Month", from: () => format(startOfMonth(new Date()), "yyyy-MM-dd"), to: () => format(new Date(), "yyyy-MM-dd") },
                { label: "Last Month", from: () => format(startOfMonth(subDays(startOfMonth(new Date()), 1)), "yyyy-MM-dd"), to: () => format(subDays(startOfMonth(new Date()), 1), "yyyy-MM-dd") },
                { label: "All Time", from: () => "2000-01-01", to: () => format(new Date(), "yyyy-MM-dd") },
              ].map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => {
                    setReportFromDate(preset.from())
                    setReportToDate(preset.to())
                  }}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                    reportFromDate === preset.from() && reportToDate === preset.to()
                      ? "bg-green-600 text-white border-green-600"
                      : "border-muted-foreground/20 text-muted-foreground hover:border-green-300 hover:bg-green-50"
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            {/* Summary preview */}
            <div className="rounded-lg bg-muted/50 p-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Report Summary</p>
              {(() => {
                const ft = transactions.filter((t) => t.date >= reportFromDate && t.date <= reportToDate)
                const pi = ft.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0)
                const pe = ft.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0)
                return (
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-xs text-muted-foreground">{ft.length} Records</p>
                    </div>
                    <div>
                      <p className="text-xs text-green-600 font-semibold">+₹{pi.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                      <p className="text-[10px] text-muted-foreground">Income</p>
                    </div>
                    <div>
                      <p className="text-xs text-red-500 font-semibold">-₹{pe.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                      <p className="text-[10px] text-muted-foreground">Expense</p>
                    </div>
                  </div>
                )
              })()}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowReport(false)}>
              Cancel
            </Button>
            <Button
              onClick={generateCashReport}
              disabled={generatingReport || reportFromDate > reportToDate}
              className="gap-2 bg-green-600 hover:bg-green-700"
            >
              {generatingReport ? <><Loader2 className="h-4 w-4 animate-spin" />Generating...</> : <><FileText className="h-4 w-4" />Generate Report</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
