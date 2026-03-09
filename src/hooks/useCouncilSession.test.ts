/**
 * Tests for useCouncilSession hook (Wave 9 Admin Portal Overhaul).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useCouncilSession } from './useCouncilSession';

const mockSession = (overrides = {}) => ({
  sessionId: 'sess-1',
  status: 'deliberating' as const,
  topic: 'Should we deploy the patch?',
  advisors: [],
  adjudication: null,
  startedAt: '2026-01-01T10:00:00Z',
  completedAt: null,
  ...overrides,
});

function mockLocalStorage() {
  const store: Record<string, string> = { aspire_admin_token: 'test-admin-token' };
  Object.defineProperty(window, 'localStorage', {
    value: {
      getItem: vi.fn((key: string) => store[key] ?? null),
      setItem: vi.fn((k: string, v: string) => { store[k] = v; }),
      removeItem: vi.fn((k: string) => { delete store[k]; }),
      clear: vi.fn(),
    },
    writable: true,
  });
}

describe('useCouncilSession', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn();
    global.fetch = fetchSpy;
    mockLocalStorage();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('null sessionId (fail-closed)', () => {
    it('returns null session when sessionId is null', () => {
      const { result } = renderHook(() => useCouncilSession(null));
      expect(result.current.session).toBeNull();
    });

    it('does not call fetch when sessionId is null', () => {
      renderHook(() => useCouncilSession(null));
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('loading=false when sessionId is null', () => {
      const { result } = renderHook(() => useCouncilSession(null));
      expect(result.current.loading).toBe(false);
    });
  });

  describe('successful fetch', () => {
    it('fetches council session with X-Admin-Token header', async () => {
      fetchSpy.mockResolvedValue({ ok: true, json: async () => mockSession() });
      renderHook(() => useCouncilSession('sess-1'));

      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledWith(
          expect.stringContaining('council/sess-1'),
          expect.objectContaining({
            headers: expect.objectContaining({ 'X-Admin-Token': 'test-admin-token' }),
          }),
        );
      });
    });

    it('sets session data on successful fetch', async () => {
      fetchSpy.mockResolvedValue({ ok: true, json: async () => mockSession({ status: 'proposed' }) });
      const { result } = renderHook(() => useCouncilSession('sess-1'));
      await waitFor(() => expect(result.current.session?.status).toBe('proposed'));
    });

    it('clears error after successful refetch', async () => {
      fetchSpy
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue({ ok: true, json: async () => mockSession() });

      const { result } = renderHook(() => useCouncilSession('sess-1'));
      await waitFor(() => expect(result.current.error).toBeTruthy());

      await act(async () => { result.current.refetch(); });
      await waitFor(() => expect(result.current.error).toBeNull());
    });
  });

  describe('error handling', () => {
    it('sets error when fetch throws', async () => {
      fetchSpy.mockRejectedValue(new Error('Network timeout'));
      const { result } = renderHook(() => useCouncilSession('sess-1'));
      await waitFor(() => expect(result.current.error).toBeTruthy());
    });

    it('sets error when response is not ok', async () => {
      fetchSpy.mockResolvedValue({ ok: false, status: 404 });
      const { result } = renderHook(() => useCouncilSession('sess-1'));
      await waitFor(() => expect(result.current.error).toBeTruthy());
    });
  });

  describe('polling', () => {
    it('stops polling when status=decided', async () => {
      fetchSpy.mockResolvedValue({ ok: true, json: async () => mockSession({ status: 'decided' }) });
      renderHook(() => useCouncilSession('sess-1'));
      await waitFor(() => expect(fetchSpy).toHaveBeenCalled());

      // Wait a bit and verify no excessive polling
      const countAfter = fetchSpy.mock.calls.length;
      await new Promise(r => setTimeout(r, 100));
      // Should not have many more calls since session is decided
      expect(fetchSpy.mock.calls.length).toBeLessThanOrEqual(countAfter + 1);
    });

    it('stops polling when status=error', async () => {
      fetchSpy.mockResolvedValue({ ok: true, json: async () => mockSession({ status: 'error' }) });
      renderHook(() => useCouncilSession('sess-1'));
      await waitFor(() => expect(fetchSpy).toHaveBeenCalled());

      const countAfter = fetchSpy.mock.calls.length;
      await new Promise(r => setTimeout(r, 100));
      expect(fetchSpy.mock.calls.length).toBeLessThanOrEqual(countAfter + 1);
    });
  });

  describe('refetch', () => {
    it('refetch() triggers an additional fetch call', async () => {
      fetchSpy.mockResolvedValue({ ok: true, json: async () => mockSession() });
      const { result } = renderHook(() => useCouncilSession('sess-1'));
      await waitFor(() => expect(result.current.session).not.toBeNull());

      const callsBefore = fetchSpy.mock.calls.length;
      await act(async () => { result.current.refetch(); });
      await waitFor(() => expect(fetchSpy.mock.calls.length).toBeGreaterThan(callsBefore));
    });
  });
});
