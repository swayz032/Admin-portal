/**
 * useRedAlertBroadcast — Subscribe to RED-tier receipt broadcasts
 *
 * Listens on the 'red-alerts' Realtime Broadcast channel for server-side
 * notifications triggered by the broadcast_red_receipt() SQL trigger.
 *
 * Usage:
 *   const { alerts, latestAlert, clearAlerts } = useRedAlertBroadcast();
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { devWarn, devLog } from '@/lib/devLog';

export interface RedAlert {
  receiptId: string;
  receiptType: string;
  tenantId: string;
  actorId: string;
  status: string;
  receivedAt: string;
}

interface UseRedAlertBroadcastResult {
  alerts: RedAlert[];
  latestAlert: RedAlert | null;
  clearAlerts: () => void;
  isConnected: boolean;
}

const MAX_ALERTS = 50;

export function useRedAlertBroadcast(): UseRedAlertBroadcastResult {
  const [alerts, setAlerts] = useState<RedAlert[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const { toast } = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const clearAlerts = useCallback(() => setAlerts([]), []);

  useEffect(() => {
    let disposed = false;

    const channel = supabase
      .channel('red-alerts')
      .on('broadcast', { event: 'new_red_receipt' }, (payload) => {
        if (disposed) return;
        const data = payload.payload as Record<string, unknown>;
        if (!data || typeof data.receipt_id !== 'string' || !data.receipt_id) {
          devWarn('[RedAlerts] Ignoring malformed broadcast payload:', data);
          return;
        }
        const alert: RedAlert = {
          receiptId: data.receipt_id,
          receiptType: (data.receipt_type as string) || 'unknown',
          tenantId: (data.tenant_id as string) || '',
          actorId: (data.actor_id as string) || '',
          status: (data.status as string) || 'unknown',
          receivedAt: new Date().toISOString(),
        };

        setAlerts((prev) => [alert, ...prev].slice(0, MAX_ALERTS));

        toastRef.current({
          variant: 'destructive',
          title: 'RED Alert: Critical Receipt',
          description: `${alert.receiptType} — ${alert.status} (${alert.actorId})`,
        });
      })
      .subscribe((status) => {
        if (disposed) return;
        setIsConnected(status === 'SUBSCRIBED');
        if (status === 'SUBSCRIBED') {
          devLog('[RedAlerts] Connected to broadcast channel');
        }
      });

    channelRef.current = channel;

    return () => {
      disposed = true;
      setIsConnected(false);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- toast via ref

  return {
    alerts,
    latestAlert: alerts[0] ?? null,
    clearAlerts,
    isConnected,
  };
}
