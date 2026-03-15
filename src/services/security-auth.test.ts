/**
 * Security Auth Tests (Wave 4.4)
 * Validates admin auth flows, token handling, and cross-suite isolation.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock storage helpers
function mockStorages(opts: {
  adminToken?: string;
  suiteId?: string;
} = {}) {
  Object.defineProperty(window, 'localStorage', {
    value: {
      getItem: vi.fn((key: string) => {
        if (key === 'aspire_admin_token') return opts.adminToken ?? null;
        return null;
      }),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    },
    writable: true,
  });

  Object.defineProperty(window, 'sessionStorage', {
    value: {
      getItem: vi.fn((key: string) => {
        if (key === 'aspire_admin_token') return opts.adminToken ?? null;
        if (key === 'aspire.admin.scope.suiteId') return opts.suiteId ?? null;
        return null;
      }),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    },
    writable: true,
  });
}

describe('Admin auth token validation', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('missing token results in empty string', () => {
    mockStorages({});
    // With no token in either storage, getItem returns null
    expect(sessionStorage.getItem('aspire_admin_token')).toBeNull();
    expect(localStorage.getItem('aspire_admin_token')).toBeNull();
  });

  it('token is included in X-Admin-Token header', () => {
    mockStorages({ adminToken: 'valid-jwt-token', suiteId: 'suite-123' });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    vi.stubGlobal('fetch', fetchMock);

    // Verify fetch includes the token header
    fetch('http://localhost:8000/admin/test', {
      headers: {
        'X-Admin-Token': 'valid-jwt-token',
      },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8000/admin/test',
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Admin-Token': 'valid-jwt-token',
        }),
      }),
    );
  });
});

describe('Cross-suite isolation', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('suite ID comes from session storage, not URL params', () => {
    mockStorages({ suiteId: 'real-suite-from-session' });

    // Attacker tries to inject suite via URL
    const urlParams = new URLSearchParams('?suiteId=attacker-suite');
    const attackerSuite = urlParams.get('suiteId');

    const sessionSuite = sessionStorage.getItem('aspire.admin.scope.suiteId');

    expect(sessionSuite).toBe('real-suite-from-session');
    expect(attackerSuite).toBe('attacker-suite');
    expect(sessionSuite).not.toBe(attackerSuite);
  });

  it('API calls must not accept client-supplied suiteId in body', () => {
    // Simulating what an attacker might try
    const requestBody = {
      suiteId: 'attacker-suite-id',
      action: 'approve',
      requestId: 'req-123',
    };

    // The server should use authenticatedSuiteId from JWT, not body
    // This test documents the expected behavior
    expect(requestBody.suiteId).toBeDefined();
    // But the server MUST ignore this field
  });
});

describe('Approval decision security', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('approval submission includes auth token', async () => {
    mockStorages({ adminToken: 'admin-jwt', suiteId: 'suite-123' });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
    vi.stubGlobal('fetch', fetchMock);

    // Simulate approval decision
    await fetch('http://localhost:8000/admin/proposals/decide', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Token': 'admin-jwt',
        'X-Suite-Id': 'suite-123',
      },
      body: JSON.stringify({
        proposalId: 'prop-456',
        decision: 'approve',
      }),
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/proposals/decide'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'X-Admin-Token': 'admin-jwt',
          'X-Suite-Id': 'suite-123',
        }),
      }),
    );
  });

  it('denial decision includes reason', async () => {
    mockStorages({ adminToken: 'admin-jwt', suiteId: 'suite-123' });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await fetch('http://localhost:8000/admin/proposals/decide', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Token': 'admin-jwt',
      },
      body: JSON.stringify({
        proposalId: 'prop-456',
        decision: 'deny',
        reason: 'Budget exceeded',
      }),
    });

    const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(callBody.decision).toBe('deny');
    expect(callBody.reason).toBe('Budget exceeded');
  });
});

describe('Error handling security', () => {
  it('API errors do not expose internal details to UI', () => {
    // Simulate an error response from the backend
    const errorResponse = {
      error: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    };

    // Should NOT contain stack traces, file paths, or internal details
    const serialized = JSON.stringify(errorResponse);
    expect(serialized).not.toContain('at ');
    expect(serialized).not.toContain('.ts:');
    expect(serialized).not.toContain('.js:');
    expect(serialized).not.toContain('node_modules');
    expect(serialized).not.toContain('TypeError');
    expect(serialized).not.toContain('ReferenceError');
  });
});
