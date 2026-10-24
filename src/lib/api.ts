/**
 * Shared API utility that automatically adds the Authorization header
 * from the stored session token to all API requests.
 * Includes automatic retry logic for network failures (server starting up).
 * Handles 401 Unauthorized by attempting session refresh before failing.
 */

const SESSION_KEY = 'eservices_session';
const MAX_RETRIES = 6;
const RETRY_DELAYS = [1500, 3000, 5000, 8000, 12000, 18000]; // Exponential backoff for server restart

function getToken(): string | null {
  try {
    const stored = localStorage.getItem(SESSION_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed?.token || null;
    }
  } catch {
    // ignore
  }
  return null;
}

function setToken(token: string): void {
  try {
    const stored = localStorage.getItem(SESSION_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      parsed.token = token;
      localStorage.setItem(SESSION_KEY, JSON.stringify(parsed));
    }
  } catch {
    // ignore
  }
}

function clearSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
}

function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError) {
    const msg = error.message.toLowerCase();
    return (
      msg.includes('failed to fetch') ||
      msg.includes('networkerror') ||
      msg.includes('network request failed') ||
      msg.includes('load failed') ||
      msg.includes('connection refused') ||
      msg.includes('fetch failed')
    );
  }
  return false;
}

function isServerError(status: number): boolean {
  return status >= 500;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Attempt to refresh the session by calling /api/auth/session with the current token.
 * Returns a new token if successful, null otherwise.
 */
async function tryRefreshSession(currentToken: string): Promise<string | null> {
  try {
    const res = await fetch('/api/auth/session', {
      headers: { 'Authorization': `Bearer ${currentToken}` },
    });
    if (res.status === 401) {
      clearSession();
      return null;
    }
    if (res.ok) {
      const data = await res.json();
      if (data.valid && data.token) {
        // Update stored token
        setToken(data.token);
        return data.token;
      }
    }
    // Don't clear session for other errors (500, 503, etc.)
    return null;
  } catch {
    // Network error during refresh — don't clear session (server might be restarting)
    return null;
  }
}

/**
 * Drop-in replacement for fetch() that automatically adds the
 * Authorization: Bearer <token> header from the current session.
 * Automatically retries on network failures (server starting up).
 * On 401 Unauthorized, attempts to refresh the session and retry once.
 *
 * ALL requests (including POST/PUT/DELETE) are retried on network failure
 * because in this POS system the server may restart due to memory constraints.
 * Idempotency is handled by the backend (duplicate checks, etc).
 *
 * Usage: Replace `fetch('/api/...')` with `apiFetch('/api/...')`
 */
export async function apiFetch(
  input: string | URL | globalThis.Request,
  init: RequestInit = {}
): Promise<Response> {
  const token = getToken();

  // When body is FormData, don't override headers - let browser auto-set Content-Type
  const isFormData = init.body instanceof FormData;

  // Merge headers: preserve existing headers but add Authorization
  const headers = new Headers(init.headers || {});

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  // For FormData, don't set Content-Type - let browser auto-detect with boundary
  if (isFormData) {
    headers.delete('Content-Type');
  }

  const fetchInit = {
    ...init,
    headers,
  };

  const method = (init.method || 'GET').toUpperCase();
  const isIdempotent = method === 'GET' || method === 'HEAD' || method === 'OPTIONS';

  // All requests: retry on network failure with exponential backoff
  // Non-idempotent requests (POST/PUT/DELETE) get fewer retries to reduce duplicate risk
  const maxAttempts = isIdempotent ? MAX_RETRIES + 1 : 3; // GET: 5 attempts, others: 3
  let lastError: unknown = null;
  let retried401 = false;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await fetch(input, fetchInit);

      // Handle 401 Unauthorized — try refreshing session once
      if (response.status === 401 && !retried401) {
        retried401 = true;
        const currentToken = getToken();
        if (currentToken) {
          const newToken = await tryRefreshSession(currentToken);
          if (newToken) {
            // Retry the request with the new token
            (fetchInit.headers as Headers).set('Authorization', `Bearer ${newToken}`);
            continue;
          }
        }
        // Refresh failed — clear session and dispatch event so UI can react
        clearSession();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('auth:session-expired'));
        }
      }

      // If we get a 502/503/504 (server starting), retry
      if (isServerError(response.status) && attempt < maxAttempts - 1) {
        await delay(RETRY_DELAYS[Math.min(attempt, RETRY_DELAYS.length - 1)]);
        continue;
      }
      return response;
    } catch (error) {
      lastError = error;
      if (isNetworkError(error) && attempt < maxAttempts - 1) {
        await delay(RETRY_DELAYS[Math.min(attempt, RETRY_DELAYS.length - 1)]);
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}
