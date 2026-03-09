/**
 * VoiceModal — Canvas mode Ava voice popup.
 *
 * Direct port of AgentWidget voice view from Desktop app.
 * Pure black background, real video orb, gradient mic button,
 * ambient glow, status text, reset/mic/chat controls.
 */

import { useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Mic, Square, RotateCcw, MessageCircle, X } from 'lucide-react';
import { PersonaOrb } from './PersonaOrb';
import { useAdminVoice } from '@/hooks/useAdminVoice';
import { useAdminAvaChat } from '@/contexts/AdminAvaChatContext';

interface VoiceModalProps {
  open: boolean;
  onClose: () => void;
}

function statusLabel(status: string): string {
  if (status === 'listening') return 'Listening\u2026';
  if (status === 'thinking') return 'Thinking\u2026';
  if (status === 'speaking') return 'Speaking\u2026';
  if (status === 'error') return 'Reconnect needed';
  return 'Tap the mic to start\u2026';
}

export function VoiceModal({ open, onClose }: VoiceModalProps) {
  const voice = useAdminVoice();
  const chat = useAdminAvaChat();

  // Start session when modal opens
  useEffect(() => {
    if (open && !voice.isSessionActive) {
      voice.startSession();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const isActive =
    voice.orbState === 'listening' ||
    voice.orbState === 'speaking' ||
    voice.orbState === 'thinking';

  const handleClose = () => {
    // Add transcript to chat before closing
    if (voice.transcript) {
      chat.addSystemMessage(`Voice transcript: "${voice.transcript}"`);
    }
    if (voice.lastAvaResponse) {
      chat.addSystemMessage(`Ava (voice): ${voice.lastAvaResponse}`);
    }
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
        className="max-w-md p-0 border-0 bg-transparent overflow-hidden [&>button]:hidden"
        style={{ maxHeight: '85vh' }}
      >
        {/* Pure black container — matches canvas mode exactly */}
        <div
          className="relative flex flex-col items-center overflow-hidden rounded-2xl"
          style={{
            backgroundColor: '#000',
            paddingTop: 32,
            paddingBottom: 28,
            paddingLeft: 24,
            paddingRight: 24,
            minHeight: 520,
          }}
        >
          {/* Ambient glow spot — Ava blue/purple */}
          <div
            className="absolute top-[-60px] left-1/2 -translate-x-1/2 rounded-full pointer-events-none"
            style={{
              width: 400,
              height: 400,
              backgroundColor: 'rgba(96,165,250,0.22)',
              filter: 'blur(90px)',
              opacity: isActive ? 0.7 : 0.3,
              transition: 'opacity 900ms ease',
            }}
          />

          {/* Close button */}
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4 text-white/60" />
          </button>

          {/* Agent header */}
          <div className="text-center mb-6 z-[1]">
            <h2
              className="text-white font-bold tracking-wide"
              style={{ fontSize: 22, letterSpacing: 0.3 }}
            >
              Ava
            </h2>
            <p
              className="mt-1"
              style={{ color: 'rgba(255,255,255,0.42)', fontSize: 13, letterSpacing: 0.2 }}
            >
              Executive AI Assistant
            </p>
          </div>

          {/* Real video orb — 280px, centered */}
          <div className="flex-1 flex items-center justify-center z-[1]">
            <PersonaOrb state={voice.orbState} size={280} />
          </div>

          {/* Status text */}
          <p
            className="mt-6 mb-8 z-[1]"
            style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14, letterSpacing: 0.2 }}
          >
            {statusLabel(voice.orbState)}
          </p>

          {/* Controls row — Reset / Mic / Chat */}
          <div className="flex items-center gap-8 z-[1]">
            {/* Reset */}
            <button
              onClick={() => {
                voice.endSession();
                voice.startSession();
              }}
              className="w-[52px] h-[52px] rounded-full flex items-center justify-center cursor-pointer active:scale-[0.93] active:opacity-85 transition-transform"
              style={{
                backgroundColor: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              <RotateCcw className="w-[22px] h-[22px]" style={{ color: 'rgba(255,255,255,0.65)' }} />
            </button>

            {/* Mic — 72px gradient button */}
            <button
              onClick={handleMic}
              className="relative w-[72px] h-[72px] rounded-full overflow-hidden cursor-pointer active:scale-[0.93] active:opacity-85 transition-transform"
            >
              {/* Gradient background */}
              <div
                className="absolute inset-0 rounded-full flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, #60A5FA 15%, #8B5CF6 85%)',
                }}
              >
                {isActive ? (
                  <Square className="w-7 h-7 text-white" />
                ) : (
                  <Mic className="w-7 h-7 text-white" />
                )}
              </div>

              {/* Active ring */}
              {isActive && (
                <div
                  className="absolute -inset-[5px] rounded-full animate-[mic-ring-pulse_1.4s_ease-in-out_infinite] pointer-events-none"
                  style={{
                    border: '2px solid #60A5FA',
                    boxShadow: '0 0 20px rgba(96,165,250,0.4)',
                  }}
                />
              )}
            </button>

            {/* Chat — switch to text chat */}
            <button
              onClick={handleSwitchToChat}
              className="w-[52px] h-[52px] rounded-full flex items-center justify-center cursor-pointer active:scale-[0.93] active:opacity-85 transition-transform"
              style={{
                backgroundColor: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              <MessageCircle className="w-[22px] h-[22px]" style={{ color: 'rgba(255,255,255,0.65)' }} />
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
