'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  ClipboardList, Search, Filter, X, Loader2, LogIn, LogOut,
  FileText, Settings, Users, Package, Wallet, Trash2, Edit,
  RefreshCw, ChevronLeft, ChevronRight, Shield, Activity,
  Calendar, ArrowUpDown, Eye,
} from 'lucide-react';
import {
  Sheet, SheetContent, SheetClose, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { apiFetch } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

// ── Types ──────────────────────────────────────────────────────────────────

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

// ── Action Icon & Color Config ─────────────────────────────────────────────

const actionConfig: Record<string, { icon: React.ReactNode; color: string; bg: string; label: string }> = {
  LOGIN: {
    icon: <LogIn className="size-3.5" />,
    color: 'text-green-600 dark:text-green-400',
    bg: 'bg-green-100 dark:bg-green-950/50',
    label: 'Login',
  },
  LOGOUT: {
    icon: <LogOut className="size-3.5" />,
    color: 'text-red-500 dark:text-red-400',
    bg: 'bg-red-100 dark:bg-red-950/50',
    label: 'Logout',
  },
  CREATE_INVOICE: {
    icon: <FileText className="size-3.5" />,
    color: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-100 dark:bg-blue-950/50',
    label: 'New Bill',
  },
  UPDATE_INVOICE: {
    icon: <Edit className="size-3.5" />,
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-100 dark:bg-amber-950/50',
    label: 'Edit Bill',
  },
  DELETE_INVOICE: {
    icon: <Trash2 className="size-3.5" />,
    color: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-100 dark:bg-red-950/50',
    label: 'Delete Bill',
  },
  CREATE_USER: {
    icon: <Users className="size-3.5" />,
    color: 'text-purple-600 dark:text-purple-400',
    bg: 'bg-purple-100 dark:bg-purple-950/50',
    label: 'User Created',
  },
  UPDATE_USER: {
    icon: <Edit className="size-3.5" />,
    color: 'text-purple-600 dark:text-purple-400',
    bg: 'bg-purple-100 dark:bg-purple-950/50',
    label: 'User Updated',
  },
  DELETE_USER: {
    icon: <Trash2 className="size-3.5" />,
    color: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-100 dark:bg-red-950/50',
    label: 'User Deleted',
  },
  SUSPEND_USER: {
    icon: <Shield className="size-3.5" />,
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-100 dark:bg-amber-950/50',
    label: 'User Suspended',
  },
  ACTIVATE_USER: {
    icon: <Shield className="size-3.5" />,
    color: 'text-green-600 dark:text-green-400',
    bg: 'bg-green-100 dark:bg-green-950/50',
    label: 'User Activated',
  },
  CHANGE_PASSWORD: {
    icon: <Settings className="size-3.5" />,
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-100 dark:bg-amber-950/50',
    label: 'Password Changed',
  },
  UPDATE_SETTINGS: {
    icon: <Settings className="size-3.5" />,
    color: 'text-slate-600 dark:text-slate-400',
    bg: 'bg-slate-100 dark:bg-slate-900/50',
    label: 'Settings Updated',
  },
  CREATE_ITEM: {
    icon: <Package className="size-3.5" />,
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-100 dark:bg-emerald-950/50',
    label: 'Item Created',
  },
  UPDATE_ITEM: {
    icon: <Edit className="size-3.5" />,
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-100 dark:bg-emerald-950/50',
    label: 'Item Updated',
  },
  DELETE_ITEM: {
    icon: <Trash2 className="size-3.5" />,
    color: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-100 dark:bg-red-950/50',
    label: 'Item Deleted',
  },
  CASH_TRANSACTION: {
    icon: <Wallet className="size-3.5" />,
    color: 'text-teal-600 dark:text-teal-400',
    bg: 'bg-teal-100 dark:bg-teal-950/50',
    label: 'Cash Transaction',
  },
};

const defaultActionConfig = {
  icon: <Activity className="size-3.5" />,
  color: 'text-gray-600 dark:text-gray-400',
  bg: 'bg-gray-100 dark:bg-gray-800/50',
};

function getActionConfig(action: string) {
  return actionConfig[action] || { ...defaultActionConfig, label: action };
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatTime(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit', hour12: true,
    });
  } catch {
    return '—';
  }
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch {
    return '—';
  }
}

function formatRelative(dateStr: string): string {
  try {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDate(dateStr);
  } catch {
    return '—';
  }
}

function parseDetails(details: string): Record<string, unknown> | null {
  try {
    return JSON.parse(details);
  } catch {
    return null;
  }
}

// ── Component ──────────────────────────────────────────────────────────────

interface ActivityLogSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ActivityLogSheet({ open, onOpenChange }: ActivityLogSheetProps) {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({ page: 1, limit: 30, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  // Debounce search to prevent excessive API calls
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 400);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [searchQuery]);

  const fetchLogs = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '30' });
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (actionFilter && actionFilter !== 'all') params.set('action', actionFilter);

      if (dateFilter && dateFilter !== 'all') {
        const now = new Date();
        let startDate = '';
        switch (dateFilter) {
          case 'today':
            startDate = now.toISOString().split('T')[0];
            break;
          case 'week': {
            const weekAgo = new Date(now);
            weekAgo.setDate(weekAgo.getDate() - 7);
            startDate = weekAgo.toISOString().split('T')[0];
            break;
          }
          case 'month': {
            const monthAgo = new Date(now);
            monthAgo.setMonth(monthAgo.getMonth() - 1);
            startDate = monthAgo.toISOString().split('T')[0];
            break;
          }
        }
        if (startDate) params.set('startDate', startDate);
      }

      const res = await apiFetch(`/api/audit-logs?${params}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
        setPagination(data.pagination || { page: 1, limit: 30, total: 0, totalPages: 0 });
      }
    } catch {
      // silent fail
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, actionFilter, dateFilter]);

  useEffect(() => {
    if (open) {
      fetchLogs(1);
    }
  }, [open, fetchLogs]);

  const handlePageChange = (newPage: number) => {
    fetchLogs(newPage);
  };

  // Group logs by date (memoized)
  const groupedLogs = useMemo(() => {
    const result: { date: string; entries: AuditLogEntry[] }[] = [];
    let currentDate = '';
    for (const log of logs) {
      const logDate = formatDate(log.createdAt);
      if (logDate !== currentDate) {
        currentDate = logDate;
        result.push({ date: logDate, entries: [log] });
      } else {
        result[result.length - 1].entries.push(log);
      }
    }
    return result;
  }, [logs]);

  // Get unique actions for filter (memoized)
  const uniqueActions = useMemo(() => [...new Set(logs.map(l => l.action))].sort(), [logs]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg p-0 flex flex-col overflow-hidden [&>[data-slot=sheet-close]]:hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 p-5 text-white shrink-0">
          <div className="pointer-events-none absolute -right-8 -top-8 size-32 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute -bottom-6 -left-6 size-24 rounded-full bg-white/5" />
          <SheetHeader className="relative z-10 space-y-0">
            <SheetTitle className="text-white text-lg flex items-center gap-2">
              <ClipboardList className="size-5" />
              Activity Log
            </SheetTitle>
            <SheetDescription className="text-blue-100 text-sm">
              Track all user actions, logins, and system events
            </SheetDescription>
          </SheetHeader>

          {/* Custom close button — visible on gradient */}
          <SheetClose className="absolute top-4 right-4 z-20 flex size-9 items-center justify-center rounded-xl bg-white/10 hover:bg-white/25 backdrop-blur-sm transition-all duration-200 hover:rotate-90 active:scale-90 border border-white/20 text-white hover:text-white">
            <X className="size-4" strokeWidth={2.5} />
          </SheetClose>

          {/* Summary Stats */}
          <div className="relative z-10 flex items-center gap-3 mt-4">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/15 text-[11px] font-medium">
              <span className="size-1.5 rounded-full bg-green-300" />
              {pagination.total} total events
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/15 text-[11px] font-medium">
              <LogIn className="size-3" />
              {logs.filter(l => l.action === 'LOGIN').length} logins
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="px-4 py-3 border-b bg-muted/30 space-y-2.5 shrink-0">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              placeholder="Search by user or action..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-8 text-sm"
              onKeyDown={(e) => e.key === 'Enter' && fetchLogs(1)}
            />
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(''); fetchLogs(1); }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          {/* Filter Row */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-muted-foreground shrink-0">
              <Filter className="size-3" />
              <span className="text-[10px] font-medium uppercase tracking-wider">Filter</span>
            </div>
            <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); }}>
              <SelectTrigger className="h-7 text-xs flex-1 min-w-0">
                <SelectValue placeholder="All Actions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                {uniqueActions.map((action) => {
                  const config = getActionConfig(action);
                  return (
                    <SelectItem key={action} value={action}>
                      <span className="flex items-center gap-1.5">
                        {config.label}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            <Select value={dateFilter} onValueChange={(v) => { setDateFilter(v); }}>
              <SelectTrigger className="h-7 text-xs flex-1 min-w-0">
                <SelectValue placeholder="All Time" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">Last 7 Days</SelectItem>
                <SelectItem value="month">Last 30 Days</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 shrink-0"
              onClick={() => fetchLogs(pagination.page)}
              disabled={loading}
            >
              <RefreshCw className={`size-3 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Log Entries */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="size-8 rounded-lg shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <div className="size-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
                <ClipboardList className="size-7 text-muted-foreground" />
              </div>
              <h3 className="text-sm font-semibold text-foreground mb-1">No activity found</h3>
              <p className="text-xs text-muted-foreground max-w-[200px]">
                {searchQuery || actionFilter !== 'all' || dateFilter !== 'all'
                  ? 'Try adjusting your search or filters'
                  : 'Activity will appear here as users interact with the system'}
              </p>
            </div>
          ) : (
            <div className="p-3 space-y-1">
              {groupedLogs.map((group) => (
                <div key={group.date}>
                  {/* Date Header */}
                  <div className="flex items-center gap-2 py-2 px-1 sticky top-0 bg-background/95 backdrop-blur-sm z-10">
                    <Calendar className="size-3 text-muted-foreground" />
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      {group.date}
                    </span>
                    <Separator className="flex-1" />
                    <span className="text-[10px] text-muted-foreground">{group.entries.length} events</span>
                  </div>

                  {/* Log Entries */}
                  <div className="space-y-0.5">
                    {group.entries.map((log) => {
                      const config = getActionConfig(log.action);
                      const details = parseDetails(log.details);

                      return (
                        <div
                          key={log.id}
                          className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-muted/50 transition-colors group"
                        >
                          {/* Action Icon */}
                          <div className={`flex size-8 rounded-lg items-center justify-center shrink-0 mt-0.5 ${config.bg} ${config.color}`}>
                            {config.icon}
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-foreground truncate">
                                {log.userName}
                              </span>
                              <Badge
                                variant="outline"
                                className={`text-[9px] font-semibold px-1.5 py-0 border-0 ${
                                  log.role === 'Admin'
                                    ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400'
                                    : log.role === 'Manager'
                                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400'
                                      : log.role === 'Cashier'
                                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
                                        : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
                                }`}
                              >
                                {log.role}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className={`text-xs font-semibold ${config.color}`}>
                                {config.label}
                              </span>
                              {log.target && (
                                <>
                                  <span className="text-muted-foreground">·</span>
                                  <span className="text-xs text-muted-foreground truncate">
                                    {log.target}
                                  </span>
                                </>
                              )}
                            </div>
                            {/* Extra details */}
                            {details && !!(details.loginId || details.invoiceNumber) && (
                              <div className="mt-1 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                {!!details.loginId && (
                                  <span className="flex items-center gap-0.5">
                                    <Eye className="size-2.5" />
                                    ID: {String(details.loginId)}
                                  </span>
                                )}
                                {!!details.invoiceNumber && (
                                  <span className="flex items-center gap-0.5">
                                    <FileText className="size-2.5" />
                                    {String(details.invoiceNumber)}
                                  </span>
                                )}
                                {log.ipAddress && (
                                  <>
                                    <span className="text-muted-foreground">·</span>
                                    <span>{log.ipAddress}</span>
                                  </>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Timestamp */}
                          <div className="shrink-0 text-right">
                            <span className="text-[11px] font-medium text-foreground tabular-nums">
                              {formatTime(log.createdAt)}
                            </span>
                            <p className="text-[10px] text-muted-foreground">
                              {formatRelative(log.createdAt)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pagination Footer */}
        {pagination.totalPages > 1 && (
          <div className="px-4 py-3 border-t bg-muted/30 flex items-center justify-between shrink-0">
            <span className="text-[11px] text-muted-foreground">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-7 w-7 p-0"
                disabled={pagination.page <= 1 || loading}
                onClick={() => handlePageChange(pagination.page - 1)}
              >
                <ChevronLeft className="size-3.5" />
              </Button>
              <div className="flex items-center gap-0.5">
                {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                  let pageNum: number;
                  if (pagination.totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (pagination.page <= 3) {
                    pageNum = i + 1;
                  } else if (pagination.page >= pagination.totalPages - 2) {
                    pageNum = pagination.totalPages - 4 + i;
                  } else {
                    pageNum = pagination.page - 2 + i;
                  }
                  return (
                    <Button
                      key={pageNum}
                      variant={pageNum === pagination.page ? 'default' : 'outline'}
                      size="sm"
                      className="h-7 w-7 p-0 text-[11px]"
                      disabled={loading}
                      onClick={() => handlePageChange(pageNum)}
                    >
                      {pageNum}
                    </Button>
                  );
                })}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-7 w-7 p-0"
                disabled={pagination.page >= pagination.totalPages || loading}
                onClick={() => handlePageChange(pagination.page + 1)}
              >
                <ChevronRight className="size-3.5" />
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
