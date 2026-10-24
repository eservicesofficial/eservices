'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Settings, Store, Printer, Database, Save, RotateCcw, Download, Upload,
  Loader2, AlertTriangle, Check, ChevronDown, ChevronUp, FileText, Receipt, Scissors, X,
  ImageIcon, Trash2, Users, Shield, Lock, Eye, EyeOff, RotateCw, Smartphone,
  AlertCircle, RefreshCw, Zap,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { notify } from '@/lib/notification-store';
import { useFeature } from '@/hooks/use-feature';
import { getCategoryLabel } from '@/lib/category-templates';
import { buildRichThermalHtml, type ThermalReceiptData } from '@/lib/thermal-settings';
import { useAuth } from '@/components/auth-provider';
import ReadOnlyBanner from '@/components/read-only-banner';
import UserManagementSection from '@/components/sections/user-management-section';
// ── Types & Defaults ─────────────────────────────────────────────────────────

interface ThermalPrinterSettings {
  paperWidth: '58mm' | '80mm';
  fontSize: number;            // px: 8-18
  lineHeight: number;          // 1.0-2.0
  textWeight: 'Bold' | 'Normal' | 'Light';
  printDpi: number;            // 203 | 300
  printQuality: 'Dark' | 'Light';
  dithering: 'None' | 'Floyd Steinberg' | 'Black & White';
  showLogo: boolean;
  logo: string;                // base64 data URL
}

interface SettingsSectionProps { scrollToId?: string; dataVersion?: number; }

const DEFAULT_THERMAL: ThermalPrinterSettings = {
  paperWidth: '80mm', fontSize: 11, lineHeight: 1.3,
  printDpi: 203,
  textWeight: 'Normal',
  printQuality: 'Dark',
  dithering: 'None',
  showLogo: false,
  logo: '',
};

const WEIGHT_MAP: Record<string, number> = { Bold: 700, Normal: 400, Light: 300 };
const QUALITY_OPACITY: Record<string, number> = { Dark: 1, Light: 0.6 };
const INPUT_CLS = 'focus-visible:ring-green-500/20 focus-visible:border-green-500/50';

const MODULE_COLORS: Record<string, string> = {
  inventory: 'text-emerald-600 border-emerald-200',
  billing: 'text-blue-600 border-blue-200',
  restaurant: 'text-amber-600 border-amber-200',
  manufacturing: 'text-purple-600 border-purple-200',
  service: 'text-teal-600 border-teal-200',
  general: 'text-gray-600 border-gray-200',
};

// Map UI ThermalPrinterSettings → ThermalConfig for buildRichThermalHtml
function uiToConfig(t: ThermalPrinterSettings) {
  return {
    paperWidth: t.paperWidth,
    fontSize: `${t.fontSize}px`,
    textWeight: WEIGHT_MAP[t.textWeight] ?? 400,
    lineHeight: t.lineHeight,
    printDpi: t.printDpi,
    printQuality: QUALITY_OPACITY[t.printQuality] ?? 1,
    dithering: t.dithering,
    alignment: 'center' as const,
    showLogo: t.showLogo,
    logo: t.logo,
    paperPxWidth: t.paperWidth === '80mm' ? 302 : 224,
    autoCutLines: 2,
  };
}

// ── Reusable: Collapsible Section ────────────────────────────────────────────

function Section({
  id, icon, title, desc, children, open: defaultOpen = true, badge,
}: {
  id: string; icon: React.ReactNode; title: string; desc: string;
  children: React.ReactNode; open?: boolean; badge?: React.ReactNode;
}) {
  const [o, setO] = useState(defaultOpen);
  return (
    <Card className="overflow-hidden border-0 shadow-sm transition-all duration-200 hover:shadow-md">
      <button className="w-full text-left" onClick={() => setO(!o)}>
        <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-green-100 text-green-600 shrink-0">{icon}</div>
              <div className="min-w-0">
                <CardTitle className="text-base flex items-center gap-2">{title}{badge}</CardTitle>
                <CardDescription className="mt-0.5 truncate">{desc}</CardDescription>
              </div>
            </div>
            <div className="shrink-0 text-muted-foreground">{o ? <ChevronUp className="size-5" /> : <ChevronDown className="size-5" />}</div>
          </div>
        </CardHeader>
      </button>
      {o && <div className="px-6 pb-6">{children}</div>}
    </Card>
  );
}

function Divider({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <Separator className="flex-1" />
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">{icon}{label}</span>
      <Separator className="flex-1" />
    </div>
  );
}

function SaveBtn({ section, label, onClick, saving, saved, disabled }: {
  section: string; label: string; onClick: () => void; saving: string | null; saved: string | null; disabled?: boolean;
}) {
  const s = saving === section, d = saved === section;
  return (
    <div className="flex justify-end">
      <Button onClick={onClick} disabled={s || disabled} className={`gap-1.5 transition-all duration-300 ${d ? 'bg-green-500 hover:bg-green-600' : 'bg-green-600 hover:bg-green-700'} text-white`}>
        {s ? <Loader2 className="h-4 w-4 animate-spin" /> : d ? <><Check className="h-4 w-4" />Saved!</> : <><Save className="h-4 w-4" />{label}</>}
      </Button>
    </div>
  );
}

function SavedBadge({ section, saved }: { section: string; saved: string | null }) {
  if (saved !== section) return null;
  return <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px] gap-0.5"><Check className="size-3" />Saved</Badge>;
}

// ── Receipt Preview (iframe-based WYSIWYG) ──────────────────────────────────

function ReceiptPreview({ shopName, shopAddress, shopPhone, gstNumber, showGst, t }: { shopName: string; shopAddress: string; shopPhone: string; gstNumber: string; showGst: boolean; t: ThermalPrinterSettings }) {
  const config = uiToConfig(t);
  const sampleData: ThermalReceiptData = {
    shopName: shopName || 'My Shop',
    shopAddress: shopAddress || '123, Main Road',
    shopPhone: shopPhone || '+91 98765 43210',
    shopGst: gstNumber,
    shopGstState: '',
    showGst: showGst,
    invoiceNumber: 'FP-001',
    date: new Date().toLocaleDateString('en-IN'),
    orderType: 'Dine-In',
    customerName: 'Walk-in',
    customerPhone: '',
    customerAddress: '',
    items: [
      { name: 'Item 1', qty: 1, rate: 150, total: 150 },
      { name: 'Item 2', qty: 2, rate: 100, total: 200 },
      { name: 'Item 3', qty: 1, rate: 75, total: 75 },
    ],
    subtotal: 425,
    cgst: 38.25,
    sgst: 38.25,
    gstRate: 18,
    deliveryCharge: 0,
    discountAmount: 0,
    grandTotal: 501.5,
    paidAmount: 501.5,
    balanceAmount: 0,
    paymentMethod: 'Cash',
    billStatus: 'Paid',
  };
  const html = buildRichThermalHtml(sampleData, config, 'Preview');
  const iframeMaxW = t.paperWidth === '58mm' ? 224 : 302;

  return (
    <div className="bg-white border-2 border-dashed border-gray-300 rounded-lg p-2 mx-auto transition-all duration-200" style={{ maxWidth: `${iframeMaxW + 24}px` }}>
      <iframe
        srcDoc={html}
        title="Receipt Preview"
        style={{
          width: `${iframeMaxW}px`,
          height: 'auto',
          minHeight: '380px',
          border: 'none',
          overflow: 'hidden',
          display: 'block',
        }}
        sandbox="allow-same-origin"
      />
    </div>
  );
}

// ── Radio Option Helper ──────────────────────────────────────────────────────

function RadioOpt({ id, value, label, group }: { id: string; value: string; label: string; group: string }) {
  return (
    <div className="flex items-center gap-2">
      <RadioGroupItem value={value} id={id} />
      <Label htmlFor={id} className="cursor-pointer">{label}</Label>
    </div>
  );
}

// ── Slider Field Helper ──────────────────────────────────────────────────────

function SliderField({ label, value, min, max, unit, onChange, icon }: {
  label: string; value: number; min: number; max: number; unit: string;
  onChange: (v: number) => void; icon?: React.ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between">
        <Label className={icon ? 'flex items-center gap-1.5' : ''}>{icon}{label}</Label>
        <Badge variant="outline" className="font-mono">{value}{unit}</Badge>
      </div>
      <Slider value={[value]} onValueChange={(v) => onChange(v[0])} min={min} max={max} step={1} />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{min}{unit}</span><span>{max}{unit}</span>
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

function ChangePasswordSection() {
  const { currentUser, token } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      notify({ type: 'error', title: 'Error', message: 'All fields are required' });
      return;
    }
    if (newPassword.length < 4) {
      notify({ type: 'error', title: 'Error', message: 'New password must be at least 4 characters' });
      return;
    }
    if (newPassword !== confirmPassword) {
      notify({ type: 'error', title: 'Error', message: 'New passwords do not match' });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/users/${currentUser?.userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          currentPassword,
          password: newPassword,
          _passwordOnly: true,
        }),
      });
      if (res.ok) {
        notify({ type: 'success', title: 'Password Updated', message: 'Password changed successfully' });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        const data = await res.json().catch(() => null);
        notify({ type: 'error', title: 'Error', message: data?.error || 'Failed to change password' });
      }
    } catch {
      notify({ type: 'error', title: 'Error', message: 'Network error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="overflow-hidden border-0 shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-amber-100 text-amber-600 shrink-0">
            <Lock className="size-4" />
          </div>
          <div className="min-w-0">
            <CardTitle className="text-base">Change Password</CardTitle>
            <CardDescription className="mt-0.5">Update your account password</CardDescription>
          </div>
        </div>
      </CardHeader>
      <div className="px-6 pb-6 space-y-4">
        <div className="grid gap-2 border-l-2 border-l-amber-400 pl-3">
          <Label className="text-sm font-medium">Current Password</Label>
          <div className="relative">
            <Input
              type={showCurrent ? 'text' : 'password'}
              placeholder="Enter current password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="pr-10"
            />
            <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              {showCurrent ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>
        <div className="grid gap-2 border-l-2 border-l-amber-400 pl-3">
          <Label className="text-sm font-medium">New Password</Label>
          <div className="relative">
            <Input
              type={showNew ? 'text' : 'password'}
              placeholder="Enter new password (min 4 chars)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="pr-10"
            />
            <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              {showNew ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>
        <div className="grid gap-2 border-l-2 border-l-amber-400 pl-3">
          <Label className="text-sm font-medium">Confirm New Password</Label>
          <div className="relative">
            <Input
              type={showConfirm ? 'text' : 'password'}
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="pr-10"
            />
            <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={handleChangePassword} disabled={loading} className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white">
            {loading ? <Loader2 className="size-4 animate-spin" /> : <><Lock className="size-4" />Update Password</>}
          </Button>
        </div>
      </div>
    </Card>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function SettingsSection({ scrollToId, dataVersion }: SettingsSectionProps) {
  const { currentUser, hasPermission, token } = useAuth();
  const canAccess = hasPermission('settings', 'access');
  const canEdit = hasPermission('settings', 'edit');
  const noAccess = !canAccess;
  const isReadOnly = !canAccess || !canEdit;
  const hasFetchedOnce = useRef(false);
  const isDirtyRef = useRef(false); // Track if user has unsaved changes
  // Use ref for token so fetchSettings doesn't re-create on token change.
  // Token changes from session refresh were causing fetchSettings to get a new reference,
  // which triggered useEffect re-runs and re-fetches that overwrite user input.
  // The global fetch wrapper in page.tsx already adds auth headers to all requests.
  const tokenRef = useRef(token);
  useEffect(() => { tokenRef.current = token; }, [token]);

  // Feature management
  const featureState = useFeature();

  const handleToggleFeature = async (featureId: string, enabled: boolean) => {
    try {
      const res = await fetch('/api/features', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ featureId, enabled }),
      });
      if (res.ok) {
        notify({ type: 'success', title: enabled ? 'Feature Enabled' : 'Feature Disabled', message: `Feature has been ${enabled ? 'enabled' : 'disabled'}` });
        featureState.refresh();
      } else {
        notify({ type: 'error', title: 'Error', message: 'Failed to update feature' });
      }
    } catch {
      notify({ type: 'error', title: 'Error', message: 'Network error' });
    }
  };

  useEffect(() => {
    if (!scrollToId) return;
    const t = setTimeout(() => {
      const el = document.getElementById(scrollToId);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);
    return () => clearTimeout(t);
  }, [scrollToId]);

  // NOTE: Removed refreshSession() on mount — it caused a cascade:
  // refreshSession → token changes → fetchSettings recreates → re-fetch → state overwrite
  // Session is already refreshed periodically by AuthProvider (every 30 min).

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [savingSection, setSavingSection] = useState<string | null>(null);
  const [savedSection, setSavedSection] = useState<string | null>(null);
  const saveTimer = useRef<NodeJS.Timeout | null>(null);

  // Cleanup saveTimer on unmount to prevent memory leak
  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  // Helper: mark form as dirty (user has unsaved changes)
  const markDirty = useCallback(() => { isDirtyRef.current = true; }, []);

  // Business
  const [shopName, setShopNameRaw] = useState('');
  const [address, setAddressRaw] = useState('');
  const [email, setEmailRaw] = useState('');
  const [phone, setPhoneRaw] = useState('');
  const [signatory, setSignatoryRaw] = useState('');
  const [gstNumber, setGstNumberRaw] = useState('');
  // Wrapped setters that mark dirty
  const setShopName = useCallback((v: string) => { markDirty(); setShopNameRaw(v); }, [markDirty]);
  const setAddress = useCallback((v: string) => { markDirty(); setAddressRaw(v); }, [markDirty]);
  const setEmail = useCallback((v: string) => { markDirty(); setEmailRaw(v); }, [markDirty]);
  const setPhone = useCallback((v: string) => { markDirty(); setPhoneRaw(v); }, [markDirty]);
  const setSignatory = useCallback((v: string) => { markDirty(); setSignatoryRaw(v); }, [markDirty]);
  const setGstNumber = useCallback((v: string) => { markDirty(); setGstNumberRaw(v); }, [markDirty]);

  // Billing
  const [gstEnabled, setGstEnabledRaw] = useState(false);
  const [gstFullMode, setGstFullModeRaw] = useState(false);
  const [gstSimpleMode, setGstSimpleModeRaw] = useState(false);
  const [gstRate, setGstRateRaw] = useState(18);
  const [gstState, setGstStateRaw] = useState('');
  const [deliveryCharge, setDeliveryChargeRaw] = useState(0);
  const [enableDelivery, setEnableDeliveryRaw] = useState(false);
  const setGstEnabled = useCallback((v: boolean) => { markDirty(); setGstEnabledRaw(v); }, [markDirty]);
  const setGstFullMode = useCallback((v: boolean) => { markDirty(); setGstFullModeRaw(v); }, [markDirty]);
  const setGstSimpleMode = useCallback((v: boolean) => { markDirty(); setGstSimpleModeRaw(v); }, [markDirty]);
  const setGstRate = useCallback((v: number) => { markDirty(); setGstRateRaw(v); }, [markDirty]);
  const setGstState = useCallback((v: string) => { markDirty(); setGstStateRaw(v); }, [markDirty]);
  const setDeliveryCharge = useCallback((v: number) => { markDirty(); setDeliveryChargeRaw(v); }, [markDirty]);
  const setEnableDelivery = useCallback((v: boolean) => { markDirty(); setEnableDeliveryRaw(v); }, [markDirty]);

  // Auto Rotate
  const [autoRotate, setAutoRotateRaw] = useState(false);
  const setAutoRotate = useCallback((v: boolean) => { markDirty(); setAutoRotateRaw(v); }, [markDirty]);

  // Bill Number Generator
  const [billAutoGenerate, setBillAutoGenerateRaw] = useState(false);
  const [billPrefix, setBillPrefixRaw] = useState('');
  const [billStartNumber, setBillStartNumberRaw] = useState(1);
  const [billCurrentNumber, setBillCurrentNumberRaw] = useState(0);
  const setBillAutoGenerate = useCallback((v: boolean) => { markDirty(); setBillAutoGenerateRaw(v); }, [markDirty]);
  const setBillPrefix = useCallback((v: string) => { markDirty(); setBillPrefixRaw(v); }, [markDirty]);
  const setBillStartNumber = useCallback((v: number) => { markDirty(); setBillStartNumberRaw(v); }, [markDirty]);
  const setBillCurrentNumber = useCallback((v: number) => { markDirty(); setBillCurrentNumberRaw(v); }, [markDirty]);

  // Thermal (localStorage)
  const [thermal, setThermal] = useState<ThermalPrinterSettings>(DEFAULT_THERMAL);
  const [thermalSaved, setThermalSaved] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Data management
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  // Load DB settings
  // NOTE: fetchSettings has NO dependency on token state — uses tokenRef instead.
  // This prevents fetchSettings from being re-created on every token change (session refresh),
  // which would cascade into useEffect re-runs and re-fetches that overwrite user input.
  const fetchSettings = useCallback(async (silent?: boolean) => {
    // If user has unsaved changes and this is a background sync, skip to avoid overwriting input
    if (silent && isDirtyRef.current) return;
    if (!silent) setLoading(true);
    try {
      const res = await fetch('/api/settings', {
        headers: tokenRef.current ? { 'Authorization': `Bearer ${tokenRef.current}` } : {},
      });
      if (res.ok) {
        const d = await res.json();
        // Use Raw setters to avoid marking dirty — these are server values
        setShopNameRaw(d.shopName || '');
        setAddressRaw(d.shopAddress || '');
        setEmailRaw(d.shopEmail || '');
        setPhoneRaw(d.shopPhone || '');
        setSignatoryRaw(d.authorizedSignatory || '');
        setGstNumberRaw(d.gstNumber || '');
        setGstEnabledRaw(d.enableGst ?? false);
        setGstFullModeRaw(d.gstFullMode ?? false);
        setGstSimpleModeRaw(d.gstSimpleMode ?? false);
        setGstRateRaw(d.gstRate ?? 18);
        setGstStateRaw(d.gstState || '');
        setDeliveryChargeRaw(d.deliveryCharge ?? 0);
        setEnableDeliveryRaw(d.enableDelivery ?? false);
        setAutoRotateRaw(d.autoRotate ?? false);
        try { localStorage.setItem('fp_auto_rotate', String(d.autoRotate ?? false)); } catch {}
        setBillAutoGenerateRaw(d.billAutoGenerate ?? false);
        setBillPrefixRaw(d.billPrefix || '');
        setBillStartNumberRaw(d.billStartNumber ?? 1);
        setBillCurrentNumberRaw(d.billCurrentNumber ?? 0);
        // Store full settings for thermal merge
        setDbSettings(d);
        setLoadError(false);
        // Mark as fetched and clear dirty flag after successful load
        hasFetchedOnce.current = true;
        isDirtyRef.current = false;
      } else {
        const errData = await res.json().catch(() => null);
        if (!silent) notify({ type: 'error', title: 'Error', message: errData?.error || `Failed to load settings` });
        setLoadError(true);
      }
    } catch {
      if (!silent) notify({ type: 'error', title: 'Error', message: 'Failed to load settings' });
    }
    finally { setLoading(false); }
  }, []); // No token dependency — uses tokenRef

  // Track DB settings for thermal merging
  const [dbSettings, setDbSettings] = useState<Record<string, unknown> | null>(null);

  // Load thermal from localStorage (initial fast load)
  useEffect(() => {
    try {
      const raw = localStorage.getItem('fp_thermal_settings');
      if (raw) setThermal({ ...DEFAULT_THERMAL, ...JSON.parse(raw) });
    } catch { /* use defaults */ }
  }, []);

  // Merge thermal settings from DB — DB is the source of truth for cross-device sync
  useEffect(() => {
    if (!dbSettings) return;
    // Always use DB values as the authoritative source
    setThermal(prev => ({
      ...prev,
      paperWidth: (dbSettings.thermalPaperWidth || prev.paperWidth) as '58mm' | '80mm',
      fontSize: (typeof dbSettings.thermalFontSize === 'number' ? dbSettings.thermalFontSize : prev.fontSize) as number,
      lineHeight: (typeof dbSettings.thermalLineHeight === 'number' ? dbSettings.thermalLineHeight : prev.lineHeight) as number,
      textWeight: (dbSettings.thermalTextWeight || prev.textWeight) as ThermalPrinterSettings['textWeight'],
      printDpi: (dbSettings.thermalDpi ?? prev.printDpi) as number,
      printQuality: (dbSettings.thermalPrintQuality || prev.printQuality) as ThermalPrinterSettings['printQuality'],
      dithering: (dbSettings.thermalDithering || prev.dithering) as ThermalPrinterSettings['dithering'],
      showLogo: (dbSettings.thermalShowLogo ?? prev.showLogo) as boolean,
      logo: (dbSettings.thermalLogo || prev.logo) as string,
    }));
    // Sync DB values to localStorage for offline access
    try {
      const synced = {
        paperWidth: dbSettings.thermalPaperWidth || '80mm',
        fontSize: typeof dbSettings.thermalFontSize === 'number' ? dbSettings.thermalFontSize : 12,
        lineHeight: typeof dbSettings.thermalLineHeight === 'number' ? dbSettings.thermalLineHeight : 1.4,
        textWeight: dbSettings.thermalTextWeight || 'Normal',
        printDpi: dbSettings.thermalDpi ?? 203,
        printQuality: dbSettings.thermalPrintQuality || 'Dark',
        dithering: dbSettings.thermalDithering || 'None',
        showLogo: dbSettings.thermalShowLogo ?? false,
        logo: dbSettings.thermalLogo || '',
      };
      localStorage.setItem('fp_thermal_settings', JSON.stringify(synced));
    } catch { /* ignore */ }
  }, [dbSettings]);

  // Initial fetch only — NOT dependent on fetchSettings to avoid re-fetch loops
  // when token changes (e.g., from AuthProvider rolling refresh)
  useEffect(() => {
    if (!hasFetchedOnce.current) {
      fetchSettings();
    }
  }, [fetchSettings]);

  // Re-fetch on dataVersion change ONLY if user has no unsaved changes
  // This prevents the sync mechanism from overwriting user input in Settings
  const prevDataVersion = useRef(dataVersion);
  useEffect(() => {
    if (dataVersion !== undefined && dataVersion !== prevDataVersion.current && !isDirtyRef.current) {
      prevDataVersion.current = dataVersion;
      fetchSettings(true);  // silent=true for background sync
    } else if (dataVersion !== undefined && dataVersion !== prevDataVersion.current) {
      // Still update the ref even if we skip the fetch, so we don't accumulate stale refs
      prevDataVersion.current = dataVersion;
    }
  }, [dataVersion, fetchSettings]);

  // API save helper
  const saveApi = async (section: string, data: Record<string, unknown>) => {
    setSavingSection(section);
    setSavedSection(null);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (tokenRef.current) headers['Authorization'] = `Bearer ${tokenRef.current}`;
      const res = await fetch('/api/settings', {
        method: 'PUT', headers,
        body: JSON.stringify({ section, ...data }),
      });
      if (res.ok) {
        notify({ type: 'success', title: 'Saved', message: `${section} settings saved` });
        setSavedSection(section);
        // Clear dirty flag after successful save — data is now synced with server
        isDirtyRef.current = false;
        saveTimer.current = setTimeout(() => setSavedSection(null), 3000);
      } else {
        const errData = await res.json().catch(() => ({}));
        notify({ type: 'error', title: 'Error', message: `Failed to save ${section} settings — ${errData.error || `Status ${res.status}`}` });
      }
    } catch { notify({ type: 'error', title: 'Error', message: `Failed to save ${section} settings — Network error` }); }
    finally { setSavingSection(null); }
  };

  const patch = (p: Partial<ThermalPrinterSettings>) => setThermal((prev) => {
    const updated = { ...prev, ...p };
    // Save to localStorage for fast local persistence
    try { localStorage.setItem('fp_thermal_settings', JSON.stringify(updated)); } catch { /* ignore */ }
    // Also sync to database so settings persist across devices
    // CRITICAL FIX: Only sync to DB after settings have been loaded from server.
    // Without this guard, a thermal patch could create a Settings row with only
    // thermal fields, causing shopName to fall back to Prisma default.
    if (tokenRef.current && dbSettings) {
      fetch('/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenRef.current}`,
        },
        body: JSON.stringify({
          section: 'thermal',
          thermalPaperWidth: updated.paperWidth,
          thermalFontSize: updated.fontSize,
          thermalLineHeight: updated.lineHeight,
          thermalTextWeight: updated.textWeight,
          thermalDpi: updated.printDpi,
          thermalPrintQuality: updated.printQuality,
          thermalDithering: updated.dithering,
          thermalShowLogo: updated.showLogo,
          thermalLogo: updated.logo,
        }),
      }).catch(() => { /* background sync, ignore errors */ });
    }
    return updated;
  });

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}><CardHeader><Skeleton className="h-6 w-48" /><Skeleton className="h-4 w-72" /></CardHeader>
            <div className="px-6 pb-6 space-y-4"><Skeleton className="h-9 w-full" /><Skeleton className="h-9 w-full" /></div>
          </Card>
        ))}
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-red-100 dark:bg-red-950/30">
          <AlertCircle className="size-8 text-red-500" />
        </div>
        <div className="text-center">
          <h3 className="text-lg font-semibold text-foreground">Failed to Load Settings</h3>
          <p className="text-sm text-muted-foreground mt-1">There was an error loading your settings. Please try again.</p>
        </div>
        <Button onClick={() => fetchSettings()} className="gap-2">
          <RefreshCw className="size-4" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      {isReadOnly && <ReadOnlyBanner module="Settings" noAccess={noAccess} />}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 p-5 md:p-6 text-white shadow-lg shadow-green-600/20">
        <div className="pointer-events-none absolute -right-8 -top-8 size-36 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-6 -left-6 size-28 rounded-full bg-white/5" />
        <div className="relative z-10">
          <h2 className="text-xl md:text-2xl font-bold tracking-tight flex items-center gap-2"><Settings className="size-6" />Settings</h2>
          <p className="text-green-100 text-sm mt-1">Configure your business preferences and printer settings</p>
        </div>
      </div>

      {/* ═══ Business Information ═══ */}
      <Section id="business" icon={<Store className="h-5 w-5" />} title="Business Information" desc="Your shop details and contact information" badge={<SavedBadge section="business" saved={savedSection} />}>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 border-l-2 border-l-green-400 pl-3">
            <div className="grid gap-2"><Label htmlFor="shop-name">Shop Name</Label>
              <Input id="shop-name" placeholder="Enter shop name" value={shopName} onChange={(e) => setShopName(e.target.value)} className={INPUT_CLS} /></div>
            <div className="grid gap-2"><Label htmlFor="auth-sig">Authorized Signatory</Label>
              <Input id="auth-sig" placeholder="Full name" value={signatory} onChange={(e) => setSignatory(e.target.value)} className={INPUT_CLS} /></div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 border-l-2 border-l-green-400 pl-3">
            <div className="grid gap-2"><Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="shop@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className={INPUT_CLS} /></div>
            <div className="grid gap-2"><Label htmlFor="phone">Phone Number</Label>
              <Input id="phone" type="tel" placeholder="+91 98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} className={INPUT_CLS} /></div>
          </div>
          <div className="grid gap-2 border-l-2 border-l-green-400 pl-3">
            <Label htmlFor="address">Address</Label>
            <Textarea id="address" placeholder="Full shop address" value={address} onChange={(e) => setAddress(e.target.value)} rows={3} className={INPUT_CLS} />
          </div>
          <SaveBtn section="business" label="Save Business Info" onClick={() => saveApi('business', { shopName, shopAddress: address, shopEmail: email, shopPhone: phone, authorizedSignatory: signatory })} saving={savingSection} saved={savedSection} disabled={!canEdit} />
        </div>
      </Section>

      {/* ═══ Feature Management ═══ */}
      <Divider icon={<Zap className="size-3" />} label="Modules" />
      <Section id="features" icon={<Zap className="h-5 w-5" />} title="Feature & Module Management" desc="Enable or disable category-specific features for your business">
        <div className="space-y-4">
          {/* Category badge */}
          {featureState.category && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border">
              <Zap className="size-4 text-amber-500" />
              <span className="text-sm font-medium">Business Category:</span>
              <Badge className="bg-amber-100 text-amber-700 border-amber-200">{getCategoryLabel(featureState.category)}</Badge>
            </div>
          )}

          {featureState.loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : Object.keys(featureState.grouped).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Zap className="size-8 mb-2 opacity-40" />
              <p className="text-sm">No features configured for your business</p>
              <p className="text-xs mt-1">Contact your super admin to set up category features</p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(featureState.grouped).map(([module, features]) => (
                <div key={module} className="space-y-2">
                  <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <Badge variant="outline" className={MODULE_COLORS[module] || 'text-gray-600'}>{module}</Badge>
                    <span>{features.length} feature{features.length !== 1 ? 's' : ''}</span>
                  </h4>
                  <div className="grid gap-2">
                    {features.map((feature) => (
                      <div key={feature.id} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
                        <div className="flex-1 min-w-0 mr-3">
                          <p className="text-sm font-medium">{feature.label}</p>
                          {feature.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">{feature.description}</p>
                          )}
                        </div>
                        <Switch
                          checked={feature.enabled}
                          onCheckedChange={(enabled) => handleToggleFeature(feature.id, enabled)}
                          disabled={currentUser?.role !== 'Admin'}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Section>

      {/* ═══ App Settings ═══ */}
      <Divider icon={<Smartphone className="size-3" />} label="App" />

      {/* ═══ Auto Rotate ═══ */}
      <Section id="auto-rotate" icon={<RotateCw className="h-5 w-5" />} title="Auto Rotate" desc="Control screen auto-rotation on mobile devices" badge={<SavedBadge section="autoRotate" saved={savedSection} />}>
        <div className="space-y-4">
          <div className="flex items-center justify-between border-l-2 border-l-green-400 pl-3">
            <div className="flex items-start gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-green-100 text-green-600 shrink-0 mt-0.5">
                <Smartphone className="size-4" />
              </div>
              <div>
                <Label className="text-sm font-medium">Auto Rotate</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Enable screen auto-rotation while using the app on mobile. When off, the screen stays in portrait mode.
                </p>
              </div>
            </div>
            <Switch
              checked={autoRotate}
              onCheckedChange={setAutoRotate}
            />
          </div>
          <div className={`rounded-lg border-2 p-3 transition-all duration-200 ${
            autoRotate
              ? 'border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20'
              : 'border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20'
          }`}>
            <div className="flex items-center gap-2">
              <RotateCw className={`size-4 ${autoRotate ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`} />
              <p className="text-xs font-medium">
                {autoRotate
                  ? 'Screen will rotate automatically based on device orientation'
                  : 'Portrait mode preferred — screen stays upright'}
              </p>
            </div>
          </div>
          <SaveBtn section="autoRotate" label="Save Rotation Setting" onClick={() => { saveApi('autoRotate', { autoRotate }); try { localStorage.setItem('fp_auto_rotate', String(autoRotate)); } catch {} }} saving={savingSection} saved={savedSection} disabled={!canEdit} />
        </div>
      </Section>

      {/* ═══ Billing Configuration ═══ */}
      <Divider icon={<FileText className="size-3" />} label="Billing" />

      {/* GST */}
      <Section id="gst" icon={<FileText className="h-5 w-5" />} title="GST & Tax Configuration" desc="Configure GST modes, rates, and tax invoice settings" badge={<SavedBadge section="gst" saved={savedSection} />}>
        <div className="space-y-4">
          {/* ── Mode Selector ── */}
          <div className="grid gap-3 sm:grid-cols-2">
            {/* Full Mode Card */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => { setGstFullMode(!gstFullMode); if (!gstFullMode) setGstSimpleMode(false); if (!gstFullMode) setGstEnabled(true); }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setGstFullMode(!gstFullMode); if (!gstFullMode) setGstSimpleMode(false); if (!gstFullMode) setGstEnabled(true); } }}
              className={`relative text-left rounded-xl border-2 p-4 transition-all duration-200 cursor-pointer ${
                gstFullMode
                  ? 'border-green-400 bg-green-50/60 dark:border-green-600 dark:bg-green-950/30 shadow-md shadow-green-600/10'
                  : 'border-muted-foreground/20 hover:border-green-200 bg-muted/20'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className={`flex size-8 items-center justify-center rounded-lg ${gstFullMode ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'}`}>
                    <FileText className="size-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">GST Details (Full Mode)</p>
                    <p className="text-[11px] text-muted-foreground">Tax Invoice with GSTIN</p>
                  </div>
                </div>
                <Switch checked={gstFullMode} onCheckedChange={(v) => { setGstFullMode(v); if (v) { setGstSimpleMode(false); setGstEnabled(true); } }} />
              </div>
              {gstFullMode && (
                <div className="mt-2 flex flex-wrap gap-1">
                  <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px]">GSTIN on Invoice</Badge>
                  <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px]">Business Address</Badge>
                  <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px]">State</Badge>
                </div>
              )}
            </div>

            {/* Simple Mode Card */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => { setGstSimpleMode(!gstSimpleMode); if (!gstSimpleMode) setGstFullMode(false); if (!gstSimpleMode) setGstEnabled(true); }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setGstSimpleMode(!gstSimpleMode); if (!gstSimpleMode) setGstFullMode(false); if (!gstSimpleMode) setGstEnabled(true); } }}
              className={`relative text-left rounded-xl border-2 p-4 transition-all duration-200 cursor-pointer ${
                gstSimpleMode
                  ? 'border-amber-400 bg-amber-50/60 dark:border-amber-600 dark:bg-amber-950/30 shadow-md shadow-amber-600/10'
                  : 'border-muted-foreground/20 hover:border-amber-200 bg-muted/20'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className={`flex size-8 items-center justify-center rounded-lg ${gstSimpleMode ? 'bg-amber-500 text-white' : 'bg-muted text-muted-foreground'}`}>
                    <Receipt className="size-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">GST Only (Simple Mode)</p>
                    <p className="text-[11px] text-muted-foreground">GST amount only, no details</p>
                  </div>
                </div>
                <Switch checked={gstSimpleMode} onCheckedChange={(v) => { setGstSimpleMode(v); if (v) { setGstFullMode(false); setGstEnabled(true); } }} />
              </div>
              {gstSimpleMode && (
                <div className="mt-2 flex flex-wrap gap-1">
                  <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px]">GST Amount Shown</Badge>
                  <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px]">No GSTIN</Badge>
                  <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px]">No Address</Badge>
                </div>
              )}
            </div>
          </div>

          {/* Info Banner when neither mode selected */}
          {!gstFullMode && !gstSimpleMode && (
            <div className="rounded-lg bg-gray-50 dark:bg-gray-900/30 border border-dashed border-muted-foreground/25 p-3 text-center">
              <p className="text-xs text-muted-foreground">⚠️ No GST mode selected — GST will not be applied to invoices</p>
            </div>
          )}

          {/* ── GST Rate (shared by both modes) ── */}
          {(gstFullMode || gstSimpleMode) && (
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">GST Rate</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="gst-rate">GST Rate (%)</Label>
                  <Input id="gst-rate" type="number" min="0" max="100" step="0.5" value={gstRate} onChange={(e) => setGstRate(parseFloat(e.target.value) || 0)} className={INPUT_CLS} />
                </div>
                <div className="flex items-end">
                  <div className="rounded-lg border bg-white dark:bg-gray-900 p-3 w-full">
                    <p className="text-xs text-muted-foreground mb-1">Tax Split (CGST + SGST)</p>
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <span className="text-green-600">CGST: {(gstRate / 2).toFixed(1)}%</span>
                      <span className="text-muted-foreground">+</span>
                      <span className="text-green-600">SGST: {(gstRate / 2).toFixed(1)}%</span>
                      <span className="text-muted-foreground">=</span>
                      <span className="font-bold text-green-700">{gstRate}%</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {[5, 12, 18, 28].map((rate) => (
                  <button key={rate} type="button" onClick={() => setGstRate(rate)}
                    className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-all ${
                      gstRate === rate
                        ? 'bg-green-600 text-white border-green-600'
                        : 'border-muted-foreground/20 text-muted-foreground hover:border-green-300 hover:bg-green-50'
                    }`}
                  >{rate}%</button>
                ))}
              </div>
            </div>
          )}

          {/* ── Full Mode: GST Details Fields ── */}
          {gstFullMode && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-green-600 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="size-3" />Full Mode — GST Invoice Details
              </p>
              <p className="text-[11px] text-muted-foreground -mt-2">These details will appear on every tax invoice when Full Mode is active</p>

              {/* GST Number */}
              <div className={`rounded-xl border-2 p-4 transition-all duration-200 ${gstNumber ? 'border-green-300 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20' : 'border-dashed border-muted-foreground/30 hover:border-green-300 bg-muted/20'}`}>
                <div className="flex items-center justify-between mb-2">
                  <Label htmlFor="gst-number" className="text-sm font-semibold">GST Number (GSTIN)</Label>
                  {gstNumber && gstNumber.length === 15 && <Badge className="bg-green-100 text-green-700 border-green-200 gap-1 text-[10px]"><Check className="size-3" />Valid</Badge>}
                </div>
                <div className="flex gap-2">
                  <Input id="gst-number" placeholder="e.g. 22AAAAA0000A1Z5" value={gstNumber}
                    onChange={(e) => { const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); setGstNumber(val); }}
                    maxLength={15} className={`flex-1 font-mono tracking-wider text-sm ${INPUT_CLS}`} />
                  {gstNumber && (
                    <Button variant="outline" size="sm" onClick={() => { setGstNumber(''); notify({ type: 'info', title: 'Cleared', message: 'GST number cleared' }); }} className="text-xs shrink-0 gap-1"><X className="size-3" />Clear</Button>
                  )}
                </div>
                {gstNumber.length > 0 && gstNumber.length < 15 && (
                  <p className="text-xs text-amber-600 mt-2 flex items-center gap-1"><AlertTriangle className="size-3" />{gstNumber.length}/15 digits — {15 - gstNumber.length} more needed</p>
                )}
              </div>

              {/* State */}
              <div className="grid gap-2">
                <Label htmlFor="gst-state" className="text-sm font-medium">State</Label>
                <Input id="gst-state" placeholder="e.g. Maharashtra" value={gstState}
                  onChange={(e) => setGstState(e.target.value)} className={INPUT_CLS} />
                <p className="text-[11px] text-muted-foreground">Required for inter-state and intra-state GST classification</p>
              </div>

              {/* Info: Uses existing business info */}
              <div className="rounded-lg border border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20 p-3">
                <p className="text-xs font-medium text-green-700 dark:text-green-400 mb-1">ℹ️ Business Details on Invoice</p>
                <p className="text-[11px] text-green-600 dark:text-green-500">
                  Full Mode uses your <strong>Business Name</strong>, <strong>Address</strong>, and <strong>Phone</strong> from the Business Information section above. Make sure those are filled correctly.
                </p>
              </div>
            </div>
          )}

          {/* ── Simple Mode Info ── */}
          {gstSimpleMode && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20 p-4">
              <div className="flex items-start gap-3">
                <div className="flex size-8 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/50 shrink-0 mt-0.5">
                  <Receipt className="size-4 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">Simple Mode Active</p>
                  <p className="text-[11px] text-amber-600 dark:text-amber-500 mt-1">
                    Only GST percentage and amount will be shown on invoices. <strong>No GSTIN, address, state, or business details</strong> will be displayed. Suitable for businesses that don't need a formal tax invoice.
                  </p>
                </div>
              </div>
            </div>
          )}

          <SaveBtn
            section="gst"
            label="Save GST Settings"
            onClick={() => {
              // Mutually exclusive: full mode overrides simple mode
              const effectiveEnabled = gstFullMode || gstSimpleMode;
              saveApi('gst', {
                enableGst: effectiveEnabled,
                gstFullMode,
                gstSimpleMode,
                gstRate,
                gstNumber,
                gstState,
              });
            }}
            saving={savingSection}
            saved={savedSection}
            disabled={!canEdit}
          />
        </div>
      </Section>

      {/* Delivery */}
      <Section id="delivery" icon={<Receipt className="h-5 w-5" />} title="Delivery Charge" desc="Enable or disable delivery charge and set the default amount" badge={<SavedBadge section="delivery" saved={savedSection} />}>
        <div className="space-y-4">
          {/* Enable/Disable Toggle */}
          <div className="flex items-center justify-between border-l-2 border-l-green-400 pl-3">
            <div>
              <Label className="text-sm font-medium">Enable Delivery Charge</Label>
              <p className="text-xs text-muted-foreground">Show delivery charge option on the Bill Generate page</p>
            </div>
            <Switch
              checked={enableDelivery}
              onCheckedChange={setEnableDelivery}
            />
          </div>

          {enableDelivery && (
            <div className="grid gap-2 sm:max-w-xs border-l-2 border-l-green-400 pl-3">
              <Label htmlFor="delivery-amount">Default Delivery Charge (₹)</Label>
              <Input id="delivery-amount" type="number" min="0" step="1" value={deliveryCharge} onChange={(e) => setDeliveryCharge(parseFloat(e.target.value) || 0)} className={INPUT_CLS} />
              <p className="text-xs text-muted-foreground">Set to 0 for free delivery</p>
            </div>
          )}
          <SaveBtn section="delivery" label="Save Delivery Charge" onClick={() => saveApi('delivery', { enableDelivery, deliveryCharge })} saving={savingSection} saved={savedSection} disabled={!canEdit} />
        </div>
      </Section>

      {/* ═══ Bill Number Generator ═══ */}
      <Divider icon={<Receipt className="size-3" />} label="Billing" />

      <Section id="bill-number" icon={<FileText className="h-5 w-5" />} title="Bill Number Generator" desc="Auto-generate sequential bill numbers with optional prefix" badge={<SavedBadge section="billNumber" saved={savedSection} />}>
        <div className="space-y-5">
          {/* Toggle */}
          <div className="flex items-center justify-between border-l-2 border-l-green-400 pl-3">
            <div>
              <Label className="text-sm font-medium">Auto-Generate Bill Numbers</Label>
              <p className="text-xs text-muted-foreground">Automatically generate sequential numbers for new bills</p>
            </div>
            <Switch
              checked={billAutoGenerate}
              onCheckedChange={setBillAutoGenerate}
            />
          </div>

          {billAutoGenerate && (
            <div className="space-y-4">
              {/* Prefix */}
              <div className="grid gap-2 sm:max-w-xs border-l-2 border-l-green-400 pl-3">
                <Label htmlFor="bill-prefix">Bill Number Prefix (optional)</Label>
                <Input
                  id="bill-prefix"
                  placeholder="e.g. A, B, INV, FP"
                  value={billPrefix}
                  onChange={(e) => {
                    // Only allow English letters
                    const val = e.target.value.replace(/[^a-zA-Z]/g, '');
                    setBillPrefix(val.toUpperCase());
                  }}
                  maxLength={6}
                  className={INPUT_CLS}
                />
                <p className="text-xs text-muted-foreground">English letters only. Leave empty for no prefix.</p>
              </div>

              {/* Start Number */}
              <div className="grid gap-2 sm:max-w-xs border-l-2 border-l-green-400 pl-3">
                <Label htmlFor="bill-start-number">Starting Number</Label>
                <Input
                  id="bill-start-number"
                  type="number"
                  min={1}
                  max={9999}
                  value={billStartNumber}
                  onChange={(e) => setBillStartNumber(Math.max(1, parseInt(e.target.value) || 1))}
                  className={INPUT_CLS}
                />
                <p className="text-xs text-muted-foreground">Bills will start from this number</p>
              </div>

              {/* Preview */}
              <div className="rounded-lg border bg-muted/30 p-4">
                <p className="text-xs text-muted-foreground mb-2">Preview of bill number format:</p>
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                    {billPrefix}{String(billCurrentNumber === 0 ? billStartNumber : billCurrentNumber + 1).padStart(4, '0')}
                  </span>
                  <span className="text-xs text-muted-foreground">→ next bill</span>
                </div>
                <div className="flex gap-2 mt-2">
                  <span className="text-xs font-mono bg-muted px-2 py-1 rounded">{billPrefix}{String(billCurrentNumber === 0 ? billStartNumber : billCurrentNumber + 1).padStart(4, '0')}</span>
                  <span className="text-xs font-mono bg-muted px-2 py-1 rounded">{billPrefix}{String(billCurrentNumber === 0 ? billStartNumber + 1 : billCurrentNumber + 2).padStart(4, '0')}</span>
                  <span className="text-xs font-mono bg-muted px-2 py-1 rounded">{billPrefix}{String(billCurrentNumber === 0 ? billStartNumber + 2 : billCurrentNumber + 3).padStart(4, '0')}</span>
                </div>
              </div>

              {/* Current Counter Info */}
              {billCurrentNumber > 0 && (
                <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <FileText className="size-3" />
                    <span>Last generated bill number: <strong className="font-mono">{billPrefix}{String(billCurrentNumber).padStart(4, '0')}</strong></span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                    onClick={() => {
                      if (confirm('Reset bill counter to 0? The next bill will start from the start number.')) {
                        setBillCurrentNumberRaw(0);
                        saveApi('billNumber', { billCurrentNumber: 0 });
                      }
                    }}
                    disabled={!canEdit}
                  >
                    Reset Counter
                  </Button>
                </div>
              )}
            </div>
          )}

          <SaveBtn section="billNumber" label="Save Bill Number Settings" onClick={() => saveApi('billNumber', { billAutoGenerate, billPrefix, billStartNumber })} saving={savingSection} saved={savedSection} disabled={!canEdit} />
        </div>
      </Section>

      {/* ═══ Thermal Printer Settings ═══ */}
      <Divider icon={<Printer className="size-3" />} label="Printing" />

      <Section id="printer" icon={<Printer className="h-5 w-5" />} title="Thermal Printer Settings" desc="Configure receipt printing — settings apply to all bill prints & reprints" open={true}
        badge={thermalSaved ? <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px] gap-0.5"><Check className="size-3" />Saved</Badge> : undefined}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-5">
            {/* ── Text Settings Card ── */}
            <div className="rounded-xl border bg-card p-4 space-y-4">
              <h4 className="text-sm font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                <Printer className="size-4" />Text Settings
              </h4>

              {/* Font Size Slider */}
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Font Size</Label>
                  <Badge variant="outline" className="font-mono text-xs">{thermal.fontSize}px</Badge>
                </div>
                <input
                  type="range" min="8" max="18" step="1" value={thermal.fontSize}
                  onChange={(e) => patch({ fontSize: parseInt(e.target.value) })}
                  className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-emerald-600 bg-muted"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground"><span>8px</span><span>18px</span></div>
              </div>

              {/* Line Height Slider */}
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Line Height</Label>
                  <Badge variant="outline" className="font-mono text-xs">{thermal.lineHeight.toFixed(1)}x</Badge>
                </div>
                <input
                  type="range" min="1.0" max="2.0" step="0.1" value={thermal.lineHeight}
                  onChange={(e) => patch({ lineHeight: parseFloat(e.target.value) })}
                  className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-emerald-600 bg-muted"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground"><span>1.0</span><span>2.0</span></div>
              </div>

              {/* Text Weight */}
              <div className="grid gap-2">
                <Label className="text-sm">Text Weight</Label>
                <div className="flex gap-3">
                  {(['Light', 'Normal', 'Bold'] as const).map((w) => (
                    <label key={w} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer transition-all text-sm ${
                      thermal.textWeight === w ? 'bg-emerald-600 text-white border-emerald-600 font-semibold' : 'border-muted hover:bg-muted/50'
                    }`}>
                      <input
                        type="radio" name="textWeight" value={w}
                        checked={thermal.textWeight === w}
                        onChange={() => patch({ textWeight: w })}
                        className="sr-only"
                      />
                      {w}
                    </label>
                  ))}
                </div>
              </div>

              {/* DPI Resolution */}
              <div className="grid gap-2">
                <Label className="text-sm">DPI Resolution</Label>
                <div className="flex gap-3">
                  {([203, 300] as const).map((dpi) => (
                    <label key={dpi} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer transition-all text-sm ${
                      thermal.printDpi === dpi ? 'bg-emerald-600 text-white border-emerald-600 font-semibold' : 'border-muted hover:bg-muted/50'
                    }`}>
                      <input
                        type="radio" name="dpi" value={dpi}
                        checked={thermal.printDpi === dpi}
                        onChange={() => patch({ printDpi: dpi })}
                        className="sr-only"
                      />
                      {dpi} DPI{dpi === 300 ? ' (High)' : ''}
                    </label>
                  ))}
                </div>
              </div>

              {/* Paper Width */}
              <div className="grid gap-2">
                <Label className="text-sm">Paper Width</Label>
                <div className="flex gap-3">
                  {(['58mm', '80mm'] as const).map((pw) => (
                    <label key={pw} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer transition-all text-sm ${
                      thermal.paperWidth === pw ? 'bg-emerald-600 text-white border-emerald-600 font-semibold' : 'border-muted hover:bg-muted/50'
                    }`}>
                      <input
                        type="radio" name="paperWidth" value={pw}
                        checked={thermal.paperWidth === pw}
                        onChange={() => patch({ paperWidth: pw })}
                        className="sr-only"
                      />
                      {pw}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Squeeze Print Card ── */}
            <div className="rounded-xl border bg-card p-4 space-y-4">
              <h4 className="text-sm font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                <Printer className="size-4" />Squeeze Print
              </h4>

              {/* Print Quality */}
              <div className="grid gap-2">
                <Label className="text-sm">Print Quality</Label>
                <div className="flex gap-3">
                  {(['Dark', 'Light'] as const).map((q) => (
                    <label key={q} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer transition-all text-sm ${
                      thermal.printQuality === q ? 'bg-emerald-600 text-white border-emerald-600 font-semibold' : 'border-muted hover:bg-muted/50'
                    }`}>
                      <input
                        type="radio" name="printQuality" value={q}
                        checked={thermal.printQuality === q}
                        onChange={() => patch({ printQuality: q })}
                        className="sr-only"
                      />
                      {q}
                    </label>
                  ))}
                </div>
              </div>

              {/* Dithering */}
              <div className="grid gap-2">
                <Label className="text-sm">Dithering</Label>
                <div className="flex flex-col gap-2">
                  {(['None', 'Black & White', 'Floyd Steinberg'] as const).map((d) => (
                    <label key={d} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all text-sm ${
                      thermal.dithering === d ? 'bg-emerald-600 text-white border-emerald-600 font-semibold' : 'border-muted hover:bg-muted/50'
                    }`}>
                      <input
                        type="radio" name="dithering" value={d}
                        checked={thermal.dithering === d}
                        onChange={() => patch({ dithering: d })}
                        className="sr-only"
                      />
                      {d}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Logo Section ── */}
            <div className="rounded-xl border bg-card p-4 space-y-3">
              <h4 className="text-sm font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                <ImageIcon className="size-4" />Receipt Logo
              </h4>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">Show Logo on Receipt</p>
                  <p className="text-[11px] text-muted-foreground">Logo displays at top with full width</p>
                </div>
                <Switch
                  checked={thermal.showLogo}
                  onCheckedChange={(checked) => patch({ showLogo: checked })}
                  aria-label="Toggle receipt logo"
                />
              </div>
              {thermal.showLogo && (
                <div className="space-y-3">
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 200 * 1024) {
                        notify({ type: 'error', title: 'Error', message: 'Logo too large — Maximum 200KB' });
                        if (logoInputRef.current) logoInputRef.current.value = '';
                        return;
                      }
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        const img = new Image();
                        img.onload = () => {
                          const canvas = document.createElement('canvas');
                          const MAX_W = 280, MAX_H = 80;
                          let w = img.width, h = img.height;
                          if (w > MAX_W) { h = (h * MAX_W) / w; w = MAX_W; }
                          if (h > MAX_H) { w = (w * MAX_H) / h; h = MAX_H; }
                          canvas.width = w; canvas.height = h;
                          canvas.getContext('2d')?.drawImage(img, 0, 0, w, h);
                          patch({ logo: canvas.toDataURL('image/png', 0.7) });
                          notify({ type: 'success', title: 'Uploaded', message: 'Logo uploaded' });
                        };
                        img.src = ev.target?.result as string;
                      };
                      reader.readAsDataURL(file);
                    }}
                  />
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => logoInputRef.current?.click()} className="gap-1.5">
                      <Upload className="size-3.5" />{thermal.logo ? 'Change' : 'Upload'}
                    </Button>
                    {thermal.logo && (
                      <Button variant="ghost" size="sm" onClick={() => { patch({ logo: '' }); notify({ type: 'info', title: 'Removed', message: 'Logo removed' }); }}
                        className="gap-1.5 text-red-500 hover:text-red-600 hover:bg-red-50">
                        <Trash2 className="size-3.5" />Remove
                      </Button>
                    )}
                  </div>
                  {thermal.logo && (
                    <div className="flex justify-center rounded-lg border border-dashed bg-white p-2">
                      <img src={thermal.logo} alt="Logo" className="w-full max-w-[260px] max-h-[60px] object-contain" />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Save / Reset */}
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end pt-2">
              <Button variant="outline" onClick={() => { setThermal(DEFAULT_THERMAL); notify({ type: 'info', title: 'Reset', message: 'Thermal settings reset' }); }} className="gap-1.5">
                <RotateCcw className="h-4 w-4" />Reset
              </Button>
              <Button
                onClick={async () => {
                  try {
                    setSavingSection('thermal');
                    const thermalHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
                    if (tokenRef.current) thermalHeaders['Authorization'] = `Bearer ${tokenRef.current}`;
                    const res = await fetch('/api/settings', {
                      method: 'PUT',
                      headers: thermalHeaders,
                      body: JSON.stringify({
                        section: 'thermal',
                        thermalPaperWidth: thermal.paperWidth,
                        thermalFontSize: thermal.fontSize,
                        thermalLineHeight: thermal.lineHeight,
                        thermalTextWeight: thermal.textWeight,
                        thermalDpi: thermal.printDpi,
                        thermalPrintQuality: thermal.printQuality,
                        thermalDithering: thermal.dithering,
                        thermalShowLogo: thermal.showLogo,
                        thermalLogo: thermal.logo,
                      }),
                    });
                    if (res.ok) {
                      localStorage.setItem('fp_thermal_settings', JSON.stringify(thermal));
                      setThermalSaved(true);
                      setSavedSection('thermal');
                      notify({ type: 'success', title: 'Saved', message: 'Thermal settings saved' });
                      setTimeout(() => { setThermalSaved(false); setSavedSection(null); }, 3000);
                    } else {
                      const err = await res.json().catch(() => ({}));
                      notify({ type: 'error', title: 'Error', message: `Failed to save — ${err.error || 'Unknown error'}` });
                    }
                  } catch { notify({ type: 'error', title: 'Error', message: 'Network error' }); }
                  finally { setSavingSection(null); }
                }}
                disabled={savingSection === 'thermal'}
                className={`gap-1.5 transition-all ${thermalSaved ? 'bg-green-500 hover:bg-green-600' : 'bg-green-600 hover:bg-green-700'} text-white`}>
                {savingSection === 'thermal' ? <><Loader2 className="h-4 w-4 animate-spin" />Saving...</>
                  : thermalSaved ? <><Check className="h-4 w-4" />Saved!</>
                  : <><Save className="h-4 w-4" />Save Settings</>}
              </Button>
            </div>
          </div>
          {/* Preview */}
          <div className="flex flex-col items-center">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Receipt className="size-3.5" />Live Receipt Preview
            </p>
            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-4 w-full flex justify-center">
              <ReceiptPreview shopName={shopName} shopAddress={address} shopPhone={phone} gstNumber={gstNumber} showGst={gstEnabled || gstFullMode || gstSimpleMode} t={thermal} />
            </div>
          </div>
        </div>
      </Section>

      {/* ═══ User Management ═══ */}
      {hasPermission('settings', 'userManagement') && (
        <>
          <Divider icon={<Users className="size-3" />} label="User Management" />
          <UserManagementSection />
        </>
      )}

      {/* ═══ Change Password ═══ */}
      <Divider icon={<Shield className="size-3" />} label="Account" />
      <ChangePasswordSection />

      {/* ═══ Data Management ═══ */}
      <Divider icon={<Database className="size-3" />} label="Data" />
      <div id="data-management">
        <Section id="data" icon={<Database className="h-5 w-5" />} title="Data Management" desc="Export, import, or reset all your business data" open={false}>
          <div className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-lg border p-4">
              <div><p className="text-sm font-medium flex items-center gap-2"><Download className="h-4 w-4 text-green-600" />Export All Data</p><p className="text-xs text-muted-foreground mt-0.5">Download a complete backup as JSON</p></div>
              <Button variant="outline" onClick={async () => { try { const r = await fetch('/api/data/export', { headers: tokenRef.current ? { 'Authorization': `Bearer ${tokenRef.current}` } : {} }); if (r.ok) { const b = new Blob([JSON.stringify(await r.json(), null, 2)], { type: 'application/json' }); const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = `eservices-data-${new Date().toISOString().split('T')[0]}.json`; a.click(); URL.revokeObjectURL(u); notify({ type: 'success', title: 'Exported', message: 'Data exported successfully' }); } else notify({ type: 'error', title: 'Error', message: 'Failed to export data' }); } catch { notify({ type: 'error', title: 'Error', message: 'Failed to export data' }); } }} className="w-full sm:w-auto gap-1.5"><Download className="h-4 w-4" />Export</Button>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-lg border p-4">
              <div><p className="text-sm font-medium flex items-center gap-2"><Upload className="h-4 w-4 text-green-600" />Import Data</p><p className="text-xs text-muted-foreground mt-0.5">Restore from a previously exported JSON file</p></div>
              <Button variant="outline" onClick={() => importRef.current?.click()} className="w-full sm:w-auto gap-1.5"><Upload className="h-4 w-4" />Import</Button>
              <input ref={importRef} type="file" accept=".json" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; try { const d = JSON.parse(await f.text()); const r = await fetch('/api/data/import', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(tokenRef.current ? { 'Authorization': `Bearer ${tokenRef.current}` } : {}) }, body: JSON.stringify(d) }); if (r.ok) { notify({ type: 'success', title: 'Imported', message: 'Data imported successfully' }); await fetchSettings(); } else notify({ type: 'error', title: 'Error', message: 'Failed to import data' }); } catch { notify({ type: 'error', title: 'Error', message: 'Invalid JSON file' }); } if (importRef.current) importRef.current.value = ''; }} className="hidden" />
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-red-200 dark:border-red-900/50 p-4">
              <div><p className="text-sm font-medium flex items-center gap-2 text-red-600 dark:text-red-400"><AlertTriangle className="h-4 w-4" />Reset System</p><p className="text-xs text-muted-foreground mt-0.5">Permanently delete all data — this cannot be undone</p></div>
              <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
                <AlertDialogTrigger asChild><Button variant="destructive" className="w-full sm:w-auto gap-1.5"><AlertTriangle className="h-4 w-4" />Reset</Button></AlertDialogTrigger>
                <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle>
                  <AlertDialogDescription>This will permanently delete all your business data, bills, items, and settings. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                  <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={async () => { setResetting(true); try { const r = await fetch('/api/data/reset', { method: 'POST' }); if (r.ok) { localStorage.removeItem('fp_thermal_settings'); setThermal(DEFAULT_THERMAL); notify({ type: 'success', title: 'Reset', message: 'System reset successfully' }); setResetOpen(false); await fetchSettings(); } else notify({ type: 'error', title: 'Error', message: 'Failed to reset system' }); } catch { notify({ type: 'error', title: 'Error', message: 'Failed to reset system' }); } finally { setResetting(false); } }} disabled={resetting} className="bg-destructive text-white hover:bg-destructive/90">
                      {resetting ? <><Loader2 className="h-4 w-4 animate-spin mr-1.5" />Resetting…</> : 'Yes, reset everything'}
                    </AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </Section>
      </div>

      {/* ═══ END ═══ */}
    </div>
  );
}
