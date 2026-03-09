/**
 * PersonaOrb — real video orb with float/pulse/glow animations.
 *
 * Direct port of OrbVideo from canvas mode AgentWidget.
 * Plays ava-orb-video.mp4 in a circular mask with CSS animations.
 */

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import type { VoiceOrbState } from '@/hooks/useAdminVoice';
import avaOrbVideo from '@/assets/ava-orb-video.mp4';

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
      videoRef.current.play().catch(() => {});
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
          {/* Circular video mask */}
          <div
            className="rounded-full overflow-hidden relative"
            style={{ width: size, height: size }}
          >
            <video
              ref={videoRef}
              src={avaOrbVideo}
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full object-cover block"
              style={{
                /* Hide native controls */
                pointerEvents: 'none',
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
      videoRef.current.play().catch(() => {});
    }
  }, []);

  return (
    <div
      className={cn('rounded-full overflow-hidden flex-shrink-0 border border-white/20', className)}
      style={{ width: size, height: size }}
    >
      <video
        ref={videoRef}
        src={avaOrbVideo}
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
