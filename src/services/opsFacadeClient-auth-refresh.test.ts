import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();
const getSessionMock = vi.fn();

vi.stubGlobal('fetch', fetchMock);

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: getSessionMock,
    },
  },
}));

function mockStorage(initialToken = '') {
  const sessionStore: Record<string, string> = {};
  if (initialToken) {
    sessionStore.aspire_admin_token = initialToken;
  }

  Object.defineProperty(window, 'sessionStorage', {
    value: {
      getItem: vi.fn((key: string) => sessionStore[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        sessionStore[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete sessionStore[key];
      }),
      clear: vi.fn(() => {
        Object.keys(sessionStore).forEach((key) => delete sessionStore[key]);
      }),
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

describe('opsFacadeClient admin token refresh', () => {
  beforeEach(() => {
    vi.resetModules();
    fetchMock.mockReset();
    getSessionMock.mockReset();
    mockStorage();
  });

  it('mints an admin token on demand when sessionStorage is empty', async () => {
    getSessionMock.mockResolvedValue({
      data: { session: { access_token: 'supabase-access-token' } },
      error: null,
    });

    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          admin_token: 'fresh-admin-jwt',
          expires_at: '2026-03-20T05:00:00Z',
          correlation_id: 'corr-exchange',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          summary: {
            configured: true,
            source: 'sentry',
            status: 'critical',
            open_issue_count: 4,
            critical_count: 4,
            regression_count: 0,
            project_count: 4,
            last_seen: '2026-03-20T04:00:00Z',
            issues_url: 'https://sentry.io/issues/',
            alerts_url: 'https://sentry.io/alerts/',
            warnings: [],
          },
          server_time: '2026-03-20T04:00:00Z',
        }),
      });

    const { fetchOpsSentrySummary } = await import('./opsFacadeClient');
    const response = await fetchOpsSentrySummary();

    expect(response.summary.configured).toBe(true);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      expect.stringMatching(/\/admin\/auth\/exchange$/),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer supabase-access-token',
        }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      expect.stringMatching(/\/admin\/ops\/sentry\/summary$/),
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Admin-Token': 'fresh-admin-jwt',
        }),
      }),
    );
  });

  it('refreshes and retries once when the stored admin token is expired', async () => {
    mockStorage('expired-admin-jwt');
    getSessionMock.mockResolvedValue({
      data: { session: { access_token: 'supabase-access-token' } },
      error: null,
    });

    fetchMock
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({
          code: 'TOKEN_EXPIRED',
          message: 'Admin token has expired',
          correlation_id: 'corr-expired',
          retryable: false,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          admin_token: 'fresh-admin-jwt',
          expires_at: '2026-03-20T05:00:00Z',
          correlation_id: 'corr-refresh',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'healthy',
          checks: {},
          server_time: '2026-03-20T04:00:00Z',
        }),
      });

    const { fetchOpsDeepHealth } = await import('./opsFacadeClient');
    const response = await fetchOpsDeepHealth();

    expect(response.status).toBe('healthy');
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      expect.stringMatching(/\/admin\/ops\/health\/deep$/),
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Admin-Token': 'expired-admin-jwt',
        }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      expect.stringMatching(/\/admin\/auth\/exchange$/),
      expect.objectContaining({
        method: 'POST',
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      expect.stringMatching(/\/admin\/ops\/health\/deep$/),
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Admin-Token': 'fresh-admin-jwt',
        }),
      }),
    );
  });

  it('does not hit protected ops endpoints when admin token minting fails', async () => {
    getSessionMock.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    const { fetchOpsSentrySummary, OpsFacadeError } = await import('./opsFacadeClient');

    await expect(fetchOpsSentrySummary()).rejects.toEqual(
      expect.objectContaining<Partial<OpsFacadeError>>({
        code: 'AUTH_REQUIRED',
        status: 401,
      }),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
