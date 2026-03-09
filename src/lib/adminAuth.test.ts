/**
 * Tests for adminAuth utility — unified admin token + suite ID access.
 *
 * Validates:
 * - getAdminToken reads sessionStorage first, falls back to localStorage
 * - getSuiteId reads from ScopeContext's key ('aspire.admin.scope.suiteId')
 * - setAdminToken writes to both storages
 * - clearAdminToken clears both storages
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAdminToken, getSuiteId, setAdminToken, clearAdminToken } from './adminAuth';

describe('adminAuth', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  describe('getAdminToken', () => {
    it('returns empty string when no token stored anywhere', () => {
      expect(getAdminToken()).toBe('');
    });

    it('reads from sessionStorage first', () => {
      sessionStorage.setItem('aspire_admin_token', 'session-jwt');
      localStorage.setItem('aspire_admin_token', 'local-jwt');
      expect(getAdminToken()).toBe('session-jwt');
    });

    it('falls back to localStorage when sessionStorage is empty', () => {
      localStorage.setItem('aspire_admin_token', 'local-jwt');
      expect(getAdminToken()).toBe('local-jwt');
    });

    it('returns empty string when both storages are empty', () => {
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
    it('writes to both sessionStorage and localStorage', () => {
      setAdminToken('new-jwt');
      expect(sessionStorage.getItem('aspire_admin_token')).toBe('new-jwt');
      expect(localStorage.getItem('aspire_admin_token')).toBe('new-jwt');
    });
  });

  describe('clearAdminToken', () => {
    it('clears from both storages', () => {
      sessionStorage.setItem('aspire_admin_token', 'jwt');
      localStorage.setItem('aspire_admin_token', 'jwt');

      clearAdminToken();

      expect(sessionStorage.getItem('aspire_admin_token')).toBeNull();
      expect(localStorage.getItem('aspire_admin_token')).toBeNull();
    });
  });
});
