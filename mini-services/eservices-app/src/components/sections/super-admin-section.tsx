'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Building2, Users, Plus, Search, Edit, Trash2, Ban, CheckCircle2,
  Eye, Loader2, Shield, ChevronRight, X, UserPlus, Key, Lock,
  Unlock, AlertTriangle, RefreshCcw, RefreshCw, ArrowLeft, Copy, Check,
  Activity, BarChart3, Store, UserCog, ClipboardList, LogOut,
  Mail, Phone, MapPin, Hash, FileText, Clock, ShieldAlert,
  Calendar, CalendarClock, Timer, Zap, RotateCcw, Download,
  Bell, Cake, UtensilsCrossed, Scissors, ShoppingCart, Pill, Cpu, Settings2,
  ToggleLeft, ToggleRight, ListChecks, Tag,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '@/components/ui/tabs';
import { notify } from '@/lib/notification-store';
import { useNotificationStore } from '@/lib/notification-store';
import NotificationCenter from '@/components/notification-center';
import { PWAInstallButton } from '@/components/pwa-install-prompt';
import { CATEGORY_TEMPLATES, getCategoryTemplate } from '@/lib/category-templates';

// ── Props ──────────────────────────────────────────────────────────────────

interface SuperAdminSectionProps {
  token: string;
  onLogout: () => void;
}

// ── Types & Interfaces ─────────────────────────────────────────────────────

interface DashboardStats {
  totalBusinesses: number;
  activeBusinesses: number;
  inactiveBusinesses: number;
  totalUsers: number;
}

interface CategoryBreakdown {
  category: string;
  count: number;
}

interface RecentBusiness {
  code: string;
  name: string;
  category: string;
  isActive: boolean;
  createdAt: string;
}

interface RecentLog {
  id: string;
  unitCode: string;
  userName: string;
  action: string;
  target: string;
  createdAt: string;
}

interface DashboardData {
  stats: DashboardStats;
  categoryBreakdown: CategoryBreakdown[];
  recentBusinesses: RecentBusiness[];
  recentLogs: RecentLog[];
}

interface Business {
  code: string;
  name: string;
  category: string;
  description: string;
  address: string;
  phone: string;
  email: string;
  gstNumber: string;
  isActive: boolean;
  expiresAt: string | null;
  activationStatus: string;
  userCount: number;
  featureCount: number;
  customFieldCount: number;
  invoiceCount: number;
  createdAt: string;
}

interface BusinessUser {
  id: string;
  loginId: string;
  name: string;
  role: string;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLogin: string | null;
  status: string;
}

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

interface AuditLogPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface CreatedBusinessResult {
  business: { code: string; name: string; category: string };
  admin: { loginId: string; temporaryPassword: string; mustChangePassword: boolean };
}

// ── Constants ──────────────────────────────────────────────────────────────

const CATEGORIES = CATEGORY_TEMPLATES.map((c) => ({
  value: c.value,
  label: c.label,
  prefix: c.prefix,
  icon: c.icon,
  color: c.color,
  description: c.description,
}));

const CATEGORY_ICON_MAP: Record<string, React.ReactNode> = {
  bakery: <Cake className="size-4 text-amber-500" />,
  food: <UtensilsCrossed className="size-4 text-red-500" />,
  clothing: <Scissors className="size-4 text-purple-500" />,
  general: <ShoppingCart className="size-4 text-blue-500" />,
  pharmacy: <Pill className="size-4 text-emerald-500" />,
  electronics: <Cpu className="size-4 text-sky-500" />,
  custom: <Settings2 className="size-4 text-gray-500" />,
};

const MODULE_COLORS: Record<string, string> = {
  inventory: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-400 dark:border-blue-800',
  billing: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-950/50 dark:text-green-400 dark:border-green-800',
  restaurant: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-400 dark:border-red-800',
  manufacturing: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800',
  service: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-400 dark:border-purple-800',
  general: 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800/50 dark:text-gray-400 dark:border-gray-700',
};

const roleBadgeClasses: Record<string, string> = {
  Admin: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-400 dark:border-red-800',
  Manager: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-400 dark:border-blue-800',
  Cashier: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800',
  Staff: 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800/50 dark:text-gray-400 dark:border-gray-700',
};

const statusBadgeClasses: Record<string, string> = {
  Active: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-950/50 dark:text-green-400 dark:border-green-800',
  Suspended: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-400 dark:border-red-800',
  Inactive: 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800/50 dark:text-gray-400 dark:border-gray-700',
};

type TabId = 'dashboard' | 'businesses' | 'business-detail' | 'audit-logs' | 'account';

// ── Helpers ────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch {
    return '—';
  }
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

function getCategoryLabel(value: string): string {
  return CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

function getCategoryPrefix(value: string): string {
  return CATEGORIES.find((c) => c.value === value)?.prefix ?? 'CU';
}

// ── API Helper ─────────────────────────────────────────────────────────────

function authHeaders(token: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

async function apiFetch<T>(url: string, token: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      ...authHeaders(token),
      ...(options?.headers || {}),
    },
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(errData?.error || `Request failed with status ${res.status}`);
  }
  return res.json();
}

// ── Copy Button Component ──────────────────────────────────────────────────

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      notify({ type: 'success', title: 'Copied', message: `${label || 'Text'} copied to clipboard` });
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <Button
      variant="ghost"
      size="sm"
      className="size-8 p-0 text-muted-foreground hover:text-green-600"
      onClick={handleCopy}
    >
      {copied ? <Check className="size-3.5 text-green-500" /> : <Copy className="size-3.5" />}
    </Button>
  );
}

// ── Category Preview Component ──────────────────────────────────────────

function CategoryPreview({ category }: { category: string }) {
  const tmpl = getCategoryTemplate(category);
  if (!tmpl) return null;

  return (
    <div className="mt-2 rounded-lg border border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/10 overflow-hidden">
      <div className="px-3 py-2 bg-green-100/60 dark:bg-green-900/20 border-b border-green-200 dark:border-green-800">
        <p className="text-xs font-semibold text-green-700 dark:text-green-400 flex items-center gap-1.5">
          {CATEGORY_ICON_MAP[category.toLowerCase()] || <Store className="size-4 text-green-600" />}
          {tmpl.label} — Auto-Enabled Features
        </p>
        <p className="text-[10px] text-green-600/70 dark:text-green-500/70 mt-0.5">{tmpl.description}</p>
      </div>
      <div className="p-3 space-y-3">
        {/* Features */}
        <div>
          <p className="text-[11px] font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
            <ListChecks className="size-3" /> Modules & Features ({tmpl.features.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {tmpl.features.map((f) => (
              <span key={f.key} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium border ${MODULE_COLORS[f.module] || MODULE_COLORS.general}`}>
                <CheckCircle2 className="size-2.5" />
                {f.label}
              </span>
            ))}
          </div>
        </div>
        {/* Item Fields */}
        <div>
          <p className="text-[11px] font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
            <Tag className="size-3" /> Item Fields ({tmpl.itemFields.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {tmpl.itemFields.map((f) => (
              <span key={f.key} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-gray-100 text-gray-600 border border-gray-200 dark:bg-gray-800/50 dark:text-gray-400 dark:border-gray-700">
                {f.label}
                <span className="text-[9px] text-muted-foreground/60">({f.fieldType})</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Category Features Card Component ──────────────────────────────────────

interface BusinessFeatureData {
  id: string;
  key: string;
  label: string;
  module: string;
  description: string;
  enabled: boolean;
}

interface CustomFieldData {
  id: string;
  key: string;
  label: string;
  fieldType: string;
  options: string[];
  required: boolean;
  visible: boolean;
  sortOrder: number;
}

function CategoryFeaturesCard({ token, unitCode, category }: { token: string; unitCode: string; category: string }) {
  const [features, setFeatures] = useState<BusinessFeatureData[]>([]);
  const [customFields, setCustomFields] = useState<CustomFieldData[]>([]);
  const [loading, setLoading] = useState(true);
  const [applyingTemplate, setApplyingTemplate] = useState(false);

  const fetchFeatures = useCallback(async () => {
    setLoading(true);
    try {
      const [featRes, fieldRes] = await Promise.all([
        fetch(`/api/super-admin/businesses/${unitCode}/features`, {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        }),
        fetch(`/api/super-admin/businesses/${unitCode}/custom-fields`, {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        }),
      ]);
      if (featRes.ok) {
        const featData = await featRes.json();
        setFeatures(featData.features || []);
      }
      if (fieldRes.ok) {
        const fieldData = await fieldRes.json();
        setCustomFields(fieldData.fields || []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [token, unitCode]);

  useEffect(() => { fetchFeatures(); }, [fetchFeatures]);

  const toggleFeature = async (featureId: string, enabled: boolean) => {
    try {
      await fetch(`/api/super-admin/businesses/${unitCode}/features`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ featureId, enabled }),
      });
      setFeatures((prev) => prev.map((f) => f.id === featureId ? { ...f, enabled } : f));
    } catch {
      notify({ type: 'error', title: 'Error', message: 'Failed to update feature' });
    }
  };

  const applyTemplate = async () => {
    setApplyingTemplate(true);
    try {
      const res = await fetch(`/api/super-admin/businesses/${unitCode}/features`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ category }),
      });
      if (res.ok) {
        notify({ type: 'success', title: 'Template Applied', message: `Category template for ${getCategoryLabel(category)} applied successfully` });
        fetchFeatures();
      } else {
        const err = await res.json();
        notify({ type: 'error', title: 'Error', message: err.error || 'Failed to apply template' });
      }
    } catch {
      notify({ type: 'error', title: 'Error', message: 'Failed to apply category template' });
    } finally {
      setApplyingTemplate(false);
    }
  };

  const tmpl = getCategoryTemplate(category);
  const groupedFeatures = features.reduce<Record<string, BusinessFeatureData[]>>((acc, f) => {
    if (!acc[f.module]) acc[f.module] = [];
    acc[f.module].push(f);
    return acc;
  }, {});

  return (
    <Card className="border-0 shadow-sm overflow-hidden">
      <CardHeader className="pb-3 bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-900/30 dark:to-gray-900/30 border-b">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            {CATEGORY_ICON_MAP[category?.toLowerCase()] || <Store className="size-4 text-green-600" />}
            Category Features
            <Badge variant="outline" className="font-mono text-xs">
              {getCategoryLabel(category)}
            </Badge>
          </CardTitle>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs gap-1.5 border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
            onClick={applyTemplate}
            disabled={applyingTemplate}
          >
            {applyingTemplate ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
            Re-apply Template
          </Button>
        </div>
        {tmpl && <p className="text-xs text-muted-foreground mt-1">{tmpl.description}</p>}
      </CardHeader>
      <CardContent className="p-5">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-20" />
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-20" />
          </div>
        ) : features.length === 0 && customFields.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Store className="size-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground mb-2">No category features configured yet</p>
            <Button size="sm" variant="outline" onClick={applyTemplate} disabled={applyingTemplate}>
              {applyingTemplate ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : <RefreshCw className="size-3.5 mr-1.5" />}
              Apply {getCategoryLabel(category)} Template
            </Button>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Features by Module */}
            {Object.entries(groupedFeatures).map(([module, moduleFeatures]) => (
              <div key={module}>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Badge variant="outline" className={MODULE_COLORS[module] || MODULE_COLORS.general}>
                    {module}
                  </Badge>
                  <span>{moduleFeatures.filter((f) => f.enabled).length}/{moduleFeatures.length} enabled</span>
                </p>
                <div className="space-y-1.5">
                  {moduleFeatures.map((f) => (
                    <div key={f.id} className="flex items-center justify-between gap-3 py-1.5 px-3 rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-2 min-w-0">
                        {f.enabled ? (
                          <ToggleRight className="size-4 text-green-500 shrink-0" />
                        ) : (
                          <ToggleLeft className="size-4 text-muted-foreground shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className={`text-sm ${f.enabled ? 'text-foreground font-medium' : 'text-muted-foreground line-through'}`}>{f.label}</p>
                          {f.description && (
                            <p className="text-[10px] text-muted-foreground/60 truncate">{f.description}</p>
                          )}
                        </div>
                      </div>
                      <Switch
                        checked={f.enabled}
                        onCheckedChange={(checked) => toggleFeature(f.id, checked)}
                        className="scale-75"
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Custom Item Fields */}
            {customFields.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Tag className="size-3" />
                  Custom Item Fields
                  <Badge variant="outline" className="font-mono text-[10px]">{customFields.length}</Badge>
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {customFields.map((f) => (
                    <div key={f.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 border border-muted">
                      <div className={`size-2 rounded-full ${f.visible ? 'bg-green-500' : 'bg-gray-300'}`} />
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">{f.label}</p>
                        <p className="text-[10px] text-muted-foreground">{f.fieldType}{f.required ? ' • Required' : ''}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function SuperAdminSection({ token, onLogout }: SuperAdminSectionProps) {
  // ── Tab State ──
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [selectedBusinessCode, setSelectedBusinessCode] = useState<string | null>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const unreadNotifs = useNotificationStore((s) => s.unreadCount)

  // ── Dashboard State ──
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);

  // ── Businesses List State ──
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [businessesLoading, setBusinessesLoading] = useState(true);
  const [businessSearch, setBusinessSearch] = useState('');
  const [businessCategoryFilter, setBusinessCategoryFilter] = useState('all');
  const [businessStatusFilter, setBusinessStatusFilter] = useState('all');

  // ── Business Detail State ──
  const [businessDetail, setBusinessDetail] = useState<Business | null>(null);
  const [businessUsers, setBusinessUsers] = useState<BusinessUser[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // ── Audit Logs State ──
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [auditPagination, setAuditPagination] = useState<AuditLogPagination>({ page: 1, limit: 50, total: 0, totalPages: 0 });
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditUnitFilter, setAuditUnitFilter] = useState('');
  const [auditActionFilter, setAuditActionFilter] = useState('');

  // ── Dialog State ──
  const [addBusinessOpen, setAddBusinessOpen] = useState(false);
  const [editBusinessOpen, setEditBusinessOpen] = useState(false);
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [editUserOpen, setEditUserOpen] = useState(false);
  const [resetPwdOpen, setResetPwdOpen] = useState(false);
  const [credentialsDialogOpen, setCredentialsDialogOpen] = useState(false);
  const [createdResult, setCreatedResult] = useState<CreatedBusinessResult | null>(null);

  // ── Confirmation Dialog State ──
  const [deleteBusinessDialogOpen, setDeleteBusinessDialogOpen] = useState(false);
  const [deleteUserDialogOpen, setDeleteUserDialogOpen] = useState(false);
  const [suspendBusinessDialogOpen, setSuspendBusinessDialogOpen] = useState(false);
  const [suspendUserDialogOpen, setSuspendUserDialogOpen] = useState(false);
  const [actionTargetBusiness, setActionTargetBusiness] = useState<Business | null>(null);
  const [actionTargetUser, setActionTargetUser] = useState<BusinessUser | null>(null);

  // ── Form State ──
  const [submitting, setSubmitting] = useState(false);

  // Add Business form
  const [formBizName, setFormBizName] = useState('');
  const [formBizCategory, setFormBizCategory] = useState('general');
  const [formBizAddress, setFormBizAddress] = useState('');
  const [formBizPhone, setFormBizPhone] = useState('');
  const [formBizEmail, setFormBizEmail] = useState('');
  const [formBizGst, setFormBizGst] = useState('');
  const [formBizAdminName, setFormBizAdminName] = useState('');
  const [formBizAdminPhone, setFormBizAdminPhone] = useState('');

  // Edit Business form
  const [editBizName, setEditBizName] = useState('');
  const [editBizCategory, setEditBizCategory] = useState('');
  const [editBizAddress, setEditBizAddress] = useState('');
  const [editBizPhone, setEditBizPhone] = useState('');
  const [editBizEmail, setEditBizEmail] = useState('');
  const [editBizGst, setEditBizGst] = useState('');
  const [editBizDescription, setEditBizDescription] = useState('');
  const [editBizActive, setEditBizActive] = useState(true);

  // Activation & Expiry state
  const [renewDialogOpen, setRenewDialogOpen] = useState(false);
  const [renewBusiness, setRenewBusiness] = useState<Business | null>(null);
  const [renewExpiryDate, setRenewExpiryDate] = useState('');
  const [renewSubmitting, setRenewSubmitting] = useState(false);

  // Add User form
  const [formUserLoginId, setFormUserLoginId] = useState('');
  const [formUserName, setFormUserName] = useState('');
  const [formUserPassword, setFormUserPassword] = useState('');
  const [formUserRole, setFormUserRole] = useState('Staff');

  // Edit User form
  const [editUserLoginId, setEditUserLoginId] = useState('');
  const [editUserName, setEditUserName] = useState('');
  const [editUserRole, setEditUserRole] = useState('');
  const [editUserActive, setEditUserActive] = useState(true);
  const [editUserMustChange, setEditUserMustChange] = useState(false);

  // Reset Password form
  const [resetPwdNew, setResetPwdNew] = useState('');
  const [resetPwdSubmitting, setResetPwdSubmitting] = useState(false);

  // ── Account Tab State ──
  const [profile, setProfile] = useState<{ id: string; email: string; name: string; isActive: boolean; lastLogin: string | null; createdAt: string } | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [editEmail, setEditEmail] = useState('');
  const [editName, setEditName] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [pwdSaving, setPwdSaving] = useState(false);

  // ── Change Client ID State ──
  const [changeClientIdOpen, setChangeClientIdOpen] = useState(false);
  const [newClientId, setNewClientId] = useState('');
  const [changeClientIdSubmitting, setChangeClientIdSubmitting] = useState(false);

  // ── Set Trial State ──
  const [setTrialDialogOpen, setSetTrialDialogOpen] = useState(false);
  const [trialDays, setTrialDays] = useState(14);
  const [setTrialSubmitting, setSetTrialSubmitting] = useState(false);

  // ── Data Fetching ──

  const fetchDashboard = useCallback(async () => {
    setDashboardLoading(true);
    try {
      const data = await apiFetch<DashboardData>('/api/super-admin/dashboard', token);
      setDashboard(data);
    } catch (err) {
      notify({ type: 'error', title: 'Error', message: err instanceof Error ? err.message : 'Failed to load dashboard' });
    } finally {
      setDashboardLoading(false);
    }
  }, [token]);

  const fetchBusinesses = useCallback(async () => {
    setBusinessesLoading(true);
    try {
      const data = await apiFetch<{ businesses: Business[] }>('/api/super-admin/businesses', token);
      setBusinesses(data.businesses || []);
    } catch (err) {
      notify({ type: 'error', title: 'Error', message: err instanceof Error ? err.message : 'Failed to load businesses' });
    } finally {
      setBusinessesLoading(false);
    }
  }, [token]);

  const fetchBusinessDetail = useCallback(async (code: string) => {
    setDetailLoading(true);
    try {
      const [bizData, usersData] = await Promise.all([
        apiFetch<{ business: Business }>(`/api/super-admin/businesses/${code}`, token),
        apiFetch<{ users: BusinessUser[] }>(`/api/super-admin/businesses/${code}/users`, token),
      ]);
      setBusinessDetail(bizData.business);
      setBusinessUsers(usersData.users || []);
    } catch (err) {
      notify({ type: 'error', title: 'Error', message: err instanceof Error ? err.message : 'Failed to load business detail' });
    } finally {
      setDetailLoading(false);
    }
  }, [token]);

  const fetchAuditLogs = useCallback(async (page = 1) => {
    setAuditLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '50' });
      if (auditUnitFilter) params.set('unitCode', auditUnitFilter);
      if (auditActionFilter) params.set('action', auditActionFilter);
      const data = await apiFetch<{ logs: AuditLogEntry[]; pagination: AuditLogPagination }>(
        `/api/super-admin/audit-logs?${params.toString()}`, token
      );
      setAuditLogs(data.logs || []);
      setAuditPagination(data.pagination || { page: 1, limit: 50, total: 0, totalPages: 0 });
    } catch (err) {
      notify({ type: 'error', title: 'Error', message: err instanceof Error ? err.message : 'Failed to load audit logs' });
    } finally {
      setAuditLoading(false);
    }
  }, [token, auditUnitFilter, auditActionFilter]);

  const fetchProfile = useCallback(async () => {
    setProfileLoading(true);
    try {
      const data = await apiFetch<{ profile: { id: string; email: string; name: string; isActive: boolean; lastLogin: string | null; createdAt: string } }>('/api/super-admin/profile', token);
      setProfile(data.profile);
      setEditEmail(data.profile?.email || '');
      setEditName(data.profile?.name || '');
    } catch (err) {
      notify({ type: 'error', title: 'Error', message: err instanceof Error ? err.message : 'Failed to load profile' });
    } finally {
      setProfileLoading(false);
    }
  }, [token]);

  // ── Initial Load ──
  useEffect(() => {
    fetchDashboard();
    fetchBusinesses();
  }, [fetchDashboard, fetchBusinesses]);

  // ── Tab Change Handlers ──
  const handleViewBusiness = (code: string) => {
    setSelectedBusinessCode(code);
    setActiveTab('business-detail');
    fetchBusinessDetail(code);
  };

  const handleBackToBusinesses = () => {
    setSelectedBusinessCode(null);
    setBusinessDetail(null);
    setBusinessUsers([]);
    setActiveTab('businesses');
  };

  const handleTabChange = (tab: string) => {
    if (tab === 'audit-logs') {
      setActiveTab('audit-logs');
      fetchAuditLogs(1);
    } else if (tab === 'businesses') {
      handleBackToBusinesses();
    } else if (tab === 'dashboard') {
      setActiveTab('dashboard');
      fetchDashboard();
    } else if (tab === 'account') {
      setActiveTab('account');
      fetchProfile();
    }
  };

  // ── Account Handlers ──
  const handleUpdateProfile = async () => {
    if (!(editEmail || '').trim() || !(editName || '').trim()) {
      notify({ type: 'error', title: 'Validation Error', message: 'Email and name are required' });
      return;
    }
    setProfileSaving(true);
    try {
      const data = await apiFetch<{ profile: { id: string; email: string; name: string } }>('/api/super-admin/profile', token, {
        method: 'PUT',
        body: JSON.stringify({ email: (editEmail || '').trim(), name: (editName || '').trim() }),
      });
      setProfile(prev => prev ? { ...prev, email: data.profile.email, name: data.profile.name } : prev);
      notify({ type: 'success', title: 'Profile Updated', message: 'Profile updated successfully' });
    } catch (err) {
      notify({ type: 'error', title: 'Error', message: err instanceof Error ? err.message : 'Failed to update profile' });
    } finally {
      setProfileSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPwd) {
      notify({ type: 'error', title: 'Validation Error', message: 'Current password is required' });
      return;
    }
    if (!newPwd || !confirmPwd) {
      notify({ type: 'error', title: 'Validation Error', message: 'New password and confirm password are required' });
      return;
    }
    if (newPwd.length < 6) {
      notify({ type: 'error', title: 'Validation Error', message: 'New password must be at least 6 characters' });
      return;
    }
    if (newPwd !== confirmPwd) {
      notify({ type: 'error', title: 'Validation Error', message: 'New password and confirm password do not match' });
      return;
    }
    setPwdSaving(true);
    try {
      await apiFetch('/api/super-admin/profile/password', token, {
        method: 'PUT',
        body: JSON.stringify({ currentPassword: currentPwd, newPassword: newPwd }),
      });
      setCurrentPwd('');
      setNewPwd('');
      setConfirmPwd('');
      notify({ type: 'success', title: 'Password Changed', message: 'Password changed successfully' });
    } catch (err) {
      notify({ type: 'error', title: 'Error', message: err instanceof Error ? err.message : 'Failed to change password' });
    } finally {
      setPwdSaving(false);
    }
  };

  const handleChangeClientId = async () => {
    if (!actionTargetBusiness || !newClientId.trim()) return;
    const code = newClientId.trim().toUpperCase();
    if (!/^[A-Z0-9]{2,20}$/.test(code)) {
      notify({ type: 'error', title: 'Validation Error', message: 'Client ID must be 2-20 alphanumeric characters (A-Z, 0-9)' });
      return;
    }
    if (code === actionTargetBusiness.code) {
      notify({ type: 'error', title: 'Validation Error', message: 'New Client ID must be different from current' });
      return;
    }
    setChangeClientIdSubmitting(true);
    try {
      await apiFetch(`/api/super-admin/businesses/${actionTargetBusiness.code}/change-client-id`, token, {
        method: 'PUT',
        body: JSON.stringify({ newCode: code }),
      });
      notify({ type: 'success', title: 'Client ID Changed', message: `Client ID changed from ${actionTargetBusiness.code} to ${code}` });
      setChangeClientIdOpen(false);
      setNewClientId('');
      fetchBusinesses();
      if (selectedBusinessCode === actionTargetBusiness.code) {
        setSelectedBusinessCode(code);
        fetchBusinessDetail(code);
      }
    } catch (err) {
      notify({ type: 'error', title: 'Error', message: err instanceof Error ? err.message : 'Failed to change Client ID' });
    } finally {
      setChangeClientIdSubmitting(false);
    }
  };

  // ── Filtered Businesses ──
  const filteredBusinesses = businesses.filter((biz) => {
    const matchesSearch =
      businessSearch === '' ||
      biz.code.toLowerCase().includes(businessSearch.toLowerCase()) ||
      biz.name.toLowerCase().includes(businessSearch.toLowerCase());
    const matchesCategory = businessCategoryFilter === 'all' || biz.category === businessCategoryFilter;
    const effectiveStatus = biz.activationStatus || (biz.isActive ? 'active' : 'inactive');
    const isExpired = biz.expiresAt && new Date(biz.expiresAt) < new Date();
    const matchesStatus =
      businessStatusFilter === 'all' ||
      (businessStatusFilter === 'active' && effectiveStatus === 'active' && !isExpired) ||
      (businessStatusFilter === 'expired' && (isExpired || effectiveStatus === 'expired')) ||
      (businessStatusFilter === 'suspended' && effectiveStatus === 'suspended') ||
      (businessStatusFilter === 'inactive' && !biz.isActive && effectiveStatus !== 'expired' && effectiveStatus !== 'suspended');
    return matchesSearch && matchesCategory && matchesStatus;
  });

  // ── Unique Unit Codes for Audit Filter ──
  const uniqueUnitCodes = [...new Set(businesses.map((b) => b.code))].sort();

  // ── Add Business Handler ──
  const resetAddBizForm = () => {
    setFormBizName('');
    setFormBizCategory('general');
    setFormBizAddress('');
    setFormBizPhone('');
    setFormBizEmail('');
    setFormBizGst('');
    setFormBizAdminName('');
    setFormBizAdminPhone('');
  };

  const handleAddBusiness = async () => {
    if (!formBizName.trim()) { notify({ type: 'error', title: 'Validation Error', message: 'Business name is required' }); return; }
    if (!formBizAdminName.trim()) { notify({ type: 'error', title: 'Validation Error', message: 'Admin name is required' }); return; }

    setSubmitting(true);
    try {
      const result = await apiFetch<CreatedBusinessResult>('/api/super-admin/businesses', token, {
        method: 'POST',
        body: JSON.stringify({
          name: formBizName.trim(),
          category: formBizCategory,
          address: formBizAddress.trim() || undefined,
          phone: formBizPhone.trim() || undefined,
          email: formBizEmail.trim() || undefined,
          gstNumber: formBizGst.trim() || undefined,
          adminName: formBizAdminName.trim(),
          adminPhone: formBizAdminPhone.trim() || undefined,
        }),
      });
      setCreatedResult(result);
      setAddBusinessOpen(false);
      resetAddBizForm();
      setCredentialsDialogOpen(true);
      fetchBusinesses();
      fetchDashboard();
    } catch (err) {
      notify({ type: 'error', title: 'Error', message: err instanceof Error ? err.message : 'Failed to create business' });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Edit Business Handler ──
  const openEditBusiness = (biz: Business) => {
    setActionTargetBusiness(biz);
    setEditBizName(biz.name);
    setEditBizCategory(biz.category);
    setEditBizAddress(biz.address || '');
    setEditBizPhone(biz.phone || '');
    setEditBizEmail(biz.email || '');
    setEditBizGst(biz.gstNumber || '');
    setEditBizDescription(biz.description || '');
    setEditBizActive(biz.isActive);
    setEditBusinessOpen(true);
  };

  const handleEditBusiness = async () => {
    if (!actionTargetBusiness) return;
    if (!editBizName.trim()) { notify({ type: 'error', title: 'Validation Error', message: 'Business name is required' }); return; }

    setSubmitting(true);
    try {
      await apiFetch(`/api/super-admin/businesses/${actionTargetBusiness.code}`, token, {
        method: 'PUT',
        body: JSON.stringify({
          name: editBizName.trim(),
          category: editBizCategory,
          address: editBizAddress.trim() || undefined,
          phone: editBizPhone.trim() || undefined,
          email: editBizEmail.trim() || undefined,
          gstNumber: editBizGst.trim() || undefined,
          description: editBizDescription.trim() || undefined,
          isActive: editBizActive,
        }),
      });
      notify({ type: 'success', title: 'Business Updated', message: `Business "${actionTargetBusiness.code}" updated successfully` });
      setEditBusinessOpen(false);
      fetchBusinesses();
      if (selectedBusinessCode === actionTargetBusiness.code) {
        fetchBusinessDetail(actionTargetBusiness.code);
      }
    } catch (err) {
      notify({ type: 'error', title: 'Error', message: err instanceof Error ? err.message : 'Failed to update business' });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Suspend/Activate Business ──
  const handleSuspendBusinessClick = (biz: Business) => {
    setActionTargetBusiness(biz);
    setSuspendBusinessDialogOpen(true);
  };

  const handleSuspendBusinessConfirm = async () => {
    if (!actionTargetBusiness) return;
    try {
      const isCurrentlyActive = actionTargetBusiness.isActive;
      const updateBody: Record<string, unknown> = { isActive: !isCurrentlyActive };
      if (isCurrentlyActive) {
        // Suspending: set status to 'suspended'
        updateBody.activationStatus = 'suspended';
      } else {
        // Reactivating: set status to 'active'
        updateBody.activationStatus = 'active';
      }
      await apiFetch(`/api/super-admin/businesses/${actionTargetBusiness.code}`, token, {
        method: 'PUT',
        body: JSON.stringify(updateBody),
      });
      notify({ type: 'success', title: isCurrentlyActive ? 'Business Suspended' : 'Business Activated', message: `Business "${actionTargetBusiness.code}" ${isCurrentlyActive ? 'suspended' : 'activated'} successfully` });
      fetchBusinesses();
      fetchDashboard();
      if (selectedBusinessCode === actionTargetBusiness.code) {
        fetchBusinessDetail(actionTargetBusiness.code);
      }
    } catch (err) {
      notify({ type: 'error', title: 'Error', message: err instanceof Error ? err.message : 'Failed to update business status' });
    } finally {
      setSuspendBusinessDialogOpen(false);
      setActionTargetBusiness(null);
    }
  };

  // ── Renew / Set Expiry ──
  const handleRenewClick = (biz: Business) => {
    setRenewBusiness(biz);
    // Pre-fill: if already has expiry, show it; otherwise default to 1 year from now
    if (biz.expiresAt) {
      setRenewExpiryDate(new Date(biz.expiresAt).toISOString().split('T')[0]);
    } else {
      const oneYear = new Date();
      oneYear.setFullYear(oneYear.getFullYear() + 1);
      setRenewExpiryDate(oneYear.toISOString().split('T')[0]);
    }
    setRenewDialogOpen(true);
  };

  const handleRenewConfirm = async () => {
    if (!renewBusiness || !renewExpiryDate) return;
    setRenewSubmitting(true);
    try {
      await apiFetch(`/api/super-admin/businesses/${renewBusiness.code}`, token, {
        method: 'PUT',
        body: JSON.stringify({
          isActive: true,
          activationStatus: 'active',
          expiresAt: renewExpiryDate,
        }),
      });
      notify({ type: 'success', title: 'Business Renewed', message: `Client ID "${renewBusiness.code}" renewed until ${formatDate(renewExpiryDate)}` });
      fetchBusinesses();
      fetchDashboard();
      if (selectedBusinessCode === renewBusiness.code) {
        fetchBusinessDetail(renewBusiness.code);
      }
    } catch (err) {
      notify({ type: 'error', title: 'Error', message: err instanceof Error ? err.message : 'Failed to renew business' });
    } finally {
      setRenewSubmitting(false);
      setRenewDialogOpen(false);
      setRenewBusiness(null);
    }
  };

  const handleRemoveExpiry = async (biz: Business) => {
    try {
      await apiFetch(`/api/super-admin/businesses/${biz.code}`, token, {
        method: 'PUT',
        body: JSON.stringify({
          isActive: true,
          activationStatus: 'active',
          expiresAt: null,
        }),
      });
      notify({ type: 'success', title: 'Expiry Removed', message: `Expiry removed for "${biz.code}" — now active indefinitely` });
      fetchBusinesses();
      fetchDashboard();
      if (selectedBusinessCode === biz.code) {
        fetchBusinessDetail(biz.code);
      }
    } catch (err) {
      notify({ type: 'error', title: 'Error', message: err instanceof Error ? err.message : 'Failed to remove expiry' });
    }
  };

  // ── Set Trial Mode ──
  const handleSetTrialClick = (biz: Business) => {
    setActionTargetBusiness(biz);
    setTrialDays(14);
    setSetTrialDialogOpen(true);
  };

  const handleSetTrialConfirm = async () => {
    if (!actionTargetBusiness) return;
    setSetTrialSubmitting(true);
    try {
      const trialExpiry = new Date();
      trialExpiry.setDate(trialExpiry.getDate() + trialDays);
      await apiFetch(`/api/super-admin/businesses/${actionTargetBusiness.code}`, token, {
        method: 'PUT',
        body: JSON.stringify({
          isActive: true,
          activationStatus: 'trial',
          expiresAt: trialExpiry.toISOString(),
        }),
      });
      notify({ type: 'success', title: 'Trial Mode Set', message: `Client ID "${actionTargetBusiness.code}" set to ${trialDays}-day trial mode` });
      setSetTrialDialogOpen(false);
      setActionTargetBusiness(null);
      fetchBusinesses();
      fetchDashboard();
      if (selectedBusinessCode === actionTargetBusiness.code) {
        fetchBusinessDetail(actionTargetBusiness.code);
      }
    } catch (err) {
      notify({ type: 'error', title: 'Error', message: err instanceof Error ? err.message : 'Failed to set trial mode' });
    } finally {
      setSetTrialSubmitting(false);
    }
  };

  // ── Activation Status Helpers ──
  const getStatusInfo = (biz: Business) => {
    const isExpired = biz.expiresAt && new Date(biz.expiresAt) < new Date();
    if (isExpired || biz.activationStatus === 'expired') {
      return { label: 'Expired', color: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950/50 dark:text-orange-400 dark:border-orange-800', icon: <Timer className="size-3" /> };
    }
    if (!biz.isActive || biz.activationStatus === 'suspended') {
      return { label: 'Suspended', color: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-400 dark:border-red-800', icon: <Ban className="size-3" /> };
    }
    if (biz.activationStatus === 'trial') {
      return { label: 'Trial', color: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-400 dark:border-blue-800', icon: <Zap className="size-3" /> };
    }
    return { label: 'Active', color: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-950/50 dark:text-green-400 dark:border-green-800', icon: <CheckCircle2 className="size-3" /> };
  };

  const getDaysUntilExpiry = (biz: Business): number | null => {
    if (!biz.expiresAt) return null;
    const diff = new Date(biz.expiresAt).getTime() - new Date().getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  // ── Delete Business ──
  const handleDeleteBusinessClick = (biz: Business) => {
    setActionTargetBusiness(biz);
    setDeleteBusinessDialogOpen(true);
  };

  const handleDeleteBusinessConfirm = async () => {
    if (!actionTargetBusiness) return;
    try {
      await apiFetch(`/api/super-admin/businesses/${actionTargetBusiness.code}`, token, {
        method: 'DELETE',
      });
      notify({ type: 'success', title: 'Business Deleted', message: `Business "${actionTargetBusiness.code}" deleted successfully` });
      fetchBusinesses();
      fetchDashboard();
      if (selectedBusinessCode === actionTargetBusiness.code) {
        handleBackToBusinesses();
      }
    } catch (err) {
      notify({ type: 'error', title: 'Error', message: err instanceof Error ? err.message : 'Failed to delete business' });
    } finally {
      setDeleteBusinessDialogOpen(false);
      setActionTargetBusiness(null);
    }
  };

  // ── Add User Handler ──
  const resetAddUserForm = () => {
    setFormUserLoginId('');
    setFormUserName('');
    setFormUserPassword('');
    setFormUserRole('Staff');
  };

  const handleAddUser = async () => {
    if (!selectedBusinessCode) return;
    if (!formUserLoginId.trim()) { notify({ type: 'error', title: 'Validation Error', message: 'Login ID is required' }); return; }
    if (!formUserName.trim()) { notify({ type: 'error', title: 'Validation Error', message: 'Name is required' }); return; }
    if (!formUserPassword) { notify({ type: 'error', title: 'Validation Error', message: 'Password is required' }); return; }
    if (formUserPassword.length < 4) { notify({ type: 'error', title: 'Validation Error', message: 'Password must be at least 4 characters' }); return; }

    setSubmitting(true);
    try {
      await apiFetch(`/api/super-admin/businesses/${selectedBusinessCode}/users`, token, {
        method: 'POST',
        body: JSON.stringify({
          loginId: formUserLoginId.trim().toLowerCase(),
          name: formUserName.trim(),
          password: formUserPassword,
          role: formUserRole,
        }),
      });
      notify({ type: 'success', title: 'User Created', message: `User "${formUserLoginId}" created successfully` });
      setAddUserOpen(false);
      resetAddUserForm();
      fetchBusinessDetail(selectedBusinessCode);
    } catch (err) {
      notify({ type: 'error', title: 'Error', message: err instanceof Error ? err.message : 'Failed to create user' });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Edit User Handler ──
  const openEditUser = (user: BusinessUser) => {
    setActionTargetUser(user);
    setEditUserLoginId(user.loginId);
    setEditUserName(user.name);
    setEditUserRole(user.role);
    setEditUserActive(user.isActive);
    setEditUserMustChange(user.mustChangePassword);
    setEditUserOpen(true);
  };

  const handleEditUser = async () => {
    if (!selectedBusinessCode || !actionTargetUser) return;
    if (!editUserLoginId.trim()) { notify({ type: 'error', title: 'Validation Error', message: 'Login ID is required' }); return; }
    if (!editUserName.trim()) { notify({ type: 'error', title: 'Validation Error', message: 'Name is required' }); return; }

    setSubmitting(true);
    try {
      const updatePayload: Record<string, unknown> = {
        loginId: editUserLoginId.trim(),
        name: editUserName.trim(),
        role: editUserRole,
        isActive: editUserActive,
        mustChangePassword: editUserMustChange,
      };
      await apiFetch(`/api/super-admin/businesses/${selectedBusinessCode}/users/${actionTargetUser.id}`, token, {
        method: 'PUT',
        body: JSON.stringify(updatePayload),
      });
      notify({ type: 'success', title: 'User Updated', message: `User "${actionTargetUser.loginId}" updated successfully` });
      setEditUserOpen(false);
      fetchBusinessDetail(selectedBusinessCode);
    } catch (err) {
      notify({ type: 'error', title: 'Error', message: err instanceof Error ? err.message : 'Failed to update user' });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Suspend/Activate User ──
  const handleSuspendUserClick = (user: BusinessUser) => {
    setActionTargetUser(user);
    setSuspendUserDialogOpen(true);
  };

  const handleSuspendUserConfirm = async () => {
    if (!selectedBusinessCode || !actionTargetUser) return;
    try {
      await apiFetch(`/api/super-admin/businesses/${selectedBusinessCode}/users/${actionTargetUser.id}`, token, {
        method: 'PUT',
        body: JSON.stringify({ isActive: !actionTargetUser.isActive }),
      });
      notify({ type: 'success', title: actionTargetUser.isActive ? 'User Suspended' : 'User Activated', message: `User "${actionTargetUser.loginId}" ${actionTargetUser.isActive ? 'suspended' : 'activated'} successfully` });
      fetchBusinessDetail(selectedBusinessCode);
    } catch (err) {
      notify({ type: 'error', title: 'Error', message: err instanceof Error ? err.message : 'Failed to update user status' });
    } finally {
      setSuspendUserDialogOpen(false);
      setActionTargetUser(null);
    }
  };

  // ── Delete User ──
  const handleDeleteUserClick = (user: BusinessUser) => {
    setActionTargetUser(user);
    setDeleteUserDialogOpen(true);
  };

  const handleDeleteUserConfirm = async () => {
    if (!selectedBusinessCode || !actionTargetUser) return;
    try {
      await apiFetch(`/api/super-admin/businesses/${selectedBusinessCode}/users/${actionTargetUser.id}`, token, {
        method: 'DELETE',
      });
      notify({ type: 'success', title: 'User Deleted', message: `User "${actionTargetUser.loginId}" deleted successfully` });
      fetchBusinessDetail(selectedBusinessCode);
    } catch (err) {
      notify({ type: 'error', title: 'Error', message: err instanceof Error ? err.message : 'Failed to delete user' });
    } finally {
      setDeleteUserDialogOpen(false);
      setActionTargetUser(null);
    }
  };

  // ── Reset Password ──
  const handleResetPwdClick = (user: BusinessUser) => {
    setActionTargetUser(user);
    setResetPwdNew('');
    setResetPwdOpen(true);
  };

  const handleResetPwdConfirm = async () => {
    if (!selectedBusinessCode || !actionTargetUser) return;
    if (!resetPwdNew || resetPwdNew.length < 4) { notify({ type: 'error', title: 'Validation Error', message: 'Password must be at least 4 characters' }); return; }

    setResetPwdSubmitting(true);
    try {
      await apiFetch(`/api/super-admin/businesses/${selectedBusinessCode}/users/${actionTargetUser.id}/reset-password`, token, {
        method: 'POST',
        body: JSON.stringify({ newPassword: resetPwdNew }),
      });
      notify({ type: 'success', title: 'Password Reset', message: `Password reset for "${actionTargetUser.name}"` });
      setResetPwdOpen(false);
      setActionTargetUser(null);
    } catch (err) {
      notify({ type: 'error', title: 'Error', message: err instanceof Error ? err.message : 'Failed to reset password' });
    } finally {
      setResetPwdSubmitting(false);
    }
  };

  // ── Audit Log Search ──
  const handleAuditSearch = () => {
    fetchAuditLogs(1);
  };

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER: Account Tab
  // ═══════════════════════════════════════════════════════════════════════

  const renderAccount = () => (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Profile Header */}
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 p-5 text-white">
          <div className="flex items-center gap-4">
            <div className="flex size-14 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm shrink-0">
              <ShieldAlert className="size-7" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Super Admin Account</h2>
              <p className="text-sm text-green-100">{profile?.email || 'Loading...'}</p>
            </div>
          </div>
        </div>
        {profileLoading ? (
          <CardContent className="p-6 space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        ) : profile && (
          <CardContent className="p-6">
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="flex items-center gap-2 text-sm">
                <Mail className="size-4 text-muted-foreground" />
                <span className="text-muted-foreground">Email:</span>
                <span className="font-medium">{profile.email}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Clock className="size-4 text-muted-foreground" />
                <span className="text-muted-foreground">Last Login:</span>
                <span className="font-medium">{formatDateTime(profile.lastLogin)}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Shield className="size-4 text-muted-foreground" />
                <span className="text-muted-foreground">Role:</span>
                <Badge className="bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400 border-0">Super Admin</Badge>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="size-4 text-green-500" />
                <span className="text-muted-foreground">Status:</span>
                <Badge className="bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-400 border-0">Active</Badge>
              </div>
            </div>

            <Separator className="my-4" />

            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Edit className="size-4 text-green-600" />
              Edit Profile
            </h3>
            <div className="space-y-4">
              <div className="grid gap-2">
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  <Mail className="size-3.5 text-green-600" />
                  Email Address
                </Label>
                <Input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  placeholder="admin@example.com"
                  autoComplete="off"
                  data-1p-ignore
                  data-lpignore="true"
                />
              </div>
              <div className="grid gap-2">
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  Name
                </Label>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Super Admin"
                />
              </div>
              <Button
                onClick={handleUpdateProfile}
                disabled={profileSaving || !(editEmail || '').trim() || !(editName || '').trim()}
                className="gap-2 bg-green-600 hover:bg-green-700 text-white"
              >
                {profileSaving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                Save Profile
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Password Change Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Lock className="size-5 text-amber-600" />
            Change Password
          </CardTitle>
          <CardDescription>Set a new password for your Super Admin account</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label className="text-sm font-medium flex items-center gap-1.5">
              <Key className="size-3.5 text-amber-600" />
              Current Password
            </Label>
            <Input
              type="password"
              value={currentPwd}
              onChange={(e) => setCurrentPwd(e.target.value)}
              placeholder="Enter current password"
            />
          </div>
          <div className="grid gap-2">
            <Label className="text-sm font-medium">New Password</Label>
            <Input
              type="password"
              value={newPwd}
              onChange={(e) => setNewPwd(e.target.value)}
              placeholder="Enter new password (min 6 chars)"
            />
          </div>
          <div className="grid gap-2">
            <Label className="text-sm font-medium">Confirm New Password</Label>
            <Input
              type="password"
              value={confirmPwd}
              onChange={(e) => setConfirmPwd(e.target.value)}
              placeholder="Confirm new password"
            />
            {confirmPwd && newPwd && confirmPwd !== newPwd && (
              <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
            )}
            {confirmPwd && newPwd && confirmPwd === newPwd && newPwd.length >= 6 && (
              <p className="text-xs text-green-500 mt-1">Passwords match</p>
            )}
          </div>
          <Button
            onClick={handleChangePassword}
            disabled={pwdSaving || !currentPwd || !newPwd || !confirmPwd || newPwd !== confirmPwd || newPwd.length < 6}
            className="gap-2 bg-amber-600 hover:bg-amber-700 text-white"
          >
            {pwdSaving ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-4" />}
            Change Password
          </Button>
        </CardContent>
      </Card>

      {/* System Activation & Sync Status Card */}
      <Card className="border-green-200 dark:border-green-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="size-5 text-green-600" />
            System Activation & Sync Status
          </CardTitle>
          <CardDescription>Account and ID storage status — all data is permanent and synced</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
              <div className="flex size-9 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/50 shrink-0">
                <CheckCircle2 className="size-4 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Database Status</p>
                <p className="text-sm font-semibold text-green-700 dark:text-green-400">Online & Permanent</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
              <div className="flex size-9 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/50 shrink-0">
                <CheckCircle2 className="size-4 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Session Storage</p>
                <p className="text-sm font-semibold text-green-700 dark:text-green-400">Permanent (localStorage)</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
              <div className="flex size-9 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/50 shrink-0">
                <CheckCircle2 className="size-4 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Super Admin ID</p>
                <p className="text-sm font-semibold text-green-700 dark:text-green-400">Permanent & Synced</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
              <div className="flex size-9 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/50 shrink-0">
                <CheckCircle2 className="size-4 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Business IDs</p>
                <p className="text-sm font-semibold text-green-700 dark:text-green-400">Permanent & Synced</p>
              </div>
            </div>
          </div>
          <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-3">
            <div className="flex items-start gap-2">
              <Shield className="size-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-blue-700 dark:text-blue-400">All IDs are Permanent</p>
                <p className="text-xs text-blue-600 dark:text-blue-500 mt-0.5">
                  Super Admin credentials, Business Client IDs, and all user accounts are stored in the server database permanently.
                  Password changes and new Business IDs persist across sessions and browser restarts.
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Download className="size-4" />
              <span>Install as App</span>
            </div>
            <PWAInstallButton />
          </div>
        </CardContent>
      </Card>

    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER: Dashboard Tab
  // ═══════════════════════════════════════════════════════════════════════

  const renderDashboard = () => {
    if (dashboardLoading) {
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Skeleton className="h-64 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
        </div>
      );
    }

    const stats = dashboard?.stats;
    const catBreakdown = dashboard?.categoryBreakdown || [];
    const recentBiz = dashboard?.recentBusinesses || [];
    const recentLogs = dashboard?.recentLogs || [];

    return (
      <div className="space-y-4 animate-fade-in-up">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="border-0 shadow-sm hover-lift card-hover-glow">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-green-100 dark:bg-green-950/50 text-green-600 dark:text-green-400 shrink-0">
                <Store className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Total Businesses</p>
                <p className="text-xl font-bold tabular-nums">{stats?.totalBusinesses ?? 0}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm hover-lift card-hover-glow">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 shrink-0">
                <CheckCircle2 className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Active</p>
                <p className="text-xl font-bold tabular-nums">{stats?.activeBusinesses ?? 0}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm hover-lift card-hover-glow">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400 shrink-0">
                <Ban className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Inactive</p>
                <p className="text-xl font-bold tabular-nums">{stats?.inactiveBusinesses ?? 0}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm hover-lift card-hover-glow">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-teal-100 dark:bg-teal-950/50 text-teal-600 dark:text-teal-400 shrink-0">
                <Users className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Total Users</p>
                <p className="text-xl font-bold tabular-nums">{stats?.totalUsers ?? 0}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Category Breakdown */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <BarChart3 className="size-4 text-green-600" />
                Category Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {catBreakdown.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No businesses yet</p>
              ) : (
                <div className="space-y-2">
                  {catBreakdown.map((cat) => {
                    const maxCount = Math.max(...catBreakdown.map((c) => c.count), 1);
                    const pct = (cat.count / maxCount) * 100;
                    return (
                      <div key={cat.category} className="flex items-center gap-3">
                        <span className="text-xs font-medium text-muted-foreground w-28 shrink-0 truncate">
                          {getCategoryLabel(cat.category)}
                        </span>
                        <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-full transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold tabular-nums w-6 text-right">{cat.count}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Businesses */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Building2 className="size-4 text-green-600" />
                Recent Businesses
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {recentBiz.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No businesses yet</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {recentBiz.map((biz) => (
                    <div
                      key={biz.code}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => handleViewBusiness(biz.code)}
                    >
                      <div className="flex size-8 items-center justify-center rounded-lg bg-green-100 dark:bg-green-950/50 text-green-600 dark:text-green-400 shrink-0 text-xs font-bold">
                        {getCategoryPrefix(biz.category)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{biz.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{biz.code}</p>
                      </div>
                      <Badge
                        variant="outline"
                        className={biz.isActive ? statusBadgeClasses.Active : statusBadgeClasses.Suspended}
                      >
                        <span className="size-1.5 rounded-full bg-current mr-1" />
                        {biz.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Activity className="size-4 text-green-600" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {recentLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No recent activity</p>
            ) : (
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {recentLogs.map((log) => (
                  <div key={log.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex size-7 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 shrink-0">
                      <FileText className="size-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm truncate">
                        <span className="font-medium">{log.userName}</span>
                        <span className="text-muted-foreground"> — {log.action}</span>
                        {log.target && <span className="text-muted-foreground"> on {log.target}</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        <span className="font-mono">{log.unitCode}</span> &middot; {formatDateTime(log.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER: Businesses Tab
  // ═══════════════════════════════════════════════════════════════════════

  const renderBusinesses = () => {
    if (businessesLoading) {
      return (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6 space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-64 w-full rounded-lg" />
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-4 animate-fade-in-up">
        {/* Search & Filters */}
        <Card className="border-0 shadow-sm">
          <div className="p-4 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search by Client ID or name..."
                value={businessSearch}
                onChange={(e) => setBusinessSearch(e.target.value)}
                className="pl-9"
              />
              {businessSearch && (
                <button
                  onClick={() => setBusinessSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">Category:</span>
              <select
                value={businessCategoryFilter}
                onChange={(e) => setBusinessCategoryFilter(e.target.value)}
                className="px-2.5 py-1 rounded-md text-xs font-medium border border-muted bg-background hover:border-green-300 transition-colors"
              >
                <option value="all">All Categories</option>
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
              <Separator orientation="vertical" className="h-5 mx-1" />
              <span className="text-xs font-medium text-muted-foreground">Status:</span>
              {['all', 'active', 'expired', 'suspended', 'inactive'].map((status) => (
                <button
                  key={status}
                  onClick={() => setBusinessStatusFilter(status)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all border ${
                    businessStatusFilter === status
                      ? 'bg-green-600 text-white border-green-600'
                      : 'border-muted text-muted-foreground hover:border-green-300 hover:text-foreground'
                  }`}
                >
                  {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
              {(businessSearch || businessCategoryFilter !== 'all' || businessStatusFilter !== 'all') && (
                <button
                  onClick={() => { setBusinessSearch(''); setBusinessCategoryFilter('all'); setBusinessStatusFilter('all'); }}
                  className="ml-auto text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                >
                  <RefreshCw className="size-3" />
                  Clear
                </button>
              )}
            </div>
          </div>
        </Card>

        {/* Businesses Table */}
        <Card className="border-0 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            {filteredBusinesses.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                <div className="size-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                  <Building2 className="size-8 text-muted-foreground" />
                </div>
                <h3 className="text-base font-semibold text-foreground mb-1">
                  {businesses.length === 0 ? 'No businesses yet' : 'No matching businesses'}
                </h3>
                <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                  {businesses.length === 0
                    ? 'Get started by adding your first business.'
                    : 'Try adjusting your search or filter criteria'}
                </p>
                {businesses.length === 0 && (
                  <Button
                    onClick={() => setAddBusinessOpen(true)}
                    className="gap-2 bg-green-600 hover:bg-green-700 text-white"
                  >
                    <Plus className="size-4" />
                    Add First Business
                  </Button>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="font-semibold">Client ID</TableHead>
                    <TableHead className="font-semibold">Name</TableHead>
                    <TableHead className="font-semibold hidden sm:table-cell">Category</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="font-semibold hidden md:table-cell">Expiry</TableHead>
                    <TableHead className="font-semibold hidden lg:table-cell">Users</TableHead>
                    <TableHead className="font-semibold text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBusinesses.map((biz) => {
                    const stInfo = getStatusInfo(biz);
                    const dLeft = getDaysUntilExpiry(biz);
                    return (
                    <TableRow key={biz.code} className="group">
                      <TableCell className="font-mono text-sm font-medium">{biz.code}</TableCell>
                      <TableCell className="font-medium">{biz.name}</TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Badge variant="outline" className="text-xs">
                          {getCategoryLabel(biz.category)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`${stInfo.color} border gap-1`}>
                          {stInfo.icon}
                          {stInfo.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm">
                        {biz.expiresAt ? (
                          <div className="space-y-0.5">
                            <span className={(dLeft ?? 0) <= 0 ? 'text-red-600 font-medium' : (dLeft ?? 0) <= 30 ? 'text-amber-600' : 'text-muted-foreground'}>
                              {formatDate(biz.expiresAt)}
                            </span>
                            {(dLeft ?? 0) > 0 && (dLeft ?? 0) <= 30 && (
                              <p className="text-[10px] text-amber-600 font-medium">⏰ {dLeft}d left</p>
                            )}
                          </div>
                        ) : (
                          <span className="text-green-600 text-xs font-medium">∞ No expiry</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm tabular-nums">{biz.userCount}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="size-8 p-0 text-muted-foreground hover:text-green-600"
                            onClick={() => handleViewBusiness(biz.code)}
                            title="View details"
                          >
                            <Eye className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="size-8 p-0 text-muted-foreground hover:text-blue-600"
                            onClick={() => openEditBusiness(biz)}
                            title="Edit business"
                          >
                            <Edit className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="size-8 p-0 text-muted-foreground hover:text-indigo-600"
                            onClick={() => { setActionTargetBusiness(biz); setNewClientId(''); setChangeClientIdOpen(true); }}
                            title="Change Client ID"
                          >
                            <Key className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="size-8 p-0 text-muted-foreground hover:text-blue-600"
                            onClick={() => handleRenewClick(biz)}
                            title="Renew / Set expiry"
                          >
                            <CalendarClock className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="size-8 p-0 text-muted-foreground hover:text-cyan-600"
                            onClick={() => handleSetTrialClick(biz)}
                            title="Set trial mode"
                          >
                            <Zap className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className={`size-8 p-0 ${biz.isActive ? 'text-muted-foreground hover:text-amber-600' : 'text-muted-foreground hover:text-green-600'}`}
                            onClick={() => handleSuspendBusinessClick(biz)}
                            title={biz.isActive ? 'Suspend business' : 'Activate business'}
                          >
                            {biz.isActive ? <Ban className="size-4" /> : <CheckCircle2 className="size-4" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="size-8 p-0 text-muted-foreground hover:text-red-600"
                            onClick={() => handleDeleteBusinessClick(biz)}
                            title="Delete business"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
          {filteredBusinesses.length > 0 && (
            <div className="px-4 py-3 border-t bg-muted/20 text-xs text-muted-foreground flex items-center justify-between">
              <span>
                Showing {filteredBusinesses.length} of {businesses.length} business{businesses.length !== 1 ? 'es' : ''}
              </span>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <span className="size-2 rounded-full bg-green-500" />
                  Active: {businesses.filter((b) => b.isActive).length}
                </span>
                <span className="flex items-center gap-1">
                  <span className="size-2 rounded-full bg-red-500" />
                  Inactive: {businesses.filter((b) => !b.isActive).length}
                </span>
              </div>
            </div>
          )}
        </Card>
      </div>
    );
  };

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER: Business Detail Tab
  // ═══════════════════════════════════════════════════════════════════════

  const renderBusinessDetail = () => {
    if (detailLoading) {
      return (
        <div className="space-y-4">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      );
    }

    if (!businessDetail) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Building2 className="size-12 text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No business selected</p>
          <Button variant="outline" onClick={handleBackToBusinesses} className="mt-4">
            Back to Businesses
          </Button>
        </div>
      );
    }

    const biz = businessDetail;
    const statusInfo = getStatusInfo(biz);
    const daysLeft = getDaysUntilExpiry(biz);
    const isExpiringSoon = daysLeft !== null && daysLeft > 0 && daysLeft <= 30;

    return (
      <div className="space-y-4 animate-fade-in-up">
        {/* Back Button */}
        <Button variant="ghost" size="sm" onClick={handleBackToBusinesses} className="gap-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" />
          Back to Businesses
        </Button>

        {/* Business Info Card */}
        <Card className="border-0 shadow-sm overflow-hidden">
          <div className={`p-5 text-white relative ${
            statusInfo.label === 'Expired' ? 'bg-gradient-to-r from-orange-600 via-amber-600 to-yellow-600' :
            statusInfo.label === 'Suspended' ? 'bg-gradient-to-r from-red-600 via-rose-600 to-pink-600' :
            'bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600'
          }`}>
            <div className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-white/10" />
            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-green-100 text-sm font-mono">{biz.code}</span>
                  <Badge className={`${statusInfo.color} border`}>
                    {statusInfo.icon}
                    <span className="ml-1">{statusInfo.label}</span>
                  </Badge>
                </div>
                <h2 className="text-xl font-bold">{biz.name}</h2>
                <p className="text-green-100 text-sm mt-0.5">{getCategoryLabel(biz.category)}</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant="secondary"
                  size="sm"
                  className="bg-white/20 hover:bg-white/30 text-white border-0"
                  onClick={() => openEditBusiness(biz)}
                >
                  <Edit className="size-3.5 mr-1" />
                  Edit
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className={biz.isActive
                    ? 'bg-amber-500/30 hover:bg-amber-500/40 text-white border-0'
                    : 'bg-green-500/30 hover:bg-green-500/40 text-white border-0'}
                  onClick={() => handleSuspendBusinessClick(biz)}
                >
                  {biz.isActive ? <Ban className="size-3.5 mr-1" /> : <CheckCircle2 className="size-3.5 mr-1" />}
                  {biz.isActive ? 'Suspend' : 'Activate'}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="bg-blue-500/30 hover:bg-blue-500/40 text-white border-0"
                  onClick={() => handleRenewClick(biz)}
                >
                  <CalendarClock className="size-3.5 mr-1" />
                  Renew
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="bg-cyan-500/30 hover:bg-cyan-500/40 text-white border-0"
                  onClick={() => handleSetTrialClick(biz)}
                >
                  <Zap className="size-3.5 mr-1" />
                  Trial
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="bg-indigo-500/30 hover:bg-indigo-500/40 text-white border-0"
                  onClick={() => { setActionTargetBusiness(biz); setNewClientId(''); setChangeClientIdOpen(true); }}
                >
                  <Key className="size-3.5 mr-1" />
                  Change ID
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="bg-red-500/30 hover:bg-red-500/40 text-white border-0"
                  onClick={() => handleDeleteBusinessClick(biz)}
                >
                  <Trash2 className="size-3.5 mr-1" />
                  Delete
                </Button>
              </div>
            </div>
          </div>
          <CardContent className="p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {biz.description && (
                <div className="sm:col-span-2 flex items-start gap-2 text-sm">
                  <FileText className="size-4 text-muted-foreground mt-0.5 shrink-0" />
                  <span className="text-muted-foreground">{biz.description}</span>
                </div>
              )}
              {biz.address && (
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="size-4 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">{biz.address}</span>
                </div>
              )}
              {biz.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="size-4 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">{biz.phone}</span>
                </div>
              )}
              {biz.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="size-4 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">{biz.email}</span>
                </div>
              )}
              {biz.gstNumber && (
                <div className="flex items-center gap-2 text-sm">
                  <Hash className="size-4 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">GST: {biz.gstNumber}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm">
                <Clock className="size-4 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">Created: {formatDate(biz.createdAt)}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Users className="size-4 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">{biz.userCount} users &middot; {biz.invoiceCount} invoices</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Activation & Subscription Card ── */}
        <Card className="border-0 shadow-sm overflow-hidden">
          <CardHeader className="pb-3 bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-900/30 dark:to-gray-900/30 border-b">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <ShieldAlert className="size-4 text-emerald-600" />
              Activation & Subscription
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Status */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Status</Label>
                <div className="flex items-center gap-2">
                  <Badge className={`${statusInfo.color} border px-3 py-1`}>
                    {statusInfo.icon}
                    <span className="ml-1.5 font-semibold">{statusInfo.label}</span>
                  </Badge>
                </div>
              </div>
              {/* Expiry Date */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Expiry Date</Label>
                {biz.expiresAt ? (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Calendar className="size-4 text-muted-foreground" />
                      <span className={`text-sm font-medium ${
                        (daysLeft ?? 0) <= 0 ? 'text-red-600' :
                        (daysLeft ?? 0) <= 30 ? 'text-amber-600' :
                        'text-foreground'
                      }`}>
                        {formatDate(biz.expiresAt)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {(daysLeft ?? 0) <= 0 ? (
                        <span className="text-xs font-medium text-red-600 bg-red-50 dark:bg-red-950/30 px-2 py-0.5 rounded-full">
                          Expired
                        </span>
                      ) : isExpiringSoon ? (
                        <span className="text-xs font-medium text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 rounded-full">
                          ⏰ {daysLeft} days left
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {daysLeft} days remaining
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Timer className="size-4 text-green-500" />
                    <span className="text-sm text-green-600 font-medium">No expiry — Active indefinitely</span>
                  </div>
                )}
              </div>
              {/* Quick Actions */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Quick Actions</Label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs gap-1.5 border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                    onClick={() => handleRenewClick(biz)}
                  >
                    <CalendarClock className="size-3.5" />
                    {biz.expiresAt ? 'Extend Expiry' : 'Set Expiry'}
                  </Button>
                  {biz.expiresAt && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs gap-1.5 text-red-600 border-red-200 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30"
                      onClick={() => handleRemoveExpiry(biz)}
                    >
                      <RotateCcw className="size-3.5" />
                      Remove Expiry
                    </Button>
                  )}
                  {statusInfo.label === 'Expired' && (
                    <Button
                      size="sm"
                      className="h-8 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={() => handleRenewClick(biz)}
                    >
                      <Zap className="size-3.5" />
                      Reactivate
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Expiring Soon Warning */}
            {isExpiringSoon && (
              <div className="mt-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 flex items-start gap-3">
                <AlertTriangle className="size-5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                    Subscription expiring soon!
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                    This Client ID will expire in {daysLeft} days. Renew now to prevent service interruption.
                  </p>
                </div>
              </div>
            )}

            {/* Expired Warning */}
            {(statusInfo.label === 'Expired') && (
              <div className="mt-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 flex items-start gap-3">
                <ShieldAlert className="size-5 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-800 dark:text-red-300">
                    Subscription has expired!
                  </p>
                  <p className="text-xs text-red-700 dark:text-red-400 mt-0.5">
                    Users of this Client ID cannot log in. Click "Reactivate" or "Extend" to renew the subscription.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Category Features Card ── */}
        <CategoryFeaturesCard token={token} unitCode={biz.code} category={biz.category} />

        {/* Users Section */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Users className="size-4 text-green-600" />
                Users
                <Badge variant="outline" className="font-mono text-xs">
                  {businessUsers.length}
                </Badge>
              </CardTitle>
              <Button
                onClick={() => { resetAddUserForm(); setAddUserOpen(true); }}
                className="gap-2 bg-green-600 hover:bg-green-700 text-white shrink-0 self-start sm:self-auto"
                size="sm"
              >
                <UserPlus className="size-4" />
                Add User
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {businessUsers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Users className="size-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No users in this business</p>
              </div>
            ) : (
              <div className="overflow-x-auto -mx-6 px-6">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead className="font-semibold">Login ID</TableHead>
                      <TableHead className="font-semibold">Name</TableHead>
                      <TableHead className="font-semibold">Role</TableHead>
                      <TableHead className="font-semibold">Status</TableHead>
                      <TableHead className="font-semibold hidden md:table-cell">Last Login</TableHead>
                      <TableHead className="font-semibold text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {businessUsers.map((user) => (
                      <TableRow key={user.id} className="group">
                        <TableCell className="font-mono text-sm font-medium">{user.loginId}</TableCell>
                        <TableCell className="font-medium">{user.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={roleBadgeClasses[user.role] || ''}>
                            {user.role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <Badge
                              variant="outline"
                              className={user.isActive ? statusBadgeClasses.Active : statusBadgeClasses.Suspended}
                            >
                              <span className="size-1.5 rounded-full bg-current mr-1" />
                              {user.isActive ? 'Active' : 'Suspended'}
                            </Badge>
                            {user.mustChangePassword && (
                              <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800 text-[10px]">
                                <Key className="size-2.5 mr-0.5" />
                                Must Change
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                          {formatDateTime(user.lastLogin)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="size-8 p-0 text-muted-foreground hover:text-emerald-600"
                              onClick={() => handleResetPwdClick(user)}
                              title="Reset Password"
                            >
                              <Key className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="size-8 p-0 text-muted-foreground hover:text-green-600"
                              onClick={() => openEditUser(user)}
                              title="Edit user"
                            >
                              <Edit className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className={`size-8 p-0 ${user.isActive ? 'text-muted-foreground hover:text-amber-600' : 'text-muted-foreground hover:text-green-600'}`}
                              onClick={() => handleSuspendUserClick(user)}
                              title={user.isActive ? 'Suspend user' : 'Activate user'}
                            >
                              {user.isActive ? <Ban className="size-4" /> : <CheckCircle2 className="size-4" />}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="size-8 p-0 text-muted-foreground hover:text-red-600"
                              onClick={() => handleDeleteUserClick(user)}
                              title="Delete user"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER: Audit Logs Tab
  // ═══════════════════════════════════════════════════════════════════════

  const renderAuditLogs = () => {
    return (
      <div className="space-y-4 animate-fade-in-up">
        {/* Filters */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3">
              <div className="grid gap-1.5 flex-1 w-full sm:w-auto">
                <Label className="text-xs font-medium">Unit Code</Label>
                <Select value={auditUnitFilter} onValueChange={setAuditUnitFilter}>
                  <SelectTrigger className="w-full sm:w-44">
                    <SelectValue placeholder="All Units" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All Units</SelectItem>
                    {uniqueUnitCodes.map((code) => (
                      <SelectItem key={code} value={code}>
                        <span className="font-mono">{code}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5 flex-1 w-full sm:w-auto">
                <Label className="text-xs font-medium">Action</Label>
                <Input
                  placeholder="e.g. LOGIN, CREATE_INVOICE"
                  value={auditActionFilter}
                  onChange={(e) => setAuditActionFilter(e.target.value)}
                  className="font-mono text-sm sm:w-48"
                />
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleAuditSearch}
                  className="gap-2 bg-green-600 hover:bg-green-700 text-white"
                  size="sm"
                >
                  <Search className="size-4" />
                  Search
                </Button>
                {(auditUnitFilter || auditActionFilter) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setAuditUnitFilter(''); setAuditActionFilter(''); fetchAuditLogs(1); }}
                  >
                    <RefreshCw className="size-3.5" />
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Audit Logs Table */}
        <Card className="border-0 shadow-sm overflow-hidden">
          {auditLoading ? (
            <CardContent className="p-6 space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-64 w-full rounded-lg" />
            </CardContent>
          ) : auditLogs.length === 0 ? (
            <CardContent className="py-16 flex flex-col items-center text-center">
              <ClipboardList className="size-12 text-muted-foreground mb-3" />
              <h3 className="text-base font-semibold mb-1">No audit logs</h3>
              <p className="text-sm text-muted-foreground">Activity will appear here as users interact with the system</p>
            </CardContent>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead className="font-semibold">Time</TableHead>
                      <TableHead className="font-semibold">Unit</TableHead>
                      <TableHead className="font-semibold">User</TableHead>
                      <TableHead className="font-semibold">Role</TableHead>
                      <TableHead className="font-semibold">Action</TableHead>
                      <TableHead className="font-semibold hidden md:table-cell">Target</TableHead>
                      <TableHead className="font-semibold hidden lg:table-cell">IP</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditLogs.map((log) => (
                      <TableRow key={log.id} className="group">
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDateTime(log.createdAt)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-mono text-xs">
                            {log.unitCode}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm font-medium">{log.userName}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-xs ${roleBadgeClasses[log.role] || ''}`}>
                            {log.role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs font-mono">
                            {log.action}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-sm text-muted-foreground max-w-32 truncate">
                          {log.target || '—'}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-xs text-muted-foreground font-mono">
                          {log.ipAddress || '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {/* Pagination */}
              {auditPagination.totalPages > 1 && (
                <div className="px-4 py-3 border-t bg-muted/20 text-xs text-muted-foreground flex items-center justify-between">
                  <span>
                    Page {auditPagination.page} of {auditPagination.totalPages} &middot; {auditPagination.total} total logs
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={auditPagination.page <= 1}
                      onClick={() => fetchAuditLogs(auditPagination.page - 1)}
                      className="h-7 text-xs"
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={auditPagination.page >= auditPagination.totalPages}
                      onClick={() => fetchAuditLogs(auditPagination.page + 1)}
                      className="h-7 text-xs"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </Card>
      </div>
    );
  };

  // ═══════════════════════════════════════════════════════════════════════
  // MAIN RENDER
  // ═══════════════════════════════════════════════════════════════════════

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 p-4 md:p-6 text-white relative overflow-hidden">
        <div className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-6 -left-6 size-32 rounded-full bg-white/5" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm shrink-0 overflow-hidden">
              <img src="/icon-192.png" alt="Eservices" className="size-7 rounded-lg object-cover" />
            </div>
            <div>
              <h1 className="text-lg font-bold">Super Admin Panel</h1>
              <p className="text-sm text-green-100">Manage all businesses & users</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Notification Bell */}
            <button
              onClick={() => setNotifOpen(true)}
              className="relative p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5 text-white" />
              {unreadNotifs > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-none animate-pulse">
                  {unreadNotifs > 9 ? '9+' : unreadNotifs}
                </span>
              )}
            </button>
            <Button
              variant="secondary"
              size="sm"
              onClick={onLogout}
              className="bg-white/20 hover:bg-white/30 text-white border-0 self-start sm:self-auto gap-2"
            >
              <LogOut className="size-4" />
              Logout
            </Button>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b bg-card px-4 md:px-6">
        <div className="flex items-center gap-1 overflow-x-auto -mb-px">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: <BarChart3 className="size-4" /> },
            { id: 'businesses', label: 'Businesses', icon: <Building2 className="size-4" /> },
            { id: 'business-detail', label: 'Business Detail', icon: <Store className="size-4" />, hidden: !selectedBusinessCode },
            { id: 'audit-logs', label: 'Audit Logs', icon: <ClipboardList className="size-4" /> },
            { id: 'account', label: 'Account', icon: <UserCog className="size-4" /> },
          ].filter((tab) => !tab.hidden).map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-green-600 text-green-600 dark:text-green-400'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 p-4 md:p-6">
        {activeTab === 'dashboard' && renderDashboard()}
        {activeTab === 'businesses' && renderBusinesses()}
        {activeTab === 'business-detail' && renderBusinessDetail()}
        {activeTab === 'audit-logs' && renderAuditLogs()}
        {activeTab === 'account' && renderAccount()}
      </div>

      {/* ── Add Business Button (floating when on businesses tab) ── */}
      {activeTab === 'businesses' && businesses.length > 0 && (
        <div className="fixed bottom-6 right-6 z-30">
          <Button
            onClick={() => { resetAddBizForm(); setAddBusinessOpen(true); }}
            className="size-14 rounded-full bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-600/30 hover:shadow-xl hover:shadow-green-600/40 transition-all"
          >
            <Plus className="size-6" />
          </Button>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          DIALOGS
          ═══════════════════════════════════════════════════════════════════ */}

      {/* ── Add Business Dialog ── */}
      <Dialog open={addBusinessOpen} onOpenChange={setAddBusinessOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto p-0">
          <div className="bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 p-5 text-white rounded-t-lg">
            <div className="pointer-events-none absolute -right-6 -top-6 size-24 rounded-full bg-white/10" />
            <DialogHeader>
              <DialogTitle className="text-white flex items-center gap-2 text-lg">
                <Building2 className="size-5" />
                Add New Business
              </DialogTitle>
              <DialogDescription className="text-green-100 text-sm">
                Create a new business unit with an admin account
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="p-5 space-y-4" style={{ minWidth: 0 }}>
            <div className="grid gap-2">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <Building2 className="size-3.5 text-green-600" />
                Business Name <span className="text-red-500">*</span>
              </Label>
              <Input
                placeholder="e.g. Sharma Sweets"
                value={formBizName}
                onChange={(e) => setFormBizName(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <Store className="size-3.5 text-green-600" />
                Category <span className="text-red-500">*</span>
              </Label>
              <Select value={formBizCategory} onValueChange={setFormBizCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      <span className="flex items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">[{cat.prefix}]</span>
                        {cat.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Client ID will be auto-generated as {getCategoryPrefix(formBizCategory)}XXX
              </p>

              {/* Category Features & Fields Preview */}
              {getCategoryTemplate(formBizCategory) && (
                <CategoryPreview category={formBizCategory} />
              )}
            </div>

            <div className="grid gap-2">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <MapPin className="size-3.5 text-green-600" />
                Address
              </Label>
              <Input
                placeholder="e.g. 123 Main Street, City"
                value={formBizAddress}
                onChange={(e) => setFormBizAddress(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  <Phone className="size-3.5 text-green-600" />
                  Phone
                </Label>
                <Input
                  placeholder="e.g. 9876543210"
                  value={formBizPhone}
                  onChange={(e) => setFormBizPhone(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  <Mail className="size-3.5 text-green-600" />
                  Email
                </Label>
                <Input
                  placeholder="e.g. info@biz.com"
                  value={formBizEmail}
                  onChange={(e) => setFormBizEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <Hash className="size-3.5 text-green-600" />
                GST Number
              </Label>
              <Input
                placeholder="e.g. 27AADCS1429B1Z5"
                value={formBizGst}
                onChange={(e) => setFormBizGst(e.target.value)}
                className="font-mono"
              />
            </div>

            <Separator />

            <div className="bg-green-50 dark:bg-green-950/20 rounded-lg p-4 space-y-3">
              <p className="text-sm font-semibold text-green-700 dark:text-green-400 flex items-center gap-2">
                <Shield className="size-4" />
                Admin Account
              </p>
              <div className="grid gap-2">
                <Label className="text-xs font-medium flex items-center gap-1.5">
                  <Users className="size-3 text-green-600" />
                  Admin Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  placeholder="e.g. Rajesh Sharma"
                  value={formBizAdminName}
                  onChange={(e) => setFormBizAdminName(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label className="text-xs font-medium flex items-center gap-1.5">
                  <Phone className="size-3 text-green-600" />
                  Admin Phone
                </Label>
                <Input
                  placeholder="e.g. 9876543210"
                  value={formBizAdminPhone}
                  onChange={(e) => setFormBizAdminPhone(e.target.value)}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="px-5 pb-5 gap-2">
            <Button variant="outline" onClick={() => setAddBusinessOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button
              onClick={handleAddBusiness}
              disabled={submitting}
              className="gap-2 bg-green-600 hover:bg-green-700 text-white"
            >
              {submitting ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Create Business
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Credentials Success Dialog ── */}
      <Dialog open={credentialsDialogOpen} onOpenChange={setCredentialsDialogOpen}>
        <DialogContent className="sm:max-w-md p-0">
          <div className="bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 p-5 text-white rounded-t-lg">
            <div className="pointer-events-none absolute -right-6 -top-6 size-24 rounded-full bg-white/10" />
            <DialogHeader>
              <DialogTitle className="text-white flex items-center gap-2 text-lg">
                <CheckCircle2 className="size-5" />
                Business Created Successfully!
              </DialogTitle>
              <DialogDescription className="text-green-100 text-sm">
                Share these credentials with the business admin
              </DialogDescription>
            </DialogHeader>
          </div>

          {createdResult && (
            <div className="p-5 space-y-4">
              <div className="bg-green-50 dark:bg-green-950/20 rounded-lg p-4 space-y-3">
                <p className="text-xs font-semibold text-green-700 dark:text-green-400 uppercase tracking-wider">
                  Business Details
                </p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Client ID</span>
                    <div className="flex items-center gap-1">
                      <span className="font-mono font-bold text-lg">{createdResult.business.code}</span>
                      <CopyButton text={createdResult.business.code} label="Client ID" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Business Name</span>
                    <span className="text-sm font-medium">{createdResult.business.name}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Category</span>
                    <span className="text-sm">{getCategoryLabel(createdResult.business.category)}</span>
                  </div>
                </div>
              </div>

              <div className="bg-amber-50 dark:bg-amber-950/20 rounded-lg p-4 space-y-3">
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Key className="size-3.5" />
                  Admin Login Credentials
                </p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Login ID</span>
                    <div className="flex items-center gap-1">
                      <span className="font-mono font-bold">{createdResult.admin.loginId}</span>
                      <CopyButton text={createdResult.admin.loginId} label="Login ID" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Temporary Password</span>
                    <div className="flex items-center gap-1">
                      <span className="font-mono font-bold">{createdResult.admin.temporaryPassword}</span>
                      <CopyButton text={createdResult.admin.temporaryPassword} label="Password" />
                    </div>
                  </div>
                  {createdResult.admin.mustChangePassword && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1 mt-2">
                      <AlertTriangle className="size-3" />
                      Admin must change password on first login
                    </p>
                  )}
                </div>
              </div>

              <Button
                onClick={() => {
                  const fullText = `Business: ${createdResult.business.name}\nClient ID: ${createdResult.business.code}\nAdmin Login: ${createdResult.admin.loginId}\nPassword: ${createdResult.admin.temporaryPassword}\n\nLogin at: ${window.location.origin}`;
                  navigator.clipboard.writeText(fullText).then(() => {
                    notify({ type: 'success', title: 'Copied', message: 'All credentials copied to clipboard' });
                  });
                }}
                variant="outline"
                className="w-full gap-2"
              >
                <Copy className="size-4" />
                Copy All Credentials
              </Button>
            </div>
          )}

          <DialogFooter className="px-5 pb-5">
            <Button onClick={() => setCredentialsDialogOpen(false)} className="bg-green-600 hover:bg-green-700 text-white">
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Business Dialog ── */}
      <Dialog open={editBusinessOpen} onOpenChange={setEditBusinessOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto p-0">
          <div className="bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 p-5 text-white rounded-t-lg">
            <DialogHeader>
              <DialogTitle className="text-white flex items-center gap-2 text-lg">
                <Edit className="size-5" />
                Edit Business
              </DialogTitle>
              <DialogDescription className="text-green-100 text-sm">
                {actionTargetBusiness ? `Editing: ${actionTargetBusiness.code} — ${actionTargetBusiness.name}` : ''}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="p-5 space-y-4">
            {/* Client ID section */}
            <div className="flex items-center justify-between rounded-lg border border-amber-200 dark:border-amber-800 p-3 bg-amber-50/50 dark:bg-amber-950/20">
              <div className="flex items-center gap-2">
                <Hash className="size-4 text-amber-600" />
                <div>
                  <p className="text-sm font-medium">Client ID: <span className="font-mono font-bold">{actionTargetBusiness?.code}</span></p>
                  <p className="text-xs text-muted-foreground">Unique identifier for this business</p>
                </div>
              </div>
              <Button variant="outline" size="sm" className="text-amber-600 border-amber-300 hover:bg-amber-50 dark:border-amber-700 dark:hover:bg-amber-950/40" onClick={() => { setEditBusinessOpen(false); setNewClientId(''); setChangeClientIdOpen(true); }}>
                Change
              </Button>
            </div>

            <div className="grid gap-2">
              <Label className="text-sm font-medium">Business Name</Label>
              <Input value={editBizName} onChange={(e) => setEditBizName(e.target.value)} />
            </div>

            <div className="grid gap-2">
              <Label className="text-sm font-medium">Category</Label>
              <Select value={editBizCategory} onValueChange={setEditBizCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label className="text-sm font-medium">Address</Label>
              <Input value={editBizAddress} onChange={(e) => setEditBizAddress(e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label className="text-sm font-medium">Phone</Label>
                <Input value={editBizPhone} onChange={(e) => setEditBizPhone(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label className="text-sm font-medium">Email</Label>
                <Input value={editBizEmail} onChange={(e) => setEditBizEmail(e.target.value)} />
              </div>
            </div>

            <div className="grid gap-2">
              <Label className="text-sm font-medium">GST Number</Label>
              <Input value={editBizGst} onChange={(e) => setEditBizGst(e.target.value)} className="font-mono" />
            </div>

            <div className="grid gap-2">
              <Label className="text-sm font-medium">Description</Label>
              <Input value={editBizDescription} onChange={(e) => setEditBizDescription(e.target.value)} />
            </div>

            <Separator />

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Business Status</Label>
                <p className="text-xs text-muted-foreground">
                  {editBizActive ? 'Business is currently active and accessible' : 'Business is suspended and inaccessible'}
                </p>
              </div>
              <Switch
                checked={editBizActive}
                onCheckedChange={setEditBizActive}
              />
            </div>
          </div>

          <DialogFooter className="px-5 pb-5 gap-2">
            <Button variant="outline" onClick={() => setEditBusinessOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button
              onClick={handleEditBusiness}
              disabled={submitting}
              className="gap-2 bg-green-600 hover:bg-green-700 text-white"
            >
              {submitting ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add User Dialog ── */}
      <Dialog open={addUserOpen} onOpenChange={setAddUserOpen}>
        <DialogContent className="sm:max-w-md p-0">
          <div className="bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 p-5 text-white rounded-t-lg">
            <DialogHeader>
              <DialogTitle className="text-white flex items-center gap-2 text-lg">
                <UserPlus className="size-5" />
                Add New User
              </DialogTitle>
              <DialogDescription className="text-green-100 text-sm">
                Add a new user to {selectedBusinessCode}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="p-5 space-y-4">
            <div className="grid gap-2">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <Key className="size-3.5 text-green-600" />
                Login ID <span className="text-red-500">*</span>
              </Label>
              <Input
                placeholder="e.g. john.doe"
                value={formUserLoginId}
                onChange={(e) => setFormUserLoginId(e.target.value.toLowerCase())}
                className="font-mono"
              />
            </div>

            <div className="grid gap-2">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <Users className="size-3.5 text-green-600" />
                Full Name <span className="text-red-500">*</span>
              </Label>
              <Input
                placeholder="e.g. John Doe"
                value={formUserName}
                onChange={(e) => setFormUserName(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <Lock className="size-3.5 text-green-600" />
                Password <span className="text-red-500">*</span>
              </Label>
              <Input
                type="text"
                placeholder="Minimum 4 characters"
                value={formUserPassword}
                onChange={(e) => setFormUserPassword(e.target.value)}
                className="font-mono"
              />
            </div>

            <div className="grid gap-2">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <Shield className="size-3.5 text-green-600" />
                Role
              </Label>
              <Select value={formUserRole} onValueChange={setFormUserRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Admin">
                    <span className="flex items-center gap-2">
                      <span className="size-2 rounded-full bg-red-500" />
                      Admin — Full system access
                    </span>
                  </SelectItem>
                  <SelectItem value="Manager">
                    <span className="flex items-center gap-2">
                      <span className="size-2 rounded-full bg-blue-500" />
                      Manager — Operational management
                    </span>
                  </SelectItem>
                  <SelectItem value="Cashier">
                    <span className="flex items-center gap-2">
                      <span className="size-2 rounded-full bg-amber-500" />
                      Cashier — Billing & sales
                    </span>
                  </SelectItem>
                  <SelectItem value="Staff">
                    <span className="flex items-center gap-2">
                      <span className="size-2 rounded-full bg-gray-500" />
                      Staff — Basic access
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="px-5 pb-5 gap-2">
            <Button variant="outline" onClick={() => setAddUserOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button
              onClick={handleAddUser}
              disabled={submitting}
              className="gap-2 bg-green-600 hover:bg-green-700 text-white"
            >
              {submitting ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
              Create User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit User Dialog ── */}
      <Dialog open={editUserOpen} onOpenChange={setEditUserOpen}>
        <DialogContent className="sm:max-w-md p-0">
          <div className="bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 p-5 text-white rounded-t-lg">
            <DialogHeader>
              <DialogTitle className="text-white flex items-center gap-2 text-lg">
                <UserCog className="size-5" />
                Edit User
              </DialogTitle>
              <DialogDescription className="text-green-100 text-sm">
                {actionTargetUser ? `Editing: ${actionTargetUser.loginId}` : ''}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="p-5 space-y-4">
            <div className="grid gap-2">
              <Label className="text-sm font-medium">Login ID</Label>
              <Input
                value={editUserLoginId}
                onChange={(e) => setEditUserLoginId(e.target.value)}
                placeholder="Enter new login ID"
              />
            </div>

            <div className="grid gap-2">
              <Label className="text-sm font-medium">Full Name</Label>
              <Input value={editUserName} onChange={(e) => setEditUserName(e.target.value)} />
            </div>

            <div className="grid gap-2">
              <Label className="text-sm font-medium">Role</Label>
              <Select value={editUserRole} onValueChange={setEditUserRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Admin">Admin</SelectItem>
                  <SelectItem value="Manager">Manager</SelectItem>
                  <SelectItem value="Cashier">Cashier</SelectItem>
                  <SelectItem value="Staff">Staff</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label className="text-sm font-medium">Active Status</Label>
                <p className="text-xs text-muted-foreground">
                  {editUserActive ? 'User can log in and use the system' : 'User is suspended'}
                </p>
              </div>
              <Switch checked={editUserActive} onCheckedChange={setEditUserActive} />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label className="text-sm font-medium">Must Change Password</Label>
                <p className="text-xs text-muted-foreground">
                  Force user to change password on next login
                </p>
              </div>
              <Switch checked={editUserMustChange} onCheckedChange={setEditUserMustChange} />
            </div>
          </div>

          <DialogFooter className="px-5 pb-5 gap-2">
            <Button variant="outline" onClick={() => setEditUserOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button
              onClick={handleEditUser}
              disabled={submitting}
              className="gap-2 bg-green-600 hover:bg-green-700 text-white"
            >
              {submitting ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Reset Password Dialog ── */}
      <Dialog open={resetPwdOpen} onOpenChange={setResetPwdOpen}>
        <DialogContent className="sm:max-w-sm p-0">
          <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-5 text-white rounded-t-lg">
            <DialogHeader>
              <DialogTitle className="text-white flex items-center gap-2 text-lg">
                <Key className="size-5" />
                Reset Password
              </DialogTitle>
              <DialogDescription className="text-amber-100 text-sm">
                {actionTargetUser ? `Reset password for ${actionTargetUser.name} (${actionTargetUser.loginId})` : ''}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="p-5 space-y-4">
            <div className="grid gap-2">
              <Label className="text-sm font-medium">New Password</Label>
              <Input
                type="text"
                placeholder="Minimum 4 characters"
                value={resetPwdNew}
                onChange={(e) => setResetPwdNew(e.target.value)}
                className="font-mono"
              />
            </div>
          </div>

          <DialogFooter className="px-5 pb-5 gap-2">
            <Button variant="outline" onClick={() => setResetPwdOpen(false)} disabled={resetPwdSubmitting}>
              Cancel
            </Button>
            <Button
              onClick={handleResetPwdConfirm}
              disabled={resetPwdSubmitting}
              className="gap-2 bg-amber-600 hover:bg-amber-700 text-white"
            >
              {resetPwdSubmitting ? <Loader2 className="size-4 animate-spin" /> : <Key className="size-4" />}
              Reset Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Confirmation Dialogs ── */}

      {/* Delete Business */}
      <AlertDialog open={deleteBusinessDialogOpen} onOpenChange={setDeleteBusinessDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-red-500" />
              Delete Business?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{actionTargetBusiness?.name}</strong> ({actionTargetBusiness?.code}) and all its data including users, invoices, and audit logs. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteBusinessConfirm}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete Business
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Suspend/Activate Business */}
      <AlertDialog open={suspendBusinessDialogOpen} onOpenChange={setSuspendBusinessDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {actionTargetBusiness?.isActive ? <Ban className="size-5 text-amber-500" /> : <CheckCircle2 className="size-5 text-green-500" />}
              {actionTargetBusiness?.isActive ? 'Suspend Business?' : 'Activate Business?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionTargetBusiness?.isActive
                ? `Suspending ${actionTargetBusiness?.name} will make it inaccessible to all its users.`
                : `Activating ${actionTargetBusiness?.name} will restore access for all its users.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSuspendBusinessConfirm}
              className={actionTargetBusiness?.isActive ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'bg-green-600 hover:bg-green-700 text-white'}
            >
              {actionTargetBusiness?.isActive ? 'Suspend' : 'Activate'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Renew / Set Expiry Dialog */}
      <Dialog open={renewDialogOpen} onOpenChange={setRenewDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarClock className="size-5 text-emerald-600" />
              {renewBusiness?.activationStatus === 'expired' ? 'Reactivate & Renew' : 'Set Expiry / Renew'}
            </DialogTitle>
            <DialogDescription>
              {renewBusiness
                ? `Set or extend the subscription expiry for "${renewBusiness.name}" (${renewBusiness.code})`
                : 'Set the subscription expiry date'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-3">
            <div className="grid gap-2">
              <Label htmlFor="renew-expiry" className="text-sm font-medium">Subscription Expiry Date</Label>
              <Input
                id="renew-expiry"
                type="date"
                value={renewExpiryDate}
                onChange={(e) => setRenewExpiryDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="h-10"
              />
              <p className="text-xs text-muted-foreground">
                After this date, the Client ID will be automatically deactivated. Set a future date to keep it active.
              </p>
            </div>

            {/* Quick Date Presets */}
            <div className="flex flex-wrap gap-2">
              <Label className="text-xs text-muted-foreground w-full">Quick Select:</Label>
              {[
                { label: '30 Days', days: 30 },
                { label: '90 Days', days: 90 },
                { label: '6 Months', days: 180 },
                { label: '1 Year', days: 365 },
                { label: '2 Years', days: 730 },
              ].map((preset) => {
                const date = new Date();
                date.setDate(date.getDate() + preset.days);
                return (
                  <Button
                    key={preset.days}
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setRenewExpiryDate(date.toISOString().split('T')[0])}
                  >
                    {preset.label}
                  </Button>
                );
              })}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenewDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleRenewConfirm}
              disabled={!renewExpiryDate || renewSubmitting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
            >
              {renewSubmitting && <Loader2 className="size-4 animate-spin" />}
              {renewBusiness?.activationStatus === 'expired' ? 'Reactivate & Set Expiry' : 'Save Expiry'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Set Trial Mode Dialog */}
      <Dialog open={setTrialDialogOpen} onOpenChange={setSetTrialDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="size-5 text-cyan-600" />
              Set Trial Mode
            </DialogTitle>
            <DialogDescription>
              {actionTargetBusiness
                ? `Activate a trial period for "${actionTargetBusiness.name}" (${actionTargetBusiness.code})`
                : 'Set trial period for business'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-3">
            <div className="grid gap-2">
              <Label htmlFor="trial-days" className="text-sm font-medium">Trial Duration (Days)</Label>
              <Input
                id="trial-days"
                type="number"
                min={1}
                max={365}
                value={trialDays}
                onChange={(e) => setTrialDays(Math.max(1, Math.min(365, parseInt(e.target.value) || 14)))}
                className="h-10"
              />
              <p className="text-xs text-muted-foreground">
                The business will be active with trial status for {trialDays} day{trialDays !== 1 ? 's' : ''}, then automatically expire.
              </p>
            </div>

            {/* Quick Duration Presets */}
            <div className="flex flex-wrap gap-2">
              <Label className="text-xs text-muted-foreground w-full">Quick Select:</Label>
              {[
                { label: '7 Days', days: 7 },
                { label: '14 Days', days: 14 },
                { label: '30 Days', days: 30 },
                { label: '60 Days', days: 60 },
                { label: '90 Days', days: 90 },
              ].map((preset) => (
                <Button
                  key={preset.days}
                  variant={trialDays === preset.days ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setTrialDays(preset.days)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>

            {/* Trial Info */}
            <div className="p-3 rounded-lg bg-cyan-50 dark:bg-cyan-950/30 border border-cyan-200/60 dark:border-cyan-800/40">
              <div className="flex items-start gap-2">
                <Zap className="size-4 text-cyan-600 dark:text-cyan-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-cyan-800 dark:text-cyan-300">Trial Mode</p>
                  <p className="text-[11px] text-cyan-600/80 dark:text-cyan-400/70 mt-0.5 leading-relaxed">
                    The business will be marked as &quot;Trial&quot; and will automatically expire after {trialDays} day{trialDays !== 1 ? 's' : ''}. You can renew or extend at any time.
                  </p>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSetTrialDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSetTrialConfirm}
              disabled={setTrialSubmitting}
              className="bg-cyan-600 hover:bg-cyan-700 text-white gap-1.5"
            >
              {setTrialSubmitting && <Loader2 className="size-4 animate-spin" />}
              <Zap className="size-4" />
              Activate Trial
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User */}
      <AlertDialog open={deleteUserDialogOpen} onOpenChange={setDeleteUserDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-red-500" />
              Delete User?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{actionTargetUser?.name}</strong> ({actionTargetUser?.loginId}). This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUserConfirm}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Suspend/Activate User */}
      <AlertDialog open={suspendUserDialogOpen} onOpenChange={setSuspendUserDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {actionTargetUser?.isActive ? <Ban className="size-5 text-amber-500" /> : <CheckCircle2 className="size-5 text-green-500" />}
              {actionTargetUser?.isActive ? 'Suspend User?' : 'Activate User?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionTargetUser?.isActive
                ? `Suspending ${actionTargetUser?.name} will prevent them from logging in.`
                : `Activating ${actionTargetUser?.name} will restore their access.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSuspendUserConfirm}
              className={actionTargetUser?.isActive ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'bg-green-600 hover:bg-green-700 text-white'}
            >
              {actionTargetUser?.isActive ? 'Suspend' : 'Activate'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Change Client ID Dialog ── */}
      <Dialog open={changeClientIdOpen} onOpenChange={setChangeClientIdOpen}>
        <DialogContent className="sm:max-w-md p-0">
          <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 p-5 text-white rounded-t-lg">
            <DialogHeader>
              <DialogTitle className="text-white flex items-center gap-2 text-lg">
                <AlertTriangle className="size-5" />
                Change Client ID
              </DialogTitle>
              <DialogDescription className="text-amber-100 text-sm">
                This will update all records associated with this business
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="p-5 space-y-4">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
              <AlertTriangle className="size-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800 dark:text-amber-300">
                <p className="font-semibold">Warning: This affects all data</p>
                <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">Changing the Client ID will update all users, invoices, items, and other records. Users must use the new Client ID to log in.</p>
              </div>
            </div>
            <div className="grid gap-2">
              <Label className="text-sm font-medium">Current Client ID</Label>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono text-base px-3 py-1">{actionTargetBusiness?.code}</Badge>
              </div>
            </div>
            <div className="grid gap-2">
              <Label className="text-sm font-medium">New Client ID</Label>
              <Input
                value={newClientId}
                onChange={(e) => setNewClientId(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                placeholder="e.g. BK002"
                className="font-mono uppercase"
                maxLength={20}
              />
              <p className="text-xs text-muted-foreground">2-20 alphanumeric characters (A-Z, 0-9)</p>
            </div>
          </div>
          <DialogFooter className="px-5 pb-5 gap-2">
            <Button variant="outline" onClick={() => setChangeClientIdOpen(false)} disabled={changeClientIdSubmitting}>Cancel</Button>
            <Button
              onClick={handleChangeClientId}
              disabled={changeClientIdSubmitting || !newClientId.trim() || newClientId === actionTargetBusiness?.code || newClientId.length < 2}
              className="gap-2 bg-amber-600 hover:bg-amber-700 text-white"
            >
              {changeClientIdSubmitting ? <Loader2 className="size-4 animate-spin" /> : <Hash className="size-4" />}
              Change Client ID
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Notification Center */}
      <NotificationCenter
        open={notifOpen}
        onClose={() => setNotifOpen(false)}
        pendingBills={0}
        lowStockCount={0}
        onNavigate={() => {}}
      />
    </div>
  );
}
