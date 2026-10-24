'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { notify } from '@/lib/notification-store';
import {
  Plus,
  Trash2,
  Printer,
  Loader2,
  FileText,
  Receipt,
  Banknote,
  Smartphone,
  CreditCard,
  Globe,
  RotateCcw,
  CheckCircle2,
  Truck,
  UtensilsCrossed,
  ShoppingBag,
  Search,
  ChevronLeft,
  ChevronRight,
  PackageOpen,
  X,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { fetchThermalSettings, buildRichThermalHtml, type ThermalReceiptData } from '@/lib/thermal-settings';
import { useAuth } from '@/components/auth-provider';
import { useFeature } from '@/hooks/use-feature';
import ReadOnlyBanner from '@/components/read-only-banner';

/* ═══════════════════════════════════════════
   Types
   ═══════════════════════════════════════════ */

interface BillGeneratorSectionProps {
  onNavigate: (page: string) => void;
  onRefreshData: () => void;
  editInvoice?: any;
  onClearEditInvoice?: () => void;
}

interface Settings {
  shopName: string;
  shopAddress: string;
  shopPhone: string;
  shopEmail?: string;
  authorizedSignatory?: string;
  gstNumber?: string;
  gstState?: string;
  gstFullMode?: boolean;
  gstSimpleMode?: boolean;
  deliveryCharge: number;
  gstRate: number;
  enableGst: boolean;
  enableDelivery?: boolean;
}

interface OrderItem {
  id: string;
  itemId?: string;  // Links to inventory Item for stock tracking
  name: string;
  qty: number;
  rate: number;
  total: number;
  customNote?: string;  // Item-level customization note (feature-gated)
}

interface MenuItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl: string;
  categoryId: string;
  categoryName: string;
}

interface Category {
  id: string;
  name: string;
}

interface GeneratedInvoice {
  id: string;
  invoiceNumber: string;
}

/* ═══════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════ */

function formatCurrency(amount: number): string {
  return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatInvoiceNumber(raw: string): string {
  if (!raw) return '';
  if (/^FP-/i.test(raw)) return raw;
  const num = parseInt(raw, 10);
  if (!isNaN(num)) return `FP-${String(num).padStart(4, '0')}`;
  return raw;
}

function todayDateStr(): string {
  return new Date().toLocaleDateString('en-CA');
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

/* ═══════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════ */

const ORDER_TYPES = [
  { value: 'Dine-In', label: 'Dine-In', icon: UtensilsCrossed },
  { value: 'Takeaway', label: 'Takeaway', icon: ShoppingBag },
  { value: 'Delivery', label: 'Delivery', icon: Truck },
] as const;

const PAYMENT_METHODS = [
  { value: 'Cash', label: 'Cash', icon: Banknote },
  { value: 'UPI', label: 'UPI', icon: Smartphone },
  { value: 'Card', label: 'Card', icon: CreditCard },
  { value: 'Net Banking', label: 'Net Banking', icon: Globe },
] as const;

const STEPS = [
  { label: 'Invoice', icon: FileText },
  { label: 'Customer', icon: null },
  { label: 'Items', icon: null },
  { label: 'Payment', icon: null },
] as const;

const CATEGORY_COLORS = [
  '#16a34a', '#0891b2', '#d97706', '#dc2626', '#7c3aed',
  '#db2777', '#059669', '#4f46e5', '#ea580c', '#2563eb',
];

/* ═══════════════════════════════════════════
   Animation Variants
   ═══════════════════════════════════════════ */

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 300 : -300,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -300 : 300,
    opacity: 0,
  }),
};

/* ═══════════════════════════════════════════
   Component
   ═══════════════════════════════════════════ */

export default function BillGeneratorSection({
  onNavigate,
  onRefreshData,
  editInvoice,
  onClearEditInvoice,
}: BillGeneratorSectionProps) {
  const { token, hasPermission } = useAuth();
  const { isFeatureEnabled } = useFeature();
  const authHeaders = useMemo<Record<string, string>>(() => token ? { 'Authorization': `Bearer ${token}` } : {} as Record<string, string>, [token]);
  const canAccess = hasPermission('billing', 'access');
  const canCreate = hasPermission('billing', 'create');
  const canEdit = hasPermission('billing', 'edit');
  const canDelete = hasPermission('billing', 'delete');
  const noAccess = !canAccess;
  const isReadOnly = !canAccess || (!canCreate && !canEdit);

  /* ─── Wizard State ─── */
  const [currentStep, setCurrentStep] = useState(1);
  const [direction, setDirection] = useState(1);

  /* ─── Loading States ─── */
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [itemsLoading, setItemsLoading] = useState(false);

  /* ─── Data ─── */
  const [settings, setSettings] = useState<Settings | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  /* ─── Invoice Details (Step 1) ─── */
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(todayDateStr());
  const [orderType, setOrderType] = useState<string>('Dine-In');
  const [billAutoGenerate, setBillAutoGenerate] = useState(false);

  /* ─── Customer (Step 2) ─── */
  const [customerName, setCustomerName] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  /* ─── Items (Step 3) ─── */
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  /* ─── Billing (Step 4) ─── */
  const [enableDelivery, setEnableDelivery] = useState(false);
  const [deliveryChargeAmount, setDeliveryChargeAmount] = useState(0);
  const [enableGst, setEnableGst] = useState(false);
  const [discount, setDiscount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [billStatus, setBillStatus] = useState('Pending');
  const [paidAmount, setPaidAmount] = useState<number>(0);

  /* ─── Feature-gated state ─── */
  const [customizingItemId, setCustomizingItemId] = useState<string | null>(null);

  /* ─── Success ─── */
  const [generatedInvoice, setGeneratedInvoice] = useState<GeneratedInvoice | null>(null);
  const editInvoiceIdRef = useRef<string | null>(null);
  const isEditRef = useRef(false);

  /* ═══════════════════════════════════════════
     Data Fetching
     ═══════════════════════════════════════════ */

  const fetchInitialData = useCallback(async () => {
    setLoading(true);
    try {
      const [settingsRes, nextNumRes, billNumRes] = await Promise.all([
        fetch('/api/settings', { headers: authHeaders }),
        fetch('/api/invoices/next-number', { headers: authHeaders }),
        fetch('/api/settings/bill-number', { headers: authHeaders }),
      ]);

      if (settingsRes.ok) {
        const data = await settingsRes.json();
        setSettings(data);
        // Auto-enable Delivery Charge if enabled in Settings
        if (data.enableDelivery) {
          setEnableDelivery(true);
          setDeliveryChargeAmount(data.deliveryCharge || 0);
        }
        // Auto-enable GST if enabled in Settings
        if (data.enableGst) {
          setEnableGst(true);
        }
      }

      // Check if auto bill number generation is enabled
      if (billNumRes.ok) {
        const billNumData = await billNumRes.json();
        if (billNumData.autoGenerate) {
          setBillAutoGenerate(true);
          setInvoiceNumber(billNumData.nextNumber || '');
        } else if (nextNumRes.ok) {
          const data = await nextNumRes.json();
          setInvoiceNumber(formatInvoiceNumber(data.nextNumber || ''));
        }
      } else if (nextNumRes.ok) {
        const data = await nextNumRes.json();
        setInvoiceNumber(formatInvoiceNumber(data.nextNumber || ''));
      }
    } catch {
      notify({ type: 'error', title: 'Error', message: 'Failed to load initial data' });
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

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

  /* ─── Load edit invoice ─── */
  useEffect(() => {
    if (editInvoice) {
      isEditRef.current = true;
      editInvoiceIdRef.current = editInvoice.id;
      setInvoiceNumber(editInvoice.invoiceNumber || '');
      setInvoiceDate(editInvoice.date || todayDateStr());
      setOrderType(editInvoice.orderType || 'Dine-In');
      setCustomerName(editInvoice.customerName || '');
      setCustomerAddress(editInvoice.customerAddress || '');
      setCustomerPhone(editInvoice.customerPhone || '');
      setPaymentMethod(editInvoice.paymentMethod || 'Cash');
      setBillStatus(editInvoice.status || 'Pending');
      setPaidAmount(editInvoice.paidAmount || 0);
      setEnableDelivery((editInvoice.deliveryCharge || 0) > 0);
      setDeliveryChargeAmount(editInvoice.deliveryCharge || 0);
      setEnableGst((editInvoice.cgst || 0) > 0 || (editInvoice.sgst || 0) > 0);
      setDiscount(editInvoice.discountAmount || 0);

      if (editInvoice.invoiceItems && Array.isArray(editInvoice.invoiceItems)) {
        const loaded: OrderItem[] = editInvoice.invoiceItems
          .filter((item: any) => item.name && item.name.trim())
          .map((item: any) => ({
            id: generateId(),
            itemId: item.itemId || '',
            name: item.name,
            qty: item.qty || 1,
            rate: item.rate || 0,
            total: item.total ?? (item.qty * item.rate),
            customNote: item.customNote || '',
          }));
        setOrderItems(loaded.length > 0 ? loaded : []);
      }

      // Navigate to Step 2 to edit — do NOT set generatedInvoice (that hides nav buttons)
      setCurrentStep(2);
      notify({ type: 'info', title: 'Editing', message: `Editing ${editInvoice.invoiceNumber}` });
      onClearEditInvoice?.();
    }
  }, [editInvoice, onClearEditInvoice]);

  /* ─── Init ─── */
  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  /* ─── Fetch items when entering step 3 ─── */
  const menuFetchedRef = useRef(false);
  useEffect(() => {
    if (currentStep === 3 && !menuFetchedRef.current) {
      menuFetchedRef.current = true;
      fetchMenuItems();
    }
    if (currentStep !== 3) {
      menuFetchedRef.current = false;
    }
  }, [currentStep, fetchMenuItems]);

  /* ═══════════════════════════════════════════
     Calculations
     ═══════════════════════════════════════════ */

  const calculations = useMemo(() => {
    const subtotal = orderItems.reduce((sum, item) => sum + item.total, 0);
    const gstRate = settings?.gstRate ?? 18;
    const cgst = enableGst ? (subtotal * gstRate) / 200 : 0;
    const sgst = enableGst ? (subtotal * gstRate) / 200 : 0;
    const deliveryCharge = enableDelivery ? deliveryChargeAmount : 0;
    const discountAmount = Math.min(discount || 0, subtotal + cgst + sgst + deliveryCharge);
    const grandTotal = Math.max(subtotal + cgst + sgst + deliveryCharge - discountAmount, 0);
    const balanceAmount = billStatus === 'Balance' ? Math.max(grandTotal - (paidAmount || 0), 0) : 0;
    return { subtotal, gstRate, cgst, sgst, deliveryCharge, discountAmount, grandTotal, balanceAmount };
  }, [orderItems, settings, enableGst, enableDelivery, deliveryChargeAmount, discount, billStatus, paidAmount]);

  /* ═══════════════════════════════════════════
     Step Navigation
     ═══════════════════════════════════════════ */

  const goToStep = useCallback((step: number) => {
    if (step < 1 || step > 4) return;
    setDirection(step > currentStep ? 1 : -1);
    setCurrentStep(step);
  }, [currentStep]);

  const goNext = useCallback(() => {
    goToStep(currentStep + 1);
  }, [currentStep, goToStep]);

  const goBack = useCallback(() => {
    goToStep(currentStep - 1);
  }, [currentStep, goToStep]);

  /* ═══════════════════════════════════════════
     Items Management (POS Grid)
     ═══════════════════════════════════════════ */

  const addMenuItem = useCallback((menuItem: MenuItem) => {
    setOrderItems((prev) => {
      const existing = prev.find((item) => item.name === menuItem.name);
      if (existing) {
        return prev.map((item) =>
          item.name === menuItem.name
            ? { ...item, qty: item.qty + 1, total: (item.qty + 1) * item.rate }
            : item
        );
      }
      return [...prev, {
        id: generateId(),
        itemId: menuItem.id,  // Track which inventory item this is for stock deduction
        name: menuItem.name,
        qty: 1,
        rate: menuItem.price,
        total: menuItem.price,
      }];
    });
    notify({ type: 'success', title: 'Added', message: `Added ${menuItem.name}` });
  }, []);

  const updateOrderItemQty = useCallback((id: string, delta: number) => {
    setOrderItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const newQty = Math.max(1, item.qty + delta);
        return { ...item, qty: newQty, total: newQty * item.rate };
      })
    );
  }, []);

  const updateOrderItemRate = useCallback((id: string, newRate: number) => {
    setOrderItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const rate = Math.max(0, newRate);
        return { ...item, rate, total: item.qty * rate };
      })
    );
  }, []);

  const removeOrderItem = useCallback((id: string) => {
    setOrderItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const updateOrderItemNote = useCallback((id: string, note: string) => {
    setOrderItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, customNote: note } : item
      )
    );
  }, []);

  const clearAllItems = useCallback(() => {
    setOrderItems([]);
    notify({ type: 'info', title: 'Cleared', message: 'All items cleared' });
  }, []);

  /* ═══════════════════════════════════════════
     Filtered & Grouped Items for POS Grid
     ═══════════════════════════════════════════ */

  const filteredItems = useMemo(() => {
    let items = menuItems;
    if (selectedCategory !== 'all') {
      items = items.filter((item) => item.categoryId === selectedCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter((item) => item.name.toLowerCase().includes(q));
    }
    return items;
  }, [menuItems, selectedCategory, searchQuery]);

  const groupedItems = useMemo(() => {
    const groups: Record<string, MenuItem[]> = {};
    filteredItems.forEach((item) => {
      const key = item.categoryName || 'Uncategorized';
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredItems]);

  const categoryColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    categories.forEach((cat, idx) => {
      map[cat.name] = CATEGORY_COLORS[idx % CATEGORY_COLORS.length];
    });
    map['Uncategorized'] = '#6b7280';
    return map;
  }, [categories]);

  /* ═══════════════════════════════════════════
     Generate Bill
     ═══════════════════════════════════════════ */

  const handleGenerate = async () => {
    const validItems = orderItems.filter((item) => item.name.trim() !== '' && item.qty > 0 && item.rate > 0);
    if (validItems.length === 0) {
      notify({ type: 'error', title: 'Error', message: 'Add at least one item with name, qty and price' });
      return;
    }

    setSubmitting(true);
    try {
      // If auto bill number is enabled and this is a new invoice (not edit),
      // claim the next bill number atomically from the server
      let finalInvoiceNumber = invoiceNumber.trim();
      if (billAutoGenerate && !isEditRef.current) {
        try {
          const claimRes = await fetch('/api/settings/bill-number', {
            method: 'POST',
            headers: authHeaders,
          });
          if (claimRes.ok) {
            const claimData = await claimRes.json();
            finalInvoiceNumber = claimData.billNumber;
          } else {
            // Fallback: use the current invoice number if claim fails
            console.warn('Bill number claim failed, using current number');
          }
        } catch {
          // Network error, use current number
        }
      }

      const body = {
        invoiceNumber: finalInvoiceNumber,
        date: invoiceDate,
        customerName: customerName.trim() || 'Walk-in',
        customerAddress: customerAddress.trim(),
        customerPhone: customerPhone.trim(),
        paymentMethod,
        status: billStatus,
        orderType,
        subtotal: calculations.subtotal,
        cgst: calculations.cgst,
        sgst: calculations.sgst,
        deliveryCharge: calculations.deliveryCharge,
        discountAmount: calculations.discountAmount,
        grandTotal: calculations.grandTotal,
        paidAmount: billStatus === 'Balance' ? paidAmount || 0 : billStatus === 'Paid' ? calculations.grandTotal : 0,
        balanceAmount: billStatus === 'Balance' ? calculations.balanceAmount : 0,
        invoiceItems: validItems.map((item) => ({
          itemId: item.itemId || '',
          name: item.name,
          qty: item.qty,
          rate: item.rate,
          total: item.total,
          customNote: item.customNote || '',
        })),
      };

      let res: Response;
      if (isEditRef.current && editInvoiceIdRef.current) {
        res = await fetch(`/api/invoices/${editInvoiceIdRef.current}`, {
          method: 'PUT',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch('/api/invoices', {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      }

      if (res.ok) {
        const data = await res.json();
        const invNum = data.invoiceNumber || invoiceNumber;
        const wasEdit = isEditRef.current;
        setGeneratedInvoice({ id: data.id || editInvoiceIdRef.current || '', invoiceNumber: invNum });
        isEditRef.current = false;
        editInvoiceIdRef.current = null;
        notify({ type: 'success', title: wasEdit ? 'Invoice Updated' : 'Bill Generated', message: `${wasEdit ? 'Invoice Updated' : 'Bill Generated'} — ${invNum}` });
        // Show stock deduction feedback
        if (data.stockUpdates && data.stockUpdates.length > 0) {
          const stockMsg = data.stockUpdates.map((s: { name: string; deducted: number; remaining: number }) =>
            `${s.name}: -${s.deducted} (→ ${s.remaining})`
          ).join(', ');
          setTimeout(() => notify({ type: 'info', title: 'Stock Updated', message: `Stock updated: ${stockMsg}` }), 500);
        }
        // Refresh menu items to update stock display in POS grid
        menuFetchedRef.current = false;
        fetchMenuItems();
        setTimeout(() => onRefreshData(), 100);
      } else {
        const data = await res.json();
        notify({ type: 'error', title: 'Error', message: data.error || 'Failed to save invoice' });
      }
    } catch {
      notify({ type: 'error', title: 'Error', message: 'Network error while saving invoice' });
    } finally {
      setSubmitting(false);
    }
  };

  /* ─── New Invoice ─── */
  const handleNewInvoice = async () => {
    setGeneratedInvoice(null);
    setOrderItems([]);
    setCustomerName('');
    setCustomerAddress('');
    setCustomerPhone('');
    setDiscount(0);
    setBillStatus('Pending');
    setPaidAmount(0);
    setPaymentMethod('Cash');
    setOrderType('Dine-In');
    setInvoiceDate(todayDateStr());
    // Apply settings defaults for GST and Delivery
    setEnableGst(settings?.enableGst ?? false);
    setEnableDelivery(settings?.enableDelivery ?? false);
    setDeliveryChargeAmount(settings?.deliveryCharge || 0);
    setCurrentStep(1);
    setDirection(1);
    isEditRef.current = false;
    editInvoiceIdRef.current = null;
    try {
      // Check auto bill number first, then fallback to FP format
      const billNumRes = await fetch('/api/settings/bill-number', { headers: authHeaders });
      if (billNumRes.ok) {
        const billNumData = await billNumRes.json();
        if (billNumData.autoGenerate) {
          setInvoiceNumber(billNumData.nextNumber || '');
        } else {
          const res = await fetch('/api/invoices/next-number', { headers: authHeaders });
          if (res.ok) {
            const data = await res.json();
            setInvoiceNumber(formatInvoiceNumber(data.nextNumber || ''));
          }
        }
      } else {
        const res = await fetch('/api/invoices/next-number', { headers: authHeaders });
        if (res.ok) {
          const data = await res.json();
          setInvoiceNumber(formatInvoiceNumber(data.nextNumber || ''));
        }
      }
    } catch {
      // ignore
    }
  };

  /* ═══════════════════════════════════════════
     Print Functions
     ═══════════════════════════════════════════ */

  const printA4Invoice = useCallback(() => {
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const shopName = settings?.shopName || 'Eservices';
    const shopAddress = settings?.shopAddress || '';
    const shopPhone = settings?.shopPhone || '';
    const authSignatory = settings?.authorizedSignatory || '';
    const gstNumber = settings?.gstNumber || '';
    const gstState = settings?.gstState || '';
    const gstFullMode = settings?.gstFullMode ?? false;
    const gstSimpleMode = settings?.gstSimpleMode ?? false;
    // Show GST ONLY when the per-bill GST toggle is explicitly ON
    const showGst = enableGst === true;
    const validItems = orderItems.filter((item) => item.name.trim() !== '' && item.qty > 0 && item.rate > 0);

    let itemsHtml = '';
    validItems.forEach((item, index) => {
      const bg = index % 2 === 0 ? '' : ' style="background:#f9fafb;"';
      itemsHtml += `<tr${bg}>
        <td style="padding:10px 16px;font-size:13px;border-bottom:1px solid #f3f4f6;">${esc(item.name)}</td>
        <td style="padding:10px 16px;font-size:13px;text-align:center;border-bottom:1px solid #f3f4f6;">${item.qty}</td>
        <td style="padding:10px 16px;font-size:13px;text-align:right;border-bottom:1px solid #f3f4f6;">${formatCurrency(item.rate)}</td>
        <td style="padding:10px 16px;font-size:13px;text-align:right;border-bottom:1px solid #f3f4f6;font-weight:600;">${formatCurrency(item.total)}</td>
      </tr>`;
    });

    const taxInvoiceBadge = (enableGst === true && gstFullMode) ? `<div style="display:inline-block;background:rgba(255,255,255,0.2);color:#fff;font-size:11px;font-weight:700;padding:3px 12px;border-radius:4px;letter-spacing:1px;margin-left:12px;vertical-align:middle;">TAX INVOICE</div>` : '';

    const gstinLine = (enableGst === true && gstFullMode && gstNumber) ? `<div class="shop-info">GSTIN: ${esc(gstNumber)}</div>` : '';
    const gstStateLine = (enableGst === true && gstFullMode && gstState) ? `<div class="shop-info">State: ${esc(gstState)}</div>` : '';

    const html = `<!DOCTYPE html><html><head><title>Invoice ${invoiceNumber}</title>
      <style>
        @page { size: A4; margin: 10mm; }
        body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 20px; color: #1a1a1a; }
        * { box-sizing: border-box; }
        .container { max-width: 210mm; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; }
        .header { background: linear-gradient(135deg, #16a34a, #15803d); color: white; padding: 28px 32px; }
        .shop-name { font-size: 26px; font-weight: 700; display: inline-block; vertical-align: middle; }
        .shop-info { font-size: 12px; opacity: 0.9; margin-top: 6px; }
        .meta { display: flex; justify-content: space-between; padding: 20px 32px; border-bottom: 1px solid #e5e7eb; flex-wrap: wrap; gap: 12px; }
        .meta-block { }
        .meta-label { color: #6b7280; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
        .meta-value { font-weight: 600; margin-top: 2px; font-size: 14px; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #f9fafb; padding: 10px 16px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; text-align: left; border-bottom: 2px solid #e5e7eb; }
        th:last-child, td:last-child { text-align: right; }
        th:nth-child(3), td:nth-child(3) { text-align: right; }
        th:nth-child(2), td:nth-child(2) { text-align: center; }
        .summary { padding: 16px 32px; }
        .summary-row { display: flex; justify-content: flex-end; gap: 80px; padding: 5px 0; font-size: 13px; }
        .summary-total { display: flex; justify-content: flex-end; gap: 80px; padding: 14px 0 0; font-size: 17px; font-weight: 700; border-top: 2px solid #16a34a; margin-top: 8px; }
        .footer { padding: 16px 32px; text-align: center; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; }
        .footer-green { color: #16a34a; font-weight: 600; font-size: 14px; }
        .sign { display: flex; justify-content: flex-end; padding: 32px; }
        .sign-line { width: 200px; text-align: center; }
        .sign-line::before { content: ''; display: block; border-bottom: 1px solid #1a1a1a; margin-bottom: 8px; }
        .sign-label { font-size: 12px; color: #6b7280; }
      </style>
    </head><body>
      <div class="container">
        <div class="header">
          <div>${esc(shopName)}${taxInvoiceBadge}</div>
          ${shopAddress ? `<div class="shop-info">${esc(shopAddress)}</div>` : ''}
          ${shopPhone ? `<div class="shop-info">Phone: ${esc(shopPhone)}</div>` : ''}
          ${gstinLine}
          ${gstStateLine}
        </div>
        <div class="meta">
          <div class="meta-block"><div class="meta-label">Invoice Number</div><div class="meta-value">${esc(invoiceNumber)}</div></div>
          <div class="meta-block"><div class="meta-label">Date</div><div class="meta-value">${esc(invoiceDate)}</div></div>
          <div class="meta-block"><div class="meta-label">Order Type</div><div class="meta-value">${esc(orderType)}</div></div>
          <div class="meta-block"><div class="meta-label">Customer</div><div class="meta-value">${esc(customerName || 'Walk-in')}</div></div>
          ${customerPhone ? `<div class="meta-block"><div class="meta-label">Phone</div><div class="meta-value">${esc(customerPhone)}</div></div>` : ''}
          ${customerAddress ? `<div class="meta-block"><div class="meta-label">Address</div><div class="meta-value">${esc(customerAddress)}</div></div>` : ''}
        </div>
        <table>
          <thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Amount</th></tr></thead>
          <tbody>${itemsHtml}</tbody>
        </table>
        <div class="summary">
          <div class="summary-row"><span>Subtotal</span><span>${formatCurrency(calculations.subtotal)}</span></div>
          ${enableDelivery ? `<div class="summary-row"><span>Delivery Charge</span><span>${formatCurrency(calculations.deliveryCharge)}</span></div>` : ''}
          ${calculations.discountAmount > 0 ? `<div class="summary-row"><span>Discount</span><span>-${formatCurrency(calculations.discountAmount)}</span></div>` : ''}
          ${showGst ? `<div class="summary-row"><span>CGST (${calculations.gstRate / 2}%)</span><span>${formatCurrency(calculations.cgst)}</span></div>` : ''}
          ${showGst ? `<div class="summary-row"><span>SGST (${calculations.gstRate / 2}%)</span><span>${formatCurrency(calculations.sgst)}</span></div>` : ''}
          <div class="summary-total"><span>Grand Total</span><span>${formatCurrency(calculations.grandTotal)}</span></div>
          ${billStatus === 'Balance' ? `
            <div class="summary-row" style="margin-top:8px;"><span>Amount Paid</span><span>${formatCurrency(paidAmount)}</span></div>
            <div class="summary-row" style="color:#ea580c;font-weight:600;"><span>Balance Due</span><span>${formatCurrency(calculations.balanceAmount)}</span></div>
          ` : ''}
        </div>
        <div class="footer">
          <div>Payment Method: <strong>${paymentMethod}</strong> &nbsp;|&nbsp; Status: <strong>${billStatus}</strong></div>
          <br/>
          <div class="footer-green">Thank You for your business!</div>
        </div>
        ${authSignatory ? `<div class="sign"><div class="sign-line"><div class="sign-label">Authorized Signature</div></div></div>` : ''}
      </div>
    </body></html>`;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      notify({ type: 'error', title: 'Error', message: 'Pop-up blocked — please allow pop-ups to print' });
      return;
    }
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => { try { if (!printWindow.closed) printWindow.print(); } catch { /* window closed */ } }, 500);
  }, [settings, orderItems, invoiceNumber, invoiceDate, orderType, customerName, customerAddress, customerPhone, calculations, paymentMethod, billStatus, enableDelivery, enableGst, paidAmount]);

  const printThermalReceipt = useCallback(async () => {
    const tConfig = await fetchThermalSettings();
    const shopName = settings?.shopName || 'Eservices';
    const shopAddr = settings?.shopAddress || '';
    const shopPhone = settings?.shopPhone || '';
    const shopGst = settings?.gstNumber || '';
    const shopGstState = settings?.gstState || '';
    // Show GST ONLY when the per-bill GST toggle is explicitly ON
    // This is completely independent of settings page GST modes
    const showGst = enableGst === true;
    const validItems = orderItems.filter((item) => item.name.trim() !== '' && item.qty > 0 && item.rate > 0);

    const receiptData: ThermalReceiptData = {
      shopName,
      shopAddress: shopAddr,
      shopPhone,
      shopGst,
      shopGstState,
      showGst,
      invoiceNumber,
      date: invoiceDate,
      orderType,
      customerName: customerName || '',
      customerPhone: customerPhone || '',
      customerAddress: customerAddress || '',
      items: validItems.map(item => ({ name: item.name, qty: item.qty, rate: item.rate, total: item.total })),
      subtotal: calculations.subtotal,
      cgst: calculations.cgst,
      sgst: calculations.sgst,
      gstRate: calculations.gstRate,
      deliveryCharge: enableDelivery ? calculations.deliveryCharge : 0,
      discountAmount: calculations.discountAmount,
      grandTotal: calculations.grandTotal,
      paidAmount,
      balanceAmount: calculations.balanceAmount,
      paymentMethod,
      billStatus,
    };

    const thermalHtml = buildRichThermalHtml(receiptData, tConfig, `Receipt ${invoiceNumber}`);

    const printWindow = window.open('', '_blank', 'width=350,height=700');
    if (!printWindow) {
      notify({ type: 'error', title: 'Error', message: 'Pop-up blocked — please allow pop-ups to print' });
      return;
    }
    printWindow.document.write(thermalHtml);
    printWindow.document.close();
    setTimeout(() => { try { if (!printWindow.closed) printWindow.print(); } catch { /* window closed */ } }, 600);
  }, [settings, orderItems, invoiceNumber, invoiceDate, orderType, customerName, customerAddress, customerPhone, calculations, paymentMethod, billStatus, enableDelivery, enableGst, paidAmount]);

  /* ═══════════════════════════════════════════
     Loading Skeleton
     ═══════════════════════════════════════════ */

  if (loading) {
    return (
      <div className="space-y-6 p-4 md:p-6">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-16 w-full max-w-2xl rounded-xl" />
        <Skeleton className="h-[400px] w-full rounded-xl" />
        <div className="flex justify-end gap-3">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-24" />
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════
     Valid Items Count
     ═══════════════════════════════════════════ */

  const validItems = orderItems.filter((item) => item.name.trim() !== '' && item.qty > 0 && item.rate > 0);

  /* ═══════════════════════════════════════════
     Render: Progress Bar
     ═══════════════════════════════════════════ */

  const renderProgressBar = () => (
    <div className="mb-8">
      <div className="flex items-center justify-center max-w-xl mx-auto">
        {STEPS.map((step, idx) => {
          const stepNum = idx + 1;
          const isCompleted = currentStep > stepNum;
          const isCurrent = currentStep === stepNum;
          const Icon = step.icon;

          return (
            <div key={step.label} className="flex items-center flex-1 last:flex-none">
              {/* Step Circle */}
              <button
                onClick={() => {
                  if (isCompleted) goToStep(stepNum);
                }}
                className={`
                  relative flex flex-col items-center gap-2 cursor-pointer group
                  ${isCompleted ? 'cursor-pointer' : 'cursor-default'}
                `}
                disabled={!isCompleted && !isCurrent}
                aria-label={`Step ${stepNum}: ${step.label}`}
              >
                <div
                  className={`
                    flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-300 text-sm font-bold
                    ${isCurrent
                      ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-600/30 scale-110'
                      : isCompleted
                        ? 'bg-green-500 border-green-500 text-white'
                        : 'bg-background border-gray-300 text-gray-400 dark:border-gray-600'
                    }
                  `}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="size-5" />
                  ) : Icon ? (
                    <Icon className="size-5" />
                  ) : (
                    stepNum
                  )}
                </div>
                <span
                  className={`
                    text-xs font-medium transition-colors whitespace-nowrap
                    ${isCurrent ? 'text-emerald-600 dark:text-emerald-400' : isCompleted ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}
                  `}
                >
                  {step.label}
                </span>
              </button>

              {/* Connector Line */}
              {idx < STEPS.length - 1 && (
                <div className="flex-1 mx-2 mt-[-20px]">
                  <div
                    className={`
                      h-0.5 rounded-full transition-all duration-500
                      ${currentStep > stepNum ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-700'}
                    `}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  /* ═══════════════════════════════════════════
     Render: Step 1 — Invoice Details
     ═══════════════════════════════════════════ */

  const renderStep1 = () => (
    <motion.div
      key="step1"
      custom={direction}
      variants={slideVariants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={{ duration: 0.3, ease: 'easeInOut' }}
    >
      <Card className="rounded-xl shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-emerald-600 to-green-600 px-6 py-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <FileText className="size-5" />
            Invoice Details
          </h2>
          <p className="text-emerald-100 text-sm mt-0.5">Set up the basic invoice information</p>
        </div>
        <CardContent className="p-6 space-y-6">
          {/* Invoice Number */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-2">
              <Label htmlFor="invoiceNumber" className="text-sm font-medium">
                Invoice Number
                {billAutoGenerate && (
                  <span className="ml-1.5 text-[10px] font-normal text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 px-1.5 py-0.5 rounded">Auto</span>
                )}
              </Label>
              <Input
                id="invoiceNumber"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder={billAutoGenerate ? "A0001" : "FP-0001"}
                className="font-mono h-10"
              />
              <p className="text-xs text-muted-foreground">
                {billAutoGenerate
                  ? 'Auto-generated from settings — you can override manually'
                  : 'Auto-generated — you can override manually'}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="invoiceDate" className="text-sm font-medium">Invoice Date</Label>
              <Input
                id="invoiceDate"
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className="h-10"
              />
            </div>
          </div>

          <Separator />

          {/* Order Type — only shown for food/restaurant businesses with dineInTakeawayDelivery feature */}
          {isFeatureEnabled('dineInTakeawayDelivery') ? (
            <div className="space-y-3">
              <Label className="text-sm font-medium flex items-center gap-2">
                Order Type
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                  FEATURE
                </Badge>
              </Label>
              <div className="flex flex-wrap gap-3">
                {ORDER_TYPES.map((ot) => {
                  const Icon = ot.icon;
                  const isActive = orderType === ot.value;
                  return (
                    <Button
                      key={ot.value}
                      type="button"
                      variant={isActive ? 'default' : 'outline'}
                      size="lg"
                      className={`
                        h-12 px-6 gap-2 text-sm font-medium transition-all duration-200
                        ${isActive
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20'
                          : 'hover:border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                        }
                      `}
                      onClick={() => setOrderType(ot.value)}
                    >
                      <Icon className="size-5" />
                      {ot.label}
                    </Button>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Hidden selector — default to Dine-In silently */
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <UtensilsCrossed className="size-4" />
              <span>Order Type: <span className="font-medium text-foreground">Dine-In</span></span>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );

  /* ═══════════════════════════════════════════
     Render: Step 2 — Customer Details
     ═══════════════════════════════════════════ */

  const renderStep2 = () => (
    <motion.div
      key="step2"
      custom={direction}
      variants={slideVariants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={{ duration: 0.3, ease: 'easeInOut' }}
    >
      <Card className="rounded-xl shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-emerald-600 to-green-600 px-6 py-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <ShoppingBag className="size-5" />
            Customer Details
          </h2>
          <p className="text-emerald-100 text-sm mt-0.5">Enter customer information (optional for walk-ins)</p>
        </div>
        <CardContent className="p-6 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="customerName" className="text-sm font-medium">Customer Name</Label>
            <Input
              id="customerName"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Walk-in"
              className="h-10"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-2">
              <Label htmlFor="customerAddress" className="text-sm font-medium">
                Address <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input
                id="customerAddress"
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value)}
                placeholder="Delivery address"
                className="h-10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customerPhone" className="text-sm font-medium">
                Phone Number <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input
                id="customerPhone"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="Phone number"
                className="h-10"
              />
            </div>
          </div>

          {/* Quick Summary */}
          <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4 mt-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/50">
                <FileText className="size-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                  Invoice: {invoiceNumber || '—'}
                </p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400">
                  {invoiceDate} • {orderType}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );

  /* ═══════════════════════════════════════════
     Render: Step 3 — Items Selection (POS Grid)
     ═══════════════════════════════════════════ */

  const renderStep3 = () => (
    <motion.div
      key="step3"
      custom={direction}
      variants={slideVariants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={{ duration: 0.3, ease: 'easeInOut' }}
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ─── Left: POS Item Grid ─── */}
        <div className="lg:col-span-2">
          <Card className="rounded-xl shadow-sm">
            <CardHeader className="pb-3 border-b bg-gradient-to-r from-emerald-600 to-green-600 rounded-t-xl">
              <CardTitle className="text-white flex items-center gap-2">
                <PackageOpen className="size-5" />
                Select Items
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search items..."
                  className="pl-9 h-10"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-muted transition-colors"
                  >
                    <X className="size-3.5 text-muted-foreground" />
                  </button>
                )}
              </div>

              {/* Category Filter Pills */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedCategory('all')}
                  className={`
                    px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 border
                    ${selectedCategory === 'all'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                      : 'bg-background text-foreground border-gray-200 dark:border-gray-700 hover:border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                    }
                  `}
                >
                  All ({menuItems.length})
                </button>
                {categories.map((cat) => {
                  const count = menuItems.filter((item) => item.categoryId === cat.id).length;
                  if (count === 0) return null;
                  const isActive = selectedCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(isActive ? 'all' : cat.id)}
                      className={`
                        px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 border flex items-center gap-1.5
                        ${isActive
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                          : 'bg-background text-foreground border-gray-200 dark:border-gray-700 hover:border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                        }
                      `}
                    >
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: isActive ? '#fff' : categoryColorMap[cat.name] || '#16a34a' }}
                      />
                      {cat.name} ({count})
                    </button>
                  );
                })}
              </div>

              {/* Item Grid */}
              <div className="max-h-[55vh] overflow-y-auto pr-1 space-y-5">
                {itemsLoading ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <Skeleton key={i} className="h-28 w-full rounded-lg" />
                    ))}
                  </div>
                ) : groupedItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <PackageOpen className="size-12 mb-3 opacity-30" />
                    <p className="text-sm font-medium">No items found</p>
                    <p className="text-xs mt-1">Try a different search or category</p>
                  </div>
                ) : (
                  groupedItems.map(([categoryName, items]) => (
                    <div key={categoryName}>
                      <div className="flex items-center gap-2 mb-3">
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: categoryColorMap[categoryName] || '#16a34a' }}
                        />
                        <h3 className="text-sm font-bold text-foreground">{categoryName}</h3>
                        <span className="text-xs text-muted-foreground">({items.length})</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        {items.map((item) => {
                          const inOrder = orderItems.find((oi) => oi.name === item.name);
                          return (
                            <button
                              key={item.id}
                              onClick={() => { if (!isReadOnly) addMenuItem(item); }}
                              disabled={isReadOnly}
                              className={`
                                group relative text-left p-3 rounded-lg border-2 transition-all duration-200
                                hover:shadow-md hover:scale-[1.02]
                                ${isReadOnly ? 'cursor-default opacity-70' : 'cursor-pointer'}
                                ${inOrder
                                  ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 shadow-sm'
                                  : 'border-gray-200 dark:border-gray-700 hover:border-emerald-400 bg-card'
                                }
                              `}
                            >
                              {inOrder && (
                                <Badge className="absolute top-2 right-2 bg-emerald-600 text-white text-[10px] px-1.5 py-0 h-5">
                                  x{inOrder.qty}
                                </Badge>
                              )}
                              <div className="flex gap-3">
                                <div className="size-12 rounded-md overflow-hidden shrink-0 bg-muted">
                                  {item.imageUrl ? (
                                    <img
                                      src={item.imageUrl}
                                      alt={item.name}
                                      className="w-full h-full object-cover"
                                      onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = 'none';
                                        (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                                      }}
                                    />
                                  ) : null}
                                  {!item.imageUrl && (
                                    <div className="flex items-center justify-center w-full h-full text-muted-foreground">
                                      <PackageOpen className="size-5" />
                                    </div>
                                  )}
                                  {item.imageUrl && (
                                    <div className="hidden flex items-center justify-center w-full h-full text-muted-foreground">
                                      <PackageOpen className="size-5" />
                                    </div>
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    Stock: {item.quantity}
                                  </p>
                                  <p className="text-sm font-bold text-emerald-600 mt-1">
                                    {formatCurrency(item.price)}
                                  </p>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ─── Right: Order Summary (Sticky) ─── */}
        <div className="lg:col-span-1">
          <div className="sticky top-20">
            <Card className="rounded-xl shadow-sm">
              <CardHeader className="pb-3 border-b">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Receipt className="size-4 text-emerald-600" />
                    Order Summary
                  </CardTitle>
                  <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
                    {validItems.length} item{validItems.length !== 1 ? 's' : ''}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-[45vh] overflow-y-auto">
                  {orderItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 px-4 text-muted-foreground">
                      <ShoppingBag className="size-8 mb-2 opacity-30" />
                      <p className="text-xs font-medium">No items added yet</p>
                      <p className="text-[11px] mt-0.5">Click items from the grid to add</p>
                    </div>
                  ) : (
                    <div className="divide-y">
                      {orderItems.map((item) => (
                        <div key={item.id} className="p-3 flex items-start gap-2 hover:bg-muted/30 transition-colors">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{item.name}</p>
                            {/* Qty Controls */}
                            <div className="flex items-center gap-1.5 mt-1.5">
                              <button
                                onClick={() => updateOrderItemQty(item.id, -1)}
                                disabled={item.qty <= 1 || isReadOnly}
                                className="size-6 flex items-center justify-center rounded border border-gray-200 dark:border-gray-700 text-xs font-bold hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                              >
                                -
                              </button>
                              <span className="text-sm font-semibold w-6 text-center">{item.qty}</span>
                              <button
                                onClick={() => updateOrderItemQty(item.id, 1)}
                                disabled={isReadOnly}
                                className="size-6 flex items-center justify-center rounded border border-gray-200 dark:border-gray-700 text-xs font-bold hover:bg-muted transition-colors"
                              >
                                +
                              </button>
                            </div>
                            {/* Editable Rate */}
                            <div className="mt-1.5 flex items-center gap-1">
                              <span className="text-[10px] text-muted-foreground">Rate:</span>
                              <input
                                type="number"
                                min={0}
                                step="0.01"
                                value={item.rate || ''}
                                onChange={(e) => updateOrderItemRate(item.id, parseFloat(e.target.value) || 0)}
                                className="w-20 h-6 text-xs border rounded px-1.5 bg-background text-right font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500"
                              />
                            </div>
                            {/* Item Customization — feature-gated */}
                            {isFeatureEnabled('itemCustomization') && (
                              <div className="mt-1.5">
                                {customizingItemId === item.id ? (
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="text"
                                      value={item.customNote || ''}
                                      onChange={(e) => updateOrderItemNote(item.id, e.target.value)}
                                      placeholder="Add note (e.g. no onion, extra spicy)"
                                      className="w-full h-6 text-xs border rounded px-1.5 bg-background focus:outline-none focus:ring-1 focus:ring-amber-500"
                                      autoFocus
                                    />
                                    <button
                                      onClick={() => setCustomizingItemId(null)}
                                      className="shrink-0 size-5 flex items-center justify-center rounded hover:bg-muted text-muted-foreground"
                                    >
                                      <X className="size-3" />
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setCustomizingItemId(item.id)}
                                    className="text-[10px] text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-0.5"
                                  >
                                    {item.customNote ? (
                                      <>
                                        <span className="truncate max-w-[120px]">{item.customNote}</span>
                                        <span className="text-muted-foreground">(edit)</span>
                                      </>
                                    ) : (
                                      '+ Customize'
                                    )}
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <button
                              onClick={() => removeOrderItem(item.id)}
                              disabled={!canDelete}
                              className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-950/30 text-red-400 hover:text-red-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                              title={!canDelete ? 'No permission to delete' : 'Remove item'}
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                            <p className="text-sm font-bold text-foreground whitespace-nowrap">
                              {formatCurrency(item.total)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Summary Footer */}
                <div className="border-t p-4 space-y-3 bg-muted/20 rounded-b-xl">
                  <div className="flex justify-between text-sm font-medium">
                    <span>Subtotal</span>
                    <span className="text-emerald-600 font-bold">{formatCurrency(calculations.subtotal)}</span>
                  </div>
                  {orderItems.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 text-xs h-8 disabled:opacity-40"
                      onClick={clearAllItems}
                      disabled={!canDelete}
                      title={!canDelete ? 'No permission to delete' : 'Clear all items'}
                    >
                      <Trash2 className="size-3 mr-1" />
                      Clear All
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </motion.div>
  );

  /* ═══════════════════════════════════════════
     Render: Step 4 — Billing & Payment
     ═══════════════════════════════════════════ */

  const renderStep4 = () => (
    <motion.div
      key="step4"
      custom={direction}
      variants={slideVariants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={{ duration: 0.3, ease: 'easeInOut' }}
    >
      {/* ─── Success State ─── */}
      {generatedInvoice ? (
        <Card className="rounded-xl shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-emerald-600 to-green-600 px-6 py-8 text-center">
            <CheckCircle2 className="size-16 text-white mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white">Bill Generated Successfully!</h2>
            <p className="text-emerald-100 mt-2 text-lg font-mono">{generatedInvoice.invoiceNumber}</p>
          </div>
          <CardContent className="p-6 space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
              <div className="bg-muted/40 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Items</p>
                <p className="text-lg font-bold">{validItems.length}</p>
              </div>
              <div className="bg-muted/40 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Subtotal</p>
                <p className="text-lg font-bold">{formatCurrency(calculations.subtotal)}</p>
              </div>
              <div className="bg-muted/40 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Payment</p>
                <p className="text-lg font-bold">{paymentMethod}</p>
              </div>
              <div className="bg-muted/40 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Status</p>
                <p className="text-lg font-bold">{billStatus}</p>
              </div>
            </div>

            <Separator />

            <div className="flex flex-wrap gap-3 justify-center">
              <Button
                onClick={printA4Invoice}
                variant="outline"
                className="gap-2 h-11 px-5"
              >
                <Printer className="size-4" />
                Print A4 Invoice
              </Button>
              <Button
                onClick={printThermalReceipt}
                variant="outline"
                className="gap-2 h-11 px-5"
              >
                <Receipt className="size-4" />
                Print Thermal Receipt
              </Button>
              <Button
                onClick={handleNewInvoice}
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 h-11 px-5"
              >
                <RotateCcw className="size-4" />
                New Bill
              </Button>
              <Button
                onClick={() => onNavigate('bill-history')}
                variant="outline"
                className="gap-2 h-11 px-5"
              >
                <FileText className="size-4" />
                View History
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* ─── Normal Payment Step ─── */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ─── Left: Billing Options ─── */}
          <Card className="rounded-xl shadow-sm">
            <CardHeader className="pb-3 border-b bg-gradient-to-r from-emerald-600 to-green-600 rounded-t-xl">
              <CardTitle className="text-white flex items-center gap-2">
                <FileText className="size-5" />
                Billing Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              {/* Subtotal */}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">{formatCurrency(calculations.subtotal)}</span>
              </div>

              {/* Delivery Charge — only shown if enabled in Settings */}
              {settings?.enableDelivery && (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Truck className="size-4 text-muted-foreground" />
                      <Label htmlFor="deliveryToggle" className="text-sm cursor-pointer">Delivery Charge</Label>
                    </div>
                    <Switch
                      id="deliveryToggle"
                      checked={enableDelivery}
                      onCheckedChange={(checked) => {
                        setEnableDelivery(checked);
                        if (checked && deliveryChargeAmount === 0) {
                          setDeliveryChargeAmount(settings?.deliveryCharge || 0);
                        }
                      }}
                    />
                  </div>
                  {enableDelivery && (
                    <div className="flex justify-end pl-8">
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={deliveryChargeAmount || ''}
                        onChange={(e) => setDeliveryChargeAmount(parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                        className="w-32 h-8 text-right text-sm"
                      />
                    </div>
                  )}
                </>
              )}

              {/* GST — only shown if enabled in Settings */}
              {settings?.enableGst && (
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">GST</span>
                    <Label htmlFor="gstToggle" className="text-sm cursor-pointer">
                      {settings?.gstFullMode
                        ? 'GST (Full Mode — Tax Invoice)'
                        : settings?.gstSimpleMode
                          ? 'GST (Simple Mode)'
                          : `Apply GST (${settings?.gstRate || 18}%)`}
                    </Label>
                  </div>
                  <Switch
                    id="gstToggle"
                    checked={enableGst}
                    onCheckedChange={setEnableGst}
                  />
                </div>
              )}

              {/* Discount */}
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="discountInput" className="text-sm flex items-center gap-2 shrink-0">
                  <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">DISC</span>
                  Discount (₹)
                </Label>
                <Input
                  id="discountInput"
                  type="number"
                  min={0}
                  step="0.01"
                  value={discount || ''}
                  onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className="w-32 h-8 text-right text-sm"
                />
              </div>

              <Separator />

              {/* Grand Total */}
              <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-bold text-emerald-800 dark:text-emerald-300">Grand Total</span>
                  <span className="text-2xl font-extrabold text-emerald-600">
                    {formatCurrency(calculations.grandTotal)}
                  </span>
                </div>
                {enableGst && (
                  <div className="flex justify-between text-xs text-muted-foreground mt-2">
                    <span>CGST ({calculations.gstRate / 2}%) + SGST ({calculations.gstRate / 2}%)</span>
                    <span>{formatCurrency(calculations.cgst + calculations.sgst)}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* ─── Right: Payment Options ─── */}
          <Card className="rounded-xl shadow-sm">
            <CardHeader className="pb-3 border-b bg-gradient-to-r from-emerald-600 to-green-600 rounded-t-xl">
              <CardTitle className="text-white flex items-center gap-2">
                <Banknote className="size-5" />
                Payment
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-5">
              {/* Payment Method */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Payment Method</Label>
                <div className="grid grid-cols-2 gap-2">
                  {PAYMENT_METHODS.map((pm) => {
                    const Icon = pm.icon;
                    const isActive = paymentMethod === pm.value;
                    return (
                      <Button
                        key={pm.value}
                        type="button"
                        variant={isActive ? 'default' : 'outline'}
                        className={`
                          h-11 gap-2 text-sm font-medium transition-all
                          ${isActive
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                            : 'hover:border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                          }
                        `}
                        onClick={() => setPaymentMethod(pm.value)}
                      >
                        <Icon className="size-4" />
                        {pm.label}
                      </Button>
                    );
                  })}
                </div>
              </div>

              <Separator />

              {/* Bill Status */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Bill Status</Label>
                <RadioGroup
                  value={billStatus}
                  onValueChange={(val) => {
                    setBillStatus(val);
                    if (val === 'Paid') setPaidAmount(calculations.grandTotal);
                    else if (val === 'Balance') setPaidAmount(0);
                    else setPaidAmount(0);
                  }}
                  className="grid grid-cols-3 gap-2"
                >
                  {['Pending', 'Paid', 'Balance'].map((status) => (
                    <Label
                      key={status}
                      htmlFor={`status-${status}`}
                      className={`
                        flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border-2 cursor-pointer text-sm font-medium transition-all
                        ${billStatus === status
                          ? status === 'Paid'
                            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400'
                            : status === 'Balance'
                              ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400'
                              : 'border-amber-500 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                        }
                      `}
                    >
                      <RadioGroupItem value={status} id={`status-${status}`} className="sr-only" />
                      {status}
                    </Label>
                  ))}
                </RadioGroup>
              </div>

              {/* Balance Amount Paid */}
              {billStatus === 'Balance' && (
                <div className="space-y-2 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
                  <Label htmlFor="paidAmount" className="text-sm font-medium text-orange-700 dark:text-orange-400">
                    Amount Paid
                  </Label>
                  <Input
                    id="paidAmount"
                    type="number"
                    min={0}
                    max={calculations.grandTotal}
                    step="0.01"
                    value={paidAmount || ''}
                    onChange={(e) => setPaidAmount(Math.min(parseFloat(e.target.value) || 0, calculations.grandTotal))}
                    placeholder="0.00"
                    className="h-10"
                  />
                  <div className="flex justify-between text-sm mt-2">
                    <span className="text-orange-600 dark:text-orange-400 font-medium">Balance Due</span>
                    <span className="text-orange-600 dark:text-orange-400 font-bold">
                      {formatCurrency(calculations.balanceAmount)}
                    </span>
                  </div>
                </div>
              )}

              <Separator />

              {/* Feature-gated action buttons: KOT & Split Bill */}
              {(isFeatureEnabled('kot') || isFeatureEnabled('splitBill')) && (
                <div className="flex flex-wrap gap-2">
                  {isFeatureEnabled('kot') && (
                    <Button
                      variant="outline"
                      className="gap-2 h-10 text-sm border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-400 dark:hover:bg-amber-950/50"
                      onClick={() => notify({ type: 'success', title: 'KOT Sent', message: 'KOT sent to kitchen' })}
                      disabled={validItems.length === 0 || isReadOnly}
                    >
                      <UtensilsCrossed className="size-4" />
                      Send KOT
                    </Button>
                  )}
                  {isFeatureEnabled('splitBill') && (
                    <Button
                      variant="outline"
                      className="gap-2 h-10 text-sm border-cyan-300 bg-cyan-50 text-cyan-700 hover:bg-cyan-100 dark:border-cyan-700 dark:bg-cyan-950/30 dark:text-cyan-400 dark:hover:bg-cyan-950/50"
                      onClick={() => notify({ type: 'info', title: 'Split Bill', message: 'Split bill feature coming soon' })}
                      disabled={validItems.length === 0 || isReadOnly}
                    >
                      <Receipt className="size-4" />
                      Split Bill
                    </Button>
                  )}
                </div>
              )}

              {/* Generate Button */}
              <Button
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold h-12 text-base gap-2 shadow-lg shadow-emerald-600/20"
                onClick={handleGenerate}
                disabled={submitting || validItems.length === 0 || isReadOnly || (isEditRef.current ? !canEdit : !canCreate)}
              >
                {submitting ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : isEditRef.current ? (
                  <CheckCircle2 className="size-5" />
                ) : (
                  <FileText className="size-5" />
                )}
                {submitting
                  ? 'Saving...'
                  : isEditRef.current
                    ? (!canEdit ? 'Update Bill (No Permission)' : 'Update Bill')
                    : (!canCreate ? 'Generate Bill (No Permission)' : 'Generate Bill')
                }
              </Button>

              {validItems.length === 0 && (
                <p className="text-xs text-center text-muted-foreground">
                  Go back to Step 3 to add items
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </motion.div>
  );

  /* ═══════════════════════════════════════════
     Main Render
     ═══════════════════════════════════════════ */

  return (
    <div className="space-y-4 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-green-600 text-white shadow-sm">
            <FileText className="size-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Bill Generator</h1>
            <p className="text-sm text-muted-foreground">
              {isEditRef.current ? 'Editing Invoice' : 'Create new invoice'} • Step {currentStep} of 4
            </p>
          </div>
        </div>
        {isReadOnly && <ReadOnlyBanner module="Billing" noAccess={noAccess} />}
        <div className="flex items-center gap-2">
          {generatedInvoice && (
            <Button variant="outline" size="sm" onClick={() => onNavigate('bill-history')} className="gap-1.5">
              <Receipt className="size-4" />
              View History
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleNewInvoice} className="gap-1.5">
            <RotateCcw className="size-4" />
            New Bill
          </Button>
        </div>
      </div>

      {/* Progress Bar */}
      {renderProgressBar()}

      {/* Step Content */}
      <AnimatePresence mode="wait" custom={direction}>
        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
        {currentStep === 3 && renderStep3()}
        {currentStep === 4 && renderStep4()}
      </AnimatePresence>

      {/* Navigation Buttons */}
      {!generatedInvoice && (
        <div className="flex items-center justify-between pt-4 border-t">
          <Button
            variant="outline"
            onClick={goBack}
            disabled={currentStep === 1}
            className="gap-2"
          >
            <ChevronLeft className="size-4" />
            Back
          </Button>

          <div className="flex items-center gap-2">
            {currentStep < 4 && (
              <Button
                onClick={goNext}
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
              >
                Next
                <ChevronRight className="size-4" />
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
