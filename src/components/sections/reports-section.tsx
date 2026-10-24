'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  IndianRupee,
  CalendarDays,
  Clock,
  Download,
  Filter,
  RotateCcw,
  Loader2,
  FileText,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Package,
  ShoppingCart,
  CreditCard,
  PieChart as PieChartIcon,
  AlertTriangle,
  PackageX,
  CircleDollarSign,
  Receipt,
  Banknote,
  ArrowRightLeft,
  Users,
  UserCheck,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { notify } from '@/lib/notification-store';
import { useAuth } from '@/components/auth-provider';
import ReadOnlyBanner from '@/components/read-only-banner';

// ─── Types ────────────────────────────────────────────────────────────────────

interface OverviewData {
  totalInvoices: number;
  activeInvoices: number;
  totalRevenue: number;
  totalPaid: number;
  totalBalance: number;
  totalDiscount: number;
  totalDelivery: number;
  totalGST: number;
  pettyIncome: number;
  pettyExpense: number;
  dailyRevenue: { date: string; revenue: number }[];
  paymentBreakdown: { method: string; count: number; total: number }[];
}

interface BalanceBill {
  id: string;
  invoiceNumber: string;
  date: string;
  customerName: string;
  grandTotal: number;
  paidAmount: number;
  balanceAmount: number;
  paymentMethod: string;
  orderType: string;
}

interface BalanceData {
  totalBills: number;
  totalBalanceAmount: number;
  totalGrandTotal: number;
  totalPaid: number;
  bills: BalanceBill[];
}

interface RefundItem {
  id: string;
  refundNumber: string;
  date: string;
  originalInvoiceNumber: string;
  customerName: string;
  refundAmount: number;
  reason: string;
  status: string;
  items: unknown[];
}

interface RefundsData {
  totalRefunds: number;
  totalRefundAmount: number;
  refunds: RefundItem[];
}

interface ReturnItem {
  id: string;
  invoiceNumber: string;
  date: string;
  customerName: string;
  grandTotal: number;
  status: string;
  paymentMethod: string;
  refundCount: number;
  totalRefunded: number;
  items: unknown[];
}

interface ReturnsData {
  totalReturns: number;
  totalReturnedAmount: number;
  returns: ReturnItem[];
}

interface ReplaceItem {
  id: string;
  invoiceNumber: string;
  date: string;
  customerName: string;
  grandTotal: number;
  paidAmount: number;
  paymentMethod: string;
  orderType: string;
  items: unknown[];
}

interface ReplaceData {
  totalReplaced: number;
  totalReplacedAmount: number;
  replacements: ReplaceItem[];
}

interface ItemSalesEntry {
  name: string;
  totalQty: number;
  totalRevenue: number;
  count: number;
}

interface ItemSalesData {
  totalItems: number;
  totalItemRevenue: number;
  totalItemQty: number;
  items: ItemSalesEntry[];
}

interface InventoryCategory {
  category: string;
  count: number;
  value: number;
  qty: number;
}

interface LowStockItem {
  id: string;
  name: string;
  category: string;
  price: number;
  quantity: number;
}

interface InventoryData {
  totalItems: number;
  totalValue: number;
  lowStockCount: number;
  outOfStockCount: number;
  wellStockedCount: number;
  categoryBreakdown: InventoryCategory[];
  lowStockItems: LowStockItem[];
}

interface DailyCashFlow {
  date: string;
  income: number;
  expense: number;
  net: number;
}

interface CashFlowTransaction {
  id: string;
  date: string;
  type: string;
  amount: number;
  description: string;
}

interface CashFlowData {
  totalInvoiceIncome: number;
  totalPettyIncome: number;
  totalPettyExpense: number;
  netCashFlow: number;
  dailyCashFlow: DailyCashFlow[];
  transactions: CashFlowTransaction[];
}

interface StatusEntry {
  status: string;
  count: number;
  totalAmount: number;
  totalPaid: number;
  totalBalance: number;
}

interface StatusData {
  totalInvoices: number;
  totalAmount: number;
  statusSummary: StatusEntry[];
}

interface CsvColumn {
  key: string;
  label: string;
}

interface ReportsSectionProps {
  dataVersion?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount: number): string {
  return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getTodayFilename(prefix: string): string {
  const today = new Date().toISOString().split('T')[0];
  return `${prefix}_${today}.csv`;
}

function exportToCSV<T extends Record<string, unknown>>(
  data: T[],
  filename: string,
  columns: CsvColumn[]
) {
  if (data.length === 0) return;

  const escapeCSV = (value: unknown): string => {
    const str = String(value ?? '');
    if (str.includes('"') || str.includes(',') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const header = columns.map((c) => escapeCSV(c.label)).join(',');
  const rows = data.map((row) =>
    columns.map((c) => escapeCSV(row[c.key])).join(',')
  );
  const csv = [header, ...rows].join('\n');

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

const paymentMethods = ['All', 'Cash', 'Card', 'UPI', 'Net Banking', 'Replace', 'Refund'];

const CHART_COLORS = [
  '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
  '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899',
  '#6366f1', '#84cc16',
];

const STATUS_COLORS: Record<string, string> = {
  Paid: '#10b981',
  Completed: '#10b981',
  Balance: '#f59e0b',
  Pending: '#f59e0b',
  Partial: '#f59e0b',
  Refunded: '#ef4444',
  Cancelled: '#ef4444',
  Replaced: '#8b5cf6',
  Active: '#10b981',
};

function getStatusColor(status: string): string {
  return STATUS_COLORS[status] || '#6b7280';
}

function getStatusBadgeVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status.toLowerCase()) {
    case 'paid':
    case 'completed':
    case 'active':
      return 'default';
    case 'pending':
    case 'balance':
    case 'partial':
      return 'secondary';
    case 'refunded':
    case 'cancelled':
      return 'destructive';
    default:
      return 'outline';
  }
}

function formatDateShort(dateStr: string): string {
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

// ─── Tab Type ─────────────────────────────────────────────────────────────────

type ReportTab = 'overview' | 'balance' | 'refunds' | 'returns' | 'replace' | 'items' | 'inventory' | 'cashflow' | 'status';

// ─── Component ────────────────────────────────────────────────────────────────

export default function ReportsSection({ dataVersion }: ReportsSectionProps) {
  const { token, hasPermission } = useAuth();
  const canAccess = hasPermission('reports', 'access');
  const canExport = hasPermission('reports', 'export');
  const noAccess = !canAccess;
  const isReadOnly = !canAccess || !canExport;
  const authHeaders: Record<string, string> = token ? { 'Authorization': `Bearer ${token}` } : {};
  const [lastFetched, setLastFetched] = useState<string>('');
  const [activeTab, setActiveTab] = useState<ReportTab>('overview');

  // Date range filters
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [paymentFilter, setPaymentFilter] = useState('All');

  // ── Overview State ──
  const [overviewData, setOverviewData] = useState<OverviewData | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);

  // ── Balance State ──
  const [balanceData, setBalanceData] = useState<BalanceData | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);

  // ── Refunds State ──
  const [refundsData, setRefundsData] = useState<RefundsData | null>(null);
  const [refundsLoading, setRefundsLoading] = useState(false);

  // ── Returns State ──
  const [returnsData, setReturnsData] = useState<ReturnsData | null>(null);
  const [returnsLoading, setReturnsLoading] = useState(false);

  // ── Replace State ──
  const [replaceData, setReplaceData] = useState<ReplaceData | null>(null);
  const [replaceLoading, setReplaceLoading] = useState(false);

  // ── Item Sales State ──
  const [itemsData, setItemsData] = useState<ItemSalesData | null>(null);
  const [itemsLoading, setItemsLoading] = useState(false);

  // ── Inventory State ──
  const [inventoryData, setInventoryData] = useState<InventoryData | null>(null);
  const [inventoryLoading, setInventoryLoading] = useState(false);

  // ── Cash Flow State ──
  const [cashFlowData, setCashFlowData] = useState<CashFlowData | null>(null);
  const [cashFlowLoading, setCashFlowLoading] = useState(false);

  // ── Status State ──
  const [statusData, setStatusData] = useState<StatusData | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);

  // ── Fetch URL Builder ──
  const buildUrl = useCallback((type: ReportTab): string => {
    const params = new URLSearchParams({ type, startDate, endDate });
    if (paymentFilter !== 'All') params.set('paymentMethod', paymentFilter);
    return `/api/reports/advanced?${params}`;
  }, [startDate, endDate, paymentFilter]);

  // ── Fetch Functions ──
  const fetchOverview = useCallback(async (silent?: boolean) => {
    if (!silent) setOverviewLoading(true);
    try {
      const res = await fetch(buildUrl('overview'), { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        setOverviewData(data);
      } else {
        notify({ type: 'error', title: 'Error', message: 'Failed to fetch sales overview' });
      }
    } catch {
      notify({ type: 'error', title: 'Error', message: 'Failed to fetch sales overview' });
    } finally {
      setOverviewLoading(false);
      setLastFetched(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }
  }, [buildUrl]);

  const fetchBalance = useCallback(async (silent?: boolean) => {
    if (!silent) setBalanceLoading(true);
    try {
      const res = await fetch(buildUrl('balance'), { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        setBalanceData(data);
      } else {
        notify({ type: 'error', title: 'Error', message: 'Failed to fetch balance due data' });
      }
    } catch {
      notify({ type: 'error', title: 'Error', message: 'Failed to fetch balance due data' });
    } finally {
      setBalanceLoading(false);
      setLastFetched(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }
  }, [buildUrl]);

  const fetchRefunds = useCallback(async (silent?: boolean) => {
    if (!silent) setRefundsLoading(true);
    try {
      const res = await fetch(buildUrl('refunds'), { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        setRefundsData(data);
      } else {
        notify({ type: 'error', title: 'Error', message: 'Failed to fetch refunds data' });
      }
    } catch {
      notify({ type: 'error', title: 'Error', message: 'Failed to fetch refunds data' });
    } finally {
      setRefundsLoading(false);
      setLastFetched(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }
  }, [buildUrl]);

  const fetchReturns = useCallback(async (silent?: boolean) => {
    if (!silent) setReturnsLoading(true);
    try {
      const res = await fetch(buildUrl('returns'), { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        setReturnsData(data);
      } else {
        notify({ type: 'error', title: 'Error', message: 'Failed to fetch returns data' });
      }
    } catch {
      notify({ type: 'error', title: 'Error', message: 'Failed to fetch returns data' });
    } finally {
      setReturnsLoading(false);
      setLastFetched(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }
  }, [buildUrl]);

  const fetchReplace = useCallback(async (silent?: boolean) => {
    if (!silent) setReplaceLoading(true);
    try {
      const res = await fetch(buildUrl('replace'), { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        setReplaceData(data);
      } else {
        notify({ type: 'error', title: 'Error', message: 'Failed to fetch replace data' });
      }
    } catch {
      notify({ type: 'error', title: 'Error', message: 'Failed to fetch replace data' });
    } finally {
      setReplaceLoading(false);
      setLastFetched(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }
  }, [buildUrl]);

  const fetchItems = useCallback(async (silent?: boolean) => {
    if (!silent) setItemsLoading(true);
    try {
      const res = await fetch(buildUrl('items'), { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        setItemsData(data);
      } else {
        notify({ type: 'error', title: 'Error', message: 'Failed to fetch item sales data' });
      }
    } catch {
      notify({ type: 'error', title: 'Error', message: 'Failed to fetch item sales data' });
    } finally {
      setItemsLoading(false);
      setLastFetched(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }
  }, [buildUrl]);

  const fetchInventory = useCallback(async (silent?: boolean) => {
    if (!silent) setInventoryLoading(true);
    try {
      const res = await fetch(buildUrl('inventory'), { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        setInventoryData(data);
      } else {
        notify({ type: 'error', title: 'Error', message: 'Failed to fetch inventory data' });
      }
    } catch {
      notify({ type: 'error', title: 'Error', message: 'Failed to fetch inventory data' });
    } finally {
      setInventoryLoading(false);
      setLastFetched(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }
  }, [buildUrl]);

  const fetchCashFlow = useCallback(async (silent?: boolean) => {
    if (!silent) setCashFlowLoading(true);
    try {
      const res = await fetch(buildUrl('cashflow'), { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        setCashFlowData(data);
      } else {
        notify({ type: 'error', title: 'Error', message: 'Failed to fetch cash flow data' });
      }
    } catch {
      notify({ type: 'error', title: 'Error', message: 'Failed to fetch cash flow data' });
    } finally {
      setCashFlowLoading(false);
      setLastFetched(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }
  }, [buildUrl]);

  const fetchStatus = useCallback(async (silent?: boolean) => {
    if (!silent) setStatusLoading(true);
    try {
      const res = await fetch(buildUrl('status'), { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        setStatusData(data);
      } else {
        notify({ type: 'error', title: 'Error', message: 'Failed to fetch status summary' });
      }
    } catch {
      notify({ type: 'error', title: 'Error', message: 'Failed to fetch status summary' });
    } finally {
      setStatusLoading(false);
      setLastFetched(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }
  }, [buildUrl]);

  // Map tab to fetch function
  const fetchByTab = useCallback((tab: ReportTab, silent?: boolean) => {
    switch (tab) {
      case 'overview': return fetchOverview(silent);
      case 'balance': return fetchBalance(silent);
      case 'refunds': return fetchRefunds(silent);
      case 'returns': return fetchReturns(silent);
      case 'replace': return fetchReplace(silent);
      case 'items': return fetchItems(silent);
      case 'inventory': return fetchInventory(silent);
      case 'cashflow': return fetchCashFlow(silent);
      case 'status': return fetchStatus(silent);
    }
  }, [fetchOverview, fetchBalance, fetchRefunds, fetchReturns, fetchReplace, fetchItems, fetchInventory, fetchCashFlow, fetchStatus]);

  // Fetch on tab change
  useEffect(() => {
    fetchByTab(activeTab);
  }, [activeTab, fetchByTab]);

  // Re-fetch data when dataVersion changes (sync from other tabs/devices)
  const prevDataVersion = useRef(dataVersion);
  useEffect(() => {
    if (dataVersion !== undefined && dataVersion !== prevDataVersion.current) {
      prevDataVersion.current = dataVersion;
      fetchByTab(activeTab, true);  // silent=true for background sync
    }
  }, [dataVersion, fetchByTab, activeTab]);

  // Filter handlers
  const handleApplyFilters = () => {
    fetchByTab(activeTab);
  };

  const handleResetFilters = () => {
    const d = new Date();
    d.setDate(1);
    setStartDate(d.toISOString().split('T')[0]);
    setEndDate(new Date().toISOString().split('T')[0]);
    setPaymentFilter('All');
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value as ReportTab);
  };

  // ── Computed Chart Data ──

  // Overview: daily revenue bar chart
  const dailyRevenueChartData = useMemo(() => {
    if (!overviewData?.dailyRevenue) return [];
    return overviewData.dailyRevenue.map((d) => ({
      date: formatDateShort(d.date),
      revenue: d.revenue,
    }));
  }, [overviewData]);

  // Overview: payment method pie chart
  const paymentPieData = useMemo(() => {
    if (!overviewData?.paymentBreakdown) return [];
    return overviewData.paymentBreakdown.map((p) => ({
      name: p.method,
      value: p.total,
      count: p.count,
    }));
  }, [overviewData]);

  // Item Sales: top items bar chart
  const topItemsChartData = useMemo(() => {
    if (!itemsData?.items) return [];
    return itemsData.items.slice(0, 10).map((item) => ({
      name: item.name.length > 12 ? item.name.slice(0, 12) + '…' : item.name,
      revenue: item.totalRevenue,
      qty: item.totalQty,
    }));
  }, [itemsData]);

  // Cash Flow: daily chart data
  const cashFlowChartData = useMemo(() => {
    if (!cashFlowData?.dailyCashFlow) return [];
    return cashFlowData.dailyCashFlow.map((d) => ({
      date: formatDateShort(d.date),
      income: d.income,
      expense: d.expense,
      net: d.net,
    }));
  }, [cashFlowData]);

  // Inventory: category breakdown pie
  const inventoryCategoryPie = useMemo(() => {
    if (!inventoryData?.categoryBreakdown) return [];
    return inventoryData.categoryBreakdown.map((c) => ({
      name: c.category,
      value: c.value,
      count: c.count,
    }));
  }, [inventoryData]);

  // Status: pie chart
  const statusPieData = useMemo(() => {
    if (!statusData?.statusSummary) return [];
    return statusData.statusSummary.map((s) => ({
      name: s.status,
      value: s.totalAmount,
      count: s.count,
    }));
  }, [statusData]);

  // ── CSV Export Handlers ──

  const handleExportOverview = () => {
    if (!overviewData?.dailyRevenue?.length) {
      notify({ type: 'info', title: 'No Data', message: 'No data to export' });
      return;
    }
    const columns: CsvColumn[] = [
      { key: 'date', label: 'Date' },
      { key: 'revenue', label: 'Revenue' },
    ];
    exportToCSV(
      overviewData.dailyRevenue as unknown as Record<string, unknown>[],
      getTodayFilename('sales-overview'),
      columns
    );
    notify({ type: 'success', title: 'Exported', message: 'Sales overview exported' });
  };

  const handleExportBalance = () => {
    if (!balanceData?.bills?.length) {
      notify({ type: 'info', title: 'No Data', message: 'No data to export' });
      return;
    }
    const columns: CsvColumn[] = [
      { key: 'invoiceNumber', label: 'Invoice No' },
      { key: 'date', label: 'Date' },
      { key: 'customerName', label: 'Customer' },
      { key: 'grandTotal', label: 'Grand Total' },
      { key: 'paidAmount', label: 'Paid' },
      { key: 'balanceAmount', label: 'Balance' },
      { key: 'paymentMethod', label: 'Payment' },
      { key: 'orderType', label: 'Order Type' },
    ];
    exportToCSV(
      balanceData.bills as unknown as Record<string, unknown>[],
      getTodayFilename('balance-due'),
      columns
    );
    notify({ type: 'success', title: 'Exported', message: 'Balance due report exported' });
  };

  const handleExportRefunds = () => {
    if (!refundsData?.refunds?.length) {
      notify({ type: 'info', title: 'No Data', message: 'No data to export' });
      return;
    }
    const columns: CsvColumn[] = [
      { key: 'refundNumber', label: 'Refund No' },
      { key: 'date', label: 'Date' },
      { key: 'originalInvoiceNumber', label: 'Original Invoice' },
      { key: 'customerName', label: 'Customer' },
      { key: 'refundAmount', label: 'Refund Amount' },
      { key: 'reason', label: 'Reason' },
      { key: 'status', label: 'Status' },
    ];
    exportToCSV(
      refundsData.refunds as unknown as Record<string, unknown>[],
      getTodayFilename('refunds'),
      columns
    );
    notify({ type: 'success', title: 'Exported', message: 'Refunds report exported' });
  };

  const handleExportReturns = () => {
    if (!returnsData?.returns?.length) {
      notify({ type: 'info', title: 'No Data', message: 'No data to export' });
      return;
    }
    const columns: CsvColumn[] = [
      { key: 'invoiceNumber', label: 'Invoice No' },
      { key: 'date', label: 'Date' },
      { key: 'customerName', label: 'Customer' },
      { key: 'grandTotal', label: 'Grand Total' },
      { key: 'status', label: 'Status' },
      { key: 'paymentMethod', label: 'Payment' },
      { key: 'refundCount', label: 'Refund Count' },
      { key: 'totalRefunded', label: 'Total Refunded' },
    ];
    exportToCSV(
      returnsData.returns as unknown as Record<string, unknown>[],
      getTodayFilename('returns'),
      columns
    );
    notify({ type: 'success', title: 'Exported', message: 'Returns report exported' });
  };

  const handleExportReplace = () => {
    if (!replaceData?.replacements?.length) {
      notify({ type: 'info', title: 'No Data', message: 'No data to export' });
      return;
    }
    const columns: CsvColumn[] = [
      { key: 'invoiceNumber', label: 'Invoice No' },
      { key: 'date', label: 'Date' },
      { key: 'customerName', label: 'Customer' },
      { key: 'grandTotal', label: 'Grand Total' },
      { key: 'paidAmount', label: 'Paid' },
      { key: 'paymentMethod', label: 'Payment' },
      { key: 'orderType', label: 'Order Type' },
    ];
    exportToCSV(
      replaceData.replacements as unknown as Record<string, unknown>[],
      getTodayFilename('replacements'),
      columns
    );
    notify({ type: 'success', title: 'Exported', message: 'Replace report exported' });
  };

  const handleExportItems = () => {
    if (!itemsData?.items?.length) {
      notify({ type: 'info', title: 'No Data', message: 'No data to export' });
      return;
    }
    const columns: CsvColumn[] = [
      { key: 'name', label: 'Item Name' },
      { key: 'totalQty', label: 'Total Qty' },
      { key: 'totalRevenue', label: 'Total Revenue' },
      { key: 'count', label: 'Times Sold' },
    ];
    exportToCSV(
      itemsData.items as unknown as Record<string, unknown>[],
      getTodayFilename('item-sales'),
      columns
    );
    notify({ type: 'success', title: 'Exported', message: 'Item sales report exported' });
  };

  const handleExportInventory = () => {
    if (!inventoryData?.lowStockItems?.length && !inventoryData?.categoryBreakdown?.length) {
      notify({ type: 'info', title: 'No Data', message: 'No data to export' });
      return;
    }
    // Export category breakdown
    if (inventoryData.categoryBreakdown.length > 0) {
      const columns: CsvColumn[] = [
        { key: 'category', label: 'Category' },
        { key: 'count', label: 'Item Count' },
        { key: 'value', label: 'Total Value' },
        { key: 'qty', label: 'Total Qty' },
      ];
      exportToCSV(
        inventoryData.categoryBreakdown as unknown as Record<string, unknown>[],
        getTodayFilename('inventory-categories'),
        columns
      );
    }
    // Export low stock items
    if (inventoryData.lowStockItems.length > 0) {
      const columns: CsvColumn[] = [
        { key: 'name', label: 'Item Name' },
        { key: 'category', label: 'Category' },
        { key: 'price', label: 'Price' },
        { key: 'quantity', label: 'Quantity' },
      ];
      exportToCSV(
        inventoryData.lowStockItems as unknown as Record<string, unknown>[],
        getTodayFilename('low-stock-items'),
        columns
      );
    }
    notify({ type: 'success', title: 'Exported', message: 'Inventory report exported' });
  };

  const handleExportCashFlow = () => {
    if (!cashFlowData?.transactions?.length) {
      notify({ type: 'info', title: 'No Data', message: 'No data to export' });
      return;
    }
    const columns: CsvColumn[] = [
      { key: 'date', label: 'Date' },
      { key: 'type', label: 'Type' },
      { key: 'amount', label: 'Amount' },
      { key: 'description', label: 'Description' },
    ];
    exportToCSV(
      cashFlowData.transactions as unknown as Record<string, unknown>[],
      getTodayFilename('cash-flow'),
      columns
    );
    notify({ type: 'success', title: 'Exported', message: 'Cash flow report exported' });
  };

  const handleExportStatus = () => {
    if (!statusData?.statusSummary?.length) {
      notify({ type: 'info', title: 'No Data', message: 'No data to export' });
      return;
    }
    const columns: CsvColumn[] = [
      { key: 'status', label: 'Status' },
      { key: 'count', label: 'Count' },
      { key: 'totalAmount', label: 'Total Amount' },
      { key: 'totalPaid', label: 'Total Paid' },
      { key: 'totalBalance', label: 'Total Balance' },
    ];
    exportToCSV(
      statusData.statusSummary as unknown as Record<string, unknown>[],
      getTodayFilename('status-summary'),
      columns
    );
    notify({ type: 'success', title: 'Exported', message: 'Status summary exported' });
  };

  // ── Tooltip Style ──
  const tooltipStyle = {
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
    fontSize: '12px',
  };

  // ── Render ──

  return (
    <div className="space-y-6">
      {/* ── Gradient Header Banner ── */}
      {isReadOnly && <ReadOnlyBanner module="Reports" noAccess={noAccess} />}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 p-5 md:p-6 text-white shadow-lg shadow-green-600/20">
        <div className="pointer-events-none absolute -right-8 -top-8 size-36 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-6 -left-6 size-28 rounded-full bg-white/5" />
        <div className="pointer-events-none absolute right-24 top-2 size-14 rounded-full bg-white/5" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-xl md:text-2xl font-bold tracking-tight flex items-center gap-2">
              <BarChart3 className="size-6" />
              Reports &amp; Analytics
            </h2>
            <p className="text-green-100 text-sm mt-1">
              Comprehensive business insights across sales, inventory, cash flow &amp; more
            </p>
          </div>
          <div className="flex items-center gap-2">
            {lastFetched && (
              <div className="flex items-center gap-1.5 rounded-lg bg-white/15 backdrop-blur-sm px-3 py-1.5 text-xs">
                <Clock className="size-3" />
                <span className="text-green-100">Updated</span>
                <span className="font-medium">{lastFetched}</span>
              </div>
            )}
            <Button
              size="sm"
              variant="secondary"
              className="bg-white/15 hover:bg-white/25 text-white border-white/20 backdrop-blur-sm gap-1.5"
              onClick={() => fetchByTab(activeTab)}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          {/* Date Range Filters (shared across tabs) */}
          <Card className="mb-4 bg-muted/30 border-0">
            <CardContent className="p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:flex-wrap">
                <div className="grid gap-1.5">
                  <Label className="text-xs text-muted-foreground">Start Date</Label>
                  <div className="relative">
                    <CalendarDays className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full sm:w-[160px] pl-9 focus-visible:ring-2 focus-visible:ring-green-500/20 focus-visible:border-green-500 transition-all duration-200"
                    />
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs text-muted-foreground">End Date</Label>
                  <div className="relative">
                    <CalendarDays className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full sm:w-[160px] pl-9 focus-visible:ring-2 focus-visible:ring-green-500/20 focus-visible:border-green-500 transition-all duration-200"
                    />
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs text-muted-foreground">Payment Method</Label>
                  <Select value={paymentFilter} onValueChange={setPaymentFilter}>
                    <SelectTrigger className="w-full sm:w-[160px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {paymentMethods.map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleApplyFilters}
                    className="bg-green-600 hover:bg-green-700 text-white gap-1.5 hover-glow-green"
                  >
                    <Filter className="h-4 w-4" />
                    Apply
                  </Button>
                  <Button variant="outline" onClick={handleResetFilters} className="gap-1.5">
                    <RotateCcw className="h-4 w-4" />
                    Reset
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <div className="overflow-x-auto -mx-1 px-1">
              <TabsList className="mb-4 flex-wrap h-auto gap-1">
                <TabsTrigger value="overview" className="gap-1.5 text-xs sm:text-sm">
                  <TrendingUp className="h-4 w-4" />
                  <span className="hidden sm:inline">Sales </span>Overview
                </TabsTrigger>
                <TabsTrigger value="balance" className="gap-1.5 text-xs sm:text-sm">
                  <IndianRupee className="h-4 w-4" />
                  Balance Due
                </TabsTrigger>
                <TabsTrigger value="refunds" className="gap-1.5 text-xs sm:text-sm">
                  <ArrowDownRight className="h-4 w-4" />
                  Refunds
                </TabsTrigger>
                <TabsTrigger value="returns" className="gap-1.5 text-xs sm:text-sm">
                  <RotateCcw className="h-4 w-4" />
                  Returns
                </TabsTrigger>
                <TabsTrigger value="replace" className="gap-1.5 text-xs sm:text-sm">
                  <ArrowRightLeft className="h-4 w-4" />
                  Replace
                </TabsTrigger>
                <TabsTrigger value="items" className="gap-1.5 text-xs sm:text-sm">
                  <ShoppingCart className="h-4 w-4" />
                  Item Sales
                </TabsTrigger>
                <TabsTrigger value="inventory" className="gap-1.5 text-xs sm:text-sm">
                  <Package className="h-4 w-4" />
                  Inventory
                </TabsTrigger>
                <TabsTrigger value="cashflow" className="gap-1.5 text-xs sm:text-sm">
                  <Wallet className="h-4 w-4" />
                  Cash Flow
                </TabsTrigger>
                <TabsTrigger value="status" className="gap-1.5 text-xs sm:text-sm">
                  <PieChartIcon className="h-4 w-4" />
                  Status Summary
                </TabsTrigger>
              </TabsList>
            </div>

            {/* ═══════════════════ SALES OVERVIEW TAB ═══════════════════ */}
            <TabsContent value="overview">
              {overviewLoading ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <Skeleton key={i} className="h-24 rounded-xl" />
                    ))}
                  </div>
                  <Skeleton className="h-64 rounded-xl" />
                  <Skeleton className="h-48 rounded-xl" />
                </div>
              ) : overviewData ? (
                <>
                  {/* Summary Cards */}
                  <div className="mb-4 grid gap-3 grid-cols-2 lg:grid-cols-4">
                    <Card className="py-4 card-hover-glow border-l-4 border-l-green-500">
                      <CardContent className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                          <FileText className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Invoices</p>
                          <p className="text-lg font-bold tabular-nums">{overviewData.totalInvoices}</p>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="py-4 card-hover-glow border-l-4 border-l-emerald-500">
                      <CardContent className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                          <TrendingUp className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Revenue</p>
                          <p className="text-lg font-bold tabular-nums">{formatCurrency(overviewData.totalRevenue)}</p>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="py-4 card-hover-glow border-l-4 border-l-teal-500">
                      <CardContent className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-100 dark:bg-teal-900/30">
                          <Banknote className="h-5 w-5 text-teal-600" />
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Paid</p>
                          <p className="text-lg font-bold tabular-nums">{formatCurrency(overviewData.totalPaid)}</p>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="py-4 card-hover-glow border-l-4 border-l-amber-500">
                      <CardContent className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
                          <Clock className="h-5 w-5 text-amber-600" />
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Balance Due</p>
                          <p className="text-lg font-bold tabular-nums">{formatCurrency(overviewData.totalBalance)}</p>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="py-4 card-hover-glow border-l-4 border-l-cyan-500">
                      <CardContent className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cyan-100 dark:bg-cyan-900/30">
                          <Receipt className="h-5 w-5 text-cyan-600" />
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total GST</p>
                          <p className="text-lg font-bold tabular-nums">{formatCurrency(overviewData.totalGST)}</p>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="py-4 card-hover-glow border-l-4 border-l-lime-500">
                      <CardContent className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-lime-100 dark:bg-lime-900/30">
                          <TrendingDown className="h-5 w-5 text-lime-600" />
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Discount</p>
                          <p className="text-lg font-bold tabular-nums">{formatCurrency(overviewData.totalDiscount)}</p>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="py-4 card-hover-glow border-l-4 border-l-rose-500">
                      <CardContent className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-900/30">
                          <ArrowUpRight className="h-5 w-5 text-rose-600" />
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Petty Income</p>
                          <p className="text-lg font-bold tabular-nums">{formatCurrency(overviewData.pettyIncome)}</p>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="py-4 card-hover-glow border-l-4 border-l-purple-500">
                      <CardContent className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30">
                          <ArrowDownRight className="h-5 w-5 text-purple-600" />
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Petty Expense</p>
                          <p className="text-lg font-bold tabular-nums">{formatCurrency(overviewData.pettyExpense)}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Daily Revenue Bar Chart */}
                  {dailyRevenueChartData.length > 0 && (
                    <Card className="mb-4">
                      <CardHeader className="pb-2 pt-4 px-5">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                            <BarChart3 className="h-4 w-4 text-green-600" />
                            Daily Revenue Breakdown
                          </CardTitle>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleExportOverview}
                            disabled={!canExport}
                            className="gap-1.5 text-xs"
                          >
                            <Download className="h-3.5 w-3.5" />
                            CSV
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="px-5 pb-4">
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={dailyRevenueChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                              <XAxis
                                dataKey="date"
                                tick={{ fontSize: 11, fill: '#6b7280' }}
                                axisLine={{ stroke: '#e5e7eb' }}
                                tickLine={false}
                              />
                              <YAxis
                                tick={{ fontSize: 11, fill: '#6b7280' }}
                                axisLine={false}
                                tickLine={false}
                                tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}k`}
                              />
                              <Tooltip
                                contentStyle={tooltipStyle}
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                formatter={((value: any) => [formatCurrency(value), 'Revenue']) as any}
                                cursor={{ fill: 'rgba(16,185,129,0.08)' }}
                              />
                              <Bar
                                dataKey="revenue"
                                fill="#10b981"
                                radius={[4, 4, 0, 0]}
                                animationDuration={800}
                                animationEasing="ease-out"
                              />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Payment Method Pie Chart */}
                  {paymentPieData.length > 0 && (
                    <Card className="mb-4">
                      <CardHeader className="pb-2 pt-4 px-5">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                          <CreditCard className="h-4 w-4 text-green-600" />
                          Payment Method Breakdown
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="px-5 pb-4">
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={paymentPieData}
                                cx="50%"
                                cy="50%"
                                innerRadius={50}
                                outerRadius={90}
                                paddingAngle={3}
                                dataKey="value"
                                animationDuration={800}
                                label={((props: any) => `${props.name} (${(props.percent * 100).toFixed(0)}%)`) as any}
                              >
                                {paymentPieData.map((_, index) => (
                                  <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip
                                contentStyle={tooltipStyle}
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                formatter={((v: any, n: any) => [formatCurrency(v), n]) as any}
                              />
                              <Legend />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>

                        {/* Payment Method Table */}
                        <div className="mt-4 rounded-lg border overflow-hidden">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-muted/50">
                                <TableHead>Method</TableHead>
                                <TableHead className="text-center">Count</TableHead>
                                <TableHead className="text-right">Total</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {overviewData.paymentBreakdown.map((p, idx) => (
                                <TableRow key={idx} className="hover:bg-muted/30 transition-all duration-200">
                                  <TableCell>
                                    <div className="flex items-center gap-2">
                                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }} />
                                      <span className="font-medium text-sm">{p.method}</span>
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-center tabular-nums">{p.count}</TableCell>
                                  <TableCell className="text-right font-mono">{formatCurrency(p.total)}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {overviewData.totalInvoices === 0 && (
                    <div className="border-2 border-dashed border-muted-foreground/15 bg-gradient-to-b from-muted/20 to-transparent rounded-2xl p-6">
                      <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                        <BarChart3 className="h-12 w-12 mb-3 opacity-40 animate-float" />
                        <p className="text-sm">No sales data found for the selected period.</p>
                      </div>
                    </div>
                  )}
                </>
              ) : null}
            </TabsContent>

            {/* ═══════════════════ BALANCE DUE TAB ═══════════════════ */}
            <TabsContent value="balance">
              {balanceLoading ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <Skeleton key={i} className="h-24 rounded-xl" />
                    ))}
                  </div>
                  <Skeleton className="h-48 rounded-xl" />
                </div>
              ) : balanceData ? (
                <>
                  {/* Summary Cards */}
                  <div className="mb-4 grid gap-3 grid-cols-2 lg:grid-cols-4">
                    <Card className="py-4 card-hover-glow border-l-4 border-l-amber-500">
                      <CardContent className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
                          <FileText className="h-5 w-5 text-amber-600" />
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Bills</p>
                          <p className="text-lg font-bold tabular-nums">{balanceData.totalBills}</p>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="py-4 card-hover-glow border-l-4 border-l-red-500">
                      <CardContent className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                          <IndianRupee className="h-5 w-5 text-red-600" />
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Balance Amount</p>
                          <p className="text-lg font-bold tabular-nums text-red-600 dark:text-red-400">{formatCurrency(balanceData.totalBalanceAmount)}</p>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="py-4 card-hover-glow border-l-4 border-l-green-500">
                      <CardContent className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                          <Banknote className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Paid</p>
                          <p className="text-lg font-bold tabular-nums">{formatCurrency(balanceData.totalPaid)}</p>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="py-4 card-hover-glow border-l-4 border-l-teal-500">
                      <CardContent className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-100 dark:bg-teal-900/30">
                          <Receipt className="h-5 w-5 text-teal-600" />
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Grand Total</p>
                          <p className="text-lg font-bold tabular-nums">{formatCurrency(balanceData.totalGrandTotal)}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Export & Table */}
                  {balanceData.bills.length > 0 && (
                    <div className="flex items-center justify-end mb-2">
                      <Button
                        size="sm"
                        onClick={handleExportBalance}
                        disabled={!canExport}
                        className="bg-green-600 hover:bg-green-700 text-white gap-1.5 hover-glow-green"
                      >
                        <Download className="h-4 w-4" />
                        Export CSV
                      </Button>
                    </div>
                  )}

                  {balanceData.bills.length === 0 ? (
                    <div className="border-2 border-dashed border-muted-foreground/15 bg-gradient-to-b from-muted/20 to-transparent rounded-2xl p-6">
                      <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                        <IndianRupee className="h-12 w-12 mb-3 opacity-40 animate-float" />
                        <p className="text-sm">No balance due bills found for the selected period.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead>Invoice No</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead className="hidden sm:table-cell">Customer</TableHead>
                            <TableHead className="text-right">Grand Total</TableHead>
                            <TableHead className="text-right">Paid</TableHead>
                            <TableHead className="text-right">Balance</TableHead>
                            <TableHead className="hidden md:table-cell">Payment</TableHead>
                            <TableHead className="hidden lg:table-cell">Order Type</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {balanceData.bills.map((bill) => (
                            <TableRow key={bill.id} className="hover:bg-muted/30 transition-all duration-200">
                              <TableCell className="font-mono font-medium text-xs">{bill.invoiceNumber}</TableCell>
                              <TableCell className="text-sm">{bill.date}</TableCell>
                              <TableCell className="hidden sm:table-cell">{bill.customerName}</TableCell>
                              <TableCell className="text-right font-mono">{formatCurrency(bill.grandTotal)}</TableCell>
                              <TableCell className="text-right font-mono">{formatCurrency(bill.paidAmount)}</TableCell>
                              <TableCell className="text-right font-mono font-semibold text-red-600 dark:text-red-400">{formatCurrency(bill.balanceAmount)}</TableCell>
                              <TableCell className="hidden md:table-cell">
                                <Badge variant="outline" className="text-xs">{bill.paymentMethod}</Badge>
                              </TableCell>
                              <TableCell className="hidden lg:table-cell">
                                <Badge variant="secondary" className="text-xs">{bill.orderType}</Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </>
              ) : null}
            </TabsContent>

            {/* ═══════════════════ REFUNDS TAB ═══════════════════ */}
            <TabsContent value="refunds">
              {refundsLoading ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    {Array.from({ length: 2 }).map((_, i) => (
                      <Skeleton key={i} className="h-24 rounded-xl" />
                    ))}
                  </div>
                  <Skeleton className="h-48 rounded-xl" />
                </div>
              ) : refundsData ? (
                <>
                  {/* Summary Cards */}
                  <div className="mb-4 grid gap-3 grid-cols-2 lg:grid-cols-2">
                    <Card className="py-4 card-hover-glow border-l-4 border-l-red-500">
                      <CardContent className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                          <ArrowDownRight className="h-5 w-5 text-red-600" />
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Refunds</p>
                          <p className="text-lg font-bold tabular-nums">{refundsData.totalRefunds}</p>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="py-4 card-hover-glow border-l-4 border-l-orange-500">
                      <CardContent className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/30">
                          <IndianRupee className="h-5 w-5 text-orange-600" />
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Refund Amount</p>
                          <p className="text-lg font-bold tabular-nums text-red-600 dark:text-red-400">{formatCurrency(refundsData.totalRefundAmount)}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {refundsData.refunds.length > 0 && (
                    <div className="flex items-center justify-end mb-2">
                      <Button
                        size="sm"
                        onClick={handleExportRefunds}
                        disabled={!canExport}
                        className="bg-green-600 hover:bg-green-700 text-white gap-1.5 hover-glow-green"
                      >
                        <Download className="h-4 w-4" />
                        Export CSV
                      </Button>
                    </div>
                  )}

                  {refundsData.refunds.length === 0 ? (
                    <div className="border-2 border-dashed border-muted-foreground/15 bg-gradient-to-b from-muted/20 to-transparent rounded-2xl p-6">
                      <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                        <ArrowDownRight className="h-12 w-12 mb-3 opacity-40 animate-float" />
                        <p className="text-sm">No refunds found for the selected period.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead>Refund No</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead className="hidden sm:table-cell">Original Invoice</TableHead>
                            <TableHead className="hidden md:table-cell">Customer</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                            <TableHead className="hidden lg:table-cell">Reason</TableHead>
                            <TableHead className="text-center">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {refundsData.refunds.map((r) => (
                            <TableRow key={r.id} className="hover:bg-muted/30 transition-all duration-200">
                              <TableCell className="font-mono font-medium text-xs">{r.refundNumber}</TableCell>
                              <TableCell className="text-sm">{r.date}</TableCell>
                              <TableCell className="hidden sm:table-cell font-mono text-xs">{r.originalInvoiceNumber}</TableCell>
                              <TableCell className="hidden md:table-cell">{r.customerName}</TableCell>
                              <TableCell className="text-right font-mono text-red-600 dark:text-red-400">{formatCurrency(r.refundAmount)}</TableCell>
                              <TableCell className="hidden lg:table-cell max-w-[200px] truncate">{r.reason}</TableCell>
                              <TableCell className="text-center">
                                <Badge variant={getStatusBadgeVariant(r.status)} className="text-xs">{r.status}</Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </>
              ) : null}
            </TabsContent>

            {/* ═══════════════════ RETURNS TAB ═══════════════════ */}
            <TabsContent value="returns">
              {returnsLoading ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    {Array.from({ length: 2 }).map((_, i) => (
                      <Skeleton key={i} className="h-24 rounded-xl" />
                    ))}
                  </div>
                  <Skeleton className="h-48 rounded-xl" />
                </div>
              ) : returnsData ? (
                <>
                  {/* Summary Cards */}
                  <div className="mb-4 grid gap-3 grid-cols-2 lg:grid-cols-2">
                    <Card className="py-4 card-hover-glow border-l-4 border-l-orange-500">
                      <CardContent className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/30">
                          <RotateCcw className="h-5 w-5 text-orange-600" />
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Returns</p>
                          <p className="text-lg font-bold tabular-nums">{returnsData.totalReturns}</p>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="py-4 card-hover-glow border-l-4 border-l-red-500">
                      <CardContent className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                          <IndianRupee className="h-5 w-5 text-red-600" />
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Returned Amount</p>
                          <p className="text-lg font-bold tabular-nums text-red-600 dark:text-red-400">{formatCurrency(returnsData.totalReturnedAmount)}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {returnsData.returns.length > 0 && (
                    <div className="flex items-center justify-end mb-2">
                      <Button
                        size="sm"
                        onClick={handleExportReturns}
                        disabled={!canExport}
                        className="bg-green-600 hover:bg-green-700 text-white gap-1.5 hover-glow-green"
                      >
                        <Download className="h-4 w-4" />
                        Export CSV
                      </Button>
                    </div>
                  )}

                  {returnsData.returns.length === 0 ? (
                    <div className="border-2 border-dashed border-muted-foreground/15 bg-gradient-to-b from-muted/20 to-transparent rounded-2xl p-6">
                      <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                        <RotateCcw className="h-12 w-12 mb-3 opacity-40 animate-float" />
                        <p className="text-sm">No returns found for the selected period.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead>Invoice No</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead className="hidden sm:table-cell">Customer</TableHead>
                            <TableHead className="text-right">Grand Total</TableHead>
                            <TableHead className="text-center">Status</TableHead>
                            <TableHead className="hidden md:table-cell">Payment</TableHead>
                            <TableHead className="text-center hidden lg:table-cell">Refunds</TableHead>
                            <TableHead className="text-right hidden lg:table-cell">Total Refunded</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {returnsData.returns.map((r) => (
                            <TableRow key={r.id} className="hover:bg-muted/30 transition-all duration-200">
                              <TableCell className="font-mono font-medium text-xs">{r.invoiceNumber}</TableCell>
                              <TableCell className="text-sm">{r.date}</TableCell>
                              <TableCell className="hidden sm:table-cell">{r.customerName}</TableCell>
                              <TableCell className="text-right font-mono">{formatCurrency(r.grandTotal)}</TableCell>
                              <TableCell className="text-center">
                                <Badge variant={getStatusBadgeVariant(r.status)} className="text-xs">{r.status}</Badge>
                              </TableCell>
                              <TableCell className="hidden md:table-cell">
                                <Badge variant="outline" className="text-xs">{r.paymentMethod}</Badge>
                              </TableCell>
                              <TableCell className="text-center hidden lg:table-cell tabular-nums">{r.refundCount}</TableCell>
                              <TableCell className="text-right hidden lg:table-cell font-mono text-red-600 dark:text-red-400">{formatCurrency(r.totalRefunded)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </>
              ) : null}
            </TabsContent>

            {/* ═══════════════════ REPLACE TAB ═══════════════════ */}
            <TabsContent value="replace">
              {replaceLoading ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    {Array.from({ length: 2 }).map((_, i) => (
                      <Skeleton key={i} className="h-24 rounded-xl" />
                    ))}
                  </div>
                  <Skeleton className="h-48 rounded-xl" />
                </div>
              ) : replaceData ? (
                <>
                  {/* Summary Cards */}
                  <div className="mb-4 grid gap-3 grid-cols-2 lg:grid-cols-2">
                    <Card className="py-4 card-hover-glow border-l-4 border-l-violet-500">
                      <CardContent className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-900/30">
                          <ArrowRightLeft className="h-5 w-5 text-violet-600" />
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Replaced</p>
                          <p className="text-lg font-bold tabular-nums">{replaceData.totalReplaced}</p>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="py-4 card-hover-glow border-l-4 border-l-purple-500">
                      <CardContent className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30">
                          <IndianRupee className="h-5 w-5 text-purple-600" />
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Replaced Amount</p>
                          <p className="text-lg font-bold tabular-nums">{formatCurrency(replaceData.totalReplacedAmount)}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {replaceData.replacements.length > 0 && (
                    <div className="flex items-center justify-end mb-2">
                      <Button
                        size="sm"
                        onClick={handleExportReplace}
                        disabled={!canExport}
                        className="bg-green-600 hover:bg-green-700 text-white gap-1.5 hover-glow-green"
                      >
                        <Download className="h-4 w-4" />
                        Export CSV
                      </Button>
                    </div>
                  )}

                  {replaceData.replacements.length === 0 ? (
                    <div className="border-2 border-dashed border-muted-foreground/15 bg-gradient-to-b from-muted/20 to-transparent rounded-2xl p-6">
                      <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                        <ArrowRightLeft className="h-12 w-12 mb-3 opacity-40 animate-float" />
                        <p className="text-sm">No replacements found for the selected period.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead>Invoice No</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead className="hidden sm:table-cell">Customer</TableHead>
                            <TableHead className="text-right">Grand Total</TableHead>
                            <TableHead className="text-right">Paid</TableHead>
                            <TableHead className="hidden md:table-cell">Payment</TableHead>
                            <TableHead className="hidden lg:table-cell">Order Type</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {replaceData.replacements.map((r) => (
                            <TableRow key={r.id} className="hover:bg-muted/30 transition-all duration-200">
                              <TableCell className="font-mono font-medium text-xs">{r.invoiceNumber}</TableCell>
                              <TableCell className="text-sm">{r.date}</TableCell>
                              <TableCell className="hidden sm:table-cell">{r.customerName}</TableCell>
                              <TableCell className="text-right font-mono">{formatCurrency(r.grandTotal)}</TableCell>
                              <TableCell className="text-right font-mono">{formatCurrency(r.paidAmount)}</TableCell>
                              <TableCell className="hidden md:table-cell">
                                <Badge variant="outline" className="text-xs">{r.paymentMethod}</Badge>
                              </TableCell>
                              <TableCell className="hidden lg:table-cell">
                                <Badge variant="secondary" className="text-xs">{r.orderType}</Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </>
              ) : null}
            </TabsContent>

            {/* ═══════════════════ ITEM SALES TAB ═══════════════════ */}
            <TabsContent value="items">
              {itemsLoading ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-24 rounded-xl" />
                    ))}
                  </div>
                  <Skeleton className="h-64 rounded-xl" />
                  <Skeleton className="h-48 rounded-xl" />
                </div>
              ) : itemsData ? (
                <>
                  {/* Summary Cards */}
                  <div className="mb-4 grid gap-3 grid-cols-2 lg:grid-cols-3">
                    <Card className="py-4 card-hover-glow border-l-4 border-l-green-500">
                      <CardContent className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                          <ShoppingCart className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Unique Items Sold</p>
                          <p className="text-lg font-bold tabular-nums">{itemsData.totalItems}</p>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="py-4 card-hover-glow border-l-4 border-l-emerald-500">
                      <CardContent className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                          <IndianRupee className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Item Revenue</p>
                          <p className="text-lg font-bold tabular-nums">{formatCurrency(itemsData.totalItemRevenue)}</p>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="py-4 card-hover-glow border-l-4 border-l-teal-500">
                      <CardContent className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-100 dark:bg-teal-900/30">
                          <Package className="h-5 w-5 text-teal-600" />
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Qty Sold</p>
                          <p className="text-lg font-bold tabular-nums">{itemsData.totalItemQty}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Top Items Bar Chart */}
                  {topItemsChartData.length > 0 && (
                    <Card className="mb-4">
                      <CardHeader className="pb-2 pt-4 px-5">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                            <BarChart3 className="h-4 w-4 text-green-600" />
                            Top Items by Revenue
                          </CardTitle>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleExportItems}
                            disabled={!canExport}
                            className="gap-1.5 text-xs"
                          >
                            <Download className="h-3.5 w-3.5" />
                            CSV
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="px-5 pb-4">
                        <div className="h-72">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={topItemsChartData} layout="vertical" margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                              <XAxis
                                type="number"
                                tick={{ fontSize: 11, fill: '#6b7280' }}
                                axisLine={false}
                                tickLine={false}
                                tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}k`}
                              />
                              <YAxis
                                type="category"
                                dataKey="name"
                                tick={{ fontSize: 11, fill: '#6b7280' }}
                                axisLine={false}
                                tickLine={false}
                                width={100}
                              />
                              <Tooltip
                                contentStyle={tooltipStyle}
                                formatter={((value: any, name: any) => [
                                  name === 'revenue' ? formatCurrency(value) : value,
                                  name === 'revenue' ? 'Revenue' : 'Qty'
                                ]) as any}
                                cursor={{ fill: 'rgba(16,185,129,0.08)' }}
                              />
                              <Bar
                                dataKey="revenue"
                                fill="#10b981"
                                radius={[0, 4, 4, 0]}
                                animationDuration={800}
                                animationEasing="ease-out"
                              />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Items Table */}
                  {itemsData.items.length === 0 ? (
                    <div className="border-2 border-dashed border-muted-foreground/15 bg-gradient-to-b from-muted/20 to-transparent rounded-2xl p-6">
                      <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                        <ShoppingCart className="h-12 w-12 mb-3 opacity-40 animate-float" />
                        <p className="text-sm">No item sales data found for the selected period.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border overflow-hidden max-h-96 overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50 sticky top-0">
                            <TableHead>#</TableHead>
                            <TableHead>Item Name</TableHead>
                            <TableHead className="text-center">Qty Sold</TableHead>
                            <TableHead className="text-center">Times Sold</TableHead>
                            <TableHead className="text-right">Revenue</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {itemsData.items.map((item, idx) => (
                            <TableRow key={idx} className="hover:bg-muted/30 transition-all duration-200">
                              <TableCell className="text-muted-foreground tabular-nums">{idx + 1}</TableCell>
                              <TableCell className="font-medium text-sm">{item.name}</TableCell>
                              <TableCell className="text-center tabular-nums">{item.totalQty}</TableCell>
                              <TableCell className="text-center tabular-nums">{item.count}</TableCell>
                              <TableCell className="text-right font-mono">{formatCurrency(item.totalRevenue)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </>
              ) : null}
            </TabsContent>

            {/* ═══════════════════ INVENTORY TAB ═══════════════════ */}
            <TabsContent value="inventory">
              {inventoryLoading ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-24 rounded-xl" />
                    ))}
                  </div>
                  <Skeleton className="h-64 rounded-xl" />
                  <Skeleton className="h-48 rounded-xl" />
                </div>
              ) : inventoryData ? (
                <>
                  {/* Summary Cards */}
                  <div className="mb-4 grid gap-3 grid-cols-2 lg:grid-cols-5">
                    <Card className="py-4 card-hover-glow border-l-4 border-l-green-500">
                      <CardContent className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                          <Package className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Items</p>
                          <p className="text-lg font-bold tabular-nums">{inventoryData.totalItems}</p>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="py-4 card-hover-glow border-l-4 border-l-emerald-500">
                      <CardContent className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                          <IndianRupee className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Value</p>
                          <p className="text-lg font-bold tabular-nums">{formatCurrency(inventoryData.totalValue)}</p>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="py-4 card-hover-glow border-l-4 border-l-amber-500">
                      <CardContent className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
                          <AlertTriangle className="h-5 w-5 text-amber-600" />
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Low Stock</p>
                          <p className="text-lg font-bold tabular-nums text-amber-600 dark:text-amber-400">{inventoryData.lowStockCount}</p>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="py-4 card-hover-glow border-l-4 border-l-red-500">
                      <CardContent className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                          <PackageX className="h-5 w-5 text-red-600" />
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Out of Stock</p>
                          <p className="text-lg font-bold tabular-nums text-red-600 dark:text-red-400">{inventoryData.outOfStockCount}</p>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="py-4 card-hover-glow border-l-4 border-l-teal-500">
                      <CardContent className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-100 dark:bg-teal-900/30">
                          <UserCheck className="h-5 w-5 text-teal-600" />
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Well Stocked</p>
                          <p className="text-lg font-bold tabular-nums text-green-600 dark:text-green-400">{inventoryData.wellStockedCount}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Category Breakdown Pie Chart */}
                  {inventoryCategoryPie.length > 0 && (
                    <Card className="mb-4">
                      <CardHeader className="pb-2 pt-4 px-5">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                            <PieChartIcon className="h-4 w-4 text-green-600" />
                            Category Breakdown (by Value)
                          </CardTitle>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleExportInventory}
                            disabled={!canExport}
                            className="gap-1.5 text-xs"
                          >
                            <Download className="h-3.5 w-3.5" />
                            CSV
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="px-5 pb-4">
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={inventoryCategoryPie}
                                cx="50%"
                                cy="50%"
                                innerRadius={50}
                                outerRadius={90}
                                paddingAngle={3}
                                dataKey="value"
                                animationDuration={800}
                                label={((props: any) => `${props.name} (${(props.percent * 100).toFixed(0)}%)`) as any}
                              >
                                {inventoryCategoryPie.map((_, index) => (
                                  <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip
                                contentStyle={tooltipStyle}
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                formatter={((v: any, n: any) => [formatCurrency(v), n]) as any}
                              />
                              <Legend />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>

                        {/* Category Table */}
                        <div className="mt-4 rounded-lg border overflow-hidden">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-muted/50">
                                <TableHead>Category</TableHead>
                                <TableHead className="text-center">Items</TableHead>
                                <TableHead className="text-center">Total Qty</TableHead>
                                <TableHead className="text-right">Value</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {inventoryData.categoryBreakdown.map((cat, idx) => (
                                <TableRow key={idx} className="hover:bg-muted/30 transition-all duration-200">
                                  <TableCell>
                                    <div className="flex items-center gap-2">
                                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }} />
                                      <span className="font-medium text-sm">{cat.category}</span>
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-center tabular-nums">{cat.count}</TableCell>
                                  <TableCell className="text-center tabular-nums">{cat.qty}</TableCell>
                                  <TableCell className="text-right font-mono">{formatCurrency(cat.value)}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Low Stock Items */}
                  {inventoryData.lowStockItems.length > 0 && (
                    <Card>
                      <CardHeader className="pb-2 pt-4 px-5">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                          <AlertTriangle className="h-4 w-4 text-amber-600" />
                          Low Stock Items
                          <Badge variant="secondary" className="text-xs ml-1">{inventoryData.lowStockItems.length}</Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="px-5 pb-4">
                        <div className="rounded-lg border overflow-hidden max-h-64 overflow-y-auto">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-muted/50 sticky top-0">
                                <TableHead>Item</TableHead>
                                <TableHead className="hidden sm:table-cell">Category</TableHead>
                                <TableHead className="text-right">Price</TableHead>
                                <TableHead className="text-center">Qty</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {inventoryData.lowStockItems.map((item) => (
                                <TableRow key={item.id} className="hover:bg-muted/30 transition-all duration-200">
                                  <TableCell className="font-medium text-sm">{item.name}</TableCell>
                                  <TableCell className="hidden sm:table-cell">
                                    <Badge variant="outline" className="text-xs">{item.category}</Badge>
                                  </TableCell>
                                  <TableCell className="text-right font-mono">{formatCurrency(item.price)}</TableCell>
                                  <TableCell className="text-center">
                                    <Badge
                                      variant={item.quantity <= 0 ? 'destructive' : 'secondary'}
                                      className="text-xs tabular-nums"
                                    >
                                      {item.quantity}
                                    </Badge>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {inventoryData.totalItems === 0 && (
                    <div className="border-2 border-dashed border-muted-foreground/15 bg-gradient-to-b from-muted/20 to-transparent rounded-2xl p-6">
                      <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                        <Package className="h-12 w-12 mb-3 opacity-40 animate-float" />
                        <p className="text-sm">No inventory data found.</p>
                      </div>
                    </div>
                  )}
                </>
              ) : null}
            </TabsContent>

            {/* ═══════════════════ CASH FLOW TAB ═══════════════════ */}
            <TabsContent value="cashflow">
              {cashFlowLoading ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <Skeleton key={i} className="h-24 rounded-xl" />
                    ))}
                  </div>
                  <Skeleton className="h-64 rounded-xl" />
                  <Skeleton className="h-48 rounded-xl" />
                </div>
              ) : cashFlowData ? (
                <>
                  {/* Summary Cards */}
                  <div className="mb-4 grid gap-3 grid-cols-2 lg:grid-cols-4">
                    <Card className="py-4 card-hover-glow border-l-4 border-l-green-500">
                      <CardContent className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                          <FileText className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Invoice Income</p>
                          <p className="text-lg font-bold tabular-nums">{formatCurrency(cashFlowData.totalInvoiceIncome)}</p>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="py-4 card-hover-glow border-l-4 border-l-emerald-500">
                      <CardContent className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                          <ArrowUpRight className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Petty Income</p>
                          <p className="text-lg font-bold tabular-nums">{formatCurrency(cashFlowData.totalPettyIncome)}</p>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="py-4 card-hover-glow border-l-4 border-l-red-500">
                      <CardContent className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                          <ArrowDownRight className="h-5 w-5 text-red-600" />
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Petty Expense</p>
                          <p className="text-lg font-bold tabular-nums text-red-600 dark:text-red-400">{formatCurrency(cashFlowData.totalPettyExpense)}</p>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className={`py-4 card-hover-glow border-l-4 ${cashFlowData.netCashFlow >= 0 ? 'border-l-teal-500' : 'border-l-red-500'}`}>
                      <CardContent className="flex items-center gap-3">
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${cashFlowData.netCashFlow >= 0 ? 'bg-teal-100 dark:bg-teal-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                          {cashFlowData.netCashFlow >= 0 ? (
                            <TrendingUp className="h-5 w-5 text-teal-600" />
                          ) : (
                            <TrendingDown className="h-5 w-5 text-red-600" />
                          )}
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Net Cash Flow</p>
                          <p className={`text-lg font-bold tabular-nums ${cashFlowData.netCashFlow >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            {formatCurrency(cashFlowData.netCashFlow)}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Income vs Expense Bar Chart */}
                  {cashFlowChartData.length > 0 && (
                    <Card className="mb-4">
                      <CardHeader className="pb-2 pt-4 px-5">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                            <BarChart3 className="h-4 w-4 text-green-600" />
                            Daily Income vs Expense
                          </CardTitle>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleExportCashFlow}
                            disabled={!canExport}
                            className="gap-1.5 text-xs"
                          >
                            <Download className="h-3.5 w-3.5" />
                            CSV
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="px-5 pb-4">
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={cashFlowChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                              <XAxis
                                dataKey="date"
                                tick={{ fontSize: 11, fill: '#6b7280' }}
                                axisLine={{ stroke: '#e5e7eb' }}
                                tickLine={false}
                              />
                              <YAxis
                                tick={{ fontSize: 11, fill: '#6b7280' }}
                                axisLine={false}
                                tickLine={false}
                                tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}k`}
                              />
                              <Tooltip
                                contentStyle={tooltipStyle}
                                formatter={((value: any, name: any) => [
                                  formatCurrency(value),
                                  name.charAt(0).toUpperCase() + name.slice(1)
                                ]) as any}
                                cursor={{ fill: 'rgba(16,185,129,0.08)' }}
                              />
                              <Legend />
                              <Bar dataKey="income" fill="#10b981" radius={[4, 4, 0, 0]} animationDuration={800} />
                              <Bar dataKey="expense" fill="#ef4444" radius={[4, 4, 0, 0]} animationDuration={800} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Transactions Table */}
                  {cashFlowData.transactions.length === 0 ? (
                    <div className="border-2 border-dashed border-muted-foreground/15 bg-gradient-to-b from-muted/20 to-transparent rounded-2xl p-6">
                      <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                        <Wallet className="h-12 w-12 mb-3 opacity-40 animate-float" />
                        <p className="text-sm">No cash flow transactions found for the selected period.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border overflow-hidden max-h-96 overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50 sticky top-0">
                            <TableHead>Date</TableHead>
                            <TableHead className="text-center">Type</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {cashFlowData.transactions.map((tx) => (
                            <TableRow key={tx.id} className="hover:bg-muted/30 transition-all duration-200">
                              <TableCell className="text-sm">{tx.date}</TableCell>
                              <TableCell className="text-center">
                                <Badge
                                  variant={tx.type.toLowerCase() === 'income' ? 'default' : 'destructive'}
                                  className="text-xs"
                                >
                                  {tx.type}
                                </Badge>
                              </TableCell>
                              <TableCell className="max-w-[200px] truncate">{tx.description}</TableCell>
                              <TableCell className={`text-right font-mono ${tx.type.toLowerCase() === 'income' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                {tx.type.toLowerCase() === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </>
              ) : null}
            </TabsContent>

            {/* ═══════════════════ STATUS SUMMARY TAB ═══════════════════ */}
            <TabsContent value="status">
              {statusLoading ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    {Array.from({ length: 2 }).map((_, i) => (
                      <Skeleton key={i} className="h-24 rounded-xl" />
                    ))}
                  </div>
                  <Skeleton className="h-64 rounded-xl" />
                  <Skeleton className="h-48 rounded-xl" />
                </div>
              ) : statusData ? (
                <>
                  {/* Summary Cards */}
                  <div className="mb-4 grid gap-3 grid-cols-2 lg:grid-cols-2">
                    <Card className="py-4 card-hover-glow border-l-4 border-l-green-500">
                      <CardContent className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                          <FileText className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Invoices</p>
                          <p className="text-lg font-bold tabular-nums">{statusData.totalInvoices}</p>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="py-4 card-hover-glow border-l-4 border-l-emerald-500">
                      <CardContent className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                          <IndianRupee className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Amount</p>
                          <p className="text-lg font-bold tabular-nums">{formatCurrency(statusData.totalAmount)}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Status Pie Chart */}
                  {statusPieData.length > 0 && (
                    <Card className="mb-4">
                      <CardHeader className="pb-2 pt-4 px-5">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                            <PieChartIcon className="h-4 w-4 text-green-600" />
                            Invoice Status Breakdown
                          </CardTitle>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleExportStatus}
                            disabled={!canExport}
                            className="gap-1.5 text-xs"
                          >
                            <Download className="h-3.5 w-3.5" />
                            CSV
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="px-5 pb-4">
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={statusPieData}
                                cx="50%"
                                cy="50%"
                                innerRadius={50}
                                outerRadius={90}
                                paddingAngle={3}
                                dataKey="value"
                                animationDuration={800}
                                label={((props: any) => `${props.name} (${(props.percent * 100).toFixed(0)}%)`) as any}
                              >
                                {statusPieData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={getStatusColor(entry.name)} />
                                ))}
                              </Pie>
                              <Tooltip
                                contentStyle={tooltipStyle}
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                formatter={((v: any, n: any) => [formatCurrency(v), n]) as any}
                              />
                              <Legend />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Status Table */}
                  {statusData.statusSummary.length === 0 ? (
                    <div className="border-2 border-dashed border-muted-foreground/15 bg-gradient-to-b from-muted/20 to-transparent rounded-2xl p-6">
                      <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                        <PieChartIcon className="h-12 w-12 mb-3 opacity-40 animate-float" />
                        <p className="text-sm">No invoice status data found for the selected period.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead>Status</TableHead>
                            <TableHead className="text-center">Count</TableHead>
                            <TableHead className="text-right">Total Amount</TableHead>
                            <TableHead className="text-right hidden sm:table-cell">Total Paid</TableHead>
                            <TableHead className="text-right hidden md:table-cell">Total Balance</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {statusData.statusSummary.map((s, idx) => (
                            <TableRow key={idx} className="hover:bg-muted/30 transition-all duration-200">
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: getStatusColor(s.status) }} />
                                  <Badge variant={getStatusBadgeVariant(s.status)} className="text-xs">{s.status}</Badge>
                                </div>
                              </TableCell>
                              <TableCell className="text-center tabular-nums font-semibold">{s.count}</TableCell>
                              <TableCell className="text-right font-mono">{formatCurrency(s.totalAmount)}</TableCell>
                              <TableCell className="text-right hidden sm:table-cell font-mono">{formatCurrency(s.totalPaid)}</TableCell>
                              <TableCell className="text-right hidden md:table-cell font-mono text-red-600 dark:text-red-400">{formatCurrency(s.totalBalance)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </>
              ) : null}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
