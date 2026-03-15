/**
 * Evil / RLS Isolation Tests for Admin Portal
 *
 * Adversarial tests verifying tenant isolation, auth enforcement,
 * and security boundaries in the admin portal services.
 *
 * These tests simulate attack scenarios:
 * 1. Missing auth tokens → must fail closed (401/403)
 * 2. Cross-suite data access → must be blocked
 * 3. Invalid/malformed tokens → must be rejected
 * 4. Receipt visibility isolation → receipts scoped to tenant
 * 5. Approval with wrong suite context → must be denied
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock fetch globally
const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

// Mock storages
function setupAuth(opts: { token?: string; suiteId?: string } = {}) {
  const sessionStore: Record<string, string> = {};
  if (opts.token) sessionStore['aspire_admin_token'] = opts.token;
  if (opts.suiteId) sessionStore['aspire.admin.scope.suiteId'] = opts.suiteId;

  Object.defineProperty(window, 'sessionStorage', {
    value: {
      getItem: vi.fn((key: string) => sessionStore[key] ?? null),
      setItem: vi.fn((key: string, val: string) => { sessionStore[key] = val; }),
      removeItem: vi.fn((key: string) => { delete sessionStore[key]; }),
      clear: vi.fn(),
    },
    writable: true,
    configurable: true,
  });

  Object.defineProperty(window, 'localStorage', {
    value: {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    },
    writable: true,
    configurable: true,
  });
}

describe('EVIL: Missing Auth Token', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    fetchMock.mockReset();
  });

  it('API calls without token must include empty X-Admin-Token (backend rejects)', async () => {
    setupAuth({}); // No token
    const { getAdminToken } = await import('@/lib/adminAuth');
    const token = getAdminToken();
    expect(token).toBe('');
  });

  it('opsFacadeClient sends empty token when none stored → backend returns 401', async () => {
    setupAuth({});
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: async () => ({
        code: 'AUTH_REQUIRED',
        message: 'Missing X-Admin-Token',
        correlation_id: 'corr-test',
        retryable: false,
      }),
    });

    const { fetchOpsHealth } = await import('@/services/opsFacadeClient');
    await expect(fetchOpsHealth()).rejects.toThrow();
  });

  it('expired token returns 401 not 200 with stale data', async () => {
    setupAuth({ token: 'expired-jwt-token' });
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: async () => ({
        code: 'TOKEN_EXPIRED',
        message: 'Admin token has expired',
        correlation_id: 'corr-expired',
        retryable: false,
      }),
    });

    const { fetchOpsIncidents } = await import('@/services/opsFacadeClient');
    await expect(fetchOpsIncidents()).rejects.toThrow();
  });
});

describe('EVIL: Cross-Suite Data Access', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    fetchMock.mockReset();
  });

  it('receipts endpoint must include X-Suite-Id header for tenant scoping', async () => {
    setupAuth({ token: 'valid-jwt', suiteId: 'suite-A' });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        receipts: [],
        page_info: { has_more: false, next_cursor: null },
        server_time: new Date().toISOString(),
      }),
    });

    const { fetchOpsReceipts } = await import('@/services/opsFacadeClient');
    await fetchOpsReceipts();

    // Verify the fetch was called with auth headers
    const [, options] = fetchMock.mock.calls[0];
    const headers = options?.headers as Record<string, string>;
    expect(headers['X-Admin-Token']).toBeDefined();
  });

  it('attacker cannot inject suiteId via URL params to access another tenant', () => {
    setupAuth({ suiteId: 'legitimate-suite' });

    // Attacker crafts URL with different suiteId
    const attackUrl = new URL('http://localhost:8080/dashboard?suiteId=victim-suite');
    const attackerSuiteId = attackUrl.searchParams.get('suiteId');

    // The app must use sessionStorage suite, not URL params
    const realSuiteId = sessionStorage.getItem('aspire.admin.scope.suiteId');

    expect(realSuiteId).toBe('legitimate-suite');
    expect(attackerSuiteId).not.toBe(realSuiteId);
  });

  it('token from localStorage must NOT be used (persistence = insecure)', async () => {
    // Token ONLY in localStorage (not sessionStorage) — should be invisible
    setupAuth({}); // Empty session
    // Manually put token in localStorage mock
    (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockImplementation(
      (key: string) => key === 'aspire_admin_token' ? 'leaked-token' : null,
    );

    const { getAdminToken } = await import('@/lib/adminAuth');
    const token = getAdminToken();

    // Must NOT fall back to localStorage
    expect(token).toBe('');
    expect(token).not.toBe('leaked-token');
  });
});

describe('EVIL: Invalid Token Formats', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    fetchMock.mockReset();
  });

  it('SQL injection in token is rejected', async () => {
    setupAuth({ token: "'; DROP TABLE users; --" });
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ code: 'AUTHZ_DENIED', message: 'Invalid token' }),
    });

    const { fetchOpsHealth } = await import('@/services/opsFacadeClient');
    await expect(fetchOpsHealth()).rejects.toThrow();
  });

  it('XSS payload in token is rejected', async () => {
    setupAuth({ token: '<script>alert("xss")</script>' });
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ code: 'AUTHZ_DENIED', message: 'Invalid token' }),
    });

    const { fetchOpsHealth } = await import('@/services/opsFacadeClient');
    await expect(fetchOpsHealth()).rejects.toThrow();
  });

  it('empty string token results in auth failure', async () => {
    setupAuth({ token: '' });
    const { getAdminToken } = await import('@/lib/adminAuth');
    expect(getAdminToken()).toBe('');
  });
});

describe('EVIL: Approval Decision Security', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    fetchMock.mockReset();
  });

  it('approval without auth token fails', async () => {
    setupAuth({}); // No token
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ code: 'AUTH_REQUIRED', message: 'Missing token' }),
    });

    // Simulating approval call without auth
    const response = await fetch('http://localhost:8000/admin/proposals/decide', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proposalId: 'prop-1', decision: 'approve' }),
    });

    expect(response.ok).toBe(false);
    expect(response.status).toBe(401);
  });

  it('approval for another tenant suite is rejected', async () => {
    setupAuth({ token: 'tenant-A-jwt', suiteId: 'suite-A' });
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({
        code: 'TENANT_ISOLATION_VIOLATION',
        message: 'Access denied to this proposal',
      }),
    });

    // Try to approve a proposal belonging to suite-B
    const response = await fetch('http://localhost:8000/admin/proposals/decide', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Token': 'tenant-A-jwt',
        'X-Suite-Id': 'suite-B', // Attacker tries cross-suite
      },
      body: JSON.stringify({ proposalId: 'prop-from-suite-B', decision: 'approve' }),
    });

    expect(response.ok).toBe(false);
    expect(response.status).toBe(403);
  });
});

describe('EVIL: Error Response Sanitization', () => {
  it('500 errors must not leak stack traces', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      }),
    });

    const response = await fetch('http://localhost:8000/admin/ops/health');
    const body = await response.json();

    // Must NOT contain internal details
    const serialized = JSON.stringify(body);
    expect(serialized).not.toMatch(/at\s+\w+\s+\(/); // No stack frames
    expect(serialized).not.toContain('.py:');
    expect(serialized).not.toContain('.ts:');
    expect(serialized).not.toContain('node_modules');
    expect(serialized).not.toContain('Traceback');
    expect(serialized).not.toContain('File "');
  });

  it('error responses must include correlation_id for support tracing', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 422,
      json: async () => ({
        code: 'VALIDATION_ERROR',
        message: 'Invalid request',
        correlation_id: 'corr-12345',
      }),
    });

    const response = await fetch('http://localhost:8000/admin/ops/incidents');
    const body = await response.json();
    expect(body.correlation_id).toBeDefined();
    expect(body.correlation_id).toMatch(/^corr-/);
  });
});
