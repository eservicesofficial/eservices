'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
} from 'lucide-react';
import { useAuth } from '@/components/auth-provider';
import { useNotification } from '@/hooks/use-notification';

// --- Types ---
interface Table {
  id: string;
  unitCode: string;
  tableNumber: number;
  name: string;
  capacity: number;
  section: string;
  status: string; // "available" | "occupied" | "reserved" | "cleaning"
  createdAt: string;
  updatedAt: string;
}

interface TableManagementSectionProps {
  onRefreshData?: () => void;
  dataVersion?: number;
}

type TableStatus = 'available' | 'occupied' | 'reserved' | 'cleaning';
type ViewMode = 'grid' | 'list';

const SECTIONS = ['All', 'Indoor', 'Outdoor', 'AC', 'Terrace', 'VIP'] as const;
const SECTION_OPTIONS = ['Indoor', 'Outdoor', 'AC', 'Terrace', 'VIP', 'Private'] as const;
const STATUS_CYCLE: TableStatus[] = ['available', 'occupied', 'reserved', 'cleaning'];
const STATUSES: { value: TableStatus; label: string }[] = [
  { value: 'available', label: 'Available' },
  { value: 'occupied', label: 'Occupied' },
  { value: 'reserved', label: 'Reserved' },
  { value: 'cleaning', label: 'Cleaning' },
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

function getSectionColorClass(section: string): string {
  return SECTION_COLORS[section] || 'bg-muted text-muted-foreground border-border';
}

function getStatusDotClass(status: string): string {
  const config = STATUS_CONFIG[status as TableStatus];
  return config?.dot || 'bg-gray-400';
}

function shouldPulse(status: string): boolean {
  return status === 'occupied' || status === 'reserved';
}

function getNextStatus(currentStatus: string): TableStatus {
  const idx = STATUS_CYCLE.indexOf(currentStatus as TableStatus);
  const next = (idx + 1) % STATUS_CYCLE.length;
  return STATUS_CYCLE[next];
}

// --- Component ---
export default function TableManagementSection({
  onRefreshData,
  dataVersion,
}: TableManagementSectionProps) {
  const { token, hasPermission } = useAuth();
  const { notify } = useNotification();

  // Auth headers — memoized to prevent unnecessary re-fetches
  const authHeaders: Record<string, string> = React.useMemo(
    () => (token ? { Authorization: `Bearer ${token}` } : {}),
    [token]
  );

  // Permission checks
  const canCreate = hasPermission('inventory', 'create');
  const canEdit = hasPermission('inventory', 'edit');
  const canDelete = hasPermission('inventory', 'delete');

  // Data state
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);

  // View state
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sectionFilter, setSectionFilter] = useState<string>('All');

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<Table | null>(null);
  const [saving, setSaving] = useState(false);

  // Form fields
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

  const prevDataVersion = useRef(dataVersion);

  // --- Fetch Tables ---
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
        setTables(data);
      }
    } catch {
      notify({
        type: 'error',
        title: 'Error',
        message: 'Failed to fetch tables',
      });
    }
  }, [token, sectionFilter, authHeaders, notify]);

  const loadAll = useCallback(
    async (silent?: boolean) => {
      if (!silent) setLoading(true);
      await fetchTables();
      setLoading(false);
    },
    [fetchTables]
  );

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Re-fetch when section filter changes
  useEffect(() => {
    fetchTables();
  }, [fetchTables]);

  // Re-fetch when dataVersion changes
  useEffect(() => {
    if (dataVersion !== undefined && dataVersion !== prevDataVersion.current) {
      prevDataVersion.current = dataVersion;
      loadAll(true);
    }
  }, [dataVersion, loadAll]);

  // --- Computed Stats ---
  const totalTables = tables.length;
  const availableCount = tables.filter((t) => t.status === 'available').length;
  const occupiedCount = tables.filter((t) => t.status === 'occupied').length;
  const reservedCount = tables.filter((t) => t.status === 'reserved').length;

  // --- Dialog Handlers ---
  const openAddDialog = () => {
    setEditingTable(null);
    setFormTableNumber('');
    setFormName('');
    setFormCapacity('4');
    setFormSection('');
    setFormStatus('available');
    setDialogOpen(true);
  };

  const openEditDialog = (table: Table) => {
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
      notify({
        type: 'error',
        title: 'Validation Error',
        message: 'Table number must be a positive number',
      });
      return;
    }

    const capacity = parseInt(formCapacity, 10);
    if (!capacity || capacity < 1 || capacity > 50) {
      notify({
        type: 'error',
        title: 'Validation Error',
        message: 'Capacity must be between 1 and 50',
      });
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

      const url = editingTable
        ? `/api/tables/${editingTable.id}`
        : '/api/tables';
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
      notify({
        type: 'error',
        title: 'Error',
        message: 'Failed to save table — Connection error',
      });
    } finally {
      setSaving(false);
    }
  };

  // --- Delete Handler ---
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/tables/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      if (res.ok) {
        notify({
          type: 'success',
          title: 'Table Deleted',
          message: `Table #${deleteTarget.tableNumber} has been deleted`,
        });
        setDeleteTarget(null);
        await fetchTables();
        onRefreshData?.();
      } else {
        const errData = await res.json().catch(() => ({}));
        notify({
          type: 'error',
          title: 'Error',
          message: `Failed to delete table — ${errData.error || 'Server error'}`,
        });
      }
    } catch {
      notify({
        type: 'error',
        title: 'Error',
        message: 'Failed to delete table — Connection error',
      });
    } finally {
      setDeleting(false);
    }
  };

  // --- Quick Status Toggle ---
  const handleQuickStatusChange = async (table: Table) => {
    const nextStatus = getNextStatus(table.status);
    setStatusChangingId(table.id);
    try {
      const res = await fetch(`/api/tables/${table.id}`, {
        method: 'PUT',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (res.ok) {
        const updatedTable = await res.json();
        setTables((prev) =>
          prev.map((t) => (t.id === table.id ? updatedTable : t))
        );
        notify({
          type: 'success',
          title: 'Status Changed',
          message: `Table #${table.tableNumber} is now ${nextStatus}`,
        });
        onRefreshData?.();
      } else {
        notify({
          type: 'error',
          title: 'Error',
          message: 'Failed to change table status',
        });
      }
    } catch {
      notify({
        type: 'error',
        title: 'Error',
        message: 'Failed to change table status',
      });
    } finally {
      setStatusChangingId(null);
    }
  };

  const handleStatusSelect = async (table: Table, status: string) => {
    setStatusChangingId(table.id);
    try {
      const res = await fetch(`/api/tables/${table.id}`, {
        method: 'PUT',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        const updatedTable = await res.json();
        setTables((prev) =>
          prev.map((t) => (t.id === table.id ? updatedTable : t))
        );
        notify({
          type: 'success',
          title: 'Status Changed',
          message: `Table #${table.tableNumber} is now ${status}`,
        });
        onRefreshData?.();
      } else {
        notify({
          type: 'error',
          title: 'Error',
          message: 'Failed to change table status',
        });
      }
    } catch {
      notify({
        type: 'error',
        title: 'Error',
        message: 'Failed to change table status',
      });
    } finally {
      setStatusChangingId(null);
    }
  };

  // --- Status Indicator Component ---
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
            >
              <span className="relative flex h-2 w-2">
                <span
                  className={`absolute inline-flex h-full w-full rounded-full ${config.dot} ${pulse ? 'animate-ping opacity-75' : 'opacity-0'}`}
                />
                <span
                  className={`relative inline-flex h-2 w-2 rounded-full ${config.dot}`}
                />
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
                onClick={() => handleStatusSelect(table, s.value)}
                className={s.value === status ? 'font-semibold' : ''}
              >
                <span
                  className={`mr-2 inline-block h-2 w-2 rounded-full ${STATUS_CONFIG[s.value].dot}`}
                />
                {s.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    }

    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${config.bg} ${config.color} border`}
      >
        <span className="relative flex h-2 w-2">
          <span
            className={`absolute inline-flex h-full w-full rounded-full ${config.dot} ${pulse ? 'animate-ping opacity-75' : 'opacity-0'}`}
          />
          <span
            className={`relative inline-flex h-2 w-2 rounded-full ${config.dot}`}
          />
        </span>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  // --- Loading Skeleton ---
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
              Organize and manage your restaurant tables, seating &amp; sections
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant="secondary"
              className="bg-white/20 text-white border-white/30 text-xs"
            >
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
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Total Tables
                </p>
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
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Available
                </p>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                  {availableCount}
                </p>
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
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Occupied
                </p>
                <p className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">
                  {occupiedCount}
                </p>
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
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Reserved
                </p>
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
                  {reservedCount}
                </p>
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
          {/* View Toggle */}
          <div className="inline-flex items-center rounded-lg border bg-muted/50 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                viewMode === 'grid'
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
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
                viewMode === 'list'
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              aria-label="List view"
            >
              <List className="h-4 w-4 mr-1.5" />
              List
            </button>
          </div>

          {/* Section Filter */}
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
          Showing{' '}
          <span className="font-semibold text-foreground">{tables.length}</span>{' '}
          table{tables.length !== 1 ? 's' : ''}
          {sectionFilter !== 'All' && (
            <>
              {' '}
              in{' '}
              <span className="font-semibold text-foreground">{sectionFilter}</span>
            </>
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
              <Button
                onClick={openAddDialog}
                className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
              >
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
          {tables.map((table) => (
            <Card
              key={table.id}
              className="border-0 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 group"
            >
              <CardContent className="p-4">
                {/* Table Number - Large */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white text-xl font-bold shadow-sm shadow-emerald-600/20">
                    {table.tableNumber}
                  </div>
                  <StatusIndicator
                    status={table.status}
                    clickable={true}
                    table={table}
                  />
                </div>

                {/* Table Name */}
                {table.name && (
                  <p className="text-sm font-semibold text-foreground truncate mb-2">
                    {table.name}
                  </p>
                )}

                {/* Capacity & Section */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Users className="h-3.5 w-3.5" />
                    <span className="font-medium">{table.capacity}</span>
                    <span>seats</span>
                  </div>
                  {table.section && (
                    <Badge
                      variant="outline"
                      className={`text-[10px] px-1.5 py-0 font-medium border ${getSectionColorClass(table.section)}`}
                    >
                      {table.section}
                    </Badge>
                  )}
                </div>

                {/* Divider */}
                <div className="border-t border-border/50 my-3" />

                {/* Actions */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                      onClick={() => openEditDialog(table)}
                      disabled={!canEdit}
                      title="Edit table"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                      onClick={() => setDeleteTarget(table)}
                      disabled={!canDelete}
                      title="Delete table"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Quick cycle status button */}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => handleQuickStatusChange(table)}
                    disabled={!canEdit || statusChangingId === table.id}
                    title={`Change to ${getNextStatus(table.status)}`}
                  >
                    {statusChangingId === table.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <AlertTriangle className="h-3 w-3" />
                    )}
                    {getNextStatus(table.status)}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* List View */}
      {tables.length > 0 && viewMode === 'list' && (
        <Card className="border-0 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Table #
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Capacity
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">
                    Section
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {tables.map((table) => (
                  <tr
                    key={table.id}
                    className="border-b last:border-b-0 transition-colors hover:bg-muted/30"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white text-sm font-bold shadow-sm shadow-emerald-600/20 shrink-0">
                          {table.tableNumber}
                        </div>
                        <span className="font-medium text-foreground sm:hidden">
                          {table.section || '—'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium text-foreground">
                        {table.name || <span className="text-muted-foreground">—</span>}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Users className="h-3.5 w-3.5" />
                        <span className="font-medium text-foreground">
                          {table.capacity}
                        </span>
                        <span>seats</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      {table.section ? (
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1.5 py-0 font-medium border ${getSectionColorClass(table.section)}`}
                        >
                          {table.section}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusIndicator
                        status={table.status}
                        clickable={true}
                        table={table}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                          onClick={() => openEditDialog(table)}
                          disabled={!canEdit}
                          title="Edit table"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                          onClick={() => setDeleteTarget(table)}
                          disabled={!canDelete}
                          title="Delete table"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editingTable ? (
                <>
                  <Pencil className="h-5 w-5 text-emerald-600" />
                  Edit Table #{editingTable.tableNumber}
                </>
              ) : (
                <>
                  <Plus className="h-5 w-5 text-emerald-600" />
                  Add New Table
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {editingTable
                ? 'Update the details for this table'
                : 'Fill in the details to create a new restaurant table'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            {/* Table Number */}
            <div className="grid gap-2">
              <Label htmlFor="tableNumber" className="flex items-center gap-1.5">
                Table Number <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="tableNumber"
                type="number"
                min={1}
                placeholder="e.g. 1"
                value={formTableNumber}
                onChange={(e) => setFormTableNumber(e.target.value)}
              />
            </div>

            {/* Table Name */}
            <div className="grid gap-2">
              <Label htmlFor="tableName">Table Name (Optional)</Label>
              <Input
                id="tableName"
                type="text"
                placeholder="e.g. Window Seat, Corner Table"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>

            {/* Capacity */}
            <div className="grid gap-2">
              <Label htmlFor="capacity" className="flex items-center gap-1.5">
                Capacity <span className="text-rose-500">*</span>
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="capacity"
                  type="number"
                  min={1}
                  max={50}
                  placeholder="4"
                  value={formCapacity}
                  onChange={(e) => setFormCapacity(e.target.value)}
                  className="w-32"
                />
                <span className="text-sm text-muted-foreground">
                  seats (1–50)
                </span>
              </div>
            </div>

            {/* Section */}
            <div className="grid gap-2">
              <Label htmlFor="section">Section</Label>
              <Select value={formSection} onValueChange={setFormSection}>
                <SelectTrigger id="section">
                  <SelectValue placeholder="Select section" />
                </SelectTrigger>
                <SelectContent>
                  {SECTION_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status */}
            <div className="grid gap-2">
              <Label htmlFor="status">Status</Label>
              <Select value={formStatus} onValueChange={setFormStatus}>
                <SelectTrigger id="status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-block h-2 w-2 rounded-full ${STATUS_CONFIG[s.value].dot}`}
                        />
                        {s.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !formTableNumber || !formCapacity}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingTable ? 'Update Table' : 'Create Table'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-rose-500" />
              Delete Table #{deleteTarget?.tableNumber}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              table
              {deleteTarget?.name ? ` "${deleteTarget.name}"` : ''} from your
              restaurant.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-rose-600 hover:bg-rose-700 text-white gap-1.5"
            >
              {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
              Delete Table
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
