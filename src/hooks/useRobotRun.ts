/**
 * Robot run status hook — polls /admin/ops/robots/{run_id} while status=running.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { buildOpsFacadeUrl, buildOpsHeaders } from '@/services/opsFacadeClient';

const POLL_INTERVAL_ACTIVE_MS = 2_000;

export type RobotRunStatus = 'pending' | 'running' | 'passed' | 'failed' | 'error';

export interface RobotScenario {
  name: string;
  status: 'pending' | 'running' | 'passed' | 'failed';
  duration?: number;
  error?: string;
}

export interface RobotRun {
  runId: string;
  status: RobotRunStatus;
  environment: string;
  scenarios: RobotScenario[];
  summary?: string;
  startedAt: string;
  completedAt?: string;
}

interface UseRobotRunResult {
  run: RobotRun | null;
  loading: boolean;
  error: string | null;
}

export function useRobotRun(runId: string | null): UseRobotRunResult {
  const [run, setRun] = useState<RobotRun | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchRun = useCallback(async () => {
    if (!runId || !mountedRef.current) return;

    try {
      const res = await fetch(buildOpsFacadeUrl(`/admin/ops/robots/${runId}`), {
        headers: buildOpsHeaders({ includeJson: false, includeSuiteId: true }),
      });

      if (!res.ok) throw new Error(`Robot API error: ${res.status}`);

      const data = await res.json() as RobotRun;
      if (mountedRef.current) {
        setRun(data);
        setError(null);

        // Stop polling when done
        if (data.status !== 'pending' && data.status !== 'running') {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
        }
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to fetch robot run');
      }
    }
  }, [runId]);

  useEffect(() => {
    mountedRef.current = true;

    if (!runId) {
      setRun(null);
      return;
    }

    setLoading(true);
    fetchRun().finally(() => {
      if (mountedRef.current) setLoading(false);
    });

    intervalRef.current = setInterval(fetchRun, POLL_INTERVAL_ACTIVE_MS);

    return () => {
      mountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [runId, fetchRun]);

  return { run, loading, error };
}
