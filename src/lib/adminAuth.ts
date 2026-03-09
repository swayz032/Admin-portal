/**
 * Admin Auth Utilities — Single source of truth for admin token + suite ID.
 *
 * P0 Fix: opsFacadeClient wrote to sessionStorage, hooks read localStorage.
 * This module unifies both: write to BOTH, read with fallthrough.
 *
 * Suite ID: ScopeContext writes 'aspire.admin.scope.suiteId' to localStorage.
 * All hooks must read from the same key.
 */

const TOKEN_KEY = 'aspire_admin_token';
const SUITE_KEY = 'aspire.admin.scope.suiteId';

/**
 * Read admin JWT — tries sessionStorage first (primary), falls back to localStorage.
 * Returns empty string if not found (fail-closed: empty token = 401).
 */
export function getAdminToken(): string {
  try {
    return sessionStorage.getItem(TOKEN_KEY) ?? localStorage.getItem(TOKEN_KEY) ?? '';
  } catch {
    return '';
  }
}

/**
 * Read suite ID — reads from ScopeContext's key in localStorage.
 */
export function getSuiteId(): string {
  try {
    return localStorage.getItem(SUITE_KEY) ?? '';
  } catch {
    return '';
  }
}

/**
 * Write admin JWT to BOTH session and local storage.
 * SessionStorage = primary (cleared on tab close = secure).
 * LocalStorage = fallback for SSE hooks that read synchronously.
 */
export function setAdminToken(token: string): void {
  sessionStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(TOKEN_KEY, token);
}

/**
 * Clear admin JWT from both storages.
 */
export function clearAdminToken(): void {
  sessionStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_KEY);
}
