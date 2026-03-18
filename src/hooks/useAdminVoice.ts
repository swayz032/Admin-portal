/**
 * Production admin voice pipeline hook.
 *
 * Pipeline: Mic → STT (VAD + auto-submit) → LLM chat (SSE) → TTS (HTTP stream) → Speaker → auto-restart
 *
 * Key behaviors:
 * - Continuous conversation loop (STT → LLM → TTS → repeat)
 * - Barge-in: speaking during TTS interrupts playback and starts new STT
 * - Audio level exposure for UI visualization
 * - Error recovery: auto-returns to listening after 3s
 * - Proper AbortController management for in-flight requests
 * - Receipt emission on all state transitions
 *
 * Backend endpoints:
 *   POST /admin/ops/voice/stt        → { transcript }
 *   POST /admin/ops/chat             → SSE stream (delta events)
 *   POST /admin/ops/voice/tts/stream → audio/mpeg stream
 *
 * Agent fixed to `ava`. No Expo dependencies.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { buildOpsFacadeUrl, buildOpsHeaders } from '@/services/opsFacadeClient';
import { useElevenLabsSTT } from './useElevenLabsSTT';

export type VoiceOrbState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error';

interface VoiceReceiptCallback {
  (receipt: { action: string; outcome: 'Success' | 'Failed'; receiptType: string; summary?: string }): void;
}

interface UseAdminVoiceOptions {
  onReceipt?: VoiceReceiptCallback;
}

export interface UseAdminVoiceResult {
  orbState: VoiceOrbState;
  isSessionActive: boolean;
  transcript: string;
  lastAvaResponse: string;
  error: string | null;
  audioLevel: number;
  isSpeechDetected: boolean;
  startSession: () => Promise<void>;
  endSession: () => void;
  toggleMute: () => void;
  isMuted: boolean;
}

export function useAdminVoice(options?: UseAdminVoiceOptions): UseAdminVoiceResult {
  const emitReceipt = options?.onReceipt;
  const [orbState, setOrbState] = useState<VoiceOrbState>('idle');
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [lastAvaResponse, setLastAvaResponse] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const currentAudioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isProcessingRef = useRef(false);
  const sessionActiveRef = useRef(false);
  const isMutedRef = useRef(false);

  const stt = useElevenLabsSTT();
  const sttRef = useRef(stt);
  sttRef.current = stt;

  // Keep muted ref in sync
  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  // Keep session ref in sync
  useEffect(() => {
    sessionActiveRef.current = isSessionActive;
  }, [isSessionActive]);

  // ── Stop any playing audio (for barge-in or session end) ───────────
  const stopPlayback = useCallback(() => {
    if (currentAudioSourceRef.current) {
      try { currentAudioSourceRef.current.stop(); } catch { /* already stopped */ }
      currentAudioSourceRef.current = null;
    }
  }, []);

  // ── Play TTS audio from HTTP streaming endpoint ────────────────────
  const playTtsAudio = useCallback(async (text: string): Promise<void> => {
    try {
      setOrbState('speaking');

      const controller = new AbortController();
      const response = await fetch(buildOpsFacadeUrl('/admin/ops/voice/tts/stream'), {
        method: 'POST',
        headers: {
          ...buildOpsHeaders({ includeJson: true, includeAdminToken: true, includeSuiteId: false }),
        },
        body: JSON.stringify({ text }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        console.warn('[AdminVoice] TTS stream error:', response.status, detail);
        return;
      }

      const audioBytes = await response.arrayBuffer();

      // Validate we got actual audio data
      if (audioBytes.byteLength < 100) {
        console.warn('[AdminVoice] TTS returned empty/tiny audio');
        return;
      }

      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        audioContextRef.current = new AudioContext();
      }
      const ctx = audioContextRef.current;

      // Resume if suspended (browser autoplay policy)
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      const audioBuffer = await ctx.decodeAudioData(audioBytes);
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      currentAudioSourceRef.current = source;

      return new Promise<void>((resolve) => {
        source.onended = () => {
          currentAudioSourceRef.current = null;
          resolve();
        };
        source.start();
      });
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      console.warn('[AdminVoice] TTS playback failed:', err);
    } finally {
      currentAudioSourceRef.current = null;
    }
  }, []);

  // ── Session management ─────────────────────────────────────────────
  const startSession = useCallback(async () => {
    try {
      setError(null);
      setOrbState('listening');
      setIsSessionActive(true);

      await sttRef.current.startListening();

      emitReceipt?.({
        action: 'Voice session started',
        outcome: 'Success',
        receiptType: 'voice_session_start',
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to start voice session';
      setError(msg);
      setOrbState('error');
      setIsSessionActive(false);

      emitReceipt?.({
        action: 'Voice session failed to start',
        outcome: 'Failed',
        receiptType: 'voice_session_start',
        summary: msg,
      });
    }
  }, [emitReceipt]);

  const endSession = useCallback(() => {
    sttRef.current.stopListening();
    stopPlayback();

    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    isProcessingRef.current = false;

    setIsSessionActive(false);
    setOrbState('idle');

    emitReceipt?.({
      action: 'Voice session ended',
      outcome: 'Success',
      receiptType: 'voice_session_end',
    });
  }, [emitReceipt, stopPlayback]);

  const toggleMute = useCallback(() => {
    setIsMuted(prev => !prev);
  }, []);

  // ── Process transcript → LLM (SSE) → TTS → auto-restart ──────────
  useEffect(() => {
    if (!stt.transcript || !isSessionActive || isProcessingRef.current) return;

    const processTranscript = async () => {
      isProcessingRef.current = true;
      setOrbState('thinking');
      setError(null);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const response = await fetch(buildOpsFacadeUrl('/admin/ops/chat'), {
          method: 'POST',
          headers: {
            ...buildOpsHeaders({ includeJson: true, includeAdminToken: true, includeSuiteId: false }),
            Accept: 'text/event-stream',
          },
          body: JSON.stringify({
            message: stt.transcript,
            context: { channel: 'admin_voice' },
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const detail = await response.text().catch(() => '');
          throw new Error(`Backend error ${response.status}${detail ? `: ${detail}` : ''}`);
        }

        // Parse SSE stream
        let responseContent = '';

        if (response.body) {
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (!line.startsWith('data:')) continue;
              const raw = line.slice(5).trim();
              if (!raw || raw === '[DONE]') continue;

              try {
                const event = JSON.parse(raw) as { type?: string; content?: string };
                if ((event.type === 'response' || event.type === 'delta') && event.content) {
                  responseContent += event.content;
                }
              } catch {
                // Skip unparseable SSE lines
              }
            }
          }
        }

        const finalText = responseContent || "I'm ready for your next step.";
        setLastAvaResponse(finalText);
        sttRef.current.clearTranscript();

        // Play TTS (awaits completion for continuous loop)
        if (!isMutedRef.current && sessionActiveRef.current) {
          await playTtsAudio(finalText);
        }

        // Auto-restart STT for next utterance (continuous conversation)
        if (sessionActiveRef.current) {
          setOrbState('listening');
          sttRef.current.restartForNextUtterance();
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;

        const msg = err instanceof Error ? err.message : 'Voice processing failed';
        setError(msg);
        setOrbState('error');

        // Recover to listening after 3s
        setTimeout(() => {
          if (sessionActiveRef.current) {
            setError(null);
            setOrbState('listening');
            sttRef.current.restartForNextUtterance();
          }
        }, 3000);
      } finally {
        isProcessingRef.current = false;
        abortControllerRef.current = null;
      }
    };

    processTranscript();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stt.transcript, isSessionActive, playTtsAudio]);

  // ── Barge-in: if user speaks while TTS is playing, interrupt ───────
  useEffect(() => {
    if (stt.isSpeechDetected && orbState === 'speaking' && isSessionActive) {
      stopPlayback();
      setOrbState('listening');
    }
  }, [stt.isSpeechDetected, orbState, isSessionActive, stopPlayback]);

  // ── Cleanup on unmount ─────────────────────────────────────────────
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      stopPlayback();
      if (audioContextRef.current?.state !== 'closed') {
        audioContextRef.current?.close().catch(() => {});
      }
    };
  }, [stopPlayback]);

  return {
    orbState,
    isSessionActive,
    transcript: stt.transcript,
    lastAvaResponse,
    error,
    audioLevel: stt.audioLevel,
    isSpeechDetected: stt.isSpeechDetected,
    startSession,
    endSession,
    toggleMute,
    isMuted,
  };
}
