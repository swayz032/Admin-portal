/**
 * Admin voice pipeline hook — browser-compatible.
 *
 * Pipeline: Mic → STT (backend proxy) → LLM chat (SSE) → TTS (HTTP stream) → Speaker
 *
 * Backend endpoints:
 *   POST /admin/ops/voice/stt      → { transcript }
 *   POST /admin/ops/chat           → SSE stream (delta events)
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

interface UseAdminVoiceResult {
  orbState: VoiceOrbState;
  isSessionActive: boolean;
  transcript: string;
  lastAvaResponse: string;
  error: string | null;
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

  const stt = useElevenLabsSTT();
  const sttRef = useRef(stt);
  sttRef.current = stt;

  // ── Play TTS audio from HTTP streaming endpoint ───────────────────
  const playTtsAudio = useCallback(async (text: string) => {
    try {
      setOrbState('speaking');

      const response = await fetch(buildOpsFacadeUrl('/admin/ops/voice/tts/stream'), {
        method: 'POST',
        headers: {
          ...buildOpsHeaders({ includeJson: true, includeAdminToken: true, includeSuiteId: false }),
        },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        console.warn('[AdminVoice] TTS stream error:', response.status);
        setOrbState('listening');
        return;
      }

      // Collect entire audio response then play
      const audioBytes = await response.arrayBuffer();

      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }
      const ctx = audioContextRef.current;
      const audioBuffer = await ctx.decodeAudioData(audioBytes);
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);

      currentAudioSourceRef.current = source;

      source.onended = () => {
        currentAudioSourceRef.current = null;
        setOrbState('listening');
      };

      source.start();
    } catch (err) {
      console.warn('[AdminVoice] TTS playback failed:', err);
      // TTS failed but session continues — go back to listening
      setOrbState('listening');
    }
  }, []);

  // ── Session management ────────────────────────────────────────────
  const startSession = useCallback(async () => {
    try {
      setError(null);
      setOrbState('listening');
      setIsSessionActive(true);

      // Start STT — this is the critical path (mic access)
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

    // Stop any playing audio
    if (currentAudioSourceRef.current) {
      try { currentAudioSourceRef.current.stop(); } catch { /* already stopped */ }
      currentAudioSourceRef.current = null;
    }

    // Abort any in-flight requests
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;

    setIsSessionActive(false);
    setOrbState('idle');

    emitReceipt?.({
      action: 'Voice session ended',
      outcome: 'Success',
      receiptType: 'voice_session_end',
    });
  }, [emitReceipt]);

  const toggleMute = useCallback(() => {
    setIsMuted(prev => !prev);
  }, []);

  // ── Process transcript → LLM (SSE) → TTS ─────────────────────────
  useEffect(() => {
    if (!stt.transcript || !isSessionActive) return;

    const processTranscript = async () => {
      setOrbState('thinking');

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        // Stream response from backend LLM endpoint
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

        if (!response.ok) throw new Error(`Backend error: ${response.status}`);

        // Parse SSE stream to extract response text
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
                // Skip unparseable lines
              }
            }
          }
        }

        const finalText = responseContent || "I'm ready for your next step.";
        setLastAvaResponse(finalText);

        // Clear transcript for next utterance
        sttRef.current.clearTranscript();

        // Play response via TTS (HTTP streaming, not WebSocket)
        if (!isMuted) {
          await playTtsAudio(finalText);
        } else {
          setOrbState('listening');
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;

        setError(err instanceof Error ? err.message : 'Voice processing failed');
        setOrbState('error');
        // Recover to listening after error display
        setTimeout(() => {
          if (isSessionActive) setOrbState('listening');
        }, 3000);
      }
    };

    processTranscript();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- stt object is unstable, use individual values
  }, [stt.transcript, isSessionActive, isMuted, playTtsAudio]);

  // ── Cleanup on unmount ────────────────────────────────────────────
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      if (currentAudioSourceRef.current) {
        try { currentAudioSourceRef.current.stop(); } catch { /* already stopped */ }
      }
      audioContextRef.current?.close();
    };
  }, []);

  return {
    orbState,
    isSessionActive,
    transcript: stt.transcript,
    lastAvaResponse,
    error,
    startSession,
    endSession,
    toggleMute,
    isMuted,
  };
}
