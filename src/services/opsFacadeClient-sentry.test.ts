import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchOpsSentryIssues, fetchOpsSentrySummary } from './opsFacadeClient';

describe('opsFacadeClient Sentry endpoints', () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    Object.defineProperty(window, 'localStorage', {
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

    Object.defineProperty(window, 'sessionStorage', {
      value: {
        getItem: vi.fn((key: string) => {
          if (key === 'aspire_admin_token') return 'test-admin-token';
          return null;
        }),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      },
      writable: true,
    });
  });

  it('fetches the Sentry summary through the ops facade', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        summary: {
          configured: true,
          source: 'sentry',
          status: 'degraded',
          open_issue_count: 7,
          critical_count: 2,
          regression_count: 1,
          project_count: 2,
          last_seen: '2026-03-19T20:00:00Z',
          issues_url: 'https://sentry.io/organizations/aspire/issues/',
          alerts_url: 'https://sentry.io/organizations/aspire/alerts/rules/',
          warnings: [],
        },
        server_time: '2026-03-19T20:05:00Z',
      }),
    });

    vi.stubGlobal('fetch', fetchMock);

    const response = await fetchOpsSentrySummary();
    const [url, init] = fetchMock.mock.calls[0];

    expect(response.summary.open_issue_count).toBe(7);
    expect(response.summary.project_count).toBe(2);
    expect(String(url)).toMatch(/\/admin\/ops\/sentry\/summary$/);
    expect(init).toEqual(
      expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'X-Admin-Token': 'test-admin-token',
          'X-Trace-Id': expect.any(String),
        }),
      }),
    );
  });

  it('fetches the Sentry issue list with limit query params', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          {
            id: '101',
            short_id: 'AVA-BRAIN-101',
            title: 'Backend fatal crash',
            level: 'fatal',
            status: 'unresolved',
            count: 12,
            user_count: 3,
            first_seen: '2026-03-19T20:00:00Z',
            last_seen: '2026-03-19T20:05:00Z',
            project_slug: 'ava-brain-backend',
            project_name: 'ava-brain-backend',
            culprit: 'server.py',
            permalink: 'https://sentry.io/organizations/aspire/issues/101/',
            is_regression: true,
            is_unhandled: true,
          },
        ],
        count: 1,
        configured: true,
        source: 'sentry',
        warnings: [],
        server_time: '2026-03-19T20:05:00Z',
      }),
    });

    vi.stubGlobal('fetch', fetchMock);

    const response = await fetchOpsSentryIssues({ limit: 5 });
    const [url, init] = fetchMock.mock.calls[0];

    expect(response.items).toHaveLength(1);
    expect(response.items[0].project_slug).toBe('ava-brain-backend');
    expect(String(url)).toMatch(/\/admin\/ops\/sentry\/issues\?limit=5$/);
    expect(init).toEqual(
      expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'X-Admin-Token': 'test-admin-token',
          'X-Trace-Id': expect.any(String),
        }),
      }),
    );
  });
});
