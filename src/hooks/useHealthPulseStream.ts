/**
 * Health pulse SSE stream — live system health overview for the Dashboard.
 * Returns aggregated health status: provider counts, pending approvals,
 * open incidents, outbox pending.
 */

import { useSSEStream } from './useSSEStream';
import { getAdminToken, getSuiteId } from '@/lib/adminAuth';

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
  const suiteId = getSuiteId();

  const { lastEvent, status, error, reconnect, disconnect } = useSSEStream<HealthPulse>({
    url: `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/admin/ops/health-pulse/stream`,
    headers: {
      'X-Admin-Token': adminToken,
      'X-Suite-Id': suiteId,
    },
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
