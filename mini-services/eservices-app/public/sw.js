/// <reference lib="webworker" />

const CACHE_NAME = 'eservices-v8';
const STATIC_ASSETS = [
  '/',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-192-maskable.png',
  '/icon-512-maskable.png',
  '/apple-touch-icon.png',
  '/favicon.png',
  '/favicon-16x16.png',
  '/favicon-32x32.png',
];

// Paths that must always be fetched from the network (never cached)
const NETWORK_ONLY_PATHS = [
  '/manifest.json',
  '/.well-known/',
];

// Maximum cache age: 30 days in milliseconds
const MAX_CACHE_AGE = 30 * 24 * 60 * 60 * 1000;

// Install event - cache static assets and enable navigation preload
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  // Enable navigation preload if supported
  if (self.registration.navigationPreload) {
    self.skipWaiting();
  } else {
    self.skipWaiting();
  }
});

// Activate event - clean old caches and enable navigation preload
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      // Delete all old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      }),
      // Enable navigation preload if supported
      self.registration.navigationPreload
        ? self.registration.navigationPreload.enable()
        : Promise.resolve(),
    ])
  );
  // Claim all clients immediately so the new SW takes control
  self.clients.claim();
});

// Helper: Add Cache-Control headers to cached responses
function addCacheHeaders(response) {
  const headers = new Headers(response.headers);
  if (!headers.has('Cache-Control')) {
    headers.set('Cache-Control', 'public, max-age=86400');
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

// Helper: Check if a response is opaque (cross-origin, no-cors)
function isOpaqueResponse(response) {
  return response.status === 0 || response.type === 'opaque';
}

// Helper: Handle range requests for large files
function handleRangeRequest(request, response) {
  const rangeHeader = request.headers.get('Range');
  if (!rangeHeader) return response;

  const contentLength = response.headers.get('Content-Length');
  if (!contentLength) return response;

  const total = parseInt(contentLength, 10);
  const parts = rangeHeader.replace(/bytes=/, '').split('-');
  const start = parseInt(parts[0], 10);
  const end = parts[1] ? parseInt(parts[1], 10) : total - 1;

  if (start >= total || end >= total) {
    return new Response(null, {
      status: 416,
      headers: { 'Content-Range': `bytes */${total}` },
    });
  }

  // Clone the response to read the body
  return response.arrayBuffer().then((buffer) => {
    const chunk = buffer.slice(start, end + 1);
    return new Response(chunk, {
      status: 206,
      headers: {
        'Content-Range': `bytes ${start}-${end}/${total}`,
        'Content-Length': chunk.byteLength.toString(),
        'Content-Type': response.headers.get('Content-Type') || 'application/octet-stream',
        'Accept-Ranges': 'bytes',
      },
    });
  });
}

// Fetch event - network first with navigation preload support
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // NETWORK-ONLY for ALL /api/ requests — never cache API responses.
  // This is CRITICAL: API data (settings, bills, etc.) must always come fresh
  // from the server. Caching API responses causes data to appear "reset" or
  // show stale/default values after the cache expires or serves old data.
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then(response => response)
        .catch(() => new Response(JSON.stringify({ error: 'Network error' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        }))
    );
    return;
  }

  // Network-only: manifest.json and .well-known/ must always be fresh
  if (NETWORK_ONLY_PATHS.some((path) => url.pathname === path || url.pathname.startsWith(path))) {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          return response;
        } catch {
          return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
        }
      })()
    );
    return;
  }

  // Skip chrome extensions and non-http(s) protocols
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // For navigation requests - network first, cache fallback with preload support
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          // Use navigation preload response if available
          const preloadResponse = await event.preloadResponse;
          if (preloadResponse) {
            // Cache the preload response
            const responseClone = preloadResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, addCacheHeaders(responseClone));
            });
            return preloadResponse;
          }

          // Fallback to regular fetch
          const response = await fetch(request);
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, addCacheHeaders(responseClone));
            });
          }
          return response;
        } catch {
          // Network failed, try cache
          const cachedResponse = await caches.match(request);
          if (cachedResponse) return cachedResponse;
          // Ultimate fallback to offline page
          return caches.match('/');
        }
      })()
    );
    return;
  }

  // For static assets - cache first, network fallback with stale-while-revalidate
  if (
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.ico') ||
    url.pathname.endsWith('.woff2') ||
    url.pathname.endsWith('.woff')
  ) {
    event.respondWith(
      (async () => {
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
          // Handle range requests for cached responses
          if (request.headers.has('Range')) {
            return handleRangeRequest(request, cachedResponse);
          }

          // Stale-while-revalidate: return cache, update in background
          fetch(request)
            .then((networkResponse) => {
              if (networkResponse.ok && !isOpaqueResponse(networkResponse)) {
                caches.open(CACHE_NAME).then((cache) => {
                  cache.put(request, addCacheHeaders(networkResponse));
                });
              }
            })
            .catch(() => {
              // Background revalidation failed, that's ok
            });

          return cachedResponse;
        }

        // Not in cache, fetch from network
        try {
          const networkResponse = await fetch(request);
          if (networkResponse.ok) {
            // Don't cache opaque responses as they may be incomplete
            if (!isOpaqueResponse(networkResponse)) {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, addCacheHeaders(responseClone));
              });
            }
          }
          // Handle range requests for network responses
          if (request.headers.has('Range')) {
            return handleRangeRequest(request, networkResponse);
          }
          return networkResponse;
        } catch {
          return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
        }
      })()
    );
    return;
  }

  // Default: network first with cache fallback
  event.respondWith(
    (async () => {
      try {
        const response = await fetch(request);
        if (response.ok && !isOpaqueResponse(response)) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, addCacheHeaders(responseClone));
          });
        }
        return response;
      } catch {
        const cachedResponse = await caches.match(request);
        return cachedResponse || new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
      }
    })()
  );
});

// Handle messages from the app
self.addEventListener('message', (event) => {
  if (!event.data) return;

  switch (event.data.type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;

    case 'GET_CACHE_VERSION':
      // Return current cache version info
      event.source?.postMessage({
        type: 'CACHE_VERSION',
        version: CACHE_NAME,
      });
      break;

    case 'CLEAR_CACHE':
      // Clear all caches and re-cache static assets
      caches.keys().then((cacheNames) => {
        return Promise.all(cacheNames.map((name) => caches.delete(name)));
      }).then(() => {
        return caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS));
      }).then(() => {
        event.source?.postMessage({ type: 'CACHE_CLEARED', version: CACHE_NAME });
      });
      break;

    default:
      break;
  }
});
