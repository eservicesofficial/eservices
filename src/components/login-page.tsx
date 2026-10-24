'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Lock, Eye, EyeOff, Shield, Receipt, ArrowRight, Loader2,
  CheckCircle2, Keyboard, Sparkles, FileText, Printer,
  User, AlertCircle, Building2, Mail, KeyRound,
  Copy, Check, ShieldAlert, Clock, Phone, ArrowLeft,
  AlertTriangle, Timer, Hash, Ban, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { notify, useNotificationStore, dismissNotification } from '@/lib/notification-store';
import type { UserSession } from './auth-provider';

// ── Auto-dismiss Toast Popup for Login Page ──────────────────────────────────
// The login page doesn't have the NotificationCenter (it's in the TopBar).
// This component subscribes to the notification store and displays each new
// notification as a popup toast that auto-dismisses after 4 seconds.
function LoginToastContainer() {
  const notifications = useNotificationStore((s) => s.notifications);
  const [visibleToasts, setVisibleToasts] = useState<Array<{ id: string; type: string; title: string; message: string; fading: boolean }>>([]);
  // Track processed IDs with a Set so we never replay or duplicate a notification,
  // even when items are removed from the store (dismissNotification / clearAll).
  const processedIds = useRef<Set<string>>(new Set(notifications.map((n) => n.id)));

  useEffect(() => {
    // Find notifications we haven't shown yet
    const newNotifs = notifications.filter((n) => !processedIds.current.has(n.id));
    if (newNotifs.length === 0) return;

    // Mark them as processed
    for (const n of newNotifs) {
      processedIds.current.add(n.id);
    }

    const newToasts = newNotifs.map((n) => ({ id: n.id, type: n.type, title: n.title, message: n.message, fading: false }));
    setVisibleToasts((prev) => [...prev, ...newToasts]);

    // Auto-dismiss each toast after 4 seconds
    for (const n of newNotifs) {
      const id = n.id;
      setTimeout(() => {
        setVisibleToasts((prev) => prev.map((t) => t.id === id ? { ...t, fading: true } : t));
        setTimeout(() => {
          setVisibleToasts((prev) => prev.filter((t) => t.id !== id));
          dismissNotification(id);
        }, 300);
      }, 4000);
    }
  }, [notifications]);

  const iconMap: Record<string, React.ReactNode> = {
    success: <CheckCircle2 className="size-5 text-emerald-500 shrink-0" />,
    error: <AlertCircle className="size-5 text-red-500 shrink-0" />,
    warning: <AlertTriangle className="size-5 text-amber-500 shrink-0" />,
    info: <AlertCircle className="size-5 text-sky-500 shrink-0" />,
  };
  const borderMap: Record<string, string> = {
    success: 'border-l-emerald-500',
    error: 'border-l-red-500',
    warning: 'border-l-amber-500',
    info: 'border-l-sky-500',
  };
  const bgMap: Record<string, string> = {
    success: 'bg-emerald-50 dark:bg-emerald-950/30',
    error: 'bg-red-50 dark:bg-red-950/30',
    warning: 'bg-amber-50 dark:bg-amber-950/30',
    info: 'bg-sky-50 dark:bg-sky-950/30',
  };

  if (visibleToasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {visibleToasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border-l-4 ${borderMap[t.type] || borderMap.info} ${bgMap[t.type] || bgMap.info} shadow-lg shadow-black/10 backdrop-blur-sm transition-all duration-300 ${t.fading ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0'}`}
        >
          {iconMap[t.type] || iconMap.info}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">{t.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{t.message}</p>
          </div>
          <button onClick={() => { dismissNotification(t.id); setVisibleToasts((prev) => prev.filter((v) => v.id !== t.id)); }} className="text-muted-foreground hover:text-foreground shrink-0">
            <X className="size-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

interface LoginPageProps {
  onLoginSuccess: (token: string, user: UserSession) => void;
}

const PARTICLES = [
  { size: 4, color: '#34d399', opacity: 0.2, left: '6%', delay: '0s', duration: '16s' },
  { size: 6, color: '#2dd4bf', opacity: 0.15, left: '16%', delay: '-3s', duration: '20s' },
  { size: 3, color: '#4ade80', opacity: 0.25, left: '28%', delay: '-6s', duration: '14s' },
  { size: 8, color: '#a3e635', opacity: 0.1, left: '36%', delay: '-9s', duration: '22s' },
  { size: 5, color: '#34d399', opacity: 0.18, left: '48%', delay: '-2s', duration: '17s' },
  { size: 4, color: '#2dd4bf', opacity: 0.22, left: '58%', delay: '-11s', duration: '19s' },
  { size: 7, color: '#4ade80', opacity: 0.12, left: '68%', delay: '-5s', duration: '23s' },
  { size: 3, color: '#a3e635', opacity: 0.2, left: '78%', delay: '-8s', duration: '15s' },
  { size: 6, color: '#34d399', opacity: 0.14, left: '88%', delay: '-13s', duration: '21s' },
];

const FLOATING_ICONS = [
  { Icon: FileText, x: '10%', delay: '0s', duration: '20s', size: 22, opacity: 0.08 },
  { Icon: Receipt, x: '30%', delay: '-5s', duration: '24s', size: 26, opacity: 0.06 },
  { Icon: Printer, x: '55%', delay: '-10s', duration: '18s', size: 20, opacity: 0.07 },
  { Icon: FileText, x: '75%', delay: '-7s', duration: '22s', size: 24, opacity: 0.05 },
];

export default function LoginPage({ onLoginSuccess }: LoginPageProps) {
  // Business login fields
  const [clientId, setClientId] = useState('');
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Super admin login fields
  const [superEmail, setSuperEmail] = useState('');
  const [superPassword, setSuperPassword] = useState('');
  const [showSuperPassword, setShowSuperPassword] = useState(false);

  // Mode toggle
  const [isSuperAdminMode, setIsSuperAdminMode] = useState(false);

  // Forgot password state
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSecurityQuestion, setForgotSecurityQuestion] = useState('');
  const [forgotSecurityAnswer, setForgotSecurityAnswer] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  const [forgotStep, setForgotStep] = useState<'email' | 'answer' | 'reset'>('email');
  const [forgotLoading, setForgotLoading] = useState(false);

  // Forgot Login ID state
  const [showForgotLoginId, setShowForgotLoginId] = useState(false);
  const [forgotLoginIdStep, setForgotLoginIdStep] = useState<'answer' | 'result'>('answer');
  const [forgotLoginIdAnswer, setForgotLoginIdAnswer] = useState('');
  const [forgotLoginIdQuestion, setForgotLoginIdQuestion] = useState('');
  const [recoveredEmail, setRecoveredEmail] = useState('');
  const [recoveredName, setRecoveredName] = useState('');
  const [forgotLoginIdLoading, setForgotLoginIdLoading] = useState(false);
  const [emailCopied, setEmailCopied] = useState(false);

  // Subscription expiry state
  const [showExpiredScreen, setShowExpiredScreen] = useState(false);
  const [expiredClientInfo, setExpiredClientInfo] = useState<{ clientId: string; businessName: string; expiresAt: string | null } | null>(null);

  // Account suspended state (unit-level)
  const [showSuspendedScreen, setShowSuspendedScreen] = useState(false);
  const [suspendedClientInfo, setSuspendedClientInfo] = useState<{ clientId: string; businessName: string } | null>(null);

  // User suspended state (individual user deactivated)
  const [showUserSuspendedScreen, setShowUserSuspendedScreen] = useState(false);
  const [userSuspendedInfo, setUserSuspendedInfo] = useState<{ clientId: string; businessName: string; userName: string; userLoginId: string } | null>(null);

  // Force password change
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [pendingUser, setPendingUser] = useState<UserSession | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [changePasswordLoading, setChangePasswordLoading] = useState(false);

  // UI state
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [locked, setLocked] = useState(false);
  const [lockTimer, setLockTimer] = useState(0);
  const [successState, setSuccessState] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [mounted, setMounted] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [showEnterHint, setShowEnterHint] = useState(false);

  const clientIdRef = useRef<HTMLInputElement>(null);
  const userIdRef = useRef<HTMLInputElement>(null);
  const passRef = useRef<HTMLInputElement>(null);
  const superEmailRef = useRef<HTMLInputElement>(null);
  const superPassRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
    // Only call /api/init ONCE per browser session (not on every login page mount).
    // Previously this ran on every login page visit, which triggered ensureSettingsSync()
    // on every mount — risking data reset if Settings rows were temporarily missing.
    // Now we use sessionStorage to ensure it only runs once per tab/session.
    if (!sessionStorage.getItem('eservices_init_done')) {
      sessionStorage.setItem('eservices_init_done', '1');
      fetch('/api/init').catch(() => { /* non-critical, silent fail */ });
    }
  }, []);
  useEffect(() => {
    if (mounted) {
      const timer = setTimeout(() => {
        if (isSuperAdminMode) {
          superEmailRef.current?.focus();
        } else {
          clientIdRef.current?.focus();
        }
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [mounted, isSuperAdminMode]);
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);
  useEffect(() => {
    if (lockTimer > 0) {
      const timer = setTimeout(() => setLockTimer((prev) => prev - 1), 1000);
      return () => clearTimeout(timer);
    } else if (locked) {
      setLocked(false);
      setAttempts(0);
    }
  }, [lockTimer, locked]);
  useEffect(() => {
    const timer = setTimeout(() => setShowEnterHint(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  const greeting = useMemo(() => {
    const h = currentTime.getHours();
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
  }, [currentTime]);

  const timeStr = currentTime.toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
  });

  const dateStr = currentTime.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });

  const fetchWithRetry = async (url: string, options: RequestInit, maxAttempts = 5): Promise<Response | null> => {
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        // Create an AbortController with a 8-second timeout per attempt
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        try {
          const res = await fetch(url, { ...options, signal: controller.signal });
          lastError = null;
          return res;
        } finally {
          clearTimeout(timeoutId);
        }
      } catch (fetchErr) {
        // Ignore AbortError (our own timeout) — don't count as a real error
        if (fetchErr instanceof DOMException && fetchErr.name === 'AbortError') {
          lastError = fetchErr as Error;
          if (attempt === 0) {
            notify({ type: 'info', title: 'Please Wait', message: 'Server is starting up... please wait', duration: 5000 });
          }
          const delay = Math.min(2000 * (attempt + 1), 6000);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        lastError = fetchErr as Error;
        if (attempt === 0) {
          notify({ type: 'info', title: 'Please Wait', message: 'Server is starting up... please wait', duration: 5000 });
        }
        const delay = Math.min(2000 * (attempt + 1), 6000);
        await new Promise(r => setTimeout(r, delay));
      }
    }
    return null;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (locked) {
      notify({ type: 'error', title: 'Account Locked', message: `Locked. Try again in ${lockTimer}s` });
      return;
    }

    if (isSuperAdminMode) {
      // Super Admin login
      if (!superEmail.trim() || !superPassword.trim()) {
        notify({ type: 'error', title: 'Validation Error', message: 'All fields are required' });
        return;
      }
      setLoading(true);
      try {
        const res = await fetchWithRetry('/api/super-admin/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: superEmail.trim(),
            password: superPassword.trim(),
          }),
        });
        if (!res) {
          notify({ type: 'error', title: 'Connection Error', message: 'Server is not responding. Please wait a moment and try again.' });
          return;
        }
        const data = await res.json();
        if (res.ok && data.success) {
          const user = data.user;
          const userSession: UserSession = {
            unitCode: 'SUPER',
            unitName: 'System',
            userId: user.id,
            loginId: user.email,
            name: user.name,
            role: 'SuperAdmin',
            permissions: {},
            isSuperAdmin: true,
          };
          setSuccessState(true);
          notify({ type: 'success', title: 'Welcome', message: `Welcome, ${user.name}!` });
          setTimeout(() => {
            try {
              onLoginSuccess(data.token, userSession);
            } catch (err) {
              console.error('Login success callback failed:', err);
              setSuccessState(false);
              notify({ type: 'error', title: 'Error', message: 'Failed to complete login. Please try again.' });
            }
          }, 1200);
        } else {
          setShake(true);
          setTimeout(() => setShake(false), 600);
          const newAttempts = attempts + 1;
          setAttempts(newAttempts);
          if (newAttempts >= 5) {
            setLocked(true);
            setLockTimer(30);
            notify({ type: 'error', title: 'Account Locked', message: 'Too many failed attempts. Locked for 30 seconds.' });
          } else {
            notify({ type: 'error', title: 'Error', message: data.error || 'Login failed' });
          }
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Unknown error';
        console.error('Super Admin login error:', err);
        notify({ type: 'error', title: 'Error', message: `Something went wrong: ${errMsg}` });
      } finally {
        setLoading(false);
      }
    } else {
      // Business login
      if (!clientId.trim() || !userId.trim() || !password.trim()) {
        notify({ type: 'error', title: 'Validation Error', message: 'All fields are required' });
        return;
      }
      setLoading(true);
      try {
        const res = await fetchWithRetry('/api/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            unitCode: clientId.trim().toUpperCase(),
            loginId: userId.trim(),
            password: password.trim(),
          }),
        });
        if (!res) {
          notify({ type: 'error', title: 'Connection Error', message: 'Server is not responding. Please wait a moment and try again.' });
          return;
        }
        const data = await res.json();
        if (res.ok && data.success) {
          if (data.user?.mustChangePassword) {
            setPendingToken(data.token);
            setPendingUser(data.user);
            setMustChangePassword(true);
            setLoading(false);
            return;
          }
          setSuccessState(true);
          notify({ type: 'success', title: 'Welcome', message: `Welcome, ${data.user.name}!` });
          setTimeout(() => {
            try {
              onLoginSuccess(data.token, data.user);
            } catch (err) {
              console.error('Login success callback failed:', err);
              setSuccessState(false);
              notify({ type: 'error', title: 'Error', message: 'Failed to complete login. Please try again.' });
            }
          }, 1200);
        } else {
          // Check if subscription expired
          if (data.expired) {
            setExpiredClientInfo({
              clientId: clientId.trim().toUpperCase(),
              businessName: data.businessName || clientId.trim().toUpperCase(),
              expiresAt: data.expiresAt || null,
            });
            setShowExpiredScreen(true);
            setLoading(false);
            return;
          }
          // Check if account suspended (unit-level)
          if (data.suspended) {
            setSuspendedClientInfo({
              clientId: clientId.trim().toUpperCase(),
              businessName: data.businessName || clientId.trim().toUpperCase(),
            });
            setShowSuspendedScreen(true);
            setLoading(false);
            return;
          }
          // Check if individual user is suspended/deactivated
          if (data.userSuspended) {
            setUserSuspendedInfo({
              clientId: data.clientId || clientId.trim().toUpperCase(),
              businessName: data.businessName || clientId.trim().toUpperCase(),
              userName: data.userName || userId.trim(),
              userLoginId: data.userLoginId || userId.trim(),
            });
            setShowUserSuspendedScreen(true);
            setLoading(false);
            return;
          }
          setShake(true);
          setTimeout(() => setShake(false), 600);
          const newAttempts = attempts + 1;
          setAttempts(newAttempts);
          if (newAttempts >= 5) {
            setLocked(true);
            setLockTimer(30);
            notify({ type: 'error', title: 'Account Locked', message: 'Too many failed attempts. Locked for 30 seconds.' });
          } else {
            notify({ type: 'error', title: 'Error', message: data.error || 'Login failed' });
          }
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Unknown error';
        console.error('Business login error:', err);
        notify({ type: 'error', title: 'Error', message: `Something went wrong: ${errMsg}` });
      } finally {
        setLoading(false);
      }
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword.trim() || !newPassword.trim() || !confirmPassword.trim()) {
      notify({ type: 'error', title: 'Validation Error', message: 'All fields are required' });
      return;
    }
    if (newPassword.length < 4) {
      notify({ type: 'error', title: 'Validation Error', message: 'New password must be at least 4 characters' });
      return;
    }
    if (newPassword !== confirmPassword) {
      notify({ type: 'error', title: 'Validation Error', message: 'New password and confirm password do not match' });
      return;
    }
    if (currentPassword === newPassword) {
      notify({ type: 'error', title: 'Validation Error', message: 'New password must be different from current password' });
      return;
    }
    if (!pendingToken) return;

    setChangePasswordLoading(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${pendingToken}`,
        },
        body: JSON.stringify({
          currentPassword: currentPassword.trim(),
          newPassword: newPassword.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        notify({ type: 'success', title: 'Password Changed', message: 'Password changed successfully!' });
        // Use fresh user data from the server response (includes DB-fresh unitCode/unitName/permissions)
        // instead of the stale pendingUser from the JWT
        const updatedUser: UserSession = data.user
          ? { ...(data.user as UserSession), mustChangePassword: false }
          : { ...(pendingUser as UserSession), mustChangePassword: false };
        // Use the new token if returned, otherwise keep the existing one
        const newToken = data.token || pendingToken;
        setMustChangePassword(false);
        setPendingToken(null);
        setPendingUser(null);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setSuccessState(true);
        setTimeout(() => {
          try {
            onLoginSuccess(newToken, updatedUser);
          } catch (err) {
            console.error('Login success callback failed:', err);
            setSuccessState(false);
            notify({ type: 'error', title: 'Error', message: 'Failed to complete login. Please try again.' });
          }
        }, 1200);
      } else {
        notify({ type: 'error', title: 'Error', message: data.error || 'Failed to change password' });
      }
    } catch {
      notify({ type: 'error', title: 'Error', message: 'Something went wrong. Please try again.' });
    } finally {
      setChangePasswordLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, nextRef?: React.RefObject<HTMLInputElement | null>) => {
    if (e.key === 'Enter') {
      if (nextRef?.current) {
        nextRef.current.focus();
      }
    }
  };

  const handleForgotPasswordGetQuestion = async () => {
    if (!forgotEmail.trim()) {
      notify({ type: 'error', title: 'Validation Error', message: 'Please enter your email' });
      return;
    }
    setForgotLoading(true);
    try {
      const res = await fetch(`/api/super-admin/forgot-password?email=${encodeURIComponent(forgotEmail.trim())}`);
      const data = await res.json();
      if (res.ok) {
        setForgotSecurityQuestion(data.securityQuestion);
        setForgotStep('answer');
      } else {
        notify({ type: 'error', title: 'Error', message: data.error || 'Failed to fetch security question' });
      }
    } catch {
      notify({ type: 'error', title: 'Error', message: 'Something went wrong' });
    } finally {
      setForgotLoading(false);
    }
  };

  // Verify security answer before allowing password reset
  const handleVerifySecurityAnswer = async () => {
    if (!forgotSecurityAnswer.trim()) {
      notify({ type: 'error', title: 'Validation Error', message: 'Please enter the security answer' });
      return;
    }
    setForgotLoading(true);
    try {
      // Use the dedicated PUT endpoint to verify the answer without resetting password
      const res = await fetch('/api/super-admin/forgot-password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: forgotEmail.trim(),
          securityAnswer: forgotSecurityAnswer.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok && data.verified) {
        // Answer is correct — advance to the reset step
        setForgotStep('reset');
      } else {
        // Answer is incorrect — show error, stay on answer step
        notify({ type: 'error', title: 'Verification Failed', message: data.error || 'Security answer is incorrect. Please try again.' });
      }
    } catch {
      notify({ type: 'error', title: 'Error', message: 'Something went wrong. Please try again.' });
    } finally {
      setForgotLoading(false);
    }
  };

  const handleForgotPasswordReset = async () => {
    if (!forgotSecurityAnswer.trim()) {
      notify({ type: 'error', title: 'Validation Error', message: 'Please enter the security answer' });
      return;
    }
    if (!forgotNewPassword || forgotNewPassword.length < 6) {
      notify({ type: 'error', title: 'Validation Error', message: 'New password must be at least 6 characters' });
      return;
    }
    if (forgotNewPassword !== forgotConfirmPassword) {
      notify({ type: 'error', title: 'Validation Error', message: 'Passwords do not match' });
      return;
    }
    setForgotLoading(true);
    try {
      const res = await fetch('/api/super-admin/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: forgotEmail.trim(),
          securityAnswer: forgotSecurityAnswer.trim(),
          newPassword: forgotNewPassword,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        notify({ type: 'success', title: 'Password Reset', message: 'Password reset successfully! You can now log in.' });
        setShowForgotPassword(false);
        setForgotStep('email');
        setForgotEmail('');
        setForgotSecurityQuestion('');
        setForgotSecurityAnswer('');
        setForgotNewPassword('');
        setForgotConfirmPassword('');
      } else {
        notify({ type: 'error', title: 'Error', message: data.error || 'Failed to reset password' });
      }
    } catch {
      notify({ type: 'error', title: 'Error', message: 'Something went wrong' });
    } finally {
      setForgotLoading(false);
    }
  };

  const resetForgotPassword = () => {
    setShowForgotPassword(false);
    setForgotStep('email');
    setForgotEmail('');
    setForgotSecurityQuestion('');
    setForgotSecurityAnswer('');
    setForgotNewPassword('');
    setForgotConfirmPassword('');
  };

  const handleForgotLoginIdOpen = async () => {
    setShowForgotLoginId(true);
    setForgotLoginIdStep('answer');
    setForgotLoginIdAnswer('');
    setRecoveredEmail('');
    setRecoveredName('');
    setEmailCopied(false);
    setForgotLoginIdLoading(true);
    try {
      const res = await fetch('/api/super-admin/recover-email');
      const data = await res.json();
      if (res.ok) {
        setForgotLoginIdQuestion(data.securityQuestion);
      } else {
        notify({ type: 'error', title: 'Error', message: data.error || 'Failed to fetch security question' });
        setShowForgotLoginId(false);
      }
    } catch {
      notify({ type: 'error', title: 'Error', message: 'Something went wrong' });
      setShowForgotLoginId(false);
    } finally {
      setForgotLoginIdLoading(false);
    }
  };

  const handleForgotLoginIdSubmit = async () => {
    if (!forgotLoginIdAnswer.trim()) {
      notify({ type: 'error', title: 'Validation Error', message: 'Please enter the security answer' });
      return;
    }
    setForgotLoginIdLoading(true);
    try {
      const res = await fetch('/api/super-admin/recover-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ securityAnswer: forgotLoginIdAnswer.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setRecoveredEmail(data.email);
        setRecoveredName(data.name);
        setForgotLoginIdStep('result');
        notify({ type: 'success', title: 'Recovery Success', message: 'Login ID recovered successfully!' });
      } else {
        notify({ type: 'error', title: 'Error', message: data.error || 'Security answer is incorrect' });
      }
    } catch {
      notify({ type: 'error', title: 'Error', message: 'Something went wrong' });
    } finally {
      setForgotLoginIdLoading(false);
    }
  };

  const resetForgotLoginId = () => {
    setShowForgotLoginId(false);
    setForgotLoginIdStep('answer');
    setForgotLoginIdAnswer('');
    setForgotLoginIdQuestion('');
    setRecoveredEmail('');
    setRecoveredName('');
    setEmailCopied(false);
  };

  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText(recoveredEmail);
      setEmailCopied(true);
      notify({ type: 'success', title: 'Copied', message: 'Email copied to clipboard!' });
      setTimeout(() => setEmailCopied(false), 2000);
    } catch {
      notify({ type: 'error', title: 'Error', message: 'Failed to copy email' });
    }
  };

  // --- Account Suspended Screen ---
  if (showSuspendedScreen) {
    return (
      <div className="min-h-screen flex relative overflow-hidden">
        {/* LEFT PANEL — Decorative */}
        <div className="hidden lg:flex lg:w-[55%] xl:w-[60%] relative bg-gradient-to-br from-amber-950 via-orange-950 to-yellow-950 overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-1/3 -left-1/4 w-[800px] h-[800px] rounded-full bg-amber-500/8 login-mesh-1" />
            <div className="absolute -bottom-1/3 -right-1/4 w-[700px] h-[700px] rounded-full bg-orange-400/8 login-mesh-2" />
          </div>
          <div className="absolute inset-0 opacity-[0.03]" style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
          }} />
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {FLOATING_ICONS.map((item, i) => (
              <div key={i} className="login-particle absolute text-white" style={{
                left: item.x, animationDuration: item.duration, animationDelay: item.delay, opacity: item.opacity * 0.6,
              }}>
                <item.Icon size={item.size} />
              </div>
            ))}
          </div>
          <div className="relative z-10 flex flex-col justify-between p-10 xl:p-14 w-full">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="flex size-12 rounded-xl bg-white/10 border border-white/10 items-center justify-center backdrop-blur-sm">
                  <img src="/icon-192.png" alt="Eservices" className="size-7 rounded-lg object-cover" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white tracking-tight">Eservices</h1>
                  <p className="text-amber-300/60 text-xs font-medium tracking-wide uppercase">POS & Billing System</p>
                </div>
              </div>
            </div>
            <div className="flex-1 flex flex-col justify-center max-w-lg">
              <div className="flex items-center gap-3 mb-6">
                <div className="flex size-14 rounded-2xl bg-amber-500/20 border border-amber-400/20 items-center justify-center backdrop-blur-sm">
                  <AlertTriangle className="size-7 text-amber-300" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">Account Suspended</h2>
                  <p className="text-amber-200/50 text-sm">Access temporarily restricted</p>
                </div>
              </div>
              <p className="text-amber-100/40 text-sm leading-relaxed max-w-md">
                Your account has been suspended by your administrator. To restore access,
                please contact your system administrator.
              </p>
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Shield className="size-4 text-amber-400/60" />
                <span className="text-amber-200/40 text-xs">256-bit Encrypted</span>
              </div>
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-amber-400/60" />
                <span className="text-amber-200/40 text-xs">v3.0 — Eservices</span>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL — Suspended Notice */}
        <div className="w-full lg:w-[45%] xl:w-[40%] relative bg-white dark:bg-gray-950 flex items-center justify-center p-6 sm:p-8 lg:p-12">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-amber-50 to-transparent dark:from-amber-950/20 dark:to-transparent rounded-bl-full pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-orange-50 to-transparent dark:from-orange-950/20 dark:to-transparent rounded-tr-full pointer-events-none" />

          <div className="absolute pointer-events-none rounded-full" style={{
            width: '400px', height: '400px',
            background: 'radial-gradient(circle, rgba(245,158,11,0.08) 0%, rgba(249,115,22,0.05) 40%, transparent 70%)',
            top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            animation: 'glow-pulse 4s ease-in-out infinite', filter: 'blur(40px)',
          }} />

          <div className="relative z-10 w-full max-w-[420px]">
            {/* Mobile Logo */}
            <div className="lg:hidden flex flex-col items-center mb-8">
              <div className="flex size-16 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 items-center justify-center shadow-lg shadow-amber-600/25 mb-3">
                <AlertTriangle className="size-8 text-white" />
              </div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Account Suspended</h1>
              <p className="text-muted-foreground text-xs mt-0.5">Access temporarily restricted</p>
            </div>

            <div className="animate-fade-in-up">
              <div className="animated-border rounded-2xl p-[2px]">
                <div className="rounded-[14px] bg-white dark:bg-gray-950 p-6 sm:p-8">
                  {/* Header */}
                  <div className="mb-6">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="flex size-8 rounded-lg bg-amber-100 dark:bg-amber-900/40 items-center justify-center">
                        <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
                      </div>
                      <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                        Account Notice
                      </span>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Account Suspended</h2>
                    <p className="text-muted-foreground text-sm">Your access has been temporarily restricted</p>
                  </div>

                  {/* Alert Box */}
                  <div className="mb-6 p-4 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20 border border-amber-200/60 dark:border-amber-800/40">
                    <div className="flex items-start gap-3">
                      <div className="flex size-10 rounded-full bg-amber-100 dark:bg-amber-900/50 items-center justify-center shrink-0">
                        <AlertCircle className="size-5 text-amber-600 dark:text-amber-400" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                          Your account has been suspended
                        </p>
                        <p className="text-xs text-amber-600/80 dark:text-amber-400/70 mt-1 leading-relaxed">
                          Your administrator has temporarily suspended this account. Please contact them to restore access.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Details Card */}
                  <div className="mb-6 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="px-4 py-2.5 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Account Details</span>
                    </div>
                    <div className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Building2 className="size-3.5" />
                          <span>Business</span>
                        </div>
                        <span className="text-sm font-semibold text-foreground">
                          {suspendedClientInfo?.businessName || '—'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Hash className="size-3.5" />
                          <span>Client ID</span>
                        </div>
                        <span className="text-sm font-mono font-semibold text-foreground">
                          {suspendedClientInfo?.clientId || '—'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <ShieldAlert className="size-3.5" />
                          <span>Status</span>
                        </div>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                          <AlertTriangle className="size-3" />
                          Suspended
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Contact Info */}
                  <div className="mb-6 p-4 rounded-xl bg-amber-50/80 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/40">
                    <div className="flex items-start gap-3">
                      <Phone className="size-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                          Need help? Contact your administrator
                        </p>
                        <p className="text-xs text-amber-600/70 dark:text-amber-400/60 mt-0.5">
                          Reach out to your system administrator or IT support team to reactivate your account.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Back to Login */}
                  <Button
                    onClick={() => {
                      setShowSuspendedScreen(false);
                      setSuspendedClientInfo(null);
                    }}
                    className="w-full h-12 bg-gradient-to-r from-gray-800 to-gray-900 hover:from-gray-900 hover:to-black text-white font-semibold text-sm gap-2.5 transition-all duration-300 shadow-lg shadow-gray-800/25 hover:shadow-xl hover:shadow-gray-900/35 hover:-translate-y-0.5 active:translate-y-0 rounded-xl dark:from-gray-200 dark:to-gray-300 dark:text-gray-900 dark:shadow-gray-400/25"
                  >
                    <ArrowLeft className="size-4" />
                    Back to Login
                  </Button>

                  <div className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground/50">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500/50" />
                    <span>Eservices v3.0</span>
                    <span className="text-muted-foreground/30">|</span>
                    <span>Secured</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes particle-rise {
            0% { transform: translateY(0) scale(1); }
            50% { opacity: 0.3; }
            100% { transform: translateY(-100vh) scale(0.5); opacity: 0; }
          }
          @keyframes glow-pulse {
            0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
            50% { transform: translate(-50%, -50%) scale(1.15); opacity: 0.7; }
          }
        ` }} />
      </div>
    );
  }

  // --- User Suspended Screen (looks like subscription expired page) ---
  if (showUserSuspendedScreen) {
    return (
      <div className="min-h-screen flex relative overflow-hidden">
        {/* LEFT PANEL — Decorative */}
        <div className="hidden lg:flex lg:w-[55%] xl:w-[60%] relative bg-gradient-to-br from-red-950 via-rose-950 to-orange-950 overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-1/3 -left-1/4 w-[800px] h-[800px] rounded-full bg-red-500/8 login-mesh-1" />
            <div className="absolute -bottom-1/3 -right-1/4 w-[700px] h-[700px] rounded-full bg-rose-400/8 login-mesh-2" />
          </div>
          <div className="absolute inset-0 opacity-[0.03]" style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
          }} />
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {FLOATING_ICONS.map((item, i) => (
              <div key={i} className="login-particle absolute text-white" style={{
                left: item.x, animationDuration: item.duration, animationDelay: item.delay, opacity: item.opacity * 0.6,
              }}>
                <item.Icon size={item.size} />
              </div>
            ))}
          </div>
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {PARTICLES.map((p, i) => (
              <div key={`us-${i}`} className="absolute rounded-full" style={{
                width: p.size, height: p.size, left: p.left, bottom: '-20px',
                backgroundColor: p.color, opacity: p.opacity,
                animation: `particle-rise ${p.duration} linear infinite`, animationDelay: p.delay,
              }} />
            ))}
          </div>
          <div className="relative z-10 flex flex-col justify-between p-10 xl:p-14 w-full">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="flex size-12 rounded-xl bg-white/10 border border-white/10 items-center justify-center backdrop-blur-sm">
                  <img src="/icon-192.png" alt="Eservices" className="size-7 rounded-lg object-cover" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white tracking-tight">Eservices</h1>
                  <p className="text-red-300/60 text-xs font-medium tracking-wide uppercase">POS & Billing System</p>
                </div>
              </div>
            </div>
            <div className="flex-1 flex flex-col justify-center max-w-lg">
              <div className="flex items-center gap-3 mb-6">
                <div className="flex size-14 rounded-2xl bg-red-500/20 border border-red-400/20 items-center justify-center backdrop-blur-sm">
                  <Ban className="size-7 text-red-300" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">Account Suspended</h2>
                  <p className="text-red-200/50 text-sm">Access has been revoked</p>
                </div>
              </div>
              <p className="text-red-100/40 text-sm leading-relaxed max-w-md">
                Your account has been suspended by the administrator. To restore access,
                please contact your business administrator or system owner for reactivation.
              </p>
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Shield className="size-4 text-red-400/60" />
                <span className="text-red-200/40 text-xs">256-bit Encrypted</span>
              </div>
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-red-400/60" />
                <span className="text-red-200/40 text-xs">v3.0 — Eservices</span>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL — Suspended User Notice */}
        <div className="w-full lg:w-[45%] xl:w-[40%] relative bg-white dark:bg-gray-950 flex items-center justify-center p-6 sm:p-8 lg:p-12">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-red-50 to-transparent dark:from-red-950/20 dark:to-transparent rounded-bl-full pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-rose-50 to-transparent dark:from-rose-950/20 dark:to-transparent rounded-tr-full pointer-events-none" />

          <div className="absolute pointer-events-none rounded-full" style={{
            width: '400px', height: '400px',
            background: 'radial-gradient(circle, rgba(239,68,68,0.08) 0%, rgba(244,63,94,0.05) 40%, transparent 70%)',
            top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            animation: 'glow-pulse 4s ease-in-out infinite', filter: 'blur(40px)',
          }} />

          <div className="relative z-10 w-full max-w-[420px]">
            {/* Mobile Logo */}
            <div className="lg:hidden flex flex-col items-center mb-8">
              <div className="flex size-16 rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 items-center justify-center shadow-lg shadow-red-600/25 mb-3">
                <Ban className="size-8 text-white" />
              </div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Account Suspended</h1>
              <p className="text-muted-foreground text-xs mt-0.5">Access has been revoked</p>
            </div>

            <div className="animate-fade-in-up">
              <div className="animated-border rounded-2xl p-[2px]">
                <div className="rounded-[14px] bg-white dark:bg-gray-950 p-6 sm:p-8">
                  {/* Header */}
                  <div className="mb-6">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="flex size-8 rounded-lg bg-red-100 dark:bg-red-900/40 items-center justify-center">
                        <Ban className="size-4 text-red-600 dark:text-red-400" />
                      </div>
                      <span className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider">
                        Account Notice
                      </span>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Account Suspended</h2>
                    <p className="text-muted-foreground text-sm">Your access has been revoked by the administrator</p>
                  </div>

                  {/* Alert Box */}
                  <div className="mb-6 p-4 rounded-xl bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-950/20 border border-red-200/60 dark:border-red-800/40">
                    <div className="flex items-start gap-3">
                      <div className="flex size-10 rounded-full bg-red-100 dark:bg-red-900/50 items-center justify-center shrink-0">
                        <AlertCircle className="size-5 text-red-600 dark:text-red-400" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-red-800 dark:text-red-300">
                          Your account has been suspended
                        </p>
                        <p className="text-xs text-red-600/80 dark:text-red-400/70 mt-1 leading-relaxed">
                          The administrator has deactivated your account. Please contact them to restore your access.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Details Card */}
                  <div className="mb-6 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="px-4 py-2.5 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Account Details</span>
                    </div>
                    <div className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <User className="size-3.5" />
                          <span>User Name</span>
                        </div>
                        <span className="text-sm font-semibold text-foreground">
                          {userSuspendedInfo?.userName || '—'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <KeyRound className="size-3.5" />
                          <span>Login ID</span>
                        </div>
                        <span className="text-sm font-mono font-semibold text-foreground">
                          {userSuspendedInfo?.userLoginId || '—'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Building2 className="size-3.5" />
                          <span>Business</span>
                        </div>
                        <span className="text-sm font-semibold text-foreground">
                          {userSuspendedInfo?.businessName || '—'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Hash className="size-3.5" />
                          <span>Client ID</span>
                        </div>
                        <span className="text-sm font-mono font-semibold text-foreground">
                          {userSuspendedInfo?.clientId || '—'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <ShieldAlert className="size-3.5" />
                          <span>Status</span>
                        </div>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400 border border-red-200 dark:border-red-800">
                          <Ban className="size-3" />
                          Suspended
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Contact Info */}
                  <div className="mb-6 p-4 rounded-xl bg-red-50/80 dark:bg-red-950/20 border border-red-200/60 dark:border-red-800/40">
                    <div className="flex items-start gap-3">
                      <Phone className="size-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-red-800 dark:text-red-300">
                          Need help? Contact your administrator
                        </p>
                        <p className="text-xs text-red-600/70 dark:text-red-400/60 mt-0.5">
                          Reach out to your business administrator or IT support team to reactivate your account.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Back to Login */}
                  <Button
                    onClick={() => {
                      setShowUserSuspendedScreen(false);
                      setUserSuspendedInfo(null);
                    }}
                    className="w-full h-12 bg-gradient-to-r from-gray-800 to-gray-900 hover:from-gray-900 hover:to-black text-white font-semibold text-sm gap-2.5 transition-all duration-300 shadow-lg shadow-gray-800/25 hover:shadow-xl hover:shadow-gray-900/35 hover:-translate-y-0.5 active:translate-y-0 rounded-xl dark:from-gray-200 dark:to-gray-300 dark:text-gray-900 dark:shadow-gray-400/25"
                  >
                    <ArrowLeft className="size-4" />
                    Back to Login
                  </Button>

                  <div className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground/50">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500/50" />
                    <span>Eservices v3.0</span>
                    <span className="text-muted-foreground/30">|</span>
                    <span>Secured</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes particle-rise {
            0% { transform: translateY(0) scale(1); }
            50% { opacity: 0.3; }
            100% { transform: translateY(-100vh) scale(0.5); opacity: 0; }
          }
          @keyframes glow-pulse {
            0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
            50% { transform: translate(-50%, -50%) scale(1.15); opacity: 0.7; }
          }
        ` }} />
      </div>
    );
  }

  // --- Subscription Expired Screen ---
  if (showExpiredScreen) {
    const expDate = expiredClientInfo?.expiresAt
      ? new Date(expiredClientInfo.expiresAt).toLocaleDateString('en-IN', {
          day: '2-digit', month: 'long', year: 'numeric',
        })
      : '—';

    return (
      <div className="min-h-screen flex relative overflow-hidden">
        {/* LEFT PANEL — Decorative */}
        <div className="hidden lg:flex lg:w-[55%] xl:w-[60%] relative bg-gradient-to-br from-red-950 via-orange-950 to-amber-950 overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-1/3 -left-1/4 w-[800px] h-[800px] rounded-full bg-red-500/8 login-mesh-1" />
            <div className="absolute -bottom-1/3 -right-1/4 w-[700px] h-[700px] rounded-full bg-amber-400/8 login-mesh-2" />
          </div>
          <div className="absolute inset-0 opacity-[0.03]" style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
          }} />
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {FLOATING_ICONS.map((item, i) => (
              <div key={i} className="login-particle absolute text-white" style={{
                left: item.x, animationDuration: item.duration, animationDelay: item.delay, opacity: item.opacity * 0.6,
              }}>
                <item.Icon size={item.size} />
              </div>
            ))}
          </div>
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {PARTICLES.map((p, i) => (
              <div key={`exp-${i}`} className="absolute rounded-full" style={{
                width: p.size, height: p.size, left: p.left, bottom: '-20px',
                backgroundColor: p.color, opacity: p.opacity,
                animation: `particle-rise ${p.duration} linear infinite`, animationDelay: p.delay,
              }} />
            ))}
          </div>
          <div className="relative z-10 flex flex-col justify-between p-10 xl:p-14 w-full">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="flex size-12 rounded-xl bg-white/10 border border-white/10 items-center justify-center backdrop-blur-sm">
                  <img src="/icon-192.png" alt="Eservices" className="size-7 rounded-lg object-cover" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white tracking-tight">Eservices</h1>
                  <p className="text-red-300/60 text-xs font-medium tracking-wide uppercase">POS & Billing System</p>
                </div>
              </div>
            </div>
            <div className="flex-1 flex flex-col justify-center max-w-lg">
              <div className="flex items-center gap-3 mb-6">
                <div className="flex size-14 rounded-2xl bg-red-500/20 border border-red-400/20 items-center justify-center backdrop-blur-sm">
                  <ShieldAlert className="size-7 text-red-300" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">Subscription Expired</h2>
                  <p className="text-red-200/50 text-sm">Access temporarily restricted</p>
                </div>
              </div>
              <p className="text-red-100/40 text-sm leading-relaxed max-w-md">
                Your subscription period has ended. To continue using Eservices & Billing,
                please contact your system administrator to renew your subscription plan.
              </p>
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Shield className="size-4 text-red-400/60" />
                <span className="text-red-200/40 text-xs">256-bit Encrypted</span>
              </div>
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-red-400/60" />
                <span className="text-red-200/40 text-xs">v3.0 — Eservices</span>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL — Expiry Notice */}
        <div className="w-full lg:w-[45%] xl:w-[40%] relative bg-white dark:bg-gray-950 flex items-center justify-center p-6 sm:p-8 lg:p-12">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-red-50 to-transparent dark:from-red-950/20 dark:to-transparent rounded-bl-full pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-amber-50 to-transparent dark:from-amber-950/20 dark:to-transparent rounded-tr-full pointer-events-none" />

          <div className="absolute pointer-events-none rounded-full" style={{
            width: '400px', height: '400px',
            background: 'radial-gradient(circle, rgba(239,68,68,0.08) 0%, rgba(245,158,11,0.05) 40%, transparent 70%)',
            top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            animation: 'glow-pulse 4s ease-in-out infinite', filter: 'blur(40px)',
          }} />

          <div className="relative z-10 w-full max-w-[420px]">
            {/* Mobile Logo */}
            <div className="lg:hidden flex flex-col items-center mb-8">
              <div className="flex size-16 rounded-2xl bg-gradient-to-br from-red-500 to-orange-600 items-center justify-center shadow-lg shadow-red-600/25 mb-3">
                <ShieldAlert className="size-8 text-white" />
              </div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Subscription Expired</h1>
              <p className="text-muted-foreground text-xs mt-0.5">Access temporarily restricted</p>
            </div>

            <div className="animate-fade-in-up">
              <div className="animated-border rounded-2xl p-[2px]">
                <div className="rounded-[14px] bg-white dark:bg-gray-950 p-6 sm:p-8">
                  {/* Header */}
                  <div className="mb-6">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="flex size-8 rounded-lg bg-red-100 dark:bg-red-900/40 items-center justify-center">
                        <ShieldAlert className="size-4 text-red-600 dark:text-red-400" />
                      </div>
                      <span className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider">
                        Subscription Notice
                      </span>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Access Expired</h2>
                    <p className="text-muted-foreground text-sm">Your subscription period has ended</p>
                  </div>

                  {/* Alert Box */}
                  <div className="mb-6 p-4 rounded-xl bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950/30 dark:to-orange-950/20 border border-red-200/60 dark:border-red-800/40">
                    <div className="flex items-start gap-3">
                      <div className="flex size-10 rounded-full bg-red-100 dark:bg-red-900/50 items-center justify-center shrink-0">
                        <AlertTriangle className="size-5 text-red-600 dark:text-red-400" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-red-800 dark:text-red-300">
                          Your subscription has expired
                        </p>
                        <p className="text-xs text-red-600/80 dark:text-red-400/70 mt-1 leading-relaxed">
                          Please contact your administrator for renewal to restore full access to your account and data.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Details Card */}
                  <div className="mb-6 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="px-4 py-2.5 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Account Details</span>
                    </div>
                    <div className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Building2 className="size-3.5" />
                          <span>Business</span>
                        </div>
                        <span className="text-sm font-semibold text-foreground">
                          {expiredClientInfo?.businessName || '—'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Hash className="size-3.5" />
                          <span>Client ID</span>
                        </div>
                        <span className="text-sm font-mono font-semibold text-foreground">
                          {expiredClientInfo?.clientId || '—'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="size-3.5" />
                          <span>Expired On</span>
                        </div>
                        <span className="text-sm font-semibold text-red-600 dark:text-red-400">
                          {expDate}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <ShieldAlert className="size-3.5" />
                          <span>Status</span>
                        </div>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400 border border-red-200 dark:border-red-800">
                          <Timer className="size-3" />
                          Expired
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Contact Info */}
                  <div className="mb-6 p-4 rounded-xl bg-amber-50/80 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/40">
                    <div className="flex items-start gap-3">
                      <Phone className="size-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                          Need help? Contact your administrator
                        </p>
                        <p className="text-xs text-amber-600/70 dark:text-amber-400/60 mt-0.5">
                          Reach out to your system administrator or IT support team to renew your subscription and restore access.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Back to Login */}
                  <Button
                    onClick={() => {
                      setShowExpiredScreen(false);
                      setExpiredClientInfo(null);
                    }}
                    className="w-full h-12 bg-gradient-to-r from-gray-800 to-gray-900 hover:from-gray-900 hover:to-black text-white font-semibold text-sm gap-2.5 transition-all duration-300 shadow-lg shadow-gray-800/25 hover:shadow-xl hover:shadow-gray-900/35 hover:-translate-y-0.5 active:translate-y-0 rounded-xl dark:from-gray-200 dark:to-gray-300 dark:text-gray-900 dark:shadow-gray-400/25"
                  >
                    <ArrowLeft className="size-4" />
                    Back to Login
                  </Button>

                  <div className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground/50">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500/50" />
                    <span>Eservices v3.0</span>
                    <span className="text-muted-foreground/30">|</span>
                    <span>Secured</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes particle-rise {
            0% { transform: translateY(0) scale(1); }
            50% { opacity: 0.3; }
            100% { transform: translateY(-100vh) scale(0.5); opacity: 0; }
          }
          @keyframes glow-pulse {
            0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
            50% { transform: translate(-50%, -50%) scale(1.15); opacity: 0.7; }
          }
        ` }} />
      </div>
    );
  }

  // --- Force Password Change Screen ---
  if (mustChangePassword) {
    return (
      <div className="min-h-screen flex relative overflow-hidden">
        {/* LEFT PANEL — Same as login */}
        <div className="hidden lg:flex lg:w-[55%] xl:w-[60%] relative bg-gradient-to-br from-emerald-950 via-green-900 to-teal-950 overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-1/3 -left-1/4 w-[800px] h-[800px] rounded-full bg-emerald-500/8 login-mesh-1" />
            <div className="absolute -bottom-1/3 -right-1/4 w-[700px] h-[700px] rounded-full bg-teal-400/8 login-mesh-2" />
          </div>
          <div className="absolute inset-0 opacity-[0.03]" style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
          }} />
          <div className="absolute inset-0 pointer-events-none">
            {FLOATING_ICONS.map((item, i) => (
              <div key={i} className="login-particle absolute text-white" style={{
                left: item.x, animationDuration: item.duration, animationDelay: item.delay, opacity: item.opacity,
              }}>
                <item.Icon size={item.size} />
              </div>
            ))}
          </div>
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {PARTICLES.map((p, i) => (
              <div key={`dot-${i}`} className="absolute rounded-full" style={{
                width: p.size, height: p.size, left: p.left, bottom: '-20px',
                backgroundColor: p.color, opacity: p.opacity,
                animation: `particle-rise ${p.duration} linear infinite`, animationDelay: p.delay,
              }} />
            ))}
          </div>
          <div className="relative z-10 flex flex-col justify-between p-10 xl:p-14 w-full">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="flex size-12 rounded-xl bg-white/10 border border-white/10 items-center justify-center backdrop-blur-sm">
                  <img src="/icon-192.png" alt="Eservices" className="size-7 rounded-lg object-cover" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white tracking-tight">Eservices</h1>
                  <p className="text-emerald-300/60 text-xs font-medium tracking-wide uppercase">POS & Billing System</p>
                </div>
              </div>
            </div>
            <div className="flex-1 flex flex-col justify-center max-w-lg">
              <div className="flex items-center gap-3 mb-6">
                <div className="flex size-14 rounded-2xl bg-amber-500/20 border border-amber-400/20 items-center justify-center backdrop-blur-sm">
                  <KeyRound className="size-7 text-amber-300" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">Password Update</h2>
                  <p className="text-emerald-200/50 text-sm">Required for your security</p>
                </div>
              </div>
              <p className="text-emerald-100/40 text-sm leading-relaxed max-w-md">
                For your security, you must update your password before accessing the system.
                Please choose a strong password that you haven&apos;t used before.
              </p>
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Shield className="size-4 text-emerald-400/60" />
                <span className="text-emerald-200/40 text-xs">256-bit Encrypted</span>
              </div>
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-emerald-400/60" />
                <span className="text-emerald-200/40 text-xs">v3.0 — Eservices</span>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL — Change Password Form */}
        <div className="w-full lg:w-[45%] xl:w-[40%] relative bg-white dark:bg-gray-950 flex items-center justify-center p-6 sm:p-8 lg:p-12">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-amber-50 to-transparent dark:from-amber-950/20 dark:to-transparent rounded-bl-full pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-teal-50 to-transparent dark:from-teal-950/20 dark:to-transparent rounded-tr-full pointer-events-none" />

          <div className="absolute pointer-events-none rounded-full" style={{
            width: '400px', height: '400px',
            background: 'radial-gradient(circle, rgba(245,158,11,0.10) 0%, rgba(20,184,166,0.06) 40%, transparent 70%)',
            top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            animation: 'glow-pulse 4s ease-in-out infinite', filter: 'blur(40px)',
          }} />

          <div className="relative z-10 w-full max-w-[420px]">
            {/* Mobile Logo */}
            <div className="lg:hidden flex flex-col items-center mb-8">
              <div className="flex size-16 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 items-center justify-center shadow-lg shadow-amber-600/25 mb-3">
                <KeyRound className="size-8 text-white" />
              </div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Change Password</h1>
              <p className="text-muted-foreground text-xs mt-0.5">Required before continuing</p>
            </div>

            <div className="animate-fade-in-up">
              <div className="animated-border rounded-2xl p-[2px]">
                <div className="rounded-[14px] bg-white dark:bg-gray-950 p-6 sm:p-8">
                  {/* Header */}
                  <div className="mb-6">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="flex size-8 rounded-lg bg-amber-100 dark:bg-amber-900/40 items-center justify-center">
                        <KeyRound className="size-4 text-amber-600 dark:text-amber-400" />
                      </div>
                      <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                        Security Update
                      </span>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Change Password</h2>
                    <p className="text-muted-foreground text-sm">You must change your password before continuing</p>
                  </div>

                  {/* Warning banner */}
                  <div className="flex items-start gap-3 mb-5 p-3 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-100/60 dark:border-amber-800/40">
                    <AlertCircle className="size-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Password update required</p>
                      <p className="text-xs text-amber-600/70 dark:text-amber-400/60 mt-0.5">Your current password must be changed for security purposes.</p>
                    </div>
                  </div>

                  <form onSubmit={handleChangePassword} className="space-y-4">
                    {/* Current Password */}
                    <div className="space-y-1.5">
                      <label htmlFor="currentPassword" className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                        <Lock className="size-3.5 text-muted-foreground" />
                        Current Password
                      </label>
                      <div className={`relative rounded-xl border transition-all duration-300 ${
                        focusedField === 'currentPassword'
                          ? 'border-amber-400 dark:border-amber-500 ring-[3px] ring-amber-500/15 shadow-lg shadow-amber-500/10'
                          : 'border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50'
                      }`}>
                        <Lock className={`absolute left-4 top-1/2 -translate-y-1/2 size-[18px] transition-colors duration-200 ${
                          focusedField === 'currentPassword' ? 'text-amber-500' : 'text-muted-foreground'
                        }`} />
                        <Input
                          id="currentPassword"
                          type={showCurrentPassword ? 'text' : 'password'}
                          placeholder="Enter current password"
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          onFocus={() => setFocusedField('currentPassword')}
                          onBlur={() => setFocusedField(null)}
                          className="pl-12 pr-12 h-12 border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:outline-none text-sm"
                          disabled={changePasswordLoading}
                          autoComplete="current-password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-gray-700 dark:hover:text-gray-300 transition-colors p-0.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
                          tabIndex={-1}
                          aria-label={showCurrentPassword ? 'Hide password' : 'Show password'}
                        >
                          {showCurrentPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </button>
                      </div>
                    </div>

                    {/* New Password */}
                    <div className="space-y-1.5">
                      <label htmlFor="newPassword" className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                        <KeyRound className="size-3.5 text-muted-foreground" />
                        New Password
                      </label>
                      <div className={`relative rounded-xl border transition-all duration-300 ${
                        focusedField === 'newPassword'
                          ? 'border-amber-400 dark:border-amber-500 ring-[3px] ring-amber-500/15 shadow-lg shadow-amber-500/10'
                          : 'border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50'
                      }`}>
                        <KeyRound className={`absolute left-4 top-1/2 -translate-y-1/2 size-[18px] transition-colors duration-200 ${
                          focusedField === 'newPassword' ? 'text-amber-500' : 'text-muted-foreground'
                        }`} />
                        <Input
                          id="newPassword"
                          type={showNewPassword ? 'text' : 'password'}
                          placeholder="Enter new password (min 4 chars)"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          onFocus={() => setFocusedField('newPassword')}
                          onBlur={() => setFocusedField(null)}
                          className="pl-12 pr-12 h-12 border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:outline-none text-sm"
                          disabled={changePasswordLoading}
                          autoComplete="new-password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-gray-700 dark:hover:text-gray-300 transition-colors p-0.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
                          tabIndex={-1}
                          aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                        >
                          {showNewPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </button>
                      </div>
                      {newPassword && newPassword.length < 4 && (
                        <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                          <AlertCircle className="size-3" />
                          Minimum 4 characters required
                        </p>
                      )}
                    </div>

                    {/* Confirm Password */}
                    <div className="space-y-1.5">
                      <label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                        <CheckCircle2 className="size-3.5 text-muted-foreground" />
                        Confirm Password
                      </label>
                      <div className={`relative rounded-xl border transition-all duration-300 ${
                        focusedField === 'confirmPassword'
                          ? 'border-amber-400 dark:border-amber-500 ring-[3px] ring-amber-500/15 shadow-lg shadow-amber-500/10'
                          : confirmPassword && newPassword && confirmPassword !== newPassword
                            ? 'border-red-300 dark:border-red-700 bg-red-50/50 dark:bg-red-900/20'
                            : 'border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50'
                      }`}>
                        <CheckCircle2 className={`absolute left-4 top-1/2 -translate-y-1/2 size-[18px] transition-colors duration-200 ${
                          focusedField === 'confirmPassword' ? 'text-amber-500' : confirmPassword && newPassword && confirmPassword !== newPassword ? 'text-red-500' : 'text-muted-foreground'
                        }`} />
                        <Input
                          id="confirmPassword"
                          type={showConfirmPassword ? 'text' : 'password'}
                          placeholder="Confirm new password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          onFocus={() => setFocusedField('confirmPassword')}
                          onBlur={() => setFocusedField(null)}
                          className="pl-12 pr-12 h-12 border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:outline-none text-sm"
                          disabled={changePasswordLoading}
                          autoComplete="new-password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-gray-700 dark:hover:text-gray-300 transition-colors p-0.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
                          tabIndex={-1}
                          aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                        >
                          {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </button>
                      </div>
                      {confirmPassword && newPassword && confirmPassword !== newPassword && (
                        <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                          <AlertCircle className="size-3" />
                          Passwords do not match
                        </p>
                      )}
                      {confirmPassword && newPassword && confirmPassword === newPassword && newPassword.length >= 4 && (
                        <p className="text-xs text-emerald-500 mt-1 flex items-center gap-1">
                          <CheckCircle2 className="size-3" />
                          Passwords match
                        </p>
                      )}
                    </div>

                    <div className="pt-1">
                      <Button
                        type="submit"
                        disabled={changePasswordLoading || !currentPassword.trim() || !newPassword.trim() || !confirmPassword.trim() || newPassword.length < 4 || newPassword !== confirmPassword}
                        className="w-full h-13 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-semibold text-sm gap-2.5 transition-all duration-300 shadow-lg shadow-amber-600/25 hover:shadow-xl hover:shadow-amber-600/35 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:shadow-none disabled:hover:translate-y-0 rounded-xl"
                      >
                        {changePasswordLoading ? (
                          <><Loader2 className="size-5 animate-spin" /><span>Updating Password...</span></>
                        ) : (
                          <><span>Update Password</span><ArrowRight className="size-4" /></>
                        )}
                      </Button>
                    </div>
                  </form>

                  <div className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground/50">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500/50" />
                    <span>Eservices v3.0</span>
                    <span className="text-muted-foreground/30">|</span>
                    <span>Secured</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes particle-rise {
            0% { transform: translateY(0) scale(1); }
            50% { opacity: 0.3; }
            100% { transform: translateY(-100vh) scale(0.5); opacity: 0; }
          }
          @keyframes glow-pulse {
            0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
            50% { transform: translate(-50%, -50%) scale(1.15); opacity: 0.7; }
          }
        ` }} />
      </div>
    );
  }

  // --- Success State ---
  if (successState) {
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-950 via-green-900 to-teal-950" />
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-1/2 -left-1/4 w-[800px] h-[800px] rounded-full bg-emerald-500/10 login-mesh-1" />
          <div className="absolute -bottom-1/2 -right-1/4 w-[600px] h-[600px] rounded-full bg-teal-400/10 login-mesh-2" />
        </div>
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {PARTICLES.map((p, i) => (
            <div key={`s-${i}`} className="absolute rounded-full" style={{
              width: p.size, height: p.size, left: p.left, bottom: '-20px',
              backgroundColor: p.color, opacity: p.opacity,
              animation: `particle-rise ${p.duration} linear infinite`, animationDelay: p.delay,
            }} />
          ))}
        </div>
        <div className="relative z-10 flex flex-col items-center gap-6">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-emerald-400/20 animate-ping" style={{ animationDuration: '2s' }} />
            <svg width="96" height="96" viewBox="0 0 96 96" fill="none">
              <circle cx="48" cy="48" r="42" stroke="oklch(0.75 0.15 155)" strokeWidth="3" className="login-success-circle" />
              <path d="M28 50L40 62L68 34" stroke="oklch(0.75 0.15 155)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" className="login-success-check" />
            </svg>
          </div>
          <div className="text-center animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
            <h2 className="text-3xl font-bold text-white mb-2">Access Granted!</h2>
            <p className="text-emerald-200/60 text-sm">Loading your workspace...</p>
          </div>
          <div className="w-56 h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-emerald-400 to-teal-400 rounded-full login-progress-fill" />
          </div>
        </div>

        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes particle-rise {
            0% { transform: translateY(0) scale(1); }
            50% { opacity: 0.3; }
            100% { transform: translateY(-100vh) scale(0.5); opacity: 0; }
          }
        ` }} />
      </div>
    );
  }

  // --- Main Login Page ---
  const isBusinessFormValid = clientId.trim() && userId.trim() && password.trim();
  const isSuperAdminFormValid = superEmail.trim() && superPassword.trim();

  return (
    <div className="min-h-screen flex relative overflow-hidden">
      {/* Login Page Toast Notifications */}
      <LoginToastContainer />
      {/* LEFT PANEL */}
      <div className="hidden lg:flex lg:w-[55%] xl:w-[60%] relative bg-gradient-to-br from-emerald-950 via-green-900 to-teal-950 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-1/3 -left-1/4 w-[800px] h-[800px] rounded-full bg-emerald-500/8 login-mesh-1" />
          <div className="absolute -bottom-1/3 -right-1/4 w-[700px] h-[700px] rounded-full bg-teal-400/8 login-mesh-2" />
        </div>
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
        }} />
        <div className="absolute inset-0 pointer-events-none">
          {FLOATING_ICONS.map((item, i) => (
            <div key={i} className="login-particle absolute text-white" style={{
              left: item.x, animationDuration: item.duration, animationDelay: item.delay, opacity: item.opacity,
            }}>
              <item.Icon size={item.size} />
            </div>
          ))}
        </div>
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {PARTICLES.map((p, i) => (
            <div key={`dot-${i}`} className="absolute rounded-full" style={{
              width: p.size, height: p.size, left: p.left, bottom: '-20px',
              backgroundColor: p.color, opacity: p.opacity,
              animation: `particle-rise ${p.duration} linear infinite`, animationDelay: p.delay,
            }} />
          ))}
        </div>

        <div className="relative z-10 flex flex-col justify-between p-10 xl:p-14 w-full">
          <div className={mounted ? 'animate-fade-in-up' : 'opacity-0'}>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex size-12 rounded-xl bg-white/10 border border-white/10 items-center justify-center backdrop-blur-sm">
                <Receipt className="size-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">Eservices</h1>
                <p className="text-emerald-300/60 text-xs font-medium tracking-wide uppercase">POS & Billing System</p>
              </div>
            </div>
          </div>

          <div className="flex-1 flex flex-col justify-center max-w-lg">
            <div className={`${mounted ? 'animate-fade-in-up' : 'opacity-0'}`} style={{ animationDelay: '0.1s' }}>
              <div className="flex items-center gap-2 mb-6">
                <div className="size-2 rounded-full bg-emerald-400 login-pulse-dot" />
                {mounted ? (
                  <>
                    <span className="text-emerald-300/70 text-sm font-medium">{greeting}</span>
                    <span className="text-emerald-400/50 text-sm ml-1">|</span>
                    <span className="text-emerald-300/50 text-sm tabular-nums">{timeStr}</span>
                  </>
                ) : (
                  <span className="text-emerald-300/50 text-sm">Loading...</span>
                )}
              </div>

              <h2 className="text-4xl xl:text-5xl font-bold text-white leading-tight mb-4">
                <span className="block text-white/90">Smart</span>
                <span className="block mt-1" style={{
                  background: 'linear-gradient(135deg, #34d399, #6ee7b7, #5eead4)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                }}>
                  POS & Billing
                </span>
              </h2>
              <p className="text-emerald-100/50 text-base leading-relaxed max-w-md">
                Complete billing solution with inventory management, cash tracking,
                khata book, and professional invoice printing.
              </p>
            </div>

            <div className="mt-10 grid grid-cols-2 gap-3">
              {[
                { icon: Receipt, label: 'A4 & Thermal', desc: 'Professional invoices' },
                { icon: Shield, label: 'Secure Access', desc: 'Role-based control' },
                { icon: FileText, label: 'GST Ready', desc: 'Tax compliant bills' },
                { icon: Sparkles, label: 'All-in-One', desc: 'Inventory, cash & more' },
              ].map((feature, i) => (
                <div key={feature.label}
                  className={`${mounted ? 'animate-fade-in-up' : 'opacity-0'} login-feature-card flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.06]`}
                  style={{ animationDelay: `${0.2 + i * 0.08}s` }}
                >
                  <div className="flex size-9 shrink-0 rounded-lg bg-white/[0.08] items-center justify-center">
                    <feature.icon className="size-4 text-emerald-300/80" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-white/90 text-sm font-medium truncate">{feature.label}</p>
                    <p className="text-emerald-200/40 text-xs truncate">{feature.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={`${mounted ? 'animate-fade-in-up' : 'opacity-0'}`} style={{ animationDelay: '0.6s' }}>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Shield className="size-4 text-emerald-400/60" />
                <span className="text-emerald-200/40 text-xs">256-bit Encrypted</span>
              </div>
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-emerald-400/60" />
                <span className="text-emerald-200/40 text-xs">v3.0 — Eservices</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL — Login Form */}
      <div className="w-full lg:w-[45%] xl:w-[40%] relative bg-white dark:bg-gray-950 flex items-center justify-center p-6 sm:p-8 lg:p-12">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-emerald-50 to-transparent dark:from-emerald-950/20 dark:to-transparent rounded-bl-full pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-teal-50 to-transparent dark:from-teal-950/20 dark:to-transparent rounded-tr-full pointer-events-none" />

        <div className="absolute pointer-events-none rounded-full" style={{
          width: '400px', height: '400px',
          background: 'radial-gradient(circle, rgba(16,185,129,0.12) 0%, rgba(20,184,166,0.06) 40%, transparent 70%)',
          top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          animation: 'glow-pulse 4s ease-in-out infinite', filter: 'blur(40px)',
        }} />

        <div className="relative z-10 w-full max-w-[420px]">
          {/* Mobile Logo */}
          <div className={`lg:hidden flex flex-col items-center mb-8 ${mounted ? 'animate-fade-in-up' : 'opacity-0'}`}>
            <div className="flex size-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 items-center justify-center shadow-lg shadow-emerald-600/25 mb-3 overflow-hidden">
              <img src="/icon-192.png" alt="Eservices" className="size-10 rounded-xl object-cover" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Eservices</h1>
            <p className="text-muted-foreground text-xs mt-0.5">POS & Billing System</p>
          </div>

          <div className={`${mounted ? 'animate-login-slide-up' : 'opacity-0'} ${shake ? 'login-shake' : ''}`} style={{ animationDelay: '0.15s' }}>
            <div className="animated-border rounded-2xl p-[2px]">
              <div className="rounded-[14px] bg-white dark:bg-gray-950 p-6 sm:p-8">
                {/* Header */}
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex size-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 items-center justify-center">
                      {isSuperAdminMode ? (
                        <Shield className="size-4 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <Lock className="size-4 text-emerald-600 dark:text-emerald-400" />
                      )}
                    </div>
                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                      {isSuperAdminMode ? 'Super Admin' : 'Secure Login'}
                    </span>
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{mounted ? greeting : 'Welcome'}</h2>
                  <p className="text-muted-foreground text-sm">
                    {isSuperAdminMode
                      ? 'Sign in with your admin credentials'
                      : 'Enter your credentials to access the system'
                    }
                  </p>
                </div>

                {/* Clock */}
                <div className="flex items-center gap-3 mb-5 p-3 rounded-xl bg-gradient-to-r from-emerald-50/80 to-teal-50/80 dark:from-emerald-950/30 dark:to-teal-950/30 border border-emerald-100/60 dark:border-emerald-800/40">
                  <div className="flex size-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 items-center justify-center">
                    <span className="text-lg font-bold text-emerald-700 dark:text-emerald-300 tabular-nums leading-none">
                      {mounted ? currentTime.getDate() : '--'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-emerald-800 dark:text-emerald-300">{mounted ? dateStr : 'Loading...'}</p>
                    <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                      {mounted ? timeStr : '--:--:-- --'}
                    </p>
                  </div>
                  <div className="w-2 h-2 rounded-full bg-emerald-500 login-pulse-dot" />
                </div>

                {locked ? (
                  <div className="text-center py-10">
                    <div className="relative inline-flex size-20 items-center justify-center rounded-full bg-red-50 dark:bg-red-950/30 mb-4">
                      <div className="absolute inset-0 rounded-full border-2 border-red-200 dark:border-red-800/50 animate-ping opacity-30" />
                      <Lock className="size-8 text-red-500" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Account Locked</h3>
                    <p className="text-sm text-muted-foreground mb-4">Too many failed login attempts</p>
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-50 dark:bg-red-950/30">
                      <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                      <span className="text-xl font-bold text-red-500 tabular-nums">{lockTimer}s</span>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleLogin} className="space-y-4">
                    {isSuperAdminMode ? (
                      <>
                        {/* Super Admin: Email */}
                        <div className="space-y-1.5">
                          <label htmlFor="superEmail" className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                            <Mail className="size-3.5 text-muted-foreground" />
                            Email
                          </label>
                          <div className={`relative rounded-xl border transition-all duration-300 ${
                            focusedField === 'superEmail'
                              ? 'border-emerald-400 dark:border-emerald-500 ring-[3px] ring-emerald-500/15 shadow-lg shadow-emerald-500/10'
                              : 'border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50'
                          }`}>
                            <Mail className={`absolute left-4 top-1/2 -translate-y-1/2 size-[18px] transition-colors duration-200 ${
                              focusedField === 'superEmail' ? 'text-emerald-500' : 'text-muted-foreground'
                            }`} />
                            <Input
                              ref={superEmailRef}
                              id="sa-email-field"
                              name="sa-email-xyz"
                              type="email"
                              placeholder="Enter your email"
                              value={superEmail}
                              onChange={(e) => setSuperEmail(e.target.value)}
                              onFocus={() => setFocusedField('superEmail')}
                              onBlur={() => setFocusedField(null)}
                              onKeyDown={(e) => handleKeyDown(e, superPassRef)}
                              className="pl-12 pr-10 h-12 border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:outline-none text-sm"
                              disabled={loading}
                              autoComplete="new-password"
                              data-1p-ignore
                              data-lpignore="true"
                              data-form-type="other"
                              maxLength={100}
                            />
                            {superEmail && (
                              <CheckCircle2 className="absolute right-3.5 top-1/2 -translate-y-1/2 size-4 text-emerald-500 animate-scale-in" />
                            )}
                          </div>
                        </div>

                        {/* Super Admin: Password */}
                        <div className="space-y-1.5">
                          <label htmlFor="superPassword" className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                            <Lock className="size-3.5 text-muted-foreground" />
                            Password
                          </label>
                          <div className={`relative rounded-xl border transition-all duration-300 ${
                            focusedField === 'superPassword'
                              ? 'border-emerald-400 dark:border-emerald-500 ring-[3px] ring-emerald-500/15 shadow-lg shadow-emerald-500/10'
                              : 'border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50'
                          }`}>
                            <Lock className={`absolute left-4 top-1/2 -translate-y-1/2 size-[18px] transition-colors duration-200 ${
                              focusedField === 'superPassword' ? 'text-emerald-500' : 'text-muted-foreground'
                            }`} />
                            <Input
                              ref={superPassRef}
                              id="superPassword"
                              type={showSuperPassword ? 'text' : 'password'}
                              placeholder="Enter your password"
                              value={superPassword}
                              onChange={(e) => setSuperPassword(e.target.value)}
                              onFocus={() => setFocusedField('superPassword')}
                              onBlur={() => setFocusedField(null)}
                              className="pl-12 pr-12 h-12 border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:outline-none text-sm tracking-wide"
                              disabled={loading}
                              autoComplete="off"
                              data-1p-ignore
                              data-lpignore="true"
                            />
                            {superPassword && (
                              <CheckCircle2 className="absolute right-11 top-1/2 -translate-y-1/2 size-4 text-emerald-500 animate-scale-in" />
                            )}
                            <button
                              type="button"
                              onClick={() => setShowSuperPassword(!showSuperPassword)}
                              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-gray-700 dark:hover:text-gray-300 transition-colors p-0.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
                              tabIndex={-1}
                              aria-label={showSuperPassword ? 'Hide password' : 'Show password'}
                            >
                              {showSuperPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                            </button>
                          </div>
                        </div>
                        {/* Forgot Password & Forgot Login ID Links */}
                        <div className="flex justify-between items-center">
                          <button
                            type="button"
                            onClick={handleForgotLoginIdOpen}
                            className="text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 font-medium transition-colors"
                          >
                            Forgot Login ID?
                          </button>
                          <button
                            type="button"
                            onClick={() => { setShowForgotPassword(true); setForgotStep('email'); }}
                            className="text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 font-medium transition-colors"
                          >
                            Forgot Password?
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        {/* Business Login: Client ID */}
                        <div className="space-y-1.5">
                          <label htmlFor="clientId" className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                            <Building2 className="size-3.5 text-muted-foreground" />
                            Client ID
                          </label>
                          <div className={`relative rounded-xl border transition-all duration-300 ${
                            focusedField === 'clientId'
                              ? 'border-emerald-400 dark:border-emerald-500 ring-[3px] ring-emerald-500/15 shadow-lg shadow-emerald-500/10'
                              : 'border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50'
                          }`}>
                            <Building2 className={`absolute left-4 top-1/2 -translate-y-1/2 size-[18px] transition-colors duration-200 ${
                              focusedField === 'clientId' ? 'text-emerald-500' : 'text-muted-foreground'
                            }`} />
                            <Input
                              ref={clientIdRef}
                              id="clientId"
                              type="text"
                              placeholder="Enter Client ID"
                              value={clientId}
                              onChange={(e) => setClientId(e.target.value.toUpperCase())}
                              onFocus={() => setFocusedField('clientId')}
                              onBlur={() => setFocusedField(null)}
                              onKeyDown={(e) => handleKeyDown(e, userIdRef)}
                              className="pl-12 pr-10 h-12 border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:outline-none text-sm uppercase"
                              disabled={loading}
                              autoComplete="organization"
                              maxLength={20}
                            />
                            {clientId && (
                              <CheckCircle2 className="absolute right-3.5 top-1/2 -translate-y-1/2 size-4 text-emerald-500 animate-scale-in" />
                            )}
                          </div>
                        </div>

                        {/* Business Login: User ID */}
                        <div className="space-y-1.5">
                          <label htmlFor="loginId" className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                            <User className="size-3.5 text-muted-foreground" />
                            User ID
                          </label>
                          <div className={`relative rounded-xl border transition-all duration-300 ${
                            focusedField === 'userId'
                              ? 'border-emerald-400 dark:border-emerald-500 ring-[3px] ring-emerald-500/15 shadow-lg shadow-emerald-500/10'
                              : 'border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50'
                          }`}>
                            <User className={`absolute left-4 top-1/2 -translate-y-1/2 size-[18px] transition-colors duration-200 ${
                              focusedField === 'userId' ? 'text-emerald-500' : 'text-muted-foreground'
                            }`} />
                            <Input
                              ref={userIdRef}
                              id="loginId"
                              type="text"
                              placeholder="Enter your User ID"
                              value={userId}
                              onChange={(e) => setUserId(e.target.value.toLowerCase())}
                              onFocus={() => setFocusedField('userId')}
                              onBlur={() => setFocusedField(null)}
                              onKeyDown={(e) => handleKeyDown(e, passRef)}
                              className="pl-12 pr-10 h-12 border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:outline-none text-sm"
                              disabled={loading}
                              autoComplete="username"
                              maxLength={30}
                            />
                            {userId && (
                              <CheckCircle2 className="absolute right-3.5 top-1/2 -translate-y-1/2 size-4 text-emerald-500 animate-scale-in" />
                            )}
                          </div>
                        </div>

                        {/* Business Login: Password */}
                        <div className="space-y-1.5">
                          <label htmlFor="password" className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                            <Lock className="size-3.5 text-muted-foreground" />
                            Password
                          </label>
                          <div className={`relative rounded-xl border transition-all duration-300 ${
                            focusedField === 'password'
                              ? 'border-emerald-400 dark:border-emerald-500 ring-[3px] ring-emerald-500/15 shadow-lg shadow-emerald-500/10'
                              : 'border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50'
                          }`}>
                            <Lock className={`absolute left-4 top-1/2 -translate-y-1/2 size-[18px] transition-colors duration-200 ${
                              focusedField === 'password' ? 'text-emerald-500' : 'text-muted-foreground'
                            }`} />
                            <Input
                              ref={passRef}
                              id="password"
                              type={showPassword ? 'text' : 'password'}
                              placeholder="Enter your password"
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              onFocus={() => setFocusedField('password')}
                              onBlur={() => setFocusedField(null)}
                              className="pl-12 pr-12 h-12 border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:outline-none text-sm tracking-wide"
                              disabled={loading}
                              autoComplete="current-password"
                            />
                            {password && (
                              <CheckCircle2 className="absolute right-11 top-1/2 -translate-y-1/2 size-4 text-emerald-500 animate-scale-in" />
                            )}
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-gray-700 dark:hover:text-gray-300 transition-colors p-0.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
                              tabIndex={-1}
                              aria-label={showPassword ? 'Hide password' : 'Show password'}
                            >
                              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                            </button>
                          </div>
                        </div>
                      </>
                    )}

                    {/* Attempt counter */}
                    {attempts > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-50/80 dark:bg-red-950/20 border border-red-100/60 dark:border-red-800/30 animate-scale-in">
                            <Lock className="size-3 text-red-500 shrink-0" />
                            <span className="text-xs text-red-600 dark:text-red-400 font-medium tabular-nums">
                              {attempts}/5 failed attempt{attempts > 1 ? 's' : ''}
                            </span>
                          </div>
                          <span className="text-[10px] text-red-500 font-medium tabular-nums">
                            {5 - attempts} remaining
                          </span>
                        </div>
                        <div className="h-1 bg-red-100 dark:bg-red-900/30 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-red-400 to-red-500 rounded-full transition-all duration-500 ease-out"
                            style={{ width: `${(attempts / 5) * 100}%` }} />
                        </div>
                      </div>
                    )}

                    <div className="pt-1">
                      <Button
                        type="submit"
                        disabled={loading || (isSuperAdminMode ? !isSuperAdminFormValid : !isBusinessFormValid)}
                        className="w-full h-13 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white font-semibold text-sm gap-2.5 transition-all duration-300 shadow-lg shadow-emerald-600/25 hover:shadow-xl hover:shadow-emerald-600/35 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:shadow-none disabled:hover:translate-y-0 rounded-xl"
                      >
                        {loading ? (
                          <><Loader2 className="size-5 animate-spin" /><span>Authenticating...</span></>
                        ) : (
                          <><span>Sign In</span><ArrowRight className="size-4" /></>
                        )}
                      </Button>
                    </div>

                    <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground/60 transition-all duration-500"
                      style={{ opacity: showEnterHint ? 1 : 0, transform: showEnterHint ? 'translateY(0)' : 'translateY(4px)' }}>
                      <Keyboard className="size-3" />
                      <span>Press Enter to sign in</span>
                      <kbd className="inline-flex items-center px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-[10px] font-mono font-medium text-gray-500 dark:text-gray-400 ml-0.5">↵</kbd>
                    </div>
                  </form>
                )}

                {/* Mode toggle */}
                <div className="mt-5 pt-4 border-t border-gray-100 dark:border-gray-800/60">
                  <button
                    type="button"
                    onClick={() => {
                      setIsSuperAdminMode(!isSuperAdminMode);
                      setAttempts(0);
                    }}
                    className="w-full flex items-center justify-center gap-2 text-xs text-muted-foreground/60 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors duration-200 group py-1"
                  >
                    {isSuperAdminMode ? (
                      <>
                        <Building2 className="size-3.5 group-hover:scale-110 transition-transform" />
                        <span>Business Login</span>
                        <ArrowRight className="size-3 rotate-180 group-hover:-translate-x-0.5 transition-transform" />
                      </>
                    ) : (
                      <>
                        <Shield className="size-3.5 group-hover:scale-110 transition-transform" />
                        <span>Super Admin Login</span>
                        <ArrowRight className="size-3 group-hover:translate-x-0.5 transition-transform" />
                      </>
                    )}
                  </button>
                </div>

                <div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground/50">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/50" />
                  <span>Eservices v3.0</span>
                  <span className="text-muted-foreground/30">|</span>
                  <span>Secured</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Forgot Password Dialog */}
      <Dialog open={showForgotPassword} onOpenChange={(open) => { if (!open) resetForgotPassword(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1">
              <div className="flex size-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 items-center justify-center">
                <KeyRound className="size-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                Account Recovery
              </span>
            </div>
            <DialogTitle className="text-xl font-bold text-gray-900 dark:text-white">
              Forgot Password
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-sm">
              {forgotStep === 'email' && 'Enter your email to recover your account.'}
              {forgotStep === 'answer' && 'Answer your security question to verify your identity.'}
              {forgotStep === 'reset' && 'Set your new password.'}
            </DialogDescription>
          </DialogHeader>

          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-2">
            <div className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${forgotStep === 'email' ? 'bg-emerald-500' : 'bg-emerald-500/70'}`} />
            <div className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${forgotStep === 'answer' ? 'bg-emerald-500' : forgotStep === 'reset' ? 'bg-emerald-500/70' : 'bg-gray-200 dark:bg-gray-700'}`} />
            <div className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${forgotStep === 'reset' ? 'bg-emerald-500' : 'bg-gray-200 dark:bg-gray-700'}`} />
          </div>

          {/* Step: Email */}
          {forgotStep === 'email' && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="forgotEmail" className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                  <Mail className="size-3.5 text-muted-foreground" />
                  Email Address
                </label>
                <div className="relative rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 focus-within:border-emerald-400 dark:focus-within:border-emerald-500 focus-within:ring-[3px] focus-within:ring-emerald-500/15 transition-all duration-300">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 size-[18px] text-muted-foreground" />
                  <Input
                    id="forgotEmail"
                    type="email"
                    placeholder="Enter your email address"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    className="pl-12 pr-4 h-12 border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:outline-none text-sm"
                    disabled={forgotLoading}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleForgotPasswordGetQuestion(); }}
                  />
                </div>
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetForgotPassword}
                  disabled={forgotLoading}
                  className="rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleForgotPasswordGetQuestion}
                  disabled={forgotLoading || !forgotEmail.trim()}
                  className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold gap-2 rounded-xl transition-all duration-300 shadow-lg shadow-emerald-600/25"
                >
                  {forgotLoading ? (
                    <><Loader2 className="size-4 animate-spin" /><span>Fetching...</span></>
                  ) : (
                    <><span>Next</span><ArrowRight className="size-4" /></>
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}

          {/* Step: Answer Security Question */}
          {forgotStep === 'answer' && (
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-100/60 dark:border-emerald-800/40">
                <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 mb-1">Security Question</p>
                <p className="text-sm text-emerald-900 dark:text-emerald-200 font-medium">{forgotSecurityQuestion}</p>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="forgotAnswer" className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                  <Shield className="size-3.5 text-muted-foreground" />
                  Your Answer
                </label>
                <div className="relative rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 focus-within:border-emerald-400 dark:focus-within:border-emerald-500 focus-within:ring-[3px] focus-within:ring-emerald-500/15 transition-all duration-300">
                  <Shield className="absolute left-4 top-1/2 -translate-y-1/2 size-[18px] text-muted-foreground" />
                  <Input
                    id="forgotAnswer"
                    type="text"
                    placeholder="Enter your security answer"
                    value={forgotSecurityAnswer}
                    onChange={(e) => setForgotSecurityAnswer(e.target.value)}
                    className="pl-12 pr-4 h-12 border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:outline-none text-sm"
                    disabled={forgotLoading}
                    onKeyDown={(e) => { if (e.key === 'Enter' && forgotSecurityAnswer.trim()) handleVerifySecurityAnswer(); }}
                  />
                </div>
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetForgotPassword}
                  disabled={forgotLoading}
                  className="rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleVerifySecurityAnswer}
                  disabled={!forgotSecurityAnswer.trim() || forgotLoading}
                  className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold gap-2 rounded-xl transition-all duration-300 shadow-lg shadow-emerald-600/25"
                >
                  {forgotLoading ? <><Loader2 className="size-4 animate-spin" /><span>Verifying...</span></> : <><span>Next</span><ArrowRight className="size-4" /></>}
                </Button>
              </DialogFooter>
            </div>
          )}

          {/* Step: Reset Password */}
          {forgotStep === 'reset' && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="forgotNewPassword" className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                  <KeyRound className="size-3.5 text-muted-foreground" />
                  New Password
                </label>
                <div className="relative rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 focus-within:border-emerald-400 dark:focus-within:border-emerald-500 focus-within:ring-[3px] focus-within:ring-emerald-500/15 transition-all duration-300">
                  <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 size-[18px] text-muted-foreground" />
                  <Input
                    id="forgotNewPassword"
                    type="password"
                    placeholder="Enter new password (min 6 chars)"
                    value={forgotNewPassword}
                    onChange={(e) => setForgotNewPassword(e.target.value)}
                    className="pl-12 pr-4 h-12 border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:outline-none text-sm"
                    disabled={forgotLoading}
                  />
                </div>
                {forgotNewPassword && forgotNewPassword.length < 6 && (
                  <p className="text-xs text-red-500 flex items-center gap-1">
                    <AlertCircle className="size-3" />
                    Minimum 6 characters required
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <label htmlFor="forgotConfirmPassword" className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5 text-muted-foreground" />
                  Confirm Password
                </label>
                <div className={`relative rounded-xl border transition-all duration-300 ${
                  forgotConfirmPassword && forgotNewPassword && forgotConfirmPassword !== forgotNewPassword
                    ? 'border-red-300 dark:border-red-700 bg-red-50/50 dark:bg-red-900/20'
                    : 'border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50'
                }`}>
                  <CheckCircle2 className={`absolute left-4 top-1/2 -translate-y-1/2 size-[18px] ${
                    forgotConfirmPassword && forgotNewPassword && forgotConfirmPassword !== forgotNewPassword ? 'text-red-500' : 'text-muted-foreground'
                  }`} />
                  <Input
                    id="forgotConfirmPassword"
                    type="password"
                    placeholder="Confirm new password"
                    value={forgotConfirmPassword}
                    onChange={(e) => setForgotConfirmPassword(e.target.value)}
                    className="pl-12 pr-4 h-12 border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:outline-none text-sm"
                    disabled={forgotLoading}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleForgotPasswordReset(); }}
                  />
                </div>
                {forgotConfirmPassword && forgotNewPassword && forgotConfirmPassword !== forgotNewPassword && (
                  <p className="text-xs text-red-500 flex items-center gap-1">
                    <AlertCircle className="size-3" />
                    Passwords do not match
                  </p>
                )}
                {forgotConfirmPassword && forgotNewPassword && forgotConfirmPassword === forgotNewPassword && forgotNewPassword.length >= 6 && (
                  <p className="text-xs text-emerald-500 flex items-center gap-1">
                    <CheckCircle2 className="size-3" />
                    Passwords match
                  </p>
                )}
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetForgotPassword}
                  disabled={forgotLoading}
                  className="rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleForgotPasswordReset}
                  disabled={forgotLoading || !forgotNewPassword || forgotNewPassword.length < 6 || forgotNewPassword !== forgotConfirmPassword}
                  className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold gap-2 rounded-xl transition-all duration-300 shadow-lg shadow-emerald-600/25"
                >
                  {forgotLoading ? (
                    <><Loader2 className="size-4 animate-spin" /><span>Resetting...</span></>
                  ) : (
                    <><span>Reset Password</span><KeyRound className="size-4" /></>
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Forgot Login ID Dialog */}
      <Dialog open={showForgotLoginId} onOpenChange={(open) => { if (!open) resetForgotLoginId(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1">
              <div className="flex size-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 items-center justify-center">
                <Mail className="size-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                Login Recovery
              </span>
            </div>
            <DialogTitle className="text-xl font-bold text-gray-900 dark:text-white">
              Forgot Login ID
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-sm">
              {forgotLoginIdStep === 'answer' && 'Answer your security question to recover your Login ID.'}
              {forgotLoginIdStep === 'result' && 'Your Login ID has been recovered.'}
            </DialogDescription>
          </DialogHeader>

          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-2">
            <div className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${forgotLoginIdStep === 'answer' ? 'bg-emerald-500' : 'bg-emerald-500/70'}`} />
            <div className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${forgotLoginIdStep === 'result' ? 'bg-emerald-500' : 'bg-gray-200 dark:bg-gray-700'}`} />
          </div>

          {/* Step: Answer Security Question */}
          {forgotLoginIdStep === 'answer' && (
            <div className="space-y-4">
              {forgotLoginIdLoading && !forgotLoginIdQuestion ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="size-6 animate-spin text-emerald-500" />
                  <span className="ml-2 text-sm text-muted-foreground">Loading security question...</span>
                </div>
              ) : (
                <>
                  <div className="p-3 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-100/60 dark:border-emerald-800/40">
                    <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 mb-1">Security Question</p>
                    <p className="text-sm text-emerald-900 dark:text-emerald-200 font-medium">{forgotLoginIdQuestion}</p>
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="forgotLoginIdAnswer" className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                      <Shield className="size-3.5 text-muted-foreground" />
                      Your Answer
                    </label>
                    <div className="relative rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 focus-within:border-emerald-400 dark:focus-within:border-emerald-500 focus-within:ring-[3px] focus-within:ring-emerald-500/15 transition-all duration-300">
                      <Shield className="absolute left-4 top-1/2 -translate-y-1/2 size-[18px] text-muted-foreground" />
                      <Input
                        id="forgotLoginIdAnswer"
                        type="text"
                        placeholder="Enter your security answer"
                        value={forgotLoginIdAnswer}
                        onChange={(e) => setForgotLoginIdAnswer(e.target.value)}
                        className="pl-12 pr-4 h-12 border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:outline-none text-sm"
                        disabled={forgotLoginIdLoading}
                        onKeyDown={(e) => { if (e.key === 'Enter' && forgotLoginIdAnswer.trim()) handleForgotLoginIdSubmit(); }}
                      />
                    </div>
                  </div>
                </>
              )}
              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetForgotLoginId}
                  disabled={forgotLoginIdLoading}
                  className="rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleForgotLoginIdSubmit}
                  disabled={forgotLoginIdLoading || !forgotLoginIdAnswer.trim() || !forgotLoginIdQuestion}
                  className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold gap-2 rounded-xl transition-all duration-300 shadow-lg shadow-emerald-600/25"
                >
                  {forgotLoginIdLoading ? (
                    <><Loader2 className="size-4 animate-spin" /><span>Verifying...</span></>
                  ) : (
                    <><span>Recover Login ID</span><ArrowRight className="size-4" /></>
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}

          {/* Step: Result — Show recovered email */}
          {forgotLoginIdStep === 'result' && (
            <div className="space-y-4">
              <div className="flex items-center justify-center mb-2">
                <div className="relative">
                  <div className="flex size-16 rounded-full bg-emerald-100 dark:bg-emerald-900/40 items-center justify-center">
                    <CheckCircle2 className="size-8 text-emerald-600 dark:text-emerald-400" />
                  </div>
                </div>
              </div>
              <div className="text-center mb-2">
                <p className="text-sm text-muted-foreground mb-1">Hello, <span className="font-semibold text-gray-900 dark:text-white">{recoveredName}</span></p>
                <p className="text-xs text-muted-foreground">Your Login ID (email) is shown below</p>
              </div>
              <div className="p-4 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-100/60 dark:border-emerald-800/40">
                <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 mb-2">Your Login ID</p>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-lg font-bold text-emerald-900 dark:text-emerald-200 break-all">{recoveredEmail}</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCopyEmail}
                    className="shrink-0 rounded-lg gap-1.5 h-8 px-3 text-xs"
                  >
                    {emailCopied ? (
                      <><Check className="size-3.5 text-emerald-500" /><span className="text-emerald-600">Copied</span></>
                    ) : (
                      <><Copy className="size-3.5" /><span>Copy</span></>
                    )}
                  </Button>
                </div>
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  type="button"
                  onClick={() => {
                    resetForgotLoginId();
                    setSuperEmail(recoveredEmail);
                  }}
                  className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold gap-2 rounded-xl transition-all duration-300 shadow-lg shadow-emerald-600/25"
                >
                  <><span>Back to Login</span><ArrowRight className="size-4" /></>
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes particle-rise {
          0% { transform: translateY(0) scale(1); }
          50% { opacity: 0.3; }
          100% { transform: translateY(-100vh) scale(0.5); opacity: 0; }
        }
        @keyframes glow-pulse {
          0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
          50% { transform: translate(-50%, -50%) scale(1.15); opacity: 0.7; }
        }
      ` }} />
    </div>
  );
}
