/**
 * Outbox SSE stream — live outbox job status updates.
 * Returns aggregated outbox state: pending/failed/processed counts
 * and the latest job list snapshot.
 */

import { useSSEStream } from './useSSEStream';
import { getAdminToken, getSuiteId } from '@/lib/adminAuth';

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

export function useOutboxStream() {
  const adminToken = getAdminToken();
  const suiteId = getSuiteId();

  const { lastEvent, status, error, reconnect, disconnect } = useSSEStream<OutboxStatus>({
    url: `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/admin/ops/outbox/stream`,
    headers: {
      'X-Admin-Token': adminToken,
      'X-Suite-Id': suiteId,
    },
    enabled: !!adminToken,
  });

  return {
    outbox: lastEvent?.data ?? null,
    status,
    error,
    reconnect,
    disconnect,
  };
}
