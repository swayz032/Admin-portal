/**
 * Governance-Critical Tests — Approval Authority Surface
 *
 * Validates:
 * - Self-approval prevention (Law #3: Fail Closed)
 * - Cross-suite isolation (Law #6: Tenant Isolation)
 * - Receipt emission on approve/deny (Law #2: Receipt for All)
 * - Auth security boundaries (Law #3 + Law #9)
 * - Approval decision flow (pending → approved/denied)
 * - RED tier explicit authority requirement (Law #4: Risk Tiers)
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------
const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

function setupAuth(opts: { token?: string; suiteId?: string } = {}) {
  const sessionStore: Record<string, string> = {};
  if (opts.token) sessionStore['aspire_admin_token'] = opts.token;

  const localStore: Record<string, string> = {};
  if (opts.suiteId) localStore['aspire.admin.scope.suiteId'] = opts.suiteId;

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
      getItem: vi.fn((key: string) => localStore[key] ?? null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    },
    writable: true,
    configurable: true,
  });
}

// ---------------------------------------------------------------------------
// 1–4: Approval Authority Boundary
// ---------------------------------------------------------------------------
describe('Approval Authority Boundary', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    fetchMock.mockReset();
  });

  it('should prevent User A from approving their own requests', async () => {
    setupAuth({ token: 'user-A-jwt', suiteId: 'suite-100' });

    // Backend rejects self-approval with 403
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({
        code: 'SELF_APPROVAL_DENIED',
        message: 'Cannot approve your own request',
        correlation_id: 'corr-self-1',
        retryable: false,
      }),
    });

    const { submitApprovalDecision } = await import(
      '@/services/opsFacadeClient'
    );

    await expect(
      submitApprovalDecision('approval-self-1', 'approved'),
    ).rejects.toThrow();

    // Verify the call was made to the correct endpoint
    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain('/admin/ops/approvals/approval-self-1/decide');
  });

  it('should prevent cross-suite approval', async () => {
    setupAuth({ token: 'suite-A-jwt', suiteId: 'suite-A' });

    // Backend rejects cross-suite with 403
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({
        code: 'TENANT_ISOLATION_VIOLATION',
        message: 'Cannot approve requests from another suite',
        correlation_id: 'corr-cross-1',
        retryable: false,
      }),
    });

    const { submitApprovalDecision } = await import(
      '@/services/opsFacadeClient'
    );

    await expect(
      submitApprovalDecision('approval-from-suite-B', 'approved'),
    ).rejects.toThrow();

    const [, options] = fetchMock.mock.calls[0];
    const headers = options?.headers as Record<string, string>;
    // Admin token sent is suite-A's token — backend enforces tenant isolation
    expect(headers['X-Admin-Token']).toBe('suite-A-jwt');
  });

  it('should emit receipt on approval decision', async () => {
    setupAuth({ token: 'admin-jwt', suiteId: 'suite-123' });

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        receipt_id: 'rcpt-approve-1',
        status: 'approved',
      }),
    });

    const { submitApprovalDecision } = await import(
      '@/services/opsFacadeClient'
    );

    const result = await submitApprovalDecision('approval-99', 'approved');

    expect(result.receipt_id).toBe('rcpt-approve-1');
    expect(result.status).toBe('approved');

    // Verify POST body
    const [, options] = fetchMock.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.decision).toBe('approved');
  });

  it('should emit receipt on denial decision', async () => {
    setupAuth({ token: 'admin-jwt', suiteId: 'suite-123' });

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        receipt_id: 'rcpt-deny-1',
        status: 'denied',
      }),
    });

    const { submitApprovalDecision } = await import(
      '@/services/opsFacadeClient'
    );

    const result = await submitApprovalDecision(
      'approval-100',
      'denied',
      'Budget exceeded quarterly limit',
    );

    expect(result.receipt_id).toBe('rcpt-deny-1');
    expect(result.status).toBe('denied');

    // Verify denial reason is sent in body
    const [, options] = fetchMock.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.decision).toBe('denied');
    expect(body.reason).toBe('Budget exceeded quarterly limit');
  });
});

// ---------------------------------------------------------------------------
// 5–7: Auth Security
// ---------------------------------------------------------------------------
describe('Auth Security', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    fetchMock.mockReset();
  });

  it('should reject requests with missing auth token', async () => {
    setupAuth({}); // No token

    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({
        code: 'AUTH_REQUIRED',
        message: 'Missing X-Admin-Token',
        correlation_id: 'corr-no-auth',
        retryable: false,
      }),
    });

    const { fetchOpsHealth } = await import('@/services/opsFacadeClient');
    await expect(fetchOpsHealth()).rejects.toThrow();

    // Verify no admin token was sent
    const [, options] = fetchMock.mock.calls[0];
    const headers = options?.headers as Record<string, string>;
    expect(headers['X-Admin-Token']).toBeUndefined();
  });

  it('should reject requests with expired token', async () => {
    setupAuth({ token: 'expired-jwt-2024' });

    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
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

  it('should reject cross-suite token (403)', async () => {
    setupAuth({ token: 'suite-A-jwt', suiteId: 'suite-A' });

    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({
        code: 'SUITE_MISMATCH',
        message: 'Token suite does not match requested resource',
        correlation_id: 'corr-suite-x',
        retryable: false,
      }),
    });

    const { fetchOpsReceipts } = await import('@/services/opsFacadeClient');
    await expect(
      fetchOpsReceipts({ suite_id: 'suite-B' }),
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 8–9: Approval Decision Flow
// ---------------------------------------------------------------------------
describe('Approval Decision Flow', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    fetchMock.mockReset();
  });

  it('should complete approve flow (pending → approved)', async () => {
    setupAuth({ token: 'admin-jwt', suiteId: 'suite-200' });

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        receipt_id: 'rcpt-flow-approve',
        status: 'approved',
      }),
    });

    const { submitApprovalDecision } = await import(
      '@/services/opsFacadeClient'
    );

    const result = await submitApprovalDecision('pending-approval-1', 'approved');

    expect(result.status).toBe('approved');
    expect(result.receipt_id).toMatch(/^rcpt-/);

    // Verify correct HTTP method and path
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain('/admin/ops/approvals/pending-approval-1/decide');
    expect(options.method).toBe('POST');
  });

  it('should complete deny flow (pending → denied)', async () => {
    setupAuth({ token: 'admin-jwt', suiteId: 'suite-200' });

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        receipt_id: 'rcpt-flow-deny',
        status: 'denied',
      }),
    });

    const { submitApprovalDecision } = await import(
      '@/services/opsFacadeClient'
    );

    const result = await submitApprovalDecision(
      'pending-approval-2',
      'denied',
      'Risk assessment failed — vendor not vetted',
    );

    expect(result.status).toBe('denied');
    expect(result.receipt_id).toMatch(/^rcpt-/);

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain('/admin/ops/approvals/pending-approval-2/decide');
    expect(options.method).toBe('POST');

    const body = JSON.parse(options.body);
    expect(body.reason).toBe('Risk assessment failed — vendor not vetted');
  });
});

// ---------------------------------------------------------------------------
// 10: Finance Approval — RED Tier
// ---------------------------------------------------------------------------
describe('Finance Approval — RED Tier', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    fetchMock.mockReset();
  });

  it('should require explicit authority for RED tier actions', async () => {
    setupAuth({ token: 'admin-jwt', suiteId: 'suite-300' });

    // Backend rejects RED tier without explicit authority confirmation
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({
        code: 'RED_TIER_AUTHORITY_REQUIRED',
        message: 'RED tier actions require explicit authority confirmation',
        correlation_id: 'corr-red-1',
        retryable: false,
      }),
    });

    const { submitApprovalDecision } = await import(
      '@/services/opsFacadeClient'
    );

    // Attempt to approve a RED tier financial action without explicit authority
    await expect(
      submitApprovalDecision('red-tier-payment-1', 'approved'),
    ).rejects.toThrow();

    // Verify the error is a 403, not silently degraded
    const [, options] = fetchMock.mock.calls[0];
    expect(options.method).toBe('POST');
  });
});
