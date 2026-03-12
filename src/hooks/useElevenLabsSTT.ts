/**
 * Browser-compatible ElevenLabs Scribe STT hook.
 * Uses standard MediaRecorder API — no Expo dependencies.
 * Sends audio chunks to server proxy at /admin/ops/voice/stt.
 */

import { useState, useCallback, useRef } from 'react';
import { buildOpsFacadeUrl, buildOpsHeaders } from '@/services/opsFacadeClient';

interface UseElevenLabsSTTResult {
  isListening: boolean;
  transcript: string;
  interimTranscript: string;
  error: string | null;
  startListening: () => Promise<void>;
  stopListening: () => void;
  clearTranscript: () => void;
}

export function useElevenLabsSTT(): UseElevenLabsSTTResult {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const startListening = useCallback(async () => {
    try {
      setError(null);
      setInterimTranscript('');

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        chunksRef.current = [];

        // Send to server proxy
        try {
          const formData = new FormData();
          formData.append('audio', blob, 'recording.webm');

          const res = await fetch(buildOpsFacadeUrl('/admin/ops/voice/stt'), {
            method: 'POST',
            headers: buildOpsHeaders({ includeJson: false }),
            body: formData,
          });

          if (!res.ok) {
            throw new Error(`STT error: ${res.status}`);
          }

          const data = await res.json() as { text: string };
          if (data.text) {
            setTranscript(prev => (prev ? prev + ' ' + data.text : data.text));
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : 'STT failed');
        }

        setIsListening(false);
      };

      recorder.start(1000); // Collect chunks every 1s
      setIsListening(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Microphone access denied');
      setIsListening(false);
    }
  }, []);

  const stopListening = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, []);

  const clearTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
  }, []);

  return {
    isListening,
    transcript,
    interimTranscript,
    error,
    startListening,
    stopListening,
    clearTranscript,
  };
}
