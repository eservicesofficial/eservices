'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Search,
  Download,
  Filter,
  ChevronLeft,
  ChevronRight,
  Clock,
  User,
  Shield,
  Activity,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  X,
  MonitorSmartphone,
} from 'lucide-react';
import { notify } from '@/lib/notification-store';
import { useAuth } from '@/components/auth-provider';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
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

// ── Types ───────────────────────────────────────────────────
interface AuditLogEntry {
  id: string;
  unitCode: string;
  userId: string;
  userName: string;
  role: string;
  action: string;
  target: string;
  details: string;
  ipAddress: string;
  createdAt: string;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface AuditLogSectionProps {
  onNavigate?: (page: string) => void;
  onRefreshData?: () => void;
}

// ── Action Types ────────────────────────────────────────────
const ACTION_TYPES = [
  { value: 'ALL_ACTIONS', label: 'All Actions' },
  { value: 'LOGIN', label: 'Login' },
  { value: 'LOGOUT', label: 'Logout' },
  { value: 'CREATE_INVOICE', label: 'Create Invoice' },
  { value: 'UPDATE_INVOICE', label: 'Update Invoice' },
  { value: 'DELETE_INVOICE', label: 'Delete Invoice' },
  { value: 'CREATE_USER', label: 'Create User' },
  { value: 'UPDATE_USER', label: 'Update User' },
  { value: 'DELETE_USER', label: 'Delete User' },
  { value: 'UPDATE_SETTINGS', label: 'Update Settings' },
  { value: 'CREATE_ITEM', label: 'Create Item' },
  { value: 'UPDATE_ITEM', label: 'Update Item' },
  { value: 'DELETE_ITEM', label: 'Delete Item' },
  { value: 'PROCESS_REFUND', label: 'Process Refund' },
  { value: 'EXPORT_DATA', label: 'Export Data' },
  { value: 'IMPORT_DATA', label: 'Import Data' },
  { value: 'RESET_DATA', label: 'Reset Data' },
  { value: 'UPDATE_PETTY_CASH', label: 'Update Petty Cash' },
  { value: 'MANAGE_KHATA', label: 'Manage Khata' },
  { value: 'MARK_ATTENDANCE', label: 'Mark Attendance' },
] as const;

// ── Action Color System ────────────────────────────────────
function getActionColorClass(action: string): string {
  const a = (action || '').toUpperCase();
  if (a === 'LOGIN' || a === 'LOGOUT') {
    return 'bg-sky-100 text-sky-700 border-sky-300 dark:bg-sky-900/40 dark:text-sky-400 dark:border-sky-700';
  }
  if (a.startsWith('CREATE_')) {
    return 'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-400 dark:border-emerald-700';
  }
  if (a.startsWith('UPDATE_')) {
    return 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/40 dark:text-amber-400 dark:border-amber-700';
  }
  if (a.startsWith('DELETE_') || a.startsWith('RESET_')) {
    return 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/40 dark:text-red-400 dark:border-red-700';
  }
  if (a.includes('SETTINGS') || a === 'UPDATE_SETTINGS') {
    return 'bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-900/40 dark:text-purple-400 dark:border-purple-700';
  }
  if (a.startsWith('PROCESS_') || a === 'MANAGE_KHATA') {
    return 'bg-teal-100 text-teal-700 border-teal-300 dark:bg-teal-900/40 dark:text-teal-400 dark:border-teal-700';
  }
  return 'bg-muted text-muted-foreground border-muted-foreground/20';
}

function getActionLabel(action: string): string {
  return (action || '')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function getActionIcon(action: string) {
  const a = (action || '').toUpperCase();
  if (a === 'LOGIN' || a === 'LOGOUT') return <Shield className="h-3 w-3" />;
  if (a.includes('USER')) return <User className="h-3 w-3" />;
  if (a.includes('INVOICE') || a.includes('REFUND')) return <Activity className="h-3 w-3" />;
  if (a.includes('SETTINGS')) return <MonitorSmartphone className="h-3 w-3" />;
  return <Activity className="h-3 w-3" />;
}

// ── Role Color ──────────────────────────────────────────────
function getRoleColorClass(role: string): string {
  const r = (role || '').toLowerCase();
  switch (r) {
    case 'admin':
      return 'bg-rose-100 text-rose-700 border-rose-300 dark:bg-rose-900/40 dark:text-rose-400 dark:border-rose-700';
    case 'manager':
      return 'bg-violet-100 text-violet-700 border-violet-300 dark:bg-violet-900/40 dark:text-violet-400 dark:border-violet-700';
    case 'cashier':
      return 'bg-cyan-100 text-cyan-700 border-cyan-300 dark:bg-cyan-900/40 dark:text-cyan-400 dark:border-cyan-700';
    default:
      return 'bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-900/40 dark:text-slate-400 dark:border-slate-700';
  }
}

// ── Date Formatting ─────────────────────────────────────────
function formatTimestamp(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    }) + ' ' + date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return dateStr;
  }
}

function formatTimestampFull(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }) + ' ' + date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  } catch {
    return dateStr;
  }
}

function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ── Component ───────────────────────────────────────────────
export default function AuditLogSection({
  onNavigate,
  onRefreshData,
}: AuditLogSectionProps) {
  const { token } = useAuth();
  const authHeaders: Record<string, string> = token ? { 'Authorization': `Bearer ${token}` } : {};
  // Data state
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);

  // Filter state
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL_ACTIONS');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');

  // UI state
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [exporting, setExporting] = useState(false);

  const autoRefreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Fetch Logs ───────────────────────────────────────────
  const fetchLogs = useCallback(async (page = 1, limit = 50) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(limit));
      if (actionFilter && actionFilter !== 'ALL_ACTIONS') params.set('action', actionFilter);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());

      const res = await fetch(`/api/audit-logs?${params.toString()}`, { headers: authHeaders });
      if (!res.ok) throw new Error('Failed to fetch audit logs');
      const data = await res.json();

      setLogs(Array.isArray(data.logs) ? data.logs : []);
      if (data.pagination) {
        setPagination(data.pagination);
      }
    } catch {
      notify({ type: 'error', title: 'Error', message: 'Failed to load audit logs' });
    } finally {
      setLoading(false);
    }
  }, [actionFilter, startDate, endDate, searchQuery]);

  // Initial fetch and filter changes
  useEffect(() => {
    fetchLogs(1, pagination.limit);
  }, [fetchLogs, pagination.limit]);

  // Auto-refresh
  useEffect(() => {
    if (autoRefresh) {
      autoRefreshTimerRef.current = setInterval(() => {
        fetchLogs(pagination.page, pagination.limit);
      }, 15000); // every 15 seconds
    }
    return () => {
      if (autoRefreshTimerRef.current) {
        clearInterval(autoRefreshTimerRef.current);
        autoRefreshTimerRef.current = null;
      }
    };
  }, [autoRefresh, fetchLogs, pagination.page, pagination.limit]);

  // Debounced search
  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setSearchQuery(value);
    }, 400);
  }, []);

  // ── Pagination Handlers ──────────────────────────────────
  const goToPage = (page: number) => {
    if (page < 1 || page > pagination.totalPages) return;
    fetchLogs(page, pagination.limit);
  };

  const handleItemsPerPageChange = (value: string) => {
    const limit = parseInt(value);
    fetchLogs(1, limit);
  };

  // ── Clear Filters ────────────────────────────────────────
  const clearFilters = useCallback(() => {
    setStartDate('');
    setEndDate('');
    setActionFilter('ALL_ACTIONS');
    setSearchInput('');
    setSearchQuery('');
  }, []);

  // ── Export to JSON ───────────────────────────────────────
  const handleExport = async () => {
    try {
      setExporting(true);
      // Fetch all matching logs for export
      const params = new URLSearchParams();
      params.set('page', '1');
      params.set('limit', String(pagination.total)); // get all
      if (actionFilter && actionFilter !== 'ALL_ACTIONS') params.set('action', actionFilter);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());

      const res = await fetch(`/api/audit-logs?${params.toString()}`, { headers: authHeaders });
      if (!res.ok) throw new Error('Export failed');
      const data = await res.json();

      const exportData = {
        exportedAt: new Date().toISOString(),
        unitCode: (data.logs[0]?.unitCode) || 'UNKNOWN',
        filters: {
          action: actionFilter !== 'ALL_ACTIONS' ? actionFilter : null,
          startDate: startDate || null,
          endDate: endDate || null,
          search: searchQuery.trim() || null,
        },
        totalRecords: Array.isArray(data.logs) ? data.logs.length : 0,
        logs: Array.isArray(data.logs)
          ? data.logs.map((log: AuditLogEntry) => ({
              timestamp: log.createdAt,
              user: log.userName,
              role: log.role,
              action: log.action,
              target: log.target,
              ipAddress: log.ipAddress || 'N/A',
              details: (() => {
                try {
                  return JSON.parse(log.details || '{}');
                } catch {
                  return log.details;
                }
              })(),
            }))
          : [],
      };

      const unitCode = data.logs[0]?.unitCode || 'all';
      const dateStr = toDateString(new Date());
      const filename = `audit-logs-${unitCode}-${dateStr}.json`;

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      notify({ type: 'success', title: 'Export Complete', message: `Exported ${exportData.totalRecords} log entries — ${filename}` });
    } catch {
      notify({ type: 'error', title: 'Error', message: 'Failed to export audit logs' });
    } finally {
      setExporting(false);
    }
  };

  // ── Parse Details ────────────────────────────────────────
  const parseDetails = (details: string): string => {
    try {
      const parsed = JSON.parse(details);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return details || 'No additional details';
    }
  };

  // ── Active filter count ──────────────────────────────────
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (startDate) count++;
    if (endDate) count++;
    if (actionFilter !== 'ALL_ACTIONS') count++;
    if (searchQuery.trim()) count++;
    return count;
  }, [startDate, endDate, actionFilter, searchQuery]);

  // ── Page numbers for pagination ──────────────────────────
  const pageNumbers = useMemo(() => {
    const { page, totalPages } = pagination;
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages: number[] = [];
    if (page <= 4) {
      for (let i = 1; i <= 5; i++) pages.push(i);
      pages.push(-1); // ellipsis
      pages.push(totalPages);
    } else if (page >= totalPages - 3) {
      pages.push(1);
      pages.push(-1);
      for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      pages.push(-1);
      for (let i = page - 1; i <= page + 1; i++) pages.push(i);
      pages.push(-1);
      pages.push(totalPages);
    }
    return pages;
  }, [pagination]);

  // ── Has active filters ───────────────────────────────────
  const hasActiveFilters = activeFilterCount > 0;

  // ── Render Skeleton ──────────────────────────────────────
  if (loading && logs.length === 0) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/40">
                  <Activity className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <CardTitle className="text-lg">Audit Log</CardTitle>
                  <Skeleton className="mt-1 h-4 w-48" />
                </div>
              </div>
              <Skeleton className="h-9 w-24" />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <Skeleton className="h-9 w-48" />
              <Skeleton className="h-9 w-48" />
              <Skeleton className="h-9 w-40" />
              <Skeleton className="h-9 w-36" />
            </div>
            <Separator />
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/40">
                <Activity className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <CardTitle className="text-lg">Audit Log</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {pagination.total > 0
                    ? `${pagination.total.toLocaleString()} log ${pagination.total === 1 ? 'entry' : 'entries'} recorded`
                    : 'No log entries'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Auto-refresh toggle */}
              <div className="flex items-center gap-2">
                <Switch
                  id="auto-refresh"
                  checked={autoRefresh}
                  onCheckedChange={setAutoRefresh}
                />
                <Label htmlFor="auto-refresh" className="text-xs text-muted-foreground cursor-pointer select-none">
                  Auto-refresh
                </Label>
              </div>
              <Separator orientation="vertical" className="mx-1 h-6" />
              {/* Export button */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                disabled={exporting || pagination.total === 0}
                className="gap-1.5"
              >
                {exporting ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                <span className="hidden sm:inline">Export JSON</span>
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* ── Search & Filter Toggle ─────────────────────── */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by user, action, or target..."
                value={searchInput}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-9 pr-8"
              />
              {searchInput && (
                <button
                  onClick={() => handleSearchChange('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={showFilters ? 'default' : 'outline'}
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className="gap-1.5"
              >
                <Filter className="h-3.5 w-3.5" />
                Filters
                {hasActiveFilters && (
                  <Badge
                    variant="secondary"
                    className="ml-0.5 h-5 min-w-5 px-1.5 text-[10px] font-bold"
                  >
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="text-muted-foreground hover:text-foreground gap-1"
                >
                  <X className="h-3 w-3" />
                  Clear
                </Button>
              )}
            </div>
          </div>

          {/* ── Expanded Filters ───────────────────────────── */}
          {showFilters && (
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {/* Start Date */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">
                    From Date
                  </Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="h-9"
                  />
                </div>

                {/* End Date */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">
                    To Date
                  </Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="h-9"
                  />
                </div>

                {/* Action Type */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Action Type
                  </Label>
                  <Select value={actionFilter} onValueChange={setActionFilter}>
                    <SelectTrigger className="h-9 w-full">
                      <SelectValue placeholder="All Actions" />
                    </SelectTrigger>
                    <SelectContent>
                      {ACTION_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Quick Actions */}
                <div className="flex items-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const today = toDateString(new Date());
                      setStartDate(today);
                      setEndDate(today);
                    }}
                    className="h-9 gap-1.5 text-xs"
                  >
                    <Clock className="h-3 w-3" />
                    Today
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const now = new Date();
                      const weekAgo = new Date(now);
                      weekAgo.setDate(weekAgo.getDate() - 7);
                      setStartDate(toDateString(weekAgo));
                      setEndDate(toDateString(now));
                    }}
                    className="h-9 gap-1.5 text-xs"
                  >
                    <Clock className="h-3 w-3" />
                    Last 7 Days
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const now = new Date();
                      const monthAgo = new Date(now);
                      monthAgo.setDate(monthAgo.getDate() - 30);
                      setStartDate(toDateString(monthAgo));
                      setEndDate(toDateString(now));
                    }}
                    className="h-9 gap-1.5 text-xs"
                  >
                    <Clock className="h-3 w-3" />
                    30 Days
                  </Button>
                </div>
              </div>
            </div>
          )}

          <Separator />

          {/* ── Log Table ──────────────────────────────────── */}
          <div className="rounded-lg border overflow-hidden">
            <div className="max-h-[520px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow className="sticky top-0 z-10 bg-muted/90 backdrop-blur-sm hover:bg-muted/90">
                    <TableHead className="w-9" />
                    <TableHead className="min-w-[160px]">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                        Timestamp
                      </div>
                    </TableHead>
                    <TableHead className="min-w-[140px]">
                      <div className="flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                        User
                      </div>
                    </TableHead>
                    <TableHead className="min-w-[100px] hidden md:table-cell">Role</TableHead>
                    <TableHead className="min-w-[140px]">Action</TableHead>
                    <TableHead className="min-w-[120px] hidden lg:table-cell">Target</TableHead>
                    <TableHead className="min-w-[120px] hidden xl:table-cell">IP Address</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-48 text-center">
                        <div className="flex flex-col items-center gap-3 text-muted-foreground">
                          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                            <Activity className="h-6 w-6" />
                          </div>
                          <div>
                            <p className="font-medium">No logs found</p>
                            <p className="text-sm mt-1">
                              {hasActiveFilters
                                ? 'Try adjusting your filters to see more results.'
                                : 'Audit log entries will appear here as users interact with the system.'}
                            </p>
                          </div>
                          {hasActiveFilters && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={clearFilters}
                              className="mt-1 gap-1.5"
                            >
                              <X className="h-3.5 w-3.5" />
                              Clear Filters
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    logs.map((log, index) => {
                      const isExpanded = expandedRow === log.id;
                      const hasDetails = log.details && log.details !== '{}' && log.details !== '';
                      return (
                        <React.Fragment key={log.id}>
                          <TableRow
                            className={`cursor-pointer transition-colors ${
                              isExpanded
                                ? 'bg-muted/50'
                                : index % 2 === 1
                                ? 'bg-muted/20 hover:bg-muted/50'
                                : ''
                            }`}
                            onClick={() => setExpandedRow(isExpanded ? null : log.id)}
                          >
                            {/* Expand/Collapse */}
                            <TableCell className="pr-0">
                              <div className="flex h-6 w-6 items-center justify-center rounded hover:bg-muted">
                                {hasDetails ? (
                                  isExpanded ? (
                                    <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                                  ) : (
                                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                                  )
                                ) : (
                                  <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30" />
                                )}
                              </div>
                            </TableCell>

                            {/* Timestamp */}
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-medium text-sm">
                                  {formatTimestamp(log.createdAt)}
                                </span>
                                <span className="text-[11px] text-muted-foreground hidden sm:block">
                                  {formatTimestampFull(log.createdAt)}
                                </span>
                              </div>
                            </TableCell>

                            {/* User */}
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-medium text-sm">{log.userName || 'Unknown'}</span>
                                <span className="text-[11px] text-muted-foreground md:hidden">
                                  {log.role}
                                </span>
                              </div>
                            </TableCell>

                            {/* Role */}
                            <TableCell className="hidden md:table-cell">
                              {log.role && (
                                <Badge
                                  variant="outline"
                                  className={`text-[11px] ${getRoleColorClass(log.role)}`}
                                >
                                  {log.role}
                                </Badge>
                              )}
                            </TableCell>

                            {/* Action */}
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={`gap-1 text-[11px] ${getActionColorClass(log.action)}`}
                              >
                                {getActionIcon(log.action)}
                                {getActionLabel(log.action)}
                              </Badge>
                            </TableCell>

                            {/* Target */}
                            <TableCell className="hidden lg:table-cell">
                              <span className="text-sm text-muted-foreground truncate max-w-[200px] block">
                                {log.target || '—'}
                              </span>
                            </TableCell>

                            {/* IP Address */}
                            <TableCell className="hidden xl:table-cell">
                              <span className="text-xs text-muted-foreground font-mono">
                                {log.ipAddress || '—'}
                              </span>
                            </TableCell>
                          </TableRow>

                          {/* Expanded Details Row */}
                          {isExpanded && (
                            <TableRow className="bg-muted/30 hover:bg-muted/30">
                              <TableCell colSpan={7} className="py-0">
                                <div className="px-4 py-3 pb-4">
                                  <div className="rounded-md border bg-background p-3">
                                    <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                                      <Activity className="h-3 w-3" />
                                      Details
                                    </div>
                                    <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded bg-muted/50 p-3 text-xs font-mono leading-relaxed">
                                      {parseDetails(log.details)}
                                    </pre>

                                    {/* Show all fields in detail view for mobile */}
                                    <div className="mt-3 grid grid-cols-2 gap-3 text-xs sm:hidden">
                                      {log.role && (
                                        <div>
                                          <span className="text-muted-foreground">Role: </span>
                                          <Badge
                                            variant="outline"
                                            className={`text-[11px] ${getRoleColorClass(log.role)}`}
                                          >
                                            {log.role}
                                          </Badge>
                                        </div>
                                      )}
                                      {log.target && (
                                        <div>
                                          <span className="text-muted-foreground">Target: </span>
                                          <span className="font-medium">{log.target}</span>
                                        </div>
                                      )}
                                      {log.ipAddress && (
                                        <div>
                                          <span className="text-muted-foreground">IP: </span>
                                          <span className="font-mono">{log.ipAddress}</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* ── Pagination ─────────────────────────────────── */}
          {logs.length > 0 && (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              {/* Items per page */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="hidden sm:inline">Show</span>
                <Select
                  value={String(pagination.limit)}
                  onValueChange={handleItemsPerPageChange}
                >
                  <SelectTrigger size="sm" className="w-[70px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
                <span className="hidden sm:inline">
                  entries — showing{' '}
                  <span className="font-medium text-foreground">
                    {(pagination.page - 1) * pagination.limit + 1}
                  </span>{' '}
                  to{' '}
                  <span className="font-medium text-foreground">
                    {Math.min(pagination.page * pagination.limit, pagination.total)}
                  </span>{' '}
                  of{' '}
                  <span className="font-medium text-foreground">
                    {pagination.total.toLocaleString()}
                  </span>
                </span>
                <span className="sm:hidden">
                  {((pagination.page - 1) * pagination.limit + 1).toLocaleString()}-
                  {Math.min(pagination.page * pagination.limit, pagination.total).toLocaleString()}{' '}
                  of {pagination.total.toLocaleString()}
                </span>
              </div>

              {/* Page Controls */}
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={pagination.page <= 1}
                  onClick={() => goToPage(pagination.page - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                {pageNumbers.map((pageNum, idx) =>
                  pageNum === -1 ? (
                    <div
                      key={`ellipsis-${idx}`}
                      className="flex h-8 w-8 items-center justify-center text-xs text-muted-foreground"
                    >
                      ...
                    </div>
                  ) : (
                    <Button
                      key={pageNum}
                      variant={pageNum === pagination.page ? 'default' : 'outline'}
                      size="icon"
                      className="h-8 w-8 text-xs"
                      onClick={() => goToPage(pageNum)}
                    >
                      {pageNum}
                    </Button>
                  )
                )}

                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => goToPage(pagination.page + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* ── Refresh indicator ──────────────────────────── */}
          {autoRefresh && (
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground pt-1">
              <RefreshCw className="h-3 w-3 animate-spin" />
              Auto-refreshing every 15 seconds
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
