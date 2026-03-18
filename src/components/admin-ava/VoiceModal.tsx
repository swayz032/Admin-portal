/**
 * VoiceModal — Ava voice popup.
 *
 * Transparent floating orb with mic controls.
 * No black container, no ambient glow — just the orb floating naturally.
 */

import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Mic, Square, RotateCcw, MessageCircle, X } from 'lucide-react';
import { PersonaOrb } from './PersonaOrb';
import { useAdminVoice } from '@/hooks/useAdminVoice';

interface VoiceModalProps {
  open: boolean;
  onClose: () => void;
}

function statusLabel(status: string): string {
  if (status === 'listening') return 'Listening\u2026';
  if (status === 'thinking') return 'Thinking\u2026';
  if (status === 'speaking') return 'Speaking\u2026';
  if (status === 'error') return 'Tap mic to retry';
  return 'Tap the mic to start\u2026';
}

export function VoiceModal({ open, onClose }: VoiceModalProps) {
  const voice = useAdminVoice();

  const isActive =
    voice.orbState === 'listening' ||
    voice.orbState === 'speaking' ||
    voice.orbState === 'thinking';

  const handleClose = () => {
    voice.endSession();
    onClose();
  };

  const handleMic = () => {
    if (isActive) {
      voice.endSession();
    } else {
      voice.startSession();
    }
  };

  const handleSwitchToChat = () => {
    handleClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) handleClose(); }}>
      <DialogContent
        className="max-w-md p-0 border-0 bg-transparent shadow-none overflow-hidden [&>button]:hidden"
        style={{ maxHeight: '85vh', background: 'transparent', boxShadow: 'none' }}
      >
        {/* Transparent container — no black bg, no glow, just floating elements */}
        <div
          className="relative flex flex-col items-center"
          style={{
            paddingTop: 32,
            paddingBottom: 28,
            paddingLeft: 24,
            paddingRight: 24,
            minHeight: 480,
          }}
        >
          {/* Close button */}
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full flex items-center justify-center bg-black/40 backdrop-blur-sm hover:bg-black/60 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4 text-white/80" />
          </button>

          {/* Agent header */}
          <div className="text-center mb-4 z-[1]">
            <h2
              className="text-white font-bold tracking-wide drop-shadow-lg"
              style={{ fontSize: 22, letterSpacing: 0.3 }}
            >
              Ava
            </h2>
            <p
              className="mt-1 drop-shadow-md"
              style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, letterSpacing: 0.2 }}
            >
              Executive AI Assistant
            </p>
          </div>

          {/* Floating transparent orb */}
          <div className="flex-1 flex items-center justify-center z-[1]">
            <PersonaOrb state={voice.orbState} size={280} />
          </div>

          {/* Status text */}
          <p
            className="mt-4 mb-6 z-[1] drop-shadow-md"
            style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, letterSpacing: 0.2 }}
          >
            {statusLabel(voice.orbState)}
          </p>

          {/* Error message */}
          {voice.error && (
            <p className="text-red-400/80 text-xs mb-4 text-center max-w-[240px] drop-shadow-md">
              {voice.error}
            </p>
          )}

          {/* Last response preview */}
          {voice.lastAvaResponse && (
            <p className="text-white/50 text-xs mb-4 text-center max-w-[280px] line-clamp-2 drop-shadow-md">
              {voice.lastAvaResponse}
            </p>
          )}

          {/* Controls row — Reset / Mic / Chat */}
          <div className="flex items-center gap-8 z-[1]">
            {/* Reset */}
            <button
              onClick={() => {
                voice.endSession();
                voice.startSession();
              }}
              className="w-[52px] h-[52px] rounded-full flex items-center justify-center cursor-pointer active:scale-[0.93] active:opacity-85 transition-transform backdrop-blur-sm"
              style={{
                backgroundColor: 'rgba(0,0,0,0.4)',
                border: '1px solid rgba(255,255,255,0.15)',
              }}
            >
              <RotateCcw className="w-[22px] h-[22px]" style={{ color: 'rgba(255,255,255,0.75)' }} />
            </button>

            {/* Mic — 72px Aspire Blue button */}
            <button
              onClick={handleMic}
              className="relative w-[72px] h-[72px] rounded-full overflow-hidden cursor-pointer active:scale-[0.93] active:opacity-85 transition-transform"
            >
              {/* Aspire Blue gradient */}
              <div
                className="absolute inset-0 rounded-full flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, #3B82F6 15%, #2563EB 85%)',
                }}
              >
                {isActive ? (
                  <Square className="w-7 h-7 text-white" />
                ) : (
                  <Mic className="w-7 h-7 text-white" />
                )}
              </div>

              {/* Active ring pulse */}
              {isActive && (
                <div
                  className="absolute -inset-[5px] rounded-full animate-[mic-ring-pulse_1.4s_ease-in-out_infinite] pointer-events-none"
                  style={{
                    border: '2px solid #3B82F6',
                    boxShadow: '0 0 20px rgba(59,130,246,0.4)',
                  }}
                />
              )}
            </button>

            {/* Chat — switch to text chat */}
            <button
              onClick={handleSwitchToChat}
              className="w-[52px] h-[52px] rounded-full flex items-center justify-center cursor-pointer active:scale-[0.93] active:opacity-85 transition-transform backdrop-blur-sm"
              style={{
                backgroundColor: 'rgba(0,0,0,0.4)',
                border: '1px solid rgba(255,255,255,0.15)',
              }}
            >
              <MessageCircle className="w-[22px] h-[22px]" style={{ color: 'rgba(255,255,255,0.75)' }} />
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
