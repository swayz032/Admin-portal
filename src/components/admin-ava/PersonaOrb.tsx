/**
 * PersonaOrb — real video orb with float/pulse animations.
 *
 * Uses ava-orb.mp4 from public/ — renders transparently without
 * circular mask or container background.
 */

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import type { VoiceOrbState } from '@/hooks/useAdminVoice';

interface PersonaOrbProps {
  state: VoiceOrbState;
  size?: number;
  className?: string;
}

export function PersonaOrb({ state, size = 280, className }: PersonaOrbProps) {
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

  return (
    <div className={cn('flex flex-col items-center', className)}>
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
            isActive && 'animate-[orb-pulse_1.4s_ease-in-out_infinite]',
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
