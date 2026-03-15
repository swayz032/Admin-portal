/**
 * Tests for adminAuth utility — unified admin token + suite ID access.
 *
 * Validates:
 * - getAdminToken reads from sessionStorage only (security: cleared on tab close)
 * - getSuiteId reads from ScopeContext's key ('aspire.admin.scope.suiteId')
 * - setAdminToken writes to sessionStorage only
 * - clearAdminToken clears sessionStorage only
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAdminToken, getSuiteId, setAdminToken, clearAdminToken } from './adminAuth';

describe('adminAuth', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  describe('getAdminToken', () => {
    it('returns empty string when no token stored', () => {
      expect(getAdminToken()).toBe('');
    });

    it('reads from sessionStorage', () => {
      sessionStorage.setItem('aspire_admin_token', 'session-jwt');
      expect(getAdminToken()).toBe('session-jwt');
    });

    it('does NOT fall back to localStorage (security: tokens must not persist)', () => {
      localStorage.setItem('aspire_admin_token', 'local-jwt');
      expect(getAdminToken()).toBe('');
    });

    it('returns empty string when sessionStorage is empty', () => {
      expect(getAdminToken()).toBe('');
    });
  });

  describe('getSuiteId', () => {
    it('reads from ScopeContext key (aspire.admin.scope.suiteId)', () => {
      localStorage.setItem('aspire.admin.scope.suiteId', 'suite-uuid-123');
      expect(getSuiteId()).toBe('suite-uuid-123');
    });

    it('returns empty string when no suite ID stored', () => {
      expect(getSuiteId()).toBe('');
    });

    it('does NOT read from wrong keys (aspire_suite_id or suite_id)', () => {
      localStorage.setItem('aspire_suite_id', 'wrong-key');
      localStorage.setItem('suite_id', 'also-wrong');
      expect(getSuiteId()).toBe('');
    });
  });

  describe('setAdminToken', () => {
    it('writes to sessionStorage only', () => {
      setAdminToken('new-jwt');
      expect(sessionStorage.getItem('aspire_admin_token')).toBe('new-jwt');
      expect(localStorage.getItem('aspire_admin_token')).toBeNull();
    });
  });

  describe('clearAdminToken', () => {
    it('clears from sessionStorage', () => {
      sessionStorage.setItem('aspire_admin_token', 'jwt');

      clearAdminToken();

      expect(sessionStorage.getItem('aspire_admin_token')).toBeNull();
    });
  });
});
