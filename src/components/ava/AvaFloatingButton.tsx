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
      {/* Floating Ava Button — Aspire Blue, opens real voice modal */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'fixed bottom-6 right-6 z-50',
          'w-14 h-14 rounded-full',
          'shadow-lg',
          'flex items-center justify-center',
          'transition-all duration-300',
          'hover:scale-110 hover:shadow-xl',
          'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background',
          isOpen
            ? 'bg-muted/80 shadow-muted/25 focus:ring-muted'
            : 'bg-[#3B82F6] shadow-[#3B82F6]/25 hover:shadow-[#3B82F6]/40 focus:ring-[#3B82F6]'
        )}
        aria-label={isOpen ? 'Close Ava voice assistant' : 'Open Ava voice assistant'}
      >
        {/* Icon */}
        <div className="relative z-10">
          {isOpen ? (
            <X className="h-6 w-6 text-muted-foreground" />
          ) : (
            <Mic className="h-6 w-6 text-white" />
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

        {/* Subtle pulse ring */}
        {!isOpen && (
          <div className="absolute inset-0 rounded-full border-2 border-[#3B82F6] animate-ping opacity-20" />
        )}
      </button>

      {/* Real Ava Voice Modal */}
      <VoiceModal open={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
