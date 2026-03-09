/**
 * Council session hook — polls GET /admin/ops/council/{session_id}.
 * Returns advisor proposals, adjudication, and session status.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { getAdminToken } from '@/lib/adminAuth';

const POLL_INTERVAL_ACTIVE_MS = 2_000;
const POLL_INTERVAL_IDLE_MS = 10_000;

export type CouncilStatus = 'deliberating' | 'proposed' | 'adjudicating' | 'decided' | 'error';

export interface AdvisorProposal {
  model: string;
  role: string;
  proposal: string;
  confidence: number;
  status: 'thinking' | 'proposed' | 'critiqued';
}

export interface CouncilAdjudication {
  decision: string;
  reasoning: string;
  selectedAdvisor?: string;
  confidence: number;
}

export interface CouncilSession {
  sessionId: string;
  status: CouncilStatus;
  topic: string;
  advisors: AdvisorProposal[];
  adjudication: CouncilAdjudication | null;
  startedAt: string;
  completedAt: string | null;
}

interface UseCouncilSessionResult {
  session: CouncilSession | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useCouncilSession(sessionId: string | null): UseCouncilSessionResult {
  const [session, setSession] = useState<CouncilSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchSession = useCallback(async () => {
    if (!sessionId || !mountedRef.current) return;

    try {
      const adminToken = getAdminToken();
      const res = await fetch(`/api/admin/ops/council/${sessionId}`, {
        headers: {
          'X-Admin-Token': adminToken,
        },
      });

      if (!res.ok) {
        throw new Error(`Council API error: ${res.status}`);
      }

      const data = await res.json() as CouncilSession;
      if (mountedRef.current) {
        setSession(data);
        setError(null);

        // Stop polling once decided
        if (data.status === 'decided' || data.status === 'error') {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
        }
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to fetch council session');
      }
    }
  }, [sessionId]);

  const refetch = useCallback(() => {
    setLoading(true);
    fetchSession().finally(() => {
      if (mountedRef.current) setLoading(false);
    });
  }, [fetchSession]);

  useEffect(() => {
    mountedRef.current = true;

    if (!sessionId) {
      setSession(null);
      return;
    }

    setLoading(true);
    fetchSession().finally(() => {
      if (mountedRef.current) setLoading(false);
    });

    // Poll while active
    const interval = session?.status === 'decided' || session?.status === 'error'
      ? POLL_INTERVAL_IDLE_MS
      : POLL_INTERVAL_ACTIVE_MS;

    intervalRef.current = setInterval(fetchSession, interval);

    return () => {
      mountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [sessionId, fetchSession, session?.status]);

  return { session, loading, error, refetch };
}
