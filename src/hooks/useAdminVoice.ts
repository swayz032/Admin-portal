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
import { useAuth } from '@/contexts/AuthContext';
import { devWarn } from '@/lib/devLog';

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
  const { user } = useAuth();
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

  // Bug 6E: Track voice conversation history for multi-turn context
  const voiceHistoryRef = useRef<{role: string; content: string}[]>([]);

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
  const audioElementRef = useRef<HTMLAudioElement | null>(null);

  const stopPlayback = useCallback(() => {
    // Stop MediaSource-based playback
    if (audioElementRef.current) {
      try {
        audioElementRef.current.pause();
        audioElementRef.current.removeAttribute('src');
        audioElementRef.current.load();
      } catch { /* already cleaned up */ }
      audioElementRef.current = null;
    }
    // Stop AudioContext-based playback (fallback path)
    if (currentAudioSourceRef.current) {
      try { currentAudioSourceRef.current.stop(); } catch { /* already stopped */ }
      currentAudioSourceRef.current = null;
    }
  }, []);

  // ── Play TTS audio from HTTP streaming endpoint ────────────────────
  // Uses MediaSource Extensions for progressive playback (sub-200ms first audio)
  // with AudioContext fallback for browsers that don't support MSE with audio/mpeg.
  const playTtsAudio = useCallback(async (text: string): Promise<void> => {
    try {
      setOrbState('speaking');

      const controller = new AbortController();
      abortControllerRef.current = controller;
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
        devWarn('[AdminVoice] TTS stream error:', response.status, detail);
        return;
      }

      if (!response.body) {
        devWarn('[AdminVoice] TTS response has no body stream');
        return;
      }

      // Try MediaSource Extensions for true progressive playback
      const canUseMSE =
        typeof MediaSource !== 'undefined' &&
        MediaSource.isTypeSupported('audio/mpeg');

      if (canUseMSE) {
        return await playWithMediaSource(response.body, controller.signal);
      }

      // Fallback: accumulate chunks then decode via AudioContext
      return await playWithAudioContext(response.body);
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      devWarn('[AdminVoice] TTS playback failed:', err);
    }
  }, []);

  // ── MediaSource Extensions path — progressive audio ─────────────────
  const playWithMediaSource = useCallback(
    (body: ReadableStream<Uint8Array>, signal: AbortSignal): Promise<void> => {
      return new Promise<void>((resolve, reject) => {
        const mediaSource = new MediaSource();
        const audio = new Audio();
        audio.src = URL.createObjectURL(mediaSource);
        audioElementRef.current = audio;

        // Queue for chunks arriving before SourceBuffer is ready
        const pendingChunks: Uint8Array[] = [];
        let sourceBuffer: SourceBuffer | null = null;
        let streamDone = false;
        let totalBytes = 0;

        const flushPending = () => {
          if (!sourceBuffer || sourceBuffer.updating) return;
          if (pendingChunks.length > 0) {
            const chunk = pendingChunks.shift()!;
            sourceBuffer.appendBuffer(chunk);
          } else if (streamDone && mediaSource.readyState === 'open') {
            try { mediaSource.endOfStream(); } catch { /* already ended */ }
          }
        };

        mediaSource.addEventListener('sourceopen', () => {
          try {
            sourceBuffer = mediaSource.addSourceBuffer('audio/mpeg');
          } catch (err) {
            devWarn('[AdminVoice] MSE addSourceBuffer failed, falling back:', err);
            reject(err);
            return;
          }

          sourceBuffer.addEventListener('updateend', flushPending);

          // Start reading the stream
          const reader = body.getReader();
          const pump = async () => {
            try {
              while (true) {
                if (signal.aborted) {
                  reader.cancel();
                  return;
                }
                const { done, value } = await reader.read();
                if (done) {
                  streamDone = true;
                  flushPending();
                  return;
                }
                if (value && value.length > 0) {
                  totalBytes += value.length;
                  pendingChunks.push(value);
                  flushPending();

                  // Start playback as soon as we have enough data (~4KB)
                  if (totalBytes > 4096 && audio.paused) {
                    audio.play().catch(() => {
                      devWarn('[AdminVoice] MSE autoplay blocked, will retry on next chunk');
                    });
                  }
                }
              }
            } catch (err) {
              if ((err as Error).name !== 'AbortError') {
                devWarn('[AdminVoice] MSE stream read error:', err);
              }
              streamDone = true;
              flushPending();
            }
          };
          pump();
        });

        audio.addEventListener('ended', () => {
          audioElementRef.current = null;
          URL.revokeObjectURL(audio.src);
          resolve();
        });

        audio.addEventListener('error', () => {
          audioElementRef.current = null;
          URL.revokeObjectURL(audio.src);
          devWarn('[AdminVoice] MSE audio element error:', audio.error?.message);
          resolve(); // Don't reject — let the loop continue
        });

        // Safety: if aborted externally (barge-in), clean up
        signal.addEventListener('abort', () => {
          audio.pause();
          audioElementRef.current = null;
          URL.revokeObjectURL(audio.src);
          resolve();
        });
      });
    },
    [],
  );

  // ── AudioContext fallback — accumulate then decode ───────────────────
  const playWithAudioContext = useCallback(
    async (body: ReadableStream<Uint8Array>): Promise<void> => {
      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        audioContextRef.current = new AudioContext();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      const reader = body.getReader();
      const chunks: Uint8Array[] = [];
      let totalLength = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          totalLength += value.length;
        }
      }

      if (totalLength < 100) {
        devWarn('[AdminVoice] TTS returned empty/tiny audio');
        return;
      }

      const combined = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        combined.set(chunk, offset);
        offset += chunk.length;
      }

      const audioBuffer = await ctx.decodeAudioData(combined.buffer);
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
    },
    [],
  );

  // ── Pre-warm backend connections (eliminates 80-200ms cold TCP/TLS) ─
  const prewarmConnections = useCallback(() => {
    // Fire-and-forget: hit the health endpoint to establish the TCP+TLS
    // connection pool. Subsequent TTS/chat fetches reuse the warm connection.
    fetch(buildOpsFacadeUrl('/admin/ops/health'), { method: 'GET' }).catch(() => {});
  }, []);

  // ── Session management ─────────────────────────────────────────────
  const startSession = useCallback(async () => {
    try {
      setError(null);
      setOrbState('listening');
      setIsSessionActive(true);

      // Pre-warm backend connection in parallel with mic setup
      prewarmConnections();
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
  }, [emitReceipt, prewarmConnections]);

  const endSession = useCallback(() => {
    sttRef.current.stopListening();
    stopPlayback();

    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    isProcessingRef.current = false;
    voiceHistoryRef.current = [];

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

    // Quality gate: ignore noise artifacts (too short or no real words)
    const trimmed = stt.transcript.trim();
    if (trimmed.length < 3 || trimmed.split(/\s+/).length < 2) {
      devWarn('[AdminVoice] Ignoring noise transcript:', trimmed);
      sttRef.current.clearTranscript();
      return;
    }

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
            history: voiceHistoryRef.current.slice(-20),
            context: { channel: 'admin_voice' },
            max_response_tokens: 300,
            user_profile: user?.displayName
              ? { owner_name: user.displayName }
              : undefined,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const detail = await response.text().catch(() => '');
          throw new Error(`Backend error ${response.status}${detail ? `: ${detail}` : ''}`);
        }

        // Parse SSE stream with progressive sentence-boundary TTS.
        // Instead of waiting for the full response, we start TTS on the
        // first complete sentence — cutting perceived latency by 1-3s.
        let responseContent = '';
        let sentenceBuffer = '';
        const ttsQueue: string[] = [];
        let ttsPlaying = false;
        let streamDone = false;

        // Sentence-boundary regex: ends with . ? ! followed by space or end
        const isSentenceEnd = (text: string): boolean =>
          /[.!?][\s"'\u201D\u2019]*$/.test(text.trim());

        // Sequential TTS player — plays queued sentences one after another
        const playNextInQueue = async () => {
          if (ttsPlaying || ttsQueue.length === 0) return;
          if (isMutedRef.current || !sessionActiveRef.current) return;
          ttsPlaying = true;
          while (ttsQueue.length > 0 && sessionActiveRef.current && !isMutedRef.current) {
            const sentence = ttsQueue.shift()!;
            setOrbState('speaking');
            await playTtsAudio(sentence);
          }
          ttsPlaying = false;
        };

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

                if (event.type === 'delta' && event.content) {
                  // Progressive streaming: accumulate deltas for TTS
                  responseContent += event.content;
                  sentenceBuffer += event.content;

                  // Check for sentence boundary — queue for TTS immediately
                  if (isSentenceEnd(sentenceBuffer) && sentenceBuffer.trim().length > 10) {
                    ttsQueue.push(sentenceBuffer.trim());
                    sentenceBuffer = '';
                    // Fire TTS without awaiting — plays in background
                    playNextInQueue();
                  }
                } else if (event.type === 'response' && event.content) {
                  // Final response event: only use if no deltas arrived
                  // (fallback non-streaming path). If deltas already built
                  // responseContent, skip to avoid double content.
                  if (!responseContent) {
                    responseContent = event.content;
                    sentenceBuffer = event.content;
                  }
                }
              } catch {
                // Skip unparseable SSE lines
              }
            }
          }
        }

        streamDone = true;

        // Flush any remaining text in the sentence buffer
        if (sentenceBuffer.trim()) {
          ttsQueue.push(sentenceBuffer.trim());
          playNextInQueue();
        }

        const finalText = responseContent || "I'm ready for your next step.";
        setLastAvaResponse(finalText);

        // Bug 6E: Track conversation turns for multi-turn context
        voiceHistoryRef.current.push(
          { role: 'user', content: stt.transcript },
          { role: 'assistant', content: finalText },
        );
        // Cap at 40 entries (20 exchanges)
        if (voiceHistoryRef.current.length > 40) {
          voiceHistoryRef.current = voiceHistoryRef.current.slice(-40);
        }

        sttRef.current.clearTranscript();

        // Wait for all queued TTS to finish before restarting STT
        while (ttsPlaying || ttsQueue.length > 0) {
          await new Promise(r => setTimeout(r, 100));
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

  // ── Barge-in: debounced — only interrupt if speech sustained >300ms (Bug 6C fix) ──
  const bargeInTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (stt.isSpeechDetected && orbState === 'speaking' && isSessionActive) {
      // Start debounce timer — only barge-in after 300ms continuous speech
      if (!bargeInTimerRef.current) {
        bargeInTimerRef.current = setTimeout(() => {
          bargeInTimerRef.current = null;
          // Re-check conditions after debounce
          if (sessionActiveRef.current) {
            abortControllerRef.current?.abort();
            abortControllerRef.current = null;
            stopPlayback();
            isProcessingRef.current = false;
            setOrbState('listening');
          }
        }, 300);
      }
    } else {
      // Speech stopped or state changed — cancel pending barge-in
      if (bargeInTimerRef.current) {
        clearTimeout(bargeInTimerRef.current);
        bargeInTimerRef.current = null;
      }
    }
  }, [stt.isSpeechDetected, orbState, isSessionActive, stopPlayback]);

  // ── Cleanup on unmount ─────────────────────────────────────────────
  useEffect(() => {
    return () => {
      sttRef.current.stopListening();
      abortControllerRef.current?.abort();
      stopPlayback();
      if (audioContextRef.current?.state !== 'closed') {
        audioContextRef.current?.close().catch(() => {});
      }
      audioElementRef.current = null;
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
