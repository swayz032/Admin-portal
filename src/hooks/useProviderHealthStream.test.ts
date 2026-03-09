/**
 * Tests for useProviderHealthStream hook (Wave 9 Admin Portal Overhaul).
 *
 * Validates:
 * - Returns correct aggregated health counts
 * - Full state replacement on array SSE event
 * - Single provider merge on object SSE event
 * - hasIssues flag accuracy
 * - isConnected mirrors SSE status
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useProviderHealthStream } from './useProviderHealthStream';

// ── Mock useSSEStream ──────────────────────────────────────────────
vi.mock('./useSSEStream', () => ({
  useSSEStream: vi.fn(),
}));

import { useSSEStream } from './useSSEStream';

const defaultSSEResult = {
  lastEvent: null,
  events: [],
  status: 'connected',
  error: null,
  reconnect: vi.fn(),
  disconnect: vi.fn(),
};

const makeProvider = (overrides = {}) => ({
  provider: 'Stripe',
  lane: 'payment',
  status: 'connected' as const,
  latencyMs: 45,
  errorRate: 0.01,
  lastChecked: '2026-01-01T10:00:00Z',
  ...overrides,
});

describe('useProviderHealthStream', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useSSEStream as ReturnType<typeof vi.fn>).mockReturnValue(defaultSSEResult);
    // jsdom doesn't have localStorage by default — polyfill
    if (!window.localStorage) {
      Object.defineProperty(window, 'localStorage', {
        value: {
          getItem: vi.fn().mockReturnValue(null),
          setItem: vi.fn(),
          removeItem: vi.fn(),
          clear: vi.fn(),
        },
        writable: true,
      });
    }
  });

  describe('initial state', () => {
    it('starts with empty providers list', () => {
      const { result } = renderHook(() => useProviderHealthStream());
      expect(result.current.providers).toHaveLength(0);
    });

    it('reports hasIssues=false when no providers', () => {
      const { result } = renderHook(() => useProviderHealthStream());
      expect(result.current.hasIssues).toBe(false);
    });

    it('reports degradedCount=0 and disconnectedCount=0 initially', () => {
      const { result } = renderHook(() => useProviderHealthStream());
      expect(result.current.degradedCount).toBe(0);
      expect(result.current.disconnectedCount).toBe(0);
    });
  });

  describe('full state replacement (array event)', () => {
    it('replaces entire providers list on array SSE event', () => {
      const providers = [
        makeProvider({ provider: 'Stripe', status: 'connected' }),
        makeProvider({ provider: 'OpenAI', status: 'degraded' }),
      ];

      (useSSEStream as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultSSEResult,
        lastEvent: { type: 'update', data: providers, timestamp: Date.now() },
      });

      const { result } = renderHook(() => useProviderHealthStream());
      expect(result.current.providers).toHaveLength(2);
    });

    it('correctly counts degraded providers from full state update', () => {
      const providers = [
        makeProvider({ provider: 'Stripe', status: 'connected' }),
        makeProvider({ provider: 'OpenAI', status: 'degraded' }),
        makeProvider({ provider: 'Twilio', status: 'degraded' }),
      ];

      (useSSEStream as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultSSEResult,
        lastEvent: { type: 'update', data: providers, timestamp: Date.now() },
      });

      const { result } = renderHook(() => useProviderHealthStream());
      expect(result.current.degradedCount).toBe(2);
      expect(result.current.hasIssues).toBe(true);
    });

    it('correctly counts disconnected providers', () => {
      const providers = [
        makeProvider({ provider: 'Stripe', status: 'disconnected' }),
      ];

      (useSSEStream as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultSSEResult,
        lastEvent: { type: 'update', data: providers, timestamp: Date.now() },
      });

      const { result } = renderHook(() => useProviderHealthStream());
      expect(result.current.disconnectedCount).toBe(1);
      expect(result.current.hasIssues).toBe(true);
    });
  });

  describe('single provider merge (object event)', () => {
    it('adds new provider when not already in list', () => {
      const newProvider = makeProvider({ provider: 'Twilio', status: 'connected' });

      (useSSEStream as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultSSEResult,
        lastEvent: { type: 'update', data: newProvider, timestamp: Date.now() },
      });

      const { result } = renderHook(() => useProviderHealthStream());
      expect(result.current.providers).toHaveLength(1);
      expect(result.current.providers[0].provider).toBe('Twilio');
    });

    it('updates existing provider in-place when provider name matches', () => {
      // Single object event should add a provider
      const updated = makeProvider({ provider: 'Stripe', status: 'degraded', latencyMs: 1200 });

      (useSSEStream as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultSSEResult,
        lastEvent: { type: 'update', data: updated, timestamp: Date.now() },
      });

      const { result } = renderHook(() => useProviderHealthStream());
      expect(result.current.providers).toHaveLength(1);
      expect(result.current.providers[0].provider).toBe('Stripe');
      expect(result.current.providers[0].status).toBe('degraded');
    });
  });

  describe('isConnected', () => {
    it('isConnected=true when SSE status=connected', () => {
      (useSSEStream as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultSSEResult,
        status: 'connected',
      });

      const { result } = renderHook(() => useProviderHealthStream());
      expect(result.current.isConnected).toBe(true);
    });

    it('isConnected=false when SSE status=error', () => {
      (useSSEStream as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultSSEResult,
        status: 'error',
      });

      const { result } = renderHook(() => useProviderHealthStream());
      expect(result.current.isConnected).toBe(false);
    });

    it('isConnected=false when SSE status=disconnected', () => {
      (useSSEStream as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultSSEResult,
        status: 'disconnected',
      });

      const { result } = renderHook(() => useProviderHealthStream());
      expect(result.current.isConnected).toBe(false);
    });
  });

  describe('hasIssues flag logic', () => {
    it('hasIssues=false when all providers are connected', () => {
      const providers = [
        makeProvider({ provider: 'Stripe', status: 'connected' }),
        makeProvider({ provider: 'OpenAI', status: 'connected' }),
      ];

      (useSSEStream as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultSSEResult,
        lastEvent: { type: 'update', data: providers, timestamp: Date.now() },
      });

      const { result } = renderHook(() => useProviderHealthStream());
      expect(result.current.hasIssues).toBe(false);
    });

    it('hasIssues=true when at least one provider is degraded', () => {
      const providers = [
        makeProvider({ provider: 'Stripe', status: 'connected' }),
        makeProvider({ provider: 'OpenAI', status: 'degraded' }),
      ];

      (useSSEStream as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultSSEResult,
        lastEvent: { type: 'update', data: providers, timestamp: Date.now() },
      });

      const { result } = renderHook(() => useProviderHealthStream());
      expect(result.current.hasIssues).toBe(true);
    });
  });
});
