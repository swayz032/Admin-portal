import { useState } from 'react';
import { useOpsDesk, OpsDeskReceipt } from '@/contexts/OpsDeskContext';
import { useSystem } from '@/contexts/SystemContext';
import { Panel } from '@/components/shared/Panel';
import { DataTable } from '@/components/shared/DataTable';
import { StatusChip } from '@/components/shared/StatusChip';
import { ModeDetails } from '@/components/shared/ModeDetails';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { formatDate, formatTimeAgo } from '@/lib/formatters';

export function OpsDeskReceipts() {
  const { receipts } = useOpsDesk();
  const { viewMode } = useSystem();
  const [selectedReceipt, setSelectedReceipt] = useState<OpsDeskReceipt | null>(null);
  
  // Mode-aware columns
  const columns = viewMode === 'operator' ? [
    { 
      key: 'timestamp', 
      header: 'When', 
      render: (r: OpsDeskReceipt) => <span className="text-text-secondary text-xs">{formatTimeAgo(r.timestamp)}</span> 
    },
    { key: 'actor', header: 'Who' },
    { 
      key: 'receiptType', 
      header: 'What happened',
      render: (r: OpsDeskReceipt) => {
        // Translate receipt types to plain English
        const typeMap: Record<string, string> = {
          'voice_session_started': 'Started voice session',
          'attachment_summarized': 'Analyzed attachment',
          'tests_failed': 'Tests failed',
          'tests_passed': 'Tests passed',
          'escalated_to_orchestrator': 'Escalated for review',
          'patch_drafted': 'Created fix draft',
          'approval_created': 'Created approval request',
        };
        return <span>{typeMap[r.receiptType || ''] || r.receiptType}</span>;
      }
    },
    { 
      key: 'outcome', 
      header: 'Result', 
      render: (r: OpsDeskReceipt) => (
        <StatusChip 
          status={r.outcome === 'Success' ? 'success' : r.outcome === 'Blocked' ? 'warning' : 'critical'} 
          label={r.outcome === 'Success' ? 'Done' : r.outcome === 'Blocked' ? 'Stopped' : 'Failed'} 
        />
      ) 
    },
  ] : [
    { 
      key: 'id', 
      header: 'Receipt ID', 
      render: (r: OpsDeskReceipt) => <span className="font-mono text-xs">{r.id}</span> 
    },
    { 
      key: 'timestamp', 
      header: 'Timestamp', 
      render: (r: OpsDeskReceipt) => <span className="text-text-secondary text-xs">{formatDate(r.timestamp)}</span> 
    },
    { key: 'actor', header: 'Actor' },
    { key: 'receiptType', header: 'Receipt Type' },
    { 
      key: 'outcome', 
      header: 'Outcome', 
      render: (r: OpsDeskReceipt) => (
        <StatusChip 
          status={r.outcome === 'Success' ? 'success' : r.outcome === 'Blocked' ? 'warning' : 'critical'} 
          label={r.outcome} 
        />
      ) 
    },
    { 
      key: 'correlationId', 
      header: 'Correlation ID', 
      render: (r: OpsDeskReceipt) => <span className="font-mono text-xs text-text-tertiary">{r.correlationId}</span> 
    },
  ];
  
  return (
    <>
      <Panel 
        title={viewMode === 'operator' ? "Proof Logs" : "Ops Desk Receipts"} 
        noPadding 
        collapsible 
        defaultExpanded
      >
        <DataTable
          columns={columns}
          data={receipts}
          keyExtractor={(r: OpsDeskReceipt) => r.id}
          onRowClick={(r) => setSelectedReceipt(r)}
          emptyMessage={viewMode === 'operator' 
            ? "No activity yet. Actions will appear here as you work."
            : "No receipts yet. Actions will appear here as you use the Ops Desk."}
        />
      </Panel>
      
      {/* Detail Drawer */}
      <Sheet open={!!selectedReceipt} onOpenChange={() => setSelectedReceipt(null)}>
        <SheetContent className="bg-card border-border w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="text-text-primary">
              {viewMode === 'operator' ? (
                'Activity Details'
              ) : (
                <span className="font-mono">{selectedReceipt?.id}</span>
              )}
            </SheetTitle>
          </SheetHeader>
          
          {selectedReceipt && (
            <div className="mt-6 space-y-4">
              {viewMode === 'operator' ? (
                // Operator-friendly view
                <>
                  <div className="p-4 rounded-lg bg-surface-1 border border-border">
                    <Label className="text-xs text-text-tertiary">What happened</Label>
                    <p className="text-sm text-text-primary mt-1">{selectedReceipt.summary}</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 rounded-lg bg-surface-1 border border-border">
                      <Label className="text-xs text-text-tertiary">Who did it</Label>
                      <p className="text-sm mt-1">{selectedReceipt.actor}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-surface-1 border border-border">
                      <Label className="text-xs text-text-tertiary">When</Label>
                      <p className="text-sm text-text-secondary mt-1">{formatTimeAgo(selectedReceipt.timestamp)}</p>
                    </div>
                  </div>
                  
                  <div className="p-3 rounded-lg bg-surface-1 border border-border">
                    <Label className="text-xs text-text-tertiary">Result</Label>
                    <div className="mt-1">
                      <StatusChip 
                        status={selectedReceipt.outcome === 'Success' ? 'success' : selectedReceipt.outcome === 'Blocked' ? 'warning' : 'critical'} 
                        label={selectedReceipt.outcome === 'Success' ? 'Completed successfully' : selectedReceipt.outcome === 'Blocked' ? 'Was stopped' : 'Failed'} 
                      />
                    </div>
                  </div>
                  
                  {selectedReceipt.attachedContext && selectedReceipt.attachedContext.length > 0 && (
                    <div className="p-3 rounded-lg bg-surface-1 border border-border">
                      <Label className="text-xs text-text-tertiary">Related to</Label>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {selectedReceipt.attachedContext.map((ctx, i) => (
                          <span key={i} className="text-xs px-2 py-1 rounded bg-surface-2 text-text-secondary">
                            {ctx}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <ModeDetails
                    summary={<p className="text-xs text-text-tertiary">Technical details available</p>}
                    details={
                      <div className="space-y-3">
                        <div>
                          <Label className="text-xs text-text-tertiary">Tracking ID</Label>
                          <p className="text-xs font-mono text-text-secondary">{selectedReceipt.correlationId}</p>
                        </div>
                        <div>
                          <Label className="text-xs text-text-tertiary">Receipt ID</Label>
                          <p className="text-xs font-mono text-text-secondary">{selectedReceipt.id}</p>
                        </div>
                      </div>
                    }
                    expandLabel="Show technical info"
                    collapseLabel="Hide technical info"
                  />
                </>
              ) : (
                // Engineer view - full technical details
                <>
                  <div>
                    <Label className="text-xs text-text-tertiary">Summary</Label>
                    <p className="text-sm text-text-primary">{selectedReceipt.summary}</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-text-tertiary">Actor</Label>
                      <p className="text-sm">{selectedReceipt.actor}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-text-tertiary">Receipt Type</Label>
                      <p className="text-sm">{selectedReceipt.receiptType}</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-text-tertiary">Outcome</Label>
                      <StatusChip 
                        status={selectedReceipt.outcome === 'Success' ? 'success' : selectedReceipt.outcome === 'Blocked' ? 'warning' : 'critical'} 
                        label={selectedReceipt.outcome} 
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-text-tertiary">Timestamp</Label>
                      <p className="text-sm text-text-secondary">{formatDate(selectedReceipt.timestamp)}</p>
                    </div>
                  </div>
                  
                  <div>
                    <Label className="text-xs text-text-tertiary">Correlation ID</Label>
                    <p className="text-sm font-mono text-text-secondary">{selectedReceipt.correlationId}</p>
                  </div>
                  
                  <div>
                    <Label className="text-xs text-text-tertiary">Attached Context</Label>
                    {selectedReceipt.attachedContext && selectedReceipt.attachedContext.length > 0 ? (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {selectedReceipt.attachedContext.map((ctx, i) => (
                          <span key={i} className="text-xs px-2 py-1 rounded bg-surface-2 text-text-secondary">
                            {ctx}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-text-tertiary">—</p>
                    )}
                  </div>
                  
                  <div>
                    <Label className="text-xs text-text-tertiary">Redacted Inputs</Label>
                    <pre className="text-xs font-mono bg-surface-1 p-2 rounded border border-border overflow-x-auto text-text-secondary">
                      {selectedReceipt.redactedInputs || '—'}
                    </pre>
                  </div>
                  
                  <div>
                    <Label className="text-xs text-text-tertiary">Redacted Outputs</Label>
                    <pre className="text-xs font-mono bg-surface-1 p-2 rounded border border-border overflow-x-auto text-text-secondary">
                      {selectedReceipt.redactedOutputs || '—'}
                    </pre>
                  </div>
                </>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
