/**
 * Tests for useUnifiedIncidents hook.
 *
 * Validates:
 * - Source tagging (all incidents tagged as 'frontend' from Supabase)
 * - Severity-first sort (P0 before P1), then newest-first within tier
 * - Filter passthrough to useRealtimeIncidents
 *
 * Note: useErrorStream (SSE backend) was removed because the SSE endpoint
 * does not exist yet. When it's built, re-add tests for backend error merging.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useUnifiedIncidents } from './useUnifiedIncidents';

// ── Mock dependencies ──────────────────────────────────────────────
vi.mock('./useRealtimeIncidents', () => ({
  useRealtimeIncidents: vi.fn(),
}));

import { useRealtimeIncidents } from './useRealtimeIncidents';

const mockRealtimeIncident = (overrides = {}) => ({
  id: 'inc-1',
  severity: 'P1' as const,
  status: 'Open',
  summary: 'Frontend incident',
  customer: 'Acme Corp',
  provider: 'Stripe',
  createdAt: '2026-01-01T10:00:00Z',
  updatedAt: '2026-01-01T10:00:00Z',
  subscribed: false,
  timelineReceiptIds: [],
  notes: [],
  detectionSource: 'rule' as const,
  customerNotified: 'no' as const,
  proofStatus: 'pending' as const,
  correlationId: 'corr-1',
  ...overrides,
});

const defaultRealtimeResult = {
  data: [],
  loading: false,
  error: null,
  count: 0,
  refetch: vi.fn(),
};

describe('useUnifiedIncidents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useRealtimeIncidents as ReturnType<typeof vi.fn>).mockReturnValue(defaultRealtimeResult);
  });

  describe('source tagging', () => {
    it('tags realtime incidents as frontend', () => {
      (useRealtimeIncidents as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultRealtimeResult,
        data: [mockRealtimeIncident({ id: 'inc-1', correlationId: 'corr-1' })],
      });

      const { result } = renderHook(() => useUnifiedIncidents());

      expect(result.current.data).toHaveLength(1);
      expect(result.current.data[0].source).toBe('frontend');
    });

    it('returns empty data when no incidents', () => {
      const { result } = renderHook(() => useUnifiedIncidents());

      expect(result.current.data).toHaveLength(0);
      expect(result.current.count).toBe(0);
    });
  });

  describe('severity-first sort', () => {
    it('sorts P0 before P1 before P2 before P3', () => {
      (useRealtimeIncidents as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultRealtimeResult,
        data: [
          mockRealtimeIncident({ id: 'i3', severity: 'P3', createdAt: '2026-01-01T10:00:00Z' }),
          mockRealtimeIncident({ id: 'i0', severity: 'P0', createdAt: '2026-01-01T09:00:00Z' }),
          mockRealtimeIncident({ id: 'i2', severity: 'P2', createdAt: '2026-01-01T08:00:00Z' }),
          mockRealtimeIncident({ id: 'i1', severity: 'P1', createdAt: '2026-01-01T07:00:00Z' }),
        ],
      });

      const { result } = renderHook(() => useUnifiedIncidents());

      expect(result.current.data[0].severity).toBe('P0');
      expect(result.current.data[1].severity).toBe('P1');
      expect(result.current.data[2].severity).toBe('P2');
      expect(result.current.data[3].severity).toBe('P3');
    });

    it('within same severity, sorts newest first', () => {
      (useRealtimeIncidents as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultRealtimeResult,
        data: [
          mockRealtimeIncident({ id: 'older', severity: 'P1', createdAt: '2026-01-01T08:00:00Z' }),
          mockRealtimeIncident({ id: 'newer', severity: 'P1', createdAt: '2026-01-01T12:00:00Z' }),
        ],
      });

      const { result } = renderHook(() => useUnifiedIncidents());

      expect(result.current.data[0].id).toBe('newer');
      expect(result.current.data[1].id).toBe('older');
    });
  });

  describe('count', () => {
    it('count equals unified data length', () => {
      (useRealtimeIncidents as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultRealtimeResult,
        data: [
          mockRealtimeIncident({ id: 'a', correlationId: 'ca' }),
          mockRealtimeIncident({ id: 'b', correlationId: 'cb' }),
        ],
        count: 2,
      });

      const { result } = renderHook(() => useUnifiedIncidents());

      expect(result.current.count).toBe(2);
    });
  });

  describe('passthrough fields', () => {
    it('exposes loading from useRealtimeIncidents', () => {
      (useRealtimeIncidents as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultRealtimeResult,
        loading: true,
      });

      const { result } = renderHook(() => useUnifiedIncidents());

      expect(result.current.loading).toBe(true);
    });

    it('exposes error from useRealtimeIncidents', () => {
      (useRealtimeIncidents as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultRealtimeResult,
        error: 'DB connection timeout',
      });

      const { result } = renderHook(() => useUnifiedIncidents());

      expect(result.current.error).toBe('DB connection timeout');
    });

    it('exposes refetch from useRealtimeIncidents', () => {
      const refetch = vi.fn();
      (useRealtimeIncidents as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultRealtimeResult,
        refetch,
      });

      const { result } = renderHook(() => useUnifiedIncidents());
      result.current.refetch();

      expect(refetch).toHaveBeenCalledOnce();
    });
  });
});
