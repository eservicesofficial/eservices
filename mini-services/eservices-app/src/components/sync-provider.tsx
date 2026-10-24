'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from './auth-provider';

interface SyncContextType {
  lastSyncTime: string;
  syncVersion: number;
  triggerSync: () => void;
  markDataChanged: (source: string) => void;
}

const SyncContext = createContext<SyncContextType>({
  lastSyncTime: '',
  syncVersion: 0,
  triggerSync: () => {},
  markDataChanged: () => {},
});

export function useSync() {
  return useContext(SyncContext);
}

const SYNC_CHANNEL_NAME = 'eservices_sync';
const DEBOUNCE_MS = 3000; // Debounce sync events to prevent cascade re-renders
const POLL_INTERVAL_MS = 60000; // Poll every 60s (reduced from 30s to prevent constant refreshes)

// Track if init has been called in this session to avoid repeated calls
let initCalledThisSession = false;

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const [lastSyncTime, setLastSyncTime] = useState('');
  const [syncVersion, setSyncVersion] = useState(0);
  const { token, isAuthenticated } = useAuth();
  const channelRef = useRef<BroadcastChannel | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastCountsRef = useRef<string>('');
  const lastChangeRef = useRef<string>('');
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSyncRef = useRef(false);
  // Use a ref for token so the polling interval doesn't restart when token changes
  // (token changes cause an immediate checkForChanges() which can cascade into
  // syncVersion bumps → dataVersion changes → Settings re-fetch → input overwrite)
  const tokenRef = useRef(token);
  useEffect(() => { tokenRef.current = token; }, [token]);

  // Debounced sync bump — coalesces rapid changes into a single update
  const bumpSync = useCallback(() => {
    pendingSyncRef.current = true;
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      if (pendingSyncRef.current) {
        pendingSyncRef.current = false;
        setSyncVersion((prev) => prev + 1);
        setLastSyncTime(new Date().toISOString());
      }
    }, DEBOUNCE_MS);
  }, []);

  // Store bumpSync in a ref so event handlers can access the latest version
  const bumpSyncRef = useRef(bumpSync);
  useEffect(() => { bumpSyncRef.current = bumpSync; }, [bumpSync]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  // Set up BroadcastChannel for cross-tab sync
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const channel = new BroadcastChannel(SYNC_CHANNEL_NAME);
      channelRef.current = channel;

      channel.onmessage = (event) => {
        if (event.data?.type === 'data_changed') {
          bumpSyncRef.current();
        }
      };
    } catch {
      // BroadcastChannel not supported, use storage events as fallback
      const handleStorage = (e: StorageEvent) => {
        if (e.key === 'eservices_sync_signal' && e.newValue) {
          bumpSyncRef.current();
        }
      };
      window.addEventListener('storage', handleStorage);
      return () => window.removeEventListener('storage', handleStorage);
    }

    return () => {
      channelRef.current?.close();
    };
  }, []);

  // Call /api/init once after authentication to ensure category features are synced
  // This is safe because ensureCategoryFeatures() only creates missing features
  // and removes wrong-category features — it never overwrites user data.
  // Reset flag when user logs out so init runs again on re-login.
  useEffect(() => {
    if (!isAuthenticated) {
      initCalledThisSession = false;
      return;
    }
    if (initCalledThisSession) return;
    initCalledThisSession = true;
    fetch('/api/init').catch(() => { /* silent — background init */ });
  }, [isAuthenticated]);

  // Polling: check for data changes periodically
  // Only depends on isAuthenticated — NOT on token.
  // Token changes (from session refresh) should NOT restart the polling interval,
  // because that causes an immediate checkForChanges() which can cascade into
  // syncVersion bumps → dataVersion changes → Settings re-fetch → input overwrite.
  // Instead, we use tokenRef.current inside the check function.
  useEffect(() => {
    if (!isAuthenticated) {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      return;
    }

    const checkForChanges = async () => {
      const currentToken = tokenRef.current;
      if (!currentToken) return;
      try {
        const res = await fetch('/api/sync', {
          headers: { 'Authorization': `Bearer ${currentToken}` },
        });
        if (res.ok) {
          const data = await res.json();
          const countsKey = JSON.stringify(data.counts);
          const changeKey = data.lastChange || '';
          const countsChanged = lastCountsRef.current && lastCountsRef.current !== countsKey;
          const editChanged = lastChangeRef.current && lastChangeRef.current !== changeKey && changeKey !== '';
          if (countsChanged || editChanged) {
            // Data changed on server (new/deleted records OR edits to existing) — trigger debounced refresh
            bumpSyncRef.current();
          }
          lastCountsRef.current = countsKey;
          lastChangeRef.current = changeKey;
        }
      } catch {
        // Network error, ignore
      }
    };

    // Initial check
    checkForChanges();

    // Then periodically
    pollIntervalRef.current = setInterval(checkForChanges, POLL_INTERVAL_MS);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [isAuthenticated]);

  const triggerSync = useCallback(() => {
    bumpSync();
  }, [bumpSync]);

  const markDataChanged = useCallback((source: string) => {
    bumpSync();

    // Notify other tabs via BroadcastChannel
    if (channelRef.current) {
      try {
        channelRef.current.postMessage({ type: 'data_changed', source });
      } catch {
        // Channel closed, ignore
      }
    }

    // Fallback: use localStorage signal for browsers without BroadcastChannel
    try {
      localStorage.setItem('eservices_sync_signal', Date.now().toString());
    } catch {
      // ignore
    }
  }, [bumpSync]);

  return (
    <SyncContext.Provider value={{ lastSyncTime, syncVersion, triggerSync, markDataChanged }}>
      {children}
    </SyncContext.Provider>
  );
}
