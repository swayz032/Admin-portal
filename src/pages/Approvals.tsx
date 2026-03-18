import { useState, useEffect } from 'react';
import { PageHero } from '@/components/shared/PageHero';
import { QuickStats } from '@/components/shared/QuickStats';
import { WhatToDoSection, ActionItem } from '@/components/shared/WhatToDoSection';
import { InsightPanel } from '@/components/shared/InsightPanel';
import { Panel } from '@/components/shared/Panel';
import { DataTable } from '@/components/shared/DataTable';
import { StatusChip } from '@/components/shared/StatusChip';
import { RiskBadge } from '@/components/shared/RiskBadge';
import { PurposeStrip } from '@/components/shared/PurposeStrip';
import { SystemPipelineCard } from '@/components/shared/SystemPipelineCard';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { Approval, Receipt } from '@/data/seed';
import { useRealtimeApprovals } from '@/hooks/useRealtimeApprovals';
import { useRealtimeReceipts } from '@/hooks/useRealtimeReceipts';
import { submitApprovalDecision } from '@/services/opsFacadeClient';
import { devError } from '@/lib/devLog';
import { toast } from 'sonner';
import { PageLoadingState } from '@/components/shared/PageLoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { formatDate, formatTimeAgo } from '@/lib/formatters';
import { Check, X, FileText, Link as LinkIcon, Shield, CheckCircle, ChevronDown } from 'lucide-react';
import { useSystem } from '@/contexts/SystemContext';
import { ModeText } from '@/components/shared/ModeText';
import { ModeDetails } from '@/components/shared/ModeDetails';

export default function Approvals() {
  const { viewMode, systemState } = useSystem();
  const { data: initialApprovals, loading: approvalsLoading, error: approvalsError, refetch: refetchApprovals } = useRealtimeApprovals();
  const { data: fetchedReceipts } = useRealtimeReceipts();
  const [approvalsData, setApprovalsData] = useState<Approval[]>([]);
  const [localReceipts, setLocalReceipts] = useState<Receipt[]>([]);
  const [selectedApproval, setSelectedApproval] = useState<Approval | null>(null);

  // Sync hook data into local state when it arrives
  useEffect(() => {
    if (initialApprovals.length > 0) setApprovalsData(initialApprovals);
  }, [initialApprovals]);
  useEffect(() => {
    if (fetchedReceipts.length > 0) setLocalReceipts(fetchedReceipts);
  }, [fetchedReceipts]);
  const [approvalDialog, setApprovalDialog] = useState<{ approval: Approval; action: 'approve' | 'deny' } | null>(null);
  const [decisionReason, setDecisionReason] = useState('');
  const [showAllItems, setShowAllItems] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (approvalsLoading) return <PageLoadingState showKPIs rows={5} />;
  if (approvalsError) return <EmptyState variant="error" title="Failed to load approvals" description={approvalsError} actionLabel="Retry" onAction={refetchApprovals} />;

  const pendingApprovals = approvalsData.filter(a => a.status === 'Pending');
  const approvedApprovals = approvalsData.filter(a => a.status === 'Approved');
  const deniedApprovals = approvalsData.filter(a => a.status === 'Denied');

  const handleApprovalDecision = async () => {
    if (!approvalDialog) return;

    const decision = approvalDialog.action === 'approve' ? 'approved' : 'denied';
    const newStatus = approvalDialog.action === 'approve' ? 'Approved' : 'Denied';

    setIsSubmitting(true);
    try {
      // Call backend — server generates receipt (Law #2)
      const result = await submitApprovalDecision(
        approvalDialog.approval.id,
        decision as 'approved' | 'denied',
        decisionReason || undefined,
      );

      // Optimistic UI update after successful backend call
      setApprovalsData(prev => prev.map(a =>
        a.id === approvalDialog.approval.id
          ? { ...a, status: newStatus as Approval['status'], decisionReason }
          : a
      ));

      if (selectedApproval?.id === approvalDialog.approval.id) {
        setSelectedApproval(prev => prev ? { ...prev, status: newStatus as Approval['status'], decisionReason } : null);
      }

      // Server receipt will arrive via Realtime subscription.
      // Add local receipt for immediate UI feedback.
      const newReceipt: Receipt = {
        id: result.receipt_id || `RCP-${Date.now()}`,
        timestamp: new Date().toISOString(),
        runId: `run-${Date.now()}`,
        correlationId: `corr-${approvalDialog.approval.id}`,
        actor: 'You',
        actionType: `Approval ${newStatus}`,
        outcome: 'Success',
        provider: 'Internal',
        providerCallId: '',
        redactedRequest: `{"approvalId": "${approvalDialog.approval.id}", "action": "${approvalDialog.action}"}`,
        redactedResponse: `{"status": "${newStatus}", "reason": "[REDACTED]"}`,
        linkedIncidentId: approvalDialog.approval.linkedIncidentId,
        linkedApprovalId: approvalDialog.approval.id,
        linkedCustomerId: null,
      };
      setLocalReceipts(prev => [newReceipt, ...prev]);
    } catch (err) {
      // Fail closed (Law #3): backend error = decision NOT persisted, show error
      devError('Approval decision failed:', err);
      toast.error('Decision failed', {
        description: 'The approval decision could not be saved. Please try again.',
      });
      // Refetch to get authoritative state
      refetchApprovals();
    } finally {
      setIsSubmitting(false);
      setApprovalDialog(null);
      setDecisionReason('');
    }
  };

  const relatedReceipts = selectedApproval
    ? localReceipts.filter(r => (selectedApproval.evidenceReceiptIds ?? []).includes(r.id) || r.linkedApprovalId === selectedApproval.id)
    : [];

  const isSafetyModeOn = systemState.safetyMode;

  // Build priority actions from pending approvals
  const priorityActions: ActionItem[] = pendingApprovals.map(a => ({
    id: a.id,
    title: a.summary,
    description: `${a.type} • ${a.customer}`,
    urgency: a.risk === 'High' ? 'critical' as const : a.risk === 'Medium' ? 'high' as const : 'medium' as const,
    linkTo: `/approvals?id=${a.id}`,
    linkLabel: 'Review',
  }));

  // Stats for quick overview
  const quickStats = [
    { label: 'pending', value: pendingApprovals.length, status: pendingApprovals.length > 0 ? 'warning' as const : 'success' as const },
    { label: 'high risk', value: pendingApprovals.filter(a => a.risk === 'High').length, status: 'critical' as const },
    { label: 'approved today', value: approvedApprovals.length, status: 'success' as const },
  ];

  // Columns for table
  const columns = viewMode === 'operator' ? [
    { key: 'risk', header: 'Risk', render: (a: Approval) => <RiskBadge risk={a.risk} /> },
    { key: 'type', header: 'Type' },
    { key: 'customer', header: 'Customer' },
    { key: 'summary', header: 'What is being requested', className: 'max-w-xs truncate' },
    { key: 'requestedAt', header: 'When', render: (a: Approval) => <span className="text-muted-foreground">{formatTimeAgo(a.requestedAt)}</span> },
    { 
      key: 'status', 
      header: 'Status', 
      render: (a: Approval) => (
        <StatusChip 
          status={a.status === 'Pending' ? 'pending' : a.status === 'Approved' ? 'success' : 'critical'} 
          label={a.status} 
        />
      ) 
    },
  ] : [
    { key: 'id', header: 'Approval ID', render: (a: Approval) => <span className="font-mono text-xs">{a.id}</span> },
    { key: 'risk', header: 'Risk', render: (a: Approval) => <RiskBadge risk={a.risk} /> },
    { key: 'type', header: 'Type' },
    { key: 'customer', header: 'Customer/Tenant' },
    { key: 'summary', header: 'Summary', className: 'max-w-xs truncate' },
    { key: 'requestedAt', header: 'Requested', render: (a: Approval) => <span className="text-muted-foreground">{formatTimeAgo(a.requestedAt)}</span> },
    { 
      key: 'status', 
      header: 'Status', 
      render: (a: Approval) => (
        <StatusChip 
          status={a.status === 'Pending' ? 'pending' : a.status === 'Approved' ? 'success' : 'critical'} 
          label={a.status} 
        />
      ) 
    },
  ];

  return (
    <TooltipProvider>
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Hero Section */}
        <PageHero
          title={pendingApprovals.length === 0 
            ? "You're all caught up!" 
            : `${pendingApprovals.length} decision${pendingApprovals.length !== 1 ? 's' : ''} waiting for you`}
          subtitle={viewMode === 'operator' 
            ? "Review and approve or deny requests that need your attention" 
            : "Review and manage pending approval requests"}
          icon={<CheckCircle className="h-6 w-6" />}
          status={pendingApprovals.length === 0 
            ? { type: 'success', label: 'All done' }
            : { type: 'warning', label: `${pendingApprovals.length} pending` }}
        />

        {/* Purpose Strip */}
        <PurposeStrip
          operatorPurpose="Approve or deny requests that affect your system. Higher-priority items appear first."
          engineerPurpose="AuthorityQueue items pending decision. Each approval creates a Receipt for audit trail."
          operatorAction="Review high-risk items first, then work through the queue"
          engineerObjects={['AuthorityQueueItem', 'Receipt']}
          variant="compact"
        />

        {/* System Pipeline */}
        <SystemPipelineCard variant="compact" highlightStep={2} />

        {/* Quick Stats */}
        <QuickStats stats={quickStats} />

        {/* What to Do Section */}
        {priorityActions.length > 0 && (
          <WhatToDoSection
            title={viewMode === 'operator' ? "Decisions to make" : "Pending approvals"}
            subtitle={`${priorityActions.length} request${priorityActions.length !== 1 ? 's' : ''} need your attention`}
            actions={priorityActions}
            maxItems={5}
          />
        )}

        {/* Story Insights */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <InsightPanel
            headline={`You've approved ${approvedApprovals.length} requests`}
            subtext="This week"
            trend="positive"
            icon={<Check className="h-5 w-5" />}
          />
          <InsightPanel
            headline={pendingApprovals.filter(a => a.risk === 'High').length === 0 
              ? "No high-risk requests" 
              : `${pendingApprovals.filter(a => a.risk === 'High').length} high-risk pending`}
            subtext={pendingApprovals.filter(a => a.risk === 'High').length === 0 
              ? "Everything looks safe" 
              : "Requires careful review"}
            trend={pendingApprovals.filter(a => a.risk === 'High').length === 0 ? 'positive' : 'negative'}
            icon={<Shield className="h-5 w-5" />}
          />
          <InsightPanel
            headline="Average response time"
            subtext="2 hours this week"
            value="2h"
            trend="positive"
          />
        </div>

        {/* Collapsible Detail Table */}
        <Collapsible open={showAllItems} onOpenChange={setShowAllItems}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="w-full flex items-center justify-between">
              <span>{viewMode === 'operator' ? 'View all requests' : 'View all approvals'}</span>
              <ChevronDown className={`h-4 w-4 transition-transform ${showAllItems ? 'rotate-180' : ''}`} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-4">
            <Panel noPadding>
              <DataTable
                columns={columns}
                data={approvalsData}
                keyExtractor={(a: Approval) => a.id}
                onRowClick={(a) => setSelectedApproval(a)}
                emptyMessage={viewMode === 'operator' ? "No decisions needed right now." : "No approvals in this category."}
              />
            </Panel>
          </CollapsibleContent>
        </Collapsible>

        {/* Selected Approval Detail Dialog */}
        <Dialog open={!!selectedApproval} onOpenChange={() => setSelectedApproval(null)}>
          <DialogContent className="bg-card border-border max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-foreground">
                {viewMode === 'operator' ? "Request Details" : "Approval Details"}
              </DialogTitle>
            </DialogHeader>
            {selectedApproval && (
              <div className="space-y-4">
                <div>
                  <Label className="text-muted-foreground text-xs">What is being requested</Label>
                  <p className="text-sm">{selectedApproval.summary}</p>
                </div>
                <div className="flex items-center gap-4">
                  <div>
                    <Label className="text-muted-foreground text-xs">Risk Level</Label>
                    <div className="mt-1"><RiskBadge risk={selectedApproval.risk} /></div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Status</Label>
                    <div className="mt-1">
                      <StatusChip 
                        status={selectedApproval.status === 'Pending' ? 'pending' : selectedApproval.status === 'Approved' ? 'success' : 'critical'} 
                        label={selectedApproval.status}
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Customer</Label>
                  <p className="text-sm">{selectedApproval.customer}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Requested By</Label>
                  <p className="text-sm">{selectedApproval.requestedBy}</p>
                </div>

                {selectedApproval.status === 'Pending' && (
                  <div className="pt-4 border-t border-border space-y-2">
                    {isSafetyModeOn && (
                      <div className="p-2 rounded bg-warning/10 border border-warning/30 flex items-center gap-2 mb-2">
                        <Shield className="h-4 w-4 text-warning" />
                        <span className="text-xs text-warning">Safety Mode is ON - actions restricted</span>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button 
                        className="flex-1"
                        onClick={() => setApprovalDialog({ approval: selectedApproval, action: 'approve' })}
                        disabled={isSafetyModeOn}
                      >
                        <Check className="h-4 w-4 mr-2" />
                        Approve
                      </Button>
                      <Button 
                        variant="outline" 
                        className="flex-1 text-destructive border-destructive/30 hover:bg-destructive/10"
                        onClick={() => setApprovalDialog({ approval: selectedApproval, action: 'deny' })}
                        disabled={isSafetyModeOn}
                      >
                        <X className="h-4 w-4 mr-2" />
                        Deny
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Decision Dialog */}
        <Dialog open={!!approvalDialog} onOpenChange={() => setApprovalDialog(null)}>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle className="text-foreground">
                {approvalDialog?.action === 'approve' ? 'Approve Request' : 'Deny Request'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {viewMode === 'operator' 
                  ? `You are about to ${approvalDialog?.action} this request for ${approvalDialog?.approval.customer}.`
                  : `Confirm ${approvalDialog?.action} for approval ${approvalDialog?.approval.id}`}
              </p>
              <div className="space-y-2">
                <Label>{viewMode === 'operator' ? 'Add a note (optional)' : 'Decision Reason (optional)'}</Label>
                <Textarea 
                  placeholder={viewMode === 'operator' ? "Why are you making this decision?" : "Enter reason for audit trail..."} 
                  value={decisionReason}
                  onChange={(e) => setDecisionReason(e.target.value)}
                  className="bg-muted border-border"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setApprovalDialog(null)}>
                Cancel
              </Button>
              <Button
                onClick={handleApprovalDecision}
                disabled={isSubmitting}
                className={approvalDialog?.action === 'deny' ? 'bg-destructive hover:bg-destructive/90' : ''}
              >
                {isSubmitting ? 'Submitting...' : approvalDialog?.action === 'approve' ? 'Approve' : 'Deny'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
