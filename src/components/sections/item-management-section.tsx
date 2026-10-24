'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  Download,
  Upload,
  Package,
  Tag,
  Loader2,
  ImageIcon,
  Search,
  AlertTriangle,
  PackagePlus,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { notify } from '@/lib/notification-store';
import { useAuth } from '@/components/auth-provider';
import ReadOnlyBanner from '@/components/read-only-banner';

// --- Types ---
interface Item {
  id: string;
  name: string;
  categoryId: string;
  categoryName?: string;
  price: number;
  quantity: number;
  description: string;
  imageUrl: string;
}

interface Category {
  id: string;
  name: string;
  description: string;
  image?: string;
  itemCount?: number;
}

interface CustomItemField {
  id: string;
  key: string;
  label: string;
  fieldType: string; // text, number, date, select, boolean
  options: string[];
  required: boolean;
  visible: boolean;
  sortOrder: number;
}

interface ItemManagementSectionProps {
  onRefreshData: () => void;
  dataVersion?: number;
}

// --- CSV Helpers ---
function itemsToCSV(items: Item[]): string {
  const header = 'Name,Category,Category ID,Price,Quantity,Description,Image URL';
  const rows = items.map(
    (i) =>
      `"${i.name}","${i.categoryName || ''}","${i.categoryId || ''}",${i.price},${i.quantity},"${i.description}","${i.imageUrl}"`
  );
  return [header, ...rows].join('\n');
}

// --- Category color palette for dots ---
const CATEGORY_DOT_COLORS = [
  'bg-emerald-500',
  'bg-teal-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-cyan-500',
  'bg-violet-500',
  'bg-orange-500',
  'bg-pink-500',
  'bg-lime-500',
  'bg-fuchsia-500',
];

function getCategoryDotColor(index: number): string {
  return CATEGORY_DOT_COLORS[index % CATEGORY_DOT_COLORS.length];
}

// --- Image Compression Helpers ---
const MAX_COMPRESS_DIMENSION = 800; // longest side
const JPEG_QUALITY = 0.7;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

async function compressImage(file: File): Promise<File> {
  // If file is already small, return as-is
  if (file.size < 100 * 1024) return file;

  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;

      // Guard against zero-dimension images
      if (width === 0 || height === 0) {
        URL.revokeObjectURL(objectUrl);
        resolve(file);
        return;
      }

      // Resize if needed
      if (width > MAX_COMPRESS_DIMENSION || height > MAX_COMPRESS_DIMENSION) {
        if (width > height) {
          height = Math.round((height / width) * MAX_COMPRESS_DIMENSION);
          width = MAX_COMPRESS_DIMENSION;
        } else {
          width = Math.round((width / height) * MAX_COMPRESS_DIMENSION);
          height = MAX_COMPRESS_DIMENSION;
        }
      }

      // Post-resize zero-dimension guard: rounding can produce 0 for very narrow images
      if (width < 1) width = 1;
      if (height < 1) height = 1;

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(objectUrl);
        resolve(file);
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      // Revoke ObjectURL after canvas has captured the image data
      URL.revokeObjectURL(objectUrl);

      canvas.toBlob(
        (blob) => {
          if (blob && blob.size < file.size) {
            resolve(
              new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), {
                type: 'image/jpeg',
                lastModified: Date.now(),
              })
            );
          } else {
            resolve(file);
          }
        },
        'image/jpeg',
        JPEG_QUALITY
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file);
    };
    img.src = objectUrl;
  });
}

function categoriesToCSV(categories: Category[]): string {
  const header = 'Name,Description,Image URL';
  const rows = categories.map(
    (c) => `"${c.name}","${c.description}","${c.image || ''}"`
  );
  return [header, ...rows].join('\n');
}

function downloadCSV(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

// --- Custom Field Data Helpers ---
// Store custom fields as JSON in the description field:
// { "text": "original description", "fields": { "key": "value" } }
// If description is not JSON, treat as plain text (backward compatible).

interface ParsedDescription {
  text: string;
  fields: Record<string, string | boolean>;
}

function parseItemDescription(description: string): ParsedDescription {
  if (!description) return { text: '', fields: {} };
  try {
    const parsed = JSON.parse(description);
    if (parsed && typeof parsed === 'object' && 'text' in parsed && 'fields' in parsed) {
      return { text: parsed.text || '', fields: parsed.fields || {} };
    }
  } catch {
    // Not JSON — treat as plain description
  }
  return { text: description, fields: {} };
}

function serializeItemDescription(text: string, fields: Record<string, string | boolean>): string {
  const hasFields = Object.keys(fields).length > 0;
  if (!text.trim() && !hasFields) return '';
  if (!hasFields) return text.trim();
  return JSON.stringify({ text: text.trim(), fields });
}

// --- Component ---
export default function ItemManagementSection({ onRefreshData, dataVersion }: ItemManagementSectionProps) {
  const { token, hasPermission } = useAuth();

  // Auth headers helper
  const authHeaders: Record<string, string> = token ? { 'Authorization': `Bearer ${token}` } : {};

  // Permission checks
  const canAccess = hasPermission('inventory', 'access');
  const canCreate = hasPermission('inventory', 'create');
  const canEdit = hasPermission('inventory', 'edit');
  const canDelete = hasPermission('inventory', 'delete');
  const noAccess = !canAccess;
  const isReadOnly = !canAccess || (!canCreate && !canEdit && !canDelete);

  // Data state
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [customFields, setCustomFields] = useState<CustomItemField[]>([]);
  const [loading, setLoading] = useState(true);

  // Items dialog state
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [itemSaving, setItemSaving] = useState(false);

  const [itemName, setItemName] = useState('');
  const [itemCategoryId, setItemCategoryId] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [itemQuantity, setItemQuantity] = useState('');
  const [itemDescription, setItemDescription] = useState('');
  const [itemImageUrl, setItemImageUrl] = useState('');
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string | boolean>>({});
  const [uploading, setUploading] = useState(false);
  const itemImageRef = useRef<HTMLInputElement>(null);

  // Categories dialog state
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categorySaving, setCategorySaving] = useState(false);

  const [categoryName, setCategoryName] = useState('');
  const [categoryDescription, setCategoryDescription] = useState('');
  const [categoryImage, setCategoryImage] = useState('');

  // Search state
  const [itemSearchQuery, setItemSearchQuery] = useState('');

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'item' | 'category';
    id: string;
    name: string;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Import ref
  const itemImportRef = useRef<HTMLInputElement>(null);
  const categoryImportRef = useRef<HTMLInputElement>(null);

  // --- Fetch ---
  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch('/api/items', { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        setItems(data);
      }
    } catch {
      // Silently retry on network error
      try {
        const res = await fetch('/api/items', { headers: authHeaders });
        if (res.ok) {
          const data = await res.json();
          setItems(data);
        }
      } catch {
        notify({ type: 'error', title: 'Error', message: 'Failed to fetch items' });
      }
    }
  }, [token]);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/categories', { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        setCategories(data);
      }
    } catch {
      notify({ type: 'error', title: 'Error', message: 'Failed to fetch categories' });
    }
  }, [token]);

  const fetchCustomFields = useCallback(async () => {
    try {
      const res = await fetch('/api/custom-fields', { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        setCustomFields(data.fields || []);
      }
    } catch {
      // Silent — custom fields are optional
    }
  }, [token]);

  const loadAll = useCallback(async (silent?: boolean) => {
    if (!silent) setLoading(true);
    await Promise.all([fetchItems(), fetchCategories(), fetchCustomFields()]);
    setLoading(false);
  }, [fetchItems, fetchCategories, fetchCustomFields, setLoading]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Re-fetch data when dataVersion changes (sync from other tabs/devices)
  const prevDataVersion = useRef(dataVersion);
  useEffect(() => {
    if (dataVersion !== undefined && dataVersion !== prevDataVersion.current) {
      prevDataVersion.current = dataVersion;
      loadAll(true);  // silent=true for background sync
    }
  }, [dataVersion, loadAll]);

  // --- Item Dialog Handlers ---
  const openAddItemDialog = () => {
    setEditingItem(null);
    setItemName('');
    setItemCategoryId('');
    setItemPrice('');
    setItemQuantity('');
    setItemDescription('');
    setItemImageUrl('');
    setCustomFieldValues({});
    setQuickCatName('');
    setItemDialogOpen(true);
  };

  const openEditItemDialog = (item: Item) => {
    setEditingItem(item);
    setItemName(item.name);
    setItemCategoryId(item.categoryId || '');
    setItemPrice(String(item.price));
    setItemQuantity(String(item.quantity));
    const parsed = parseItemDescription(item.description);
    setItemDescription(parsed.text);
    setCustomFieldValues(parsed.fields);
    setItemImageUrl(item.imageUrl || '');
    setQuickCatName('');
    setItemDialogOpen(true);
  };

  // Inline quick-add category state
  const [quickCatName, setQuickCatName] = useState('');
  const [quickCatAdding, setQuickCatAdding] = useState(false);

  const handleQuickAddCategory = async () => {
    if (!quickCatName.trim()) return;
    setQuickCatAdding(true);
    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: quickCatName.trim(), description: '' }),
      });
      if (res.ok) {
        const newCat = await res.json();
        await fetchCategories();
        setItemCategoryId(newCat.id);
        setQuickCatName('');
        notify({ type: 'success', title: 'Category Created', message: `Category "${newCat.name}" created` });
      } else {
        notify({ type: 'error', title: 'Error', message: 'Failed to create category' });
      }
    } catch {
      notify({ type: 'error', title: 'Error', message: 'Failed to create category' });
    } finally {
      setQuickCatAdding(false);
    }
  };

  const handleSaveItem = async () => {
    if (!itemName.trim()) {
      notify({ type: 'error', title: 'Error', message: 'Please fill in item name' });
      return;
    }

    setItemSaving(true);
    try {
      // Serialize custom field values into description
      const serializedDescription = customFields.length > 0
        ? serializeItemDescription(itemDescription, customFieldValues)
        : itemDescription.trim();

      const body = {
        name: itemName.trim(),
        categoryId: itemCategoryId || null,
        price: parseFloat(itemPrice) || 0,
        quantity: parseInt(itemQuantity) || 0,
        description: serializedDescription,
        imageUrl: itemImageUrl.trim(),
      };

      const url = editingItem ? `/api/items/${editingItem.id}` : '/api/items';
      const method = editingItem ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        notify({ type: 'success', title: editingItem ? 'Item Updated' : 'Item Created', message: editingItem ? 'Item updated' : 'Item created' });
        setItemDialogOpen(false);
        await fetchItems();
        onRefreshData();
      } else {
        const errData = await res.json().catch(() => ({}));
        notify({ type: 'error', title: 'Error', message: `Failed to save item — ${errData.error || `Server error (${res.status})`}` });
      }
    } catch (err) {
      notify({ type: 'error', title: 'Error', message: 'Failed to save item — Connection error. Please check the server and try again.' });
    } finally {
      setItemSaving(false);
    }
  };

  // --- Category Dialog Handlers ---
  const openAddCategoryDialog = () => {
    setEditingCategory(null);
    setCategoryName('');
    setCategoryDescription('');
    setCategoryImage('');
    setCategoryDialogOpen(true);
  };

  const openEditCategoryDialog = (cat: Category) => {
    setEditingCategory(cat);
    setCategoryName(cat.name);
    setCategoryDescription(cat.description);
    setCategoryImage(cat.image || '');
    setCategoryDialogOpen(true);
  };

  const handleSaveCategory = async () => {
    if (!categoryName.trim()) {
      notify({ type: 'error', title: 'Error', message: 'Please enter a category name' });
      return;
    }

    setCategorySaving(true);
    try {
      const body = {
        name: categoryName.trim(),
        description: categoryDescription.trim(),
        image: categoryImage,
      };

      const url = editingCategory
        ? `/api/categories/${editingCategory.id}`
        : '/api/categories';
      const method = editingCategory ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        notify({ type: 'success', title: editingCategory ? 'Category Updated' : 'Category Created', message: editingCategory ? 'Category updated' : 'Category created' });
        setCategoryDialogOpen(false);
        await fetchCategories();
        await fetchItems();
        onRefreshData();
      } else {
        notify({ type: 'error', title: 'Error', message: 'Failed to save category' });
      }
    } catch {
      notify({ type: 'error', title: 'Error', message: 'Failed to save category' });
    } finally {
      setCategorySaving(false);
    }
  };

  // --- Delete Handler ---
  const handleDelete = async () => {
    if (!deleteTarget) return;

    setDeleting(true);
    try {
      const url =
        deleteTarget.type === 'item'
          ? `/api/items/${deleteTarget.id}`
          : `/api/categories/${deleteTarget.id}`;
      const res = await fetch(url, { method: 'DELETE', headers: authHeaders });

      if (res.ok) {
        notify({ type: 'success', title: 'Deleted', message: `${deleteTarget.type === 'item' ? 'Item' : 'Category'} deleted` });
        setDeleteTarget(null);
        await fetchItems();
        await fetchCategories();
        onRefreshData();
      } else {
        notify({ type: 'error', title: 'Error', message: 'Failed to delete' });
      }
    } catch {
      notify({ type: 'error', title: 'Error', message: 'Failed to delete' });
    } finally {
      setDeleting(false);
    }
  };

  // --- Export/Import ---
  const handleExportItemsCSV = () => {
    if (items.length === 0) {
      notify({ type: 'info', title: 'Info', message: 'No items to export' });
      return;
    }
    downloadCSV('items.csv', itemsToCSV(items));
    notify({ type: 'success', title: 'Exported', message: 'Items exported as CSV' });
  };

  const handleExportCategoriesCSV = () => {
    if (categories.length === 0) {
      notify({ type: 'info', title: 'Info', message: 'No categories to export' });
      return;
    }
    downloadCSV('categories.csv', categoriesToCSV(categories));
    notify({ type: 'success', title: 'Exported', message: 'Categories exported as CSV' });
  };

  const handleImportItemsCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const csvText = await file.text();
      const res = await fetch('/api/items/import', {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'text/csv' },
        body: csvText,
      });

      if (res.ok) {
        const result = await res.json();
        const parts = [`${result.created} created`];
        if (result.updated) parts.push(`${result.updated} updated`);
        if (result.skipped) parts.push(`${result.skipped} skipped`);
        if (result.newCategories) parts.push(`${result.newCategories} new categories auto-created`);
        notify({ type: 'success', title: 'Imported', message: `Items imported: ${parts.join(', ')}` });
        await fetchItems();
        await fetchCategories();
        onRefreshData();
      } else {
        const err = await res.json().catch(() => ({}));
        notify({ type: 'error', title: 'Error', message: `Failed to import items — ${err.error || `Server error (${res.status})`}` });
      }
    } catch {
      notify({ type: 'error', title: 'Error', message: 'Invalid CSV file' });
    }

    if (itemImportRef.current) itemImportRef.current.value = '';
  };

  const handleImportCategoriesCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const csvText = await file.text();
      const res = await fetch('/api/categories/import', {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'text/csv' },
        body: csvText,
      });

      if (res.ok) {
        const result = await res.json();
        const parts = [`${result.created} created`];
        if (result.updated) parts.push(`${result.updated} updated`);
        if (result.skipped) parts.push(`${result.skipped} skipped`);
        notify({ type: 'success', title: 'Imported', message: `Categories imported: ${parts.join(', ')}` });
        await fetchCategories();
        onRefreshData();
      } else {
        const err = await res.json().catch(() => ({}));
        notify({ type: 'error', title: 'Error', message: `Failed to import categories — ${err.error || `Server error (${res.status})`}` });
      }
    } catch {
      notify({ type: 'error', title: 'Error', message: 'Invalid CSV file' });
    }

    if (categoryImportRef.current) categoryImportRef.current.value = '';
  };

  // Low stock state
  const [activeTab, setActiveTab] = useState('items');
  const lowStockThreshold = 5;
  const lowStockCount = items.filter((i) => i.quantity <= lowStockThreshold).length;

  // Helper: get custom field labels and values for an item
  const getCustomFieldBadges = (item: Item): Array<{ label: string; value: string | boolean }> => {
    const parsed = parseItemDescription(item.description);
    const fields = parsed.fields;
    if (!fields || Object.keys(fields).length === 0) return [];
    return customFields
      .filter((f) => f.key in fields && fields[f.key] !== '' && fields[f.key] !== false)
      .map((f) => ({ label: f.label, value: fields[f.key] }));
  };

  // --- Filtered Items ---
  const filteredItems = items.filter((item) => {
    // Low stock filter
    if (activeTab === 'lowstock' && item.quantity > lowStockThreshold) return false;
    if (!itemSearchQuery.trim()) return true;
    const q = itemSearchQuery.toLowerCase();
    // Also search inside custom field values
    const customMatch = getCustomFieldBadges(item).some(
      (b) => b.label.toLowerCase().includes(q) || String(b.value).toLowerCase().includes(q)
    );
    return (
      item.name.toLowerCase().includes(q) ||
      (item.categoryName || '').toLowerCase().includes(q) ||
      customMatch
    );
  });

  const isLowStock = (qty: number) => qty <= lowStockThreshold;

  // --- Loading Skeleton ---
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Skeleton className="h-9 w-36" />
            <Skeleton className="h-9 w-36" />
          </div>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {/* Gradient Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 p-5 md:p-6 text-white shadow-lg shadow-green-600/20 mb-6">
        <div className="pointer-events-none absolute -right-8 -top-8 size-36 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-6 -left-6 size-28 rounded-full bg-white/5" />
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <h2 className="text-xl md:text-2xl font-bold tracking-tight flex items-center gap-2">
              <Package className="size-6" />
              Item Management
            </h2>
            <p className="text-green-100 text-sm mt-1">
              Manage your inventory items and categories
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-white/20 text-white border-white/30 text-xs">
              {items.length} items
            </Badge>
            <Badge variant="secondary" className="bg-white/20 text-white border-white/30 text-xs">
              {categories.length} categories
            </Badge>
          </div>
        </div>
      </div>

      {isReadOnly && <ReadOnlyBanner module="Inventory" noAccess={noAccess} />}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-green-600" />
            Inventory
          </CardTitle>
          <CardDescription>
            Browse, add, edit and manage your items and categories below
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="items" value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="items" className="gap-1.5 data-[state=active]:border-b-2 data-[state=active]:border-green-500">
                <Package className="h-4 w-4" />
                Items
                <Badge variant="secondary" className="ml-1 text-xs">
                  {items.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="lowstock" className="gap-1.5 data-[state=active]:border-b-2 data-[state=active]:border-amber-500">
                <AlertTriangle className="h-4 w-4" />
                Low Stock
                {lowStockCount > 0 && (
                  <Badge className="ml-1 text-xs bg-amber-500 text-white border-amber-500">
                    {lowStockCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="categories" className="gap-1.5 data-[state=active]:border-b-2 data-[state=active]:border-green-500">
                <Tag className="h-4 w-4" />
                Categories
                <Badge variant="secondary" className="ml-1 text-xs">
                  {categories.length}
                </Badge>
              </TabsTrigger>
            </TabsList>

            {/* ========== ITEMS TAB ========== */}
            <TabsContent value="items">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative flex-1 max-w-xs">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search items..."
                    value={itemSearchQuery}
                    onChange={(e) => setItemSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={openAddItemDialog} className="bg-green-600 hover:bg-green-700 text-white gap-1.5" disabled={!canCreate}>
                    <Plus className="h-4 w-4" />
                    Add New Item
                  </Button>
                  <Button variant="outline" onClick={handleExportItemsCSV} className="gap-1.5">
                    <Download className="h-4 w-4" />
                    Export CSV
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => itemImportRef.current?.click()}
                    className="gap-1.5"
                    disabled={!canCreate}
                  >
                    <Upload className="h-4 w-4" />
                    Import CSV
                  </Button>
                  <input
                    ref={itemImportRef}
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={handleImportItemsCSV}
                  />
                </div>
              </div>

              {filteredItems.length === 0 && itemSearchQuery ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Search className="h-10 w-10 mb-3 opacity-40 animate-float" />
                  <p className="text-sm">No items match &quot;{itemSearchQuery}&quot;</p>
                </div>
              ) : items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <Package className="h-12 w-12 mb-3 opacity-40 animate-float" />
                  <p className="text-sm">No items yet. Click &quot;Add New Item&quot; to get started.</p>
                </div>
              ) : (
                <div className="mt-4 rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="w-[60px]">Image</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Category</TableHead>
                        {customFields.length > 0 && <TableHead className="hidden lg:table-cell">Details</TableHead>}
                        <TableHead className="text-right">Price</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredItems.map((item, idx) => (
                        <TableRow key={item.id} className="transition-colors hover:bg-muted/50 hover-lift">
                          <TableCell>
                            {item.imageUrl ? (
                              <img
                                src={item.imageUrl}
                                alt={item.name}
                                className="h-10 w-10 rounded-lg object-cover border bg-muted transition-transform hover:scale-105"
                                onError={(e) => { e.currentTarget.style.display = 'none'; const sib = e.currentTarget.nextElementSibling as HTMLElement | null; if (sib) sib.style.display = 'flex'; }}
                              />
                            ) : null}
                            <div className={`flex h-10 w-10 items-center justify-center rounded-lg border bg-muted ${item.imageUrl ? 'hidden' : ''}`}>
                              <ImageIcon className="h-4 w-4 text-muted-foreground" />
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-1.5">
                              {item.name}
                              {isLowStock(item.quantity) && (
                                <span className="inline-flex items-center justify-center size-4 rounded-full bg-amber-100 dark:bg-amber-900/30" title="Low Stock">
                                  <AlertTriangle className="size-3 text-amber-500" />
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <span className={`inline-block size-2 rounded-full ${getCategoryDotColor(idx)}`} />
                              <Badge variant="outline">{item.categoryName || 'Uncategorized'}</Badge>
                            </div>
                          </TableCell>
                          {customFields.length > 0 && (
                            <TableCell className="hidden lg:table-cell">
                              <div className="flex flex-wrap gap-1 max-w-[200px]">
                                {getCustomFieldBadges(item).slice(0, 3).map((b) => (
                                  <Badge key={b.label} variant="secondary" className="text-[10px] font-normal px-1.5 py-0 gap-0.5">
                                    <span className="text-muted-foreground">{b.label}:</span> {String(b.value)}
                                  </Badge>
                                ))}
                                {getCustomFieldBadges(item).length > 3 && (
                                  <Badge variant="secondary" className="text-[10px] font-normal px-1.5 py-0">
                                    +{getCustomFieldBadges(item).length - 3}
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                          )}
                          <TableCell className="text-right font-mono tabular-nums font-semibold text-green-700 dark:text-green-400">
                            ₹{item.price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-right">
                            <span
                              className={
                                item.quantity <= 0
                                  ? 'text-red-600 font-semibold'
                                  : item.quantity <= lowStockThreshold
                                    ? 'text-amber-600 font-medium'
                                    : ''
                              }
                            >
                              {item.quantity}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {isLowStock(item.quantity) && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                  onClick={() => {
                                    setEditingItem(item)
                                    setItemName(item.name)
                                    setItemCategoryId(item.categoryId || '')
                                    setItemPrice(String(item.price))
                                    setItemQuantity(String(item.quantity + 10))
                                    const parsed = parseItemDescription(item.description)
                                    setItemDescription(parsed.text)
                                    setCustomFieldValues(parsed.fields)
                                    setItemImageUrl(item.imageUrl || '')
                                    setQuickCatName('')
                                    setItemDialogOpen(true)
                                  }}
                                  title="Restock (+10)"
                                  disabled={!canEdit}
                                >
                                  <PackagePlus className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => openEditItemDialog(item)}
                                disabled={!canEdit}
                              >
                                <Pencil className="h-4 w-4 text-green-600" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() =>
                                  setDeleteTarget({
                                    type: 'item',
                                    id: item.id,
                                    name: item.name,
                                  })
                                }
                                disabled={!canDelete}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            {/* ========== LOW STOCK TAB ========== */}
            <TabsContent value="lowstock">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-medium text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                  <AlertTriangle className="size-4" />
                  {lowStockCount} item{lowStockCount !== 1 ? 's' : ''} with stock ≤ {lowStockThreshold}
                </p>
                <div className="relative max-w-xs">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search low stock items..."
                    value={itemSearchQuery}
                    onChange={(e) => setItemSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              {filteredItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <Package className="h-12 w-12 mb-3 opacity-40 animate-float" />
                  <p className="text-sm">
                    {itemSearchQuery ? 'No matching items' : 'All items are well stocked'}
                  </p>
                  <p className="text-xs mt-1">
                    {itemSearchQuery ? 'Try a different search term' : 'Items with quantity ≤ 5 will appear here'}
                  </p>
                </div>
              ) : (
                <div className="mt-4 rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-amber-50 dark:bg-amber-950/20">
                        <TableHead className="w-[60px]">Image</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Price</TableHead>
                        <TableHead className="text-right">Stock</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredItems.map((item) => (
                        <TableRow key={item.id} className="transition-colors hover:bg-amber-50/50 dark:hover:bg-amber-950/10 hover-lift">
                          <TableCell>
                            {item.imageUrl ? (
                              <img
                                src={item.imageUrl}
                                alt={item.name}
                                className="h-10 w-10 rounded-lg object-cover border bg-muted"
                                onError={(e) => { e.currentTarget.style.display = 'none'; const sib = e.currentTarget.nextElementSibling as HTMLElement | null; if (sib) sib.style.display = 'flex'; }}
                              />
                            ) : null}
                            <div className={`flex h-10 w-10 items-center justify-center rounded-lg border bg-muted ${item.imageUrl ? 'hidden' : ''}`}>
                              <ImageIcon className="h-4 w-4 text-muted-foreground" />
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-1.5">
                              {item.name}
                              <span className="inline-flex items-center justify-center size-4 rounded-full bg-amber-100 dark:bg-amber-900/30">
                                <AlertTriangle className="size-3 text-amber-500" />
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{item.categoryName || 'Uncategorized'}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono tabular-nums font-semibold text-green-700 dark:text-green-400">
                            ₹{item.price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant={item.quantity <= 0 ? 'destructive' : 'secondary'} className="tabular-nums">
                              {item.quantity}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 gap-1 text-amber-700 border-amber-200 hover:bg-amber-50 hover:text-amber-800"
                              onClick={() => {
                                setEditingItem(item)
                                setItemName(item.name)
                                setItemCategoryId(item.categoryId || '')
                                setItemPrice(String(item.price))
                                setItemQuantity(String(item.quantity + 10))
                                const parsed = parseItemDescription(item.description)
                                setItemDescription(parsed.text)
                                setCustomFieldValues(parsed.fields)
                                setItemImageUrl(item.imageUrl || '')
                                setQuickCatName('')
                                setItemDialogOpen(true)
                              }}
                              disabled={!canEdit}
                            >
                              <PackagePlus className="h-3.5 w-3.5" />
                              Restock
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            {/* ========== CATEGORIES TAB ========== */}
            <TabsContent value="categories">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={openAddCategoryDialog}
                    className="bg-green-600 hover:bg-green-700 text-white gap-1.5"
                    disabled={!canCreate}
                  >
                    <Plus className="h-4 w-4" />
                    Add New Category
                  </Button>
                  <Button variant="outline" onClick={handleExportCategoriesCSV} className="gap-1.5">
                    <Download className="h-4 w-4" />
                    Export CSV
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => categoryImportRef.current?.click()}
                    className="gap-1.5"
                    disabled={!canCreate}
                  >
                    <Upload className="h-4 w-4" />
                    Import CSV
                  </Button>
                  <input
                    ref={categoryImportRef}
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={handleImportCategoriesCSV}
                  />
                </div>
              </div>

              {categories.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <Tag className="h-12 w-12 mb-3 opacity-40 animate-float" />
                  <p className="text-sm">No categories yet. Click &quot;Add New Category&quot; to get started.</p>
                </div>
              ) : (
                <div className="mt-4 rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Name</TableHead>
                        <TableHead className="hidden sm:table-cell">Description</TableHead>
                        <TableHead className="text-center">Item Count</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {categories.map((cat, idx) => (
                        <TableRow key={cat.id} className="transition-colors hover:bg-muted/50 card-hover-glow">
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {cat.image ? (
                                <img src={cat.image} alt={cat.name} className="w-7 h-7 rounded object-cover border" />
                              ) : (
                                <span className={`inline-block size-2.5 rounded-full ${getCategoryDotColor(idx)}`} />
                              )}
                              {cat.name}
                            </div>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell text-muted-foreground max-w-[200px] truncate">
                            {cat.description || '—'}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="secondary">{cat.itemCount ?? 0}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => openEditCategoryDialog(cat)}
                                disabled={!canEdit}
                              >
                                <Pencil className="h-4 w-4 text-green-600" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() =>
                                  setDeleteTarget({
                                    type: 'category',
                                    id: cat.id,
                                    name: cat.name,
                                  })
                                }
                                disabled={!canDelete}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* ========== ITEM DIALOG ========== */}
      <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Item' : 'Add New Item'}</DialogTitle>
            <DialogDescription>
              {editingItem ? 'Update the item details below.' : 'Fill in the details for the new item.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="item-name">Name *</Label>
              <Input
                id="item-name"
                placeholder="Item name"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                disabled={editingItem ? !canEdit : !canCreate}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="item-category">Category</Label>
              <Select value={itemCategoryId || undefined} onValueChange={setItemCategoryId} disabled={editingItem ? !canEdit : !canCreate}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select category (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {categories.length === 0 ? (
                    <SelectItem value="__none__" disabled>
                      No categories yet
                    </SelectItem>
                  ) : (
                    <>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>
              {categories.length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  No categories exist yet. Create one below to organize items.
                </p>
              )}
              <div className="flex items-center gap-2 mt-1">
                <Input
                  placeholder="Quick add category..."
                  value={quickCatName}
                  onChange={(e) => setQuickCatName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleQuickAddCategory();
                    }
                  }}
                  className="h-8 text-sm"
                  disabled={editingItem ? !canEdit : !canCreate}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 h-8 gap-1 text-xs"
                  onClick={handleQuickAddCategory}
                  disabled={quickCatAdding || !quickCatName.trim() || (editingItem ? !canEdit : !canCreate)}
                >
                  {quickCatAdding ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                  Add
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="item-price">Price (₹)</Label>
                <Input
                  id="item-price"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={itemPrice}
                  onChange={(e) => setItemPrice(e.target.value)}
                  disabled={editingItem ? !canEdit : !canCreate}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="item-quantity">Quantity</Label>
                <Input
                  id="item-quantity"
                  type="number"
                  min="0"
                  placeholder="0"
                  value={itemQuantity}
                  onChange={(e) => setItemQuantity(e.target.value)}
                  disabled={editingItem ? !canEdit : !canCreate}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="item-description">Description</Label>
              <Textarea
                id="item-description"
                placeholder="Item description (optional)"
                value={itemDescription}
                onChange={(e) => setItemDescription(e.target.value)}
                rows={3}
                disabled={editingItem ? !canEdit : !canCreate}
              />
            </div>

            {/* Custom Category Fields */}
            {customFields.length > 0 && (
              <>
                <Separator />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                    <Tag className="size-3.5" />
                    Category Fields
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Additional fields based on your business category
                  </p>
                </div>
                <div className="grid gap-4">
                  {customFields.map((field) => {
                    const value = customFieldValues[field.key] ?? (field.fieldType === 'boolean' ? false : '');
                    const isDisabled = editingItem ? !canEdit : !canCreate;

                    return (
                      <div key={field.id} className="grid gap-2">
                        <Label htmlFor={`custom-${field.key}`} className="flex items-center gap-1">
                          {field.label}
                          {field.required && <span className="text-red-500">*</span>}
                        </Label>
                        {field.fieldType === 'boolean' ? (
                          <div className="flex items-center gap-2">
                            <Switch
                              id={`custom-${field.key}`}
                              checked={!!value}
                              onCheckedChange={(checked: boolean) =>
                                setCustomFieldValues((prev) => ({ ...prev, [field.key]: checked }))
                              }
                              disabled={isDisabled}
                            />
                            <span className="text-sm text-muted-foreground">
                              {value ? 'Yes' : 'No'}
                            </span>
                          </div>
                        ) : field.fieldType === 'select' ? (
                          <Select
                            value={String(value) || undefined}
                            onValueChange={(val: string) =>
                              setCustomFieldValues((prev) => ({ ...prev, [field.key]: val }))
                            }
                            disabled={isDisabled}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder={`Select ${field.label}...`} />
                            </SelectTrigger>
                            <SelectContent>
                              {field.options.map((opt: string) => (
                                <SelectItem key={opt} value={opt}>
                                  {opt}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            id={`custom-${field.key}`}
                            type={field.fieldType === 'number' ? 'number' : field.fieldType === 'date' ? 'date' : 'text'}
                            placeholder={`Enter ${field.label}...`}
                            value={String(value)}
                            onChange={(e) =>
                              setCustomFieldValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                            }
                            disabled={isDisabled}
                            step={field.fieldType === 'number' ? 'any' : undefined}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            <div className="grid gap-2">
              <Label>Item Photo</Label>
              <div className="flex items-start gap-4">
                {/* Photo Preview / Upload Area */}
                <div
                  className="relative flex size-24 shrink-0 items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/30 bg-muted/30 cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 transition-all overflow-hidden group"
                  onClick={() => itemImageRef.current?.click()}
                >
                  {itemImageUrl ? (
                    <>
                      <img
                        src={itemImageUrl}
                        alt="Item photo"
                        className="size-full object-cover"
                        onError={(e) => {
                          // Only hide the broken image visually — do NOT clear itemImageUrl
                          // from state, or the next save will permanently delete the photo.
                          const img = e.currentTarget;
                          img.style.display = 'none';
                          const fallback = img.nextElementSibling as HTMLElement | null;
                          if (fallback) fallback.style.display = 'flex';
                        }}
                      />
                      {/* Fallback shown when image fails to load (keeps URL in state) */}
                      <div className="absolute inset-0 hidden items-center justify-center bg-muted text-muted-foreground">
                        <ImageIcon className="size-6" />
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Pencil className="size-5 text-white" />
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-muted-foreground">
                      {uploading ? (
                        <Loader2 className="size-6 animate-spin text-emerald-500" />
                      ) : (
                        <>
                          <ImageIcon className="size-6" />
                          <span className="text-[10px] font-medium">Upload</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
                <input
                  ref={itemImageRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;

                    // Client-side auto-compress before uploading
                    const compressedFile = await compressImage(file);

                    setUploading(true);
                    try {
                      const fd = new FormData();
                      fd.append('file', compressedFile);
                      const res = await fetch('/api/upload', { method: 'POST', headers: authHeaders, body: fd });
                      if (res.ok) {
                        const data = await res.json();
                        if (data.url) {
                          setItemImageUrl(data.url);
                          const saved = data.saved ? ` (saved ${data.saved})` : '';
                          notify({ type: 'success', title: 'Uploaded', message: `Photo uploaded — ${formatBytes(compressedFile.size)}${saved}` });
                        } else {
                          notify({ type: 'error', title: 'Error', message: 'Upload succeeded but no URL returned' });
                        }
                      } else {
                        const err = await res.json().catch(() => ({}));
                        notify({ type: 'error', title: 'Error', message: `Upload failed — ${err.error || 'Please try again'}` });
                      }
                    } catch {
                      notify({ type: 'error', title: 'Error', message: 'Upload failed — Network error' });
                    } finally {
                      setUploading(false);
                      if (itemImageRef.current) itemImageRef.current.value = '';
                    }
                  }}
                />
                <div className="flex-1 space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Click the box to upload a photo. JPEG, PNG, GIF, WebP (auto-compressed).
                  </p>
                  {itemImageUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 h-7 text-xs gap-1"
                      onClick={() => setItemImageUrl('')}
                    >
                      <Trash2 className="size-3" />
                      Remove Photo
                    </Button>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] text-muted-foreground">Or paste URL:</span>
                <Input
                  placeholder="https://example.com/image.jpg"
                  value={itemImageUrl}
                  onChange={(e) => setItemImageUrl(e.target.value)}
                  className="h-7 text-xs"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setItemDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveItem}
              disabled={itemSaving || uploading || (editingItem ? !canEdit : !canCreate)}
              className="bg-green-600 hover:bg-green-700 text-white gap-1.5"
            >
              {itemSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingItem ? 'Update Item' : 'Create Item'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========== CATEGORY DIALOG ========== */}
      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingCategory ? 'Edit Category' : 'Add New Category'}</DialogTitle>
            <DialogDescription>
              {editingCategory
                ? 'Update the category details below.'
                : 'Fill in the details for the new category.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="cat-name">Name *</Label>
              <Input
                id="cat-name"
                placeholder="Category name"
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                disabled={editingCategory ? !canEdit : !canCreate}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="cat-description">Description</Label>
              <Textarea
                id="cat-description"
                placeholder="Category description (optional)"
                value={categoryDescription}
                onChange={(e) => setCategoryDescription(e.target.value)}
                rows={3}
                disabled={editingCategory ? !canEdit : !canCreate}
              />
            </div>

            {/* Category Photo */}
            <div className="grid gap-2">
              <Label>Category Photo</Label>
              <div className="flex items-center gap-3">
                {categoryImage ? (
                  <div className="relative group">
                    <img
                      src={categoryImage}
                      alt="Category"
                      className="w-16 h-16 rounded-lg object-cover border"
                    />
                    <button
                      type="button"
                      onClick={() => setCategoryImage('')}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center text-muted-foreground/50">
                    <ImageIcon className="w-6 h-6" />
                  </div>
                )}
                <label className="cursor-pointer">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm hover:bg-muted transition-colors">
                    <Upload className="w-3.5 h-3.5" />
                    Upload
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        const compressed = await compressImage(file);
                        const fd = new FormData();
                        fd.append('file', compressed);
                        const res = await fetch('/api/upload', { method: 'POST', headers: authHeaders, body: fd });
                        if (res.ok) {
                          const data = await res.json();
                          if (data.url) {
                            setCategoryImage(data.url);
                            notify({ type: 'success', title: 'Uploaded', message: 'Photo uploaded' });
                          } else {
                            notify({ type: 'error', title: 'Error', message: 'Upload succeeded but no URL returned' });
                          }
                        } else {
                          notify({ type: 'error', title: 'Error', message: 'Upload failed' });
                        }
                      } catch {
                        notify({ type: 'error', title: 'Error', message: 'Upload failed' });
                      }
                      e.target.value = '';
                    }}
                  />
                </label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCategoryDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveCategory}
              disabled={categorySaving || (editingCategory ? !canEdit : !canCreate)}
              className="bg-green-600 hover:bg-green-700 text-white gap-1.5"
            >
              {categorySaving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingCategory ? 'Update Category' : 'Create Category'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========== DELETE CONFIRMATION ========== */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.type === 'item' ? 'Item' : 'Category'}</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deleteTarget?.name}&quot;? This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting || !canDelete}
              className="bg-red-600 hover:bg-red-700 text-white gap-1.5"
            >
              {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
