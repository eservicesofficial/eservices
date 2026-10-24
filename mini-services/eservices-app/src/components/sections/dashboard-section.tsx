'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  FileText,
  History,
  Wallet,
  BookOpen,
  Users,
  Calculator,
  Package,
  BarChart3,
  Settings,
  DatabaseBackup,
  TrendingUp,
  TrendingDown,
  IndianRupee,
  Clock,
  AlertCircle,
  ChevronRight,
  Loader2,
  FileBarChart,
  ArrowUpRight,
  ArrowDownRight,
  ArrowRight,
  Plus,
  Banknote,
  UserPlus,
  CalendarDays,
  Sparkles,
  Receipt,
  CircleDollarSign,
  Timer,
  StickyNote,
  Trash2,
  Activity,
  WalletIcon,
  CreditCard,
  Trophy,
  Zap,
  AlertTriangle,
  PackageCheck,
  Target,
  Pencil,
  Check,
  ArrowDownLeft,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/components/auth-provider';
import { useFeature } from '@/hooks/use-feature';
import { getCategoryLabel, getCategoryIcon, getCategoryColor } from '@/lib/category-templates';
import {
  Cake,
  UtensilsCrossed,
  Scissors,
  ShoppingCart,
  Pill,
  Cpu,
  Settings2,
  Building2,
  Tag,
} from 'lucide-react';

/* ───────────────────────────── Types ───────────────────────────── */

interface DashboardSectionProps {
  onNavigate: (page: string) => void;
  dataVersion?: number;
}

interface NavCard {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  gradientBorder: string;
  iconBg: string;
  iconColor: string;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  date: string;
  customerName: string;
  customerPhone: string;
  paymentMethod: string;
  status: string;
  grandTotal: number;
  isCompleted: boolean;
  createdAt: string;
}

interface TodaySummary {
  date: string;
  revenue: number;
  invoiceCount: number;
  completedCount: number;
  pendingCount: number;
}

interface TrendDay {
  date: string;
  label: string;
  revenue: number;
  count: number;
}

interface OverallStats {
  totalInvoices: number;
  totalRevenue: number;
  pendingBills: number;
}

interface DashboardData {
  today: TodaySummary;
  trend: TrendDay[];
  overall: OverallStats;
  recentInvoices: Invoice[];
}

interface PettyCashData {
  config: { id: string; amount: number };
  transactions: { date?: string; createdAt?: string; type?: string; description?: string; amount?: number }[];
}

interface KhataProfile {
  id: string;
  name: string;
  type: string;
  balance: number;
}

interface ActivityItem {
  id: string;
  type: 'invoice' | 'cash' | 'khata';
  title: string;
  description: string;
  amount?: number;
  timestamp: string;
  iconBg: string;
  iconColor: string;
  icon: React.ReactNode;
}

interface TopItem {
  id: string;
  name: string;
  price: number;
  category: string;
}

interface LowStockItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
}

/* ───────────────────────────── Helpers ───────────────────────────── */

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function formatTodayBannerDate(): string {
  const now = new Date();
  return now.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

function getTrendPercentage(trendData: TrendDay[], field: 'revenue' | 'count'): { value: number; isPositive: boolean } {
  if (trendData.length < 2) return { value: 0, isPositive: true };
  const latest = trendData[trendData.length - 1][field];
  const previous = trendData[trendData.length - 2][field];
  if (previous === 0) return { value: latest > 0 ? 100 : 0, isPositive: latest >= 0 };
  const pct = Math.round(((latest - previous) / previous) * 100);
  return { value: Math.abs(pct), isPositive: pct >= 0 };
}

/* ───────────────────────────── Category Helpers ───────────────────────────── */

const CATEGORY_ICON_MAP: Record<string, React.ElementType> = {
  Cake, UtensilsCrossed, Scissors, ShoppingCart, Pill, Cpu, Settings2, Building2,
};

const CATEGORY_COLOR_MAP: Record<string, { badge: string; chip: string; iconBg: string; iconColor: string }> = {
  amber:    { badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400', chip: 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400', iconBg: 'bg-amber-100 dark:bg-amber-900/40', iconColor: 'text-amber-600 dark:text-amber-400' },
  red:      { badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400', chip: 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400', iconBg: 'bg-red-100 dark:bg-red-900/40', iconColor: 'text-red-600 dark:text-red-400' },
  purple:   { badge: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400', chip: 'bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400', iconBg: 'bg-purple-100 dark:bg-purple-900/40', iconColor: 'text-purple-600 dark:text-purple-400' },
  blue:     { badge: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-400', chip: 'bg-sky-50 text-sky-600 dark:bg-sky-900/20 dark:text-sky-400', iconBg: 'bg-sky-100 dark:bg-sky-900/40', iconColor: 'text-sky-600 dark:text-sky-400' },
  emerald:  { badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400', chip: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400', iconBg: 'bg-emerald-100 dark:bg-emerald-900/40', iconColor: 'text-emerald-600 dark:text-emerald-400' },
  sky:      { badge: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-400', chip: 'bg-sky-50 text-sky-600 dark:bg-sky-900/20 dark:text-sky-400', iconBg: 'bg-sky-100 dark:bg-sky-900/40', iconColor: 'text-sky-600 dark:text-sky-400' },
  gray:     { badge: 'bg-gray-100 text-gray-700 dark:bg-gray-800/40 dark:text-gray-400', chip: 'bg-gray-50 text-gray-600 dark:bg-gray-800/20 dark:text-gray-400', iconBg: 'bg-gray-100 dark:bg-gray-800/40', iconColor: 'text-gray-600 dark:text-gray-400' },
};

function getCategoryIconComponent(iconName: string): React.ElementType {
  return CATEGORY_ICON_MAP[iconName] ?? Building2;
}

function getCategoryColorClasses(color: string) {
  return CATEGORY_COLOR_MAP[color] ?? CATEGORY_COLOR_MAP.gray;
}

/* ───────────────────────────── Constants ───────────────────────────── */

const navCards: NavCard[] = [
  {
    id: 'new-bill',
    title: 'Bill Generator',
    description: 'Create new invoices & bills',
    icon: <FileText className="size-5" />,
    gradientBorder: 'before:bg-gradient-to-br before:from-green-400 before:to-emerald-600',
    iconBg: 'bg-green-100 dark:bg-green-900/40',
    iconColor: 'text-green-600 dark:text-green-400',
  },
  {
    id: 'bill-history',
    title: 'Bill History',
    description: 'View & manage past invoices',
    icon: <History className="size-5" />,
    gradientBorder: 'before:bg-gradient-to-br before:from-emerald-400 before:to-teal-600',
    iconBg: 'bg-emerald-100 dark:bg-emerald-900/40',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
  },
  {
    id: 'cash-manager',
    title: 'Cash Manager',
    description: 'Track petty cash transactions',
    icon: <Wallet className="size-5" />,
    gradientBorder: 'before:bg-gradient-to-br before:from-lime-400 before:to-green-600',
    iconBg: 'bg-lime-100 dark:bg-lime-900/40',
    iconColor: 'text-lime-600 dark:text-lime-400',
  },
  {
    id: 'khata',
    title: 'Customer Folio',
    description: 'Manage credit/debit accounts',
    icon: <BookOpen className="size-5" />,
    gradientBorder: 'before:bg-gradient-to-br before:from-teal-400 before:to-cyan-600',
    iconBg: 'bg-teal-100 dark:bg-teal-900/40',
    iconColor: 'text-teal-600 dark:text-teal-400',
  },
  {
    id: 'attendance',
    title: 'Staff & Attendance',
    description: 'Employee management & tracking',
    icon: <Users className="size-5" />,
    gradientBorder: 'before:bg-gradient-to-br before:from-cyan-400 before:to-emerald-600',
    iconBg: 'bg-cyan-100 dark:bg-cyan-900/40',
    iconColor: 'text-cyan-600 dark:text-cyan-400',
  },
  {
    id: 'calculator',
    title: 'Calculator',
    description: 'Quick calculations & history',
    icon: <Calculator className="size-5" />,
    gradientBorder: 'before:bg-gradient-to-br before:from-green-500 before:to-lime-500',
    iconBg: 'bg-green-50 dark:bg-green-900/30',
    iconColor: 'text-green-700 dark:text-green-400',
  },
  {
    id: 'item-management',
    title: 'Item Management',
    description: 'Manage products & categories',
    icon: <Package className="size-5" />,
    gradientBorder: 'before:bg-gradient-to-br before:from-emerald-500 before:to-green-600',
    iconBg: 'bg-emerald-50 dark:bg-emerald-900/30',
    iconColor: 'text-emerald-700 dark:text-emerald-400',
  },
  {
    id: 'reports',
    title: 'Reports',
    description: 'Analytics & business insights',
    icon: <BarChart3 className="size-5" />,
    gradientBorder: 'before:bg-gradient-to-br before:from-lime-500 before:to-teal-500',
    iconBg: 'bg-lime-50 dark:bg-lime-900/30',
    iconColor: 'text-lime-700 dark:text-lime-400',
  },
  {
    id: 'settings',
    title: 'Settings',
    description: 'App configuration & preferences',
    icon: <Settings className="size-5" />,
    gradientBorder: 'before:bg-gradient-to-br before:from-teal-500 before:to-cyan-500',
    iconBg: 'bg-teal-50 dark:bg-teal-900/30',
    iconColor: 'text-teal-700 dark:text-teal-400',
  },
  {
    id: 'data-backup',
    title: 'Data Backup',
    description: 'Export & import your data',
    icon: <DatabaseBackup className="size-5" />,
    gradientBorder: 'before:bg-gradient-to-br before:from-cyan-500 before:to-emerald-500',
    iconBg: 'bg-cyan-50 dark:bg-cyan-900/30',
    iconColor: 'text-cyan-700 dark:text-cyan-400',
  },
];

/* ───────────────────────────── Sub-components ───────────────────────────── */

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
    Completed: { variant: 'default', label: 'Completed' },
    Pending: { variant: 'secondary', label: 'Pending' },
    Cancelled: { variant: 'destructive', label: 'Cancelled' },
  };
  const c = config[status] ?? { variant: 'outline' as const, label: status };
  return <Badge variant={c.variant}>{c.label}</Badge>;
}

function PaymentMethodBadge({ method }: { method: string }) {
  const map: Record<string, { icon: React.ReactNode; className: string }> = {
    Cash: { icon: <Banknote className="size-3" />, className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' },
    UPI: { icon: <CircleDollarSign className="size-3" />, className: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-400' },
    Card: { icon: <Receipt className="size-3" />, className: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-400' },
    Credit: { icon: <Timer className="size-3" />, className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' },
  };
  const m = map[method] ?? { icon: <IndianRupee className="size-3" />, className: 'bg-muted text-muted-foreground' };

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${m.className}`}>
      {m.icon}
      {method}
    </span>
  );
}

function EmptyStateIllustration({ icon: Icon, title, subtitle, actionLabel, onAction }: {
  icon: React.ElementType;
  title: string;
  subtitle: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center animate-fade-in">
      <div className="mb-4 flex size-20 items-center justify-center rounded-2xl bg-gradient-to-br from-green-50 to-emerald-100 dark:from-green-900/20 dark:to-emerald-900/30">
        <Icon className="size-10 text-green-400 dark:text-green-500" />
      </div>
      <p className="text-base font-semibold text-foreground">{title}</p>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">{subtitle}</p>
      {actionLabel && onAction && (
        <Button
          onClick={onAction}
          className="mt-5 bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-md hover:from-green-700 hover:to-emerald-700 hover:shadow-lg transition-all"
        >
          <Plus className="size-4" />
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

function RevenueBarChart({ trend }: { trend: TrendDay[] }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const maxRevenue = Math.max(...trend.map((d) => d.revenue), 1);

  return (
    <div className="relative">
      {/* Background grid pattern */}
      <div className="pointer-events-none absolute inset-0 dot-pattern opacity-40" />
      <div className="flex items-end gap-2 sm:gap-3 h-40 relative">
        {trend.map((day, i) => {
          const heightPct = Math.max((day.revenue / maxRevenue) * 100, 3);
          const isToday = i === trend.length - 1;
          const isHovered = hoveredIdx === i;

          return (
            <div
              key={day.date}
              className="group/bar flex flex-1 flex-col items-center gap-1"
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              {/* Tooltip value */}
              <div className={`relative text-xs font-medium tabular-nums transition-all duration-200 ${
                isHovered ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1'
              } ${isToday ? 'text-green-700 dark:text-green-400' : 'text-muted-foreground'}`}>
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 rounded-md bg-foreground px-2 py-1 text-[10px] font-semibold text-background whitespace-nowrap shadow-lg">
                  {formatCurrency(day.revenue)}
                  <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-foreground" />
                </div>
              </div>
              {/* Bar */}
              <div className="relative w-full flex items-end" style={{ height: '120px' }}>
                <div
                  className={`w-full rounded-t-md transition-all duration-200 ${
                    isToday
                      ? 'bg-gradient-to-t from-green-600 to-emerald-400 shadow-sm shadow-green-500/30'
                      : isHovered
                        ? 'bg-gradient-to-t from-green-500 to-emerald-300 shadow-sm shadow-green-500/20'
                        : 'bg-gradient-to-t from-green-400/80 to-green-300/60 dark:from-green-600/60 dark:to-green-500/40'
                  }`}
                  style={{
                    height: `${heightPct}%`,
                    animationDelay: `${i * 80}ms`,
                  }}
                />
              </div>
              {/* Label */}
              <span className={`text-xs transition-colors ${isToday ? 'font-bold text-green-700 dark:text-green-400' : isHovered ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                {day.label}
              </span>
              {/* Count */}
              {day.count > 0 && (
                <span className={`text-[10px] transition-colors ${isHovered ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {day.count} bill{day.count > 1 ? 's' : ''}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ───────────────────────────── Main Component ───────────────────────────── */

export default function DashboardSection({ onNavigate, dataVersion }: DashboardSectionProps) {
  const { token, hasPermission } = useAuth();
  const { features, category, loading: featureLoading } = useFeature();
  const authHeaders: Record<string, string> = token ? { 'Authorization': `Bearer ${token}` } : {};
  const canAccessBilling = hasPermission('billing', 'access');
  const canCreateBill = hasPermission('billing', 'create');
  const canAccessInventory = hasPermission('inventory', 'access');
  const canCreateItem = hasPermission('inventory', 'create');
  const canAccessCashManager = hasPermission('cashManager', 'access');
  const canCreateCash = hasPermission('cashManager', 'create');
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [cashBalance, setCashBalance] = useState<number | null>(null);
  const [khataProfiles, setKhataProfiles] = useState<KhataProfile[]>([]);
  const [quickNotes, setQuickNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const notesTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const NOTES_STORAGE_KEY = 'eservices-quick-notes';

  // Load saved notes from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(NOTES_STORAGE_KEY);
      if (saved) setQuickNotes(saved);
    } catch {
      // localStorage not available
    }
    // Load saved revenue target
    try {
      const savedTarget = localStorage.getItem(REVENUE_TARGET_STORAGE_KEY);
      if (savedTarget) {
        const parsed = parseFloat(savedTarget);
        if (!isNaN(parsed) && parsed > 0) {
          setRevenueTarget(parsed);
          setTargetInputValue(String(parsed));
        }
      }
    } catch {
      // localStorage not available
    }
  }, []);

  const handleNotesChange = useCallback((value: string) => {
    setQuickNotes(value);
    if (notesTimerRef.current) clearTimeout(notesTimerRef.current);
    notesTimerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(NOTES_STORAGE_KEY, value);
      } catch {
        // localStorage not available
      }
    }, 500);
  }, []);

  const handleClearNotes = useCallback(() => {
    setQuickNotes('');
    if (notesTimerRef.current) clearTimeout(notesTimerRef.current);
    try {
      localStorage.removeItem(NOTES_STORAGE_KEY);
    } catch {
      // localStorage not available
    }
  }, []);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (notesTimerRef.current) clearTimeout(notesTimerRef.current);
    };
  }, []);

  const [error, setError] = useState<string | null>(null);
  const [activityFeed, setActivityFeed] = useState<ActivityItem[]>([]);
  const [topItems, setTopItems] = useState<TopItem[]>([]);
  const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([]);
  const [yesterdayInvoiceCount, setYesterdayInvoiceCount] = useState<number | null>(null);

  // Cash Overview widget data
  const [todayCashIncome, setTodayCashIncome] = useState<number>(0);
  const [todayCashExpense, setTodayCashExpense] = useState<number>(0);

  // Expense Categories Breakdown data
  const [expenseCategories, setExpenseCategories] = useState<{ description: string; total: number }[]>([]);

  // Monthly Revenue Target
  const REVENUE_TARGET_STORAGE_KEY = 'eservices-revenue-target';
  const [revenueTarget, setRevenueTarget] = useState<number>(50000);
  const [editingTarget, setEditingTarget] = useState(false);
  const [targetInputValue, setTargetInputValue] = useState('50000');

  const fetchDashboardData = useCallback(async (silent?: boolean) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const [dashRes, pettyCashRes, khataRes, itemsRes] = await Promise.allSettled([
        fetch('/api/dashboard', { headers: authHeaders }),
        fetch('/api/petty-cash', { headers: authHeaders }),
        fetch('/api/khata/profiles', { headers: authHeaders }),
        fetch('/api/items', { headers: authHeaders }),
      ]);

      if (dashRes.status === 'fulfilled' && dashRes.value.ok) {
        const data: DashboardData = await dashRes.value.json();
        setDashboard(data);
        setInvoices(Array.isArray(data.recentInvoices) ? data.recentInvoices.slice(0, 7) : []);

        // Calculate yesterday's invoice count from trend data
        if (data.trend && data.trend.length >= 2) {
          const yesterdayTrend = data.trend[data.trend.length - 2];
          setYesterdayInvoiceCount(yesterdayTrend.count);
        }
      }

      if (pettyCashRes.status === 'fulfilled' && pettyCashRes.value.ok) {
        const data: PettyCashData = await pettyCashRes.value.json();
        setCashBalance(data.config?.amount ?? 0);

        // Calculate today's cash income/expense from transactions
        const txArr = Array.isArray(data.transactions) ? data.transactions : [];
        const todayStr = new Date().toLocaleDateString('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' });
        const todayTxs = txArr.filter((tx) => {
          const txDate = tx.date || tx.createdAt || '';
          return txDate.startsWith(todayStr);
        });
        setTodayCashIncome(todayTxs.filter((tx) => (tx.type || '').toLowerCase() === 'income').reduce((sum, tx) => sum + (tx.amount || 0), 0));
        setTodayCashExpense(todayTxs.filter((tx) => (tx.type || '').toLowerCase() === 'expense').reduce((sum, tx) => sum + (tx.amount || 0), 0));

        // Expense categories breakdown - group expenses by description
        const expenseTxs = txArr.filter((tx) => (tx.type || '').toLowerCase() === 'expense');
        const categoryMap = new Map<string, number>();
        for (const tx of expenseTxs) {
          const desc = (tx.description || 'Uncategorized').trim();
          const cleanDesc = desc.replace(/^\[\w+\]\s*/, '').trim() || desc;
          categoryMap.set(cleanDesc, (categoryMap.get(cleanDesc) || 0) + (tx.amount || 0));
        }
        const sorted = Array.from(categoryMap.entries())
          .map(([description, total]) => ({ description, total }))
          .sort((a, b) => b.total - a.total)
          .slice(0, 5);
        setExpenseCategories(sorted);
      }

      if (khataRes.status === 'fulfilled' && khataRes.value.ok) {
        const data = await khataRes.value.json();
        setKhataProfiles(Array.isArray(data) ? data : []);
      }

      if (itemsRes.status === 'fulfilled' && itemsRes.value.ok) {
        const itemsData = await itemsRes.value.json();
        const itemsArr = Array.isArray(itemsData) ? itemsData : [];
        const sorted = itemsArr
          .filter((item: { price: number }) => item.price > 0)
          .sort((a: { price: number }, b: { price: number }) => b.price - a.price)
          .slice(0, 5);
        setTopItems(sorted);

        // Low stock items (quantity <= 5)
        const lowStock = itemsArr
          .filter((item: { quantity: number }) => item.quantity <= 5)
          .sort((a: { quantity: number }, b: { quantity: number }) => a.quantity - b.quantity)
          .slice(0, 5);
        setLowStockItems(lowStock);
      }

      // Fetch activity feed data
      const [invoicesRes, pettyCashTxRes, khataTxRes] = await Promise.allSettled([
        fetch('/api/invoices?limit=5', { headers: authHeaders }),
        fetch('/api/petty-cash', { headers: authHeaders }),
        fetch('/api/khata/transactions?limit=3', { headers: authHeaders }),
      ]);

      const activities: ActivityItem[] = [];

      if (invoicesRes.status === 'fulfilled' && invoicesRes.value.ok) {
        const invoiceList = await invoicesRes.value.json();
        const invArr = Array.isArray(invoiceList) ? invoiceList.slice(0, 5) : [];
        for (const inv of invArr) {
          activities.push({
            id: inv.id || `inv-${Math.random().toString(36).slice(2)}`,
            type: 'invoice',
            title: `Invoice ${inv.invoiceNumber || 'N/A'}`,
            description: `${inv.customerName || 'Walk-in'} — ${inv.status || 'Pending'}`,
            amount: inv.grandTotal,
            timestamp: inv.createdAt || inv.date || '',
            iconBg: 'bg-green-100 dark:bg-green-900/40',
            iconColor: 'text-green-600 dark:text-green-400',
            icon: <FileText className="size-3.5" />,
          });
        }
      }

      if (pettyCashTxRes.status === 'fulfilled' && pettyCashTxRes.value.ok) {
        const txData = await pettyCashTxRes.value.json();
        const txArr = Array.isArray(txData.transactions) ? txData.transactions.slice(0, 3) : [];
        for (const tx of txArr) {
          const isExpense = (tx.type || '').toLowerCase() === 'expense';
          activities.push({
            id: tx.id || `cash-${Math.random().toString(36).slice(2)}`,
            type: 'cash',
            title: tx.description || (isExpense ? 'Cash Expense' : 'Cash Income'),
            description: isExpense ? 'Expense entry' : 'Income entry',
            amount: tx.amount,
            timestamp: tx.date || tx.createdAt || '',
            iconBg: isExpense ? 'bg-red-100 dark:bg-red-900/40' : 'bg-lime-100 dark:bg-lime-900/40',
            iconColor: isExpense ? 'text-red-600 dark:text-red-400' : 'text-lime-600 dark:text-lime-400',
            icon: <WalletIcon className="size-3.5" />,
          });
        }
      }

      if (khataTxRes.status === 'fulfilled' && khataTxRes.value.ok) {
        const kTxList = await khataTxRes.value.json();
        const kTxArr = Array.isArray(kTxList) ? kTxList.slice(0, 3) : [];
        for (const tx of kTxArr) {
          const isDebit = (tx.type || '').toLowerCase() === 'debit' || (tx.type || '').toLowerCase() === 'payment';
          activities.push({
            id: tx.id || `khata-${Math.random().toString(36).slice(2)}`,
            type: 'khata',
            title: tx.description || `Khata ${tx.type || 'Transaction'}`,
            description: tx.profile?.name || 'Khata entry',
            amount: tx.amount,
            timestamp: tx.date || tx.createdAt || '',
            iconBg: isDebit ? 'bg-amber-100 dark:bg-amber-900/40' : 'bg-teal-100 dark:bg-teal-900/40',
            iconColor: isDebit ? 'text-amber-600 dark:text-amber-400' : 'text-teal-600 dark:text-teal-400',
            icon: <CreditCard className="size-3.5" />,
          });
        }
      }

      // Sort by timestamp descending, limit to 10
      activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setActivityFeed(activities.slice(0, 10));

      if (
        dashRes.status === 'rejected' &&
        pettyCashRes.status === 'rejected' &&
        khataRes.status === 'rejected'
      ) {
        setError('Failed to load dashboard data. Please try again.');
      }
    } catch {
      setError('Failed to load dashboard data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Re-fetch data when dataVersion changes (sync from other tabs/devices)
  const prevDataVersion = useRef(dataVersion);
  useEffect(() => {
    if (dataVersion !== undefined && dataVersion !== prevDataVersion.current) {
      prevDataVersion.current = dataVersion;
      fetchDashboardData(true);  // silent=true for background sync
    }
  }, [dataVersion, fetchDashboardData]);

  /* Derived data */
  const totalKhataReceivable = khataProfiles
    .filter((p) => p.type === 'Customer' && p.balance > 0)
    .reduce((sum, p) => sum + p.balance, 0);

  const totalKhataPayable = khataProfiles
    .filter((p) => p.type === 'Supplier' && p.balance > 0)
    .reduce((sum, p) => sum + p.balance, 0);

  const charColorClass = quickNotes.length > 450
    ? 'text-red-500 font-semibold'
    : quickNotes.length > 350
      ? 'text-amber-500'
      : 'text-muted-foreground';

  const topItemsMaxPrice = topItems.length > 0 ? Math.max(...topItems.map((item) => item.price)) : 1;

  // Extract derived data early (before loading guard) to avoid TDZ errors
  const today = dashboard?.today;
  const trend = dashboard?.trend ?? [];
  const overall = dashboard?.overall;

  /* ── Monthly Revenue Target helpers ── */
  const currentMonthRevenue = trend.reduce((sum, d) => sum + d.revenue, 0);
  const targetPercentage = revenueTarget > 0 ? Math.min(Math.round((currentMonthRevenue / revenueTarget) * 100), 100) : 0;
  const targetColorClass = targetPercentage < 30 ? 'text-red-500' : targetPercentage < 70 ? 'text-amber-500' : 'text-green-500';
  const targetBarColorClass = targetPercentage < 30 ? 'bg-gradient-to-r from-red-500 to-red-400' : targetPercentage < 70 ? 'bg-gradient-to-r from-amber-500 to-amber-400' : 'bg-gradient-to-r from-green-500 to-emerald-400';
  const targetBadgeClass = targetPercentage < 30 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : targetPercentage < 70 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';

  const handleSaveTarget = useCallback(() => {
    const val = parseFloat(targetInputValue);
    if (!isNaN(val) && val > 0) {
      setRevenueTarget(val);
      setEditingTarget(false);
      try {
        localStorage.setItem(REVENUE_TARGET_STORAGE_KEY, String(val));
      } catch {
        // localStorage not available
      }
    }
  }, [targetInputValue]);

  const handleCancelEditTarget = useCallback(() => {
    setEditingTarget(false);
    setTargetInputValue(String(revenueTarget));
  }, [revenueTarget]);

  /* ─────────── Loading Skeleton ─────────── */
  if (loading) {
    return (
      <div className="space-y-6 p-4 md:p-6 animate-fade-in">
        {/* Today's Summary skeleton */}
        <Skeleton className="h-36 rounded-2xl" />
        {/* Quick Actions skeleton */}
        <div>
          <Skeleton className="mb-3 h-7 w-40" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
        </div>
        {/* Stats skeleton */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        {/* Revenue Trend skeleton */}
        <Skeleton className="h-52 rounded-xl" />
        {/* Table skeleton */}
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6 animate-fade-in-up">
      {/* ───── Page Header ───── */}
      <div className="animate-fade-in">
        <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
          {getGreeting()} 👋
        </h1>
        <p className="text-muted-foreground mt-1">
          Welcome back to Eservices — here&apos;s your overview.
        </p>
      </div>

      {/* ───── Error Banner ───── */}
      {error && (
        <Card className="animate-scale-in border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertCircle className="size-5 shrink-0 text-red-600" />
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
            <Button
              variant="outline"
              size="sm"
              className="ml-auto border-red-200 text-red-600 hover:bg-red-100"
              onClick={() => fetchDashboardData()}
            >
              <Loader2 className="size-3" />
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ═══════════════════════════════════════════════════════════
          TODAY'S SUMMARY BANNER
          ═══════════════════════════════════════════════════════════ */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 p-5 md:p-7 text-white shadow-lg shadow-green-600/20 animate-fade-in-up">
        {/* Background decoration */}
        <div className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-6 -left-6 size-32 rounded-full bg-white/5" />
        <div className="pointer-events-none absolute right-20 top-4 size-16 rounded-full bg-white/5" />
        {/* Animated gradient shift overlay */}
        <div className="pointer-events-none absolute inset-0 animate-pulse bg-gradient-to-r from-green-500/10 via-emerald-400/0 to-teal-500/10" />
        <div className="pointer-events-none absolute inset-0 animate-[pulse_4s_ease-in-out_infinite_1s] bg-gradient-to-tr from-transparent via-white/5 to-transparent" />

        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Left: Date & Greeting */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-green-100">
              <CalendarDays className="size-4" />
              <span className="text-sm font-medium">{formatTodayBannerDate()}</span>
            </div>
            <h2 className="text-xl font-bold md:text-2xl">Today&apos;s Summary</h2>
            <p className="text-sm text-green-100">
              {today ? (
                <>
                  {today.invoiceCount} invoice{today.invoiceCount !== 1 ? 's' : ''} created &middot;{' '}
                  {today.completedCount} completed &middot;{' '}
                  {today.pendingCount} pending
                </>
              ) : (
                'Loading...'
              )}
            </p>
          </div>

          {/* Right: Revenue */}
          <div className="flex items-center gap-3 rounded-xl bg-white/15 px-5 py-3 backdrop-blur-sm">
            <div className="flex size-10 items-center justify-center rounded-full bg-white/20">
              <IndianRupee className="size-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-green-100 flex items-center gap-1">
                Revenue Today
                <Zap className="size-3 text-yellow-300 animate-pulse" />
              </p>
              <div className="flex items-center gap-2">
                <p className="text-2xl font-bold tabular-nums">
                  {today ? formatCurrency(today.revenue) : '₹0.00'}
                </p>
                {today && today.invoiceCount > 0 && (
                  <Badge className="bg-white/25 text-white border-white/30 text-[10px] font-semibold shrink-0">
                    {today.invoiceCount} invoice{today.invoiceCount !== 1 ? 's' : ''}
                  </Badge>
                )}
              </div>
              {today && today.invoiceCount > 0 && yesterdayInvoiceCount !== null && (
                <p className={`text-[10px] font-medium ${today.invoiceCount >= yesterdayInvoiceCount ? 'text-green-200' : 'text-amber-200'} flex items-center gap-0.5`}>
                  {today.invoiceCount > yesterdayInvoiceCount ? (
                    <><ArrowUpRight className="size-3" />+{today.invoiceCount - yesterdayInvoiceCount} vs yesterday</>
                  ) : today.invoiceCount < yesterdayInvoiceCount ? (
                    <><ArrowDownRight className="size-3" />-{yesterdayInvoiceCount - today.invoiceCount} vs yesterday</>
                  ) : (
                    <>Same as yesterday</>
                  )}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          QUICK ACTIONS — NAV CARDS
          ═══════════════════════════════════════════════════════════ */}
      <section className="animate-fade-in-up" style={{ animationDelay: '100ms' }}>
        <h2 className="mb-3 text-lg font-semibold text-foreground">Quick Actions</h2>
        <div className="stagger-children grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {navCards.map((card) => (
            <Card
              key={card.id}
              className={`group/qk relative cursor-pointer overflow-hidden border-0 bg-card py-3 sm:py-4 shadow-none transition-all duration-300 hover:shadow-xl hover:shadow-green-600/10 hover:-translate-y-1 animate-scale-in before:pointer-events-none before:absolute before:inset-0 before:rounded-xl before:opacity-0 before:transition-opacity before:duration-300 group-hover:before:opacity-100 before:z-0 after:pointer-events-none after:absolute after:bottom-0 after:left-1/4 after:right-1/4 after:h-0.5 after:rounded-full after:bg-gradient-to-r after:from-green-400 after:via-emerald-400 after:to-teal-400 after:opacity-0 after:transition-opacity after:duration-300 group-hover/qk:after:opacity-100 ${card.gradientBorder}`}
              onClick={() => onNavigate(card.id)}
            >
              <CardContent className="relative z-10 flex flex-col items-center gap-2 px-3 text-center">
                <div
                  className={`flex size-12 items-center justify-center rounded-xl shadow-sm transition-all duration-300 group-hover:scale-110 group-hover:shadow-md ${card.iconBg} ${card.iconColor}`}
                >
                  {card.icon}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{card.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                    {card.description}
                  </p>
                </div>
                <ArrowRight className="size-3.5 text-muted-foreground opacity-0 transition-all duration-300 group-hover:translate-x-1 group-hover:opacity-100" />
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          QUICK ACTIONS ROW
          ═══════════════════════════════════════════════════════════ */}
      <section className="animate-fade-in-up" style={{ animationDelay: '125ms' }}>
        <Card className="border-0 shadow-sm hover-lift card-hover-glow">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Zap className="size-4 text-green-500" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 pb-4">
            <div className="flex items-center justify-around gap-2 sm:gap-4">
              {[
                { icon: <Plus className="size-5 text-white" />, label: 'New Bill', page: 'new-bill', bg: 'bg-green-600 hover:bg-green-700', ring: 'ring-green-200', disabled: !canAccessBilling || !canCreateBill },
                { icon: <Package className="size-5 text-white" />, label: 'Add Item', page: 'item-management', bg: 'bg-emerald-600 hover:bg-emerald-700', ring: 'ring-emerald-200', disabled: !canAccessInventory || !canCreateItem },
                { icon: <Wallet className="size-5 text-white" />, label: 'Record Cash', page: 'cash-manager', bg: 'bg-teal-600 hover:bg-teal-700', ring: 'ring-teal-200', disabled: !canAccessCashManager || !canCreateCash },
                { icon: <BarChart3 className="size-5 text-white" />, label: 'Reports', page: 'reports', bg: 'bg-lime-600 hover:bg-lime-700', ring: 'ring-lime-200', disabled: false },
              ].map((action) => (
                <button
                  key={action.page}
                  onClick={() => { if (!action.disabled) onNavigate(action.page); }}
                  disabled={action.disabled}
                  className={`flex flex-col items-center gap-1.5 group/qa transition-transform duration-200 active:scale-95 ${action.disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                >
                  <div className={`w-12 h-12 rounded-full ${action.bg} ring-4 ring-white/50 flex items-center justify-center shadow-md ${action.disabled ? '' : 'group-hover/qa:shadow-lg'} transition-all duration-200 ${action.disabled ? '' : 'group-hover/qa:scale-105'}`}>
                    {action.icon}
                  </div>
                  <span className="text-xs font-medium text-muted-foreground group-hover/qa:text-foreground transition-colors">{action.label}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          TODAY'S QUICK SUMMARY MINI CARD
          ═══════════════════════════════════════════════════════════ */}
      <div className="animate-fade-in-up" style={{ animationDelay: '150ms' }}>
        <Card className="overflow-hidden border-0 bg-gradient-to-r from-green-600/5 via-emerald-600/10 to-teal-600/5 dark:from-green-600/10 dark:via-emerald-600/15 dark:to-teal-600/10">
          <CardContent className="p-0">
            <div className="grid grid-cols-1 divide-y divide-green-200/50 dark:divide-green-800/30 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              {/* Today's Invoices */}
              <div className="flex items-center gap-3 px-4 py-3 sm:px-5">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/40">
                  <FileText className="size-4 text-green-600 dark:text-green-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Today&apos;s Invoices</p>
                  <p className="text-lg font-bold tabular-nums text-foreground">{today?.invoiceCount ?? 0}</p>
                </div>
              </div>
              {/* Today's Revenue */}
              <div className="flex items-center gap-3 px-4 py-3 sm:px-5">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/40">
                  <IndianRupee className="size-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Today&apos;s Revenue</p>
                  <p className="text-lg font-bold tabular-nums text-foreground">{formatCurrency(today?.revenue ?? 0)}</p>
                </div>
              </div>
              {/* Cash Balance */}
              <div className="flex items-center gap-3 px-4 py-3 sm:px-5">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-teal-100 dark:bg-teal-900/40">
                  <Banknote className="size-4 text-teal-600 dark:text-teal-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Cash Balance</p>
                  <p className="text-lg font-bold tabular-nums text-foreground">{formatCurrency(cashBalance ?? 0)}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          MONTHLY REVENUE TARGET PROGRESS
          ═══════════════════════════════════════════════════════════ */}
      <div className="animate-fade-in-up" style={{ animationDelay: '175ms' }}>
        <Card className="overflow-hidden border-0 card-hover-glow">
          <CardContent className="p-5">
            <div className="flex flex-col sm:flex-row items-center gap-6">
              {/* SVG Circular Progress */}
              <div className="relative shrink-0">
                <svg width="100" height="100" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="oklch(0.92 0.02 155)" strokeWidth="8" />
                  <circle
                    cx="50" cy="50" r="42" fill="none"
                    stroke="url(#revenueGradient)"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 42}
                    strokeDashoffset={2 * Math.PI * 42 * (1 - Math.min(((today?.revenue ?? 0) * 30) / 50000, 1))}
                    className="progress-ring-circle"
                  />
                  <defs>
                    <linearGradient id="revenueGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="oklch(0.55 0.15 155)" />
                      <stop offset="100%" stopColor="oklch(0.55 0.18 175)" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <Target className="size-4 text-green-500 mb-0.5" />
                  <span className="text-lg font-bold tabular-nums text-foreground">
                    {Math.min(Math.round(((today?.revenue ?? 0) * 30) / 500), 100)}%
                  </span>
                </div>
              </div>
              {/* Text Info */}
              <div className="flex-1 text-center sm:text-left">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 justify-center sm:justify-start">
                  <Target className="size-4 text-green-500" />
                  Monthly Revenue Target
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Projected: <span className="font-semibold text-foreground">{formatCurrency((today?.revenue ?? 0) * 30)}</span> of <span className="font-semibold text-foreground">₹50,000.00</span>
                </p>
                <div className="mt-2 h-2 w-full max-w-xs mx-auto sm:mx-0 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-400 transition-all duration-700"
                    style={{ width: `${Math.min(((today?.revenue ?? 0) * 30) / 50000 * 100, 100)}%` }}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {((today?.revenue ?? 0) * 30) >= 50000 ? '🎉 Target reached!' : `₹${formatCurrency(50000 - (today?.revenue ?? 0) * 30)} remaining`}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Animated gradient divider */}
      <div className="rounded-full overflow-hidden">
        <div className="h-0.5 bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500 animate-pulse opacity-60" />
      </div>

      {/* ═══════════════════════════════════════════════════════════
          SUMMARY STATS
          ═══════════════════════════════════════════════════════════ */}
      <section className="animate-fade-in-up" style={{ animationDelay: '200ms' }}>
        <h2 className="mb-3 text-lg font-semibold text-foreground">Summary</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Card className="card-hover-glow border-l-4 border-l-green-500 transition-shadow hover:shadow-md">
            <CardContent className="flex items-center gap-4 py-4">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-green-100 dark:bg-green-900/40">
                <FileBarChart className="size-5 text-green-600 dark:text-green-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-muted-foreground">Total Invoices</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl font-bold tabular-nums text-foreground">
                    {overall?.totalInvoices ?? 0}
                  </p>
                  {(() => {
                    const pct = getTrendPercentage(trend, 'count');
                    if (pct.value === 0) return null;
                    return (
                      <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${
                        pct.isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                      }`}>
                        {pct.isPositive ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
                        {pct.value > 0 ? '+' : '-'}{pct.value}%
                      </span>
                    );
                  })()}
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="card-hover-glow border-l-4 border-l-emerald-500 transition-shadow hover:shadow-md">
            <CardContent className="flex items-center gap-4 py-4">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/40">
                <TrendingUp className="size-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl font-bold tabular-nums text-foreground">
                    {formatCurrency(overall?.totalRevenue ?? 0)}
                  </p>
                  {(() => {
                    const pct = getTrendPercentage(trend, 'revenue');
                    if (pct.value === 0) return null;
                    return (
                      <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${
                        pct.isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                      }`}>
                        {pct.isPositive ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
                        {pct.value > 0 ? '+' : '-'}{pct.value}%
                      </span>
                    );
                  })()}
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="card-hover-glow border-l-4 border-l-amber-500 transition-shadow hover:shadow-md">
            <CardContent className="flex items-center gap-4 py-4">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/40">
                <Clock className="size-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-muted-foreground">Pending Bills</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl font-bold tabular-nums text-foreground">
                    {overall?.pendingBills ?? 0}
                  </p>
                  {(() => {
                    const pending = today?.pendingCount ?? overall?.pendingBills ?? 0;
                    if (pending === 0) {
                      return (
                        <span className="inline-flex items-center gap-0.5 text-xs font-medium text-green-600 dark:text-green-400">
                          <ArrowUpRight className="size-3" />
                          Clear
                        </span>
                      );
                    }
                    return (
                      <span className="inline-flex items-center gap-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                        <ArrowDownRight className="size-3" />
                        Needs attention
                      </span>
                    );
                  })()}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          QUICK STATS ROW
          ═══════════════════════════════════════════════════════════ */}
      <section className="animate-fade-in-up" style={{ animationDelay: '250ms' }}>
        <h2 className="mb-3 text-lg font-semibold text-foreground">Quick Stats</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Card className="card-hover-glow border-l-4 border-l-lime-500 transition-shadow hover:shadow-md">
            <CardContent className="flex items-center gap-4 py-4">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-lime-100 dark:bg-lime-900/40">
                <IndianRupee className="size-5 text-lime-600 dark:text-lime-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-muted-foreground">Cash Balance</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl font-bold tabular-nums text-foreground">
                    {formatCurrency(cashBalance ?? 0)}
                  </p>
                  {(cashBalance ?? 0) > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400">
                      <span className="size-1.5 rounded-full bg-green-500 animate-pulse" />
                      Active
                    </span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="card-hover-glow border-l-4 border-l-teal-500 transition-shadow hover:shadow-md">
            <CardContent className="flex items-center gap-4 py-4">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-teal-100 dark:bg-teal-900/40">
                <ArrowDownRight className="size-5 text-teal-600 dark:text-teal-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-muted-foreground">Khata Receivable</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl font-bold tabular-nums text-foreground">
                    {formatCurrency(totalKhataReceivable)}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {khataProfiles.filter((p) => p.type === 'Customer' && p.balance > 0).length}{' '}
                  customer(s)
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="card-hover-glow border-l-4 border-l-cyan-500 transition-shadow hover:shadow-md">
            <CardContent className="flex items-center gap-4 py-4">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-cyan-100 dark:bg-cyan-900/40">
                <ArrowUpRight className="size-5 text-cyan-600 dark:text-cyan-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-muted-foreground">Khata Payable</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl font-bold tabular-nums text-foreground">
                    {formatCurrency(totalKhataPayable)}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {khataProfiles.filter((p) => p.type === 'Supplier' && p.balance > 0).length}{' '}
                  supplier(s)
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          TODAY'S ACTIVITY MINI-TIMELINE
          ═══════════════════════════════════════════════════════════ */}
      <section className="animate-fade-in-up" style={{ animationDelay: '262ms' }}>
        <Card className="card-hover-glow overflow-hidden transition-shadow hover:shadow-md">
          <CardHeader className="pb-3 pt-4 px-5">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Activity className="size-4 text-green-500" />
                Today&apos;s Activity
              </CardTitle>
              <Badge variant="outline" className="text-[10px] font-normal">
                Last 3 transactions
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            {activityFeed.length === 0 ? (
              <div className="flex flex-col items-center py-4 text-muted-foreground">
                <Clock className="size-6 mb-1.5 opacity-40" />
                <p className="text-xs">No activity recorded today</p>
              </div>
            ) : (
              <div className="relative space-y-0">
                {activityFeed.slice(0, 3).map((activity, idx) => {
                  const timeStr = activity.timestamp
                    ? new Date(activity.timestamp).toLocaleTimeString('en-IN', {
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true,
                      })
                    : '—';
                  const typeLabel =
                    activity.type === 'invoice'
                      ? 'Invoice'
                      : activity.type === 'cash'
                        ? activity.description.includes('Expense') || activity.description.includes('expense')
                          ? 'Cash Out'
                          : 'Cash In'
                        : 'Khata';
                  const typeColor =
                    activity.type === 'invoice'
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
                      : activity.type === 'cash'
                        ? activity.description.includes('Expense') || activity.description.includes('expense')
                          ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
                          : 'bg-lime-100 text-lime-700 dark:bg-lime-900/40 dark:text-lime-400'
                        : 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-400';

                  return (
                    <div key={activity.id} className="flex items-start gap-3 py-2.5">
                      {/* Timeline dot */}
                      <div className="relative flex flex-col items-center pt-1">
                        <div className={`size-2.5 rounded-full ring-2 ring-background ${
                          activity.type === 'invoice'
                            ? 'bg-green-500'
                            : activity.type === 'cash'
                              ? activity.description.includes('Expense') || activity.description.includes('expense')
                                ? 'bg-red-500'
                                : 'bg-lime-500'
                              : 'bg-teal-500'
                        }`} />
                        {idx < Math.min(activityFeed.length, 3) - 1 && (
                          <div className="w-px flex-1 bg-muted mt-1 mb-[-4px]" style={{ minHeight: '16px' }} />
                        )}
                      </div>
                      {/* Content */}
                      <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${typeColor}`}>
                              {typeLabel}
                            </span>
                            <span className="text-[10px] text-muted-foreground">{timeStr}</span>
                          </div>
                          <p className="text-xs text-foreground truncate">{activity.description}</p>
                        </div>
                        {activity.amount !== undefined && activity.amount > 0 && (
                          <span className={`text-xs font-semibold tabular-nums shrink-0 ${
                            activity.type === 'cash' && (activity.description.includes('Expense') || activity.description.includes('expense'))
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-green-600 dark:text-green-400'
                          }`}>
                            {activity.type === 'cash' && (activity.description.includes('Expense') || activity.description.includes('expense')) ? '−' : '+'}
                            {formatCurrency(activity.amount)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          MONTHLY REVENUE TARGET
          ═══════════════════════════════════════════════════════════ */}
      <section className="animate-fade-in-up" style={{ animationDelay: '275ms' }}>
        <Card className="card-hover-glow overflow-hidden border-l-4 border-l-green-500 transition-shadow hover:shadow-md">
          <CardContent className="py-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-green-100 dark:bg-green-900/40">
                  <Target className="size-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Monthly Revenue Target</p>
                  <p className="text-xs text-muted-foreground">
                    {formatCurrency(currentMonthRevenue)} of {formatCurrency(revenueTarget)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!editingTarget ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="size-7 p-0 text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      setTargetInputValue(String(revenueTarget));
                      setEditingTarget(true);
                    }}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                ) : (
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      min="1000"
                      step="1000"
                      value={targetInputValue}
                      onChange={(e) => setTargetInputValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveTarget();
                        if (e.key === 'Escape') handleCancelEditTarget();
                      }}
                      className="h-7 w-28 text-xs tabular-nums px-2"
                      autoFocus
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="size-7 p-0 text-green-600 hover:text-green-700 hover:bg-green-100 dark:hover:bg-green-900/30"
                      onClick={handleSaveTarget}
                    >
                      <Check className="size-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
            {/* SVG Circular Progress Indicator */}
            <div className="flex flex-col sm:flex-row items-center gap-5">
              <div className="relative flex-shrink-0">
                <svg width="120" height="120" viewBox="0 0 120 120" className="-rotate-90">
                  {/* Background circle */}
                  <circle cx="60" cy="60" r="50" fill="none" strokeWidth="10" className="stroke-muted" />
                  {/* Green gradient progress */}
                  <defs>
                    <linearGradient id="progressGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#22c55e" />
                      <stop offset="50%" stopColor="#10b981" />
                      <stop offset="100%" stopColor="#14b8a6" />
                    </linearGradient>
                  </defs>
                  <circle
                    cx="60" cy="60" r="50"
                    fill="none"
                    strokeWidth="10"
                    strokeLinecap="round"
                    stroke="url(#progressGrad)"
                    strokeDasharray={`${2 * Math.PI * 50}`}
                    strokeDashoffset={`${2 * Math.PI * 50 * (1 - Math.min(targetPercentage, 100) / 100)}`}
                    className="transition-all duration-1000 ease-out"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className={`text-2xl font-bold tabular-nums ${targetColorClass}`}>{targetPercentage}%</span>
                  <span className="text-[10px] text-muted-foreground">of target</span>
                </div>
              </div>
              <div className="flex-1 space-y-3 w-full">
                <div className="flex items-center justify-between">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${targetBadgeClass}`}>
                    {targetPercentage < 30 ? 'Needs attention' : targetPercentage < 70 ? 'On track' : 'Great progress'}
                  </span>
                  {currentMonthRevenue >= revenueTarget && <span className="text-xs">🎉</span>}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-muted/50 p-3 text-center">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Earned</p>
                    <p className="text-sm font-bold tabular-nums text-green-700 dark:text-green-400 mt-0.5">{formatCurrency(currentMonthRevenue)}</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3 text-center">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Remaining</p>
                    <p className={`text-sm font-bold tabular-nums mt-0.5 ${currentMonthRevenue < revenueTarget ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'}`}>
                      {currentMonthRevenue < revenueTarget ? formatCurrency(revenueTarget - currentMonthRevenue) : '✓ Done'}
                    </p>
                  </div>
                </div>
                <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ease-out ${targetBarColorClass}`}
                    style={{ width: `${Math.min(targetPercentage, 100)}%` }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground text-center">
                  {currentMonthRevenue >= revenueTarget
                    ? '🎉 Target achieved! Keep up the great work!'
                    : `${formatCurrency(revenueTarget - currentMonthRevenue)} more to reach your monthly goal`}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          REVENUE TREND — 7 DAY BAR CHART
          ═══════════════════════════════════════════════════════════ */}
      <section className="animate-fade-in-up" style={{ animationDelay: '300ms' }}>
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="size-4 text-green-500" />
                Revenue Trend
              </CardTitle>
              <CardDescription className="mt-0.5">Last 7 days performance</CardDescription>
            </div>
            <div className="flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
              <TrendingUp className="size-3" />
              7 Days
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            {trend.length === 0 || trend.every((d) => d.revenue === 0) ? (
              <EmptyStateIllustration
                icon={BarChart3}
                title="No revenue data yet"
                subtitle="Start creating invoices to see your revenue trend here"
                actionLabel="Create Invoice"
                onAction={() => onNavigate('new-bill')}
              />
            ) : (
              <RevenueBarChart trend={trend} />
            )}
          </CardContent>
        </Card>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          TOP ITEMS WIDGET
          ═══════════════════════════════════════════════════════════ */}
      <section className="animate-fade-in-up" style={{ animationDelay: '320ms' }}>
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Trophy className="size-4 text-emerald-500" />
                Top Items
              </CardTitle>
              <CardDescription className="mt-0.5">Highest priced items in your menu</CardDescription>
            </div>
            <button
              onClick={() => onNavigate('item-management')}
              className="flex items-center gap-1 text-xs font-medium text-green-600 transition-colors hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
            >
              Manage
              <ChevronRight className="size-3.5" />
            </button>
          </CardHeader>
          <CardContent className="pt-2">
            {topItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="mb-3 flex size-12 items-center justify-center rounded-xl bg-muted">
                  <Package className="size-6 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">No items yet</p>
                <p className="text-xs text-muted-foreground mt-1">Add items with prices to see your top items here</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 border-green-200 text-green-700 hover:bg-green-50 dark:border-green-800 dark:text-green-400 dark:hover:bg-green-950/30"
                  onClick={() => onNavigate('item-management')}
                >
                  <Plus className="size-3" />
                  Add Item
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {topItems.map((item, idx) => {
                  const barWidth = Math.max((item.price / topItemsMaxPrice) * 100, 10);
                  return (
                    <div
                      key={item.id}
                      className="group flex items-center gap-3 animate-fade-in-up"
                      style={{ animationDelay: `${idx * 80}ms` }}
                    >
                      {/* Rank */}
                      <div className={`flex size-6 shrink-0 items-center justify-center rounded-md text-[10px] font-bold ${
                        idx === 0
                          ? 'bg-gradient-to-br from-yellow-400 to-amber-500 text-white'
                          : idx === 1
                            ? 'bg-gradient-to-br from-gray-300 to-gray-400 text-white'
                            : idx === 2
                              ? 'bg-gradient-to-br from-amber-600 to-amber-700 text-white'
                              : 'bg-muted text-muted-foreground'
                      }`}>
                        {idx + 1}
                      </div>
                      {/* Item info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-medium text-foreground truncate group-hover:text-green-700 dark:group-hover:text-green-400 transition-colors">
                            {item.name}
                          </p>
                          <span className="ml-2 text-sm font-semibold tabular-nums text-emerald-700 dark:text-emerald-400 shrink-0">
                            {formatCurrency(item.price)}
                          </span>
                        </div>
                        {/* CSS-only horizontal bar */}
                        <div className="h-2 w-full rounded-full bg-muted/60 dark:bg-muted/30 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-400 transition-all duration-500 group-hover:from-green-600 group-hover:to-emerald-500"
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                        <p className="mt-0.5 text-[10px] text-muted-foreground truncate">
                          {item.category || 'Uncategorized'}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          STOCK ALERTS WIDGET
          ═══════════════════════════════════════════════════════════ */}
      <section className="animate-fade-in-up" style={{ animationDelay: '335ms' }}>
        <Card className="card-hover-glow border-l-4 border-l-amber-500 transition-shadow hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="size-4 text-amber-500" />
                Stock Alerts
              </CardTitle>
              <CardDescription className="mt-0.5">Items with low inventory</CardDescription>
            </div>
            <button
              onClick={() => onNavigate('item-management')}
              className="flex items-center gap-1 text-xs font-medium text-green-600 transition-colors hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
            >
              Manage Items
              <ChevronRight className="size-3.5" />
            </button>
          </CardHeader>
          <CardContent>
            {lowStockItems.length === 0 ? (
              <div className="flex items-center gap-3 py-2">
                <div className="flex size-8 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/40">
                  <PackageCheck className="size-4 text-green-600 dark:text-green-400" />
                </div>
                <p className="text-sm font-medium text-green-700 dark:text-green-400">
                  All items well stocked
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {lowStockItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-3 py-1.5 px-2 rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/40">
                        <Package className="size-3.5 text-amber-600 dark:text-amber-400" />
                      </div>
                      <span className="text-sm font-medium text-foreground truncate">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className={`text-xs font-bold tabular-nums px-2 py-0.5 rounded-full ${
                        item.quantity === 0
                          ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
                      }`}>
                        {item.quantity === 0 ? 'Out of stock' : `${item.quantity} left`}
                      </span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {formatCurrency(item.price)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          EXPENSE CATEGORIES BREAKDOWN
          ═══════════════════════════════════════════════════════════ */}
      <section className="animate-fade-in-up" style={{ animationDelay: '335ms' }}>
        <Card className="card-hover-glow border-l-4 border-l-red-400/70 transition-shadow hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingDown className="size-4 text-red-500" />
                Expense Categories
              </CardTitle>
              <CardDescription className="mt-0.5">Top spending categories</CardDescription>
            </div>
            <button
              onClick={() => onNavigate('cash-manager')}
              className="flex items-center gap-1 text-xs font-medium text-green-600 transition-colors hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
            >
              View All
              <ChevronRight className="size-3.5" />
            </button>
          </CardHeader>
          <CardContent>
            {expenseCategories.length === 0 ? (
              <div className="flex items-center gap-3 py-2">
                <div className="flex size-8 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/40">
                  <Check className="size-4 text-green-600 dark:text-green-400" />
                </div>
                <p className="text-sm font-medium text-green-700 dark:text-green-400">
                  No expense data yet
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {expenseCategories.map((cat) => {
                  const maxTotal = expenseCategories[0]?.total || 1;
                  const pct = Math.max((cat.total / maxTotal) * 100, 2);
                  return (
                    <div key={cat.description} className="group/cat">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-foreground truncate max-w-[60%]">{cat.description}</span>
                        <span className="text-xs font-bold tabular-nums text-red-600 dark:text-red-400">{formatCurrency(cat.total)}</span>
                      </div>
                      <div className="relative h-2.5 w-full rounded-full bg-muted/80 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-400 transition-all duration-500 group-hover/cat:from-green-600 group-hover/cat:to-emerald-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          CASH OVERVIEW WIDGET
          ═══════════════════════════════════════════════════════════ */}
      <section className="animate-fade-in-up" style={{ animationDelay: '340ms' }}>
        <Card className="card-hover-glow border-l-4 border-l-emerald-500 transition-shadow hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <WalletIcon className="size-4 text-emerald-500" />
                Cash Overview
              </CardTitle>
              <CardDescription className="mt-0.5">Today&apos;s cash transactions</CardDescription>
            </div>
            <button
              onClick={() => onNavigate('cash-manager')}
              className="flex items-center gap-1 text-xs font-medium text-green-600 transition-colors hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
            >
              View Details
              <ChevronRight className="size-3.5" />
            </button>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-2.5 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800/40">
                <ArrowDownLeft className="size-4 text-green-600 dark:text-green-400 mx-auto mb-1" />
                <p className="text-base font-bold tabular-nums text-green-700 dark:text-green-400">{formatCurrency(todayCashIncome)}</p>
                <p className="text-[10px] text-green-600 dark:text-green-500 font-medium">Income</p>
              </div>
              <div className="text-center p-2.5 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/40">
                <ArrowDownRight className="size-4 text-red-500 dark:text-red-400 mx-auto mb-1" />
                <p className="text-base font-bold tabular-nums text-red-700 dark:text-red-400">{formatCurrency(todayCashExpense)}</p>
                <p className="text-[10px] text-red-600 dark:text-red-500 font-medium">Expense</p>
              </div>
              <div className={`text-center p-2.5 rounded-lg border ${todayCashIncome - todayCashExpense >= 0 ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800/40' : 'bg-orange-50 dark:bg-orange-900/20 border-orange-100 dark:border-orange-800/40'}`}>
                <IndianRupee className={`size-4 mx-auto mb-1 ${todayCashIncome - todayCashExpense >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-orange-600 dark:text-orange-400'}`} />
                <p className={`text-base font-bold tabular-nums ${todayCashIncome - todayCashExpense >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-orange-700 dark:text-orange-400'}`}>
                  {formatCurrency(todayCashIncome - todayCashExpense)}
                </p>
                <p className={`text-[10px] font-medium ${todayCashIncome - todayCashExpense >= 0 ? 'text-emerald-600 dark:text-emerald-500' : 'text-orange-600 dark:text-orange-500'}`}>Net Balance</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          KHATA OVERVIEW WIDGET
          ═══════════════════════════════════════════════════════════ */}
      <section className="animate-fade-in-up" style={{ animationDelay: '345ms' }}>
        <Card className="card-hover-glow border-l-4 border-l-teal-500 transition-shadow hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <BookOpen className="size-4 text-teal-500" />
                Khata Overview
              </CardTitle>
              <CardDescription className="mt-0.5">Credit account balances</CardDescription>
            </div>
            <button
              onClick={() => onNavigate('khata')}
              className="flex items-center gap-1 text-xs font-medium text-green-600 transition-colors hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
            >
              View Details
              <ChevronRight className="size-3.5" />
            </button>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800/40">
                <ArrowDownLeft className="size-5 text-green-600 dark:text-green-400 mx-auto mb-1.5" />
                <p className="text-base font-bold tabular-nums text-green-700 dark:text-green-400">
                  {formatCurrency(totalKhataReceivable)}
                </p>
                <p className="text-[10px] text-green-600 dark:text-green-500 font-medium mt-0.5">
                  Receivable
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {khataProfiles.filter((p) => p.type === 'Customer' && p.balance > 0).length} customer(s)
                </p>
              </div>
              <div className="text-center p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/40">
                <ArrowUpRight className="size-5 text-red-500 dark:text-red-400 mx-auto mb-1.5" />
                <p className="text-base font-bold tabular-nums text-red-700 dark:text-red-400">
                  {formatCurrency(totalKhataPayable)}
                </p>
                <p className="text-[10px] text-red-600 dark:text-red-500 font-medium mt-0.5">
                  Payable
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {khataProfiles.filter((p) => p.type === 'Supplier' && p.balance > 0).length} supplier(s)
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          RECENT INVOICES TABLE
          ═══════════════════════════════════════════════════════════ */}
      <section className="animate-fade-in-up" style={{ animationDelay: '350ms' }}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Recent Invoices</h2>
          <button
            onClick={() => onNavigate('bill-history')}
            className="flex items-center gap-1 text-sm font-medium text-green-600 transition-colors hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
          >
            View All
            <ChevronRight className="size-4" />
          </button>
        </div>
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            {invoices.length === 0 ? (
              <EmptyStateIllustration
                icon={FileText}
                title="No invoices yet"
                subtitle="Create your first invoice to get started and see it here"
                actionLabel="Create Invoice"
                onAction={() => onNavigate('new-bill')}
              />
            ) : (
              <div className="max-h-96 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-b-2 border-border">
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Invoice #
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Date
                      </TableHead>
                      <TableHead className="hidden text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:table-cell">
                        Customer
                      </TableHead>
                      <TableHead className="hidden text-xs font-semibold uppercase tracking-wider text-muted-foreground lg:table-cell">
                        Payment
                      </TableHead>
                      <TableHead className="text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Amount
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Status
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((inv, idx) => (
                      <TableRow
                        key={inv.id}
                        className={`cursor-pointer transition-colors hover:bg-green-50/50 dark:hover:bg-green-950/20 ${
                          idx % 2 === 0 ? 'bg-muted/20' : 'bg-transparent'
                        }`}
                        onClick={() => onNavigate('bill-history')}
                      >
                        <TableCell className="font-mono text-sm font-semibold text-foreground">
                          <span className="inline-flex items-center gap-2">
                            <span className={`inline-block size-2 rounded-full shrink-0 ${
                              inv.status === 'Completed' ? 'bg-green-500' : inv.status === 'Pending' ? 'bg-amber-500' : 'bg-red-500'
                            }`} />
                            {inv.invoiceNumber}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(inv.date)}
                        </TableCell>
                        <TableCell className="hidden text-sm sm:table-cell">
                          <span className="font-medium text-foreground">
                            {inv.customerName || 'Walk-in'}
                          </span>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <PaymentMethodBadge method={inv.paymentMethod} />
                        </TableCell>
                        <TableCell className="text-right text-sm font-semibold tabular-nums text-foreground">
                          {formatCurrency(inv.grandTotal)}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={inv.status} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          QUICK CREATE — FLOATING ACTION SECTION
          ═══════════════════════════════════════════════════════════ */}
      <section className="animate-fade-in-up" style={{ animationDelay: '400ms' }}>
        <Card className="overflow-hidden border-2 border-dashed border-green-200 bg-gradient-to-br from-green-50/50 to-emerald-50/50 dark:border-green-800/50 dark:from-green-950/20 dark:to-emerald-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Plus className="size-4 text-green-600 dark:text-green-400" />
              Quick Create
            </CardTitle>
            <CardDescription>Frequently used actions at your fingertips</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => onNavigate('new-bill')}
                className="bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-md shadow-green-600/20 hover:from-green-700 hover:to-emerald-700 hover:shadow-lg transition-all"
              >
                <FileText className="size-4" />
                New Invoice
              </Button>
              <Button
                onClick={() => onNavigate('cash-manager')}
                variant="outline"
                className="border-green-200 bg-white text-green-700 hover:bg-green-50 hover:text-green-800 dark:border-green-800 dark:bg-green-950/30 dark:text-green-400 dark:hover:bg-green-950/50 dark:hover:text-green-300 transition-all"
              >
                <Banknote className="size-4" />
                Add Cash Entry
              </Button>
              <Button
                onClick={() => onNavigate('staff-attendance')}
                variant="outline"
                className="border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400 dark:hover:bg-emerald-950/50 dark:hover:text-emerald-300 transition-all"
              >
                <UserPlus className="size-4" />
                Add Staff
              </Button>
              <Button
                onClick={() => onNavigate('item-management')}
                variant="outline"
                className="border-teal-200 bg-white text-teal-700 hover:bg-teal-50 hover:text-teal-800 dark:border-teal-800 dark:bg-teal-950/30 dark:text-teal-400 dark:hover:bg-teal-950/50 dark:hover:text-teal-300 transition-all"
              >
                <Package className="size-4" />
                Add Item
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          QUICK NOTES WIDGET
          ═══════════════════════════════════════════════════════════ */}
      <section className="animate-fade-in-up" style={{ animationDelay: '450ms' }}>
        <Card className="overflow-hidden border-t-2 border-t-green-400">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <StickyNote className="size-4 text-green-600 dark:text-green-400" />
                Quick Notes
              </CardTitle>
              <div className="flex items-center gap-2">
                <span className={`text-xs tabular-nums transition-colors ${charColorClass}`}>
                  {quickNotes.length}/500
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-950/20"
                  onClick={handleClearNotes}
                  disabled={quickNotes.length === 0}
                >
                  <Trash2 className="size-3" />
                  Clear
                </Button>
              </div>
            </div>
            <CardDescription>Jot down quick reminders (auto-saved)</CardDescription>
          </CardHeader>
          <CardContent>
            <textarea
              value={quickNotes}
              onChange={(e) => {
                if (e.target.value.length <= 500) {
                  handleNotesChange(e.target.value);
                }
              }}
              placeholder="Type your notes here... e.g., Call supplier for stock update, Follow up with customer XYZ"
              className="w-full min-h-[100px] resize-y rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-green-500/40 focus:border-green-400 transition-all"
            />
          </CardContent>
        </Card>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          ACTIVITY FEED
          ═══════════════════════════════════════════════════════════ */}
      <section className="animate-fade-in-up" style={{ animationDelay: '500ms' }}>
        <Card className="overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Activity className="size-4 text-green-600 dark:text-green-400" />
                  Activity Feed
                </CardTitle>
                <CardDescription className="mt-0.5">Recent activity across all modules</CardDescription>
              </div>
              <Badge variant="secondary" className="text-xs font-normal">
                {activityFeed.length} recent
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {activityFeed.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="mb-3 flex size-12 items-center justify-center rounded-xl bg-muted">
                  <Activity className="size-6 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">No recent activity</p>
                <p className="text-xs text-muted-foreground mt-1">Start creating invoices or adding entries to see activity here</p>
              </div>
            ) : (
              <div className="relative max-h-[400px] overflow-y-auto pr-1">
                {/* Timeline vertical line */}
                <div className="pointer-events-none absolute left-[11px] top-2 bottom-2 w-px bg-gradient-to-b from-green-300 via-emerald-300 to-transparent dark:from-green-700 dark:via-emerald-700 dark:to-transparent" />
                <div className="space-y-1">
                  {activityFeed.map((item, idx) => (
                    <div
                      key={item.id}
                      className="relative flex items-start gap-3 rounded-lg px-3 py-2.5 pl-9 transition-colors hover:bg-muted/30 animate-fade-in-up"
                      style={{ animationDelay: `${idx * 60}ms` }}
                    >
                      {/* Timeline dot */}
                      <div className={`absolute left-1 top-4 size-[9px] rounded-full border-2 border-background ring-2 ${
                        item.type === 'invoice'
                          ? 'bg-green-500 ring-green-500/20'
                          : item.type === 'cash'
                            ? 'bg-lime-500 ring-lime-500/20'
                            : 'bg-teal-500 ring-teal-500/20'
                      }`} />
                      {/* Icon */}
                      <div className={`flex size-7 shrink-0 items-center justify-center rounded-lg ${item.iconBg} ${item.iconColor}`}>
                        {item.icon}
                      </div>
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.description}</p>
                      </div>
                      {/* Amount & date */}
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        {item.amount !== undefined && item.amount !== null && (
                          <span className={`text-sm font-semibold tabular-nums ${
                            item.type === 'cash' ? 'text-lime-600 dark:text-lime-400' : 'text-foreground'
                          }`}>
                            {item.type === 'invoice' ? '' : item.type === 'cash' ? '+' : ''}
                            {formatCurrency(item.amount)}
                          </span>
                        )}
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                          {item.timestamp
                            ? new Date(item.timestamp).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
                            : '—'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
