import { useOpsDesk } from '@/contexts/OpsDeskContext';
import { useSystem } from '@/contexts/SystemContext';
import { Panel } from '@/components/shared/Panel';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RiskBadge } from '@/components/shared/RiskBadge';
import { 
  Sparkles, 
  FileText, 
  Code, 
  TestTube,
  FileCheck,
  Loader2,
  CheckCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface StepCardProps {
  step: number;
  title: string;
  icon: React.ReactNode;
  status: 'pending' | 'active' | 'completed' | 'blocked';
  children: React.ReactNode;
  operatorSummary?: string;
  engineerDetails?: React.ReactNode;
}

function StepCard({ step, title, icon, status, children, operatorSummary, engineerDetails }: StepCardProps) {
  const { viewMode } = useSystem();
  const [expanded, setExpanded] = useState(status === 'active' || status === 'completed');
  
  const statusConfig = {
    pending: { bg: 'bg-surface-1', border: 'border-border', badge: 'Pending' },
    active: { bg: 'bg-primary/5', border: 'border-primary/30', badge: 'In Progress' },
    completed: { bg: 'bg-success/5', border: 'border-success/30', badge: 'Complete' },
    blocked: { bg: 'bg-warning/5', border: 'border-warning/30', badge: 'Blocked' },
  };
  
  const config = statusConfig[status];
  
  return (
    <div className={cn('rounded-lg border transition-all', config.bg, config.border)}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 text-left"
      >
        <div className="flex items-center gap-3">
          <div className={cn(
            'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium',
            status === 'completed' && 'bg-success text-success-foreground',
            status === 'active' && 'bg-primary text-primary-foreground',
            status === 'pending' && 'bg-surface-2 text-text-secondary',
            status === 'blocked' && 'bg-warning text-warning-foreground'
          )}>
            {status === 'completed' ? <CheckCircle className="h-4 w-4" /> : step}
          </div>
          <div className="flex items-center gap-2">
            {icon}
            <span className="font-medium text-text-primary">{title}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge 
            variant="outline" 
            className={cn(
              'text-xs',
              status === 'completed' && 'border-success/30 text-success',
              status === 'active' && 'border-primary/30 text-primary',
              status === 'pending' && 'border-border text-text-tertiary',
              status === 'blocked' && 'border-warning/30 text-warning'
            )}
          >
            {config.badge}
          </Badge>
          {expanded ? <ChevronUp className="h-4 w-4 text-text-tertiary" /> : <ChevronDown className="h-4 w-4 text-text-tertiary" />}
        </div>
      </button>
      
      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {viewMode === 'operator' && operatorSummary && (
            <div className="p-3 rounded-lg bg-surface-1 border border-border">
              <p className="text-sm text-text-secondary">{operatorSummary}</p>
            </div>
          )}
          {children}
          {viewMode === 'engineer' && engineerDetails}
        </div>
      )}
    </div>
  );
}

export function PipelineSteps() {
  const {
    analysisResult,
    fixPlanResult,
    patchDraftResult,
    currentPatchJob,
    createdApprovalId,
    runAnalysis,
    runFixPlan,
    runPatchDraft,
    isAnalyzing,
    isGeneratingPlan,
    isDraftingPatch,
    automationMode,
  } = useOpsDesk();
  
  const getStepStatus = (stepNum: number) => {
    if (stepNum === 1) {
      if (analysisResult) return 'completed';
      if (isAnalyzing) return 'active';
      return 'pending';
    }
    if (stepNum === 2) {
      if (fixPlanResult) return 'completed';
      if (isGeneratingPlan) return 'active';
      if (!analysisResult) return 'pending';
      return 'pending';
    }
    if (stepNum === 3) {
      if (patchDraftResult) return 'completed';
      if (isDraftingPatch) return 'active';
      if (automationMode === 'advisory') return 'blocked';
      if (!fixPlanResult) return 'pending';
      return 'pending';
    }
    if (stepNum === 4) {
      if (currentPatchJob?.state === 'tests_passed') return 'completed';
      if (currentPatchJob?.state === 'tests_running') return 'active';
      if (!patchDraftResult) return 'pending';
      return 'pending';
    }
    if (stepNum === 5) {
      if (createdApprovalId) return 'completed';
      return 'pending';
    }
    return 'pending';
  };
  
  return (
    <Panel title="Pipeline (Step 1–5)" collapsible defaultExpanded>
      <div className="space-y-3">
        {/* Step 1: Analyze */}
        <StepCard
          step={1}
          title="Analyze (Ava)"
          icon={<Sparkles className="h-4 w-4 text-primary" />}
          status={getStepStatus(1)}
          operatorSummary={
            analysisResult 
              ? `Summary: ${analysisResult.summary.substring(0, 150)}...`
              : 'Ava will read logs and explain what happened in plain English.'
          }
          engineerDetails={
            analysisResult && (
              <div className="space-y-2 text-xs font-mono bg-black/50 p-3 rounded">
                <div>
                  <span className="text-text-tertiary">Suspected Cause:</span>
                  <p className="text-text-secondary">{analysisResult.suspectedCause}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-text-tertiary">Confidence:</span>
                  <RiskBadge risk={analysisResult.confidence === 'High' ? 'Low' : analysisResult.confidence === 'Low' ? 'High' : 'Medium'} />
                </div>
              </div>
            )
          }
        >
          <Button 
            onClick={runAnalysis} 
            disabled={isAnalyzing || !!analysisResult}
            className="w-full"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : analysisResult ? (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Analysis Complete
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Start Analysis
              </>
            )}
          </Button>
        </StepCard>
        
        {/* Step 2: Fix Plan */}
        <StepCard
          step={2}
          title="Fix Plan (Ava)"
          icon={<FileText className="h-4 w-4 text-primary" />}
          status={getStepStatus(2)}
          operatorSummary={
            fixPlanResult 
              ? `${fixPlanResult.steps.length} steps planned. Risk: ${fixPlanResult.riskRating}.`
              : 'Ava will create a step-by-step plan to fix the issue.'
          }
          engineerDetails={
            fixPlanResult && (
              <div className="space-y-2 text-xs font-mono bg-black/50 p-3 rounded">
                <div>
                  <span className="text-text-tertiary">Steps:</span>
                  <ul className="list-disc list-inside text-text-secondary">
                    {fixPlanResult.steps.slice(0, 3).map((s, i) => (
                      <li key={i}>{s.replace(/^\d+\.\s*/, '')}</li>
                    ))}
                    {fixPlanResult.steps.length > 3 && <li>...and {fixPlanResult.steps.length - 3} more</li>}
                  </ul>
                </div>
                <div>
                  <span className="text-text-tertiary">Rollback:</span>
                  <p className="text-text-secondary">{fixPlanResult.rollbackPlan}</p>
                </div>
              </div>
            )
          }
        >
          <Button 
            onClick={runFixPlan} 
            disabled={!analysisResult || isGeneratingPlan || !!fixPlanResult}
            className="w-full"
          >
            {isGeneratingPlan ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating Plan...
              </>
            ) : fixPlanResult ? (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Plan Complete
              </>
            ) : (
              <>
                <FileText className="h-4 w-4 mr-2" />
                Generate Fix Plan
              </>
            )}
          </Button>
          {!analysisResult && (
            <p className="text-xs text-text-tertiary mt-2">Complete analysis first</p>
          )}
        </StepCard>
        
        {/* Step 3: Draft Patch */}
        <StepCard
          step={3}
          title="Draft Patch (Claude)"
          icon={<Code className="h-4 w-4 text-success" />}
          status={getStepStatus(3)}
          operatorSummary={
            patchDraftResult 
              ? `Patch ready. ${currentPatchJob?.artifacts?.impactedFiles?.length || 0} files modified.`
              : automationMode === 'advisory'
              ? 'Blocked: Advisory mode only allows analysis and planning.'
              : 'Claude will write the code changes in a safe sandbox.'
          }
          engineerDetails={
            patchDraftResult && (
              <div className="space-y-2 text-xs font-mono bg-black/50 p-3 rounded">
                <div>
                  <span className="text-text-tertiary">Files:</span>
                  <p className="text-text-secondary">{patchDraftResult.impactedAreas}</p>
                </div>
                <div>
                  <span className="text-text-tertiary">Job ID:</span>
                  <p className="text-text-secondary">{currentPatchJob?.id}</p>
                </div>
              </div>
            )
          }
        >
          {automationMode === 'advisory' && (
            <div className="p-2 rounded bg-warning/10 border border-warning/30 flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <span className="text-xs text-warning">Advisory mode: Patching disabled</span>
            </div>
          )}
          <Button 
            onClick={runPatchDraft} 
            disabled={!fixPlanResult || isDraftingPatch || !!patchDraftResult || automationMode === 'advisory'}
            className="w-full"
          >
            {isDraftingPatch ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Drafting Patch...
              </>
            ) : patchDraftResult ? (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Patch Ready
              </>
            ) : (
              <>
                <Code className="h-4 w-4 mr-2" />
                Draft Patch (Claude)
              </>
            )}
          </Button>
        </StepCard>
        
        {/* Step 4: Run Tests */}
        <StepCard
          step={4}
          title="Run Tests"
          icon={<TestTube className="h-4 w-4 text-primary" />}
          status={getStepStatus(4)}
          operatorSummary={
            currentPatchJob?.state === 'tests_passed'
              ? 'All tests passed! Ready for robot verification.'
              : currentPatchJob?.state === 'tests_running'
              ? 'Tests running in sandbox environment...'
              : 'Automated tests will verify the patch works correctly.'
          }
        >
          <div className="space-y-2">
            {currentPatchJob?.testResults?.map((test, i) => (
              <div key={i} className="flex items-center justify-between p-2 rounded bg-surface-1">
                <span className="text-sm text-text-secondary capitalize">{test.name}</span>
                <Badge 
                  variant="outline" 
                  className={cn(
                    'text-xs',
                    test.status === 'passed' && 'border-success/30 text-success',
                    test.status === 'failed' && 'border-destructive/30 text-destructive',
                    test.status === 'running' && 'border-primary/30 text-primary',
                    test.status === 'pending' && 'border-border text-text-tertiary'
                  )}
                >
                  {test.status === 'running' && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                  {test.status}
                </Badge>
              </div>
            )) || (
              <p className="text-sm text-text-tertiary text-center py-4">
                Tests will run after patch is drafted
              </p>
            )}
          </div>
        </StepCard>
        
        {/* Step 5: Approval */}
        <StepCard
          step={5}
          title="Approval"
          icon={<FileCheck className="h-4 w-4 text-primary" />}
          status={getStepStatus(5)}
          operatorSummary={
            createdApprovalId
              ? `Approval ${createdApprovalId} created. Proceed to Release Control.`
              : 'Once tests pass, an approval record will be created automatically.'
          }
        >
          {createdApprovalId ? (
            <div className="p-3 rounded bg-success/10 border border-success/30">
              <div className="flex items-center gap-2 text-success">
                <CheckCircle className="h-4 w-4" />
                <span className="font-medium">Approval {createdApprovalId}</span>
              </div>
              <p className="text-xs text-text-secondary mt-1">
                Created automatically after tests passed.
              </p>
            </div>
          ) : (
            <p className="text-sm text-text-tertiary text-center py-4">
              Awaiting successful test completion
            </p>
          )}
        </StepCard>
      </div>
    </Panel>
  );
}
