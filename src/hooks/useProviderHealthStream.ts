/**
 * Provider health SSE stream — live provider connectivity status.
 * Returns live provider states: connected/degraded/disconnected with metrics.
 */

import { useState, useEffect } from 'react';
import { useSSEStream } from './useSSEStream';
import { getAdminToken } from '@/lib/adminAuth';
import { buildOpsFacadeUrl, buildOpsHeaders } from '@/services/opsFacadeClient';

export type ProviderStatus = 'connected' | 'degraded' | 'disconnected';

export interface ProviderHealth {
  provider: string;
  lane: string;
  status: ProviderStatus;
  latencyMs: number;
  errorRate: number;
  lastChecked: string;
  lastSuccessfulCall?: string;
}

interface UseProviderHealthStreamResult {
  providers: ProviderHealth[];
  hasIssues: boolean;
  degradedCount: number;
  disconnectedCount: number;
  isConnected: boolean;
}

export function useProviderHealthStream(): UseProviderHealthStreamResult {
  const [providers, setProviders] = useState<ProviderHealth[]>([]);

  const adminToken = getAdminToken();
  const { lastEvent, status } = useSSEStream<ProviderHealth[] | ProviderHealth>({
    url: buildOpsFacadeUrl('/admin/ops/providers/stream'),
    headers: buildOpsHeaders({ includeJson: false, includeSuiteId: true }),
    enabled: !!adminToken,
  });

  useEffect(() => {
    if (!lastEvent) return;

    const data = lastEvent.data;
    if (Array.isArray(data)) {
      // Full state update
      setProviders(data);
    } else if (data && typeof data === 'object' && 'provider' in data) {
      // Single provider update — merge
      setProviders(prev => {
        const idx = prev.findIndex(p => p.provider === (data as ProviderHealth).provider);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = data as ProviderHealth;
          return next;
        }
        return [...prev, data as ProviderHealth];
      });
    }
  }, [lastEvent]);

  const degradedCount = providers.filter(p => p.status === 'degraded').length;
  const disconnectedCount = providers.filter(p => p.status === 'disconnected').length;

  return {
    providers,
    hasIssues: degradedCount > 0 || disconnectedCount > 0,
    degradedCount,
    disconnectedCount,
    isConnected: status === 'connected',
  };
}
