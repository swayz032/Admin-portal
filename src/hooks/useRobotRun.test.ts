/**
 * Tests for useRobotRun hook (Wave 9 Admin Portal Overhaul).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useRobotRun } from './useRobotRun';

const mockRun = (overrides = {}) => ({
  runId: 'run-1',
  status: 'running' as const,
  environment: 'production',
  scenarios: [],
  startedAt: '2026-01-01T10:00:00Z',
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

describe('useRobotRun', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn();
    global.fetch = fetchSpy;
    mockLocalStorage();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('null runId (fail-closed)', () => {
    it('returns null run when runId is null', () => {
      const { result } = renderHook(() => useRobotRun(null));
      expect(result.current.run).toBeNull();
    });

    it('does not call fetch when runId is null', () => {
      renderHook(() => useRobotRun(null));
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('loading=false when runId is null', () => {
      const { result } = renderHook(() => useRobotRun(null));
      expect(result.current.loading).toBe(false);
    });
  });

  describe('successful fetch', () => {
    it('fetches robot run with X-Admin-Token header', async () => {
      fetchSpy.mockResolvedValue({ ok: true, json: async () => mockRun() });
      renderHook(() => useRobotRun('run-1'));

      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledWith(
          expect.stringContaining('robots/run-1'),
          expect.objectContaining({
            headers: expect.objectContaining({ 'X-Admin-Token': 'test-admin-token' }),
          }),
        );
      });
    });

    it('sets run data on successful fetch', async () => {
      fetchSpy.mockResolvedValue({ ok: true, json: async () => mockRun({ status: 'passed' }) });
      const { result } = renderHook(() => useRobotRun('run-1'));
      await waitFor(() => expect(result.current.run?.status).toBe('passed'));
    });
  });

  describe('polling lifecycle', () => {
    it('stops polling when status=passed', async () => {
      fetchSpy.mockResolvedValue({ ok: true, json: async () => mockRun({ status: 'passed' }) });
      renderHook(() => useRobotRun('run-1'));
      await waitFor(() => expect(fetchSpy).toHaveBeenCalled());

      const countAfter = fetchSpy.mock.calls.length;
      await new Promise(r => setTimeout(r, 100));
      expect(fetchSpy.mock.calls.length).toBeLessThanOrEqual(countAfter + 1);
    });

    it('stops polling when status=failed', async () => {
      fetchSpy.mockResolvedValue({ ok: true, json: async () => mockRun({ status: 'failed' }) });
      renderHook(() => useRobotRun('run-1'));
      await waitFor(() => expect(fetchSpy).toHaveBeenCalled());

      const countAfter = fetchSpy.mock.calls.length;
      await new Promise(r => setTimeout(r, 100));
      expect(fetchSpy.mock.calls.length).toBeLessThanOrEqual(countAfter + 1);
    });

    it('stops polling when status=error', async () => {
      fetchSpy.mockResolvedValue({ ok: true, json: async () => mockRun({ status: 'error' }) });
      renderHook(() => useRobotRun('run-1'));
      await waitFor(() => expect(fetchSpy).toHaveBeenCalled());

      const countAfter = fetchSpy.mock.calls.length;
      await new Promise(r => setTimeout(r, 100));
      expect(fetchSpy.mock.calls.length).toBeLessThanOrEqual(countAfter + 1);
    });
  });

  describe('error handling', () => {
    it('sets error when fetch throws', async () => {
      fetchSpy.mockRejectedValue(new Error('Network unreachable'));
      const { result } = renderHook(() => useRobotRun('run-1'));
      await waitFor(() => expect(result.current.error).toBeTruthy());
    });

    it('sets error when response is not ok', async () => {
      fetchSpy.mockResolvedValue({ ok: false, status: 500 });
      const { result } = renderHook(() => useRobotRun('run-1'));
      await waitFor(() => expect(result.current.error).toBeTruthy());
    });

    it('error does not prevent run from being null', async () => {
      fetchSpy.mockRejectedValue(new Error('Fail'));
      const { result } = renderHook(() => useRobotRun('run-1'));
      await waitFor(() => expect(result.current.error).toBeTruthy());
      expect(result.current.run).toBeNull();
    });
  });

  describe('scenarios', () => {
    it('maps scenarios array from run response', async () => {
      const run = mockRun({
        status: 'passed',
        scenarios: [
          { name: 'Login flow', status: 'passed', duration: 1200 },
          { name: 'Checkout flow', status: 'failed', error: 'Button not found' },
        ],
      });
      fetchSpy.mockResolvedValue({ ok: true, json: async () => run });
      const { result } = renderHook(() => useRobotRun('run-1'));
      await waitFor(() => expect(result.current.run?.scenarios).toHaveLength(2));
      expect(result.current.run?.scenarios[0].name).toBe('Login flow');
    });
  });
});
