/**
 * PersonaOrb — Audio-reactive video orb with dynamic glow.
 *
 * Production features:
 * - Transparent video (ava-orb.mp4) with no circular mask
 * - Audio-reactive glow ring that pulses with actual mic input level
 * - State-driven animations: float (idle), pulse (active), glow (speaking)
 * - Smooth transitions between all states
 */

import { useEffect, useRef, useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { VoiceOrbState } from '@/hooks/useAdminVoice';

interface PersonaOrbProps {
  state: VoiceOrbState;
  size?: number;
  audioLevel?: number;
  className?: string;
}

export function PersonaOrb({ state, size = 280, audioLevel = 0, className }: PersonaOrbProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = true;
      videoRef.current.loop = true;
      videoRef.current.playsInline = true;
      videoRef.current.play().catch(() => { /* autoplay blocked by browser policy */ });
    }
  }, []);

  const isActive =
    state === 'listening' ||
    state === 'speaking' ||
    state === 'thinking';

  // Audio-reactive glow: maps audio level (0-1) to glow intensity
  const glowIntensity = useMemo(() => {
    if (state === 'speaking') return 0.5;
    if (!isActive) return 0;
    // Amplify the mic level for visible glow (0-1 → 0-0.6)
    return Math.min(audioLevel * 8, 0.6);
  }, [audioLevel, isActive, state]);

  const glowColor = useMemo(() => {
    switch (state) {
      case 'listening': return '59,130,246';   // Aspire Blue
      case 'thinking': return '168,85,247';    // Purple
      case 'speaking': return '52,211,153';    // Emerald
      case 'error': return '239,68,68';        // Red
      default: return '59,130,246';
    }
  }, [state]);

  // Ring scale based on audio level
  const ringScale = isActive ? 1 + (audioLevel * 3) : 1;

  return (
    <div className={cn('flex flex-col items-center', className)}>
      {/* Audio-reactive glow ring */}
      <div className="relative">
        {/* Outer glow */}
        {isActive && (
          <div
            className="absolute inset-0 rounded-full pointer-events-none transition-all duration-150"
            style={{
              width: size + 40,
              height: size + 40,
              left: -20,
              top: -20,
              background: `radial-gradient(circle, rgba(${glowColor},${glowIntensity * 0.5}) 0%, rgba(${glowColor},${glowIntensity * 0.2}) 40%, transparent 70%)`,
              transform: `scale(${ringScale})`,
            }}
          />
        )}

        {/* Pulsing ring (audio-reactive) */}
        {isActive && (
          <div
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{
              width: size + 16,
              height: size + 16,
              left: -8,
              top: -8,
              border: `2px solid rgba(${glowColor},${Math.max(glowIntensity, 0.15)})`,
              transform: `scale(${1 + audioLevel * 2})`,
              transition: 'transform 100ms ease-out, border-color 100ms ease-out',
            }}
          />
        )}

        {/* Float animation wrapper */}
        <div
          className={cn(
            'relative',
            isActive ? 'animate-[orb-float_2.2s_ease-in-out_infinite]' : 'animate-[orb-float_3s_ease-in-out_infinite]',
          )}
        >
          {/* Pulse scale wrapper */}
          <div
            className={cn(
              'transition-transform duration-300',
              state === 'speaking' && 'animate-[orb-pulse_1.4s_ease-in-out_infinite]',
              state === 'thinking' && 'animate-[orb-pulse_2s_ease-in-out_infinite]',
            )}
          >
            {/* Transparent video — no circular mask, no container bg */}
            <video
              ref={videoRef}
              src="/ava-orb.mp4"
              autoPlay
              loop
              muted
              playsInline
              style={{
                width: size,
                height: size,
                objectFit: 'contain',
                pointerEvents: 'none',
                display: 'block',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * MiniOrb — small thumbnail version for chat headers / bubbles.
 */
export function MiniOrb({ size = 28, className }: { size?: number; className?: string }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = true;
      videoRef.current.loop = true;
      videoRef.current.playsInline = true;
      videoRef.current.play().catch(() => { /* autoplay blocked by browser policy */ });
    }
  }, []);

  return (
    <div
      className={cn('rounded-full overflow-hidden flex-shrink-0 border border-white/20', className)}
      style={{ width: size, height: size }}
    >
      <video
        ref={videoRef}
        src="/ava-orb.mp4"
        autoPlay
        loop
        muted
        playsInline
        className="w-full h-full object-cover block"
        style={{ pointerEvents: 'none' }}
      />
    </div>
  );
}
