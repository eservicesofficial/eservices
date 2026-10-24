/**
 * Service Worker Registration Utility for PWA
 * Handles registration, updates, background sync, and error recovery
 */

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// Store the beforeinstallprompt event for later use
let deferredInstallPrompt: BeforeInstallPromptEvent | null = null;

/**
 * Register the service worker with modern features
 */
export function registerServiceWorker() {
  if (typeof window === 'undefined') return;
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
        updateViaCache: 'none', // Always check for SW updates from network
      });

      console.log('[PWA] Service Worker registered successfully');

      // Check for updates periodically
      const updateInterval = setInterval(() => {
        registration.update().catch((err) => {
          console.warn('[PWA] Periodic update check failed:', err);
        });
      }, 60 * 60 * 1000); // Check every hour

      // Clean up interval on page unload
      window.addEventListener('unload', () => {
        clearInterval(updateInterval);
      });

      // Handle service worker updates with user notification
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed') {
            if (navigator.serviceWorker.controller) {
              // New version available - notify the user
              showUpdateNotification();
            } else {
              // First install - content is cached for offline use
              console.log('[PWA] Content is cached for offline use');
            }
          }

          if (newWorker.state === 'activated') {
            console.log('[PWA] New service worker activated');
          }
        });
      });

      // Handle controller change (new SW took over)
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        // The new SW has taken control, reload to use fresh cached content
        window.location.reload();
      });

      // Register periodic background sync if supported
      registerBackgroundSync(registration);

    } catch (error) {
      console.error('[PWA] Service Worker registration failed:', error);

      // Retry registration after a delay
      setTimeout(() => {
        console.log('[PWA] Retrying service worker registration...');
        registerServiceWorker();
      }, 5000);
    }
  });

  // Listen for the beforeinstallprompt event
  window.addEventListener('beforeinstallprompt', (event) => {
    // Prevent the mini-infobar from appearing on mobile
    event.preventDefault();
    deferredInstallPrompt = event as BeforeInstallPromptEvent;
    console.log('[PWA] Install prompt captured and deferred');
  });

  // Listen for the appinstalled event
  window.addEventListener('appinstalled', () => {
    console.log('[PWA] App installed successfully');
    deferredInstallPrompt = null;
    // Track install analytics if needed
  });
}

/**
 * Show an update notification to the user
 */
function showUpdateNotification() {
  // Try to use the toast/notification system if available
  if (typeof window !== 'undefined') {
    // Create a custom event that the app can listen for
    const updateEvent = new CustomEvent('sw-update-available', {
      detail: { message: 'A new version is available. Refresh to update.' },
    });
    window.dispatchEvent(updateEvent);

    console.log('[PWA] New version available — dispatching sw-update-available event');
  }
}

/**
 * Trigger the deferred install prompt
 */
export async function promptInstall(): Promise<boolean> {
  if (!deferredInstallPrompt) {
    console.warn('[PWA] No deferred install prompt available');
    return false;
  }

  try {
    await deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    console.log(`[PWA] User response to install prompt: ${outcome}`);
    deferredInstallPrompt = null;
    return outcome === 'accepted';
  } catch (error) {
    console.error('[PWA] Install prompt failed:', error);
    return false;
  }
}

/**
 * Register periodic background sync for data freshness
 */
async function registerBackgroundSync(registration: ServiceWorkerRegistration) {
  try {
    // Check if periodic background sync is supported
    if ('periodicSyncManager' in registration) {
      const status = await navigator.permissions.query({
        name: 'periodic-background-sync' as PermissionName,
      });

      if (status.state === 'granted') {
        await (registration as any).periodicSync.register('content-sync', {
          minInterval: 24 * 60 * 60 * 1000, // Once per day
        });
        console.log('[PWA] Periodic background sync registered');
      } else {
        console.log('[PWA] Periodic background sync permission not granted');
      }
    }

    // Also register one-shot background sync if supported
    if ('syncManager' in registration) {
      await (registration as any).sync.register('data-sync');
      console.log('[PWA] Background sync registered');
    }
  } catch (error) {
    // Background sync is not critical, just log
    console.warn('[PWA] Background sync registration failed (non-critical):', error);
  }
}

/**
 * Clear all service worker caches and force a refresh
 */
export async function clearCachesAndRefresh(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;

  try {
    const registration = await navigator.serviceWorker.ready;
    if (registration.active) {
      // Send clear cache message to the active SW
      registration.active.postMessage({ type: 'CLEAR_CACHE' });
    }

    // Also clear caches from the main thread
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((name) => caches.delete(name)));

    // Reload after a short delay to let the SW re-cache
    setTimeout(() => window.location.reload(), 500);
  } catch (error) {
    console.error('[PWA] Cache clear failed:', error);
    // Force reload anyway
    window.location.reload();
  }
}

/**
 * Get the current service worker cache version
 */
export async function getCacheVersion(): Promise<string | null> {
  if (!('serviceWorker' in navigator)) return null;

  try {
    const registration = await navigator.serviceWorker.ready;
    if (registration.active) {
      return new Promise((resolve) => {
        const channel = new MessageChannel();

        channel.port1.onmessage = (event) => {
          if (event.data && event.data.type === 'CACHE_VERSION') {
            resolve(event.data.version);
          }
        };

        registration.active!.postMessage(
          { type: 'GET_CACHE_VERSION' },
          [channel.port2]
        );

        // Timeout after 2 seconds
        setTimeout(() => resolve(null), 2000);
      });
    }
  } catch (error) {
    console.warn('[PWA] Failed to get cache version:', error);
  }

  return null;
}

/**
 * Check if the app is running as an installed PWA
 */
export function isPWA(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

/**
 * Check if the app can be installed (install prompt is available)
 */
export function canInstall(): boolean {
  return deferredInstallPrompt !== null;
}
