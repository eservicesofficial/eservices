'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Users,
  Armchair,
  ChevronDown,
  LayoutGrid,
  List,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  UtensilsCrossed,
  ArrowLeft,
  Search,
  Minus,
  ShoppingCart,
  ChefHat,
  Printer,
  CreditCard,
  Banknote,
  Smartphone,
  StickyNote,
  ArrowRightLeft,
  X,
  Eye,
  Send,
  Receipt,
  IndianRupee,
  Timer,
  UserCheck,
  RotateCcw,
  PartyPopper,
  RefreshCw,
  Settings,
} from 'lucide-react';
import { useAuth } from '@/components/auth-provider';
import { notify } from '@/lib/notification-store';

/* ═══════════════════════════════════════════
   Types
   ═══════════════════════════════════════════ */

interface Table {
  id: string;
  unitCode: string;
  tableNumber: number;
  name: string;
  capacity: number;
  section: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface TableManagementSectionProps {
  onRefreshData?: () => void;
  dataVersion?: number;
}

type TableStatus = 'available' | 'occupied' | 'reserved' | 'cleaning';
type ViewMode = 'grid' | 'list';
type ActiveView = 'grid' | 'table-action' | 'order' | 'detail';

interface MenuItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl: string;
  categoryId: string;
  categoryName: string;
  category?: string;
}

interface Category {
  id: string;
  name: string;
}

interface CartItem {
  id: string;
  itemId: string;
  name: string;
  qty: number;
  rate: number;
  total: number;
  notes: string;
}

interface TableSession {
  id: string;
  tableId: string;
  status: string;
  waiterName: string;
  guestCount: number;
  notes: string;
  openedAt: string;
  totalAmount: number;
  orderCount: number;
}

interface TableOrder {
  id: string;
  sessionId: string;
  orderNumber: number;
  status: string;
  notes: string;
  items: OrderItem[];
  total: number;
  createdAt: string;
  updatedAt: string;
}

interface OrderItem {
  id: string;
  itemId: string;
  name: string;
  qty: number;
  rate: number;
  total: number;
  notes: string;
  status: string;
}

interface Settings {
  gstRate: number;
  enableGst: boolean;
}

/* ═══════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════ */

const SECTIONS = ['All', 'Indoor', 'Outdoor', 'AC', 'Terrace', 'VIP'] as const;
const SECTION_OPTIONS = ['Indoor', 'Outdoor', 'AC', 'Terrace', 'VIP', 'Private'] as const;
const STATUS_CYCLE: TableStatus[] = ['available', 'occupied', 'reserved', 'cleaning'];
const STATUSES: { value: TableStatus; label: string }[] = [
  { value: 'available', label: 'Available' },
  { value: 'occupied', label: 'Occupied' },
  { value: 'reserved', label: 'Reserved' },
  { value: 'cleaning', label: 'Cleaning' },
];

const ORDER_STATUS_CONFIG: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  new: {
    bg: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800',
    text: 'New',
    icon: <Clock className="h-3 w-3" />,
  },
  preparing: {
    bg: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800',
    text: 'Preparing',
    icon: <ChefHat className="h-3 w-3" />,
  },
  ready: {
    bg: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200 dark:border-purple-800',
    text: 'Ready',
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
  served: {
    bg: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
    text: 'Served',
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
  cancelled: {
    bg: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 border-rose-200 dark:border-rose-800',
    text: 'Cancelled',
    icon: <XCircle className="h-3 w-3" />,
  },
};

const PAYMENT_METHODS = [
  { value: 'Cash', label: 'Cash', icon: Banknote },
  { value: 'UPI', label: 'UPI', icon: Smartphone },
  { value: 'Card', label: 'Card', icon: CreditCard },
  { value: 'Mixed', label: 'Mixed', icon: CreditCard },
] as const;

const CATEGORY_COLORS = [
  '#16a34a', '#0891b2', '#d97706', '#dc2626', '#7c3aed',
  '#db2777', '#059669', '#4f46e5', '#ea580c', '#2563eb',
];

const STATUS_CONFIG: Record<
  TableStatus,
  { color: string; bg: string; dot: string; icon: React.ReactNode; textClass: string }
> = {
  available: {
    color: 'text-emerald-700 dark:text-emerald-400',
    bg: 'bg-emerald-100 dark:bg-emerald-900/30',
    dot: 'bg-emerald-500',
    icon: <CheckCircle2 className="h-4 w-4 text-emerald-600" />,
    textClass: 'text-emerald-700 dark:text-emerald-400',
  },
  occupied: {
    color: 'text-rose-700 dark:text-rose-400',
    bg: 'bg-rose-100 dark:bg-rose-900/30',
    dot: 'bg-rose-500',
    icon: <XCircle className="h-4 w-4 text-rose-600" />,
    textClass: 'text-rose-700 dark:text-rose-400',
  },
  reserved: {
    color: 'text-amber-700 dark:text-amber-400',
    bg: 'bg-amber-100 dark:bg-amber-900/30',
    dot: 'bg-amber-500',
    icon: <Clock className="h-4 w-4 text-amber-600" />,
    textClass: 'text-amber-700 dark:text-amber-400',
  },
  cleaning: {
    color: 'text-teal-700 dark:text-teal-400',
    bg: 'bg-teal-100 dark:bg-teal-900/30',
    dot: 'bg-teal-500',
    icon: <Clock className="h-4 w-4 text-teal-600" />,
    textClass: 'text-teal-700 dark:text-teal-400',
  },
};

const SECTION_COLORS: Record<string, string> = {
  Indoor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  Outdoor: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300 border-orange-200 dark:border-orange-800',
  AC: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800',
  Terrace: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  VIP: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 border-purple-200 dark:border-purple-800',
  Private: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300 border-rose-200 dark:border-rose-800',
};

/* ═══════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════ */

function formatCurrency(amount: number): string {
  return `₹${Math.abs(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatElapsedTime(startTime: string): string {
  if (!startTime) return '';
  const start = new Date(startTime).getTime();
  const now = Date.now();
  const diffMs = now - start;
  const totalMinutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function formatTime(dateStr: string): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return dateStr;
  }
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  } catch {
    return dateStr;
  }
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

function getSectionColorClass(section: string): string {
  return SECTION_COLORS[section] || 'bg-muted text-muted-foreground border-border';
}

function shouldPulse(status: string): boolean {
  return status === 'occupied' || status === 'reserved';
}

function getNextStatus(currentStatus: string): TableStatus {
  const idx = STATUS_CYCLE.indexOf(currentStatus as TableStatus);
  const next = (idx + 1) % STATUS_CYCLE.length;
  return STATUS_CYCLE[next];
}

/* ═══════════════════════════════════════════
   Component
   ═══════════════════════════════════════════ */

export default function TableManagementSection({
  onRefreshData,
  dataVersion,
}: TableManagementSectionProps) {
  const { token, hasPermission, currentUser } = useAuth();

  const authHeaders = React.useMemo(
    (): Record<string, string> => (token ? { Authorization: `Bearer ${token}` } : {}),
    [token]
  );

  // Permission checks
  const canCreate = hasPermission('inventory', 'create');
  const canEdit = hasPermission('inventory', 'edit');
  const canDelete = hasPermission('inventory', 'delete');

  // ─── Core State ───
  const [tables, setTables] = useState<Table[]>([]);
  const [tableSessions, setTableSessions] = useState<Record<string, TableSession>>({});
  const [loading, setLoading] = useState(true);

  // ─── View State ───
  const [activeView, setActiveView] = useState<ActiveView>('grid');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sectionFilter, setSectionFilter] = useState<string>('All');
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [selectedStatusForAction, setSelectedStatusForAction] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<TableSession | null>(null);

  // ─── Order Interface State ───
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuSearch, setMenuSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [orderNotes, setOrderNotes] = useState('');
  const [postingOrder, setPostingOrder] = useState(false);
  const [itemsLoading, setItemsLoading] = useState(false);

  // ─── Detail View State ───
  const [tableOrders, setTableOrders] = useState<TableOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [detailTab, setDetailTab] = useState('current');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  // ─── Dialog State ───
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<Table | null>(null);
  const [saving, setSaving] = useState(false);

  // Form fields for add/edit table
  const [formTableNumber, setFormTableNumber] = useState('');
  const [formName, setFormName] = useState('');
  const [formCapacity, setFormCapacity] = useState('4');
  const [formSection, setFormSection] = useState<string>('');
  const [formStatus, setFormStatus] = useState<string>('available');

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<Table | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Status change loading
  const [statusChangingId, setStatusChangingId] = useState<string | null>(null);

  // ─── Settle Bill Dialog State ───
  const [settleOpen, setSettleOpen] = useState(false);
  const [settleDiscount, setSettleDiscount] = useState(0);
  const [settlePaymentMethod, setSettlePaymentMethod] = useState('Cash');
  const [settleSubmitting, setSettleSubmitting] = useState(false);
  const [settleSuccess, setSettleSuccess] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);

  // ─── Transfer Table Dialog State ───
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferTargetId, setTransferTargetId] = useState('');
  const [transferSubmitting, setTransferSubmitting] = useState(false);

  // ─── Session Notes Dialog State ───
  const [sessionNotesOpen, setSessionNotesOpen] = useState(false);
  const [sessionNotesText, setSessionNotesText] = useState('');
  const [sessionNotesSubmitting, setSessionNotesSubmitting] = useState(false);

  // ─── Close Session Dialog ───
  const [closeSessionOpen, setCloseSessionOpen] = useState(false);
  const [closeSessionSubmitting, setCloseSessionSubmitting] = useState(false);

  // ─── Order Item Update Loading ───
  const [orderItemUpdating, setOrderItemUpdating] = useState<string | null>(null);

  const prevDataVersion = useRef(dataVersion);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [elapsedTick, setElapsedTick] = useState(0);

  // ─── Elapsed Timer ───
  useEffect(() => {
    const hasOccupied = Object.values(tableSessions).some(
      (s) => s.status === 'active'
    );
    if (hasOccupied) {
      if (!elapsedTimerRef.current) {
        elapsedTimerRef.current = setInterval(() => {
          setElapsedTick((t) => t + 1);
        }, 30000);
      }
    } else {
      if (elapsedTimerRef.current) {
        clearInterval(elapsedTimerRef.current);
        elapsedTimerRef.current = null;
      }
    }
    return () => {
      if (elapsedTimerRef.current) {
        clearInterval(elapsedTimerRef.current);
        elapsedTimerRef.current = null;
      }
    };
  }, [tableSessions]);

  /* ═══════════════════════════════════════════
     Data Fetching
     ═══════════════════════════════════════════ */

  const fetchTables = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (sectionFilter && sectionFilter !== 'All') {
        params.set('section', sectionFilter);
      }
      const res = await fetch(`/api/tables?${params.toString()}`, {
        headers: authHeaders,
      });
      if (res.ok) {
        const data = await res.json();
        setTables(Array.isArray(data) ? data : []);
      }
    } catch {
      notify({ type: 'error', title: 'Error', message: 'Failed to fetch tables' });
    }
  }, [token, sectionFilter, authHeaders]);

  const fetchActiveSessions = useCallback(async () => {
    try {
      const res = await fetch('/api/tables/sessions', {
        headers: authHeaders,
      });
      if (res.ok) {
        const data = await res.json();
        const sessions: Record<string, TableSession> = {};
        if (Array.isArray(data)) {
          data.forEach((s: TableSession) => {
            sessions[s.tableId] = s;
          });
        }
        setTableSessions(sessions);
      }
    } catch {
      // Silently fail — sessions are supplemental data
    }
  }, [authHeaders]);

  const loadAll = useCallback(
    async (silent?: boolean) => {
      if (!silent) setLoading(true);
      await Promise.all([fetchTables(), fetchActiveSessions()]);
      setLoading(false);
    },
    [fetchTables, fetchActiveSessions]
  );

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    fetchTables();
  }, [fetchTables]);

  useEffect(() => {
    if (dataVersion !== undefined && dataVersion !== prevDataVersion.current) {
      prevDataVersion.current = dataVersion;
      loadAll(true);
    }
  }, [dataVersion, loadAll]);

  // Periodically refresh sessions to keep elapsed time accurate
  useEffect(() => {
    const interval = setInterval(() => {
      fetchActiveSessions();
    }, 60000);
    return () => clearInterval(interval);
  }, [fetchActiveSessions]);

  // ─── Computed Stats ───
  const totalTables = tables.length;
  const availableCount = tables.filter((t) => t.status === 'available').length;
  const occupiedCount = tables.filter((t) => t.status === 'occupied').length;
  const reservedCount = tables.filter((t) => t.status === 'reserved').length;

  // ─── Menu Items Fetching ───
  const fetchMenuItems = useCallback(async () => {
    setItemsLoading(true);
    try {
      const [itemsRes, catsRes] = await Promise.all([
        fetch('/api/items', { headers: authHeaders }),
        fetch('/api/categories', { headers: authHeaders }),
      ]);
      if (itemsRes.ok) {
        const data = await itemsRes.json();
        setMenuItems(Array.isArray(data) ? data : []);
      }
      if (catsRes.ok) {
        const data = await catsRes.json();
        setCategories(Array.isArray(data) ? data : []);
      }
    } catch {
      notify({ type: 'error', title: 'Error', message: 'Failed to load menu items' });
    } finally {
      setItemsLoading(false);
    }
  }, [authHeaders]);

  // ─── Fetch Settings (for GST info in settle dialog) ───
  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/settings', { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        setSettings({ gstRate: data.gstRate ?? 0, enableGst: data.enableGst ?? false });
      }
    } catch {
      // ignore
    }
  }, [authHeaders]);

  // ─── Fetch Session & Orders for Detail View ───
  const fetchSession = useCallback(
    async (tableId: string, silent?: boolean) => {
      try {
        if (!silent) setOrdersLoading(true);
        const res = await fetch(`/api/tables/${tableId}/session`, {
          headers: authHeaders,
        });
        if (res.ok) {
          const data = await res.json();
          setActiveSession(data);
        }
      } catch {
        // ignore
      } finally {
        setOrdersLoading(false);
      }
    },
    [authHeaders]
  );

  const fetchOrders = useCallback(
    async (tableId: string, silent?: boolean) => {
      try {
        if (!silent) setOrdersLoading(true);
        const res = await fetch(`/api/tables/${tableId}/orders`, {
          headers: authHeaders,
        });
        if (res.ok) {
          const data = await res.json();
          setTableOrders(Array.isArray(data) ? data : []);
        }
      } catch {
        // ignore
      } finally {
        setOrdersLoading(false);
      }
    },
    [authHeaders]
  );

  /* ═══════════════════════════════════════════
     Table Click Handlers
     ═══════════════════════════════════════════ */

  // BUG 1 FIX: All table clicks now go to table-action panel first
  const handleTableClick = (table: Table) => {
    setSelectedTable(table);
    setSelectedStatusForAction(null);
    // Pre-fetch session data for display in the action panel
    fetchSession(table.id, true);
    fetchOrders(table.id, true);
    setActiveView('table-action');
  };

  const handleBackToGrid = () => {
    setActiveView('grid');
    setSelectedTable(null);
    setSelectedStatusForAction(null);
    setActiveSession(null);
    setTableOrders([]);
    setSelectedOrderId(null);
    setCartItems([]);
  };

  const handleBackToAction = () => {
    setActiveView('table-action');
    setSelectedStatusForAction(null);
  };

  const handleGoToOrder = () => {
    if (!selectedTable) return;
    // Note: Do NOT change status to 'occupied' here — the API handles it
    // when creating a session (POST /api/tables/[id]/orders marks table as occupied)
    setActiveView('order');
    setCartItems([]);
    setOrderNotes('');
    setMenuSearch('');
    setSelectedCategory('all');
    fetchMenuItems();
  };

  const handleGoToDetail = () => {
    if (!selectedTable) return;
    setActiveView('detail');
    setDetailTab('current');
    setSelectedOrderId(null);
    fetchSession(selectedTable.id);
    fetchOrders(selectedTable.id);
  };

  /* ═══════════════════════════════════════════
     Quick Status Change (used from action panel)
     ═══════════════════════════════════════════ */

  const handleQuickStatusChange = async (table: Table, newStatus: string) => {
    setStatusChangingId(table.id);
    try {
      const res = await fetch(`/api/tables/${table.id}`, {
        method: 'PUT',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        const updatedTable = await res.json();
        setTables((prev) => prev.map((t) => (t.id === table.id ? updatedTable : t)));
        // Update selectedTable if it matches
        setSelectedTable((prev) => (prev && prev.id === table.id ? updatedTable : prev));
        notify({ type: 'success', title: 'Status Changed', message: `Table #${table.tableNumber} is now ${newStatus}` });
        onRefreshData?.();
      } else {
        notify({ type: 'error', title: 'Error', message: 'Failed to change table status' });
      }
    } catch {
      notify({ type: 'error', title: 'Error', message: 'Failed to change table status' });
    } finally {
      setStatusChangingId(null);
    }
  };

  /* ═══════════════════════════════════════════
     Cart Management
     ═══════════════════════════════════════════ */

  const addMenuItem = useCallback((menuItem: MenuItem) => {
    setCartItems((prev) => {
      const existing = prev.find((item) => item.itemId === menuItem.id);
      if (existing) {
        return prev.map((item) =>
          item.itemId === menuItem.id
            ? { ...item, qty: item.qty + 1, total: (item.qty + 1) * item.rate }
            : item
        );
      }
      return [
        ...prev,
        {
          id: generateId(),
          itemId: menuItem.id,
          name: menuItem.name,
          qty: 1,
          rate: menuItem.price,
          total: menuItem.price,
          notes: '',
        },
      ];
    });
  }, []);

  const updateCartQty = useCallback((id: string, delta: number) => {
    setCartItems((prev) =>
      prev
        .map((item) => {
          if (item.id !== id) return item;
          const newQty = item.qty + delta;
          if (newQty <= 0) return null;
          return { ...item, qty: newQty, total: newQty * item.rate };
        })
        .filter(Boolean) as CartItem[]
    );
  }, []);

  const updateCartNotes = useCallback((id: string, notes: string) => {
    setCartItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, notes } : item))
    );
  }, []);

  const removeCartItem = useCallback((id: string) => {
    setCartItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const cartSubtotal = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.total, 0),
    [cartItems]
  );

  const cartCount = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.qty, 0),
    [cartItems]
  );

  /* ═══════════════════════════════════════════
     Post Order (BUG 3 FIX)
     ═══════════════════════════════════════════ */

  const handlePostOrder = async () => {
    if (!selectedTable || cartItems.length === 0) return;
    setPostingOrder(true);
    try {
      const body = {
        items: cartItems.map((item) => ({
          itemId: item.itemId,
          name: item.name,
          qty: item.qty,
          rate: item.rate,
          total: item.total,
          notes: item.notes || undefined,
        })),
        notes: orderNotes.trim() || undefined,
        // Session info for auto-creation if needed
        guestCount: 1,
        waiterName: currentUser?.name || '',
      };

      const res = await fetch(`/api/tables/${selectedTable.id}/orders`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        notify({
          type: 'success',
          title: 'Order Posted!',
          message: `Table #${selectedTable.tableNumber} order sent to kitchen`,
        });
        setCartItems([]);
        setOrderNotes('');
        // Refresh everything — BUG 3 FIX: refresh tables too (status may have changed)
        await Promise.all([
          fetchSession(selectedTable.id, true),
          fetchActiveSessions(),
          fetchTables(),
        ]);
        // Auto-navigate to detail view to see the posted order
        setActiveView('detail');
        setDetailTab('current');
        setSelectedOrderId(null);
        fetchSession(selectedTable.id);
        fetchOrders(selectedTable.id);
      } else {
        const errData = await res.json().catch(() => ({}));
        notify({
          type: 'error',
          title: 'Order Failed',
          message: errData.error || 'Failed to post order',
        });
      }
    } catch {
      notify({ type: 'error', title: 'Error', message: 'Connection error — please try again' });
    } finally {
      setPostingOrder(false);
    }
  };

  /* ═══════════════════════════════════════════
     Filtered Menu Items (BUG: Category Filtering Fix)
     ═══════════════════════════════════════════ */

  const filteredMenuItems = useMemo(() => {
    let items = menuItems;
    if (selectedCategory !== 'all') {
      items = items.filter((item) =>
        item.categoryId === selectedCategory ||
        item.category === selectedCategory ||
        item.categoryName === selectedCategory
      );
    }
    if (menuSearch.trim()) {
      const q = menuSearch.toLowerCase();
      items = items.filter((item) => item.name.toLowerCase().includes(q));
    }
    return items;
  }, [menuItems, selectedCategory, menuSearch]);

  const groupedMenuItems = useMemo(() => {
    const groups: Record<string, MenuItem[]> = {};
    filteredMenuItems.forEach((item) => {
      const key = item.categoryName || 'Uncategorized';
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredMenuItems]);

  /* ═══════════════════════════════════════════
     Order Item Handlers (BUG 4 FIX)
     ═══════════════════════════════════════════ */

  const handleUpdateOrderItemQty = async (orderId: string, itemId: string, newQty: number, rate: number) => {
    if (!selectedTable) return;
    setOrderItemUpdating(`${orderId}-${itemId}`);
    try {
      const res = await fetch(`/api/tables/${selectedTable.id}/orders/${orderId}`, {
        method: 'PUT',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{ id: itemId, qty: newQty }],
        }),
      });
      if (res.ok) {
        const updatedOrder = await res.json();
        // Update the order in our local state
        setTableOrders((prev) =>
          prev.map((o) => (o.id === orderId ? updatedOrder : o))
        );
        // Also refresh session for total recalculation
        fetchSession(selectedTable.id, true);
      } else {
        notify({ type: 'error', title: 'Error', message: 'Failed to update item quantity' });
      }
    } catch {
      notify({ type: 'error', title: 'Error', message: 'Connection error updating item' });
    } finally {
      setOrderItemUpdating(null);
    }
  };

  const handleUpdateOrderItemStatus = async (orderId: string, itemId: string, newStatus: string) => {
    if (!selectedTable) return;
    setOrderItemUpdating(`${orderId}-${itemId}`);
    try {
      const res = await fetch(`/api/tables/${selectedTable.id}/orders/${orderId}`, {
        method: 'PUT',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{ id: itemId, status: newStatus }],
        }),
      });
      if (res.ok) {
        const updatedOrder = await res.json();
        setTableOrders((prev) =>
          prev.map((o) => (o.id === orderId ? updatedOrder : o))
        );
      } else {
        notify({ type: 'error', title: 'Error', message: 'Failed to update item status' });
      }
    } catch {
      notify({ type: 'error', title: 'Error', message: 'Connection error updating item' });
    } finally {
      setOrderItemUpdating(null);
    }
  };

  /* ═══════════════════════════════════════════
     Settle Bill
     ═══════════════════════════════════════════ */

  const handleOpenSettle = () => {
    setSettleDiscount(0);
    setSettlePaymentMethod('Cash');
    setSettleSuccess(false);
    fetchSettings();
    setSettleOpen(true);
  };

  const settleCalculations = useMemo(() => {
    const allItems = tableOrders.flatMap((o) => o.items || []);
    const subtotal = allItems.reduce((sum, item) => sum + (item.total ?? item.qty * item.rate), 0);
    const gstRate = settings?.gstRate ?? 0;
    const enableGst = settings?.enableGst ?? false;
    const gstAmount = enableGst ? (subtotal * gstRate) / 100 : 0;
    const discountAmount = Math.min(Math.max(settleDiscount, 0), subtotal + gstAmount);
    const grandTotal = Math.max(subtotal + gstAmount - discountAmount, 0);
    return { subtotal, gstRate, enableGst, gstAmount, discountAmount, grandTotal };
  }, [tableOrders, settings, settleDiscount]);

  const handleSettle = async () => {
    if (!selectedTable) return;
    setSettleSubmitting(true);
    try {
      const body = {
        discount: settleCalculations.discountAmount,
        gstAmount: settleCalculations.gstAmount,
        subtotal: settleCalculations.subtotal,
        grandTotal: settleCalculations.grandTotal,
        paymentMethod: settlePaymentMethod,
      };

      const res = await fetch(`/api/tables/${selectedTable.id}/settle`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setSettleSuccess(true);
        notify({
          type: 'success',
          title: 'Payment Complete',
          message: `Table #${selectedTable.tableNumber} bill settled — ${formatCurrency(settleCalculations.grandTotal)}`,
        });
        setTimeout(() => {
          fetchTables();
          fetchActiveSessions();
          setSettleOpen(false);
          handleBackToGrid();
          onRefreshData?.();
        }, 1500);
      } else {
        const errData = await res.json().catch(() => ({}));
        notify({
          type: 'error',
          title: 'Error',
          message: errData.error || 'Failed to settle bill',
        });
      }
    } catch {
      notify({ type: 'error', title: 'Error', message: 'Failed to settle bill — Connection error' });
    } finally {
      setSettleSubmitting(false);
    }
  };

  /* ═══════════════════════════════════════════
     Transfer Table
     ═══════════════════════════════════════════ */

  const handleOpenTransfer = () => {
    setTransferTargetId('');
    setTransferOpen(true);
  };

  const handleTransfer = async () => {
    if (!selectedTable || !transferTargetId) {
      notify({ type: 'error', title: 'Error', message: 'Please select a target table' });
      return;
    }
    setTransferSubmitting(true);
    try {
      const res = await fetch(`/api/tables/${selectedTable.id}/transfer`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetTableId: transferTargetId }),
      });

      if (res.ok) {
        notify({
          type: 'success',
          title: 'Transfer Complete',
          message: `Order transferred from Table #${selectedTable.tableNumber}`,
        });
        setTransferOpen(false);
        await Promise.all([fetchTables(), fetchActiveSessions()]);
        handleBackToGrid();
        onRefreshData?.();
      } else {
        const errData = await res.json().catch(() => ({}));
        notify({
          type: 'error',
          title: 'Error',
          message: errData.error || 'Failed to transfer table',
        });
      }
    } catch {
      notify({ type: 'error', title: 'Error', message: 'Failed to transfer table' });
    } finally {
      setTransferSubmitting(false);
    }
  };

  /* ═══════════════════════════════════════════
     Session Notes
     ═══════════════════════════════════════════ */

  const handleOpenSessionNotes = () => {
    setSessionNotesText(activeSession?.notes || '');
    setSessionNotesOpen(true);
  };

  const handleSaveSessionNotes = async () => {
    if (!selectedTable) return;
    setSessionNotesSubmitting(true);
    try {
      const res = await fetch(`/api/tables/${selectedTable.id}/session`, {
        method: 'PUT',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: sessionNotesText.trim() }),
      });
      if (res.ok) {
        notify({ type: 'success', title: 'Notes Saved', message: 'Session notes updated' });
        setSessionNotesOpen(false);
        fetchSession(selectedTable.id, true);
      }
    } catch {
      notify({ type: 'error', title: 'Error', message: 'Failed to save notes' });
    } finally {
      setSessionNotesSubmitting(false);
    }
  };

  /* ═══════════════════════════════════════════
     Close Session (without settling)
     ═══════════════════════════════════════════ */

  const handleCloseSession = async () => {
    if (!selectedTable) return;
    setCloseSessionSubmitting(true);
    try {
      const res = await fetch(`/api/tables/${selectedTable.id}/session`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      if (res.ok) {
        notify({ type: 'success', title: 'Session Closed', message: `Table #${selectedTable.tableNumber} session closed` });
        setCloseSessionOpen(false);
        await Promise.all([fetchTables(), fetchActiveSessions()]);
        handleBackToGrid();
        onRefreshData?.();
      } else {
        const errData = await res.json().catch(() => ({}));
        notify({ type: 'error', title: 'Error', message: errData.error || 'Failed to close session' });
      }
    } catch {
      notify({ type: 'error', title: 'Error', message: 'Failed to close session' });
    } finally {
      setCloseSessionSubmitting(false);
    }
  };

  /* ═══════════════════════════════════════════
     Table CRUD (Add/Edit/Delete)
     ═══════════════════════════════════════════ */

  const openAddDialog = () => {
    setEditingTable(null);
    setFormTableNumber('');
    setFormName('');
    setFormCapacity('4');
    setFormSection('');
    setFormStatus('available');
    setDialogOpen(true);
  };

  const openEditDialog = (table: Table, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingTable(table);
    setFormTableNumber(String(table.tableNumber));
    setFormName(table.name || '');
    setFormCapacity(String(table.capacity));
    setFormSection(table.section || '');
    setFormStatus(table.status || 'available');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const tableNumber = parseInt(formTableNumber, 10);
    if (!tableNumber || tableNumber <= 0) {
      notify({ type: 'error', title: 'Validation Error', message: 'Table number must be a positive number' });
      return;
    }

    const capacity = parseInt(formCapacity, 10);
    if (!capacity || capacity < 1 || capacity > 50) {
      notify({ type: 'error', title: 'Validation Error', message: 'Capacity must be between 1 and 50' });
      return;
    }

    setSaving(true);
    try {
      const body = {
        tableNumber,
        name: formName.trim(),
        capacity,
        section: formSection.trim(),
        status: formStatus,
      };

      const url = editingTable ? `/api/tables/${editingTable.id}` : '/api/tables';
      const method = editingTable ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        notify({
          type: 'success',
          title: editingTable ? 'Table Updated' : 'Table Created',
          message: editingTable
            ? `Table #${tableNumber} updated successfully`
            : `Table #${tableNumber} created successfully`,
        });
        setDialogOpen(false);
        await fetchTables();
        onRefreshData?.();
      } else {
        const errData = await res.json().catch(() => ({}));
        notify({
          type: 'error',
          title: 'Error',
          message: `Failed to save table — ${errData.error || `Server error (${res.status})`}`,
        });
      }
    } catch {
      notify({ type: 'error', title: 'Error', message: 'Failed to save table — Connection error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/tables/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      if (res.ok) {
        notify({ type: 'success', title: 'Table Deleted', message: `Table #${deleteTarget.tableNumber} has been deleted` });
        setDeleteTarget(null);
        await fetchTables();
        onRefreshData?.();
      } else {
        const errData = await res.json().catch(() => ({}));
        notify({ type: 'error', title: 'Error', message: `Failed to delete table — ${errData.error || 'Server error'}` });
      }
    } catch {
      notify({ type: 'error', title: 'Error', message: 'Failed to delete table — Connection error' });
    } finally {
      setDeleting(false);
    }
  };

  const handleStatusSelect = async (table: Table, status: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setStatusChangingId(table.id);
    try {
      const res = await fetch(`/api/tables/${table.id}`, {
        method: 'PUT',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        const updatedTable = await res.json();
        setTables((prev) => prev.map((t) => (t.id === table.id ? updatedTable : t)));
        setSelectedTable((prev) => (prev && prev.id === table.id ? updatedTable : prev));
        notify({ type: 'success', title: 'Status Changed', message: `Table #${table.tableNumber} is now ${status}` });
        onRefreshData?.();
      } else {
        notify({ type: 'error', title: 'Error', message: 'Failed to change table status' });
      }
    } catch {
      notify({ type: 'error', title: 'Error', message: 'Failed to change table status' });
    } finally {
      setStatusChangingId(null);
    }
  };

  // ─── Available tables for transfer (exclude occupied/reserved) ───
  const transferableTables = useMemo(
    () => tables.filter((t) => t.status === 'available' && (!selectedTable || t.id !== selectedTable.id)),
    [tables, selectedTable]
  );

  /* ═══════════════════════════════════════════
     Print Functions
     ═══════════════════════════════════════════ */

  const handlePrintKOT = () => {
    if (!selectedTable || tableOrders.length === 0) return;
    const tableLabel = selectedTable.name || `Table #${selectedTable.tableNumber}`;
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    let itemsHtml = '';
    tableOrders.forEach((order) => {
      if (order.status === 'cancelled') return;
      const orderItems = order.items || [];
      orderItems.forEach((item, idx) => {
        const bg = idx % 2 === 0 ? '' : ' style="background:#f9fafb;"';
        itemsHtml += `<tr${bg}>
          <td style="padding:6px 12px;font-size:12px;border-bottom:1px solid #eee;">${esc(item.name)}</td>
          <td style="padding:6px 12px;font-size:12px;text-align:center;border-bottom:1px solid #eee;">${item.qty}</td>
          <td style="padding:6px 12px;font-size:12px;border-bottom:1px solid #eee;">${esc(item.notes || '')}</td>
        </tr>`;
      });
    });

    const html = `<!DOCTYPE html><html><head><title>KOT - ${tableLabel}</title>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 20px; color: #1a1a1a; }
        .container { max-width: 350px; margin: 0 auto; border: 2px dashed #16a34a; border-radius: 8px; overflow: hidden; }
        .header { background: #16a34a; color: white; padding: 16px 20px; text-align: center; }
        .header h2 { margin: 0; font-size: 18px; }
        .header p { margin: 4px 0 0; font-size: 12px; opacity: 0.9; }
        .info { padding: 12px 20px; font-size: 12px; border-bottom: 1px solid #eee; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #f3f4f6; padding: 8px 12px; font-size: 10px; text-transform: uppercase; letter-spacing: .5px; text-align: left; border-bottom: 2px solid #e5e7eb; }
        .footer { padding: 12px 20px; text-align: center; font-size: 10px; color: #9ca3af; border-top: 1px dashed #d1d5db; }
      </style>
    </head><body>
      <div class="container">
        <div class="header">
          <h2>KITCHEN ORDER TICKET</h2>
          <p>${esc(tableLabel)} | ${formatDate(new Date().toISOString())} ${formatTime(new Date().toISOString())}</p>
        </div>
        <div class="info">
          <strong>Waiter:</strong> ${activeSession?.waiterName || currentUser?.name || '—'} &nbsp;|&nbsp;
          <strong>Guests:</strong> ${activeSession?.guestCount || '—'}
        </div>
        <table>
          <thead><tr><th>Item</th><th>Qty</th><th>Notes</th></tr></thead>
          <tbody>${itemsHtml}</tbody>
        </table>
        <div class="footer">KOT #${Date.now().toString().slice(-6)} | Printed: ${new Date().toLocaleTimeString('en-IN')}</div>
      </div>
    </body></html>`;

    const w = window.open('', '_blank', 'width=400,height=700');
    if (!w) {
      notify({ type: 'error', title: 'Error', message: 'Allow popups to print' });
      return;
    }
    w.document.write(html);
    w.document.close();
    setTimeout(() => { try { if (!w.closed) w.print(); } catch { /* closed */ } }, 500);
  };

  const handlePrintOrderSlip = () => {
    if (!selectedTable || tableOrders.length === 0) return;
    const tableLabel = selectedTable.name || `Table #${selectedTable.tableNumber}`;
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    let ordersHtml = '';
    tableOrders.forEach((order) => {
      const orderItems = order.items || [];
      ordersHtml += `<div style="margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;padding:6px 12px;background:#f0fdf4;border-radius:4px;font-size:11px;">
          <span style="font-weight:600;">Order #${order.orderNumber}</span>
          <span>${formatTime(order.createdAt)}</span>
        </div>`;
      orderItems.forEach((item) => {
        ordersHtml += `<div style="display:flex;justify-content:space-between;padding:4px 12px;font-size:12px;border-bottom:1px solid #f3f4f6;">
          <span>${esc(item.name)} × ${item.qty}</span>
          <span style="font-weight:600;">${formatCurrency(item.total)}</span>
        </div>`;
      });
      ordersHtml += '</div>';
    });

    const allItems = tableOrders.flatMap((o) => o.items || []);
    const subtotal = allItems.reduce((s, i) => s + (i.total ?? i.qty * i.rate), 0);

    const html = `<!DOCTYPE html><html><head><title>Order Slip - ${tableLabel}</title>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 20px; color: #1a1a1a; }
        .container { max-width: 350px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; }
        .header { background: linear-gradient(135deg, #16a34a, #15803d); color: white; padding: 16px 20px; }
        .header h2 { margin: 0; font-size: 16px; }
        .header p { margin: 4px 0 0; font-size: 11px; opacity: 0.9; }
        .body { padding: 12px 16px; }
        .total { padding: 12px 16px; background: #f9fafb; border-top: 2px solid #16a34a; text-align: right; }
        .total .amount { font-size: 20px; font-weight: 700; color: #16a34a; }
        .footer { padding: 12px 16px; text-align: center; font-size: 10px; color: #9ca3af; }
      </style>
    </head><body>
      <div class="container">
        <div class="header">
          <h2>ORDER SLIP</h2>
          <p>${esc(tableLabel)} | ${formatDate(new Date().toISOString())}</p>
        </div>
        <div class="body">
          <div style="font-size:11px;color:#6b7280;margin-bottom:8px;">
            Waiter: ${activeSession?.waiterName || currentUser?.name || '—'} | Guests: ${activeSession?.guestCount || '—'} | Opened: ${activeSession ? formatTime(activeSession.openedAt) : '—'}
          </div>
          ${ordersHtml}
        </div>
        <div class="total">
          <div style="font-size:12px;color:#6b7280;">Running Total</div>
          <div class="amount">${formatCurrency(subtotal)}</div>
        </div>
        <div class="footer">Generated at ${new Date().toLocaleTimeString('en-IN')}</div>
      </div>
    </body></html>`;

    const w = window.open('', '_blank', 'width=400,height=700');
    if (!w) {
      notify({ type: 'error', title: 'Error', message: 'Allow popups to print' });
      return;
    }
    w.document.write(html);
    w.document.close();
    setTimeout(() => { try { if (!w.closed) w.print(); } catch { /* closed */ } }, 500);
  };

  /* ═══════════════════════════════════════════
     Status Indicator Component
     ═══════════════════════════════════════════ */

  const StatusIndicator = ({ status, clickable, table }: { status: string; clickable: boolean; table: Table }) => {
    const config = STATUS_CONFIG[status as TableStatus] || STATUS_CONFIG.available;
    const pulse = shouldPulse(status);

    if (clickable && canEdit) {
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors hover:opacity-80 ${config.bg} ${config.color} border`}
              disabled={statusChangingId === table.id}
              onClick={(e) => e.stopPropagation()}
            >
              <span className="relative flex h-2 w-2">
                <span
                  className={`absolute inline-flex h-full w-full rounded-full ${config.dot} ${pulse ? 'animate-ping opacity-75' : 'opacity-0'}`}
                />
                <span className={`relative inline-flex h-2 w-2 rounded-full ${config.dot}`} />
              </span>
              {statusChangingId === table.id ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <>
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                  <ChevronDown className="h-3 w-3" />
                </>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {STATUSES.map((s) => (
              <DropdownMenuItem
                key={s.value}
                onClick={(e) => handleStatusSelect(table, s.value, e)}
                className={s.value === status ? 'font-semibold' : ''}
              >
                <span className={`mr-2 inline-block h-2 w-2 rounded-full ${STATUS_CONFIG[s.value].dot}`} />
                {s.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    }

    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${config.bg} ${config.color} border`}>
        <span className="relative flex h-2 w-2">
          <span className={`absolute inline-flex h-full w-full rounded-full ${config.dot} ${pulse ? 'animate-ping opacity-75' : 'opacity-0'}`} />
          <span className={`relative inline-flex h-2 w-2 rounded-full ${config.dot}`} />
        </span>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  /* ═══════════════════════════════════════════
     Reusable Dialog Renderers
     ═══════════════════════════════════════════ */

  const renderSettleDialog = () => {
    if (!selectedTable) return null;
    const tableLabel = selectedTable.name || `Table #${selectedTable.tableNumber}`;
    return (
      <Dialog open={settleOpen} onOpenChange={setSettleOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-emerald-600" />
              Settle Bill — {tableLabel}
            </DialogTitle>
            <DialogDescription>Review the order summary and complete the payment</DialogDescription>
          </DialogHeader>

          {settleSuccess ? (
            <div className="flex flex-col items-center justify-center py-8">
              <PartyPopper className="h-12 w-12 text-emerald-500 mb-3" />
              <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">Payment Successful!</p>
              <p className="text-sm text-muted-foreground mt-1">Session will be closed automatically.</p>
            </div>
          ) : (
            <>
              <div className="space-y-3 py-2">
                <div className="max-h-48 overflow-y-auto rounded-lg border">
                  <table className="w-full">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-3 py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase">Item</th>
                        <th className="px-3 py-2 text-center text-[10px] font-semibold text-muted-foreground uppercase">Qty</th>
                        <th className="px-3 py-2 text-right text-[10px] font-semibold text-muted-foreground uppercase">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tableOrders.map((order) =>
                        order.items.map((item, idx) => (
                          <tr key={`${order.id}-${item.id}-${idx}`} className="border-t last:border-b-0">
                            <td className="px-3 py-2 text-xs">{item.name}</td>
                            <td className="px-3 py-2 text-xs text-center">{item.qty}</td>
                            <td className="px-3 py-2 text-xs text-right font-medium tabular-nums">{formatCurrency(item.total)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <Separator />

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-medium tabular-nums">{formatCurrency(settleCalculations.subtotal)}</span>
                  </div>
                  {settleCalculations.enableGst && settleCalculations.gstAmount > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">GST ({settleCalculations.gstRate}%)</span>
                      <span className="font-medium tabular-nums">{formatCurrency(settleCalculations.gstAmount)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-sm gap-2">
                    <Label className="text-muted-foreground whitespace-nowrap">Discount</Label>
                    <div className="flex items-center gap-1.5 w-36">
                      <span className="text-muted-foreground">₹</span>
                      <Input
                        type="number"
                        min={0}
                        step={1}
                        value={settleDiscount || ''}
                        onChange={(e) => setSettleDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                        className="h-8 text-sm text-right tabular-nums"
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between text-lg font-bold">
                    <span>Grand Total</span>
                    <span className="text-emerald-600 dark:text-emerald-400 tabular-nums">{formatCurrency(settleCalculations.grandTotal)}</span>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Payment Method</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {PAYMENT_METHODS.map((pm) => {
                      const Icon = pm.icon;
                      return (
                        <button
                          key={pm.value}
                          type="button"
                          onClick={() => setSettlePaymentMethod(pm.value)}
                          className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${
                            settlePaymentMethod === pm.value
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-700 dark:text-emerald-400'
                              : 'border-border hover:bg-muted/50 text-muted-foreground'
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                          {pm.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <DialogFooter className="gap-2 pt-2">
                <Button variant="outline" onClick={() => setSettleOpen(false)} disabled={settleSubmitting}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSettle}
                  disabled={settleSubmitting}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 font-semibold"
                >
                  {settleSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  Complete Payment — {formatCurrency(settleCalculations.grandTotal)}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    );
  };

  const renderTransferDialog = () => {
    if (!selectedTable) return null;
    const tableLabel = selectedTable.name || `Table #${selectedTable.tableNumber}`;
    return (
      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5 text-amber-600" />
              Transfer Table
            </DialogTitle>
            <DialogDescription>
              Move the order from {tableLabel} to another available table
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Label className="text-sm font-medium">Target Table</Label>
            <Select value={transferTargetId} onValueChange={setTransferTargetId}>
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder="Select available table" />
              </SelectTrigger>
              <SelectContent>
                {transferableTables.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">#{t.tableNumber}</span>
                      {t.name && <span className="text-muted-foreground">({t.name})</span>}
                      <span className="text-muted-foreground">· {t.capacity} seats</span>
                      {t.section && <span className="text-muted-foreground">· {t.section}</span>}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {transferableTables.length === 0 && (
              <p className="text-sm text-muted-foreground mt-2">No available tables to transfer to.</p>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setTransferOpen(false)} disabled={transferSubmitting}>
              Cancel
            </Button>
            <Button
              onClick={handleTransfer}
              disabled={transferSubmitting || !transferTargetId}
              className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5"
            >
              {transferSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Transfer Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  const renderSessionNotesDialog = () => (
    <Dialog open={sessionNotesOpen} onOpenChange={setSessionNotesOpen}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <StickyNote className="h-5 w-5 text-teal-600" />
            Session Notes
          </DialogTitle>
          <DialogDescription>Add or update notes for this table session</DialogDescription>
        </DialogHeader>
        <div className="py-2">
          <Textarea
            placeholder="Enter notes..."
            value={sessionNotesText}
            onChange={(e) => setSessionNotesText(e.target.value)}
            className="min-h-[100px]"
          />
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setSessionNotesOpen(false)} disabled={sessionNotesSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSaveSessionNotes}
            disabled={sessionNotesSubmitting}
            className="bg-teal-600 hover:bg-teal-700 text-white gap-1.5"
          >
            {sessionNotesSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Save Notes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  const renderCloseSessionDialog = () => {
    if (!selectedTable) return null;
    const tableLabel = selectedTable.name || `Table #${selectedTable.tableNumber}`;
    return (
      <AlertDialog open={closeSessionOpen} onOpenChange={setCloseSessionOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              Close Session — {tableLabel}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will close the active session for this table without settling the bill. The table will be marked as available.
              Any unpaid orders will remain in the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={closeSessionSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCloseSession}
              disabled={closeSessionSubmitting}
              className="bg-orange-600 hover:bg-orange-700 text-white gap-1.5"
            >
              {closeSessionSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Close Session
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  };

  const renderDeleteDialog = () => (
    <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Table #{deleteTarget?.tableNumber}?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. The table and its configuration will be permanently removed.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={deleting}
            className="bg-rose-600 hover:bg-rose-700 text-white gap-1.5"
          >
            {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  /* ═══════════════════════════════════════════
     Reusable Add/Edit Dialog
     ═══════════════════════════════════════════ */

  const renderTableFormDialog = (idPrefix: string) => (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {editingTable ? (
              <><Pencil className="h-5 w-5 text-emerald-600" /> Edit Table #{editingTable.tableNumber}</>
            ) : (
              <><Plus className="h-5 w-5 text-emerald-600" /> Add New Table</>
            )}
          </DialogTitle>
          <DialogDescription>
            {editingTable ? 'Update the details for this table' : 'Fill in the details to create a new restaurant table'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor={`${idPrefix}-tableNumber`} className="flex items-center gap-1.5">
              Table Number <span className="text-rose-500">*</span>
            </Label>
            <Input id={`${idPrefix}-tableNumber`} type="number" min={1} placeholder="e.g. 1" value={formTableNumber} onChange={(e) => setFormTableNumber(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`${idPrefix}-tableName`}>Table Name (Optional)</Label>
            <Input id={`${idPrefix}-tableName`} type="text" placeholder="e.g. Window Seat, Corner Table" value={formName} onChange={(e) => setFormName(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`${idPrefix}-capacity`} className="flex items-center gap-1.5">
              Capacity <span className="text-rose-500">*</span>
            </Label>
            <div className="flex items-center gap-2">
              <Input id={`${idPrefix}-capacity`} type="number" min={1} max={50} placeholder="4" value={formCapacity} onChange={(e) => setFormCapacity(e.target.value)} className="w-32" />
              <span className="text-sm text-muted-foreground">seats (1–50)</span>
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`${idPrefix}-section`}>Section</Label>
            <Select value={formSection} onValueChange={setFormSection}>
              <SelectTrigger id={`${idPrefix}-section`}><SelectValue placeholder="Select section" /></SelectTrigger>
              <SelectContent>
                {SECTION_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`${idPrefix}-status`}>Status</Label>
            <Select value={formStatus} onValueChange={setFormStatus}>
              <SelectTrigger id={`${idPrefix}-status`}><SelectValue placeholder="Select status" /></SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    <div className="flex items-center gap-2">
                      <span className={`inline-block h-2 w-2 rounded-full ${STATUS_CONFIG[s.value].dot}`} />
                      {s.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter className="gap-2 pt-2">
          <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !formTableNumber || !formCapacity} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {editingTable ? 'Update Table' : 'Create Table'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  /* ═══════════════════════════════════════════
     Loading Skeleton
     ═══════════════════════════════════════════ */

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 p-5 md:p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-8 w-56 bg-white/20" />
              <Skeleton className="h-4 w-80 bg-white/15" />
            </div>
            <Skeleton className="h-10 w-32 bg-white/20" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <div className="flex gap-3">
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════
     RENDER: VIEW 0 - Table Action Panel (BUG 1 FIX)
     ═══════════════════════════════════════════ */

  if (activeView === 'table-action' && selectedTable) {
    const tableLabel = selectedTable.name || `Table #${selectedTable.tableNumber}`;
    const currentStatus = selectedTable.status as TableStatus;
    const statusConfig = STATUS_CONFIG[currentStatus] || STATUS_CONFIG.available;
    const session = activeSession || tableSessions[selectedTable.id];
    const elapsed = session?.openedAt ? formatElapsedTime(session.openedAt) : null;
    const orderCount = tableOrders.length;

    return (
      <>
        <div className="space-y-4 mb-6">
          <Button variant="ghost" size="sm" onClick={handleBackToGrid} className="gap-2">
            <ArrowLeft className="size-4" />
            Back to Tables
          </Button>
        </div>

        <div className="max-w-lg mx-auto">
          <Card className="border-0 shadow-lg overflow-hidden">
            <div className={`h-2 ${statusConfig.dot.replace('bg-', 'bg-').replace('-500', '-500')} bg-gradient-to-r ${
              currentStatus === 'occupied' ? 'from-rose-500 via-rose-400 to-amber-400' :
              currentStatus === 'reserved' ? 'from-amber-500 via-yellow-400 to-amber-300' :
              currentStatus === 'cleaning' ? 'from-teal-500 via-teal-400 to-cyan-400' :
              'from-emerald-500 via-emerald-400 to-teal-400'
            }`} />
            <CardContent className="p-6">
              {/* Table Header */}
              <div className="text-center mb-6">
                <div className={`w-16 h-16 rounded-full ${statusConfig.bg} flex items-center justify-center mx-auto mb-3`}>
                  <UtensilsCrossed className={`w-8 h-8 ${statusConfig.color}`} />
                </div>
                <h3 className="text-xl font-bold">{tableLabel}</h3>
                <Badge className={`${statusConfig.bg} ${statusConfig.color} border mt-2 text-xs`}>
                  <span className={`mr-1.5 inline-block h-2 w-2 rounded-full ${statusConfig.dot}`} />
                  {currentStatus.charAt(0).toUpperCase() + currentStatus.slice(1)}
                </Badge>
              </div>

              {/* Table Info Grid */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Seats</p>
                  <p className="text-sm font-bold mt-0.5 flex items-center gap-1">
                    <Users className="h-3.5 w-3.5 text-muted-foreground" />
                    {selectedTable.capacity}
                  </p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Section</p>
                  <p className="text-sm font-bold mt-0.5">
                    {selectedTable.section || '—'}
                  </p>
                </div>
                {session && elapsed && (
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Elapsed</p>
                    <p className="text-sm font-bold mt-0.5 flex items-center gap-1">
                      <Timer className="h-3.5 w-3.5 text-rose-500" />
                      <span className="text-rose-600 dark:text-rose-400">{elapsed}</span>
                    </p>
                  </div>
                )}
                {session && (
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Running Total</p>
                    <p className="text-sm font-bold mt-0.5 text-rose-600 dark:text-rose-400">
                      {formatCurrency(session.totalAmount)}
                    </p>
                  </div>
                )}
              </div>

              {/* STATUS SELECTION — User MUST select first */}
              <div className="mb-6">
                <Label className="text-sm font-medium mb-2 block">Select Action Status</Label>
                <Select
                  value={selectedStatusForAction || ''}
                  onValueChange={(val) => {
                    setSelectedStatusForAction(val);
                    // Auto-update table status for reserved/cleaning (not for occupied — API handles that when posting order)
                    if (selectedTable && val !== selectedTable.status && (val === 'reserved' || val === 'cleaning')) {
                      handleQuickStatusChange(selectedTable, val);
                    }
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choose what you want to do..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">
                      <div className="flex items-center gap-2">
                        <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
                        <span>Start New Order</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="occupied">
                      <div className="flex items-center gap-2">
                        <span className="inline-block h-2.5 w-2.5 rounded-full bg-rose-500" />
                        <span>View / Manage Session</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="reserved">
                      <div className="flex items-center gap-2">
                        <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-500" />
                        <span>Mark as Reserved</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="cleaning">
                      <div className="flex items-center gap-2">
                        <span className="inline-block h-2.5 w-2.5 rounded-full bg-teal-500" />
                        <span>Mark Cleaning Done</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Action buttons — only shown AFTER status selected */}
              {selectedStatusForAction && (
                <div className="space-y-3">
                  {selectedStatusForAction === 'available' && (
                    <Button
                      onClick={handleGoToOrder}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-2 font-semibold h-11"
                    >
                      <ShoppingCart className="h-4 w-4" />
                      Start Order
                    </Button>
                  )}
                  {selectedStatusForAction === 'reserved' && (
                    <>
                      <Button
                        onClick={handleGoToOrder}
                        className="w-full bg-amber-600 hover:bg-amber-700 text-white gap-2 font-semibold h-11"
                      >
                        <ShoppingCart className="h-4 w-4" />
                        Start Order (Override Reserved)
                      </Button>
                    </>
                  )}
                  {selectedStatusForAction === 'occupied' && (
                    <>
                      <Button
                        onClick={handleGoToDetail}
                        className="w-full bg-rose-600 hover:bg-rose-700 text-white gap-2 font-semibold h-11"
                      >
                        <Eye className="h-4 w-4" />
                        View Session
                      </Button>
                      <Button
                        onClick={handleGoToOrder}
                        variant="outline"
                        className="w-full gap-2 font-semibold h-11"
                      >
                        <Plus className="h-4 w-4" />
                        Add More Items
                      </Button>
                      <Button
                        onClick={handleOpenSettle}
                        variant="outline"
                        className="w-full gap-2 font-semibold h-11"
                      >
                        <CreditCard className="h-4 w-4" />
                        Settle Bill
                      </Button>
                    </>
                  )}
                  {selectedStatusForAction === 'cleaning' && (
                    <Button
                      onClick={() => handleQuickStatusChange(selectedTable, 'available')}
                      className="w-full bg-teal-600 hover:bg-teal-700 text-white gap-2 font-semibold h-11"
                      disabled={statusChangingId === selectedTable.id}
                    >
                      {statusChangingId === selectedTable.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                      Mark as Available
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    className="w-full gap-2"
                    onClick={handleBackToGrid}
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Tables
                  </Button>
                </div>
              )}

              {/* If no status selected yet, show back button only */}
              {!selectedStatusForAction && (
                <Button
                  variant="ghost"
                  className="w-full gap-2 mt-2"
                  onClick={handleBackToGrid}
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to Tables
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Settle Bill Dialog (accessible from action panel) */}
        {renderSettleDialog()}
      </>
    );
  }

  /* ═══════════════════════════════════════════
     RENDER: VIEW 1 - Table Grid
     ═══════════════════════════════════════════ */

  if (activeView === 'grid') {
    return (
      <>
        {/* Gradient Header Banner */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 p-5 md:p-6 text-white shadow-lg shadow-emerald-600/20 mb-6">
          <div className="pointer-events-none absolute -right-8 -top-8 size-36 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute -bottom-6 -left-6 size-28 rounded-full bg-white/5" />
          <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl md:text-2xl font-bold tracking-tight flex items-center gap-2">
                <UtensilsCrossed className="size-6" />
                Table Management
              </h2>
              <p className="text-emerald-100 text-sm mt-1">
                Organize tables, manage orders &amp; sessions
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-white/20 text-white border-white/30 text-xs">
                {totalTables} tables
              </Badge>
              <Button
                onClick={openAddDialog}
                className="bg-white text-emerald-700 hover:bg-white/90 gap-1.5 shadow-sm font-semibold"
                disabled={!canCreate}
              >
                <Plus className="h-4 w-4" />
                Add Table
              </Button>
            </div>
          </div>
        </div>

        {/* Summary Stats Bar */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 mb-6">
          <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Tables</p>
                  <p className="text-2xl font-bold mt-1">{totalTables}</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                  <Armchair className="h-5 w-5 text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Available</p>
                  <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{availableCount}</p>
                </div>
                <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100">
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                  Free
                </Badge>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Occupied</p>
                  <p className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">{occupiedCount}</p>
                </div>
                <Badge className="bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 border-rose-200 dark:border-rose-800 hover:bg-rose-100">
                  <XCircle className="h-3.5 w-3.5 mr-1" />
                  Busy
                </Badge>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Reserved</p>
                  <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">{reservedCount}</p>
                </div>
                <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800 hover:bg-amber-100">
                  <Clock className="h-3.5 w-3.5 mr-1" />
                  Booked
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* View Toggle & Section Filter */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center rounded-lg border bg-muted/50 p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  viewMode === 'grid' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
                aria-label="Grid view"
              >
                <LayoutGrid className="h-4 w-4 mr-1.5" />
                Grid
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  viewMode === 'list' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
                aria-label="List view"
              >
                <List className="h-4 w-4 mr-1.5" />
                List
              </button>
            </div>
            <Select value={sectionFilter} onValueChange={setSectionFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Section" />
              </SelectTrigger>
              <SelectContent>
                {SECTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s === 'All' ? 'All Sections' : s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-sm text-muted-foreground">
            Showing <span className="font-semibold text-foreground">{tables.length}</span> table{tables.length !== 1 ? 's' : ''}
            {sectionFilter !== 'All' && (
              <> in <span className="font-semibold text-foreground">{sectionFilter}</span></>
            )}
          </p>
        </div>

        {/* Empty State */}
        {tables.length === 0 && (
          <Card className="border-0 shadow-sm">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mb-4">
                <UtensilsCrossed className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground">No tables found</p>
              <p className="text-sm text-muted-foreground mt-1">
                {sectionFilter !== 'All'
                  ? `No tables in the "${sectionFilter}" section`
                  : 'Click "Add Table" to create your first restaurant table'}
              </p>
              {canCreate && sectionFilter === 'All' && (
                <Button onClick={openAddDialog} className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5">
                  <Plus className="h-4 w-4" />
                  Add Table
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Grid View */}
        {tables.length > 0 && viewMode === 'grid' && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {tables.map((table) => {
              const session = tableSessions[table.id];
              const isOccupied = table.status === 'occupied';

              return (
                <Card
                  key={table.id}
                  className="border-0 shadow-sm transition-all duration-200 group hover:shadow-md hover:-translate-y-0.5 cursor-pointer"
                  onClick={() => handleTableClick(table)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white text-xl font-bold shadow-sm shadow-emerald-600/20">
                        {table.tableNumber}
                      </div>
                      <StatusIndicator status={table.status} clickable={true} table={table} />
                    </div>

                    {table.name && (
                      <p className="text-sm font-semibold text-foreground truncate mb-2">{table.name}</p>
                    )}

                    <div className="flex items-center gap-3 mb-2">
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Users className="h-3.5 w-3.5" />
                        <span className="font-medium">{table.capacity}</span>
                        <span>seats</span>
                      </div>
                      {table.section && (
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 font-medium border ${getSectionColorClass(table.section)}`}>
                          {table.section}
                        </Badge>
                      )}
                    </div>

                    {/* Occupied Table Info: Elapsed Time & Running Total */}
                    {isOccupied && session && (
                      <div className="mb-2 space-y-1">
                        <div className="flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-400">
                          <Timer className="h-3 w-3" />
                          <span className="font-medium">{formatElapsedTime(session.openedAt)}</span>
                          {session.waiterName && (
                            <>
                              <span className="text-muted-foreground">·</span>
                              <UserCheck className="h-3 w-3 text-muted-foreground" />
                              <span className="text-muted-foreground">{session.waiterName}</span>
                            </>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Running Total</span>
                          <span className="text-sm font-bold text-rose-600 dark:text-rose-400">{formatCurrency(session.totalAmount)}</span>
                        </div>
                      </div>
                    )}

                    <div className="border-t border-border/50 my-3" />

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                          onClick={(e) => openEditDialog(table, e)}
                          disabled={!canEdit}
                          title="Edit table"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                          onClick={(e) => { e.stopPropagation(); setDeleteTarget(table); }}
                          disabled={!canDelete || isOccupied}
                          title="Delete table"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 gap-1"
                        onClick={(e) => { e.stopPropagation(); handleTableClick(table); }}
                      >
                        {isOccupied ? <Eye className="h-3 w-3" /> : <ShoppingCart className="h-3 w-3" />}
                        {isOccupied ? 'View' : 'Order'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* List View */}
        {tables.length > 0 && viewMode === 'list' && (
          <Card className="border-0 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Table #</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Capacity</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Section</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                    {tables.some((t) => t.status === 'occupied') && (
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Running Total</th>
                    )}
                    <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tables.map((table) => {
                    const session = tableSessions[table.id];
                    const isOccupied = table.status === 'occupied';

                    return (
                      <tr
                        key={table.id}
                        className="border-b last:border-b-0 transition-colors hover:bg-muted/30 cursor-pointer"
                        onClick={() => handleTableClick(table)}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white text-sm font-bold shadow-sm shadow-emerald-600/20 shrink-0">
                              {table.tableNumber}
                            </div>
                            <span className="font-medium text-foreground sm:hidden">{table.section || '—'}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm font-medium text-foreground">{table.name || <span className="text-muted-foreground">—</span>}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Users className="h-3.5 w-3.5" />
                            <span className="font-medium text-foreground">{table.capacity}</span>
                            <span>seats</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          {table.section ? (
                            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 font-medium border ${getSectionColorClass(table.section)}`}>
                              {table.section}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <StatusIndicator status={table.status} clickable={true} table={table} />
                        </td>
                        {tables.some((t) => t.status === 'occupied') && (
                          <td className="px-4 py-3 hidden md:table-cell">
                            {isOccupied && session ? (
                              <div>
                                <span className="text-sm font-semibold text-rose-600 dark:text-rose-400">{formatCurrency(session.totalAmount)}</span>
                                <span className="block text-[10px] text-muted-foreground flex items-center gap-1">
                                  <Timer className="h-2.5 w-2.5" />
                                  {formatElapsedTime(session.openedAt)}
                                </span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-sm">—</span>
                            )}
                          </td>
                        )}
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                              onClick={(e) => { e.stopPropagation(); handleTableClick(table); }}
                              title={isOccupied ? 'View Session' : 'Open Table'}
                            >
                              {isOccupied ? <Eye className="h-4 w-4" /> : <ShoppingCart className="h-4 w-4" />}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                              onClick={(e) => openEditDialog(table, e)}
                              disabled={!canEdit}
                              title="Edit table"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                              onClick={(e) => { e.stopPropagation(); setDeleteTarget(table); }}
                              disabled={!canDelete || isOccupied}
                              title="Delete table"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Add/Edit Dialog */}
        {renderTableFormDialog('grid')}

        {/* Delete Confirmation */}
        {renderDeleteDialog()}
      </>
    );
  }

  /* ═══════════════════════════════════════════
     RENDER: VIEW 2 - Table Order Interface
     ═══════════════════════════════════════════ */

  if (activeView === 'order' && selectedTable) {
    const tableLabel = selectedTable.name || `Table #${selectedTable.tableNumber}`;
    const session = tableSessions[selectedTable.id] || activeSession;

    return (
      <>
        {/* Header */}
        <div className="space-y-4 mb-6">
          <Button variant="ghost" size="sm" onClick={handleBackToAction} className="gap-2">
            <ArrowLeft className="size-4" />
            Back
          </Button>

          <Card className="overflow-hidden border-0 shadow-md">
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-4 sm:px-6 py-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 text-white text-xl font-bold backdrop-blur-sm">
                    {selectedTable.tableNumber}
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">{tableLabel}</h2>
                    <p className="text-emerald-100 text-xs flex items-center gap-2">
                      <span className="inline-block h-2 w-2 rounded-full bg-emerald-300" />
                      {selectedTable.section || 'No Section'} · {selectedTable.capacity} seats
                      {session && (
                        <>
                          <span className="mx-1">·</span>
                          <Timer className="h-3 w-3" />
                          {formatElapsedTime(session.openedAt)}
                        </>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {session && (
                    <Badge className="bg-white/20 text-white border-white/30 text-xs">
                      <IndianRupee className="h-3 w-3 mr-1" />
                      {formatCurrency(session.totalAmount)}
                    </Badge>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-white/10 text-white border-white/30 hover:bg-white/20 text-xs"
                    onClick={handleGoToDetail}
                  >
                    <Eye className="h-3.5 w-3.5 mr-1" />
                    View Session
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Two Column Layout: Menu + Cart */}
        <div className="flex flex-col lg:flex-row gap-4">
          {/* LEFT: Item Selection */}
          <div className="flex-1 min-w-0">
            <Card className="border-0 shadow-sm overflow-hidden">
              <CardHeader className="pb-3 px-4 pt-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <UtensilsCrossed className="h-4 w-4 text-emerald-600" />
                    Menu Items
                  </CardTitle>
                  <Button variant="outline" size="sm" className="text-xs gap-1" onClick={fetchMenuItems} disabled={itemsLoading}>
                    <RefreshCw className={`h-3 w-3 ${itemsLoading ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </div>

                {/* Search Bar */}
                <div className="relative mt-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search menu items..."
                    value={menuSearch}
                    onChange={(e) => setMenuSearch(e.target.value)}
                    className="pl-9 h-9"
                  />
                </div>

                {/* Category Pills */}
                <div className="flex gap-1.5 mt-3 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setSelectedCategory('all')}
                    className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-colors border ${
                      selectedCategory === 'all'
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white text-foreground border-border hover:bg-muted'
                    }`}
                  >
                    All
                  </button>
                  {categories.map((cat) => {
                    const colorIdx = categories.indexOf(cat) % CATEGORY_COLORS.length;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setSelectedCategory(cat.id)}
                        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-colors border ${
                          selectedCategory === cat.id
                            ? 'text-white border-transparent'
                            : 'bg-white text-foreground border-border hover:bg-muted'
                        }`}
                        style={selectedCategory === cat.id ? { backgroundColor: CATEGORY_COLORS[colorIdx] } : {}}
                      >
                        {cat.name}
                      </button>
                    );
                  })}
                </div>
              </CardHeader>

              <CardContent className="px-4 pb-4">
                {itemsLoading ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {[...Array(6)].map((_, i) => (
                      <Skeleton key={i} className="h-28 rounded-lg" />
                    ))}
                  </div>
                ) : filteredMenuItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <UtensilsCrossed className="h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">No items found</p>
                    <p className="text-xs text-muted-foreground mt-1">Try a different search or category</p>
                  </div>
                ) : (
                  <ScrollArea className="max-h-[500px] lg:max-h-[calc(100vh-420px)]">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pr-3">
                      {filteredMenuItems.map((item) => {
                        const inCart = cartItems.find((c) => c.itemId === item.id);
                        const catColorIdx = categories.findIndex((c) => c.id === item.categoryId);
                        const accentColor = catColorIdx >= 0 ? CATEGORY_COLORS[catColorIdx % CATEGORY_COLORS.length] : '#16a34a';

                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => addMenuItem(item)}
                            className={`relative group/item rounded-lg border p-3 text-left transition-all hover:shadow-md hover:-translate-y-0.5 overflow-hidden ${
                              inCart
                                ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-900/10'
                                : 'border-border hover:border-emerald-200 dark:hover:border-emerald-800'
                            }`}
                          >
                            <div className="absolute top-0 left-0 right-0 h-0.5" style={{ backgroundColor: accentColor }} />

                            <div
                              className="w-full h-16 rounded-md mb-2 flex items-center justify-center overflow-hidden"
                              style={{ backgroundColor: `${accentColor}15` }}
                            >
                              {item.imageUrl ? (
                                <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover rounded-md" />
                              ) : (
                                <UtensilsCrossed className="h-6 w-6" style={{ color: accentColor, opacity: 0.6 }} />
                              )}
                            </div>

                            <p className="text-xs font-semibold text-foreground truncate">{item.name}</p>
                            <p className="text-xs font-bold mt-1" style={{ color: accentColor }}>
                              {formatCurrency(item.price)}
                            </p>

                            {inCart && (
                              <span className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white text-[10px] font-bold">
                                {inCart.qty}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </div>

          {/* RIGHT: Current Order Cart */}
          <div className="lg:w-[380px] xl:w-[420px] shrink-0">
            <Card className="border-0 shadow-sm overflow-hidden lg:sticky lg:top-4">
              <CardHeader className="pb-3 px-4 pt-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4 text-emerald-600" />
                    Current Order
                    {cartCount > 0 && (
                      <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 text-[10px] px-1.5">
                        {cartCount} items
                      </Badge>
                    )}
                  </CardTitle>
                  {cartItems.length > 0 && (
                    <Button variant="ghost" size="sm" className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-900/20 gap-1" onClick={() => setCartItems([])}>
                      <Trash2 className="h-3 w-3" />
                      Clear
                    </Button>
                  )}
                </div>
              </CardHeader>

              <CardContent className="px-4 pb-4">
                {cartItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <ShoppingCart className="h-10 w-10 text-muted-foreground/30 mb-3" />
                    <p className="text-sm font-medium text-muted-foreground">No items in cart</p>
                    <p className="text-xs text-muted-foreground mt-1">Click menu items to add them</p>
                  </div>
                ) : (
                  <>
                    <ScrollArea className="max-h-[300px] lg:max-h-[calc(100vh-520px)]">
                      <div className="space-y-2 pr-3">
                        {cartItems.map((item) => (
                          <div key={item.id} className="rounded-lg border border-border/50 p-3 hover:bg-muted/30 transition-colors">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">{formatCurrency(item.rate)} each</p>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => updateCartQty(item.id, -1)}
                                >
                                  <Minus className="h-3 w-3" />
                                </Button>
                                <span className="w-8 text-center text-sm font-semibold tabular-nums">{item.qty}</span>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => updateCartQty(item.id, 1)}
                                >
                                  <Plus className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>

                            <div className="mt-2">
                              <Input
                                placeholder="Add note..."
                                value={item.notes}
                                onChange={(e) => updateCartNotes(item.id, e.target.value)}
                                className="h-7 text-xs"
                              />
                            </div>

                            <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/30">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 text-[10px] text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 px-2"
                                onClick={() => removeCartItem(item.id)}
                              >
                                <X className="h-3 w-3 mr-0.5" />
                                Remove
                              </Button>
                              <span className="text-sm font-bold text-foreground">{formatCurrency(item.total)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>

                    <Separator className="my-3" />

                    {/* Order Notes */}
                    <div className="mb-3">
                      <Label className="text-xs text-muted-foreground">Order Notes</Label>
                      <Textarea
                        placeholder="Special instructions for kitchen..."
                        value={orderNotes}
                        onChange={(e) => setOrderNotes(e.target.value)}
                        className="mt-1 min-h-[60px] text-sm"
                      />
                    </div>

                    {/* Totals */}
                    <div className="space-y-1.5 mb-4">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Subtotal</span>
                        <span className="font-semibold">{formatCurrency(cartSubtotal)}</span>
                      </div>
                      <div className="flex items-center justify-between text-base font-bold pt-1 border-t">
                        <span>Total</span>
                        <span className="text-emerald-600 dark:text-emerald-400">{formatCurrency(cartSubtotal)}</span>
                      </div>
                    </div>

                    {/* Post Order Button */}
                    <Button
                      onClick={handlePostOrder}
                      disabled={postingOrder || cartItems.length === 0}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-2 font-semibold h-11"
                    >
                      {postingOrder ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                      {postingOrder ? 'Posting Order...' : 'Post Order'}
                    </Button>

                    {session && (
                      <button
                        type="button"
                        onClick={() => { setCartItems([]); setOrderNotes(''); }}
                        className="w-full text-center text-xs text-muted-foreground hover:text-emerald-600 mt-3 transition-colors"
                      >
                        <span className="flex items-center justify-center gap-1">
                          <RotateCcw className="h-3 w-3" />
                          Clear cart &amp; add more items
                        </span>
                      </button>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Add/Edit Dialog */}
        {renderTableFormDialog('order')}
      </>
    );
  }

  /* ═══════════════════════════════════════════
     RENDER: VIEW 3 - Table Detail View (BUG 2 & 4 FIXES)
     ═══════════════════════════════════════════ */

  if (activeView === 'detail' && selectedTable) {
    const tableLabel = selectedTable.name || `Table #${selectedTable.tableNumber}`;
    const session = activeSession || tableSessions[selectedTable.id];
    const allItems = tableOrders.flatMap((o) => o.items || []);
    const runningTotal = allItems.reduce((s, i) => s + (i.total ?? i.qty * i.rate), 0);
    const currentOrders = tableOrders.filter((o) => o.status !== 'cancelled');

    // BUG 2 FIX: The selectedOrder tracks which order is being viewed
    const selectedOrder = selectedOrderId
      ? tableOrders.find((o) => o.id === selectedOrderId) || null
      : null;

    return (
      <>
        {/* Back Button */}
        <div className="space-y-4 mb-4">
          <Button variant="ghost" size="sm" onClick={handleBackToAction} className="gap-2">
            <ArrowLeft className="size-4" />
            Back
          </Button>
        </div>

        {/* Table Info Header */}
        <Card className="overflow-hidden border-0 shadow-md mb-6">
          <div className="h-2 bg-gradient-to-r from-rose-500 via-rose-400 to-amber-400" />
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-amber-500 text-white text-2xl font-bold shadow-lg">
                {selectedTable.tableNumber}
              </div>
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-bold">{tableLabel}</h2>
                  <StatusIndicator status={selectedTable.status} clickable={false} table={selectedTable} />
                  {selectedTable.section && (
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 font-medium border ${getSectionColorClass(selectedTable.section)}`}>
                      {selectedTable.section}
                    </Badge>
                  )}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  {session?.openedAt && (
                    <span className="flex items-center gap-1">
                      <Clock className="size-3" />
                      Opened {formatTime(session.openedAt)}
                    </span>
                  )}
                  {session?.openedAt && (
                    <span className="flex items-center gap-1">
                      <Timer className="size-3" />
                      {formatElapsedTime(session.openedAt)}
                    </span>
                  )}
                  {session?.waiterName && (
                    <span className="flex items-center gap-1">
                      <UserCheck className="size-3" />
                      {session.waiterName}
                    </span>
                  )}
                  {session?.guestCount > 0 && (
                    <span className="flex items-center gap-1">
                      <Users className="size-3" />
                      {session.guestCount} guests
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Receipt className="size-3" />
                    {session?.orderCount ?? tableOrders.length} orders
                  </span>
                </div>
                {session?.notes && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <StickyNote className="size-3" />
                    {session.notes}
                  </p>
                )}
              </div>
              <div className="text-left sm:text-right shrink-0">
                <p className="text-xs text-muted-foreground">Running Bill</p>
                <p className="text-3xl font-bold tabular-nums text-rose-600 dark:text-rose-400">
                  {formatCurrency(runningTotal)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {currentOrders.length} active order{currentOrders.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t">
              {/* BUG 4 FIX: Add Item button now navigates to order view */}
              <Button size="sm" className="gap-1 text-xs bg-emerald-600 hover:bg-emerald-700" onClick={handleGoToOrder}>
                <Plus className="size-3" />
                Add Items
              </Button>
              <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={handleOpenSettle}>
                <CreditCard className="size-3" />
                Settle Bill
              </Button>
              <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={handleOpenTransfer}>
                <ArrowRightLeft className="size-3" />
                Transfer Table
              </Button>
              <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={handlePrintKOT} disabled={tableOrders.length === 0}>
                <ChefHat className="size-3" />
                Print KOT
              </Button>
              <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={handlePrintOrderSlip} disabled={tableOrders.length === 0}>
                <Printer className="size-3" />
                Print Slip
              </Button>
              <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={handleOpenSessionNotes}>
                <StickyNote className="size-3" />
                Add Notes
              </Button>
              <Button size="sm" variant="outline" className="gap-1 text-xs text-orange-600 border-orange-200 hover:bg-orange-50" onClick={() => setCloseSessionOpen(true)}>
                <XCircle className="size-3" />
                Close Session
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Tabs Content */}
        <Tabs value={detailTab} onValueChange={(val) => {
          setDetailTab(val);
          if (val === 'current') setSelectedOrderId(null);
        }}>
          <TabsList className="w-full flex flex-wrap h-auto gap-1 bg-muted/50 p-1 mb-4">
            <TabsTrigger value="current" className="text-xs gap-1">
              <Receipt className="size-3" />
              Current Orders
              <Badge variant="secondary" className="text-[10px] px-1 ml-1">{currentOrders.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="history" className="text-xs gap-1">
              <Clock className="size-3" />
              Order History
            </TabsTrigger>
            <TabsTrigger value="session" className="text-xs gap-1">
              <Settings className="size-3" />
              Session Info
            </TabsTrigger>
          </TabsList>

          {/* Current Orders Tab */}
          <TabsContent value="current" className="mt-0">
            {ordersLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="size-6 animate-spin text-emerald-500" />
              </div>
            ) : currentOrders.length === 0 ? (
              <Card className="border-0 shadow-sm">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Receipt className="h-10 w-10 text-muted-foreground/30 mb-3" />
                  <p className="text-sm font-medium text-muted-foreground">No active orders</p>
                  <p className="text-xs text-muted-foreground mt-1">Click "Add Items" to create a new order</p>
                  <Button size="sm" className="mt-3 bg-emerald-600 hover:bg-emerald-700 text-white gap-1" onClick={handleGoToOrder}>
                    <Plus className="size-3" />
                    Add Items
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {currentOrders.map((order) => {
                  const orderStatusConfig = ORDER_STATUS_CONFIG[order.status] || ORDER_STATUS_CONFIG.new;
                  const isSelected = selectedOrderId === order.id;

                  return (
                    <Card
                      key={order.id}
                      className={`border-0 shadow-sm overflow-hidden transition-all ${isSelected ? 'ring-2 ring-emerald-500' : ''}`}
                      onClick={() => setSelectedOrderId(order.id)}
                    >
                      <div className="flex items-center justify-between px-4 py-2.5 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-foreground">#{order.orderNumber}</span>
                          <span className="text-xs text-muted-foreground">{formatTime(order.createdAt)}</span>
                          <span className="text-xs text-muted-foreground">· {order.items.length} items</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={`text-[10px] gap-1 border ${orderStatusConfig.bg}`}>
                            {orderStatusConfig.icon}
                            {orderStatusConfig.text}
                          </Badge>
                          <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(order.total)}</span>
                        </div>
                      </div>

                      {/* BUG 2 FIX: Only show expanded order detail when selected */}
                      {isSelected && (
                        <CardContent className="p-4 pt-2">
                          {/* Order Items with qty/status controls */}
                          <div className="space-y-2">
                            {order.items.map((item) => {
                              const itemStatusConfig = ORDER_STATUS_CONFIG[item.status] || ORDER_STATUS_CONFIG.new;
                              const isUpdating = orderItemUpdating === `${order.id}-${item.id}`;

                              return (
                                <div key={item.id} className="rounded-lg border border-border/50 p-3 hover:bg-muted/30 transition-colors">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium text-foreground">{item.name}</span>
                                        {item.status && item.status !== 'pending' && (
                                          <Badge variant="outline" className={`text-[9px] gap-0.5 border px-1 py-0 ${itemStatusConfig.bg}`}>
                                            {itemStatusConfig.icon}
                                            {itemStatusConfig.text}
                                          </Badge>
                                        )}
                                      </div>
                                      {item.notes && (
                                        <p className="text-[10px] text-muted-foreground italic mt-0.5">{item.notes}</p>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                      {/* BUG 4 FIX: Quantity +/- buttons */}
                                      <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-6 w-6"
                                        disabled={isUpdating || item.qty <= 1}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleUpdateOrderItemQty(order.id, item.id, item.qty - 1, item.rate);
                                        }}
                                      >
                                        <Minus className="h-3 w-3" />
                                      </Button>
                                      <span className="w-7 text-center text-sm font-semibold tabular-nums">{item.qty}</span>
                                      <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-6 w-6"
                                        disabled={isUpdating}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleUpdateOrderItemQty(order.id, item.id, item.qty + 1, item.rate);
                                        }}
                                      >
                                        <Plus className="h-3 w-3" />
                                      </Button>
                                      <span className="text-sm font-bold tabular-nums ml-1">{formatCurrency(item.total)}</span>
                                    </div>
                                  </div>

                                  {/* BUG 4 FIX: Item status action buttons */}
                                  <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-border/30">
                                    {isUpdating ? (
                                      <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                                    ) : (
                                      <>
                                        {item.status !== 'preparing' && item.status !== 'cancelled' && (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleUpdateOrderItemStatus(order.id, item.id, 'preparing');
                                            }}
                                            className="text-[10px] px-2 py-0.5 rounded border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800 transition-colors"
                                          >
                                            <ChefHat className="h-2.5 w-2.5 inline mr-0.5" />
                                            Preparing
                                          </button>
                                        )}
                                        {item.status === 'preparing' && (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleUpdateOrderItemStatus(order.id, item.id, 'ready');
                                            }}
                                            className="text-[10px] px-2 py-0.5 rounded border border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800 transition-colors"
                                          >
                                            <CheckCircle2 className="h-2.5 w-2.5 inline mr-0.5" />
                                            Ready
                                          </button>
                                        )}
                                        {(item.status === 'preparing' || item.status === 'ready') && (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleUpdateOrderItemStatus(order.id, item.id, 'served');
                                            }}
                                            className="text-[10px] px-2 py-0.5 rounded border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800 transition-colors"
                                          >
                                            <CheckCircle2 className="h-2.5 w-2.5 inline mr-0.5" />
                                            Served
                                          </button>
                                        )}
                                        {item.status !== 'cancelled' && item.status !== 'served' && (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleUpdateOrderItemStatus(order.id, item.id, 'cancelled');
                                            }}
                                            className="text-[10px] px-2 py-0.5 rounded border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-800 transition-colors"
                                          >
                                            <XCircle className="h-2.5 w-2.5 inline mr-0.5" />
                                            Cancel
                                          </button>
                                        )}
                                      </>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Order Notes */}
                          {order.notes && (
                            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                              <StickyNote className="size-3" />
                              {order.notes}
                            </p>
                          )}

                          <Separator className="my-2" />
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">
                              {order.items.length} item{order.items.length !== 1 ? 's' : ''}
                            </span>
                            <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(order.total)}</span>
                          </div>
                        </CardContent>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Order History Tab */}
          <TabsContent value="history" className="mt-0">
            {ordersLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="size-6 animate-spin text-emerald-500" />
              </div>
            ) : tableOrders.length === 0 ? (
              <Card className="border-0 shadow-sm">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Clock className="h-10 w-10 text-muted-foreground/30 mb-3" />
                  <p className="text-sm font-medium text-muted-foreground">No orders yet</p>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-0 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Order #</th>
                        <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Time</th>
                        <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Items</th>
                        <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                        <th className="px-4 py-2.5 text-right text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tableOrders.map((order) => {
                        const orderStatusConfig = ORDER_STATUS_CONFIG[order.status] || ORDER_STATUS_CONFIG.new;
                        return (
                          <tr key={order.id} className="border-b last:border-b-0 hover:bg-muted/30">
                            <td className="px-4 py-2.5 text-sm font-bold">#{order.orderNumber}</td>
                            <td className="px-4 py-2.5 text-xs text-muted-foreground">{formatTime(order.createdAt)}</td>
                            <td className="px-4 py-2.5 text-xs">{order.items.length} items</td>
                            <td className="px-4 py-2.5">
                              <Badge variant="outline" className={`text-[10px] gap-1 border ${orderStatusConfig.bg}`}>
                                {orderStatusConfig.icon}
                                {orderStatusConfig.text}
                              </Badge>
                            </td>
                            <td className="px-4 py-2.5 text-sm font-semibold text-right tabular-nums">{formatCurrency(order.total)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </TabsContent>

          {/* Session Info Tab */}
          <TabsContent value="session" className="mt-0">
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4 sm:p-6">
                {session ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Session ID</p>
                        <p className="text-sm font-mono font-medium mt-1">{session.id.slice(0, 12)}...</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Status</p>
                        <p className="text-sm font-medium mt-1 capitalize">{session.status}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Opened At</p>
                        <p className="text-sm font-medium mt-1">
                          {formatDate(session.openedAt)} {formatTime(session.openedAt)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Waiter</p>
                        <p className="text-sm font-medium mt-1">{session.waiterName || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Guest Count</p>
                        <p className="text-sm font-medium mt-1">{session.guestCount || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Orders</p>
                        <p className="text-sm font-medium mt-1">{session.orderCount || tableOrders.length}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Running Total</p>
                        <p className="text-sm font-bold text-rose-600 dark:text-rose-400 mt-1">{formatCurrency(runningTotal)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Elapsed Time</p>
                        <p className="text-sm font-medium mt-1">{formatElapsedTime(session.openedAt)}</p>
                      </div>
                    </div>

                    {session.notes && (
                      <div className="pt-4 border-t">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Session Notes</p>
                        <p className="text-sm">{session.notes}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <Loader2 className="h-6 w-6 animate-spin text-emerald-500 mb-2" />
                    <p className="text-sm text-muted-foreground">Loading session info...</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* ─── DIALOGS ─── */}
        {renderSettleDialog()}
        {renderTransferDialog()}
        {renderSessionNotesDialog()}
        {renderCloseSessionDialog()}
        {renderTableFormDialog('detail')}
      </>
    );
  }

  /* ═══════════════════════════════════════════
     Fallback
     ═══════════════════════════════════════════ */
  return null;
}
