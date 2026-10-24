'use client';

import { useEffect, useRef, useCallback, useState } from 'react';

const IDLE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
const WARNING_BEFORE_MS = 60 * 1000; // Show warning 1 minute before logout

interface IdleTimeoutState {
  /** Whether the warning dialog should be shown */
  showWarning: boolean;
  /** Seconds remaining until forced logout (only meaningful when showWarning is true) */
  secondsLeft: number;
  /** Reset the idle timer manually (e.g. when user clicks "Stay Logged In") */
  resetIdle: () => void;
}

/**
 * Tracks user inactivity and triggers auto-logout after 10 minutes.
 * Shows a warning dialog 1 minute before logout with a countdown.
 * Activity events: mousemove, mousedown, keydown, touchstart, scroll, pointerdown
 */
export function useIdleTimeout(
  isAuthenticated: boolean,
  onIdleLogout: () => void
): IdleTimeoutState {
  const [showWarning, setShowWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(60);

  const onIdleLogoutRef = useRef(onIdleLogout);
  useEffect(() => { onIdleLogoutRef.current = onIdleLogout; }, [onIdleLogout]);

  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const warningStartTimeRef = useRef<number>(0);
  const lastActivityRef = useRef<number>(Date.now());

  const clearTimers = useCallback(() => {
    if (idleTimerRef.current) { clearTimeout(idleTimerRef.current); idleTimerRef.current = null; }
    if (warningTimerRef.current) { clearTimeout(warningTimerRef.current); warningTimerRef.current = null; }
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
  }, []);

  const startTimers = useCallback(() => {
    clearTimers();

    // Warning timer: fires when there's 1 minute left before logout
    const warningDelay = IDLE_TIMEOUT_MS - WARNING_BEFORE_MS;
    warningTimerRef.current = setTimeout(() => {
      warningStartTimeRef.current = Date.now();
      setShowWarning(true);
      setSecondsLeft(60);

      // Countdown interval: update seconds left every second
      countdownRef.current = setInterval(() => {
        const elapsed = Date.now() - warningStartTimeRef.current;
        const remaining = Math.max(0, Math.ceil((WARNING_BEFORE_MS - elapsed) / 1000));
        setSecondsLeft(remaining);
        if (remaining <= 0) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          countdownRef.current = null;
        }
      }, 1000);
    }, warningDelay);

    // Absolute idle timer: fires after full timeout
    idleTimerRef.current = setTimeout(() => {
      setShowWarning(false);
      onIdleLogoutRef.current();
    }, IDLE_TIMEOUT_MS);
  }, [clearTimers]);

  const resetIdle = useCallback(() => {
    lastActivityRef.current = Date.now();
    setShowWarning(false);
    setSecondsLeft(60);
    startTimers();
  }, [startTimers]);

  useEffect(() => {
    if (!isAuthenticated) {
      clearTimers();
      setShowWarning(false);
      return;
    }

    // Start timers on authentication
    startTimers();

    // Activity events that reset the idle timer
    const activityEvents = [
      'mousemove',
      'mousedown',
      'keydown',
      'touchstart',
      'scroll',
      'pointerdown',
    ] as const;

    // Debounce activity reset to avoid excessive timer restarts
    let activityDebounce: ReturnType<typeof setTimeout> | null = null;

    const handleActivity = () => {
      // If warning is shown, user activity means "stay logged in" — reset immediately
      if (warningStartTimeRef.current > 0) {
        warningStartTimeRef.current = 0;
        resetIdle();
        return;
      }

      // Otherwise debounce resets to once per 5 seconds
      if (activityDebounce) return;
      activityDebounce = setTimeout(() => {
        activityDebounce = null;
        resetIdle();
      }, 5000);
    };

    // Handle document visibility changes (tab minimize, app backgrounded, etc.)
    // When the browser throttles timers in background tabs, the idle timeout
    // may not fire at the right time. This handler detects when the document
    // becomes visible again and checks the actual elapsed time.
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Page is being hidden/minimized — just keep the lastActivityRef as-is
        // so we can measure elapsed time when the page becomes visible again
        return;
      }

      // Page is becoming visible — check how much time has elapsed since last activity
      const elapsed = Date.now() - lastActivityRef.current;

      if (elapsed >= IDLE_TIMEOUT_MS) {
        // Already exceeded idle timeout — logout immediately
        clearTimers();
        setShowWarning(false);
        onIdleLogoutRef.current();
      } else if (elapsed >= IDLE_TIMEOUT_MS - WARNING_BEFORE_MS) {
        // In the warning period — show warning with adjusted countdown
        clearTimers();
        warningStartTimeRef.current = lastActivityRef.current + (IDLE_TIMEOUT_MS - WARNING_BEFORE_MS);
        setShowWarning(true);

        const remainingSeconds = Math.max(0, Math.ceil((IDLE_TIMEOUT_MS - elapsed) / 1000));
        setSecondsLeft(remainingSeconds);

        // Start countdown
        if (countdownRef.current) clearInterval(countdownRef.current);
        countdownRef.current = setInterval(() => {
          const elapsedSinceActivity = Date.now() - lastActivityRef.current;
          const remaining = Math.max(0, Math.ceil((IDLE_TIMEOUT_MS - elapsedSinceActivity) / 1000));
          setSecondsLeft(remaining);
          if (remaining <= 0) {
            if (countdownRef.current) clearInterval(countdownRef.current);
            countdownRef.current = null;
            setShowWarning(false);
            onIdleLogoutRef.current();
          }
        }, 1000);

        // Also set an absolute idle timer for when the remaining time passes
        const remainingMs = IDLE_TIMEOUT_MS - elapsed;
        idleTimerRef.current = setTimeout(() => {
          setShowWarning(false);
          if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
          onIdleLogoutRef.current();
        }, remainingMs);
      }
      // If less than warning threshold has passed, the existing timers are still
      // running and will handle the normal flow — no action needed.
    };

    activityEvents.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      activityEvents.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (activityDebounce) clearTimeout(activityDebounce);
      clearTimers();
    };
  }, [isAuthenticated, startTimers, resetIdle, clearTimers]);

  return { showWarning, secondsLeft, resetIdle };
}
