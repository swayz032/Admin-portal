/**
 * Error stream hook — merges Supabase Realtime incidents + backend SSE errors.
 * Deduplicates by correlation_id. Source-tagged: Frontend/Backend/Both.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSSEStream } from './useSSEStream';
import { getAdminToken } from '@/lib/adminAuth';
import { buildOpsFacadeUrl, buildOpsHeaders } from '@/services/opsFacadeClient';

export type ErrorSource = 'frontend' | 'backend' | 'both';
export type ErrorSeverity = 'P0' | 'P1' | 'P2' | 'P3';

export interface LiveError {
  id: string;
  severity: ErrorSeverity;
  source: ErrorSource;
  message: string;
  timestamp: string;
  correlationId?: string;
  stackTrace?: string;
  provider?: string;
}

interface UseErrorStreamResult {
  errors: LiveError[];
  counts: { total: number; p0: number; p1: number; p2: number; p3: number };
  hasNewErrors: boolean;
  clearNewFlag: () => void;
}

const MAX_ERRORS = 200;
const RATE_LIMIT_MS = 1_000; // Max 1 UI update per second

// SSE backend endpoint does not exist yet — disable stream to prevent retry storms.
// When the backend SSE endpoint is built, set this to true to enable live error streaming.
const SSE_BACKEND_AVAILABLE = false;

export function useErrorStream(): UseErrorStreamResult {
  const [errors, setErrors] = useState<LiveError[]>([]);
  const [hasNewErrors, setHasNewErrors] = useState(false);
  const lastUpdateRef = useRef(0);
  const pendingRef = useRef<LiveError[]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Backend SSE error stream (Supabase incidents handled by useUnifiedIncidents → useRealtimeIncidents)
  const adminToken = getAdminToken();
  const { lastEvent: sseEvent } = useSSEStream<{
    id: string;
    severity: string;
    message: string;
    timestamp: string;
    correlation_id?: string;
    stack_trace?: string;
    provider?: string;
  }>({
    url: buildOpsFacadeUrl('/admin/ops/incidents/stream'),
    headers: buildOpsHeaders({ includeJson: false, includeSuiteId: true }),
    enabled: SSE_BACKEND_AVAILABLE && !!adminToken,
  });

  // Rate-limited error addition
  const flushPending = useCallback(() => {
    if (pendingRef.current.length === 0) return;

    setErrors(prev => {
      const merged = [...pendingRef.current, ...prev];
      // Dedup by id
      const seen = new Set<string>();
      const deduped = merged.filter(e => {
        if (seen.has(e.id)) return false;
        seen.add(e.id);
        return true;
      });
      return deduped.slice(0, MAX_ERRORS);
    });
    pendingRef.current = [];
    setHasNewErrors(true);
    lastUpdateRef.current = Date.now();
  }, []);

  const addError = useCallback((error: LiveError) => {
    pendingRef.current.push(error);
    const timeSinceLast = Date.now() - lastUpdateRef.current;

    if (timeSinceLast >= RATE_LIMIT_MS) {
      flushPending();
    } else if (!flushTimerRef.current) {
      flushTimerRef.current = setTimeout(() => {
        flushPending();
        flushTimerRef.current = null;
      }, RATE_LIMIT_MS - timeSinceLast);
    }
  }, [flushPending]);

  // Map SSE events to LiveErrors
  useEffect(() => {
    if (!sseEvent) return;
    const d = sseEvent.data;
    addError({
      id: d.id,
      severity: (d.severity as ErrorSeverity) || 'P3',
      source: 'backend',
      message: d.message,
      timestamp: d.timestamp,
      correlationId: d.correlation_id,
      stackTrace: d.stack_trace,
      provider: d.provider,
    });
  }, [sseEvent, addError]);

  const counts = {
    total: errors.length,
    p0: errors.filter(e => e.severity === 'P0').length,
    p1: errors.filter(e => e.severity === 'P1').length,
    p2: errors.filter(e => e.severity === 'P2').length,
    p3: errors.filter(e => e.severity === 'P3').length,
  };

  const clearNewFlag = useCallback(() => setHasNewErrors(false), []);

  return { errors, counts, hasNewErrors, clearNewFlag };
}
