import { useState } from 'react';
import { cn } from '@/lib/utils';
import { MessageCircle, X } from 'lucide-react';
import { AvaQuickPanel } from './AvaQuickPanel';

interface AvaFloatingButtonProps {
  hasNotifications?: boolean;
  notificationCount?: number;
}

export function AvaFloatingButton({ hasNotifications = false, notificationCount = 0 }: AvaFloatingButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'fixed bottom-6 right-6 z-50',
          'w-14 h-14 rounded-full',
          'bg-gradient-to-br from-primary to-primary/80',
          'shadow-lg shadow-primary/25',
          'flex items-center justify-center',
          'transition-all duration-300',
          'hover:scale-110 hover:shadow-xl hover:shadow-primary/30',
          'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background',
          isOpen && 'rotate-180 bg-muted'
        )}
        aria-label={isOpen ? 'Close Ava assistant' : 'Open Ava assistant'}
      >
        {/* Animated orb background */}
        <div 
          className={cn(
            'absolute inset-0 rounded-full',
            'bg-gradient-to-br from-primary/50 to-transparent',
            'animate-glow-pulse',
            isOpen && 'opacity-0'
          )} 
        />
        
        {/* Icon */}
        <div className="relative z-10">
          {isOpen ? (
            <X className="h-6 w-6 text-muted-foreground" />
          ) : (
            <MessageCircle className="h-6 w-6 text-primary-foreground" />
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

        {/* Pulse ring animation */}
        {!isOpen && (
          <div className="absolute inset-0 rounded-full border-2 border-primary animate-ping opacity-20" />
        )}
      </button>

      {/* Quick Panel */}
      <AvaQuickPanel isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
