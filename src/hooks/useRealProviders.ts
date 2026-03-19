/**
 * Real provider health — derived from receipts table, not finance_connections.
 * Shows actual Aspire provider integrations with receipt-based health status.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PROVIDER_REGISTRY, mapReceiptTypeToProvider } from '@/lib/providerRegistry';
import type { ProviderStatus } from '@/hooks/useProviderHealthStream';

export interface RealProvider {
  id: string;
  name: string;
  category: string;
  status: ProviderStatus;
  totalReceipts24h: number;
  failedReceipts24h: number;
  successRate: number;
  lastActivity: string | null;
}

interface UseRealProvidersResult {
  providers: RealProvider[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useRealProviders(): UseRealProvidersResult {
  const [providers, setProviders] = useState<RealProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const { data: receipts, error: fetchError } = await supabase
        .from('receipts')
        .select('receipt_type, status, created_at')
        .gte('created_at', since24h);

      if (fetchError) throw new Error(fetchError.message);

      // Aggregate by provider
      const providerStats = new Map<string, { total: number; failed: number; lastActivity: string }>();

      for (const r of receipts ?? []) {
        const providerId = mapReceiptTypeToProvider(r.receipt_type ?? '');
        if (!providerId) continue;

        const stats = providerStats.get(providerId) ?? { total: 0, failed: 0, lastActivity: '' };
        stats.total++;
        if (r.status === 'FAILED' || r.status === 'DENIED') stats.failed++;
        if (!stats.lastActivity || r.created_at > stats.lastActivity) {
          stats.lastActivity = r.created_at;
        }
        providerStats.set(providerId, stats);
      }

      // Build provider list — include all registry providers, mark inactive ones
      const result: RealProvider[] = PROVIDER_REGISTRY.map(info => {
        const stats = providerStats.get(info.id);
        const total = stats?.total ?? 0;
        const failed = stats?.failed ?? 0;
        const successRate = total > 0 ? ((total - failed) / total) * 100 : 100;

        let status: ProviderStatus = 'disconnected';
        if (total > 0) {
          status = successRate >= 90 ? 'connected' : successRate >= 50 ? 'degraded' : 'disconnected';
        }

        return {
          id: info.id,
          name: info.name,
          category: info.category,
          status,
          totalReceipts24h: total,
          failedReceipts24h: failed,
          successRate,
          lastActivity: stats?.lastActivity ?? null,
        };
      });

      // Sort: active providers first, then by total receipts desc
      result.sort((a, b) => {
        if (a.totalReceipts24h > 0 && b.totalReceipts24h === 0) return -1;
        if (b.totalReceipts24h > 0 && a.totalReceipts24h === 0) return 1;
        return b.totalReceipts24h - a.totalReceipts24h;
      });

      setProviders(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load providers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Realtime: refresh on new receipts (debounced)
  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout>;
    const channel = supabase
      .channel('real-providers-refresh')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'receipts' },
        () => {
          clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => load(), 3000);
        },
      )
      .subscribe();

    return () => {
      clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, [load]);

  return { providers, loading, error, refetch: load };
}
