'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Users, Plus, Search, Edit, Trash2, Ban, CheckCircle2,
  Eye, EyeOff, Loader2, Shield, UserCog, ChevronDown,
  ChevronRight, X, UserPlus, Key, Lock, Unlock,
  AlertTriangle, RefreshCw, ChevronUp,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
  DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { notify } from '@/lib/notification-store';
import { useAuth } from '@/components/auth-provider';

// ── Types & Interfaces ────────────────────────────────────────────────────

interface UserPermissions {
  billing: { access: boolean; create: boolean; edit: boolean; delete: boolean };
  reports: { access: boolean; export: boolean };
  inventory: { access: boolean; create: boolean; edit: boolean; delete: boolean };
  cashManager: { access: boolean; create: boolean; edit: boolean; delete: boolean };
  khata: { access: boolean; create: boolean; edit: boolean; delete: boolean; forceEdit: boolean; reopenFolio: boolean; removeTransaction: boolean; transferOperation: boolean };
  customerFolio: { access: boolean; create: boolean; edit: boolean; delete: boolean; forceEdit: boolean; reopenFolio: boolean; removeTransaction: boolean; transferOperation: boolean; checkout: boolean; settlement: boolean; discount: boolean; refund: boolean; viewHistory: boolean; reports: boolean; manageDocuments: boolean; deleteDocuments: boolean };
  staff: { access: boolean; create: boolean; edit: boolean; delete: boolean };
  calculator: { access: boolean };
  settings: { access: boolean; edit: boolean; userManagement: boolean };
  auditLogs: { access: boolean };
}

interface User {
  id: string;
  loginId: string;
  name: string;
  role: 'Admin' | 'Manager' | 'Cashier' | 'Staff';
  status: 'Active' | 'Suspended';
  lastLogin: string | null;
  createdAt: string;
  permissions: UserPermissions;
}

type ModalMode = 'create' | 'edit' | null;

// ── Permission Presets ────────────────────────────────────────────────────

const emptyPermissions = (): UserPermissions => ({
  billing: { access: false, create: false, edit: false, delete: false },
  reports: { access: false, export: false },
  inventory: { access: false, create: false, edit: false, delete: false },
  cashManager: { access: false, create: false, edit: false, delete: false },
  khata: { access: false, create: false, edit: false, delete: false, forceEdit: false, reopenFolio: false, removeTransaction: false, transferOperation: false },
  customerFolio: { access: false, create: false, edit: false, delete: false, forceEdit: false, reopenFolio: false, removeTransaction: false, transferOperation: false, checkout: false, settlement: false, discount: false, refund: false, viewHistory: false, reports: false, manageDocuments: false, deleteDocuments: false },
  staff: { access: false, create: false, edit: false, delete: false },
  calculator: { access: false },
  settings: { access: false, edit: false, userManagement: false },
  auditLogs: { access: false },
});

const permissionPresets: Record<string, UserPermissions> = {
  Admin: {
    billing: { access: true, create: true, edit: true, delete: true },
    reports: { access: true, export: true },
    inventory: { access: true, create: true, edit: true, delete: true },
    cashManager: { access: true, create: true, edit: true, delete: true },
    khata: { access: true, create: true, edit: true, delete: true, forceEdit: true, reopenFolio: true, removeTransaction: true, transferOperation: true },
    customerFolio: { access: true, create: true, edit: true, delete: true, forceEdit: true, reopenFolio: true, removeTransaction: true, transferOperation: true, checkout: true, settlement: true, discount: true, refund: true, viewHistory: true, reports: true, manageDocuments: true, deleteDocuments: true },
    staff: { access: true, create: true, edit: true, delete: true },
    calculator: { access: true },
    settings: { access: true, edit: true, userManagement: true },
    auditLogs: { access: true },
  },
  Manager: {
    billing: { access: true, create: true, edit: true, delete: false },
    reports: { access: true, export: true },
    inventory: { access: true, create: true, edit: true, delete: false },
    cashManager: { access: true, create: true, edit: true, delete: false },
    khata: { access: true, create: true, edit: true, delete: false, forceEdit: false, reopenFolio: true, removeTransaction: false, transferOperation: true },
    customerFolio: { access: true, create: true, edit: true, delete: false, forceEdit: false, reopenFolio: true, removeTransaction: false, transferOperation: true, checkout: true, settlement: true, discount: true, refund: true, viewHistory: true, reports: true, manageDocuments: true, deleteDocuments: false },
    staff: { access: true, create: true, edit: true, delete: false },
    calculator: { access: true },
    settings: { access: false, edit: false, userManagement: false },
    auditLogs: { access: true },
  },
  Cashier: {
    billing: { access: true, create: true, edit: true, delete: false },
    reports: { access: true, export: false },
    inventory: { access: true, create: false, edit: false, delete: false },
    cashManager: { access: false, create: false, edit: false, delete: false },
    khata: { access: true, create: true, edit: true, delete: false, forceEdit: false, reopenFolio: false, removeTransaction: false, transferOperation: false },
    customerFolio: { access: true, create: true, edit: true, delete: false, forceEdit: false, reopenFolio: false, removeTransaction: false, transferOperation: false, checkout: false, settlement: true, discount: false, refund: false, viewHistory: true, reports: false, manageDocuments: true, deleteDocuments: false },
    staff: { access: false, create: false, edit: false, delete: false },
    calculator: { access: true },
    settings: { access: false, edit: false, userManagement: false },
    auditLogs: { access: false },
  },
  Staff: {
    billing: { access: true, create: true, edit: false, delete: false },
    reports: { access: false, export: false },
    inventory: { access: true, create: false, edit: false, delete: false },
    cashManager: { access: false, create: false, edit: false, delete: false },
    khata: { access: true, create: true, edit: false, delete: false, forceEdit: false, reopenFolio: false, removeTransaction: false, transferOperation: false },
    customerFolio: { access: true, create: true, edit: false, delete: false, forceEdit: false, reopenFolio: false, removeTransaction: false, transferOperation: false, checkout: false, settlement: true, discount: false, refund: false, viewHistory: false, reports: false, manageDocuments: false, deleteDocuments: false },
    staff: { access: false, create: false, edit: false, delete: false },
    calculator: { access: true },
    settings: { access: false, edit: false, userManagement: false },
    auditLogs: { access: false },
  },
};

// ── Role & Status Badge Config ────────────────────────────────────────────

const roleBadgeClasses: Record<string, string> = {
  Admin: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-400 dark:border-red-800',
  Manager: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-400 dark:border-blue-800',
  Cashier: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800',
  Staff: 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800/50 dark:text-gray-400 dark:border-gray-700',
};

const statusBadgeClasses: Record<string, string> = {
  Active: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-950/50 dark:text-green-400 dark:border-green-800',
  Suspended: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-400 dark:border-red-800',
};

// ── Permission Group Config ───────────────────────────────────────────────

interface PermGroupConfig {
  key: keyof UserPermissions;
  label: string;
  icon: React.ReactNode;
  actions: { key: string; label: string }[];
}

const permissionGroups: PermGroupConfig[] = [
  {
    key: 'billing',
    label: 'Billing',
    icon: <span className="text-lg">🧾</span>,
    actions: [
      { key: 'access', label: 'Access' },
      { key: 'create', label: 'Create' },
      { key: 'edit', label: 'Edit' },
      { key: 'delete', label: 'Delete' },
    ],
  },
  {
    key: 'reports',
    label: 'Reports',
    icon: <span className="text-lg">📊</span>,
    actions: [
      { key: 'access', label: 'Access' },
      { key: 'export', label: 'Export' },
    ],
  },
  {
    key: 'inventory',
    label: 'Inventory',
    icon: <span className="text-lg">📦</span>,
    actions: [
      { key: 'access', label: 'Access' },
      { key: 'create', label: 'Create' },
      { key: 'edit', label: 'Edit' },
      { key: 'delete', label: 'Delete' },
    ],
  },
  {
    key: 'cashManager',
    label: 'Cash Manager',
    icon: <span className="text-lg">💰</span>,
    actions: [
      { key: 'access', label: 'Access' },
      { key: 'create', label: 'Create' },
      { key: 'edit', label: 'Edit' },
      { key: 'delete', label: 'Delete' },
    ],
  },
  {
    key: 'khata',
    label: 'Khata',
    icon: <span className="text-lg">📒</span>,
    actions: [
      { key: 'access', label: 'Access' },
      { key: 'create', label: 'Create' },
      { key: 'edit', label: 'Edit' },
      { key: 'delete', label: 'Delete' },
      { key: 'forceEdit', label: 'Force Edit' },
      { key: 'reopenFolio', label: 'Reopen Folio' },
      { key: 'removeTransaction', label: 'Remove Transaction' },
      { key: 'transferOperation', label: 'Transfer Operation' },
    ],
  },
  {
    key: 'customerFolio',
    label: 'Customer Folio',
    icon: <span className="text-lg">📋</span>,
    actions: [
      { key: 'access', label: 'Access' },
      { key: 'create', label: 'Create' },
      { key: 'edit', label: 'Edit' },
      { key: 'delete', label: 'Delete' },
      { key: 'forceEdit', label: 'Force Edit' },
      { key: 'reopenFolio', label: 'Reopen Folio' },
      { key: 'removeTransaction', label: 'Remove Transaction' },
      { key: 'transferOperation', label: 'Transfer' },
      { key: 'checkout', label: 'Checkout' },
      { key: 'settlement', label: 'Settlement' },
      { key: 'discount', label: 'Discount' },
      { key: 'refund', label: 'Refund' },
      { key: 'viewHistory', label: 'View History' },
      { key: 'reports', label: 'Reports' },
      { key: 'manageDocuments', label: 'Manage Docs' },
      { key: 'deleteDocuments', label: 'Delete Docs' },
    ],
  },
  {
    key: 'staff',
    label: 'Staff Management',
    icon: <span className="text-lg">👥</span>,
    actions: [
      { key: 'access', label: 'Access' },
      { key: 'create', label: 'Create' },
      { key: 'edit', label: 'Edit' },
      { key: 'delete', label: 'Delete' },
    ],
  },
  {
    key: 'calculator',
    label: 'Calculator',
    icon: <span className="text-lg">🔢</span>,
    actions: [
      { key: 'access', label: 'Access' },
    ],
  },
  {
    key: 'settings',
    label: 'Settings',
    icon: <span className="text-lg">⚙️</span>,
    actions: [
      { key: 'access', label: 'Access' },
      { key: 'edit', label: 'Edit' },
      { key: 'userManagement', label: 'User Mgmt' },
    ],
  },
  {
    key: 'auditLogs',
    label: 'Audit Logs',
    icon: <span className="text-lg">📋</span>,
    actions: [
      { key: 'access', label: 'Access' },
    ],
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────

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

function isPermGroup(obj: unknown): obj is Record<string, boolean> {
  return typeof obj === 'object' && obj !== null && !Array.isArray(obj);
}

// ── Main Component ────────────────────────────────────────────────────────

export default function UserManagementSection() {
  const { currentUser, isAdmin, refreshSession, token } = useAuth();
  const authHeaders: Record<string, string> = token ? { 'Authorization': `Bearer ${token}` } : {};

  // Determine which roles the current user can create
  // Admin: can create all roles (Admin, Manager, Cashier, Staff)
  // Non-admin users with userManagement permission: can create Cashier, Staff only
  const canCreateAdmin = isAdmin;
  const canCreateManager = isAdmin;
  const availableRoles = isAdmin
    ? ['Admin', 'Manager', 'Cashier', 'Staff']
    : ['Cashier', 'Staff'];

  // ── State ──
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Reset Password dialog
  const [resetPwdOpen, setResetPwdOpen] = useState(false);
  const [resetPwdTarget, setResetPwdTarget] = useState<User | null>(null);
  const [resetPwdNew, setResetPwdNew] = useState('');
  const [resetPwdConfirm, setResetPwdConfirm] = useState('');
  const [resetPwdShow, setResetPwdShow] = useState(false);
  const [resetPwdSubmitting, setResetPwdSubmitting] = useState(false);

  // Modal state
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Form state
  const [formLoginId, setFormLoginId] = useState('');
  const [formName, setFormName] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formShowPassword, setFormShowPassword] = useState(false);
  const [formRole, setFormRole] = useState<'Admin' | 'Manager' | 'Cashier' | 'Staff'>('Staff');
  const [formPermissions, setFormPermissions] = useState<UserPermissions>(emptyPermissions());
  const [permsExpanded, setPermsExpanded] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Confirmation dialogs
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [suspendDialogOpen, setSuspendDialogOpen] = useState(false);
  const [actionTarget, setActionTarget] = useState<User | null>(null);

  // ── Data Fetching (with auto-retry on network failure) ──
  const fetchUsers = useCallback(async (attempt = 0) => {
    setLoading(true);
    try {
      const res = await fetch('/api/users', { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        setUsers(Array.isArray(data) ? data : []);
      } else {
        const errData = await res.json().catch(() => ({}));
        notify({ type: 'error', title: 'Error', message: errData?.error || 'Failed to fetch users' });
      }
    } catch {
      // Network error — retry up to 3 times with delay
      if (attempt < 3) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
        setTimeout(() => fetchUsers(attempt + 1), delay);
        return; // Don't set loading=false yet, retry will handle it
      }
      notify({ type: 'error', title: 'Network Error', message: 'Network error — server may be starting. Please try again.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // ── Filtered Users ──
  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      searchQuery === '' ||
      user.loginId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || user.status === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  // ── Form Handlers ──
  const resetForm = () => {
    setFormLoginId('');
    setFormName('');
    setFormPassword('');
    setFormShowPassword(false);
    setFormRole('Staff');
    setFormPermissions(emptyPermissions());
    setPermsExpanded(false);
    setSelectedUser(null);
  };

  const openCreateModal = () => {
    resetForm();
    setModalMode('create');
  };

  const openEditModal = (user: User) => {
    setSelectedUser(user);
    setFormLoginId(user.loginId);
    setFormName(user.name);
    setFormPassword('');
    setFormShowPassword(false);
    setFormRole(user.role);
    setFormPermissions({
      ...emptyPermissions(),
      ...user.permissions,
    });
    setPermsExpanded(false);
    setModalMode('edit');
  };

  const closeModal = () => {
    setModalMode(null);
    resetForm();
  };

  const applyRolePreset = (role: string) => {
    const preset = permissionPresets[role];
    if (preset) {
      setFormPermissions(JSON.parse(JSON.stringify(preset)));
    }
  };

  const handleRoleChange = (role: string) => {
    setFormRole(role as 'Admin' | 'Manager' | 'Cashier' | 'Staff');
    applyRolePreset(role);
  };

  const togglePermission = (
    groupKey: keyof UserPermissions,
    actionKey: string,
  ) => {
    setFormPermissions((prev) => {
      const group = prev[groupKey];
      if (!isPermGroup(group)) return prev;
      return {
        ...prev,
        [groupKey]: {
          ...group,
          [actionKey]: !group[actionKey],
        },
      };
    });
  };

  const handleSubmit = async () => {
    // Validation
    if (!formLoginId.trim()) {
      notify({ type: 'error', title: 'Validation Error', message: 'Login ID is required' });
      return;
    }
    if (!formName.trim()) {
      notify({ type: 'error', title: 'Validation Error', message: 'Name is required' });
      return;
    }
    if (modalMode === 'create' && !formPassword) {
      notify({ type: 'error', title: 'Validation Error', message: 'Password is required for new users' });
      return;
    }
    if (modalMode === 'create' && formPassword.length < 4) {
      notify({ type: 'error', title: 'Validation Error', message: 'Password must be at least 4 characters' });
      return;
    }

    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        loginId: formLoginId.trim().toLowerCase(),
        name: formName.trim(),
        role: formRole,
        permissions: formPermissions,
      };
      if (formPassword) {
        payload.password = formPassword;
      }

      let res: Response;
      if (modalMode === 'create') {
        res = await fetch('/api/users', {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(`/api/users/${selectedUser?.id}`, {
          method: 'PUT',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      if (res.ok) {
        notify({
          type: 'success',
          title: modalMode === 'create' ? 'User Created' : 'User Updated',
          message: modalMode === 'create'
            ? `User "${formLoginId}" created successfully`
            : `User "${formLoginId}" updated successfully`,
        });
        closeModal();
        fetchUsers();
        // Refresh session to pick up any permission changes (especially if Admin edited own permissions)
        refreshSession();
      } else {
        const errData = await res.json().catch(() => null);
        notify({ type: 'error', title: 'Error', message: errData?.error || `Failed to ${modalMode} user` });
      }
    } catch {
      notify({ type: 'error', title: 'Network Error', message: 'Network error — server may be starting. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Action Handlers ──
  const handleDeleteClick = (user: User) => {
    setActionTarget(user);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!actionTarget) return;
    try {
      const res = await fetch(`/api/users/${actionTarget.id}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      if (res.ok) {
        notify({ type: 'success', title: 'User Deleted', message: `User "${actionTarget.loginId}" deleted successfully` });
        fetchUsers();
      } else {
        const errData = await res.json().catch(() => null);
        notify({ type: 'error', title: 'Error', message: errData?.error || 'Failed to delete user' });
      }
    } catch {
      notify({ type: 'error', title: 'Network Error', message: 'Network error while deleting user' });
    } finally {
      setDeleteDialogOpen(false);
      setActionTarget(null);
    }
  };

  // Reset Password handlers
  const handleResetPwdClick = (user: User) => {
    setResetPwdTarget(user);
    setResetPwdNew('');
    setResetPwdConfirm('');
    setResetPwdShow(false);
    setResetPwdOpen(true);
  };

  const handleResetPwdConfirm = async () => {
    if (!resetPwdTarget) return;
    if (!resetPwdNew || resetPwdNew.length < 4) {
      notify({ type: 'error', title: 'Validation Error', message: 'Password must be at least 4 characters' });
      return;
    }
    if (resetPwdNew !== resetPwdConfirm) {
      notify({ type: 'error', title: 'Validation Error', message: 'Passwords do not match' });
      return;
    }
    setResetPwdSubmitting(true);
    try {
      const res = await fetch(`/api/users/${resetPwdTarget.id}`, {
        method: 'PUT',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: resetPwdNew, _passwordOnly: true }),
      });
      if (res.ok) {
        notify({ type: 'success', title: 'Password Reset', message: `Password reset for "${resetPwdTarget.name}"` });
        setResetPwdOpen(false);
        setResetPwdTarget(null);
      } else {
        const err = await res.json().catch(() => null);
        notify({ type: 'error', title: 'Error', message: err?.error || 'Failed to reset password' });
      }
    } catch {
      notify({ type: 'error', title: 'Network Error', message: 'Network error' });
    } finally {
      setResetPwdSubmitting(false);
    }
  };

  const handleSuspendClick = (user: User) => {
    setActionTarget(user);
    setSuspendDialogOpen(true);
  };

  const handleSuspendConfirm = async () => {
    if (!actionTarget) return;
    const newStatus = actionTarget.status === 'Active' ? 'Suspended' : 'Active';
    try {
      const res = await fetch(`/api/users/${actionTarget.id}`, {
        method: 'PUT',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        notify({
          type: 'success',
          title: newStatus === 'Active' ? 'User Activated' : 'User Suspended',
          message: `User "${actionTarget.loginId}" ${newStatus === 'Active' ? 'activated' : 'suspended'} successfully`,
        });
        fetchUsers();
      } else {
        const errData = await res.json().catch(() => null);
        notify({ type: 'error', title: 'Error', message: errData?.error || `Failed to ${newStatus === 'Active' ? 'activate' : 'suspend'} user` });
      }
    } catch {
      notify({ type: 'error', title: 'Network Error', message: 'Network error. Please try again.' });
    } finally {
      setSuspendDialogOpen(false);
      setActionTarget(null);
    }
  };

  // ── Loading State ──
  if (loading) {
    return (
      <Card className="overflow-hidden border-0 shadow-sm">
        <CardHeader className="pb-4">
          <Skeleton className="h-7 w-52" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <div className="px-6 pb-6 space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
      </Card>
    );
  }

  // ── Render ──
  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="overflow-hidden border-0 shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex size-10 items-center justify-center rounded-xl bg-green-100 dark:bg-green-950/50 text-green-600 dark:text-green-400 shrink-0">
                <Users className="size-5" />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-lg flex items-center gap-2">
                  User Management
                  <Badge variant="outline" className="font-mono text-xs">
                    {users.length}
                  </Badge>
                </CardTitle>
                <CardDescription className="mt-0.5">
                  Manage staff accounts, roles, and permissions
                </CardDescription>
              </div>
            </div>
            <Button
              onClick={openCreateModal}
              className="gap-2 bg-green-600 hover:bg-green-700 text-white shrink-0 self-start sm:self-auto"
            >
              <UserPlus className="size-4" />
              Add User
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Search & Filters */}
      <Card className="overflow-hidden border-0 shadow-sm">
        <div className="p-4 space-y-3">
          {/* Search Row */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search by login ID or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="size-4" />
              </button>
            )}
          </div>

          {/* Filter Row */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Filter:</span>
            {['all', ...availableRoles].map((role) => (
              <button
                key={role}
                onClick={() => setRoleFilter(role)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all border ${
                  roleFilter === role
                    ? 'bg-green-600 text-white border-green-600'
                    : 'border-muted text-muted-foreground hover:border-green-300 hover:text-foreground'
                }`}
              >
                {role === 'all' ? 'All Roles' : role}
              </button>
            ))}
            <Separator orientation="vertical" className="h-5 mx-1" />
            {['all', 'Active', 'Suspended'].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all border ${
                  statusFilter === status
                    ? status === 'Active'
                      ? 'bg-green-600 text-white border-green-600'
                      : status === 'Suspended'
                        ? 'bg-red-600 text-white border-red-600'
                        : 'bg-green-600 text-white border-green-600'
                    : 'border-muted text-muted-foreground hover:border-green-300 hover:text-foreground'
                }`}
              >
                {status === 'all' ? 'All Status' : status}
              </button>
            ))}
            {(searchQuery || roleFilter !== 'all' || statusFilter !== 'all') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setRoleFilter('all');
                  setStatusFilter('all');
                }}
                className="ml-auto text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
              >
                <RefreshCw className="size-3" />
                Clear filters
              </button>
            )}
          </div>
        </div>
      </Card>

      {/* User Table */}
      <Card className="overflow-hidden border-0 shadow-sm">
        <div className="overflow-x-auto">
          {filteredUsers.length === 0 ? (
            /* Empty State / Error State */
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <div className="size-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                {loading ? (
                  <Loader2 className="size-8 text-muted-foreground animate-spin" />
                ) : (
                  <Users className="size-8 text-muted-foreground" />
                )}
              </div>
              {loading ? (
                <>
                  <h3 className="text-base font-semibold text-foreground mb-1">
                    Loading users...
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Please wait while we fetch the user list.
                  </p>
                </>
              ) : users.length === 0 ? (
                <>
                  <h3 className="text-base font-semibold text-foreground mb-1">
                    No users yet
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                    Get started by adding your first staff member. You can assign roles and permissions later.
                  </p>
                  <Button
                    onClick={openCreateModal}
                    className="gap-2 bg-green-600 hover:bg-green-700 text-white"
                  >
                    <UserPlus className="size-4" />
                    Add Your First User
                  </Button>
                </>
              ) : (
                <>
                  <h3 className="text-base font-semibold text-foreground mb-1">
                    No matching users
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Try adjusting your search or filter criteria
                  </p>
                </>
              )}
              {!loading && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchUsers()}
                  className="mt-4 gap-2"
                >
                  <RefreshCw className="size-3.5" />
                  Retry
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="font-semibold">Login ID</TableHead>
                  <TableHead className="font-semibold">Name</TableHead>
                  <TableHead className="font-semibold">Role</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="font-semibold hidden md:table-cell">Last Login</TableHead>
                  <TableHead className="font-semibold hidden lg:table-cell">Created</TableHead>
                  <TableHead className="font-semibold text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id} className="group">
                    <TableCell className="font-mono text-sm font-medium">
                      {user.loginId}
                    </TableCell>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={roleBadgeClasses[user.role] || ''}
                      >
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={statusBadgeClasses[user.status] || ''}
                      >
                        <span className="size-1.5 rounded-full bg-current mr-1.5" />
                        {user.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                      {formatDateTime(user.lastLogin)}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">
                      {formatDate(user.createdAt)}
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
                          onClick={() => openEditModal(user)}
                          title="Edit user"
                        >
                          <Edit className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className={`size-8 p-0 ${
                            user.status === 'Active'
                              ? 'text-muted-foreground hover:text-amber-600'
                              : 'text-muted-foreground hover:text-green-600'
                          }`}
                          onClick={() => handleSuspendClick(user)}
                          title={user.status === 'Active' ? 'Suspend user' : 'Activate user'}
                        >
                          {user.status === 'Active' ? (
                            <Ban className="size-4" />
                          ) : (
                            <CheckCircle2 className="size-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="size-8 p-0 text-muted-foreground hover:text-red-600"
                          onClick={() => handleDeleteClick(user)}
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
          )}
        </div>

        {/* Table Footer */}
        {filteredUsers.length > 0 && (
          <div className="px-4 py-3 border-t bg-muted/20 text-xs text-muted-foreground flex items-center justify-between">
            <span>
              Showing {filteredUsers.length} of {users.length} user{users.length !== 1 ? 's' : ''}
            </span>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <span className="size-2 rounded-full bg-green-500" />
                Active: {users.filter((u) => u.status === 'Active').length}
              </span>
              <span className="flex items-center gap-1">
                <span className="size-2 rounded-full bg-red-500" />
                Suspended: {users.filter((u) => u.status === 'Suspended').length}
              </span>
            </div>
          </div>
        )}
      </Card>

      {/* ── Create / Edit User Dialog ── */}
      <Dialog
        open={modalMode !== null}
        onOpenChange={(open) => {
          if (!open) closeModal();
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto p-0">
          {/* Dialog Header Banner */}
          <div className="bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 p-5 text-white rounded-t-lg sticky top-0 z-10">
            <div className="pointer-events-none absolute -right-6 -top-6 size-24 rounded-full bg-white/10" />
            <DialogHeader>
              <DialogTitle className="text-white flex items-center gap-2 text-lg">
                {modalMode === 'create' ? (
                  <>
                    <UserPlus className="size-5" />
                    Create New User
                  </>
                ) : (
                  <>
                    <UserCog className="size-5" />
                    Edit User
                  </>
                )}
              </DialogTitle>
              <DialogDescription className="text-green-100 text-sm">
                {modalMode === 'create'
                  ? 'Add a new staff member to the system with role-based access'
                  : `Editing user: ${selectedUser?.loginId}`}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="p-5 space-y-5">
            {/* Login ID */}
            <div className="grid gap-2">
              <Label htmlFor="login-id" className="text-sm font-medium flex items-center gap-1.5">
                <Key className="size-3.5 text-green-600" />
                Login ID
              </Label>
              <Input
                id="login-id"
                placeholder="e.g. john.doe"
                value={formLoginId}
                onChange={(e) => setFormLoginId(e.target.value.toLowerCase())}
                disabled={modalMode === 'edit'}
                className="font-mono"
              />
              {modalMode === 'edit' && (
                <p className="text-[11px] text-muted-foreground">
                  Login ID cannot be changed after creation
                </p>
              )}
            </div>

            {/* Name */}
            <div className="grid gap-2">
              <Label htmlFor="user-name" className="text-sm font-medium flex items-center gap-1.5">
                <Users className="size-3.5 text-green-600" />
                Full Name
              </Label>
              <Input
                id="user-name"
                placeholder="e.g. John Doe"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>

            {/* Password */}
            <div className="grid gap-2">
              <Label htmlFor="user-password" className="text-sm font-medium flex items-center gap-1.5">
                <Lock className="size-3.5 text-green-600" />
                Password
                {modalMode === 'edit' && (
                  <span className="text-muted-foreground font-normal text-xs">
                    (leave empty to keep current)
                  </span>
                )}
              </Label>
              <div className="relative">
                <Input
                  id="user-password"
                  type={formShowPassword ? 'text' : 'password'}
                  placeholder={
                    modalMode === 'create'
                      ? 'Minimum 4 characters'
                      : 'Leave empty to keep current password'
                  }
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setFormShowPassword(!formShowPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {formShowPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
            </div>

            <Separator />

            {/* Role Selector */}
            <div className="grid gap-3">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <Shield className="size-3.5 text-green-600" />
                Role
              </Label>
              <Select value={formRole} onValueChange={handleRoleChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {isAdmin && (
                    <SelectItem value="Admin">
                      <span className="flex items-center gap-2">
                        <span className="size-2 rounded-full bg-red-500" />
                        Admin — Full system access
                      </span>
                    </SelectItem>
                  )}
                  {isAdmin && (
                    <SelectItem value="Manager">
                      <span className="flex items-center gap-2">
                        <span className="size-2 rounded-full bg-blue-500" />
                        Manager — Operational management
                      </span>
                    </SelectItem>
                  )}
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

            {/* Permission Presets Quick Buttons */}
            <div className="grid gap-2">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                Permission Presets
              </Label>
              <div className="flex flex-wrap gap-2">
                {availableRoles.map((presetRole) => (
                  <button
                    key={presetRole}
                    type="button"
                    onClick={() => {
                      setFormRole(presetRole as 'Admin' | 'Manager' | 'Cashier' | 'Staff');
                      applyRolePreset(presetRole);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border flex items-center gap-1.5 ${
                      formRole === presetRole
                        ? roleBadgeClasses[presetRole] + ' border-current shadow-sm'
                        : 'border-muted text-muted-foreground hover:border-foreground/20 hover:text-foreground'
                    }`}
                  >
                    {formRole === presetRole && <CheckCircle2 className="size-3" />}
                    {presetRole}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Click a preset to apply default permissions. You can customize them below.
              </p>
            </div>

            <Separator />

            {/* Permission Toggles */}
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <Key className="size-3.5 text-green-600" />
                Permissions
                <span className="text-muted-foreground font-normal text-xs">
                  ({permissionGroups.reduce((sum, g) => sum + g.actions.length, 0)} permissions)
                </span>
              </Label>

              <Collapsible open={permsExpanded} onOpenChange={setPermsExpanded}>
                <CollapsibleTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-between gap-2 text-sm"
                  >
                    <span className="flex items-center gap-2">
                      {permsExpanded ? (
                        <ChevronUp className="size-4" />
                      ) : (
                        <ChevronDown className="size-4" />
                      )}
                      {permsExpanded ? 'Hide' : 'Show'} permission details
                    </span>
                    <Badge variant="secondary" className="text-[10px] font-mono">
                      {Object.values(formPermissions).reduce((count, group) => {
                        if (isPermGroup(group)) {
                          return count + Object.values(group).filter(Boolean).length;
                        }
                        return count;
                      }, 0)}{' '}
                      /{' '}
                      {permissionGroups.reduce((sum, g) => sum + g.actions.length, 0)} active
                    </Badge>
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-3">
                  <div className="rounded-xl border bg-muted/20 p-3 space-y-3 max-h-72 overflow-y-auto">
                    {permissionGroups.map((group, groupIdx) => {
                      const groupPerms = formPermissions[group.key];
                      if (!isPermGroup(groupPerms)) return null;
                      const activeCount = Object.values(groupPerms).filter(Boolean).length;
                      const totalActions = group.actions.length;
                      const allActive = activeCount === totalActions;

                      return (
                        <div key={group.key}>
                          {groupIdx > 0 && <Separator className="mb-3" />}
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              {group.icon}
                              <span className="text-sm font-medium">{group.label}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-muted-foreground">
                                {activeCount}/{totalActions}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setFormPermissions((prev) => ({
                                    ...prev,
                                    [group.key]: Object.fromEntries(
                                      group.actions.map((a) => [a.key, !allActive]),
                                    ),
                                  }));
                                }}
                                className={`text-[10px] px-2 py-0.5 rounded-md transition-all border ${
                                  allActive
                                    ? 'border-muted text-muted-foreground hover:border-green-400 hover:text-green-600'
                                    : 'border-green-400 text-green-600 hover:border-muted hover:text-muted-foreground'
                                }`}
                              >
                                {allActive ? 'Disable All' : 'Enable All'}
                              </button>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-4 gap-y-2">
                            {group.actions.map((action) => (
                              <div
                                key={action.key}
                                className="flex items-center justify-between py-1"
                              >
                                <Label className="text-xs text-muted-foreground cursor-pointer">
                                  {action.label}
                                </Label>
                                <Switch
                                  checked={!!groupPerms[action.key]}
                                  onCheckedChange={() =>
                                    togglePermission(group.key, action.key)
                                  }
                                  className="scale-90"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          </div>

          {/* Dialog Footer */}
          <div className="border-t p-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sticky bottom-0 bg-background rounded-b-lg">
            <Button variant="outline" onClick={closeModal} disabled={submitting}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="gap-2 bg-green-600 hover:bg-green-700 text-white min-w-[140px]"
            >
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {modalMode === 'create' ? 'Creating...' : 'Saving...'}
                </>
              ) : modalMode === 'create' ? (
                <>
                  <UserPlus className="size-4" />
                  Create User
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-4" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation Dialog ── */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="size-5" />
              Delete User
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              Are you sure you want to permanently delete{' '}
              <span className="font-semibold text-foreground">
                &quot;{actionTarget?.name}&quot;
              </span>{' '}
              ({actionTarget?.loginId})? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-600 hover:bg-red-700 text-white focus:ring-red-600"
            >
              <span className="flex items-center gap-2">
                <Trash2 className="size-4" />
                Delete Permanently
              </span>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Suspend / Activate Confirmation Dialog ── */}
      <AlertDialog open={suspendDialogOpen} onOpenChange={setSuspendDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {actionTarget?.status === 'Active' ? (
                <>
                  <Ban className="size-5 text-amber-600" />
                  <span className="text-amber-600">Suspend User</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-5 text-green-600" />
                  <span className="text-green-600">Activate User</span>
                </>
              )}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              {actionTarget?.status === 'Active' ? (
                <>
                  Are you sure you want to suspend{' '}
                  <span className="font-semibold text-foreground">
                    &quot;{actionTarget?.name}&quot;
                  </span>{' '}
                  ({actionTarget?.loginId})? They will not be able to log in until reactivated.
                </>
              ) : (
                <>
                  Are you sure you want to reactivate{' '}
                  <span className="font-semibold text-foreground">
                    &quot;{actionTarget?.name}&quot;
                  </span>{' '}
                  ({actionTarget?.loginId})? They will regain access to the system.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSuspendConfirm}
              className={
                actionTarget?.status === 'Active'
                  ? 'bg-amber-600 hover:bg-amber-700 text-white focus:ring-amber-600'
                  : 'bg-green-600 hover:bg-green-700 text-white focus:ring-green-600'
              }
            >
              <span className="flex items-center gap-2">
                {actionTarget?.status === 'Active' ? (
                  <>
                    <Ban className="size-4" />
                    Suspend User
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="size-4" />
                    Activate User
                  </>
                )}
              </span>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
