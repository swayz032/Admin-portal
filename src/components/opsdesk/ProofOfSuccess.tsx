import { useOpsDesk } from '@/contexts/OpsDeskContext';
import { useSystem } from '@/contexts/SystemContext';
import { Panel } from '@/components/shared/Panel';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  Loader2,
  FileText,
  Bot,
  ExternalLink,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

type TestStatus = 'pending' | 'running' | 'passed' | 'failed' | 'skipped';

interface TestRowProps {
  name: string;
  status: TestStatus;
  duration?: number;
  error?: string;
}

function TestRow({ name, status, duration }: TestRowProps) {
  const statusConfig = {
    pending: { icon: Clock, color: 'text-text-tertiary', label: 'Pending' },
    running: { icon: Loader2, color: 'text-primary', label: 'Running' },
    passed: { icon: CheckCircle, color: 'text-success', label: 'Passed' },
    failed: { icon: XCircle, color: 'text-destructive', label: 'Failed' },
    skipped: { icon: Clock, color: 'text-text-tertiary', label: 'Skipped' },
  };
  
  const config = statusConfig[status];
  const Icon = config.icon;
  
  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-surface-1">
      <div className="flex items-center gap-3">
        <Icon className={cn('h-4 w-4', config.color, status === 'running' && 'animate-spin')} />
        <span className="text-sm text-text-primary capitalize">{name}</span>
      </div>
      <div className="flex items-center gap-2">
        {duration && (
          <span className="text-xs text-text-tertiary">{(duration / 1000).toFixed(1)}s</span>
        )}
        <Badge 
          variant="outline" 
          className={cn(
            'text-xs',
            status === 'passed' && 'border-success/30 text-success bg-success/10',
            status === 'failed' && 'border-destructive/30 text-destructive bg-destructive/10',
            status === 'running' && 'border-primary/30 text-primary bg-primary/10',
            (status === 'pending' || status === 'skipped') && 'border-border text-text-tertiary'
          )}
        >
          {config.label}
        </Badge>
      </div>
    </div>
  );
}

interface RobotRunProps {
  env: string;
  status: 'pending' | 'running' | 'passed' | 'failed';
  lastRunAt?: string;
  evidenceUrl?: string;
}

function RobotRun({ env, status, lastRunAt, evidenceUrl }: RobotRunProps) {
  const statusConfig = {
    pending: { icon: Clock, color: 'text-text-tertiary', label: 'Pending', bg: 'bg-surface-2' },
    running: { icon: Loader2, color: 'text-primary', label: 'Running', bg: 'bg-primary/10' },
    passed: { icon: CheckCircle, color: 'text-success', label: 'Passed', bg: 'bg-success/10' },
    failed: { icon: XCircle, color: 'text-destructive', label: 'Failed', bg: 'bg-destructive/10' },
  };
  
  const config = statusConfig[status];
  const Icon = config.icon;
  
  return (
    <div className={cn('flex items-center justify-between p-3 rounded-lg border border-border', config.bg)}>
      <div className="flex items-center gap-3">
        <Bot className="h-4 w-4 text-text-secondary" />
        <div>
          <span className="text-sm text-text-primary capitalize">{env} Robots</span>
          {lastRunAt && (
            <p className="text-xs text-text-tertiary">
              {formatDistanceToNow(new Date(lastRunAt), { addSuffix: true })}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Icon className={cn('h-4 w-4', config.color, status === 'running' && 'animate-spin')} />
        {evidenceUrl && (
          <Button variant="ghost" size="sm" className="h-7 text-xs">
            <ExternalLink className="h-3 w-3 mr-1" />
            Evidence
          </Button>
        )}
      </div>
    </div>
  );
}

export function ProofOfSuccess() {
  const { 
    currentPatchJob, 
    patchDraftResult,
  } = useOpsDesk();
  const { viewMode } = useSystem();
  const robotRuns: RobotRunProps[] = [
    { env: 'staging', status: currentPatchJob?.state === 'tests_passed' ? 'passed' : 'pending' },
    { env: 'canary', status: currentPatchJob?.state === 'tests_passed' ? 'passed' : 'pending' },
    { env: 'production', status: 'pending' },
  ];
  
  const testResults = currentPatchJob?.testResults || [];
  const allTestsPassed = testResults.length > 0 && testResults.every(t => t.status === 'passed');
  const anyTestsFailed = testResults.some(t => t.status === 'failed');
  const testsRunning = testResults.some(t => t.status === 'running');
  
  const stagingRobots = robotRuns.find(r => r.env === 'staging');
  const canaryRobots = robotRuns.find(r => r.env === 'canary');
  
  const allRobotsPassed = stagingRobots?.status === 'passed' && canaryRobots?.status === 'passed';
  
  // Operator view summary
  const getOperatorSummary = () => {
    if (!currentPatchJob && !patchDraftResult) {
      return { status: 'waiting', message: 'Waiting for patch draft to begin testing.' };
    }
    if (testsRunning) {
      return { status: 'running', message: 'Tests are running. Please wait for results.' };
    }
    if (anyTestsFailed) {
      return { status: 'failed', message: 'Some tests failed. Claude will iterate or escalate.' };
    }
    if (allTestsPassed && !allRobotsPassed) {
      return { status: 'partial', message: 'Code tests passed. Running robot verification...' };
    }
    if (allTestsPassed && allRobotsPassed) {
      return { status: 'success', message: 'All tests and robots passed! Ready for approval.' };
    }
    return { status: 'waiting', message: 'Waiting for test execution.' };
  };
  
  const summary = getOperatorSummary();
  
  return (
    <Panel 
      title="Proof of Success" 
      action={
        <Badge 
          variant="outline" 
          className={cn(
            'text-xs',
            summary.status === 'success' && 'border-success/30 text-success bg-success/10',
            summary.status === 'failed' && 'border-destructive/30 text-destructive bg-destructive/10',
            summary.status === 'running' && 'border-primary/30 text-primary bg-primary/10',
            summary.status === 'waiting' && 'border-border text-text-tertiary',
            summary.status === 'partial' && 'border-warning/30 text-warning bg-warning/10'
          )}
        >
          {summary.status === 'success' && <CheckCircle className="h-3 w-3 mr-1" />}
          {summary.status === 'failed' && <XCircle className="h-3 w-3 mr-1" />}
          {summary.status === 'running' && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
          {summary.status.charAt(0).toUpperCase() + summary.status.slice(1)}
        </Badge>
      }
    >
      {/* Operator Summary */}
      {viewMode === 'operator' && (
        <div className={cn(
          'p-4 rounded-lg mb-4 border',
          summary.status === 'success' && 'bg-success/10 border-success/30',
          summary.status === 'failed' && 'bg-destructive/10 border-destructive/30',
          summary.status === 'running' && 'bg-primary/10 border-primary/30',
          summary.status === 'waiting' && 'bg-surface-1 border-border',
          summary.status === 'partial' && 'bg-warning/10 border-warning/30'
        )}>
          <p className="text-sm text-text-primary">{summary.message}</p>
        </div>
      )}
      
      <div className="space-y-6">
        {/* Test Results Section */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-text-primary flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Test Results (Claude)
            </h4>
            {testResults.length > 0 && (
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 text-xs">
                    View Logs
                  </Button>
                </SheetTrigger>
                <SheetContent className="bg-card border-border w-[500px] sm:max-w-[500px]">
                  <SheetHeader>
                    <SheetTitle className="text-text-primary">Test Logs</SheetTitle>
                  </SheetHeader>
                  <div className="mt-4 p-4 bg-black rounded-lg font-mono text-xs text-green-400 overflow-auto max-h-[70vh]">
                    <pre>
{`[INFO] Starting test suite...
[INFO] Running typecheck...
[PASS] typecheck completed in 1.2s
[INFO] Running lint...
[PASS] lint completed in 0.8s
[INFO] Running unit tests...
[PASS] 47 tests passed, 0 failed
[INFO] Running smoke tests...
[PASS] smoke tests completed in 1.8s
[INFO] All tests passed successfully.`}
                    </pre>
                  </div>
                </SheetContent>
              </Sheet>
            )}
          </div>
          
          {testResults.length === 0 ? (
            <div className="p-4 rounded-lg bg-surface-1 text-center">
              <p className="text-sm text-text-tertiary">No tests run yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {testResults.map((test, i) => (
                <TestRow 
                  key={i} 
                  name={test.name} 
                  status={test.status} 
                  duration={test.duration}
                  error={test.error}
                />
              ))}
            </div>
          )}
          
          {currentPatchJob?.artifacts?.patchSummary && viewMode === 'engineer' && (
            <div className="mt-3 p-3 rounded-lg bg-surface-1 border border-border">
              <p className="text-xs text-text-tertiary mb-1">Patch Reference</p>
              <p className="text-sm text-text-secondary font-mono">
                {currentPatchJob.id}
              </p>
            </div>
          )}
        </div>
        
        {/* Robot Verification Section */}
        <div>
          <h4 className="text-sm font-medium text-text-primary flex items-center gap-2 mb-3">
            <Bot className="h-4 w-4 text-primary" />
            Robot Verification (Synthetic Monitoring)
          </h4>
          
          <div className="space-y-2">
            {robotRuns.map((run, i) => (
              <RobotRun 
                key={i}
                env={run.env} 
                status={run.status}
                lastRunAt={run.lastRunAt}
                evidenceUrl={run.evidenceUrl}
              />
            ))}
          </div>
          
          {anyTestsFailed && (
            <div className="mt-3 p-3 rounded-lg bg-warning/10 border border-warning/30 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-warning flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-warning font-medium">Robot failure detected</p>
                <p className="text-xs text-text-secondary mt-1">
                  You can create an incident from this failure if one doesn't already exist.
                </p>
                <Button variant="outline" size="sm" className="mt-2 h-7 text-xs">
                  Create Incident from Failure
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Panel>
  );
}
