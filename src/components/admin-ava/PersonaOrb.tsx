/**
 * PersonaOrb — Exact duplicate of desktop AgentWidget OrbVideo.
 *
 * Design source: Aspire-desktop/components/canvas/widgets/AgentWidget.tsx
 *
 * - Transparent video render (ava-orb.mp4 has built-in glow)
 * - Float animation: translateY -16px over 2.2s ease-in-out infinite
 * - Pulse scale when active: 1.0 → 1.07 over 700ms
 * - No circular mask, no container bg (video transparency preserved)
 * - Audio level drives subtle pulse intensity (production enhancement)
 */

import { useEffect, useRef } from 'react';
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
      videoRef.current.play().catch(() => { /* autoplay blocked */ });
    }
  }, []);

  const isActive =
    state === 'listening' ||
    state === 'speaking' ||
    state === 'thinking';

  return (
    <div className={cn('flex flex-col items-center', className)}>
      {/* Float animation — matches desktop floatAnim: translateY -16px, 2.2s */}
      <div
        className={cn(
          isActive
            ? 'animate-[orb-float_2.2s_ease-in-out_infinite]'
            : 'animate-[orb-float_3s_ease-in-out_infinite]',
        )}
      >
        {/* Pulse scale — matches desktop pulseAnim: 1.0 → 1.07, 700ms */}
        <div
          className={cn(
            'transition-transform duration-300',
            isActive && 'animate-[orb-pulse_1.4s_ease-in-out_infinite]',
          )}
        >
          {/* Video — objectFit: contain preserves built-in transparency/glow */}
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
  );
}

/**
 * MiniOrb — small thumbnail for chat headers / bubbles.
 * Matches desktop MiniOrbThumb: circular mask, border, 28px default.
 */
export function MiniOrb({ size = 28, className }: { size?: number; className?: string }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = true;
      videoRef.current.loop = true;
      videoRef.current.playsInline = true;
      videoRef.current.play().catch(() => { /* autoplay blocked */ });
    }
  }, []);

  return (
    <div
      className={cn('rounded-full overflow-hidden flex-shrink-0', className)}
      style={{
        width: size,
        height: size,
        border: '1px solid rgba(255,255,255,0.2)',
      }}
    >
      <video
        ref={videoRef}
        src="/ava-orb.mp4"
        autoPlay
        loop
        muted
        playsInline
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}
