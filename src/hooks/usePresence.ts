/**
 * usePresence — Supabase Realtime Presence for admin portal
 *
 * Shows who's online in the admin portal via channel.track().
 * Uses Supabase Realtime Presence (free tier: 200 concurrent connections).
 *
 * Usage:
 *   const { onlineUsers, isConnected } = usePresence('admin-portal');
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface PresenceUser {
  userId: string;
  email: string;
  name: string;
  onlineAt: string;
}

interface UsePresenceResult {
  onlineUsers: PresenceUser[];
  isConnected: boolean;
}

export function usePresence(channelName = 'admin-portal'): UsePresenceResult {
  const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const syncPresence = useCallback(() => {
    if (!channelRef.current) return;
    const state = channelRef.current.presenceState<PresenceUser>();
    const users: PresenceUser[] = [];
    for (const key of Object.keys(state)) {
      for (const presence of state[key]) {
        users.push({
          userId: presence.userId,
          email: presence.email,
          name: presence.name,
          onlineAt: presence.onlineAt,
        });
      }
    }
    setOnlineUsers(users);
  }, []);

  useEffect(() => {
    let disposed = false;

    const setup = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || disposed) return;

      const channel = supabase.channel(channelName, {
        config: { presence: { key: user.id } },
      });

      channel
        .on('presence', { event: 'sync' }, () => {
          if (!disposed) syncPresence();
        })
        .on('presence', { event: 'join' }, ({ newPresences }) => {
          console.log('[Presence] User joined:', newPresences);
          if (!disposed) syncPresence();
        })
        .on('presence', { event: 'leave' }, ({ leftPresences }) => {
          console.log('[Presence] User left:', leftPresences);
          if (!disposed) syncPresence();
        })
        .subscribe(async (status) => {
          if (disposed) return;
          if (status === 'SUBSCRIBED') {
            setIsConnected(true);
            await channel.track({
              userId: user.id,
              email: user.email ?? '',
              name: user.user_metadata?.name ?? user.email ?? 'Admin',
              onlineAt: new Date().toISOString(),
            });
          }
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            setIsConnected(false);
          }
        });

      channelRef.current = channel;
    };

    setup();

    return () => {
      disposed = true;
      setIsConnected(false);
      if (channelRef.current) {
        channelRef.current.untrack();
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [channelName, syncPresence]);

  return { onlineUsers, isConnected };
}
