/**
 * VoiceModal — Production Ava voice session dialog.
 *
 * Production features:
 * - Dark glassmorphic panel with depth layers
 * - Live session indicator pill with state-aware color
 * - Audio-reactive PersonaOrb (glow synced to mic level)
 * - Shimmer status text with live transcript preview
 * - 3-button control row: Mute / End / Chat
 * - Audio level meter bar (visualizes mic input)
 * - Error banner with auto-dismiss
 * - Continuous conversation loop (STT → LLM → TTS → repeat)
 * - Barge-in support (speak to interrupt TTS)
 */

import { useEffect, useState, useRef } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Mic, MicOff, PhoneOff, MessageCircle, X, Volume2, VolumeX } from 'lucide-react';
import { PersonaOrb } from './PersonaOrb';
import { useAdminVoice } from '@/hooks/useAdminVoice';
import { cn } from '@/lib/utils';

interface VoiceModalProps {
  open: boolean;
  onClose: () => void;
}

function statusLabel(status: string, transcript: string, isSpeechDetected: boolean): string {
  if (status === 'listening') {
    if (isSpeechDetected) return 'Hearing you\u2026';
    return transcript ? `"${transcript}"` : 'Listening\u2026';
  }
  if (status === 'thinking') return 'Thinking\u2026';
  if (status === 'speaking') return 'Speaking\u2026';
  if (status === 'error') return 'Recovering\u2026';
  return 'Tap the mic to start';
}

function stateColor(status: string): string {
  switch (status) {
    case 'listening': return 'bg-emerald-400';
    case 'thinking': return 'bg-purple-400';
    case 'speaking': return 'bg-blue-400';
    case 'error': return 'bg-red-400';
    default: return 'bg-white/30';
  }
}

export function VoiceModal({ open, onClose }: VoiceModalProps) {
  const voice = useAdminVoice();
  const [shimmerPhase, setShimmerPhase] = useState(0);
  const shimmerRef = useRef<number>(0);

  const isActive =
    voice.orbState === 'listening' ||
    voice.orbState === 'speaking' ||
    voice.orbState === 'thinking';

  // Shimmer animation for status text
  useEffect(() => {
    if (!open) return;
    let raf: number;
    const animate = () => {
      shimmerRef.current += 0.02;
      setShimmerPhase(Math.sin(shimmerRef.current) * 0.3 + 0.7);
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

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) handleClose(); }}>
      <DialogContent
        className="max-w-[420px] p-0 border-0 bg-transparent shadow-none overflow-hidden [&>button]:hidden"
        style={{ maxHeight: '90vh', background: 'transparent', boxShadow: 'none' }}
      >
        {/* Glassmorphic dark panel */}
        <div
          className="relative flex flex-col items-center rounded-3xl overflow-hidden"
          style={{
            background: 'linear-gradient(180deg, rgba(10,10,10,0.95) 0%, rgba(15,15,18,0.98) 100%)',
            backdropFilter: 'blur(40px)',
            border: '1px solid rgba(255,255,255,0.06)',
            minHeight: 580,
          }}
        >
          {/* Ambient glow behind orb — color shifts with state */}
          {isActive && (
            <div
              className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full pointer-events-none transition-all duration-500"
              style={{
                background: voice.orbState === 'thinking'
                  ? 'radial-gradient(circle, rgba(168,85,247,0.1) 0%, transparent 70%)'
                  : voice.orbState === 'speaking'
                  ? 'radial-gradient(circle, rgba(52,211,153,0.08) 0%, transparent 70%)'
                  : `radial-gradient(circle, rgba(59,130,246,${0.05 + voice.audioLevel * 0.3}) 0%, transparent 70%)`,
              }}
            />
          )}

          {/* Header — close + live pill + speaker indicator */}
          <div className="w-full flex items-center justify-between px-5 pt-5 pb-2 z-[1]">
            <button
              onClick={handleClose}
              className="w-8 h-8 rounded-full flex items-center justify-center bg-white/[0.06] hover:bg-white/[0.1] transition-colors cursor-pointer"
              aria-label="Close voice session"
            >
              <X className="w-4 h-4 text-white/60" />
            </button>

            {/* Live indicator pill — state-aware */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.06] border border-white/[0.08]">
              <div className={cn(
                'w-2 h-2 rounded-full transition-colors duration-300',
                isActive ? stateColor(voice.orbState) : 'bg-white/30',
                isActive && 'animate-pulse',
              )} />
              <span className="text-xs font-medium text-white/70">
                {isActive ? 'Live' : 'Ready'}
              </span>
            </div>

            {/* Speaker / mute indicator */}
            <button
              onClick={() => voice.toggleMute()}
              className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer',
                voice.isMuted ? 'bg-red-500/20' : 'bg-white/[0.06] hover:bg-white/[0.1]',
              )}
              aria-label={voice.isMuted ? 'Unmute speaker' : 'Mute speaker'}
            >
              {voice.isMuted ? (
                <VolumeX className="w-4 h-4 text-red-400" />
              ) : (
                <Volume2 className="w-4 h-4 text-white/40" />
              )}
            </button>
          </div>

          {/* Agent identity */}
          <div className="text-center mt-2 mb-1 z-[1]">
            <div className="flex items-center justify-center gap-2 mb-1">
              <img
                src="/ava-avatar.png"
                alt="Ava"
                className="w-6 h-6 rounded-full object-cover border border-white/10"
              />
              <h2 className="text-lg font-semibold text-white tracking-wide">
                Ava
              </h2>
            </div>
            <p className="text-xs text-white/40 tracking-wide">
              Executive AI Assistant
            </p>
          </div>

          {/* Floating orb — audio-reactive */}
          <div className="flex-1 flex items-center justify-center z-[1] py-4">
            <PersonaOrb
              state={voice.orbState}
              size={260}
              audioLevel={voice.audioLevel}
            />
          </div>

          {/* Audio level meter — subtle horizontal bar */}
          {isActive && (
            <div className="w-48 h-1 rounded-full bg-white/[0.06] mx-auto mb-3 overflow-hidden z-[1]">
              <div
                className="h-full rounded-full transition-all duration-75"
                style={{
                  width: `${Math.min(voice.audioLevel * 800, 100)}%`,
                  background: voice.isSpeechDetected
                    ? 'linear-gradient(90deg, #3B82F6, #60A5FA)'
                    : 'rgba(255,255,255,0.15)',
                }}
              />
            </div>
          )}

          {/* Status text with shimmer */}
          <div className="text-center px-6 mb-2 z-[1] min-h-[48px] flex flex-col items-center justify-center">
            <p
              className={cn(
                'text-sm tracking-wide transition-opacity duration-300',
                voice.orbState === 'listening' && voice.transcript ? 'text-white/80 italic' : 'text-white/50',
              )}
              style={{ opacity: isActive ? shimmerPhase : 0.6 }}
            >
              {statusLabel(voice.orbState, voice.transcript, voice.isSpeechDetected)}
            </p>

            {/* Last response preview */}
            {voice.lastAvaResponse && voice.orbState !== 'speaking' && (
              <p className="text-[11px] text-white/30 mt-1 line-clamp-2 max-w-[280px]">
                {voice.lastAvaResponse}
              </p>
            )}
          </div>

          {/* Error banner */}
          {voice.error && (
            <div className="mx-6 mb-3 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 z-[1]">
              <p className="text-xs text-red-400 text-center">{voice.error}</p>
            </div>
          )}

          {/* Controls row — Mute / End / Chat */}
          <div className="flex items-center justify-center gap-6 pb-8 pt-2 z-[1]">
            {/* Mute toggle */}
            <button
              onClick={() => voice.toggleMute()}
              className={cn(
                'w-14 h-14 rounded-full flex items-center justify-center cursor-pointer transition-all duration-200 active:scale-[0.93]',
                voice.isMuted
                  ? 'bg-red-500/20 border border-red-500/30'
                  : 'bg-white/[0.06] border border-white/[0.1] hover:bg-white/[0.1]',
              )}
              aria-label={voice.isMuted ? 'Unmute microphone' : 'Mute microphone'}
            >
              {voice.isMuted ? (
                <MicOff className="w-5 h-5 text-red-400" />
              ) : (
                <Mic className="w-5 h-5 text-white/80" />
              )}
            </button>

            {/* End session — red circle */}
            <button
              onClick={handleClose}
              className="relative w-16 h-16 rounded-full cursor-pointer transition-all duration-200 active:scale-[0.93] group"
              aria-label="End voice session"
            >
              <div
                className="absolute inset-0 rounded-full flex items-center justify-center transition-all group-hover:brightness-110"
                style={{
                  background: 'linear-gradient(135deg, #EF4444 15%, #DC2626 85%)',
                }}
              >
                <PhoneOff className="w-6 h-6 text-white" />
              </div>
              {/* Pulse ring when active */}
              {isActive && (
                <div
                  className="absolute -inset-[4px] rounded-full animate-[mic-ring-pulse_2s_ease-in-out_infinite] pointer-events-none"
                  style={{
                    border: '1.5px solid rgba(239,68,68,0.3)',
                  }}
                />
              )}
            </button>

            {/* Switch to chat */}
            <button
              onClick={handleClose}
              className="w-14 h-14 rounded-full flex items-center justify-center cursor-pointer bg-white/[0.06] border border-white/[0.1] hover:bg-white/[0.1] transition-all duration-200 active:scale-[0.93]"
              aria-label="Switch to text chat"
            >
              <MessageCircle className="w-5 h-5 text-white/80" />
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
