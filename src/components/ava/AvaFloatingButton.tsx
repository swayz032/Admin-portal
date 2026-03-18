/**
 * AvaFloatingButton — Production floating action button for voice sessions.
 *
 * Features:
 * - Fixed bottom-right position (z-50)
 * - Aspire Blue (#3B82F6) with hover/active states
 * - Notification badge for pending items
 * - Smooth scale + shadow transitions
 * - Accessible focus ring with offset
 * - Opens VoiceModal directly
 */

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Mic, X } from 'lucide-react';
import { VoiceModal } from '@/components/admin-ava/VoiceModal';

interface AvaFloatingButtonProps {
  hasNotifications?: boolean;
  notificationCount?: number;
}

export function AvaFloatingButton({ hasNotifications = false, notificationCount = 0 }: AvaFloatingButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'fixed bottom-6 right-6 z-50',
          'w-14 h-14 rounded-full',
          'shadow-lg',
          'flex items-center justify-center',
          'transition-all duration-200',
          'hover:scale-105 hover:shadow-xl',
          'active:scale-95',
          'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background',
          isOpen
            ? 'bg-muted/80 shadow-muted/25 focus:ring-muted'
            : 'bg-[#3B82F6] shadow-[#3B82F6]/25 hover:shadow-[#3B82F6]/40 focus:ring-[#3B82F6]'
        )}
        aria-label={isOpen ? 'Close Ava voice assistant' : 'Open Ava voice assistant'}
      >
        <div className="relative z-10">
          {isOpen ? (
            <X className="h-5 w-5 text-muted-foreground" />
          ) : (
            <Mic className="h-5 w-5 text-white" />
          )}
        </div>

        {/* Notification badge */}
        {hasNotifications && !isOpen && (
          <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive flex items-center justify-center">
            <span className="text-[10px] font-bold text-white">
              {notificationCount > 9 ? '9+' : notificationCount}
            </span>
          </div>
        )}

        {/* Subtle breathing ring (not aggressive ping) */}
        {!isOpen && (
          <div
            className="absolute inset-0 rounded-full border border-[#3B82F6]/30 pointer-events-none"
            style={{
              animation: 'fab-breathe 3s ease-in-out infinite',
            }}
          />
        )}
      </button>

      <VoiceModal open={isOpen} onClose={() => setIsOpen(false)} />

      {/* Scoped animation keyframe */}
      <style>{`
        @keyframes fab-breathe {
          0%, 100% { transform: scale(1); opacity: 0.4; }
          50% { transform: scale(1.15); opacity: 0; }
        }
      `}</style>
    </>
  );
}
