/**
 * Provider health SSE stream - live provider connectivity status.
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
  const { lastEvent, status } = useSSEStream<ProviderHealth[] | ProviderHealth | { items: ProviderHealth[] }>({
    url: buildOpsFacadeUrl('/admin/ops/providers/stream'),
    headers: buildOpsHeaders({ includeJson: false, includeSuiteId: true }),
    enabled: !!adminToken,
  });

  useEffect(() => {
    if (!lastEvent) return;

    const data = lastEvent.data;
    if (Array.isArray(data)) {
      setProviders(data);
      return;
    }

    if (data && typeof data === 'object' && Array.isArray((data as { items?: unknown[] }).items)) {
      setProviders((data as { items: ProviderHealth[] }).items);
      return;
    }

    if (data && typeof data === 'object' && 'provider' in data) {
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

  const providerList = Array.isArray(providers) ? providers : [];
  const degradedCount = providerList.filter(p => p.status === 'degraded').length;
  const disconnectedCount = providerList.filter(p => p.status === 'disconnected').length;

  return {
    providers: providerList,
    hasIssues: degradedCount > 0 || disconnectedCount > 0,
    degradedCount,
    disconnectedCount,
    isConnected: status === 'connected',
  };
}
