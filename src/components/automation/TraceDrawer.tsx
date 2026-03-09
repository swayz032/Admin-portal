import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { StatusChip } from '@/components/shared/StatusChip';
import { ModeText } from '@/components/shared/ModeText';
import { ModeDetails } from '@/components/shared/ModeDetails';
import { useSystem } from '@/contexts/SystemContext';
import type { AutomationJob, TraceEvent } from '@/data/automationSeed';
import { useRealtimeReceipts } from '@/hooks/useRealtimeReceipts';
import { SectionLoadingState } from '@/components/shared/PageLoadingState';
import { formatDate, formatTimeAgo } from '@/lib/formatters';
import { 
  Play, 
  CheckCircle, 
  AlertTriangle, 
  Shield, 
  ExternalLink, 
  FileText,
  Clock,
  XCircle
} from 'lucide-react';

interface TraceDrawerProps {
  job: AutomationJob | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function mapReceiptToEventType(action: string): TraceEvent['type'] {
  if (action.includes('start') || action.includes('init')) return 'start';
  if (action.includes('approve') || action.includes('approval')) return 'approval';
  if (action.includes('policy') || action.includes('check')) return 'policy';
  if (action.includes('call') || action.includes('external')) return 'external_call';
  if (action.includes('receipt') || action.includes('proof')) return 'receipt';
  if (action.includes('error') || action.includes('fail')) return 'error';
  if (action.includes('end') || action.includes('complete')) return 'end';
  return 'step';
}

function mapReceiptStatus(status: string): TraceEvent['status'] {
  if (status === 'success' || status === 'completed') return 'success';
  if (status === 'failed' || status === 'error') return 'failed';
  if (status === 'blocked' || status === 'denied') return 'blocked';
  return 'pending';
}

export function TraceDrawer({ job, open, onOpenChange }: TraceDrawerProps) {
  const { viewMode } = useSystem();

  // Query receipts by correlation ID to build trace events
  const { data: receipts, loading: receiptsLoading } = useRealtimeReceipts(
    job ? { correlationId: job.correlationId } : undefined
  );

  if (!job) return null;

  // Map receipts to trace-event-like objects for the timeline
  const events: TraceEvent[] = receipts.map((r, idx) => ({
    id: (r as Record<string, unknown>).id as string ?? `evt-${idx}`,
    traceId: job.traceId,
    timestamp: (r as Record<string, unknown>).timestamp as string ?? (r as Record<string, unknown>).created_at as string ?? new Date().toISOString(),
    type: mapReceiptToEventType((r as Record<string, unknown>).action as string ?? ''),
    title: (r as Record<string, unknown>).action as string ?? (r as Record<string, unknown>).action_type as string ?? 'Action',
    details: (r as Record<string, unknown>).description as string ?? undefined,
    status: mapReceiptStatus((r as Record<string, unknown>).status as string ?? ''),
    actor: (r as Record<string, unknown>).actor as string ?? undefined,
  }));
  
  const getEventIcon = (type: TraceEvent['type']) => {
    switch (type) {
      case 'start': return <Play className="h-3 w-3" />;
      case 'step': return <CheckCircle className="h-3 w-3" />;
      case 'approval': return <Clock className="h-3 w-3" />;
      case 'external_call': return <ExternalLink className="h-3 w-3" />;
      case 'policy': return <Shield className="h-3 w-3" />;
      case 'receipt': return <FileText className="h-3 w-3" />;
      case 'error': return <XCircle className="h-3 w-3" />;
      case 'end': return <CheckCircle className="h-3 w-3" />;
      default: return <CheckCircle className="h-3 w-3" />;
    }
  };
  
  const getEventColor = (status: TraceEvent['status']) => {
    switch (status) {
      case 'success': return 'text-success';
      case 'failed': return 'text-destructive';
      case 'pending': return 'text-warning';
      case 'blocked': return 'text-warning';
      default: return 'text-text-secondary';
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ModeText 
              operator="Task Details" 
              engineer={`Trace: ${job.traceId}`} 
            />
          </SheetTitle>
          <div className="flex items-center gap-2 text-sm text-text-secondary">
            <StatusChip 
              status={
                job.status === 'completed' ? 'success' :
                job.status === 'failed' ? 'critical' :
                job.status === 'blocked' ? 'warning' :
                job.status === 'running' ? 'info' : 'pending'
              }
              label={viewMode === 'operator' 
                ? (job.status === 'completed' ? 'Done' : 
                   job.status === 'failed' ? 'Failed' :
                   job.status === 'blocked' ? 'Blocked' :
                   job.status === 'running' ? 'Running' : 'Waiting')
                : job.status}
            />
          </div>
        </SheetHeader>
        
        <Tabs defaultValue="summary" className="mt-6">
          <TabsList className="w-full">
            <TabsTrigger value="summary" className="flex-1">
              <ModeText operator="Summary" engineer="Summary" />
            </TabsTrigger>
            <TabsTrigger value="approvals" className="flex-1">
              <ModeText operator="Approvals" engineer="Approvals" />
            </TabsTrigger>
            <TabsTrigger value="proof" className="flex-1">
              <ModeText operator="Proof" engineer="Receipts" />
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="summary" className="mt-4 space-y-4">
            {/* Job Info */}
            <div className="p-4 rounded-lg bg-surface-1 border border-border space-y-3">
              {viewMode === 'operator' ? (
                <>
                  <div>
                    <p className="text-xs text-text-tertiary">What it's doing</p>
                    <p className="text-sm">{job.jobDescription}</p>
                  </div>
                  <div>
                    <p className="text-xs text-text-tertiary">For</p>
                    <p className="text-sm">{job.suiteName} • {job.officeName}</p>
                  </div>
                  {job.waitingReason && (
                    <div>
                      <p className="text-xs text-text-tertiary">Why it's waiting</p>
                      <p className="text-sm">{job.waitingReason}</p>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-text-tertiary">Job ID</p>
                      <p className="font-mono">{job.id}</p>
                    </div>
                    <div>
                      <p className="text-text-tertiary">Type</p>
                      <p className="font-mono">{job.jobType}</p>
                    </div>
                    <div>
                      <p className="text-text-tertiary">Correlation ID</p>
                      <p className="font-mono text-xs truncate">{job.correlationId}</p>
                    </div>
                    <div>
                      <p className="text-text-tertiary">Idempotency Key</p>
                      <p className="font-mono text-xs truncate">{job.idempotencyKey}</p>
                    </div>
                    <div>
                      <p className="text-text-tertiary">Suite/Office</p>
                      <p className="font-mono">{job.suiteId}/{job.officeId}</p>
                    </div>
                    <div>
                      <p className="text-text-tertiary">Attempts</p>
                      <p className="font-mono">{job.attempts}/{job.maxAttempts}</p>
                    </div>
                  </div>
                </>
              )}
            </div>
            
            {/* Timeline */}
            <div>
              <h4 className="text-sm font-medium mb-3">
                <ModeText operator="Timeline" engineer="Trace Events" />
              </h4>
              {receiptsLoading ? (
                <SectionLoadingState rows={3} />
              ) : (
              <div className="space-y-2">
                {events.length > 0 ? events.map((event) => (
                  <div 
                    key={event.id}
                    className="flex items-start gap-3 p-3 rounded-lg bg-surface-1 border border-border"
                  >
                    <div className={`mt-0.5 ${getEventColor(event.status)}`}>
                      {getEventIcon(event.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium">{event.title}</p>
                        <span className="text-xs text-text-tertiary whitespace-nowrap">
                          {formatTimeAgo(event.timestamp)}
                        </span>
                      </div>
                      {event.details && (
                        <p className="text-xs text-text-secondary mt-1">{event.details}</p>
                      )}
                      {viewMode === 'engineer' && (
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="outline" className="text-xs">
                            {event.type}
                          </Badge>
                          {event.actor && (
                            <span className="text-xs text-text-tertiary">by {event.actor}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )) : (
                  <p className="text-sm text-text-tertiary text-center py-4">
                    No trace events available
                  </p>
                )}
              </div>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="approvals" className="mt-4">
            <div className="p-4 rounded-lg bg-surface-1 border border-border">
              {job.policyDecisionRef ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      <ModeText operator="Approval Required" engineer="Policy Decision" />
                    </span>
                    <StatusChip status="pending" label={viewMode === 'operator' ? 'Waiting' : 'Pending'} />
                  </div>
                  <p className="text-sm text-text-secondary">
                    {viewMode === 'operator' 
                      ? 'This task needs someone to approve it before it can continue.'
                      : `Policy ref: ${job.policyDecisionRef}`}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-text-tertiary text-center py-4">
                  {viewMode === 'operator' ? 'No approvals needed' : 'No linked approvals'}
                </p>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="proof" className="mt-4">
            <div className="p-4 rounded-lg bg-surface-1 border border-border">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium">
                  <ModeText operator="Proof Status" engineer="Receipt Status" />
                </span>
                <StatusChip 
                  status={
                    job.proofStatus === 'ok' ? 'success' :
                    job.proofStatus === 'missing' ? 'critical' : 'pending'
                  }
                  label={viewMode === 'operator'
                    ? (job.proofStatus === 'ok' ? 'Recorded' : 
                       job.proofStatus === 'missing' ? 'Missing' : 'Pending')
                    : job.proofStatus}
                />
              </div>
              {job.receiptRef ? (
                <p className="text-xs text-text-secondary font-mono">{job.receiptRef}</p>
              ) : (
                <p className="text-sm text-text-tertiary">
                  {viewMode === 'operator' 
                    ? 'Proof will be recorded when the task completes.'
                    : 'No receipt generated yet.'}
                </p>
              )}
            </div>
          </TabsContent>
        </Tabs>
        
        {/* Additional tabs for External calls, Payload, Policy */}
        <Tabs defaultValue="external" className="mt-6">
          <TabsList className="w-full">
            <TabsTrigger value="external" className="flex-1 text-xs">
              <ModeText operator="Calls" engineer="External" />
            </TabsTrigger>
            <TabsTrigger value="payload" className="flex-1 text-xs">
              <ModeText operator="Data" engineer="Payload" />
            </TabsTrigger>
            <TabsTrigger value="policy" className="flex-1 text-xs">
              <ModeText operator="Rules" engineer="Policy" />
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="external" className="mt-4">
            <div className="p-4 rounded-lg bg-surface-1 border border-border">
              <p className="text-sm text-text-tertiary text-center py-4">
                {viewMode === 'operator' 
                  ? 'External service calls will appear here'
                  : 'Provider call log placeholder'}
              </p>
            </div>
          </TabsContent>
          
          <TabsContent value="payload" className="mt-4">
            <div className="p-4 rounded-lg bg-surface-1 border border-border">
              <p className="text-xs text-text-tertiary mb-2">
                {viewMode === 'operator' ? 'Request data (sensitive info hidden)' : 'Redacted Payload'}
              </p>
              <pre className="text-xs font-mono bg-surface-2 p-2 rounded overflow-x-auto">
                {JSON.stringify({ job_type: job.jobType, target: "[REDACTED]" }, null, 2)}
              </pre>
            </div>
          </TabsContent>
          
          <TabsContent value="policy" className="mt-4">
            <div className="p-4 rounded-lg bg-surface-1 border border-border">
              {job.policyDecisionRef ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium">
                    {viewMode === 'operator' ? 'Safety rule applied' : 'Policy Decision'}
                  </p>
                  <p className="text-xs text-text-secondary font-mono">{job.policyDecisionRef}</p>
                  <p className="text-sm text-text-secondary">
                    {viewMode === 'operator'
                      ? 'This task was stopped by a safety rule that requires approval.'
                      : 'Policy blocked execution pending manual approval.'}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-text-tertiary text-center py-4">
                  {viewMode === 'operator' ? 'No safety rules applied' : 'No policy decisions'}
                </p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
