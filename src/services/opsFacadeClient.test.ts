import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchOpsProviderRotationSummary } from './opsFacadeClient';

describe('opsFacadeClient rotation summary', () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn(() => null),
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
          if (key === 'aspire.admin.scope.suiteId') return 'suite-123';
          return null;
        }),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      },
      writable: true,
    });
  });

  it('calls the backend rotation summary endpoint with admin and trace headers', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        summary: {
          automated_count: 5,
          manual_alerted_count: 16,
          infrastructure_count: 2,
          automated_providers: ['internal', 'openai', 'stripe', 'supabase', 'twilio'],
          manual_alerted_providers: ['gusto'],
          manual_alerted_with_adapter_modules: ['deepgram', 'elevenlabs'],
          manual_alerted_without_adapter_modules: ['gusto'],
          automation_gaps: {
            missing_adapter_modules: [],
            registry_automated_missing_from_terraform: [],
            terraform_automated_missing_from_registry: [],
          },
        },
        server_time: '2026-03-13T00:00:00Z',
      }),
    });

    vi.stubGlobal('fetch', fetchMock);

    const response = await fetchOpsProviderRotationSummary();

    expect(response.summary.automated_count).toBe(5);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/admin\/ops\/providers\/rotation-summary$/),
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
