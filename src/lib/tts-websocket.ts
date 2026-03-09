/**
 * TtsWebSocket — Direct port from Aspire-desktop/lib/tts-websocket.ts
 *
 * Multi-context WebSocket TTS manager for ElevenLabs.
 * Pure browser WebSocket — no Expo dependencies.
 */

export interface TtsWsOptions {
  voiceId: string;
  model?: string;
  outputFormat?: string;
  accessToken?: string;
  suiteId?: string;
  traceId?: string;
  voiceSettings?: {
    stability?: number;
    similarity_boost?: number;
    style?: number;
    use_speaker_boost?: boolean;
    speed?: number;
  };
  onAudio: (contextId: string, audioChunk: Uint8Array) => void;
  onContextDone: (contextId: string) => void;
  onConnected: () => void;
  onError: (error: Error) => void;
  onClose: () => void;
}

export class TtsWebSocket {
  private ws: WebSocket | null = null;
  private voiceId: string;
  private model: string;
  private outputFormat: string;
  private accessToken?: string;
  private suiteId?: string;
  private traceId?: string;
  private voiceSettings: TtsWsOptions['voiceSettings'];
  private callbacks: TtsWsOptions;
  private contextCounter = 0;

  constructor(options: TtsWsOptions) {
    this.voiceId = options.voiceId;
    this.model = options.model || 'eleven_flash_v2_5';
    this.outputFormat = options.outputFormat || 'mp3_44100_128';
    this.accessToken = options.accessToken;
    this.suiteId = options.suiteId;
    this.traceId = options.traceId;
    this.voiceSettings = options.voiceSettings;
    this.callbacks = options;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      // SECURITY: Auth tokens sent via first message, NOT URL query params.
      // URL params leak to server logs, browser history, and proxy logs (RFC 6750 §2.3).
      const qs = new URLSearchParams({
        voice_id: this.voiceId,
        model: this.model,
        output_format: this.outputFormat,
      });
      if (this.traceId) qs.set('trace_id', this.traceId);
      if (typeof this.voiceSettings?.stability === 'number') qs.set('stability', String(this.voiceSettings.stability));
      if (typeof this.voiceSettings?.similarity_boost === 'number') qs.set('similarity_boost', String(this.voiceSettings.similarity_boost));
      if (typeof this.voiceSettings?.style === 'number') qs.set('style', String(this.voiceSettings.style));
      if (typeof this.voiceSettings?.speed === 'number') qs.set('speed', String(this.voiceSettings.speed));
      if (typeof this.voiceSettings?.use_speaker_boost === 'boolean') qs.set('use_speaker_boost', this.voiceSettings.use_speaker_boost ? 'true' : 'false');

      const url = `${protocol}//${window.location.host}/ws/tts?${qs.toString()}`;
      this.ws = new WebSocket(url);

      const connectTimeout = setTimeout(() => {
        reject(new Error('TTS WebSocket connection timeout'));
        this.ws?.close();
      }, 10_000);

      this.ws.onopen = () => {
        // Send auth as first message instead of URL params (Law #9: no secrets in URLs)
        if (this.accessToken || this.suiteId) {
          this.ws?.send(JSON.stringify({
            type: 'auth',
            token: this.accessToken || '',
            suite_id: this.suiteId || '',
          }));
        }
      };

      const onFirstMessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'connected') {
            clearTimeout(connectTimeout);
            this.ws?.removeEventListener('message', onFirstMessage);
            this.ws?.addEventListener('message', this.handleMessage);
            this.callbacks.onConnected();
            resolve();
          } else if (data.type === 'error') {
            clearTimeout(connectTimeout);
            reject(new Error(data.message || 'TTS connection failed'));
          }
        } catch {
          // Not JSON — ignore during handshake
        }
      };

      this.ws.addEventListener('message', onFirstMessage);
      this.ws.onerror = () => {
        clearTimeout(connectTimeout);
        reject(new Error('TTS WebSocket connection failed'));
      };
      this.ws.onclose = () => {
        clearTimeout(connectTimeout);
        this.ws = null;
        this.callbacks.onClose();
      };
    });
  }

  private handleMessage = (event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);
      const contextId: string = data.context_id || data.contextId || 'default';

      if (data.audio) {
        const binary = atob(data.audio);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        this.callbacks.onAudio(contextId, bytes);
      }

      if (data.isFinal || data.is_final || data.final) {
        this.callbacks.onContextDone(contextId);
      }

      if (data.type === 'error') {
        this.callbacks.onError(new Error(data.message || 'TTS streaming error'));
      }
    } catch {
      // Non-JSON message — ignore
    }
  };

  nextContextId(): string {
    return `ctx_${++this.contextCounter}_${Date.now()}`;
  }

  speak(text: string, contextId: string): void {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    const normalizedText = text.endsWith(' ') ? text : text + ' ';
    this.ws.send(JSON.stringify({ text: normalizedText, context_id: contextId }));
  }

  flush(contextId: string): void {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ context_id: contextId, flush: true }));
  }

  closeContext(contextId: string): void {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ context_id: contextId, close_context: true }));
  }

  interrupt(oldContextId: string, newContextId: string, newText: string): void {
    this.closeContext(oldContextId);
    this.speak(newText, newContextId);
    this.flush(newContextId);
  }

  close(): void {
    if (this.ws) {
      try {
        if (this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ close_socket: true }));
        }
        this.ws.close();
      } catch {
        // Already closing
      }
      this.ws = null;
    }
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}
