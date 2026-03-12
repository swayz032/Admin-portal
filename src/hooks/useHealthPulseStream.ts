/**
 * Health pulse SSE stream — live system health overview for the Dashboard.
 * Returns aggregated health status: provider counts, pending approvals,
 * open incidents, outbox pending.
 */

import { useSSEStream } from './useSSEStream';
import { getAdminToken } from '@/lib/adminAuth';
import { buildOpsFacadeUrl, buildOpsHeaders } from '@/services/opsFacadeClient';

export interface HealthPulse {
  status: 'healthy' | 'degraded' | 'critical';
  providers_up: number;
  providers_total: number;
  pending_approvals: number;
  open_incidents: number;
  outbox_pending: number;
  timestamp: string;
}

export function useHealthPulseStream() {
  const adminToken = getAdminToken();
  const { lastEvent, status, error, reconnect, disconnect } = useSSEStream<HealthPulse>({
    url: buildOpsFacadeUrl('/admin/ops/health-pulse/stream'),
    headers: buildOpsHeaders({ includeJson: false, includeSuiteId: true }),
    enabled: !!adminToken,
  });

  return {
    pulse: lastEvent?.data ?? null,
    status,
    error,
    reconnect,
    disconnect,
  };
}
