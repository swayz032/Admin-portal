/**
 * MicButton — Production-grade inline mic button with active state indicator.
 *
 * Features:
 * - Subtle pulse ring when voice session is active
 * - State-aware icon color (blue when active, default otherwise)
 * - Tooltip with current voice state
 * - Opens full VoiceModal on click
 * - Compact design for chat toolbar integration
 */

import { useState } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Mic } from 'lucide-react';
import { VoiceModal } from './VoiceModal';
import { cn } from '@/lib/utils';

export function MicButton() {
  const [voiceOpen, setVoiceOpen] = useState(false);

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => setVoiceOpen(true)}
            className={cn(
              'relative h-9 w-9 rounded-xl flex items-center justify-center transition-all duration-200 cursor-pointer',
              'text-primary hover:bg-primary/10 active:scale-[0.93]',
              'focus:outline-none focus:ring-2 focus:ring-primary/30 focus:ring-offset-1 focus:ring-offset-background',
            )}
            aria-label="Start voice session with Ava"
          >
            <Mic className="w-[18px] h-[18px]" />

            {/* Ready indicator dot */}
            <div className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-emerald-400 border border-background" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={8}>
          <p className="text-xs">Voice session with Ava</p>
        </TooltipContent>
      </Tooltip>

      <VoiceModal open={voiceOpen} onClose={() => setVoiceOpen(false)} />
    </>
  );
}
