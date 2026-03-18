/**
 * Admin Ava Chat Context — manages chat state, SSE streaming, and message history.
 *
 * Connects to backend via POST /v1/intents?stream=true with admin token.
 * Maps SSE events to chat messages: activity → thinking indicator, response → Ava message.
 * Receipt emitted server-side (Law #2), receipt ID in response metadata.
 */

import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react';
import { buildOpsFacadeUrl, buildOpsHeaders } from '@/services/opsFacadeClient';
import { useOpsDesk, type OpsDeskReceipt, type TranscriptEntry, type PatchJob } from '@/contexts/OpsDeskContext';

// ── Message Types ──────────────────────────────────────────────────
export type ChatMessageRole = 'user' | 'ava' | 'system';
export type ChatMessageType =
  | 'text'
  | 'thinking'
  | 'council'
  | 'robot'
  | 'patch'
  | 'incidents'
  | 'error'
  | 'suggestion'
  | 'receipt';

export interface ChatMessage {
  id: string;
  role: ChatMessageRole;
  type: ChatMessageType;
  content: string;
  timestamp: string;
  /** Structured metadata for special message types */
  meta?: {
    receiptId?: string;
    councilSessionId?: string;
    robotRunId?: string;
    patchJobId?: string;
    reasoning?: string;
    sources?: string[];
    confidence?: number;
    toolCalls?: Array<{ name: string; status: 'running' | 'done' | 'error' }>;
    /** Codex patch fields */
    patchChanges?: string[];
    patchImpact?: string;
    patchTestPlan?: string;
    /** Release pipeline gates (status: pending|running|passed|failed|awaiting_approval) */
    pipelineGates?: Array<{ id: string; name: string; environment: string; status: 'pending' | 'running' | 'passed' | 'failed' | 'awaiting_approval'; robotRunId?: string; requiresApproval: boolean }>;
    /** Internal: true while response is actively streaming */
    _isStreaming?: boolean;
  };
}

export type StreamStatus = 'idle' | 'connecting' | 'streaming' | 'error';

// ── Context Interface ──────────────────────────────────────────────
interface AdminAvaChatContextType {
  messages: ChatMessage[];
  streamStatus: StreamStatus;
  isStreaming: boolean;
  sendMessage: (text: string) => Promise<void>;
  clearMessages: () => void;
  addSystemMessage: (content: string, meta?: ChatMessage['meta']) => void;
  /** Active council session IDs being tracked */
  activeCouncilSessions: string[];
  /** Active robot run IDs being tracked */
  activeRobotRuns: string[];
  /** Current patch job from ops desk */
  currentPatchJob: PatchJob | null;
}

const AdminAvaChatContext = createContext<AdminAvaChatContextType | undefined>(undefined);

// ── Helpers ────────────────────────────────────────────────────────
function makeId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function now(): string {
  return new Date().toISOString();
}

// ── Provider ───────────────────────────────────────────────────────
export function AdminAvaChatProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'ava',
      type: 'text',
      content: "I'm Ava, your administrative AI. I can analyze incidents, run Meeting of the Minds councils, dispatch Codex patches, and manage your operations. How can I help?",
      timestamp: now(),
    },
  ]);
  const [streamStatus, setStreamStatus] = useState<StreamStatus>('idle');
  const [activeCouncilSessions, setActiveCouncilSessions] = useState<string[]>([]);
  const [activeRobotRuns, setActiveRobotRuns] = useState<string[]>([]);

  const abortRef = useRef<AbortController | null>(null);
  const opsDesk = useOpsDesk();

  const addMessage = useCallback((msg: ChatMessage) => {
    setMessages(prev => [...prev, msg]);
  }, []);

  const addSystemMessage = useCallback((content: string, meta?: ChatMessage['meta']) => {
    addMessage({
      id: makeId(),
      role: 'system',
      type: 'text',
      content,
      timestamp: now(),
      meta,
    });
  }, [addMessage]);

  const sendMessage = useCallback(async (text: string) => {
    // 1. Add user message
    const userMsg: ChatMessage = {
      id: makeId(),
      role: 'user',
      type: 'text',
      content: text,
      timestamp: now(),
    };
    addMessage(userMsg);

    // Also add to ops desk transcript for backward compat
    opsDesk.addTranscriptEntry('You', text);

    // 2. Add thinking indicator
    const thinkingId = makeId();
    addMessage({
      id: thinkingId,
      role: 'ava',
      type: 'thinking',
      content: 'Thinking...',
      timestamp: now(),
    });

    // 3. Connect to SSE stream
    setStreamStatus('connecting');
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch(buildOpsFacadeUrl('/admin/ops/chat'), {
        method: 'POST',
        headers: {
          ...buildOpsHeaders({ includeJson: true, includeAdminToken: true, includeSuiteId: false }),
          Accept: 'text/event-stream',
        },
        body: JSON.stringify({
          message: text,
          history: messages
            .filter(m => m.role === 'user' || m.role === 'ava')
            .filter(m => m.type === 'text')
            .slice(-40)
            .map(m => ({
              role: m.role === 'ava' ? 'assistant' : 'user',
              content: m.content,
            })),
          context: {
            attachments: opsDesk.attachments.map(a => ({
              type: a.type,
              id: a.entityId,
            })),
          },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Backend error: ${response.status}`);
      }

      setStreamStatus('streaming');

      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let responseContent = '';
      let responseMeta: ChatMessage['meta'] = {};
      let hasStartedContent = false;

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
            const event = JSON.parse(raw) as {
              type?: string;
              content?: string;
              reasoning?: string;
              receipt_id?: string;
              council_session_id?: string;
              robot_run_id?: string;
              patch_job_id?: string;
              patch_changes?: string[];
              patch_impact?: string;
              patch_test_plan?: string;
              pipeline_gates?: Array<{ id: string; name: string; environment: string; status: string; robotRunId?: string; requiresApproval: boolean }>;
              tool_calls?: Array<{ name: string; status: string }>;
              sources?: string[];
            };

            if (event.type === 'activity' && event.tool_calls) {
              // Update thinking message with tool call info
              setMessages(prev =>
                prev.map(m =>
                  m.id === thinkingId
                    ? {
                        ...m,
                        content: `Using ${event.tool_calls![0]?.name || 'tools'}...`,
                        meta: {
                          ...m.meta,
                          toolCalls: event.tool_calls as ChatMessage['meta']['toolCalls'],
                        },
                      }
                    : m,
                ),
              );
            }

            if (event.type === 'response' || event.type === 'delta') {
              const newContent = event.content || '';
              if (newContent) {
                responseContent += newContent;

                // Transition from thinking → streaming on first content token
                if (!hasStartedContent) {
                  hasStartedContent = true;
                  setMessages(prev =>
                    prev.map(m =>
                      m.id === thinkingId
                        ? { ...m, type: 'text' as const, content: responseContent, meta: { ...m.meta, _isStreaming: true } }
                        : m,
                    ),
                  );
                } else {
                  // Update content in real-time as tokens arrive
                  setMessages(prev =>
                    prev.map(m =>
                      m.id === thinkingId
                        ? { ...m, content: responseContent, meta: { ...m.meta, _isStreaming: true } }
                        : m,
                    ),
                  );
                }
              }
            }

            if (event.reasoning) {
              responseMeta.reasoning = (responseMeta.reasoning || '') + event.reasoning;
            }

            if (event.receipt_id) {
              responseMeta.receiptId = event.receipt_id;
            }

            if (event.council_session_id) {
              responseMeta.councilSessionId = event.council_session_id;
              setActiveCouncilSessions(prev =>
                prev.includes(event.council_session_id!)
                  ? prev
                  : [...prev, event.council_session_id!],
              );
            }

            if (event.robot_run_id) {
              responseMeta.robotRunId = event.robot_run_id;
              setActiveRobotRuns(prev =>
                prev.includes(event.robot_run_id!)
                  ? prev
                  : [...prev, event.robot_run_id!],
              );
            }

            if (event.patch_job_id) {
              responseMeta.patchJobId = event.patch_job_id;
              if (event.patch_changes) responseMeta.patchChanges = event.patch_changes;
              if (event.patch_impact) responseMeta.patchImpact = event.patch_impact;
              if (event.patch_test_plan) responseMeta.patchTestPlan = event.patch_test_plan;
            }

            if (event.pipeline_gates) {
              responseMeta.pipelineGates = event.pipeline_gates;
            }

            if (event.sources) {
              responseMeta.sources = event.sources;
            }
          } catch {
            // Skip unparseable lines
          }
        }
      }

      // 4. Finalize — remove streaming flag, set final type + meta
      const avaMsg: ChatMessage = {
        id: thinkingId,
        role: 'ava',
        type: responseMeta.councilSessionId ? 'council'
            : responseMeta.patchJobId ? 'patch'
            : responseMeta.robotRunId ? 'robot'
            : 'text',
        content: responseContent || "I'm ready for your next step.",
        timestamp: now(),
        meta: { ...responseMeta },
      };
      setMessages(prev => prev.map(m => (m.id === thinkingId ? avaMsg : m)));

      // Add to ops desk transcript
      opsDesk.addTranscriptEntry('Ava', responseContent || "I'm ready for your next step.");

      // Add receipt if present
      if (responseMeta.receiptId) {
        opsDesk.addReceipt({
          action: `Processed: ${text.slice(0, 50)}`,
          outcome: 'Success',
          actor: 'Ava',
          summary: responseContent.slice(0, 100),
          receiptType: 'admin_chat_response',
          correlationId: responseMeta.receiptId,
        });
      }

      setStreamStatus('idle');
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        setStreamStatus('idle');
        return;
      }

      const errorMsg = err instanceof Error ? err.message : 'Connection failed';

      // Replace thinking with error
      setMessages(prev =>
        prev.map(m =>
          m.id === thinkingId
            ? {
                ...m,
                type: 'error' as const,
                content: `Connection error: ${errorMsg}. The backend may be offline — your message has been queued.`,
              }
            : m,
        ),
      );

      // Emit failure receipt (Law #2: receipts for ALL outcomes including failures)
      opsDesk.addReceipt({
        action: `Failed: ${text.slice(0, 50)}`,
        outcome: 'Failed',
        actor: 'Ava',
        summary: errorMsg,
        receiptType: 'admin_chat_error',
        correlationId: `err-${Date.now()}`,
      });

      setStreamStatus('error');
    }
  }, [addMessage, opsDesk]);

  const clearMessages = useCallback(() => {
    setMessages([
      {
        id: 'welcome',
        role: 'ava',
        type: 'text',
        content: "Chat cleared. How can I help?",
        timestamp: now(),
      },
    ]);
    setActiveCouncilSessions([]);
    setActiveRobotRuns([]);
  }, []);

  return (
    <AdminAvaChatContext.Provider
      value={{
        messages,
        streamStatus,
        isStreaming: streamStatus === 'streaming',
        sendMessage,
        clearMessages,
        addSystemMessage,
        activeCouncilSessions,
        activeRobotRuns,
        currentPatchJob: opsDesk.currentPatchJob,
      }}
    >
      {children}
    </AdminAvaChatContext.Provider>
  );
}

export function useAdminAvaChat() {
  const context = useContext(AdminAvaChatContext);
  if (!context) throw new Error('useAdminAvaChat must be used within AdminAvaChatProvider');
  return context;
}
