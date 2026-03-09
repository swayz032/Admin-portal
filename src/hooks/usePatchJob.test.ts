/**
 * Tests for usePatchJob hook (Wave 9 Admin Portal Overhaul).
 *
 * Validates:
 * - Returns idle/null state when no currentPatchJob in OpsDeskContext
 * - Correctly maps state strings → PatchJobPhase enum values
 * - Reads description from patchDraftResult, with fallback to artifacts.patchSummary
 * - Reads impactedAreas from patchDraftResult, with fallback to artifacts.impactedFiles
 * - Reads testResults from currentPatchJob
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePatchJob } from './usePatchJob';

// ── Mock OpsDeskContext ────────────────────────────────────────────
vi.mock('@/contexts/OpsDeskContext', () => ({
  useOpsDesk: vi.fn(),
}));

import { useOpsDesk } from '@/contexts/OpsDeskContext';

const makeOpsDesk = (overrides = {}) => ({
  currentPatchJob: null,
  patchDraftResult: null,
  orbState: 'idle',
  setOrbState: vi.fn(),
  addTranscriptEntry: vi.fn(),
  addReceipt: vi.fn(),
  attachments: [],
  ...overrides,
});

const makePatchJob = (overrides = {}) => ({
  id: 'patch-1',
  state: 'drafting',
  artifacts: {
    patchSummary: 'Fix: null pointer in payment handler',
    impactedFiles: ['src/payments.ts', 'src/invoices.ts'],
  },
  testResults: [],
  ...overrides,
});

describe('usePatchJob', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useOpsDesk as ReturnType<typeof vi.fn>).mockReturnValue(makeOpsDesk());
  });

  describe('idle state (no active patch job)', () => {
    it('returns phase=idle when currentPatchJob is null', () => {
      const { result } = renderHook(() => usePatchJob());
      expect(result.current.phase).toBe('idle');
    });

    it('returns jobId=null when no active job', () => {
      const { result } = renderHook(() => usePatchJob());
      expect(result.current.jobId).toBeNull();
    });

    it('returns empty changes array when no active job', () => {
      const { result } = renderHook(() => usePatchJob());
      expect(result.current.changes).toEqual([]);
    });

    it('returns empty testResults when no active job', () => {
      const { result } = renderHook(() => usePatchJob());
      expect(result.current.testResults).toEqual([]);
    });
  });

  describe('phase mapping from state string', () => {
    const cases: Array<[string, string]> = [
      ['pending', 'generating'],
      ['drafting', 'generating'],
      ['tests_running', 'testing'],
      ['tests_passed', 'review'],
      ['tests_failed', 'failed'],
      ['awaiting_approval', 'review'],
    ];

    for (const [state, expectedPhase] of cases) {
      it(`maps state="${state}" → phase="${expectedPhase}"`, () => {
        (useOpsDesk as ReturnType<typeof vi.fn>).mockReturnValue(
          makeOpsDesk({ currentPatchJob: makePatchJob({ state }) })
        );

        const { result } = renderHook(() => usePatchJob());
        expect(result.current.phase).toBe(expectedPhase);
      });
    }

    it('maps unknown state string → phase="idle"', () => {
      (useOpsDesk as ReturnType<typeof vi.fn>).mockReturnValue(
        makeOpsDesk({ currentPatchJob: makePatchJob({ state: 'some_unknown_state' }) })
      );

      const { result } = renderHook(() => usePatchJob());
      expect(result.current.phase).toBe('idle');
    });
  });

  describe('description source priority', () => {
    it('prefers patchDraftResult.description over artifacts.patchSummary', () => {
      (useOpsDesk as ReturnType<typeof vi.fn>).mockReturnValue(
        makeOpsDesk({
          currentPatchJob: makePatchJob({ artifacts: { patchSummary: 'Fallback summary', impactedFiles: [] } }),
          patchDraftResult: { description: 'Draft description takes priority', changes: [], testPlan: null, impactedAreas: null },
        })
      );

      const { result } = renderHook(() => usePatchJob());
      expect(result.current.description).toBe('Draft description takes priority');
    });

    it('falls back to artifacts.patchSummary when patchDraftResult has no description', () => {
      (useOpsDesk as ReturnType<typeof vi.fn>).mockReturnValue(
        makeOpsDesk({
          currentPatchJob: makePatchJob({ artifacts: { patchSummary: 'Artifact summary', impactedFiles: [] } }),
          patchDraftResult: { description: null, changes: [], testPlan: null, impactedAreas: null },
        })
      );

      const { result } = renderHook(() => usePatchJob());
      expect(result.current.description).toBe('Artifact summary');
    });

    it('returns null description when neither source has data', () => {
      (useOpsDesk as ReturnType<typeof vi.fn>).mockReturnValue(
        makeOpsDesk({
          currentPatchJob: makePatchJob({ artifacts: {} }),
          patchDraftResult: null,
        })
      );

      const { result } = renderHook(() => usePatchJob());
      expect(result.current.description).toBeNull();
    });
  });

  describe('impactedAreas source priority', () => {
    it('prefers patchDraftResult.impactedAreas over artifacts.impactedFiles', () => {
      (useOpsDesk as ReturnType<typeof vi.fn>).mockReturnValue(
        makeOpsDesk({
          currentPatchJob: makePatchJob({ artifacts: { impactedFiles: ['a.ts', 'b.ts'] } }),
          patchDraftResult: { description: null, changes: [], testPlan: null, impactedAreas: 'Draft impact area' },
        })
      );

      const { result } = renderHook(() => usePatchJob());
      expect(result.current.impactedAreas).toBe('Draft impact area');
    });

    it('falls back to impactedFiles joined by comma', () => {
      (useOpsDesk as ReturnType<typeof vi.fn>).mockReturnValue(
        makeOpsDesk({
          currentPatchJob: makePatchJob({ artifacts: { impactedFiles: ['src/a.ts', 'src/b.ts'] } }),
          patchDraftResult: null,
        })
      );

      const { result } = renderHook(() => usePatchJob());
      expect(result.current.impactedAreas).toBe('src/a.ts, src/b.ts');
    });
  });

  describe('changes array', () => {
    it('returns changes from patchDraftResult', () => {
      (useOpsDesk as ReturnType<typeof vi.fn>).mockReturnValue(
        makeOpsDesk({
          currentPatchJob: makePatchJob(),
          patchDraftResult: { description: null, changes: ['Add null check', 'Update invoice schema'], testPlan: null, impactedAreas: null },
        })
      );

      const { result } = renderHook(() => usePatchJob());
      expect(result.current.changes).toEqual(['Add null check', 'Update invoice schema']);
    });

    it('returns empty array when patchDraftResult is null', () => {
      (useOpsDesk as ReturnType<typeof vi.fn>).mockReturnValue(
        makeOpsDesk({
          currentPatchJob: makePatchJob(),
          patchDraftResult: null,
        })
      );

      const { result } = renderHook(() => usePatchJob());
      expect(result.current.changes).toEqual([]);
    });
  });

  describe('testResults', () => {
    it('returns testResults from currentPatchJob', () => {
      const testResults = [
        { name: 'Unit: payments', status: 'passed', duration: 250 },
        { name: 'Unit: invoices', status: 'failed' },
      ];

      (useOpsDesk as ReturnType<typeof vi.fn>).mockReturnValue(
        makeOpsDesk({
          currentPatchJob: makePatchJob({ testResults }),
        })
      );

      const { result } = renderHook(() => usePatchJob());
      expect(result.current.testResults).toEqual(testResults);
    });
  });

  describe('jobId', () => {
    it('returns jobId from currentPatchJob.id', () => {
      (useOpsDesk as ReturnType<typeof vi.fn>).mockReturnValue(
        makeOpsDesk({ currentPatchJob: makePatchJob({ id: 'patch-xyz-789' }) })
      );

      const { result } = renderHook(() => usePatchJob());
      expect(result.current.jobId).toBe('patch-xyz-789');
    });
  });
});
