/**
 * Production STT hook with Voice Activity Detection (VAD).
 *
 * Pipeline: Mic → AnalyserNode (level + VAD) → MediaRecorder (chunks) → backend proxy
 *
 * Key behaviors:
 * - Continuous recording with auto-silence detection
 * - Audio level monitoring for UI visualization
 * - Auto-submits when user stops speaking (configurable silence threshold)
 * - Auto-restarts recording for next utterance (continuous mode)
 * - Proper cleanup on unmount / session end
 *
 * Backend contract: POST /admin/ops/voice/stt
 *   Request: raw audio bytes (Content-Type: audio/webm)
 *   Response: { transcript: string, provider: string, correlation_id: string }
 *
 * ElevenLabs STT expects: pcm_16000 or audio/webm;codecs=opus (proxy handles format)
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { buildOpsFacadeUrl, buildOpsHeaders } from '@/services/opsFacadeClient';
import { devLog } from '@/lib/devLog';

/** Silence threshold in seconds before auto-submitting speech */
const SILENCE_THRESHOLD_S = 1.2;
/** Minimum audio level (0-1) to consider as speech — raised to filter background noise */
const SPEECH_LEVEL_THRESHOLD = 0.035;
/** Consecutive frames above threshold required to confirm speech (~200ms at 50ms intervals) */
const MIN_SPEECH_FRAMES = 4;
/** Minimum recording duration in ms before auto-submit is allowed */
const MIN_RECORDING_MS = 500;
/** Maximum recording duration in ms (safety cap) */
const MAX_RECORDING_MS = 30_000;
/** Audio level sampling interval in ms */
const LEVEL_SAMPLE_INTERVAL_MS = 50;
/** Maximum silence before session auto-pauses (60s of no speech at all) */
const SESSION_SILENCE_TIMEOUT_MS = 60_000;

export interface UseElevenLabsSTTResult {
  isListening: boolean;
  transcript: string;
  interimTranscript: string;
  error: string | null;
  audioLevel: number;
  isSpeechDetected: boolean;
  startListening: () => Promise<void>;
  stopListening: () => void;
  clearTranscript: () => void;
  /** Restart recording for the next utterance (called after TTS finishes) */
  restartForNextUtterance: () => void;
}

export function useElevenLabsSTT(): UseElevenLabsSTTResult {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isSpeechDetected, setIsSpeechDetected] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const levelIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const silenceStartRef = useRef<number>(0);
  const recordingStartRef = useRef<number>(0);
  const hasSpeechRef = useRef(false);
  const speechFrameCountRef = useRef(0);
  const sessionSilenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSubmittingRef = useRef(false);
  const continuousModeRef = useRef(true);
  const mimeTypeRef = useRef<string>('audio/webm');

  // Cleanup all audio resources
  const cleanupAudio = useCallback(() => {
    if (levelIntervalRef.current) {
      clearInterval(levelIntervalRef.current);
      levelIntervalRef.current = null;
    }
    if (sessionSilenceTimerRef.current) {
      clearTimeout(sessionSilenceTimerRef.current);
      sessionSilenceTimerRef.current = null;
    }
    if (mediaRecorderRef.current?.state === 'recording') {
      try { mediaRecorderRef.current.stop(); } catch { /* already stopped */ }
    }
    mediaRecorderRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current?.state !== 'closed') {
      audioContextRef.current?.close().catch(() => {});
    }
    audioContextRef.current = null;
    analyserRef.current = null;
    setAudioLevel(0);
    setIsSpeechDetected(false);
  }, []);

  // Submit recorded audio to backend STT
  const submitAudio = useCallback(async (chunks: Blob[], mimeType: string) => {
    if (chunks.length === 0 || isSubmittingRef.current) return;
    isSubmittingRef.current = true;

    try {
      const blob = new Blob(chunks, { type: mimeType });
      // Skip tiny blobs (< 1KB) — likely silence
      if (blob.size < 1024) {
        isSubmittingRef.current = false;
        return;
      }

      const audioBytes = await blob.arrayBuffer();
      const res = await fetch(buildOpsFacadeUrl('/admin/ops/voice/stt'), {
        method: 'POST',
        headers: {
          ...buildOpsHeaders({ includeJson: false, includeAdminToken: true, includeSuiteId: false }),
          'Content-Type': 'audio/webm',
        },
        body: audioBytes,
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        throw new Error(`STT error ${res.status}${detail ? `: ${detail}` : ''}`);
      }

      const data = await res.json() as { transcript: string; provider: string };
      if (data.transcript?.trim()) {
        setTranscript(data.transcript.trim());
        setInterimTranscript('');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'STT failed');
    } finally {
      isSubmittingRef.current = false;
    }
  }, []);

  // Start a single recording segment (used internally)
  const startRecordingSegment = useCallback(() => {
    const stream = streamRef.current;
    if (!stream || stream.getAudioTracks().length === 0) return;

    const mimeType = mimeTypeRef.current;
    const recorder = new MediaRecorder(stream, { mimeType });
    mediaRecorderRef.current = recorder;
    chunksRef.current = [];
    hasSpeechRef.current = false;
    speechFrameCountRef.current = 0;
    recordingStartRef.current = Date.now();
    silenceStartRef.current = 0;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunksRef.current.push(e.data);
      }
    };

    recorder.onstop = () => {
      const capturedChunks = [...chunksRef.current];
      chunksRef.current = [];

      if (hasSpeechRef.current && capturedChunks.length > 0) {
        submitAudio(capturedChunks, mimeType);
      }
    };

    recorder.start(250); // 250ms chunks for responsive VAD
    setInterimTranscript('');
  }, [submitAudio]);

  // VAD: Monitor audio levels and detect speech/silence
  const startLevelMonitoring = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;

    const dataArray = new Uint8Array(analyser.fftSize);

    levelIntervalRef.current = setInterval(() => {
      if (!analyser) return;
      analyser.getByteTimeDomainData(dataArray);

      // Calculate RMS level (0-1)
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const normalized = (dataArray[i] - 128) / 128;
        sum += normalized * normalized;
      }
      const rms = Math.sqrt(sum / dataArray.length);
      setAudioLevel(rms);

      const isFrameAboveThreshold = rms > SPEECH_LEVEL_THRESHOLD;

      if (isFrameAboveThreshold) {
        speechFrameCountRef.current += 1;
      } else {
        speechFrameCountRef.current = 0;
      }

      // Require MIN_SPEECH_FRAMES consecutive frames above threshold
      // to confirm real speech (filters transient noise bursts)
      const isSpeaking = speechFrameCountRef.current >= MIN_SPEECH_FRAMES;
      setIsSpeechDetected(isSpeaking);

      if (isSpeaking) {
        hasSpeechRef.current = true;
        silenceStartRef.current = 0;

        // Reset session silence timer
        if (sessionSilenceTimerRef.current) {
          clearTimeout(sessionSilenceTimerRef.current);
          sessionSilenceTimerRef.current = null;
        }
      } else if (hasSpeechRef.current && !isFrameAboveThreshold && silenceStartRef.current === 0) {
        // Speech ended (dropped below threshold) — start silence timer
        silenceStartRef.current = Date.now();
      }

      // Auto-submit after silence threshold (only if speech was detected)
      if (
        hasSpeechRef.current &&
        silenceStartRef.current > 0 &&
        Date.now() - silenceStartRef.current > SILENCE_THRESHOLD_S * 1000 &&
        Date.now() - recordingStartRef.current > MIN_RECORDING_MS
      ) {
        // Stop current recording segment → triggers onstop → submits audio
        if (mediaRecorderRef.current?.state === 'recording') {
          mediaRecorderRef.current.stop();
        }
      }

      // Safety cap: max recording duration
      if (
        recordingStartRef.current > 0 &&
        Date.now() - recordingStartRef.current > MAX_RECORDING_MS &&
        mediaRecorderRef.current?.state === 'recording'
      ) {
        hasSpeechRef.current = true; // Force submit even without silence
        mediaRecorderRef.current.stop();
      }
    }, LEVEL_SAMPLE_INTERVAL_MS);
  }, []);

  // Main entry: acquire mic, set up audio pipeline, start recording
  const startListening = useCallback(async () => {
    try {
      setError(null);
      setInterimTranscript('');
      continuousModeRef.current = true;

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      // Determine best MIME type
      mimeTypeRef.current = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      // Set up AnalyserNode for audio level monitoring
      const audioCtx = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.85;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Start level monitoring (VAD)
      startLevelMonitoring();

      // Start first recording segment
      startRecordingSegment();
      setIsListening(true);

      // Session-level silence timeout (auto-pause after 60s of no speech)
      sessionSilenceTimerRef.current = setTimeout(() => {
        devLog('[STT] Session silence timeout — no speech for 60s');
        setIsListening(false);
        cleanupAudio();
      }, SESSION_SILENCE_TIMEOUT_MS);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Microphone access denied';
      setError(msg);
      setIsListening(false);
      cleanupAudio();
    }
  }, [cleanupAudio, startLevelMonitoring, startRecordingSegment]);

  // Restart recording for next utterance (called after TTS playback finishes)
  const restartForNextUtterance = useCallback(() => {
    if (!continuousModeRef.current || !streamRef.current) return;

    // Reset session silence timer
    if (sessionSilenceTimerRef.current) {
      clearTimeout(sessionSilenceTimerRef.current);
    }
    sessionSilenceTimerRef.current = setTimeout(() => {
      devLog('[STT] Session silence timeout — no speech for 60s');
      setIsListening(false);
      cleanupAudio();
    }, SESSION_SILENCE_TIMEOUT_MS);

    startRecordingSegment();
    setIsListening(true);
  }, [startRecordingSegment, cleanupAudio]);

  // Full stop: tear down everything
  const stopListening = useCallback(() => {
    continuousModeRef.current = false;
    cleanupAudio();
    setIsListening(false);
  }, [cleanupAudio]);

  const clearTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      continuousModeRef.current = false;
      cleanupAudio();
    };
  }, [cleanupAudio]);

  return {
    isListening,
    transcript,
    interimTranscript,
    error,
    audioLevel,
    isSpeechDetected,
    startListening,
    stopListening,
    clearTranscript,
    restartForNextUtterance,
  };
}
