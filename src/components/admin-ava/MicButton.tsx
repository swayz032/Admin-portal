/**
 * MicButton — compact inline mic icon that opens the voice modal popup.
 * Fits inside the prompt input toolbar.
 */

import { useState } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Mic } from 'lucide-react';
import { VoiceModal } from './VoiceModal';

export function MicButton() {
  const [voiceOpen, setVoiceOpen] = useState(false);

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => setVoiceOpen(true)}
            className="h-8 w-8 rounded-xl flex items-center justify-center text-primary hover:bg-primary/10 transition-colors cursor-pointer"
            aria-label="Start voice session with Ava"
          >
            <Mic className="w-4 h-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent>Voice session</TooltipContent>
      </Tooltip>

      <VoiceModal open={voiceOpen} onClose={() => setVoiceOpen(false)} />
    </>
  );
}
