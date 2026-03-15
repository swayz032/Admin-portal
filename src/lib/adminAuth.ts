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
 * Read admin JWT from sessionStorage only (cleared on tab close = secure).
 * Returns empty string if not found (fail-closed: empty token = 401).
 */
export function getAdminToken(): string {
  try {
    return sessionStorage.getItem(TOKEN_KEY) ?? '';
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
 * Write admin JWT to sessionStorage only (cleared on tab close = secure).
 */
export function setAdminToken(token: string): void {
  sessionStorage.setItem(TOKEN_KEY, token);
}

/**
 * Clear admin JWT from sessionStorage.
 */
export function clearAdminToken(): void {
  sessionStorage.removeItem(TOKEN_KEY);
}
