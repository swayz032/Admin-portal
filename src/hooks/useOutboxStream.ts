/**
 * Outbox SSE stream — live outbox job status updates.
 * Returns aggregated outbox state: pending/failed/processed counts
 * and the latest job list snapshot.
 */

import { useSSEStream } from './useSSEStream';
import { getAdminToken } from '@/lib/adminAuth';
import { buildOpsFacadeUrl, buildOpsHeaders } from '@/services/opsFacadeClient';

export interface OutboxJobSnapshot {
  id: string;
  action: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface OutboxStatus {
  pending: number;
  failed: number;
  processed: number;
  jobs: OutboxJobSnapshot[];
  timestamp: string;
}

// SSE backend endpoint does not exist yet — disable stream to prevent retry storms.
const SSE_BACKEND_AVAILABLE = false;

export function useOutboxStream() {
  const adminToken = getAdminToken();
  const { lastEvent, status, error, reconnect, disconnect } = useSSEStream<OutboxStatus>({
    url: buildOpsFacadeUrl('/admin/ops/outbox/stream'),
    headers: buildOpsHeaders({ includeJson: false, includeSuiteId: true }),
    enabled: SSE_BACKEND_AVAILABLE && !!adminToken,
  });

  return {
    outbox: lastEvent?.data ?? null,
    status,
    error,
    reconnect,
    disconnect,
  };
}
