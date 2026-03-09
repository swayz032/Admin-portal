/**
 * Tests for useUnifiedIncidents hook (Wave 9 Admin Portal Overhaul).
 *
 * Validates:
 * - Deduplication by correlationId across frontend + backend sources
 * - Source tagging: frontend / backend / both
 * - Severity-first sort (P0 before P1), then newest-first within tier
 * - Filter passthrough to useRealtimeIncidents
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useUnifiedIncidents } from './useUnifiedIncidents';

// ── Mock dependencies ──────────────────────────────────────────────
vi.mock('./useRealtimeIncidents', () => ({
  useRealtimeIncidents: vi.fn(),
}));

vi.mock('./useErrorStream', () => ({
  useErrorStream: vi.fn(),
}));

import { useRealtimeIncidents } from './useRealtimeIncidents';
import { useErrorStream } from './useErrorStream';

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

const mockBackendError = (overrides = {}) => ({
  id: 'be-1',
  severity: 'P2' as const,
  source: 'backend' as const,
  message: 'Backend error',
  timestamp: '2026-01-01T09:00:00Z',
  correlationId: 'corr-2',
  provider: 'OpenAI',
  ...overrides,
});

const defaultRealtimeResult = {
  data: [],
  loading: false,
  error: null,
  count: 0,
  refetch: vi.fn(),
};

const defaultErrorStreamResult = {
  errors: [],
  counts: { total: 0, p0: 0, p1: 0, p2: 0, p3: 0 },
  hasNewErrors: false,
  clearNewFlag: vi.fn(),
};

describe('useUnifiedIncidents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useRealtimeIncidents as ReturnType<typeof vi.fn>).mockReturnValue(defaultRealtimeResult);
    (useErrorStream as ReturnType<typeof vi.fn>).mockReturnValue(defaultErrorStreamResult);
  });

  describe('source tagging', () => {
    it('tags realtime-only incidents as frontend', () => {
      (useRealtimeIncidents as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultRealtimeResult,
        data: [mockRealtimeIncident({ id: 'inc-1', correlationId: 'corr-1' })],
      });

      const { result } = renderHook(() => useUnifiedIncidents());

      expect(result.current.data).toHaveLength(1);
      expect(result.current.data[0].source).toBe('frontend');
    });

    it('tags backend-only errors as backend', () => {
      (useErrorStream as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultErrorStreamResult,
        errors: [mockBackendError({ id: 'be-1', correlationId: 'corr-99' })],
      });

      const { result } = renderHook(() => useUnifiedIncidents());

      expect(result.current.data).toHaveLength(1);
      expect(result.current.data[0].source).toBe('backend');
    });

    it('tags incidents seen from both sources as both', () => {
      const sharedCorr = 'corr-shared';
      (useRealtimeIncidents as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultRealtimeResult,
        data: [mockRealtimeIncident({ correlationId: sharedCorr })],
      });
      (useErrorStream as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultErrorStreamResult,
        errors: [mockBackendError({ correlationId: sharedCorr })],
      });

      const { result } = renderHook(() => useUnifiedIncidents());

      expect(result.current.data).toHaveLength(1);
      expect(result.current.data[0].source).toBe('both');
    });
  });

  describe('deduplication', () => {
    it('deduplicates by correlationId — shared incident appears once', () => {
      const sharedCorr = 'corr-dup';
      (useRealtimeIncidents as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultRealtimeResult,
        data: [mockRealtimeIncident({ correlationId: sharedCorr })],
      });
      (useErrorStream as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultErrorStreamResult,
        errors: [mockBackendError({ correlationId: sharedCorr })],
      });

      const { result } = renderHook(() => useUnifiedIncidents());

      expect(result.current.data).toHaveLength(1);
    });

    it('uses incident id as fallback key when correlationId is absent', () => {
      (useRealtimeIncidents as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultRealtimeResult,
        data: [mockRealtimeIncident({ correlationId: undefined, id: 'inc-no-corr' })],
      });

      const { result } = renderHook(() => useUnifiedIncidents());

      expect(result.current.data).toHaveLength(1);
      expect(result.current.data[0].id).toBe('inc-no-corr');
    });

    it('does NOT deduplicate when correlation IDs differ', () => {
      (useRealtimeIncidents as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultRealtimeResult,
        data: [mockRealtimeIncident({ correlationId: 'corr-A' })],
      });
      (useErrorStream as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultErrorStreamResult,
        errors: [mockBackendError({ correlationId: 'corr-B' })],
      });

      const { result } = renderHook(() => useUnifiedIncidents());

      expect(result.current.data).toHaveLength(2);
    });
  });

  describe('severity-first sort', () => {
    it('sorts P0 before P1 before P2 before P3', () => {
      (useErrorStream as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultErrorStreamResult,
        errors: [
          mockBackendError({ id: 'be-p3', correlationId: 'c3', severity: 'P3', timestamp: '2026-01-01T10:00:00Z' }),
          mockBackendError({ id: 'be-p0', correlationId: 'c0', severity: 'P0', timestamp: '2026-01-01T09:00:00Z' }),
          mockBackendError({ id: 'be-p2', correlationId: 'c2', severity: 'P2', timestamp: '2026-01-01T08:00:00Z' }),
          mockBackendError({ id: 'be-p1', correlationId: 'c1', severity: 'P1', timestamp: '2026-01-01T07:00:00Z' }),
        ],
      });

      const { result } = renderHook(() => useUnifiedIncidents());

      expect(result.current.data[0].severity).toBe('P0');
      expect(result.current.data[1].severity).toBe('P1');
      expect(result.current.data[2].severity).toBe('P2');
      expect(result.current.data[3].severity).toBe('P3');
    });

    it('within same severity, sorts newest first', () => {
      (useErrorStream as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultErrorStreamResult,
        errors: [
          mockBackendError({ id: 'older', correlationId: 'c-old', severity: 'P1', timestamp: '2026-01-01T08:00:00Z' }),
          mockBackendError({ id: 'newer', correlationId: 'c-new', severity: 'P1', timestamp: '2026-01-01T12:00:00Z' }),
        ],
      });

      const { result } = renderHook(() => useUnifiedIncidents());

      expect(result.current.data[0].id).toBe('newer');
      expect(result.current.data[1].id).toBe('older');
    });
  });

  describe('count', () => {
    it('count equals unified data length (not raw count from realtime)', () => {
      const sharedCorr = 'corr-shared';
      // realtime reports count=1, backend adds a duplicate — unified should be 1
      (useRealtimeIncidents as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultRealtimeResult,
        data: [mockRealtimeIncident({ correlationId: sharedCorr })],
        count: 1,
      });
      (useErrorStream as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultErrorStreamResult,
        errors: [mockBackendError({ correlationId: sharedCorr })],
      });

      const { result } = renderHook(() => useUnifiedIncidents());

      expect(result.current.count).toBe(1);
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

  describe('backend error → incident shape mapping', () => {
    it('maps backend error fields to Incident shape with source=backend', () => {
      (useErrorStream as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultErrorStreamResult,
        errors: [
          {
            id: 'be-map',
            severity: 'P0',
            source: 'backend',
            message: 'Critical failure',
            timestamp: '2026-01-02T00:00:00Z',
            correlationId: 'corr-map',
            provider: 'Stripe',
            stackTrace: 'Error: boom\n  at fn:1',
          },
        ],
      });

      const { result } = renderHook(() => useUnifiedIncidents());
      const incident = result.current.data[0];

      expect(incident.id).toBe('be-map');
      expect(incident.severity).toBe('P0');
      expect(incident.summary).toBe('Critical failure');
      expect(incident.provider).toBe('Stripe');
      expect(incident.source).toBe('backend');
      expect(incident.notes[0].body).toContain('Error: boom');
    });
  });
});
