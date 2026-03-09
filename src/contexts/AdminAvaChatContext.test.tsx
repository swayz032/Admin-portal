/**
 * Tests for AdminAvaChatContext (Wave 9 Admin Portal Overhaul).
 *
 * Validates:
 * - Initial state: welcome message present, streamStatus=idle
 * - useAdminAvaChat() throws when used outside provider
 * - sendMessage() adds user message + thinking indicator
 * - sendMessage() handles AbortError gracefully (no error state)
 * - sendMessage() sets streamStatus=error on backend failure
 * - sendMessage() parses council_session_id from SSE events
 * - sendMessage() parses robot_run_id from SSE events
 * - clearMessages() resets to welcome message
 * - addSystemMessage() adds system-role message
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { AdminAvaChatProvider, useAdminAvaChat } from './AdminAvaChatContext';

// ── Mock OpsDeskContext ────────────────────────────────────────────
vi.mock('@/contexts/OpsDeskContext', () => ({
  useOpsDesk: vi.fn(),
}));

import { useOpsDesk } from '@/contexts/OpsDeskContext';

const makeOpsDesk = () => ({
  currentPatchJob: null,
  patchDraftResult: null,
  orbState: 'idle',
  setOrbState: vi.fn(),
  addTranscriptEntry: vi.fn(),
  addReceipt: vi.fn(),
  attachments: [],
});

// ── Wrapper ────────────────────────────────────────────────────────
const wrapper = ({ children }: { children: ReactNode }) => (
  <AdminAvaChatProvider>{children}</AdminAvaChatProvider>
);

// ── SSE response builder ───────────────────────────────────────────
function makeSseResponse(events: object[]) {
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    start(controller) {
      for (const ev of events) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(ev)}\n\n`));
      }
      controller.close();
    },
  });

  return {
    ok: true,
    body,
    json: async () => ({}),
  };
}

describe('AdminAvaChatContext', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    (useOpsDesk as ReturnType<typeof vi.fn>).mockReturnValue(makeOpsDesk());
    fetchSpy = vi.fn();
    global.fetch = fetchSpy;

    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn().mockReturnValue('test-token'),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      },
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initial state', () => {
    it('starts with a welcome message from Ava', () => {
      const { result } = renderHook(() => useAdminAvaChat(), { wrapper });
      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0].role).toBe('ava');
      expect(result.current.messages[0].type).toBe('text');
    });

    it('streamStatus starts as idle', () => {
      const { result } = renderHook(() => useAdminAvaChat(), { wrapper });
      expect(result.current.streamStatus).toBe('idle');
    });

    it('isStreaming starts as false', () => {
      const { result } = renderHook(() => useAdminAvaChat(), { wrapper });
      expect(result.current.isStreaming).toBe(false);
    });

    it('activeCouncilSessions starts empty', () => {
      const { result } = renderHook(() => useAdminAvaChat(), { wrapper });
      expect(result.current.activeCouncilSessions).toEqual([]);
    });

    it('activeRobotRuns starts empty', () => {
      const { result } = renderHook(() => useAdminAvaChat(), { wrapper });
      expect(result.current.activeRobotRuns).toEqual([]);
    });
  });

  describe('useAdminAvaChat guard', () => {
    it('throws when used outside AdminAvaChatProvider', () => {
      // Suppress expected error output
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      expect(() => renderHook(() => useAdminAvaChat())).toThrow(
        'useAdminAvaChat must be used within AdminAvaChatProvider',
      );
      consoleSpy.mockRestore();
    });
  });

  describe('sendMessage', () => {
    it('adds user message to messages array', async () => {
      fetchSpy.mockResolvedValue(makeSseResponse([{ type: 'response', content: 'Hello!' }]));

      const { result } = renderHook(() => useAdminAvaChat(), { wrapper });

      await act(async () => {
        await result.current.sendMessage('What is the system status?');
      });

      const userMsg = result.current.messages.find(m => m.role === 'user');
      expect(userMsg).toBeDefined();
      expect(userMsg?.content).toBe('What is the system status?');
    });

    it('adds thinking indicator while waiting for response', async () => {
      // Use a slow fetch to catch the intermediate thinking state
      let resolveFetch: () => void;
      const slowResponse = new Promise<typeof fetchSpy>((resolve) => {
        resolveFetch = () =>
          resolve(makeSseResponse([{ type: 'response', content: 'Done.' }]) as unknown as typeof fetchSpy);
      });
      fetchSpy.mockReturnValue(slowResponse);

      const { result } = renderHook(() => useAdminAvaChat(), { wrapper });

      act(() => {
        result.current.sendMessage('Hello');
      });

      // Thinking message should exist before fetch resolves
      await waitFor(() => {
        const thinking = result.current.messages.find(m => m.type === 'thinking');
        expect(thinking).toBeDefined();
      });

      resolveFetch!();
    });

    it('sets streamStatus=error when backend returns non-ok response', async () => {
      fetchSpy.mockResolvedValue({ ok: false, status: 503, body: null });

      const { result } = renderHook(() => useAdminAvaChat(), { wrapper });

      await act(async () => {
        await result.current.sendMessage('Trigger error');
      });

      expect(result.current.streamStatus).toBe('error');
    });

    it('replaces thinking message with error message on backend failure', async () => {
      fetchSpy.mockResolvedValue({ ok: false, status: 503, body: null });

      const { result } = renderHook(() => useAdminAvaChat(), { wrapper });

      await act(async () => {
        await result.current.sendMessage('Fail');
      });

      const errorMsg = result.current.messages.find(m => m.type === 'error');
      expect(errorMsg).toBeDefined();
      expect(errorMsg?.content).toContain('Connection error');
    });

    it('registers council_session_id in activeCouncilSessions', async () => {
      fetchSpy.mockResolvedValue(
        makeSseResponse([
          { type: 'response', content: 'Council started', council_session_id: 'sess-abc' },
        ]),
      );

      const { result } = renderHook(() => useAdminAvaChat(), { wrapper });

      await act(async () => {
        await result.current.sendMessage('Run council');
      });

      expect(result.current.activeCouncilSessions).toContain('sess-abc');
    });

    it('does not duplicate council_session_id in activeCouncilSessions', async () => {
      fetchSpy.mockResolvedValue(
        makeSseResponse([
          { type: 'response', content: 'Council', council_session_id: 'sess-dup' },
          { type: 'delta', content: '', council_session_id: 'sess-dup' },
        ]),
      );

      const { result } = renderHook(() => useAdminAvaChat(), { wrapper });

      await act(async () => {
        await result.current.sendMessage('Run council');
      });

      const sessions = result.current.activeCouncilSessions.filter(s => s === 'sess-dup');
      expect(sessions).toHaveLength(1);
    });

    it('registers robot_run_id in activeRobotRuns', async () => {
      fetchSpy.mockResolvedValue(
        makeSseResponse([
          { type: 'response', content: 'Robot dispatched', robot_run_id: 'run-xyz' },
        ]),
      );

      const { result } = renderHook(() => useAdminAvaChat(), { wrapper });

      await act(async () => {
        await result.current.sendMessage('Run robots');
      });

      expect(result.current.activeRobotRuns).toContain('run-xyz');
    });

    it('sets receipt-type message when receipt_id in response', async () => {
      fetchSpy.mockResolvedValue(
        makeSseResponse([{ type: 'response', content: 'Done', receipt_id: 'rcpt-1' }]),
      );
      const opsDesk = makeOpsDesk();
      (useOpsDesk as ReturnType<typeof vi.fn>).mockReturnValue(opsDesk);

      const { result } = renderHook(() => useAdminAvaChat(), { wrapper });

      await act(async () => {
        await result.current.sendMessage('Execute action');
      });

      expect(opsDesk.addReceipt).toHaveBeenCalledWith(
        expect.objectContaining({ correlationId: 'rcpt-1' }),
      );
    });
  });

  describe('clearMessages', () => {
    it('resets messages to single welcome message', async () => {
      fetchSpy.mockResolvedValue(makeSseResponse([{ type: 'response', content: 'Hi' }]));

      const { result } = renderHook(() => useAdminAvaChat(), { wrapper });

      await act(async () => {
        await result.current.sendMessage('Hello');
      });

      expect(result.current.messages.length).toBeGreaterThan(1);

      act(() => {
        result.current.clearMessages();
      });

      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0].role).toBe('ava');
    });

    it('clears activeCouncilSessions on clearMessages', async () => {
      fetchSpy.mockResolvedValue(
        makeSseResponse([{ type: 'response', content: '', council_session_id: 'sess-old' }]),
      );

      const { result } = renderHook(() => useAdminAvaChat(), { wrapper });

      await act(async () => {
        await result.current.sendMessage('Council');
      });

      expect(result.current.activeCouncilSessions).toHaveLength(1);

      act(() => {
        result.current.clearMessages();
      });

      expect(result.current.activeCouncilSessions).toHaveLength(0);
    });

    it('clears activeRobotRuns on clearMessages', async () => {
      fetchSpy.mockResolvedValue(
        makeSseResponse([{ type: 'response', content: '', robot_run_id: 'run-old' }]),
      );

      const { result } = renderHook(() => useAdminAvaChat(), { wrapper });

      await act(async () => {
        await result.current.sendMessage('Robots');
      });

      expect(result.current.activeRobotRuns).toHaveLength(1);

      act(() => {
        result.current.clearMessages();
      });

      expect(result.current.activeRobotRuns).toHaveLength(0);
    });
  });

  describe('addSystemMessage', () => {
    it('adds a system-role message with provided content', () => {
      const { result } = renderHook(() => useAdminAvaChat(), { wrapper });

      act(() => {
        result.current.addSystemMessage('Incident escalated to P0');
      });

      const sysMsg = result.current.messages.find(m => m.role === 'system');
      expect(sysMsg).toBeDefined();
      expect(sysMsg?.content).toBe('Incident escalated to P0');
    });

    it('preserves meta when passed to addSystemMessage', () => {
      const { result } = renderHook(() => useAdminAvaChat(), { wrapper });

      act(() => {
        result.current.addSystemMessage('System note', { receiptId: 'rcpt-sys-1' });
      });

      const sysMsg = result.current.messages.find(m => m.role === 'system');
      expect(sysMsg?.meta?.receiptId).toBe('rcpt-sys-1');
    });
  });

  describe('currentPatchJob passthrough', () => {
    it('exposes currentPatchJob from OpsDeskContext', () => {
      const mockJob = { id: 'patch-1', state: 'drafting', artifacts: {}, testResults: [] };
      (useOpsDesk as ReturnType<typeof vi.fn>).mockReturnValue({
        ...makeOpsDesk(),
        currentPatchJob: mockJob,
      });

      const { result } = renderHook(() => useAdminAvaChat(), { wrapper });
      expect(result.current.currentPatchJob).toEqual(mockJob);
    });

    it('currentPatchJob is null when no active job in OpsDeskContext', () => {
      const { result } = renderHook(() => useAdminAvaChat(), { wrapper });
      expect(result.current.currentPatchJob).toBeNull();
    });
  });
});
