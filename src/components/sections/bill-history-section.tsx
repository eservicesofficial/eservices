'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { format, parseISO } from 'date-fns';
import {
  Search,
  Eye,
  Pencil,
  Trash2,
  Printer,
  FileText,
  Receipt,
  CalendarCheck,
  X,
  CheckCircle,
  Clock,
  PrinterIcon,
  RotateCcw,
  Wallet,
  IndianRupee,
  CreditCard,
  Smartphone,
  Building2,
  AlertCircle,
  RefreshCw,
  CircleDollarSign,
  CircleCheckBig,
  Ban,
  ArrowRightLeft,
  UtensilsCrossed,
  ShoppingBag,
  Truck,
} from 'lucide-react';
import { notify } from '@/lib/notification-store';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { fetchThermalSettings, buildRichThermalHtml, type ThermalReceiptData } from '@/lib/thermal-settings';
import { useAuth } from '@/components/auth-provider';
import ReadOnlyBanner from '@/components/read-only-banner';

// ── Interfaces ──────────────────────────────────────────────
interface InvoiceItem {
  id: string;
  name: string;
  description?: string;
  qty: number;
  rate: number;
  total: number;
}

interface RefundItem {
  name: string;
  qty: number;
  rate: number;
  total: number;
}

interface Refund {
  id: string;
  refundNumber: string;
  originalInvoiceId: string;
  date: string;
  items: string;
  refundAmount: number;
  reason: string;
  status: string;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  date: string;
  customerName: string;
  customerAddress?: string;
  customerPhone: string;
  paymentMethod: string;
  status: string;
  orderType: string;
  subtotal: number;
  cgst: number;
  sgst: number;
  deliveryCharge: number;
  discountAmount: number;
  grandTotal: number;
  paidAmount: number;
  balanceAmount: number;
  isCompleted?: boolean;
  invoiceItems: InvoiceItem[];
  refunds?: Refund[];
  createdAt: string;
}

interface ShopSettings {
  shopName: string;
  shopAddress: string;
  shopPhone: string;
  shopEmail?: string;
  authorizedSignatory?: string;
  enableGst?: boolean;
  gstRate?: number;
  gstNumber?: string;
  gstState?: string;
  gstFullMode?: boolean;
  gstSimpleMode?: boolean;
}

interface BillHistorySectionProps {
  onNavigate: (page: string) => void;
  onEditInvoice: (invoice: any) => void;
  onRefreshData: () => void;
  dataVersion?: number;
}

// ── Helpers ─────────────────────────────────────────────────
function formatCurrency(amount: number): string {
  return `₹${amount.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(dateStr: string): string {
  try {
    return format(parseISO(dateStr), 'dd MMM yyyy');
  } catch {
    return dateStr;
  }
}

function formatDateFull(dateStr: string): string {
  try {
    return format(parseISO(dateStr), 'dd/MM/yyyy');
  } catch {
    return dateStr;
  }
}

// ── Status System ──────────────────────────────────────────
type InvoiceStatus = 'Pending' | 'Paid' | 'Balance' | 'Refunded' | 'Replaced';

function getStatusColor(status: string): string {
  const s = (status || '').toLowerCase();
  switch (s) {
    case 'paid':
    case 'completed':
      return 'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-400 dark:border-emerald-700';
    case 'balance':
      return 'bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900/40 dark:text-orange-400 dark:border-orange-700';
    case 'refunded':
      return 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/40 dark:text-red-400 dark:border-red-700';
    case 'replaced':
      return 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/40 dark:text-blue-400 dark:border-blue-700';
    case 'cancelled':
      return 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/40 dark:text-red-400 dark:border-red-700';
    case 'pending':
    default:
      return 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/40 dark:text-amber-400 dark:border-amber-700';
  }
}

function getStatusIcon(status: string) {
  const s = (status || '').toLowerCase();
  switch (s) {
    case 'paid':
    case 'completed':
      return <CheckCircle className="h-3 w-3" />;
    case 'balance':
      return <CircleDollarSign className="h-3 w-3" />;
    case 'refunded':
      return <RotateCcw className="h-3 w-3" />;
    case 'replaced':
      return <ArrowRightLeft className="h-3 w-3" />;
    case 'cancelled':
      return <Ban className="h-3 w-3" />;
    case 'pending':
    default:
      return <Clock className="h-3 w-3" />;
  }
}

function getStatusLabel(status: string): string {
  const s = (status || '').toLowerCase();
  switch (s) {
    case 'paid':
    case 'completed':
      return 'Paid';
    case 'balance':
      return 'Balance';
    case 'refunded':
      return 'Refunded';
    case 'replaced':
      return 'Replaced';
    case 'cancelled':
      return 'Cancelled';
    case 'pending':
    default:
      return 'Pending';
  }
}

function getPaymentIcon(method: string) {
  const m = (method || '').toLowerCase();
  switch (m) {
    case 'cash':
      return <IndianRupee className="h-3.5 w-3.5" />;
    case 'upi':
      return <Smartphone className="h-3.5 w-3.5" />;
    case 'card':
    case 'credit card':
    case 'debit card':
      return <CreditCard className="h-3.5 w-3.5" />;
    case 'net banking':
    case 'netbanking':
      return <Building2 className="h-3.5 w-3.5" />;
    default:
      return <Wallet className="h-3.5 w-3.5" />;
  }
}

function getBalanceColorClass(invoice: Invoice): string {
  const s = (invoice.status || '').toLowerCase();
  if (s === 'paid' || s === 'completed') return 'text-emerald-600 dark:text-emerald-400';
  if (s === 'balance') {
    if (invoice.balanceAmount > 0) return 'text-orange-600 dark:text-orange-400';
  }
  if (s === 'refunded' || s === 'cancelled') return 'text-red-600 dark:text-red-400';
  return 'text-amber-600 dark:text-amber-400';
}

// ── Order Type System ───────────────────────────────────────
function getOrderTypeLabel(orderType: string): string {
  const t = (orderType || '').toLowerCase();
  switch (t) {
    case 'dine-in':
      return 'Dine-In';
    case 'takeaway':
      return 'Takeaway';
    case 'delivery':
      return 'Delivery';
    default:
      return orderType || 'Dine-In';
  }
}

function getOrderTypeIcon(orderType: string) {
  const t = (orderType || '').toLowerCase();
  switch (t) {
    case 'dine-in':
      return <UtensilsCrossed className="h-3 w-3" />;
    case 'takeaway':
      return <ShoppingBag className="h-3 w-3" />;
    case 'delivery':
      return <Truck className="h-3 w-3" />;
    default:
      return <UtensilsCrossed className="h-3 w-3" />;
  }
}

function getOrderTypeBadgeClass(orderType: string): string {
  const t = (orderType || '').toLowerCase();
  switch (t) {
    case 'dine-in':
      return 'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-400 dark:border-emerald-700';
    case 'takeaway':
      return 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/40 dark:text-amber-400 dark:border-amber-700';
    case 'delivery':
      return 'bg-violet-100 text-violet-700 border-violet-300 dark:bg-violet-900/40 dark:text-violet-400 dark:border-violet-700';
    default:
      return 'bg-muted text-muted-foreground border-muted-foreground/20';
  }
}

// ── Component ───────────────────────────────────────────────
export default function BillHistorySection({
  onNavigate,
  onEditInvoice,
  onRefreshData,
  dataVersion,
}: BillHistorySectionProps) {
  const { token, hasPermission } = useAuth();
  const authHeaders: Record<string, string> = token ? { 'Authorization': `Bearer ${token}` } : {};
  const canAccess = hasPermission('billing', 'access');
  const canEdit = hasPermission('billing', 'edit');
  const canDelete = hasPermission('billing', 'delete');
  const isReadOnly = !canAccess || (!canEdit && !canDelete);
  const noAccess = !canAccess;

  // Data state
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [settings, setSettings] = useState<ShopSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [todayFilter, setTodayFilter] = useState(false);

  // View dialog state
  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const invoicePreviewRef = useRef<HTMLDivElement>(null);

  // Delete dialog state
  const [deleteTarget, setDeleteTarget] = useState<Invoice | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Update dialog state (for Pending/Balance bills)
  const [updateTarget, setUpdateTarget] = useState<Invoice | null>(null);
  const [updatePaymentMethod, setUpdatePaymentMethod] = useState('Cash');
  const [updateStatus, setUpdateStatus] = useState<string>('Pending');
  const [updateAmountPaid, setUpdateAmountPaid] = useState<string>('');
  const [updating, setUpdating] = useState(false);

  // Pay Balance dialog state
  const [payBalanceTarget, setPayBalanceTarget] = useState<Invoice | null>(null);
  const [payBalanceAmount, setPayBalanceAmount] = useState<string>('');
  const [payBalanceMethod, setPayBalanceMethod] = useState('Cash');
  const [payingBalance, setPayingBalance] = useState(false);

  // Refund dialog state
  const [refundTarget, setRefundTarget] = useState<Invoice | null>(null);
  const [refundSelectedItems, setRefundSelectedItems] = useState<Set<number>>(new Set());
  const [refundReason, setRefundReason] = useState('');
  const [processingRefund, setProcessingRefund] = useState(false);

  // Replace dialog state
  const [replaceTarget, setReplaceTarget] = useState<Invoice | null>(null);
  const [replaceSelectedItems, setReplaceSelectedItems] = useState<Set<number>>(new Set());
  const [replaceReason, setReplaceReason] = useState('');
  const [processingReplace, setProcessingReplace] = useState(false);

  // ── Data Fetching ──────────────────────────────────────────
  const fetchInvoices = useCallback(async (silent?: boolean) => {
    try {
      if (!silent) setLoading(true);
      const res = await fetch('/api/invoices', { headers: authHeaders });
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setInvoices(Array.isArray(data) ? data : []);
    } catch {
      notify({ type: 'error', title: 'Error', message: 'Failed to load invoices' });
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/settings', { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      }
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    fetchInvoices();
    fetchSettings();
  }, [fetchInvoices, fetchSettings]);

  // Re-fetch data when dataVersion changes (sync from other tabs/devices)
  const prevDataVersion = useRef(dataVersion);
  useEffect(() => {
    if (dataVersion !== undefined && dataVersion !== prevDataVersion.current) {
      prevDataVersion.current = dataVersion;
      fetchInvoices(true);  // silent=true for background sync
    }
  }, [dataVersion, fetchInvoices]);

  // ── Filtering ──────────────────────────────────────────────
  const filteredInvoices = useMemo(() => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    return invoices
      .filter((inv) => {
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          if (
            !(inv.invoiceNumber || '').toLowerCase().includes(q) &&
            !(inv.customerName || '').toLowerCase().includes(q) &&
            !(inv.customerPhone || '').toLowerCase().includes(q)
          ) {
            return false;
          }
        }
        if (statusFilter !== 'all') {
          const s = (inv.status || '').toLowerCase();
          if (statusFilter === 'paid' && s !== 'paid' && s !== 'completed') return false;
          if (statusFilter === 'pending' && s !== 'pending') return false;
          if (statusFilter === 'balance' && s !== 'balance') return false;
          if (statusFilter === 'refunded' && s !== 'refunded') return false;
          if (statusFilter === 'replaced' && s !== 'replaced') return false;
          if (statusFilter === 'cancelled' && s !== 'cancelled') return false;
        }
        if (todayFilter) {
          const invDateStr = (inv.createdAt || inv.date || '').substring(0, 10);
          if (invDateStr !== todayStr) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const dateA = new Date(a.createdAt || a.date).getTime();
        const dateB = new Date(b.createdAt || b.date).getTime();
        return dateB - dateA;
      });
  }, [invoices, searchQuery, statusFilter, todayFilter]);

  // ── Delete ──────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      const res = await fetch(`/api/invoices/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      if (!res.ok) throw new Error('Delete failed');
      notify({ type: 'success', title: 'Deleted', message: `Invoice ${deleteTarget.invoiceNumber} deleted successfully` });
      setInvoices((prev) => prev.filter((inv) => inv.id !== deleteTarget.id));
      setDeleteTarget(null);
      onRefreshData();
    } catch {
      notify({ type: 'error', title: 'Error', message: 'Failed to delete invoice' });
    } finally {
      setDeleting(false);
    }
  };

  // ── Edit (fetch full invoice before passing) ──────────────
  const handleEdit = async (invoice: Invoice) => {
    try {
      notify({ type: 'info', title: 'Editing', message: `Loading ${invoice.invoiceNumber} for editing...` });
      const res = await fetch(`/api/invoices/${invoice.id}`, { headers: authHeaders });
      if (res.ok) {
        const fullInvoice = await res.json();
        onEditInvoice(fullInvoice);
        return;
      }
    } catch {
      // fall through to pass list invoice as fallback
    }
    onEditInvoice(invoice);
  };

  // ── View (fetch full invoice) ──────────────────────────────
  const handleView = async (invoice: Invoice) => {
    try {
      setViewLoading(true);
      const res = await fetch(`/api/invoices/${invoice.id}`, { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        setViewInvoice(data);
      } else {
        setViewInvoice(invoice);
      }
    } catch {
      setViewInvoice(invoice);
    } finally {
      setViewLoading(false);
    }
  };

  // ── Update Dialog Handlers ─────────────────────────────────
  const openUpdateDialog = (invoice: Invoice) => {
    setUpdateTarget(invoice);
    setUpdatePaymentMethod(invoice.paymentMethod || 'Cash');
    setUpdateStatus(invoice.status || 'Pending');
    setUpdateAmountPaid(String(invoice.paidAmount || 0));
  };

  const handleUpdate = async () => {
    if (!updateTarget) return;
    try {
      setUpdating(true);
      const payload: Record<string, any> = {
        paymentMethod: updatePaymentMethod,
        status: updateStatus,
      };

      if (updateStatus.toLowerCase() === 'balance') {
        const amtPaid = parseFloat(updateAmountPaid) || 0;
        const balance = updateTarget.grandTotal - amtPaid;
        payload.paidAmount = amtPaid;
        payload.balanceAmount = Math.max(balance, 0);
      } else if (updateStatus.toLowerCase() === 'paid') {
        payload.paidAmount = updateTarget.grandTotal;
        payload.balanceAmount = 0;
      }

      const res = await fetch(`/api/invoices/${updateTarget.id}`, {
        method: 'PUT',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Update failed');
      const updated = await res.json();
      notify({ type: 'success', title: 'Updated', message: `Invoice ${updateTarget.invoiceNumber} updated to ${getStatusLabel(updateStatus)}` });

      setInvoices((prev) =>
        prev.map((inv) => (inv.id === updateTarget.id ? { ...inv, ...updated } : inv))
      );
      setUpdateTarget(null);
      onRefreshData();
    } catch {
      notify({ type: 'error', title: 'Error', message: 'Failed to update invoice' });
    } finally {
      setUpdating(false);
    }
  };

  // ── Pay Balance Dialog Handlers ────────────────────────────
  const openPayBalanceDialog = (invoice: Invoice) => {
    setPayBalanceTarget(invoice);
    setPayBalanceAmount(String(invoice.balanceAmount || 0));
    setPayBalanceMethod(invoice.paymentMethod || 'Cash');
  };

  const handlePayBalance = async () => {
    if (!payBalanceTarget) return;
    const amount = parseFloat(payBalanceAmount) || 0;
    const maxBalance = payBalanceTarget.balanceAmount || 0;

    if (amount <= 0) {
      notify({ type: 'error', title: 'Error', message: 'Payment amount must be greater than 0' });
      return;
    }
    if (amount > maxBalance) {
      notify({ type: 'error', title: 'Error', message: `Payment amount cannot exceed balance of ${formatCurrency(maxBalance)}` });
      return;
    }

    try {
      setPayingBalance(true);
      const res = await fetch(`/api/invoices/${payBalanceTarget.id}/pay`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          paymentMethod: payBalanceMethod,
        }),
      });

      if (!res.ok) throw new Error('Payment failed');
      const updated = await res.json();

      notify({ type: 'success', title: 'Payment Recorded', message: `Payment of ${formatCurrency(amount)} recorded for ${payBalanceTarget.invoiceNumber}` });

      setInvoices((prev) =>
        prev.map((inv) => (inv.id === payBalanceTarget.id ? { ...inv, ...updated } : inv))
      );
      setPayBalanceTarget(null);
      onRefreshData();
    } catch {
      notify({ type: 'error', title: 'Error', message: 'Failed to record payment' });
    } finally {
      setPayingBalance(false);
    }
  };

  // ── Refund Dialog Handlers ─────────────────────────────────
  const openRefundDialog = (invoice: Invoice) => {
    // Fetch full invoice to ensure we have all items
    fetch(`/api/invoices/${invoice.id}`, { headers: authHeaders })
      .then((res) => (res.ok ? res.json() : invoice))
      .then((data) => {
        setRefundTarget(data);
        setRefundSelectedItems(new Set());
        setRefundReason('');
      })
      .catch(() => {
        setRefundTarget(invoice);
        setRefundSelectedItems(new Set());
        setRefundReason('');
      });
  };

  const toggleRefundItem = (index: number) => {
    setRefundSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const toggleSelectAllRefundItems = () => {
    if (!refundTarget) return;
    const allIndices = (refundTarget.invoiceItems || []).map((_, i) => i);
    if (refundSelectedItems.size === allIndices.length) {
      setRefundSelectedItems(new Set());
    } else {
      setRefundSelectedItems(new Set(allIndices));
    }
  };

  const refundTotal = useMemo(() => {
    if (!refundTarget) return 0;
    return Array.from(refundSelectedItems).reduce((sum, idx) => {
      const item = (refundTarget.invoiceItems || [])?.[idx];
      return sum + (item?.total || 0);
    }, 0);
  }, [refundTarget, refundSelectedItems]);

  const handleProcessRefund = async () => {
    if (!refundTarget) return;
    if (refundSelectedItems.size === 0) {
      notify({ type: 'error', title: 'Error', message: 'Please select at least one item to refund' });
      return;
    }

    const selectedItems: RefundItem[] = Array.from(refundSelectedItems)
      .map((idx) => {
        const item = refundTarget.invoiceItems?.[idx];
        if (!item) return null;
        return {
          name: item.name,
          qty: item.qty,
          rate: item.rate,
          total: item.total,
        };
      })
      .filter(Boolean) as RefundItem[];

    try {
      setProcessingRefund(true);
      const res = await fetch('/api/refunds', {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalInvoiceId: refundTarget.id,
          items: selectedItems,
          refundAmount: refundTotal,
          reason: refundReason,
        }),
      });

      if (!res.ok) throw new Error('Refund failed');
      const result = await res.json();

      notify({ type: 'success', title: 'Refund Processed', message: `Refund ${result.refundNumber} processed for ${formatCurrency(refundTotal)} — Invoice ${refundTarget.invoiceNumber}, ${selectedItems.length} item(s) refunded` });

      // Re-fetch all invoices from the server to get updated status/amounts
      setRefundTarget(null);
      setRefundSelectedItems(new Set());
      setRefundReason('');
      // Use a small delay to ensure DB is fully committed before re-fetching
      await new Promise((r) => setTimeout(r, 100));
      await fetchInvoices();
      onRefreshData();
    } catch {
      notify({ type: 'error', title: 'Error', message: 'Failed to process refund' });
    } finally {
      setProcessingRefund(false);
    }
  };

  // ── Replace Dialog Handlers ──────────────────────────────
  const openReplaceDialog = (invoice: Invoice) => {
    // Fetch full invoice to ensure we have all items
    fetch(`/api/invoices/${invoice.id}`, { headers: authHeaders })
      .then((res) => (res.ok ? res.json() : invoice))
      .then((data) => {
        setReplaceTarget(data);
        setReplaceSelectedItems(new Set());
        setReplaceReason('');
      })
      .catch(() => {
        setReplaceTarget(invoice);
        setReplaceSelectedItems(new Set());
        setReplaceReason('');
      });
  };

  const toggleReplaceItem = (index: number) => {
    setReplaceSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const toggleSelectAllReplaceItems = () => {
    if (!replaceTarget) return;
    const allIndices = (replaceTarget.invoiceItems || []).map((_, i) => i);
    if (replaceSelectedItems.size === allIndices.length) {
      setReplaceSelectedItems(new Set());
    } else {
      setReplaceSelectedItems(new Set(allIndices));
    }
  };

  const replaceTotal = useMemo(() => {
    if (!replaceTarget) return 0;
    return Array.from(replaceSelectedItems).reduce((sum, idx) => {
      const item = (replaceTarget.invoiceItems || [])?.[idx];
      return sum + (item?.total || 0);
    }, 0);
  }, [replaceTarget, replaceSelectedItems]);

  const replaceReasons = [
    'Wrong Item Delivered',
    'Item Damaged',
    'Customer Changed Order',
    'Quality Issue',
    'Size / Variation Mismatch',
    'Other',
  ];

  const handleProcessReplace = async () => {
    if (!replaceTarget) return;
    if (replaceSelectedItems.size === 0) {
      notify({ type: 'error', title: 'Error', message: 'Please select at least one item to replace' });
      return;
    }
    if (!replaceReason) {
      notify({ type: 'error', title: 'Error', message: 'Please select a replacement reason' });
      return;
    }

    const selectedItems: RefundItem[] = Array.from(replaceSelectedItems)
      .map((idx) => {
        const item = replaceTarget.invoiceItems?.[idx];
        if (!item) return null;
        return {
          name: item.name,
          qty: item.qty,
          rate: item.rate,
          total: item.total,
        };
      })
      .filter(Boolean) as RefundItem[];

    try {
      setProcessingReplace(true);

      // Step 1: Create a refund for the selected items
      const refundRes = await fetch('/api/refunds', {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalInvoiceId: replaceTarget.id,
          items: selectedItems,
          refundAmount: replaceTotal,
          reason: `Replacement: ${replaceReason}`,
        }),
      });

      if (!refundRes.ok) throw new Error('Refund creation failed');
      const refund = await refundRes.json();

      // Step 2: Mark the original invoice as "Replaced"
      const updateRes = await fetch(`/api/invoices/${replaceTarget.id}`, {
        method: 'PUT',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Replaced' }),
      });

      if (!updateRes.ok) throw new Error('Invoice update failed');
      await updateRes.json();

      notify({ type: 'success', title: 'Replace Processed', message: `Replace processed for ${replaceTarget.invoiceNumber} — Refund ${refund.refundNumber} created for ${formatCurrency(replaceTotal)}, ${selectedItems.length} item(s). Create the new replacement bill now.`, duration: 6000 });

      // Update the invoice status locally
      setInvoices((prev) =>
        prev.map((inv) =>
          inv.id === replaceTarget.id ? { ...inv, status: 'Replaced' } : inv
        )
      );

      // Clean up dialog state
      setReplaceTarget(null);
      setReplaceSelectedItems(new Set());
      setReplaceReason('');
      onRefreshData();

      // Navigate to New Bill section so user can create the replacement order
      onNavigate('new-bill');
    } catch (err) {
      console.error('Replace error:', err);
      notify({ type: 'error', title: 'Error', message: 'Replacement partially failed. A refund was created but invoice status was not updated.' });
      // Clean up to prevent duplicate attempts
      setReplaceTarget(null);
      setReplaceSelectedItems(new Set());
      setReplaceReason('');
    } finally {
      setProcessingReplace(false);
    }
  };

  // ── Print A4 ───────────────────────────────────────────────
  const handlePrintA4 = () => {
    if (!invoicePreviewRef.current || !viewInvoice) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      notify({ type: 'error', title: 'Error', message: 'Please allow pop-ups to print' });
      return;
    }
    printWindow.document.write(`<!DOCTYPE html><html><head><title>Invoice ${viewInvoice.invoiceNumber}</title>
<style>
  @page{size:A4;margin:10mm;}
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:'Segoe UI',Arial,sans-serif;margin:0;padding:20px;color:#1a1a1a;}
  .invoice-container{max-width:210mm;margin:0 auto;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;}
  .header{background:linear-gradient(135deg,#16a34a,#15803d);color:white;padding:24px 32px;}
  .shop-name{font-size:24px;font-weight:700;}
  .shop-info{font-size:12px;opacity:.9;margin-top:4px;}
  .invoice-meta{display:flex;justify-content:space-between;padding:20px 32px;border-bottom:1px solid #e5e7eb;flex-wrap:wrap;gap:12px;}
  .meta-item{font-size:13px;}.meta-label{color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:.5px;}.meta-value{font-weight:600;margin-top:2px;}
  table{width:100%;border-collapse:collapse;}
  th{background:#f9fafb;padding:10px 16px;font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:#6b7280;text-align:left;border-bottom:2px solid #e5e7eb;}
  td{padding:10px 16px;font-size:13px;border-bottom:1px solid #f3f4f6;}
  .text-right{text-align:right;}
  .summary{padding:16px 32px;}
  .summary-row{display:flex;justify-content:flex-end;gap:80px;padding:4px 0;font-size:13px;}
  .summary-total{display:flex;justify-content:flex-end;gap:80px;padding:12px 0 0;font-size:16px;font-weight:700;border-top:2px solid #16a34a;margin-top:8px;}
  .footer{padding:16px 32px;text-align:center;font-size:11px;color:#9ca3af;border-top:1px solid #e5e7eb;}
</style></head><body>
${invoicePreviewRef.current.innerHTML}
</body></html>`);
    printWindow.document.close();
    setTimeout(() => {
      try { if (!printWindow.closed) printWindow.print(); } catch { /* window closed */ }
    }, 500);
  };

  // ── Print Thermal Receipt ──────────────────────────────────
  const handleThermalPrint = async (invoice?: Invoice) => {
    const inv = invoice || viewInvoice;
    if (!inv) return;

    const shopName = settings?.shopName || 'Eservices';
    const shopAddr = settings?.shopAddress || '';
    const shopPhone = settings?.shopPhone || '';
    const shopGst = settings?.gstNumber || '';
    const shopGstState = settings?.gstState || '';
    // Show GST only if the original bill had GST values calculated
    const showGst = (inv.cgst > 0 || inv.sgst > 0);
    const tConfig = await fetchThermalSettings();

    // Calculate GST rate from existing values
    const gstRate = inv.subtotal > 0 && inv.cgst > 0
      ? Math.round((inv.cgst / inv.subtotal) * 2 * 100)
      : (settings?.gstRate || 18);

    const receiptData: ThermalReceiptData = {
      shopName,
      shopAddress: shopAddr,
      shopPhone,
      shopGst,
      shopGstState,
      showGst,
      invoiceNumber: inv.invoiceNumber,
      date: formatDateFull(inv.date),
      orderType: getOrderTypeLabel(inv.orderType),
      customerName: inv.customerName || '',
      customerPhone: inv.customerPhone || '',
      customerAddress: inv.customerAddress || '',
      items: (inv.invoiceItems || []).map(item => ({ name: item.name, qty: item.qty, rate: item.rate, total: item.total })),
      subtotal: inv.subtotal,
      cgst: inv.cgst || 0,
      sgst: inv.sgst || 0,
      gstRate,
      deliveryCharge: inv.deliveryCharge || 0,
      discountAmount: inv.discountAmount || 0,
      grandTotal: inv.grandTotal,
      paidAmount: inv.paidAmount || 0,
      balanceAmount: inv.balanceAmount || 0,
      paymentMethod: inv.paymentMethod || 'Cash',
      billStatus: getStatusLabel(inv.status),
    };

    const thermalHtml = buildRichThermalHtml(receiptData, tConfig, `Receipt - ${inv.invoiceNumber}`);

    try {
      const printWindow = window.open('', '_blank', 'width=350,height=700');
      if (!printWindow) {
        notify({ type: 'error', title: 'Error', message: 'Please allow pop-ups to print thermal receipts' });
        return;
      }
      printWindow.document.write(thermalHtml);
      printWindow.document.close();
      setTimeout(() => {
        printWindow.print();
      }, 600);
    } catch {
      notify({ type: 'error', title: 'Error', message: 'Failed to open print window' });
    }
  };

  // ── A4 Invoice Preview ─────────────────────────────────────
  const renderA4Preview = (inv: Invoice) => {
    const shopName = settings?.shopName || 'Eservices';
    const shopAddr = settings?.shopAddress || '';
    const shopPhone = settings?.shopPhone || '';
    const shopEmail = settings?.shopEmail || '';
    const shopGst = settings?.gstNumber || '';
    const shopGstState = settings?.gstState || '';
    const gstFullMode = settings?.gstFullMode ?? false;
    // Show GST only if the original bill had GST values calculated
    const showGst = (inv.cgst > 0 || inv.sgst > 0);

    return (
      <div className="invoice-container" style={{ fontSize: '13px' }}>
        <div
          className="header"
          style={{
            background: 'linear-gradient(135deg, #16a34a, #15803d)',
            color: 'white',
            padding: '24px 32px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: '24px', fontWeight: 700 }}>{shopName}</div>
            {showGst && gstFullMode && (
              <div style={{
                display: 'inline-block',
                background: 'rgba(255,255,255,0.2)',
                color: '#fff',
                fontSize: '11px',
                fontWeight: 700,
                padding: '3px 12px',
                borderRadius: 4,
                letterSpacing: '1px',
              }}>
                TAX INVOICE
              </div>
            )}
          </div>
          <div style={{ fontSize: '12px', opacity: 0.9, marginTop: 4 }}>
            {[
              shopAddr,
              shopPhone ? `Ph: ${shopPhone}` : '',
              shopEmail,
              (showGst && gstFullMode && shopGst) ? `GSTIN: ${shopGst}` : '',
              (showGst && gstFullMode && shopGstState) ? `State: ${shopGstState}` : '',
            ]
              .filter(Boolean)
              .join(' | ')}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            padding: '20px 32px',
            borderBottom: '1px solid #e5e7eb',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          {[
            { label: 'Invoice No', value: inv.invoiceNumber },
            { label: 'Date', value: formatDate(inv.date) },
            { label: 'Customer', value: inv.customerName || 'Walk-in' },
            { label: 'Phone', value: inv.customerPhone || '-' },
            { label: 'Address', value: inv.customerAddress || '-' },
            { label: 'Order Type', value: getOrderTypeLabel(inv.orderType) },
            { label: 'Payment', value: inv.paymentMethod },
            { label: 'Status', value: getStatusLabel(inv.status) },
          ].map((m) => (
            <div key={m.label}>
              <div
                style={{
                  color: '#6b7280',
                  fontSize: '10px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                {m.label}
              </div>
              <div style={{ fontWeight: 600, marginTop: 2 }}>{m.value}</div>
            </div>
          ))}
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['#', 'Item', 'Qty', 'Rate', 'Total'].map((h, i) => (
                <th
                  key={h}
                  style={{
                    background: '#f9fafb',
                    padding: '10px 16px',
                    fontSize: '11px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    color: '#6b7280',
                    textAlign: i >= 2 ? 'right' : 'left',
                    borderBottom: '2px solid #e5e7eb',
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(inv.invoiceItems || []).map((item, idx) => (
              <tr key={item.id || idx} style={{ background: idx % 2 === 1 ? '#f9fafb' : undefined }}>
                <td style={{ padding: '10px 16px', textAlign: 'center' }}>{idx + 1}</td>
                <td style={{ padding: '10px 16px' }}>{item.name}</td>
                <td style={{ padding: '10px 16px', textAlign: 'right' }}>{item.qty}</td>
                <td style={{ padding: '10px 16px', textAlign: 'right' }}>{formatCurrency(item.rate)}</td>
                <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600 }}>
                  {formatCurrency(item.total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ padding: '16px 32px' }}>
          {[
            { label: 'Subtotal', value: formatCurrency(inv.subtotal) },
            ...(showGst && inv.cgst > 0 ? [{ label: 'CGST', value: formatCurrency(inv.cgst) }] : []),
            ...(showGst && inv.sgst > 0 ? [{ label: 'SGST', value: formatCurrency(inv.sgst) }] : []),
            ...(inv.deliveryCharge > 0
              ? [{ label: 'Delivery', value: formatCurrency(inv.deliveryCharge) }]
              : []),
            ...(inv.discountAmount > 0
              ? [{ label: 'Discount', value: '-' + formatCurrency(inv.discountAmount) }]
              : []),
          ].map((row) => (
            <div
              key={row.label}
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 80,
                padding: '4px 0',
                fontSize: '13px',
              }}
            >
              <span>{row.label}</span>
              <span>{row.value}</span>
            </div>
          ))}
          {(inv.paidAmount || 0) > 0 && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 80,
                padding: '4px 0',
                fontSize: '13px',
              }}
            >
              <span>Amount Paid</span>
              <span>{formatCurrency(inv.paidAmount || 0)}</span>
            </div>
          )}
          {(inv.balanceAmount || 0) > 0 && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 80,
                padding: '4px 0',
                fontSize: '13px',
                color: '#ea580c',
                fontWeight: 600,
              }}
            >
              <span>Balance Due</span>
              <span>{formatCurrency(inv.balanceAmount || 0)}</span>
            </div>
          )}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 80,
              padding: '12px 0 0',
              fontSize: '16px',
              fontWeight: 700,
              borderTop: '2px solid #16a34a',
              marginTop: 8,
            }}
          >
            <span>Grand Total</span>
            <span>{formatCurrency(inv.grandTotal)}</span>
          </div>
        </div>

        <div
          style={{
            padding: '16px 32px',
            textAlign: 'center',
            fontSize: '11px',
            color: '#9ca3af',
            borderTop: '1px solid #e5e7eb',
          }}
        >
          Thank you for your business! | Generated by Eservices
        </div>
      </div>
    );
  };

  // ── Status filter pills ────────────────────────────────────
  const statusPills = [
    { value: 'all', label: 'All' },
    { value: 'pending', label: 'Pending' },
    { value: 'paid', label: 'Paid' },
    { value: 'balance', label: 'Balance' },
    { value: 'refunded', label: 'Refunded' },
    { value: 'replaced', label: 'Replaced' },
    { value: 'cancelled', label: 'Cancelled' },
  ];

  // ── Payment method options ─────────────────────────────────
  const paymentMethods = [
    { value: 'Cash', label: 'Cash', icon: <IndianRupee className="h-4 w-4" /> },
    { value: 'UPI', label: 'UPI', icon: <Smartphone className="h-4 w-4" /> },
    { value: 'Card', label: 'Card', icon: <CreditCard className="h-4 w-4" /> },
    { value: 'Net Banking', label: 'Net Banking', icon: <Building2 className="h-4 w-4" /> },
  ];

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col gap-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/40">
            <Receipt className="size-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">Bill History</h2>
            <p className="text-sm text-muted-foreground">
              View and manage all your invoices
            </p>
          </div>
        </div>
        {isReadOnly && <ReadOnlyBanner module="Billing" noAccess={noAccess} />}
        <div className="flex items-center gap-3">
          {!loading && invoices.length > 0 && (
            <Badge
              variant="secondary"
              className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 border-emerald-200"
            >
              {invoices.length} invoice{invoices.length !== 1 ? 's' : ''}
            </Badge>
          )}
          <Button
            onClick={() => onNavigate('new-bill')}
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
          >
            <FileText className="h-4 w-4" />
            New Bill
          </Button>
        </div>
      </div>

      {/* Search & Filters */}
      <Card className="border-0 bg-muted/30 flex-shrink-0">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            {statusPills.map((pill) => (
              <button
                key={pill.value}
                onClick={() => setStatusFilter(pill.value)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                  statusFilter === pill.value
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                    : 'bg-background hover:bg-muted text-muted-foreground border'
                }`}
              >
                {pill.label}
              </button>
            ))}
            <div className="ml-auto" />
            <button
              onClick={() => setTodayFilter(!todayFilter)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                todayFilter
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                  : 'bg-background hover:bg-muted text-muted-foreground border'
              }`}
            >
              <CalendarCheck className="h-3.5 w-3.5" />
              Today
            </button>
          </div>

          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by invoice number, customer name, or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {(searchQuery || statusFilter !== 'all' || todayFilter) && !loading && (
            <p className="text-xs text-muted-foreground">
              Showing {filteredInvoices.length} of {invoices.length} invoices
            </p>
          )}
        </CardContent>
      </Card>

      {/* Invoice Table */}
      <Card className="flex-1 min-h-0 flex flex-col">
        <CardContent className="p-0 flex-1 min-h-0 flex flex-col">
          {loading ? (
            <div className="p-6 space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-3/4" />
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <div className="rounded-full bg-muted p-5 mb-4">
                <Receipt className="h-10 w-10 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-1">No invoices found</h3>
              <p className="text-sm text-muted-foreground max-w-xs">
                {searchQuery
                  ? `No invoices match "${searchQuery}". Try a different search.`
                  : "You haven't created any invoices yet. Create your first bill to get started."}
              </p>
              {!searchQuery && (
                <Button
                  onClick={() => onNavigate('new-bill')}
                  className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                >
                  <FileText className="h-4 w-4" />
                  Create your first bill
                </Button>
              )}
            </div>
          ) : (
            <ScrollArea className="flex-1 scroll-smooth">
              <div className="min-w-[960px]">
              <Table className="w-full">
                <TableHeader className="sticky top-0 z-10 bg-background">
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="min-w-[130px]">Invoice No</TableHead>
                    <TableHead className="min-w-[100px]">Date</TableHead>
                    <TableHead className="min-w-[150px]">Customer</TableHead>
                    <TableHead className="min-w-[70px] text-center">Items</TableHead>
                    <TableHead className="min-w-[110px] text-right">Grand Total</TableHead>
                    <TableHead className="min-w-[120px] text-right">Balance</TableHead>
                    <TableHead className="min-w-[100px] text-center">Status</TableHead>
                    <TableHead className="min-w-[240px] text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInvoices.map((invoice, idx) => {
                      const status = (invoice.status || '').toLowerCase();
                      const isPending = status === 'pending';
                      const isBalance = status === 'balance';
                      const isPaid = status === 'paid' || status === 'completed';
                      const isRefunded = status === 'refunded';
                      const isReplaced = status === 'replaced';
                      const showBalance = isBalance && (invoice.balanceAmount || 0) > 0;

                      return (
                        <TableRow
                          key={invoice.id}
                          className={`transition-colors ${
                            idx % 2 === 1 ? 'bg-muted/20' : ''
                          } hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20`}
                        >
                          {/* Invoice Number */}
                          <TableCell className="font-semibold text-sm">
                            {invoice.invoiceNumber}
                          </TableCell>

                          {/* Date */}
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDate(invoice.date)}
                          </TableCell>

                          {/* Customer */}
                          <TableCell className="text-sm">
                            <div className="font-medium">{invoice.customerName}</div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <Badge
                                variant="outline"
                                className={`gap-0.5 text-[10px] px-1.5 py-0 ${getOrderTypeBadgeClass(invoice.orderType)}`}
                              >
                                {getOrderTypeIcon(invoice.orderType)}
                                {getOrderTypeLabel(invoice.orderType)}
                              </Badge>
                              {invoice.customerPhone && (
                                <span className="text-xs text-muted-foreground">
                                  {invoice.customerPhone}
                                </span>
                              )}
                            </div>
                          </TableCell>

                          {/* Items Count */}
                          <TableCell className="text-sm text-center text-muted-foreground">
                            {(invoice.invoiceItems || []).length}
                          </TableCell>

                          {/* Grand Total */}
                          <TableCell className="text-sm font-semibold text-right tabular-nums">
                            {formatCurrency(invoice.grandTotal)}
                          </TableCell>

                          {/* Balance Column */}
                          <TableCell className="text-right">
                            {isPaid ? (
                              <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 flex items-center justify-end gap-1">
                                <CircleCheckBig className="h-3.5 w-3.5" />
                                Full
                              </span>
                            ) : showBalance ? (
                              <span
                                className={`text-sm font-semibold tabular-nums ${getBalanceColorClass(invoice)}`}
                              >
                                {formatCurrency(invoice.balanceAmount || 0)}
                              </span>
                            ) : isPending ? (
                              <span className="text-xs text-amber-600 dark:text-amber-400">
                                Unpaid
                              </span>
                            ) : isRefunded || isReplaced ? (
                              <span className="text-xs text-muted-foreground">—</span>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>

                          {/* Status Badge */}
                          <TableCell className="text-center">
                            <Badge
                              variant="outline"
                              className={`gap-1 text-xs ${getStatusColor(invoice.status)}`}
                            >
                              {getStatusIcon(invoice.status)}
                              {getStatusLabel(invoice.status)}
                              {isBalance && showBalance && (
                                <span className="ml-0.5 font-semibold">
                                  {formatCurrency(invoice.balanceAmount || 0)}
                                </span>
                              )}
                            </Badge>
                          </TableCell>

                          {/* Actions */}
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-0.5 flex-wrap">
                              {/* View */}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/30"
                                onClick={() => handleView(invoice)}
                                title="View Invoice"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>

                              {/* Edit */}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 hover:bg-amber-50 hover:text-amber-700 dark:hover:bg-amber-950/30 disabled:opacity-40"
                                onClick={() => handleEdit(invoice)}
                                title={!canEdit ? 'No permission to edit' : 'Edit Invoice'}
                                disabled={!canEdit}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>

                              {/* Update (Pending/Balance) */}
                              {(isPending || isBalance) && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-blue-950/30 disabled:opacity-40"
                                  onClick={() => openUpdateDialog(invoice)}
                                  title={!canEdit ? 'No permission to update' : 'Update Bill'}
                                  disabled={!canEdit}
                                >
                                  <RefreshCw className="h-4 w-4" />
                                </Button>
                              )}

                              {/* Pay Balance */}
                              {showBalance && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 gap-1 text-orange-600 hover:bg-orange-50 hover:text-orange-700 dark:text-orange-400 dark:hover:bg-orange-950/30 px-2 disabled:opacity-40"
                                  onClick={() => openPayBalanceDialog(invoice)}
                                  title={!canEdit ? 'No permission to pay balance' : 'Pay Balance'}
                                  disabled={!canEdit}
                                >
                                  <Wallet className="h-3.5 w-3.5" />
                                  <span className="text-xs font-medium">Pay</span>
                                </Button>
                              )}

                              {/* Refund (only for paid/completed/balance, not already refunded/replaced) */}
                              {!isRefunded && !isReplaced && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/30 disabled:opacity-40"
                                  onClick={() => openRefundDialog(invoice)}
                                  title={!canEdit ? 'No permission to refund' : 'Refund'}
                                  disabled={!canEdit}
                                >
                                  <RotateCcw className="h-4 w-4" />
                                </Button>
                              )}

                              {/* Replace */}
                              {!isRefunded && !isReplaced && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/30 disabled:opacity-40"
                                  onClick={() => openReplaceDialog(invoice)}
                                  title={!canEdit ? 'No permission to replace' : 'Replace Items'}
                                  disabled={!canEdit}
                                >
                                  <ArrowRightLeft className="h-4 w-4" />
                                </Button>
                              )}

                              {/* Print Thermal */}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/30"
                                onClick={() => handleThermalPrint(invoice)}
                                title="Print Thermal"
                              >
                                <Printer className="h-4 w-4" />
                              </Button>

                              {/* Delete */}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/30 disabled:opacity-40"
                                onClick={() => setDeleteTarget(invoice)}
                                title={!canDelete ? 'No permission to delete' : 'Delete Invoice'}
                                disabled={!canDelete}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <ScrollBar orientation="horizontal" />
              </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* ────────────────────────────────────────────────────────
          DIALOG: Invoice View
      ──────────────────────────────────────────────────────── */}
      <Dialog open={!!viewInvoice} onOpenChange={(open) => !open && setViewInvoice(null)}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto p-0">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-emerald-600" />
              Invoice {viewInvoice?.invoiceNumber}
              {viewInvoice && (
                <Badge
                  variant="outline"
                  className={`ml-2 gap-1 ${getStatusColor(viewInvoice.status)}`}
                >
                  {getStatusIcon(viewInvoice.status)}
                  {getStatusLabel(viewInvoice.status)}
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              Full invoice preview for {viewInvoice?.customerName || 'Walk-in'}
            </DialogDescription>
          </DialogHeader>

          {viewLoading ? (
            <div className="p-6 space-y-3">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : viewInvoice ? (
            <>
              <div className="p-6">
                {/* Balance info banner */}
                {(viewInvoice.balanceAmount || 0) > 0 &&
                  (viewInvoice.status || '').toLowerCase() === 'balance' && (
                    <Card className="mb-4 border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/30">
                      <CardContent className="p-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 text-orange-600" />
                          <span className="text-sm font-medium text-orange-700 dark:text-orange-400">
                            Balance Due: {formatCurrency(viewInvoice.balanceAmount || 0)}
                          </span>
                        </div>
                        <Button
                          size="sm"
                          className="bg-orange-600 hover:bg-orange-700 text-white gap-1"
                          onClick={() => {
                            setViewInvoice(null);
                            openPayBalanceDialog(viewInvoice);
                          }}
                        >
                          <Wallet className="h-3.5 w-3.5" />
                          Pay Now
                        </Button>
                      </CardContent>
                    </Card>
                  )}

                <div ref={invoicePreviewRef}>{renderA4Preview(viewInvoice)}</div>
              </div>
              <DialogFooter className="p-6 pt-0 flex-row gap-2 flex-wrap">
                <Button
                  variant="outline"
                  onClick={() => handleThermalPrint(viewInvoice)}
                  className="gap-2"
                >
                  <Printer className="h-4 w-4" />
                  Print Thermal
                </Button>
                <Button
                  onClick={handlePrintA4}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                >
                  <PrinterIcon className="h-4 w-4" />
                  Print A4
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* ────────────────────────────────────────────────────────
          DIALOG: Update Bill (Pending / Balance)
      ──────────────────────────────────────────────────────── */}
      <Dialog
        open={!!updateTarget}
        onOpenChange={(open) => !open && setUpdateTarget(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-blue-600" />
              Update Invoice
            </DialogTitle>
            <DialogDescription>
              Update payment details for{' '}
              <span className="font-semibold text-foreground">
                {updateTarget?.invoiceNumber}
              </span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Current info */}
            <Card className="bg-muted/50 border-0">
              <CardContent className="p-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Customer</span>
                    <p className="font-medium">{updateTarget?.customerName || 'Walk-in'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Total</span>
                    <p className="font-semibold">
                      {updateTarget ? formatCurrency(updateTarget.grandTotal) : ''}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Paid So Far</span>
                    <p className="font-medium text-emerald-600 dark:text-emerald-400">
                      {updateTarget ? formatCurrency(updateTarget.paidAmount || 0) : ''}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Balance</span>
                    <p className="font-medium text-orange-600 dark:text-orange-400">
                      {updateTarget ? formatCurrency(updateTarget.balanceAmount || 0) : ''}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Separator />

            {/* Payment Method */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Payment Method</Label>
              <Select value={updatePaymentMethod} onValueChange={setUpdatePaymentMethod}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {paymentMethods.map((pm) => (
                    <SelectItem key={pm.value} value={pm.value}>
                      <span className="flex items-center gap-2">
                        {pm.icon}
                        {pm.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Update Status</Label>
              <Select value={updateStatus} onValueChange={setUpdateStatus}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pending">
                    <span className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 text-amber-500" />
                      Pending
                    </span>
                  </SelectItem>
                  <SelectItem value="Balance">
                    <span className="flex items-center gap-2">
                      <CircleDollarSign className="h-3.5 w-3.5 text-orange-500" />
                      Balance
                    </span>
                  </SelectItem>
                  <SelectItem value="Paid">
                    <span className="flex items-center gap-2">
                      <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                      Paid
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Balance-specific fields */}
            {updateStatus.toLowerCase() === 'balance' && (
              <div className="space-y-3 rounded-lg border border-orange-200 bg-orange-50/50 p-3 dark:border-orange-800 dark:bg-orange-950/20">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Amount Paid</Label>
                  <div className="relative">
                    <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="number"
                      min="0"
                      max={updateTarget?.grandTotal || 0}
                      step="0.01"
                      value={updateAmountPaid}
                      onChange={(e) => setUpdateAmountPaid(e.target.value)}
                      className="pl-9"
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Remaining Balance:</span>
                  <span className="font-semibold text-orange-600 dark:text-orange-400">
                    {updateTarget
                      ? formatCurrency(
                          Math.max(
                            (updateTarget.grandTotal || 0) -
                              (parseFloat(updateAmountPaid) || 0),
                            0
                          )
                        )
                      : '₹0.00'}
                  </span>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setUpdateTarget(null)}
              disabled={updating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={updating}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            >
              {updating && <RefreshCw className="h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ────────────────────────────────────────────────────────
          DIALOG: Pay Balance
      ──────────────────────────────────────────────────────── */}
      <Dialog
        open={!!payBalanceTarget}
        onOpenChange={(open) => !open && setPayBalanceTarget(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-orange-600" />
              Pay Balance
            </DialogTitle>
            <DialogDescription>
              Record a payment for{' '}
              <span className="font-semibold text-foreground">
                {payBalanceTarget?.invoiceNumber}
              </span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Balance info */}
            <Card className="border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/30">
              <CardContent className="p-4">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-1">Current Balance Due</p>
                  <p className="text-2xl font-bold text-orange-700 dark:text-orange-400">
                    {payBalanceTarget
                      ? formatCurrency(payBalanceTarget.balanceAmount || 0)
                      : '₹0.00'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Total: {payBalanceTarget ? formatCurrency(payBalanceTarget.grandTotal) : ''} •
                    Paid:{' '}
                    {payBalanceTarget
                      ? formatCurrency(payBalanceTarget.paidAmount || 0)
                      : ''}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Payment Amount */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Payment Amount</Label>
              <div className="relative">
                <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="number"
                  min="0.01"
                  max={payBalanceTarget?.balanceAmount || 0}
                  step="0.01"
                  value={payBalanceAmount}
                  onChange={(e) => setPayBalanceAmount(e.target.value)}
                  className="pl-9 text-lg font-semibold"
                  placeholder="0.00"
                />
              </div>
              {payBalanceTarget && (
                <p className="text-xs text-muted-foreground">
                  Max: {formatCurrency(payBalanceTarget.balanceAmount || 0)}
                </p>
              )}
            </div>

            {/* Payment Method */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Payment Method</Label>
              <Select value={payBalanceMethod} onValueChange={setPayBalanceMethod}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {paymentMethods.map((pm) => (
                    <SelectItem key={pm.value} value={pm.value}>
                      <span className="flex items-center gap-2">
                        {pm.icon}
                        {pm.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Preview */}
            {payBalanceTarget && parseFloat(payBalanceAmount) > 0 && (
              <Card className="bg-muted/50 border-0">
                <CardContent className="p-3">
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Bill</span>
                      <span>{formatCurrency(payBalanceTarget.grandTotal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Already Paid</span>
                      <span className="text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(payBalanceTarget.paidAmount || 0)}
                      </span>
                    </div>
                    <Separator />
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">This Payment</span>
                      <span className="font-medium">
                        {formatCurrency(parseFloat(payBalanceAmount) || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between font-semibold">
                      <span>Remaining After Payment</span>
                      <span
                        className={
                          (payBalanceTarget.balanceAmount || 0) -
                            parseFloat(payBalanceAmount || '0') <=
                          0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-orange-600 dark:text-orange-400'
                        }
                      >
                        {formatCurrency(
                          Math.max(
                            (payBalanceTarget.balanceAmount || 0) -
                              (parseFloat(payBalanceAmount) || 0),
                            0
                          )
                        )}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setPayBalanceTarget(null)}
              disabled={payingBalance}
            >
              Cancel
            </Button>
            <Button
              onClick={handlePayBalance}
              disabled={payingBalance}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            >
              {payingBalance && <RefreshCw className="h-4 w-4 animate-spin" />}
              Record Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ────────────────────────────────────────────────────────
          DIALOG: Refund
      ──────────────────────────────────────────────────────── */}
      <Dialog
        open={!!refundTarget}
        onOpenChange={(open) => {
          if (!open) {
            setRefundTarget(null);
            setRefundSelectedItems(new Set());
            setRefundReason('');
          }
        }}
      >
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-red-600" />
              Process Refund
            </DialogTitle>
            <DialogDescription>
              Select items to refund from invoice{' '}
              <span className="font-semibold text-foreground">
                {refundTarget?.invoiceNumber}
              </span>
            </DialogDescription>
          </DialogHeader>

          {/* Bill Info */}
          <Card className="bg-muted/50 border-0 flex-shrink-0">
            <CardContent className="p-3">
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground text-xs">Invoice</span>
                  <p className="font-medium">{refundTarget?.invoiceNumber}</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">Date</span>
                  <p className="font-medium">
                    {refundTarget ? formatDate(refundTarget.date) : ''}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">Customer</span>
                  <p className="font-medium">{refundTarget?.customerName || 'Walk-in'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Items List */}
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-2 flex-shrink-0">
              <Label className="text-sm font-medium">Select Items to Refund</Label>
              <button
                onClick={toggleSelectAllRefundItems}
                className="text-xs text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 font-medium"
              >
                {refundSelectedItems.size === (refundTarget?.invoiceItems.length || 0)
                  ? 'Deselect All'
                  : 'Select All'}
              </button>
            </div>

            <ScrollArea className="flex-1 max-h-60">
              <div className="space-y-1 pr-2">
                {(refundTarget?.invoiceItems || []).map((item, idx) => {
                  const isSelected = refundSelectedItems.has(idx);
                  return (
                    <div
                      key={item.id || idx}
                      className={`flex items-center gap-3 p-2.5 rounded-lg border transition-colors cursor-pointer ${
                        isSelected
                          ? 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/30'
                          : 'border-transparent hover:bg-muted/50'
                      }`}
                      onClick={() => toggleRefundItem(idx)}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleRefundItem(idx)}
                        className="data-[state=checked]:bg-red-600 data-[state=checked]:border-red-600"
                      />
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-sm font-medium truncate ${
                            isSelected
                              ? 'text-red-700 dark:text-red-400'
                              : ''
                          }`}
                        >
                          {item.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {item.qty} × {formatCurrency(item.rate)}
                        </p>
                      </div>
                      <span
                        className={`text-sm font-semibold tabular-nums ${
                          isSelected
                            ? 'text-red-700 dark:text-red-400'
                            : 'text-muted-foreground'
                        }`}
                      >
                        {formatCurrency(item.total)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            {/* Refund Summary */}
            {refundSelectedItems.size > 0 && (
              <div className="flex-shrink-0 mt-3 p-3 rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-red-700 dark:text-red-400">
                    {refundSelectedItems.size} item(s) selected
                  </span>
                  <span className="text-lg font-bold text-red-700 dark:text-red-400">
                    {formatCurrency(refundTotal)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Reason */}
          <div className="flex-shrink-0 space-y-2 mt-3">
            <Label className="text-sm font-medium">Reason (optional)</Label>
            <Textarea
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              placeholder="Enter reason for refund..."
              className="resize-none"
              rows={2}
            />
          </div>

          <DialogFooter className="gap-2 flex-shrink-0">
            <Button
              variant="outline"
              onClick={() => {
                setRefundTarget(null);
                setRefundSelectedItems(new Set());
                setRefundReason('');
              }}
              disabled={processingRefund}
            >
              Cancel
            </Button>
            <Button
              onClick={handleProcessRefund}
              disabled={processingRefund || refundSelectedItems.size === 0}
              className="bg-red-600 hover:bg-red-700 text-white gap-2"
            >
              {processingRefund && <RefreshCw className="h-4 w-4 animate-spin" />}
              Process Refund
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ────────────────────────────────────────────────────────
          DIALOG: Replace
      ──────────────────────────────────────────────────────── */}
      <Dialog
        open={!!replaceTarget}
        onOpenChange={(open) => {
          if (!open) {
            setReplaceTarget(null);
            setReplaceSelectedItems(new Set());
            setReplaceReason('');
          }
        }}
      >
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5 text-emerald-600" />
              Replace Items
            </DialogTitle>
            <DialogDescription>
              Select items to replace from invoice{' '}
              <span className="font-semibold text-foreground">
                {replaceTarget?.invoiceNumber}
              </span>
              . A refund will be created and the invoice will be marked as replaced.
            </DialogDescription>
          </DialogHeader>

          {/* Bill Info */}
          <Card className="bg-muted/50 border-0 flex-shrink-0">
            <CardContent className="p-3">
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground text-xs">Invoice</span>
                  <p className="font-medium">{replaceTarget?.invoiceNumber}</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">Date</span>
                  <p className="font-medium">
                    {replaceTarget ? formatDate(replaceTarget.date) : ''}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">Customer</span>
                  <p className="font-medium">{replaceTarget?.customerName || 'Walk-in'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Info Banner */}
          <Card className="border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30 flex-shrink-0">
            <CardContent className="p-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-emerald-700 dark:text-emerald-400">
                  Replacing items will create a refund for the selected items and mark this
                  invoice as <span className="font-semibold">Replaced</span>. You can then
                  create a new bill for the replacement order in the New Bill section.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Items List */}
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-2 flex-shrink-0">
              <Label className="text-sm font-medium">Select Items to Replace</Label>
              <button
                onClick={toggleSelectAllReplaceItems}
                className="text-xs text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 font-medium"
              >
                {replaceSelectedItems.size === (replaceTarget?.invoiceItems.length || 0)
                  ? 'Deselect All'
                  : 'Select All'}
              </button>
            </div>

            <ScrollArea className="flex-1 max-h-60">
              <div className="space-y-1 pr-2">
                {(replaceTarget?.invoiceItems || []).map((item, idx) => {
                  const isSelected = replaceSelectedItems.has(idx);
                  return (
                    <div
                      key={item.id || idx}
                      className={`flex items-center gap-3 p-2.5 rounded-lg border transition-colors cursor-pointer ${
                        isSelected
                          ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30'
                          : 'border-transparent hover:bg-muted/50'
                      }`}
                      onClick={() => toggleReplaceItem(idx)}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleReplaceItem(idx)}
                        className="data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                      />
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-sm font-medium truncate ${
                            isSelected
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : ''
                          }`}
                        >
                          {item.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {item.qty} × {formatCurrency(item.rate)}
                        </p>
                      </div>
                      <span
                        className={`text-sm font-semibold tabular-nums ${
                          isSelected
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-muted-foreground'
                        }`}
                      >
                        {formatCurrency(item.total)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            {/* Replace Summary */}
            {replaceSelectedItems.size > 0 && (
              <div className="flex-shrink-0 mt-3 p-3 rounded-lg border border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-emerald-700 dark:text-emerald-400">
                    {replaceSelectedItems.size} item(s) selected for replacement
                  </span>
                  <span className="text-lg font-bold text-emerald-700 dark:text-emerald-400">
                    {formatCurrency(replaceTotal)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Reason Select */}
          <div className="flex-shrink-0 space-y-2 mt-3">
            <Label className="text-sm font-medium">Replacement Reason *</Label>
            <Select value={replaceReason} onValueChange={setReplaceReason}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a reason..." />
              </SelectTrigger>
              <SelectContent>
                {replaceReasons.map((reason) => (
                  <SelectItem key={reason} value={reason}>
                    {reason}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="gap-2 flex-shrink-0">
            <Button
              variant="outline"
              onClick={() => {
                setReplaceTarget(null);
                setReplaceSelectedItems(new Set());
                setReplaceReason('');
              }}
              disabled={processingReplace}
            >
              Cancel
            </Button>
            <Button
              onClick={handleProcessReplace}
              disabled={processingReplace || replaceSelectedItems.size === 0 || !replaceReason}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            >
              {processingReplace && <RefreshCw className="h-4 w-4 animate-spin" />}
              Process Replace
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ────────────────────────────────────────────────────────
          ALERT: Delete Confirmation
      ──────────────────────────────────────────────────────── */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Invoice</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete invoice{' '}
              <span className="font-semibold text-foreground">
                {deleteTarget?.invoiceNumber}
              </span>
              ? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
