/**
 * Patch job lifecycle hook — tracks: generating → review → testing → deploying.
 * Maps to OpsDeskContext.currentPatchJob for backward compat.
 */

import { useOpsDesk } from '@/contexts/OpsDeskContext';

export type PatchJobPhase = 'idle' | 'generating' | 'review' | 'testing' | 'deploying' | 'deployed' | 'failed';

export interface PatchJobState {
  jobId: string | null;
  phase: PatchJobPhase;
  description: string | null;
  changes: string[];
  testPlan: string | null;
  impactedAreas: string | null;
  testResults: Array<{
    name: string;
    status: 'pending' | 'running' | 'passed' | 'failed';
    duration?: number;
  }>;
}

export function usePatchJob(): PatchJobState {
  const { currentPatchJob, patchDraftResult } = useOpsDesk();

  if (!currentPatchJob) {
    return {
      jobId: null,
      phase: 'idle',
      description: null,
      changes: [],
      testPlan: null,
      impactedAreas: null,
      testResults: [],
    };
  }

  const stateToPhase: Record<string, PatchJobPhase> = {
    pending: 'generating',
    drafting: 'generating',
    tests_running: 'testing',
    tests_passed: 'review',
    tests_failed: 'failed',
    awaiting_approval: 'review',
  };

  return {
    jobId: currentPatchJob.id,
    phase: stateToPhase[currentPatchJob.state] || 'idle',
    description: patchDraftResult?.description || currentPatchJob.artifacts?.patchSummary || null,
    changes: patchDraftResult?.changes || [],
    testPlan: patchDraftResult?.testPlan || null,
    impactedAreas: patchDraftResult?.impactedAreas || currentPatchJob.artifacts?.impactedFiles?.join(', ') || null,
    testResults: currentPatchJob.testResults || [],
  };
}
