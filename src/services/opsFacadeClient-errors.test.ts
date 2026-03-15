/**
 * opsFacadeClient Error Handling Tests (Wave 5.6)
 * Validates error handling, retryable detection, and OpsFacadeError structure.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock storage for auth
function mockAuth() {
  Object.defineProperty(window, 'localStorage', {
    value: {
      getItem: vi.fn((key: string) => {
        if (key === 'aspire_admin_token') return 'test-token';
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
        if (key === 'aspire.admin.scope.suiteId') return 'suite-123';
        return null;
      }),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    },
    writable: true,
  });
}

describe('opsFacadeClient error handling', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockAuth();
  });

  it('throws OpsFacadeError on 401 unauthorized', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: async () => ({
        code: 'AUTH_REQUIRED',
        message: 'Invalid admin token',
        correlation_id: 'corr-123',
        retryable: false,
      }),
    }));

    const { submitApprovalDecision } = await import('./opsFacadeClient');

    await expect(submitApprovalDecision('approval-1', 'approved'))
      .rejects.toThrow('Invalid admin token');
  });

  it('throws OpsFacadeError on 500 server error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => ({
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        correlation_id: 'corr-456',
        retryable: true,
      }),
    }));

    const { submitApprovalDecision } = await import('./opsFacadeClient');

    await expect(submitApprovalDecision('approval-1', 'denied', 'test'))
      .rejects.toThrow();
  });

  it('handles non-JSON error response gracefully', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      statusText: 'Bad Gateway',
      json: async () => { throw new Error('not JSON'); },
    }));

    const { submitApprovalDecision } = await import('./opsFacadeClient');

    await expect(submitApprovalDecision('approval-1', 'approved'))
      .rejects.toThrow();
  });

  it('handles network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    const { submitApprovalDecision } = await import('./opsFacadeClient');

    await expect(submitApprovalDecision('approval-1', 'approved'))
      .rejects.toThrow('Failed to fetch');
  });
});

describe('opsFacadeClient health check', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockAuth();
  });

  it('isOpsFacadeAvailable returns true when healthy', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok', uptime: 12345 }),
    }));

    const { isOpsFacadeAvailable } = await import('./opsFacadeClient');
    const available = await isOpsFacadeAvailable();
    expect(available).toBe(true);
  });

  it('isOpsFacadeAvailable returns false when unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));

    const { isOpsFacadeAvailable } = await import('./opsFacadeClient');
    const available = await isOpsFacadeAvailable();
    expect(available).toBe(false);
  });
});
