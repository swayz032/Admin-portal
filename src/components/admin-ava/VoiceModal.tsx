/**
 * VoiceModal — Exact duplicate of Aspire Desktop canvas AgentWidget voice view.
 *
 * Design source: Aspire-desktop/components/canvas/widgets/AgentWidget.tsx
 *
 * Layout (top → bottom):
 *   Blue gradient top accent bar
 *   Close X (top-right)
 *   Agent name + subtitle (centered)
 *   280px floating video orb
 *   Status text (shimmer)
 *   Controls: Refresh (52px) / Mic (72px gradient) / Chat (52px)
 *
 * Colors (exact match):
 *   Background: #000
 *   Mic gradient: #60A5FA → #8B5CF6
 *   Side buttons: rgba(255,255,255,0.08) bg, rgba(255,255,255,0.1) border
 *   Status text: rgba(255,255,255,0.45)
 *   Subtitle: rgba(255,255,255,0.42)
 *   Agent name: #FFF, 22px, weight 700
 */

import { useEffect, useState, useRef } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Mic, MicOff, RotateCw, MessageCircle, X, Square } from 'lucide-react';
import { PersonaOrb } from './PersonaOrb';
import { useAdminVoice } from '@/hooks/useAdminVoice';
import { cn } from '@/lib/utils';

interface VoiceModalProps {
  open: boolean;
  onClose: () => void;
}

function statusLabel(status: string, isSpeechDetected: boolean): string {
  if (status === 'listening') {
    if (isSpeechDetected) return 'Hearing you\u2026';
    return 'Listening\u2026';
  }
  if (status === 'thinking') return 'Thinking\u2026';
  if (status === 'speaking') return 'Speaking\u2026';
  if (status === 'error') return 'Reconnect needed';
  return 'Tap the mic to start\u2026';
}

export function VoiceModal({ open, onClose }: VoiceModalProps) {
  const voice = useAdminVoice();
  const [shimmerPhase, setShimmerPhase] = useState(0);
  const shimmerRef = useRef<number>(0);

  const isActive =
    voice.orbState === 'listening' ||
    voice.orbState === 'speaking' ||
    voice.orbState === 'thinking';

  // Shimmer animation (matches desktop Animated opacity loop)
  useEffect(() => {
    if (!open) return;
    let raf: number;
    const animate = () => {
      shimmerRef.current += 0.015;
      setShimmerPhase(Math.sin(shimmerRef.current) * 0.2 + 0.7); // 0.5–0.9
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [open]);

  // Auto-start session when modal opens
  useEffect(() => {
    if (open && !voice.isSessionActive) {
      voice.startSession();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleClose = () => {
    voice.endSession();
    onClose();
  };

  const handleMicToggle = () => {
    if (isActive) {
      voice.endSession();
    } else {
      voice.startSession();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) handleClose(); }}>
      <DialogContent
        className="max-w-[540px] p-0 border-0 bg-transparent shadow-none overflow-hidden [&>button]:hidden"
        style={{ maxHeight: '90vh', background: 'transparent', boxShadow: 'none' }}
      >
        {/* Card container — matches desktop voiceRoot */}
        <div
          className="relative flex flex-col items-center overflow-hidden rounded-2xl"
          style={{
            background: '#000',
            border: '1px solid rgba(255,255,255,0.08)',
            minHeight: 620,
          }}
        >
          {/* ── Blue gradient top accent bar ─────────────────────────── */}
          <div
            className="w-full h-[3px] flex-shrink-0"
            style={{
              background: 'linear-gradient(90deg, #60A5FA 0%, #8B5CF6 100%)',
            }}
          />

          {/* ── Close X — top right ──────────────────────────────────── */}
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center z-10 cursor-pointer transition-all duration-150 active:scale-[0.93]"
            style={{
              backgroundColor: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
            aria-label="Close voice session"
          >
            <X className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.65)' }} />
          </button>

          {/* ── Agent header — name + subtitle ───────────────────────── */}
          <div className="flex flex-col items-center mt-8 mb-6 z-[1]">
            <h2
              className="font-bold tracking-[0.3px]"
              style={{
                color: '#FFF',
                fontSize: 22,
                fontWeight: 700,
                lineHeight: '28px',
              }}
            >
              Ava
            </h2>
            <p
              className="mt-1"
              style={{
                color: 'rgba(255,255,255,0.42)',
                fontSize: 13,
                letterSpacing: '0.2px',
              }}
            >
              Executive AI Assistant
            </p>
          </div>

          {/* ── Floating video orb — 280px ───────────────────────────── */}
          <div className="flex-1 flex items-center justify-center z-[1] px-6">
            <PersonaOrb
              state={voice.orbState}
              size={280}
              audioLevel={voice.audioLevel}
            />
          </div>

          {/* ── Status text (shimmer opacity) ────────────────────────── */}
          <div className="text-center mt-6 mb-8 z-[1] min-h-[20px]">
            <p
              style={{
                color: 'rgba(255,255,255,0.45)',
                fontSize: 14,
                letterSpacing: '0.2px',
                opacity: isActive ? shimmerPhase : 1,
                transition: 'opacity 150ms ease',
              }}
            >
              {statusLabel(voice.orbState, voice.isSpeechDetected)}
            </p>
          </div>

          {/* ── Error banner ─────────────────────────────────────────── */}
          {voice.error && (
            <div
              className="mx-6 mb-3 px-3 py-2 rounded-lg z-[1]"
              style={{
                backgroundColor: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.2)',
              }}
            >
              <p className="text-xs text-center" style={{ color: '#F87171' }}>
                {voice.error}
              </p>
            </div>
          )}

          {/* ── Controls row — Refresh / Mic / Chat ──────────────────── */}
          <div className="flex items-center justify-center pb-8 z-[1]" style={{ gap: 32 }}>
            {/* Refresh / Reset */}
            <button
              onClick={() => {
                voice.endSession();
                setTimeout(() => voice.startSession(), 200);
              }}
              className="flex items-center justify-center cursor-pointer transition-all duration-150 active:scale-[0.93] active:opacity-85"
              style={{
                width: 52,
                height: 52,
                borderRadius: 26,
                backgroundColor: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
              aria-label="Reset conversation"
            >
              <RotateCw className="w-[22px] h-[22px]" style={{ color: 'rgba(255,255,255,0.65)' }} />
            </button>

            {/* Mic — center, large, gradient */}
            <button
              onClick={handleMicToggle}
              className="relative flex items-center justify-center cursor-pointer transition-all duration-150 active:scale-[0.93] active:opacity-85"
              style={{
                width: 72,
                height: 72,
                borderRadius: 36,
                overflow: 'hidden',
              }}
              aria-label={isActive ? 'Stop listening' : 'Start listening'}
            >
              {/* Gradient background — matches desktop micGrad */}
              <div
                className="absolute inset-0 flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, #60A5FA 15%, #8B5CF6 85%)',
                  borderRadius: 36,
                }}
              >
                {isActive ? (
                  <Square className="w-7 h-7 text-white" fill="white" />
                ) : (
                  <Mic className="w-7 h-7 text-white" />
                )}
              </div>

              {/* Pulse ring when active — matches desktop micRing */}
              {isActive && (
                <div
                  className="absolute pointer-events-none animate-[mic-ring-pulse_2s_ease-in-out_infinite]"
                  style={{
                    top: -5,
                    left: -5,
                    right: -5,
                    bottom: -5,
                    borderRadius: 41,
                    border: '2px solid #60A5FA',
                    boxShadow: '0 0 20px rgba(96,165,250,0.4)',
                  }}
                />
              )}
            </button>

            {/* Chat — switch to text */}
            <button
              onClick={handleClose}
              className="flex items-center justify-center cursor-pointer transition-all duration-150 active:scale-[0.93] active:opacity-85"
              style={{
                width: 52,
                height: 52,
                borderRadius: 26,
                backgroundColor: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
              aria-label="Switch to text chat"
            >
              <MessageCircle className="w-[22px] h-[22px]" style={{ color: 'rgba(255,255,255,0.65)' }} />
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
