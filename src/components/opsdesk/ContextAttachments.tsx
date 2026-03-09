import { useOpsDesk, ContextAttachment } from '@/contexts/OpsDeskContext';
import { Panel } from '@/components/shared/Panel';
import { Button } from '@/components/ui/button';
import { X, AlertTriangle, FileCheck, Users, Server, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCustomers, useProviders } from '@/hooks/useAdminData';
import { useRealtimeIncidents } from '@/hooks/useRealtimeIncidents';
import { useRealtimeApprovals } from '@/hooks/useRealtimeApprovals';

const attachmentIcons: Record<ContextAttachment['type'], React.ComponentType<{ className?: string }>> = {
  incident: AlertTriangle,
  approval: FileCheck,
  customer: Users,
  provider: Server,
  timeRange: Clock,
  file: FileCheck,
};

const attachmentColors: Record<ContextAttachment['type'], string> = {
  incident: 'bg-warning/10 border-warning/30 text-warning',
  approval: 'bg-primary/10 border-primary/30 text-primary',
  customer: 'bg-success/10 border-success/30 text-success',
  provider: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
  timeRange: 'bg-purple-500/10 border-purple-500/30 text-purple-400',
  file: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400',
};

export function ContextAttachments() {
  const { attachments, addAttachment, removeAttachment } = useOpsDesk();

  // Real Supabase data
  const { data: allIncidents } = useRealtimeIncidents({ pageSize: 5 });
  const { data: allApprovals } = useRealtimeApprovals({ status: 'Pending', pageSize: 5 });
  const { data: allCustomers } = useCustomers({ pageSize: 5 });
  const { data: allProviders } = useProviders();

  const handleAttachIncident = () => {
    const incident = allIncidents[0];
    if (incident && !attachments.some(a => a.type === 'incident' && a.entityId === incident.id)) {
      addAttachment({
        type: 'incident',
        label: `Incident ${incident.id}`,
        entityId: incident.id,
      });
    }
  };

  const handleAttachApproval = () => {
    const approval = allApprovals[0];
    if (approval && !attachments.some(a => a.type === 'approval' && a.entityId === approval.id)) {
      addAttachment({
        type: 'approval',
        label: `Approval ${approval.id}`,
        entityId: approval.id,
      });
    }
  };

  const handleAttachCustomer = () => {
    const customer = allCustomers[0];
    if (customer && !attachments.some(a => a.type === 'customer' && a.entityId === customer.id)) {
      addAttachment({
        type: 'customer',
        label: customer.name,
        entityId: customer.id,
      });
    }
  };

  const handleAttachProvider = () => {
    const provider = allProviders[0];
    if (provider && !attachments.some(a => a.type === 'provider' && a.entityId === provider.id)) {
      addAttachment({
        type: 'provider',
        label: provider.name,
        entityId: provider.id,
      });
    }
  };

  const handleAttachTimeRange = () => {
    if (!attachments.some(a => a.type === 'timeRange')) {
      addAttachment({
        type: 'timeRange',
        label: 'Last 24 hours',
        entityId: 'last-24h',
      });
    }
  };

  return (
    <Panel title="Context Attachments" collapsible defaultExpanded>
      {/* Attachment buttons */}
      <div className="flex flex-wrap gap-2 mb-4">
        <Button size="sm" variant="outline" onClick={handleAttachIncident} disabled={allIncidents.length === 0}>
          <AlertTriangle className="h-3 w-3 mr-1" />
          Attach Incident
        </Button>
        <Button size="sm" variant="outline" onClick={handleAttachApproval} disabled={allApprovals.length === 0}>
          <FileCheck className="h-3 w-3 mr-1" />
          Attach Approval
        </Button>
        <Button size="sm" variant="outline" onClick={handleAttachCustomer} disabled={allCustomers.length === 0}>
          <Users className="h-3 w-3 mr-1" />
          Attach Customer
        </Button>
        <Button size="sm" variant="outline" onClick={handleAttachProvider} disabled={allProviders.length === 0}>
          <Server className="h-3 w-3 mr-1" />
          Attach Provider
        </Button>
        <Button size="sm" variant="outline" onClick={handleAttachTimeRange}>
          <Clock className="h-3 w-3 mr-1" />
          Attach Time Range
        </Button>
      </div>

      {/* Attached chips */}
      {attachments.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {attachments.map(att => {
            const Icon = attachmentIcons[att.type];
            return (
              <div
                key={att.id}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border',
                  attachmentColors[att.type]
                )}
              >
                <Icon className="h-3 w-3" />
                {att.label}
                <button
                  onClick={() => removeAttachment(att.id)}
                  className="ml-1 hover:opacity-70 transition-opacity"
                  aria-label={`Remove ${att.label}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-text-tertiary text-center py-4">
          No context attached. Attach an incident or customer to begin.
        </p>
      )}
    </Panel>
  );
}
