import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useErrorStream } from './useErrorStream';
import { useProviderHealthStream } from './useProviderHealthStream';

vi.mock('./useRealtimeIncidents', () => ({
  useRealtimeIncidents: vi.fn(() => ({
    data: [],
    loading: false,
    error: null,
    count: 0,
    refetch: vi.fn(),
  })),
}));

vi.mock('./useSSEStream', () => ({
  useSSEStream: vi.fn(() => ({
    lastEvent: null,
    events: [],
    status: 'connected',
    error: null,
    reconnect: vi.fn(),
    disconnect: vi.fn(),
  })),
}));

import { useSSEStream } from './useSSEStream';

describe('ops stream contracts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'localStorage', {
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
    Object.defineProperty(window, 'sessionStorage', {
      value: {
        getItem: vi.fn().mockReturnValue(null),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      },
      writable: true,
    });
  });

  it('connects the backend incident stream through the ops facade base URL', () => {
    renderHook(() => useErrorStream());

    expect(useSSEStream).toHaveBeenCalledWith(expect.objectContaining({
      url: 'http://localhost:8000/admin/ops/incidents/stream',
      enabled: true,
      headers: expect.objectContaining({
        'X-Admin-Token': 'test-admin-token',
        'X-Suite-Id': 'suite-123',
        'X-Trace-Id': expect.any(String),
      }),
    }));
  });

  it('connects the provider health stream through the ops facade base URL', () => {
    renderHook(() => useProviderHealthStream());

    expect(useSSEStream).toHaveBeenCalledWith(expect.objectContaining({
      url: 'http://localhost:8000/admin/ops/providers/stream',
      enabled: true,
      headers: expect.objectContaining({
        'X-Admin-Token': 'test-admin-token',
        'X-Suite-Id': 'suite-123',
        'X-Trace-Id': expect.any(String),
      }),
    }));
  });
});
