import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  CheckSquare,
  DatabaseZap,
  Mail,
  ReceiptText,
  ServerCog,
  ShieldAlert,
  User,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  StoryActionQueue,
  StoryBrief,
  StoryEvidencePanel,
  StoryMetricCard,
  type StoryActionItem,
} from '@/components/story/StoryPrimitives';
import { PageLoadingState } from '@/components/shared/PageLoadingState';
import { useApprovals } from '@/hooks/useAdminData';
import { useRealtimeCustomers } from '@/hooks/useRealtimeCustomers';
import { useRealtimeReceipts } from '@/hooks/useRealtimeReceipts';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { useUnifiedIncidents } from '@/hooks/useUnifiedIncidents';
import { listProviderCallLogs, derivePremiumActionLabel } from '@/services/apiClient';
import type { ProviderCallLog } from '@/contracts';
import { formatCurrency, formatLatency, formatTimeAgo } from '@/lib/formatters';
import { classifyIncident, explainIncident } from '@/lib/storyTriage';
import {
  approvalBelongsToCustomer,
  incidentBelongsToCustomer,
  normalizeIdentity,
  providerCallBelongsToCustomer,
  receiptBelongsToCustomer,
} from '@/lib/customerIdentity';
import { setSentryAdminContext } from '@/lib/sentry';

function receiptCause(provider: string, outcome: string, action: string): string {
  if (outcome === 'Success') return `${provider || 'Internal'} completed ${action} for this company.`;
  return `${provider || 'Internal'} returned ${outcome.toLowerCase()} while Aspire attempted ${action} for this company.`;
}

function providerCause(provider: string, status: string, action: string): string {
  if (status === 'success') return `${provider || 'Provider'} completed ${action} for this company.`;
  return `${provider || 'Provider'} returned ${status} during ${action}.`;
}

export default function UserDetail() {
  const { id = '' } = useParams();
  const { data: customers, loading: customersLoading } = useRealtimeCustomers({ pageSize: 500 });
  const { data: approvals, loading: approvalsLoading } = useApprovals();
  const { data: incidents, loading: incidentsLoading } = useUnifiedIncidents();
  const { data: receipts, loading: receiptsLoading } = useRealtimeReceipts({ pageSize: 500 });
  const { data: providerCalls, loading: providerCallsLoading } = useRealtimeSubscription<ProviderCallLog>({
    table: 'provider_call_log',
    events: ['INSERT', 'UPDATE'],
    fetcher: () => listProviderCallLogs(),
    getKey: (item) => item.id,
  });

  const loading = customersLoading && approvalsLoading && incidentsLoading && receiptsLoading && providerCallsLoading;
  const customer = customers.find((item) =>
    item.id === id ||
    item.displayId === id ||
    item.officeDisplayId === id ||
    encodeURIComponent(item.id) === id,
  );

  useEffect(() => {
    if (!customer) return;
    setSentryAdminContext({
      route: '/users/:id',
      surface: 'company_health',
      suiteId: customer.id,
      suiteDisplayId: customer.displayId,
    });
  }, [customer?.displayId, customer?.id]);

  if (loading) return <PageLoadingState showKPIs kpiCount={4} rows={6} />;

  if (!customer) {
    return (
      <div className="story-shell">
        <StoryBrief
          eyebrow="User Detail"
          title="User company not found"
          summary="The selected company is not visible to this admin session or the route id is stale."
          primaryAction={{ label: 'Back to Users', to: '/users' }}
        />
      </div>
    );
  }

  const relatedApprovals = approvals.filter((approval) => approvalBelongsToCustomer(approval, customer));
  const relatedReceipts = receipts.filter((receipt) => receiptBelongsToCustomer(receipt, customer));
  const relatedTraceIds = new Set(
    relatedReceipts
      .map((receipt) => normalizeIdentity(receipt.correlationId))
      .filter(Boolean),
  );
  const relatedIncidents = incidents.filter((incident) =>
    incidentBelongsToCustomer(incident, customer, relatedTraceIds),
  );
  const relatedProviderCalls = providerCalls.filter((call) =>
    providerCallBelongsToCustomer(call, customer, relatedTraceIds),
  );

  const failedReceipts = relatedReceipts.filter((receipt) => receipt.outcome !== 'Success');
  const openIncidents = relatedIncidents.filter((incident) => incident.status === 'Open');
  const pendingApprovals = relatedApprovals.filter((approval) => approval.status === 'Pending');
  const latestActivity = [
    customer.lastActivity,
    ...relatedReceipts.map((receipt) => receipt.timestamp),
    ...relatedIncidents.map((incident) => incident.updatedAt),
    ...relatedProviderCalls.map((call) => call.started_at),
  ].filter(Boolean).sort().at(-1);

  const actionItems: StoryActionItem[] = [
    ...pendingApprovals.map((approval) => ({
      id: `approval-${approval.id}`,
      title: approval.summary || `${approval.type} approval waiting`,
      description: `${approval.risk} risk approval affects this company story.`,
      cause: `${approval.requestedBy || 'A workflow'} requested approval before continuing ${approval.type}.`,
      fix: 'Review the evidence, approve or deny the request, then let the user-facing workflow continue.',
      meta: approval.requestedAt ? formatTimeAgo(approval.requestedAt) : 'No timestamp',
      tone: approval.risk === 'High' ? 'critical' : approval.risk === 'Medium' ? 'watch' : 'neutral',
      to: `/approvals?id=${approval.id}`,
      actionLabel: 'Review',
    })),
    ...openIncidents.map((incident) => {
      const classification = classifyIncident(incident);
      const story = explainIncident(incident);
      return {
        id: `incident-${incident.id}`,
        title: story.title,
        description: story.impact,
        cause: story.cause,
        fix: story.fix,
        meta: `${incident.severity} - ${classification.sourceLabel}`,
        tone: incident.severity === 'P0' || incident.severity === 'P1' ? 'critical' : 'watch',
        to: `/incidents?id=${incident.id}`,
        actionLabel: 'Investigate',
      } satisfies StoryActionItem;
    }),
  ];

  return (
    <div className="story-shell">
      <div>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/users" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Users
          </Link>
        </Button>
      </div>

      <StoryBrief
        eyebrow="Company Health"
        title={customer.name}
        summary={`${customer.ownerEmail || 'No owner email'} - ${customer.industry || 'Industry not set'}. This page brings the user's approvals, incidents, receipts, provider calls, and profile into one story.`}
        tone={openIncidents.length > 0 || failedReceipts.length > 0 ? 'watch' : 'healthy'}
        meta={[
          customer.status,
          customer.displayId ? `STE-${customer.displayId}` : customer.id,
          latestActivity ? `Latest ${formatTimeAgo(latestActivity)}` : 'No activity',
        ]}
        primaryAction={{ label: 'Admin Logs', to: '/admin-logs' }}
        secondaryAction={{ label: 'Approvals', to: '/approvals' }}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StoryMetricCard
          label="Monthly Revenue"
          value={formatCurrency(customer.mrr)}
          story="Revenue assigned to this company profile."
          source={customer.plan}
          freshness={customer.lastActivity ? formatTimeAgo(customer.lastActivity) : 'No activity'}
          tone="neutral"
          icon={Building2}
        />
        <StoryMetricCard
          label="Pending Approvals"
          value={pendingApprovals.length}
          story="Decisions blocking this user or company from moving forward."
          source={`${relatedApprovals.length} approval records`}
          freshness={pendingApprovals[0]?.requestedAt ? formatTimeAgo(pendingApprovals[0].requestedAt) : 'No pending approvals'}
          tone={pendingApprovals.length > 0 ? 'watch' : 'healthy'}
          icon={CheckSquare}
        />
        <StoryMetricCard
          label="Open Incidents"
          value={openIncidents.length}
          story="Active problems matched by suite id or by a trace already proven through this company's receipts."
          source={`${relatedIncidents.length} incident records`}
          freshness={relatedIncidents[0]?.updatedAt ? formatTimeAgo(relatedIncidents[0].updatedAt) : 'No incidents'}
          tone={openIncidents.length > 0 ? 'critical' : 'healthy'}
          icon={ShieldAlert}
        />
        <StoryMetricCard
          label="Receipt Failures"
          value={failedReceipts.length}
          story="Proof receipts linked to this user that failed or were blocked."
          source={`${relatedReceipts.length} receipts matched`}
          freshness={relatedReceipts[0]?.timestamp ? formatTimeAgo(relatedReceipts[0].timestamp) : 'No receipts'}
          tone={failedReceipts.length > 0 ? 'watch' : 'healthy'}
          icon={DatabaseZap}
        />
      </div>

      <StoryActionQueue
        title="What needs attention for this company"
        subtitle={`${actionItems.length} item${actionItems.length === 1 ? '' : 's'} matched to this user story`}
        items={actionItems}
        emptyTitle="No matched blockers"
        emptyText="No pending approvals or open incidents have a verified suite or trace link to this company."
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <StoryEvidencePanel title="Proof receipts" description="Recent receipts tied to this user by suite id, linked customer id, owner, or exact email.">
          {relatedReceipts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No receipts matched this company yet.</p>
          ) : (
            <div className="story-list-scroll divide-y divide-border">
              {relatedReceipts.slice(0, 10).map((receipt) => (
                <Link key={receipt.id} to={receipt.correlationId ? `/trace/${receipt.correlationId}` : '/receipts'} className="grid gap-2 py-3 sm:grid-cols-[1fr_auto]">
                  <div>
                    <p className="font-medium text-foreground">{derivePremiumActionLabel(receipt.actionType, 'engineer')}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Cause: {receiptCause(receipt.provider, receipt.outcome, derivePremiumActionLabel(receipt.actionType, 'engineer'))}
                    </p>
                    <p className="mt-1 text-xs text-primary">
                      Fix: {receipt.outcome === 'Success' ? 'No fix needed; this receipt is proof.' : 'Open the trace, inspect the provider response, then retry the failed step.'}
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground">{receipt.timestamp ? formatTimeAgo(receipt.timestamp) : 'No time'}</p>
                </Link>
              ))}
            </div>
          )}
        </StoryEvidencePanel>

        <StoryEvidencePanel title="Provider calls" description="External service calls matched through suite id or a trace proven by this company.">
          {relatedProviderCalls.length === 0 ? (
            <p className="text-sm text-muted-foreground">No provider calls matched this company yet.</p>
          ) : (
            <div className="story-list-scroll divide-y divide-border">
              {relatedProviderCalls.slice(0, 10).map((call) => (
                <Link key={call.id} to={call.correlation_id ? `/trace/${call.correlation_id}` : '/provider-call-log'} className="grid gap-2 py-3 sm:grid-cols-[1fr_auto]">
                  <div>
                    <p className="font-medium text-foreground">{call.provider}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Cause: {providerCause(call.provider, call.status, derivePremiumActionLabel(call.action_type, 'engineer'))}
                    </p>
                    <p className="mt-1 text-xs text-primary">
                      Fix: {call.status === 'success' ? 'No fix needed; this call is proof.' : 'Open the provider call, verify request and response, then retry or pause writes.'}
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground">{call.duration_ms ? formatLatency(call.duration_ms) : 'No duration'}</p>
                </Link>
              ))}
            </div>
          )}
        </StoryEvidencePanel>
      </div>

      <StoryEvidencePanel title="Company profile" description="Useful context for support, onboarding, and incident triage.">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="premium-mini-card p-4">
            <User className="h-4 w-4 text-primary" />
            <p className="mt-3 text-sm text-muted-foreground">Owner</p>
            <p className="font-medium text-foreground">{customer.ownerName || 'No owner name'}</p>
          </div>
          <div className="premium-mini-card p-4">
            <Mail className="h-4 w-4 text-primary" />
            <p className="mt-3 text-sm text-muted-foreground">Email</p>
            <p className="truncate font-medium text-foreground">{customer.ownerEmail || 'No owner email'}</p>
          </div>
          <div className="premium-mini-card p-4">
            <ServerCog className="h-4 w-4 text-primary" />
            <p className="mt-3 text-sm text-muted-foreground">Team Size</p>
            <p className="font-medium text-foreground">{customer.teamSize || 1}</p>
          </div>
          <div className="premium-mini-card p-4">
            <ReceiptText className="h-4 w-4 text-primary" />
            <p className="mt-3 text-sm text-muted-foreground">Current Tools</p>
            <p className="truncate font-medium text-foreground">{customer.currentTools?.join(', ') || 'Not set'}</p>
          </div>
        </div>
      </StoryEvidencePanel>
    </div>
  );
}
