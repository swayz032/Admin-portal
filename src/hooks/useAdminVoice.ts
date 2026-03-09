/**
 * Admin voice pipeline hook — browser-compatible port of useAgentVoice.ts.
 *
 * Manages: STT (ElevenLabs Scribe via server proxy), TTS (WebSocket),
 * orchestrator communication (POST /v1/intents), and orb state transitions.
 *
 * Agent fixed to `ava`. No Expo dependencies.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { TtsWebSocket } from '@/lib/tts-websocket';
import { getAdminToken, getSuiteId } from '@/lib/adminAuth';
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

const AVA_VOICE_ID = 'uYXf8XasLslADfZ2MB4u';

export function useAdminVoice(options?: UseAdminVoiceOptions): UseAdminVoiceResult {
  const emitReceipt = options?.onReceipt;
  const [orbState, setOrbState] = useState<VoiceOrbState>('idle');
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [lastAvaResponse, setLastAvaResponse] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);

  const ttsRef = useRef<TtsWebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioQueueRef = useRef<Uint8Array[]>([]);
  const isPlayingRef = useRef(false);
  const currentContextRef = useRef<string | null>(null);

  const stt = useElevenLabsSTT();
  const sttRef = useRef(stt);
  sttRef.current = stt;

  // ── Audio playback ────────────────────────────────────────────────
  const playNextChunk = useCallback(async () => {
    if (audioQueueRef.current.length === 0 || isPlayingRef.current) return;

    isPlayingRef.current = true;
    const chunk = audioQueueRef.current.shift()!;

    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }
      const ctx = audioContextRef.current;
      const buffer = await ctx.decodeAudioData(chunk.buffer.slice(0) as ArrayBuffer);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.onended = () => {
        isPlayingRef.current = false;
        if (audioQueueRef.current.length > 0) {
          playNextChunk();
        } else {
          setOrbState('listening');
        }
      };
      source.start();
    } catch {
      isPlayingRef.current = false;
      if (audioQueueRef.current.length > 0) playNextChunk();
    }
  }, []);

  // ── TTS callbacks ─────────────────────────────────────────────────
  const handleTtsAudio = useCallback((_contextId: string, audioChunk: Uint8Array) => {
    setOrbState('speaking');
    audioQueueRef.current.push(audioChunk);
    playNextChunk();
  }, [playNextChunk]);

  const handleTtsContextDone = useCallback((_contextId: string) => {
    if (audioQueueRef.current.length === 0 && !isPlayingRef.current) {
      setOrbState('listening');
    }
  }, []);

  // ── Session management ────────────────────────────────────────────
  const startSession = useCallback(async () => {
    try {
      setError(null);
      setOrbState('listening');
      setIsSessionActive(true);

      // Init TTS WebSocket
      const adminToken = getAdminToken();
      const suiteId = getSuiteId();

      const tts = new TtsWebSocket({
        voiceId: AVA_VOICE_ID,
        accessToken: adminToken,
        suiteId,
        onAudio: handleTtsAudio,
        onContextDone: handleTtsContextDone,
        onConnected: () => {},
        onError: (err) => setError(err.message),
        onClose: () => {},
      });

      await tts.connect();
      ttsRef.current = tts;

      // Start STT
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
  }, [handleTtsAudio, handleTtsContextDone, emitReceipt]);

  const endSession = useCallback(() => {
    sttRef.current.stopListening();
    ttsRef.current?.close();
    ttsRef.current = null;
    audioQueueRef.current = [];
    isPlayingRef.current = false;
    currentContextRef.current = null;
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

  // ── Process transcript → orchestrator → TTS ──────────────────────
  useEffect(() => {
    if (!stt.transcript || !isSessionActive || !ttsRef.current) return;

    const processTranscript = async () => {
      setOrbState('thinking');

      try {
        const adminToken = getAdminToken();
        const suiteId = getSuiteId();

        const res = await fetch('/api/v1/intents', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Admin-Token': adminToken,
            'X-Suite-Id': suiteId,
          },
          body: JSON.stringify({
            intent: stt.transcript,
            channel: 'admin_voice',
          }),
        });

        if (!res.ok) throw new Error(`Orchestrator error: ${res.status}`);

        const data = await res.json() as { response?: string; text?: string };
        const responseText = data.response || data.text || 'I processed your request.';

        setLastAvaResponse(responseText);

        // Send to TTS
        if (ttsRef.current && !isMuted) {
          const ctxId = ttsRef.current.nextContextId();
          currentContextRef.current = ctxId;
          ttsRef.current.speak(responseText, ctxId);
          ttsRef.current.flush(ctxId);
        } else {
          setOrbState('listening');
        }

        // Clear transcript for next utterance
        sttRef.current.clearTranscript();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Voice processing failed');
        setOrbState('error');
      }
    };

    processTranscript();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- stt object is unstable, use individual values
  }, [stt.transcript, isSessionActive, isMuted]);

  // ── Cleanup on unmount ────────────────────────────────────────────
  useEffect(() => {
    return () => {
      ttsRef.current?.close();
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
