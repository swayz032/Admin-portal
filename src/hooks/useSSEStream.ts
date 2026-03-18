/**
 * SSE (Server-Sent Events) client hook for streaming from backend endpoints.
 *
 * Uses fetch-based EventSource (not native EventSource) to support
 * custom headers (X-Admin-Token, X-Suite-Id).
 *
 * Features:
 * - Auto-reconnect with exponential backoff (1s → 2s → 4s → ... → 30s)
 * - Connection status tracking
 * - Typed event parsing
 * - Clean unmount
 */

import { useState, useEffect, useCallback, useRef } from 'react';

const MAX_BACKOFF_MS = 30_000;
const INITIAL_BACKOFF_MS = 1_000;
const MAX_RETRIES = 5;
const CONNECT_TIMEOUT_MS = 10_000;

type SSEConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface SSEEvent<T = unknown> {
  type: string;
  data: T;
  id?: string;
  timestamp: number;
}

interface UseSSEStreamResult<T> {
  /** Latest event received */
  lastEvent: SSEEvent<T> | null;
  /** All events received in this session (capped at 500) */
  events: SSEEvent<T>[];
  /** Connection status */
  status: SSEConnectionStatus;
  /** Error message if connection failed */
  error: string | null;
  /** Manually reconnect */
  reconnect: () => void;
  /** Manually disconnect */
  disconnect: () => void;
}

interface UseSSEStreamOptions {
  /** Full URL to SSE endpoint */
  url: string;
  /** Whether to auto-connect on mount */
  enabled?: boolean;
  /** Custom headers (e.g. auth tokens) */
  headers?: Record<string, string>;
  /** Max events to retain in buffer */
  maxEvents?: number;
  /** Event types to listen for (default: all) */
  eventTypes?: string[];
}

export function useSSEStream<T = unknown>({
  url,
  enabled = true,
  headers = {},
  maxEvents = 500,
  eventTypes,
}: UseSSEStreamOptions): UseSSEStreamResult<T> {
  const [lastEvent, setLastEvent] = useState<SSEEvent<T> | null>(null);
  const [events, setEvents] = useState<SSEEvent<T>[]>([]);
  const [status, setStatus] = useState<SSEConnectionStatus>('disconnected');
  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const abortRef = useRef<AbortController | null>(null);
  const backoffRef = useRef(INITIAL_BACKOFF_MS);
  const retryCountRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const addEvent = useCallback(
    (event: SSEEvent<T>) => {
      setLastEvent(event);
      setEvents(prev => {
        const next = [event, ...prev];
        return next.length > maxEvents ? next.slice(0, maxEvents) : next;
      });
    },
    [maxEvents],
  );

  const connect = useCallback(async () => {
    if (!mountedRef.current || !enabled) return;

    // Abort previous connection
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStatus('connecting');
    setError(null);

    try {
      // Connection timeout — abort if preflight/connect takes too long
      const timeoutId = setTimeout(() => controller.abort(), CONNECT_TIMEOUT_MS);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'text/event-stream',
          'Cache-Control': 'no-cache',
          ...headers,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`SSE connection failed: ${response.status} ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('SSE response has no body');
      }

      setStatus('connected');
      backoffRef.current = INITIAL_BACKOFF_MS;
      retryCountRef.current = 0; // Reset retries on successful connection

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (mountedRef.current) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        let currentEventType = 'message';
        let currentData = '';
        let currentId: string | undefined;

        for (const line of lines) {
          if (line.startsWith('event:')) {
            currentEventType = line.slice(6).trim();
          } else if (line.startsWith('data:')) {
            currentData += (currentData ? '\n' : '') + line.slice(5).trim();
          } else if (line.startsWith('id:')) {
            currentId = line.slice(3).trim();
          } else if (line === '') {
            // Empty line = end of event
            if (currentData) {
              // Filter by event type if specified
              if (!eventTypes || eventTypes.includes(currentEventType)) {
                let parsed: T;
                try {
                  parsed = JSON.parse(currentData) as T;
                } catch {
                  parsed = currentData as unknown as T;
                }

                if (mountedRef.current) {
                  addEvent({
                    type: currentEventType,
                    data: parsed,
                    id: currentId,
                    timestamp: Date.now(),
                  });
                }
              }
            }
            // Reset for next event
            currentEventType = 'message';
            currentData = '';
            currentId = undefined;
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        // Could be intentional disconnect or connection timeout
        if (mountedRef.current && retryCountRef.current < MAX_RETRIES) {
          // Timeout-induced abort — retry with backoff
          retryCountRef.current += 1;
          const delay = backoffRef.current;
          backoffRef.current = Math.min(delay * 2, MAX_BACKOFF_MS);
          setStatus('error');
          setError(`Connection timeout (attempt ${retryCountRef.current}/${MAX_RETRIES})`);
          reconnectTimerRef.current = setTimeout(() => {
            if (mountedRef.current) connect();
          }, delay);
        }
        return;
      }

      if (mountedRef.current) {
        retryCountRef.current += 1;
        const msg = err instanceof Error ? err.message : 'SSE connection failed';
        setError(msg);
        setStatus('error');

        if (retryCountRef.current < MAX_RETRIES) {
          // Auto-reconnect with exponential backoff (capped retries)
          const delay = backoffRef.current;
          backoffRef.current = Math.min(delay * 2, MAX_BACKOFF_MS);
          reconnectTimerRef.current = setTimeout(() => {
            if (mountedRef.current) connect();
          }, delay);
        }
        // After MAX_RETRIES, stop retrying — stay in error state
      }
    }
  }, [url, enabled, headers, eventTypes, addEvent]);

  const disconnect = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    setStatus('disconnected');
  }, []);

  const reconnect = useCallback(() => {
    disconnect();
    backoffRef.current = INITIAL_BACKOFF_MS;
    connect();
  }, [connect, disconnect]);

  useEffect(() => {
    mountedRef.current = true;
    if (enabled) connect();

    return () => {
      mountedRef.current = false;
      disconnect();
    };
  }, [enabled, connect, disconnect]);

  return { lastEvent, events, status, error, reconnect, disconnect };
}
