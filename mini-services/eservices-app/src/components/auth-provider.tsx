'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { clearAllNotifications } from '@/lib/notification-store';

export interface UserSession {
  unitCode: string;
  unitName: string;
  userId: string;
  loginId: string;
  name: string;
  role: string;
  permissions: Record<string, Record<string, boolean>>;
  mustChangePassword?: boolean;
  isSuperAdmin?: boolean;
}

export interface SuperAdminUser {
  id: string;
  email: string;
  name: string;
  isSuperAdmin: true;
}

interface AuthContextType {
  isAuthenticated: boolean;
  currentUser: UserSession | null;
  token: string | null;
  login: (token: string, user: UserSession) => void;
  logout: () => void;
  switchUser: (token: string, user: UserSession) => void;
  hasPermission: (module: string, action: string) => boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  refreshSession: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  currentUser: null,
  token: null,
  login: () => {},
  logout: () => {},
  switchUser: () => {},
  hasPermission: () => false,
  isAdmin: false,
  isSuperAdmin: false,
  refreshSession: async () => false,
});

export function useAuth() {
  return useContext(AuthContext);
}

const SESSION_KEY = 'eservices_session';
const ORIGINAL_SESSION_KEY = 'eservices_original_session';

// Refresh the session every 30 minutes to keep the JWT alive (rolling refresh).
// As long as the user is active, their token will be renewed before expiry.
const SESSION_REFRESH_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<UserSession | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Ref to track the current token without triggering re-renders
  const tokenRef = useRef<string | null>(null);
  // Ref to track currentUser for use in interval callbacks without adding it to deps
  const currentUserRef = useRef<UserSession | null>(null);
  useEffect(() => { currentUserRef.current = currentUser; }, [currentUser]);

  const isAuthenticated = currentUser !== null;
  const isAdmin = currentUser?.role === 'Admin';
  const isSuperAdmin = currentUser?.isSuperAdmin === true;

  // Helper: persist session to localStorage (permanent across tab closes)
  const persistSession = useCallback((tok: string, user: UserSession) => {
    try {
      const existing = localStorage.getItem(SESSION_KEY);
      let loginTime: string;
      try {
        const parsed = JSON.parse(existing || '{}');
        loginTime = parsed.loginTime || new Date().toISOString();
      } catch {
        loginTime = new Date().toISOString();
      }
      localStorage.setItem(SESSION_KEY, JSON.stringify({
        token: tok,
        user,
        loginTime,
      }));
    } catch {
      // localStorage unavailable
    }
  }, []);

  // Helper: clear session from localStorage
  const clearSession = useCallback(() => {
    try {
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(ORIGINAL_SESSION_KEY);
    } catch {
      // localStorage unavailable
    }
  }, []);

  // Restore session on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(SESSION_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.token && parsed?.user) {
          // Validate token with server AND fetch fresh permissions from DB.
          // The server also returns a renewed token (rolling refresh).
          // Use AbortController with a 10-second timeout so the app doesn't hang
          // indefinitely when the server is unreachable (common with OOM issues).
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000);
          fetch('/api/auth/session', {
            headers: { 'Authorization': `Bearer ${parsed.token}` },
            signal: controller.signal,
          })
            .then(async (res) => {
              clearTimeout(timeoutId);
              // Check HTTP status before parsing JSON
              if (!res.ok) {
                // HTTP error (401, 403, 500, etc.) — clear session for auth errors,
                // but keep stale session for server errors (temporary issues)
                if (res.status === 401 || res.status === 403) {
                  clearSession();
                  clearAllNotifications();
                  tokenRef.current = null;
                  setToken(null);
                  setCurrentUser(null);
                }
                // For 500 and other server errors, silently keep the stored session
                // (the server might be temporarily unavailable)
                return;
              }
              // Parse JSON only for successful responses
              const data = await res.json();
              if (data.valid && data.user) {
                // Use the renewed token from server (if provided), otherwise keep existing
                const newToken = data.token || parsed.token;
                tokenRef.current = newToken;
                setToken(newToken);
                setCurrentUser(data.user);
                persistSession(newToken, data.user);
              } else if (data.expired || data.suspended || data.userSuspended) {
                // Subscription expired, account suspended, or user deactivated - clear session
                clearSession();
                clearAllNotifications();
                tokenRef.current = null;
                setToken(null);
                setCurrentUser(null);
              } else {
                // Invalid or unrecognized response — clear session for safety
                clearSession();
                clearAllNotifications();
                tokenRef.current = null;
                setToken(null);
                setCurrentUser(null);
              }
            })
            .catch((err) => {
              clearTimeout(timeoutId);
              // Only restore stored session on network errors or abort (timeout/offline).
              // Do NOT restore on JSON parse errors from non-ok responses
              // (those are handled in the .then() block above).
              const isNetworkError = err instanceof DOMException && err.name === 'AbortError';
              const isFetchError = err instanceof TypeError; // network error, DNS failure, etc.
              if (isNetworkError || isFetchError) {
                // Network error or timeout: use stored session data as fallback
                // (the server might be temporarily unreachable)
                tokenRef.current = parsed.token;
                setToken(parsed.token);
                setCurrentUser(parsed.user);
              }
              // For other errors (shouldn't happen), don't restore stale session
            });
        }
      }
    } catch {
      // invalid session
    }
  }, [persistSession, clearSession]);

  // Periodic session refresh to keep the JWT alive (rolling refresh).
  // Runs every SESSION_REFRESH_INTERVAL_MS while the user is authenticated.
  // NOTE: Uses tokenRef for the Authorization header so the effect doesn't need to
  // depend on `token` state. This prevents the interval from restarting on every
  // token change (which caused cascade re-renders → Settings input overwrites).
  useEffect(() => {
    // Clear any existing timer
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }

    if (!isAuthenticated) return;

    const doRefresh = async () => {
      const currentToken = tokenRef.current;
      if (!currentToken) return;
      try {
        // Add 10-second timeout to prevent hanging on unresponsive server
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        try {
          const res = await fetch('/api/auth/session', {
            headers: { 'Authorization': `Bearer ${currentToken}` },
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
          if (res.ok) {
          const data = await res.json();
          if (data.valid && data.user) {
            const newToken = data.token || currentToken;
            // Update ref + localStorage always; state only if user changed
            tokenRef.current = newToken;
            persistSession(newToken, data.user);
            const curUser = currentUserRef.current;
            const userChanged = !curUser ||
              curUser.userId !== data.user.userId ||
              curUser.role !== data.user.role ||
              curUser.unitCode !== data.user.unitCode ||
              JSON.stringify(curUser.permissions) !== JSON.stringify(data.user.permissions);
            if (userChanged) {
              setToken(newToken);
              setCurrentUser(data.user);
            }
          } else if (data.expired || data.suspended || data.userSuspended) {
            // Subscription expired, account suspended, or user deactivated — force logout
            clearSession();
            clearAllNotifications();
            tokenRef.current = null;
            setToken(null);
            setCurrentUser(null);
          }
          // If neither valid nor expired/suspended, keep current session
          // (e.g., temporary server error — don't log out)
        } else if (res.status === 401) {
          // Token is invalid or expired — force logout to prevent stale sessions
          // that could show wrong unitCode/unitName ("default system")
          clearSession();
          clearAllNotifications();
          tokenRef.current = null;
          setToken(null);
          setCurrentUser(null);
        }
        } catch {
          clearTimeout(timeoutId);
          // Network error or timeout — don't log out, keep current session
        }
      } catch {
        // Unexpected error — don't log out, keep current session
      }
    };

    // Start periodic refresh
    refreshTimerRef.current = setInterval(doRefresh, SESSION_REFRESH_INTERVAL_MS);

    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, [isAuthenticated, persistSession, clearSession]);

  const login = useCallback((newToken: string, user: UserSession) => {
    persistSession(newToken, user);
    tokenRef.current = newToken;
    // Only update React state if the user identity actually changed.
    // JWT tokens are regenerated on every server response (new iat/exp), so calling
    // setToken() on every session refresh triggers a cascade: token changes → effects
    // re-run (SyncProvider, auto-rotate, etc.) → dataVersion bumps → Settings re-fetches
    // and overwrites user input. By only updating state when the user truly changed,
    // we avoid these cascade re-renders while still keeping the token fresh in
    // the ref + localStorage for subsequent API calls.
    const curUser = currentUserRef.current;
    const userChanged = !curUser ||
      curUser.userId !== user.userId ||
      curUser.role !== user.role ||
      curUser.unitCode !== user.unitCode ||
      curUser.loginId !== user.loginId ||
      JSON.stringify(curUser.permissions) !== JSON.stringify(user.permissions);
    if (userChanged) {
      setToken(newToken);
      setCurrentUser(user);
    }
  }, [persistSession]);

  const switchUser = useCallback((newToken: string, user: UserSession) => {
    try {
      const currentSession = localStorage.getItem(SESSION_KEY);
      if (currentSession) {
        try {
          const parsed = JSON.parse(currentSession);
          localStorage.setItem(ORIGINAL_SESSION_KEY, JSON.stringify({
            token: parsed.token,
            user: parsed.user,
            loginTime: parsed.loginTime,
          }));
        } catch {
          // ignore
        }
      }
      localStorage.setItem(SESSION_KEY, JSON.stringify({
        token: newToken,
        user,
        loginTime: new Date().toISOString(),
        switchedFrom: true,
      }));
    } catch {
      // localStorage unavailable
    }
    tokenRef.current = newToken;
    setToken(newToken);
    setCurrentUser(user);
  }, []);

  const logout = useCallback(() => {
    try {
      const stored = localStorage.getItem(SESSION_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.token) {
          fetch('/api/auth/logout', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${parsed.token}` },
          }).catch(() => {});
        }
      }
    } catch {
      // ignore
    }
    clearSession();
    clearAllNotifications();
    tokenRef.current = null;
    setToken(null);
    setCurrentUser(null);
  }, [clearSession]);

  const refreshSession = useCallback(async (): Promise<boolean> => {
    const currentToken = tokenRef.current;
    if (!currentToken || !currentUser) return false;
    try {
      const res = await fetch('/api/auth/session', {
        headers: { 'Authorization': `Bearer ${currentToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.valid && data.user) {
          // Use the renewed token from server (rolling refresh)
          const newToken = data.token || currentToken;
          tokenRef.current = newToken;
          setToken(newToken);
          setCurrentUser(data.user);
          persistSession(newToken, data.user);
          return true;
        } else {
          logout();
          return false;
        }
      }
      return false;
    } catch {
      return false;
    }
  }, [currentUser, persistSession, logout]);

  const hasPermission = useCallback((module: string, action: string): boolean => {
    if (!currentUser) return false;
    if (currentUser.role === 'Admin' || currentUser.isSuperAdmin) return true;
    const mod = currentUser.permissions?.[module];
    if (!mod) return false;
    return mod[action] === true;
  }, [currentUser]);

  return (
    <AuthContext.Provider value={{ isAuthenticated, currentUser, token, login, logout, switchUser, hasPermission, isAdmin, isSuperAdmin, refreshSession }}>
      {children}
    </AuthContext.Provider>
  );
}
