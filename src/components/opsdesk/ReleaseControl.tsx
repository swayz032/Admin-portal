import { useOpsDesk } from '@/contexts/OpsDeskContext';
import { useSystem } from '@/contexts/SystemContext';
import { useState } from 'react';
import { Panel } from '@/components/shared/Panel';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  Loader2,
  FileCheck,
  Rocket,
  MessageSquare,
  RefreshCw,
  Shield,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type ReleaseState = 'not_ready' | 'ready_for_approval' | 'approved' | 'deploying' | 'completed' | 'rolled_back';

export function ReleaseControl() {
  const { systemState, viewMode } = useSystem();
  const {
    currentPatchJob,
    patchDraftResult,
    createdApprovalId,
    createApproval,
    isCreatingApproval,
    addReceipt,
  } = useOpsDesk();
  const approval = createdApprovalId ? { status: 'approved', decisionReason: 'Auto-approved after tests' } : null;
  const robotRuns = [
    { env: 'staging', status: currentPatchJob?.state === 'tests_passed' ? 'passed' : 'pending' },
    { env: 'canary', status: currentPatchJob?.state === 'tests_passed' ? 'passed' : 'pending' },
  ];
  
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [decisionReason, setDecisionReason] = useState('');
  const [releaseStateOverride, setReleaseStateOverride] = useState<ReleaseState | null>(null);
  const [isLaunching, setIsLaunching] = useState(false);
  
  const testsPassed = currentPatchJob?.state === 'tests_passed' || currentPatchJob?.state === 'awaiting_approval';
  const stagingPassed = robotRuns.find(r => r.env === 'staging')?.status === 'passed';
  const canaryPassed = robotRuns.find(r => r.env === 'canary')?.status === 'passed';
  
  const isSafetyModeOn = systemState.safetyMode;
  
  // Determine release state
  const getReleaseState = (): ReleaseState => {
    if (releaseStateOverride) return releaseStateOverride;
    if (approval?.status === 'approved') return 'approved';
    if (testsPassed && stagingPassed && canaryPassed) return 'ready_for_approval';
    return 'not_ready';
  };
  
  const releaseState = getReleaseState();
  
  const getMissingItems = () => {
    const missing: string[] = [];
    if (!patchDraftResult) missing.push('Patch Draft');
    if (!testsPassed) missing.push('Tests');
    if (!stagingPassed) missing.push('Staging Robots');
    if (!canaryPassed) missing.push('Canary Robots');
    return missing;
  };
  
  const handleCreateApproval = async () => {
    await createApproval(decisionReason);
    setApprovalDialogOpen(false);
    setDecisionReason('');
  };
  
  const handleLaunchRelease = async () => {
    setIsLaunching(true);
    setReleaseStateOverride('deploying');
    
    // Simulate deployment stages
    addReceipt({ 
      action: 'Release launched', 
      outcome: 'Success', 
      actor: 'You', 
      summary: 'Release deployment started',
      receiptType: 'release_launched'
    });
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Simulate completion
    setReleaseStateOverride('completed');
    addReceipt({ 
      action: 'Release completed', 
      outcome: 'Success', 
      actor: 'System', 
      summary: 'All environments deployed and verified',
      receiptType: 'release_completed'
    });
    
    setIsLaunching(false);
  };
  
  // Operator-friendly messages
  const getOperatorMessage = () => {
    switch (releaseState) {
      case 'not_ready':
        return `Waiting on: ${getMissingItems().join(', ')}`;
      case 'ready_for_approval':
        return 'All checks passed! Ready for your approval.';
      case 'approved':
        return 'Approved by you. Ready to launch release.';
      case 'deploying':
        return 'Release in progress. Deploying to environments...';
      case 'completed':
        return 'Release completed successfully!';
      case 'rolled_back':
        return 'Release was rolled back. See incident for details.';
      default:
        return '';
    }
  };
  
  return (
    <TooltipProvider>
      <Panel 
        title="Release Control" 
        action={
          <Badge 
            variant="outline" 
            className={cn(
              'text-xs',
              releaseState === 'completed' && 'border-success/30 text-success bg-success/10',
              releaseState === 'rolled_back' && 'border-destructive/30 text-destructive bg-destructive/10',
              releaseState === 'deploying' && 'border-primary/30 text-primary bg-primary/10',
              releaseState === 'approved' && 'border-success/30 text-success bg-success/10',
              releaseState === 'ready_for_approval' && 'border-warning/30 text-warning bg-warning/10',
              releaseState === 'not_ready' && 'border-border text-text-tertiary'
            )}
          >
            {releaseState === 'completed' && <CheckCircle className="h-3 w-3 mr-1" />}
            {releaseState === 'deploying' && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
            {releaseState.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </Badge>
        }
      >
      {/* Safety Mode Warning */}
      {systemState.safetyMode && (
        <div className="p-3 rounded-lg bg-warning/10 border border-warning/30 mb-4 flex items-start gap-2">
          <Shield className="h-4 w-4 text-warning flex-shrink-0 mt-0.5" />
          <p className="text-sm text-warning">
            Safety Mode is ON. Production releases are restricted.
          </p>
        </div>
      )}
      
      {/* Operator Summary */}
      {viewMode === 'operator' && (
        <div className={cn(
          'p-4 rounded-lg mb-4 border',
          releaseState === 'completed' && 'bg-success/10 border-success/30',
          releaseState === 'rolled_back' && 'bg-destructive/10 border-destructive/30',
          releaseState === 'deploying' && 'bg-primary/10 border-primary/30',
          releaseState === 'approved' && 'bg-success/10 border-success/30',
          releaseState === 'ready_for_approval' && 'bg-warning/10 border-warning/30',
          releaseState === 'not_ready' && 'bg-surface-1 border-border'
        )}>
          <p className="text-sm text-text-primary">{getOperatorMessage()}</p>
        </div>
      )}
      
      <div className="space-y-4">
        {/* State 1: Not Ready */}
        {releaseState === 'not_ready' && (
          <>
            <div className="space-y-2">
              {getMissingItems().map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-text-secondary">
                  <Clock className="h-4 w-4 text-text-tertiary" />
                  <span>Waiting on: {item}</span>
                </div>
              ))}
            </div>
            
            <div className="flex flex-col gap-2">
              <Button variant="outline" disabled className="w-full">
                <FileCheck className="h-4 w-4 mr-2" />
                Approve Release
              </Button>
              
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" className="flex-1 text-xs">
                  <MessageSquare className="h-3 w-3 mr-1" />
                  Ask Ava what's blocking
                </Button>
                <Button variant="ghost" size="sm" className="flex-1 text-xs">
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Re-run tests
                </Button>
              </div>
            </div>
          </>
        )}
        
        {/* State 2: Ready for Approval */}
        {releaseState === 'ready_for_approval' && (
          <>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-success">
                <CheckCircle className="h-4 w-4" />
                <span>All tests passed</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-success">
                <CheckCircle className="h-4 w-4" />
                <span>Staging robots verified</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-success">
                <CheckCircle className="h-4 w-4" />
                <span>Canary robots verified</span>
              </div>
            </div>
            
            <Button 
              onClick={() => setApprovalDialogOpen(true)} 
              disabled={isCreatingApproval}
              className="w-full"
              size="lg"
            >
              {isCreatingApproval ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating Approval...
                </>
              ) : (
                <>
                  <FileCheck className="h-4 w-4 mr-2" />
                  Create Approval
                </>
              )}
            </Button>
          </>
        )}
        
        {/* State 3: Approved */}
        {releaseState === 'approved' && (
          <>
            <div className="p-3 rounded-lg bg-success/10 border border-success/30">
              <div className="flex items-center gap-2 text-success mb-2">
                <CheckCircle className="h-4 w-4" />
                <span className="font-medium">Approved</span>
              </div>
              {approval?.decisionReason && (
                <p className="text-sm text-text-secondary">"{approval.decisionReason}"</p>
              )}
            </div>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="block">
                  <Button 
                    onClick={handleLaunchRelease} 
                    disabled={isSafetyModeOn || isLaunching}
                    className="w-full bg-success hover:bg-success/90"
                    size="lg"
                  >
                    {isLaunching ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Deploying...
                      </>
                    ) : (
                      <>
                        <Rocket className="h-4 w-4 mr-2" />
                        Launch Release
                      </>
                    )}
                  </Button>
                </span>
              </TooltipTrigger>
              {isSafetyModeOn && (
                <TooltipContent>
                  <p>Restricted when Safety Mode is ON</p>
                </TooltipContent>
              )}
            </Tooltip>
            
            <p className="text-xs text-text-tertiary text-center">
              Staging → Canary → Full rollout
            </p>
          </>
        )}
        
        {/* State 4: Deploying */}
        {releaseState === 'deploying' && (
          <div className="text-center py-4">
            <Loader2 className="h-12 w-12 text-primary mx-auto mb-3 animate-spin" />
            <h3 className="text-lg font-medium text-text-primary">Deploying...</h3>
            <p className="text-sm text-text-secondary mt-1">
              Release in progress. Deploying to environments.
            </p>
          </div>
        )}
        
        {/* State 5: Completed */}
        {releaseState === 'completed' && (
          <div className="text-center py-4">
            <CheckCircle className="h-12 w-12 text-success mx-auto mb-3" />
            <h3 className="text-lg font-medium text-text-primary">Release Succeeded</h3>
            <p className="text-sm text-text-secondary mt-1">
              All stages completed. Production robots verified.
            </p>
            <div className="mt-4 flex gap-2 justify-center">
              <Button variant="outline" size="sm">
                View Postmortem Draft
              </Button>
              <Button variant="outline" size="sm">
                Draft Customer Update
              </Button>
            </div>
          </div>
        )}
        
        {/* State 6: Rolled Back */}
        {releaseState === 'rolled_back' && (
          <div className="text-center py-4">
            <XCircle className="h-12 w-12 text-destructive mx-auto mb-3" />
            <h3 className="text-lg font-medium text-text-primary">Rollback Executed</h3>
            <p className="text-sm text-text-secondary mt-1">
              Release was rolled back due to production failures.
            </p>
            <div className="mt-4 flex gap-2 justify-center">
              <Button variant="outline" size="sm">
                View Incident
              </Button>
              <Button variant="outline" size="sm">
                View Postmortem Draft
              </Button>
            </div>
          </div>
        )}
      </div>
      
      {/* Approval Dialog */}
      <Dialog open={approvalDialogOpen} onOpenChange={setApprovalDialogOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-text-primary">Create Approval</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-text-secondary">
              You are approving this patch for release. Please provide a reason for the record.
            </p>
            <div className="space-y-2">
              <Label htmlFor="decision-reason">Decision Reason (required)</Label>
              <Textarea
                id="decision-reason"
                value={decisionReason}
                onChange={(e) => setDecisionReason(e.target.value)}
                placeholder="e.g., Reviewed test results, verified rollback plan, acceptable risk..."
                className="bg-surface-1 border-border"
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApprovalDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateApproval} disabled={!decisionReason.trim()}>
              Create Approval
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </Panel>
    </TooltipProvider>
  );
}
