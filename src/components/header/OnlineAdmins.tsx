/**
 * OnlineAdmins — Shows who's online in the admin portal
 *
 * Uses Supabase Realtime Presence via usePresence hook.
 * Displays avatar dots with tooltip showing online admin list.
 */

import { usePresence } from '@/hooks/usePresence';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Users } from 'lucide-react';

export function OnlineAdmins() {
  const { onlineUsers, isConnected } = usePresence('admin-portal');

  if (!isConnected || onlineUsers.length === 0) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-accent cursor-default">
          <Users className="h-3.5 w-3.5 text-muted-foreground" />
          <div className="flex -space-x-1.5">
            {onlineUsers.slice(0, 3).map((user) => (
              <div
                key={user.userId}
                className="w-5 h-5 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 ring-2 ring-background flex items-center justify-center"
                title={user.name}
              >
                <span className="text-[9px] font-bold text-white leading-none">
                  {user.name.charAt(0).toUpperCase()}
                </span>
              </div>
            ))}
            {onlineUsers.length > 3 && (
              <div className="w-5 h-5 rounded-full bg-muted ring-2 ring-background flex items-center justify-center">
                <span className="text-[9px] font-medium text-muted-foreground leading-none">
                  +{onlineUsers.length - 3}
                </span>
              </div>
            )}
          </div>
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" align="end" className="max-w-64">
        <p className="font-medium text-xs mb-1">Online Admins ({onlineUsers.length})</p>
        <div className="space-y-0.5">
          {onlineUsers.map((user) => (
            <p key={user.userId} className="text-xs text-muted-foreground">
              {user.name} {user.email ? `(${user.email})` : ''}
            </p>
          ))}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
