import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Building2, CheckSquare, HeartPulse, ShieldAlert, TrendingUp, Users } from 'lucide-react';
import {
  StoryActionQueue,
  StoryBrief,
  StoryEvidencePanel,
  StoryMetricCard,
  TelemetryDrawer,
  type StoryActionItem,
} from '@/components/story/StoryPrimitives';
import { PageLoadingState } from '@/components/shared/PageLoadingState';
import { useApprovals, useBusinessMetrics, useRunwayBurn } from '@/hooks/useAdminData';
import { useRealtimeCustomers } from '@/hooks/useRealtimeCustomers';
import { useUnifiedIncidents } from '@/hooks/useUnifiedIncidents';
import { formatCurrency, formatTimeAgo } from '@/lib/formatters';
import {
  classifyIncident,
  customerLabel,
  explainIncident,
  incidentTimestamp,
  partitionIncidents,
  summarizeIncident,
} from '@/lib/storyTriage';

function runwayLabel(value?: number): string {
  if (value === undefined || value === null) return 'No data';
  if (!Number.isFinite(value)) return 'Open-ended';
  return `${value.toFixed(0)} mo`;
}

function customerFreshness(customers: Array<{ lastActivity: string }>): string {
  const latest = customers.map((customer) => customer.lastActivity).filter(Boolean).sort().at(-1);
  return latest ? formatTimeAgo(latest) : 'No activity';
}

export default function AspireHealth() {
  const { data: customers, loading: customersLoading, error: customersError } = useRealtimeCustomers({ pageSize: 500 });
  const { data: approvals, loading: approvalsLoading, error: approvalsError } = useApprovals();
  const { data: businessMetrics, loading: metricsLoading, error: metricsError } = useBusinessMetrics();
  const { data: runway, loading: runwayLoading, error: runwayError } = useRunwayBurn();
  const { data: incidents, loading: incidentsLoading, error: incidentsError } = useUnifiedIncidents();

  const loading = customersLoading && approvalsLoading && metricsLoading && runwayLoading && incidentsLoading;
  const errors = [customersError, approvalsError, metricsError, runwayError, incidentsError].filter(Boolean);

  const partitions = useMemo(() => partitionIncidents(incidents), [incidents]);
  const userImpactIncidents = [...partitions.realIncidents, ...partitions.warnings].filter((incident) => {
    const category = classifyIncident(incident).sourceCategory;
    return ['customer', 'revenue', 'provider', 'orchestrator'].includes(category);
  });

  const activeCustomers = customers.filter((customer) => customer.status === 'Active');
  const trialCustomers = customers.filter((customer) => customer.status === 'Trial');
  const atRiskCustomers = customers.filter((customer) => customer.status === 'At Risk' || customer.riskFlag === 'High');
  const pendingApprovals = approvals.filter((approval) => approval.status === 'Pending');
  const latestIncident = incidents.map(incidentTimestamp).filter(Boolean).sort().at(-1);
  const totalMrr = businessMetrics?.totalMRR ?? customers.reduce((sum, customer) => sum + customer.mrr, 0);

  const actionItems: StoryActionItem[] = [
    ...pendingApprovals.map((approval) => ({
      id: `approval-${approval.id}`,
      title: approval.summary || `${approval.type} approval needed`,
      description: `${approval.risk} risk approval for ${approval.customer || 'an unlinked user'} affects the customer story.`,
      cause: `${approval.requestedBy || 'A workflow'} is waiting for a human decision before continuing ${approval.type}.`,
      fix: 'Review the evidence, approve or deny the request, then let the user-facing workflow continue.',
      meta: `Authority Queue - ${approval.requestedAt ? formatTimeAgo(approval.requestedAt) : 'time not provided'}`,
      tone: approval.risk === 'High' ? 'critical' : approval.risk === 'Medium' ? 'watch' : 'neutral',
      to: `/approvals?id=${approval.id}`,
      actionLabel: 'Review',
    } satisfies StoryActionItem)),
    ...userImpactIncidents.slice(0, 6).map((incident) => {
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
    ...atRiskCustomers.slice(0, 4).map((customer) => ({
      id: `customer-${customer.id}`,
      title: `${customer.name} is at risk`,
      description: `${customer.plan} account needs review before the user story is healthy.`,
      cause: `${customer.name} has ${customer.openIncidents} open incident(s), ${customer.openApprovals} approval(s), or a high risk flag.`,
      fix: 'Open the company story, resolve the blocking approval or incident, then confirm the account status changes.',
      meta: customer.lastActivity ? `Last activity ${formatTimeAgo(customer.lastActivity)}` : 'No activity recorded',
      tone: 'watch',
      to: `/users/${encodeURIComponent(customer.id)}`,
      actionLabel: 'Open user',
    } satisfies StoryActionItem)),
  ];

  const tone = pendingApprovals.some((approval) => approval.risk === 'High') || userImpactIncidents.some((incident) => incident.severity === 'P0' || incident.severity === 'P1')
    ? 'critical'
    : pendingApprovals.length > 0 || atRiskCustomers.length > 0 || userImpactIncidents.length > 0
      ? 'watch'
      : 'healthy';

  if (loading) {
    return <PageLoadingState showKPIs kpiCount={4} rows={4} />;
  }

  return (
    <div className="story-shell">
      <StoryBrief
        eyebrow="Aspire Health"
        title={`${activeCustomers.length} active user${activeCustomers.length === 1 ? '' : 's'}, ${pendingApprovals.length} decision${pendingApprovals.length === 1 ? '' : 's'} waiting`}
        summary="This view follows the customer story: who is active, who is blocked, where revenue is exposed, and which incidents can affect the Aspire experience."
        tone={tone}
        meta={[
          `${customers.length} total users`,
          `${trialCustomers.length} trial`,
          latestIncident ? `Incident signal ${formatTimeAgo(latestIncident)}` : 'No user incident signal',
        ]}
        primaryAction={{ label: 'View Users', to: '/users' }}
        secondaryAction={{ label: 'Review Approvals', to: '/approvals' }}
      />

      {errors.length > 0 && (
        <div className="story-surface border-destructive/35 bg-destructive/5 px-5 py-4 text-sm text-destructive">
          Some live sources could not load: {errors.join(' | ')}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StoryMetricCard
          label="Users"
          value={customers.length}
          story="All suite profiles are visible from one place, so issues can be traced back to the exact user or company instead of becoming unlinked platform noise."
          source={`${activeCustomers.length} active, ${trialCustomers.length} trial`}
          freshness={customerFreshness(customers)}
          tone={atRiskCustomers.length > 0 ? 'watch' : 'healthy'}
          icon={Users}
          action={{ label: 'Users', to: '/users' }}
        />
        <StoryMetricCard
          label="Authority Queue"
          value={pendingApprovals.length}
          story="Pending approvals explain what Aspire is waiting on before an agent can safely continue a user-facing workflow."
          source={`${approvals.length} approval records`}
          freshness={pendingApprovals[0]?.requestedAt ? formatTimeAgo(pendingApprovals[0].requestedAt) : 'No pending approvals'}
          tone={pendingApprovals.length > 0 ? 'watch' : 'healthy'}
          icon={CheckSquare}
          action={{ label: 'Approvals', to: '/approvals' }}
        />
        <StoryMetricCard
          label="Revenue"
          value={formatCurrency(totalMrr)}
          story="Revenue is read from live business metrics and suite data. Failed payment signals are tracked separately from admin bugs."
          source={`${businessMetrics?.newSubscriptions7d ?? 0} new in 7 days`}
          freshness="Live business metrics"
          tone={(businessMetrics?.failedPayments.count ?? 0) > 0 ? 'watch' : 'healthy'}
          icon={TrendingUp}
          action={{ label: 'Revenue', to: '/business/revenue-addons' }}
        />
        <StoryMetricCard
          label="User Impact"
          value={userImpactIncidents.length}
          story="Only incidents tied to users, providers, revenue, or the core brain are shown here. Admin-only telemetry stays in Admin Health."
          source={`${partitions.resolved.length} resolved retained`}
          freshness={latestIncident ? formatTimeAgo(latestIncident) : 'No incident signal'}
          tone={userImpactIncidents.length > 0 ? 'watch' : 'healthy'}
          icon={ShieldAlert}
          action={{ label: 'Admin Logs', to: '/admin-logs' }}
        />
      </div>

      <StoryActionQueue
        title="What changes the customer story"
        subtitle={`${actionItems.length} action${actionItems.length === 1 ? '' : 's'} can affect users, approvals, or revenue`}
        items={actionItems}
        emptyTitle="No customer-facing action is blocked"
        emptyText="There are no pending approvals, user-impact incidents, or at-risk user records in the current live data."
      />

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <StoryEvidencePanel
          title="User map"
          description="Recent users stay visible with status and activity so incidents can be traced back to a real account."
          action={{ label: 'All Users', to: '/users' }}
        >
          {customers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No suite profiles are visible to this admin session.</p>
          ) : (
            <div className="story-list-scroll divide-y divide-border">
              {customers.slice(0, 8).map((customer) => (
                <Link
                  key={customer.id}
                  to={`/users/${encodeURIComponent(customer.id)}`}
                  className="grid gap-2 py-3 transition-colors hover:bg-surface-2 sm:grid-cols-[1fr_auto] sm:items-center"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Building2 className="h-4 w-4 text-primary" />
                      <p className="truncate font-medium text-foreground">{customer.name}</p>
                      <span className="rounded-full border border-border bg-surface-2 px-2 py-0.5 text-xs text-muted-foreground">
                        {customer.status}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {customer.ownerEmail || 'No owner email'} - {customer.industry || 'Industry not set'}
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {customer.lastActivity ? formatTimeAgo(customer.lastActivity) : 'No activity'}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </StoryEvidencePanel>

        <StoryEvidencePanel
          title="Business pulse"
          description="The operating story stays separate from system incidents."
          action={{ label: 'Runway', to: '/business/runway-burn' }}
        >
          <div className="space-y-3">
            <div className="premium-mini-card p-4">
              <HeartPulse className="h-5 w-5 text-primary" />
              <p className="mt-3 text-2xl font-semibold">{runwayLabel(runway?.runway)}</p>
              <p className="text-sm text-muted-foreground">
                runway based on {formatCurrency(runway?.cashOnHand ?? 0)} cash on hand
              </p>
            </div>
            <div className="premium-mini-card p-4">
              <p className="text-sm font-medium text-muted-foreground">Failed payments</p>
              <p className="mt-2 text-2xl font-semibold">{businessMetrics?.failedPayments.count ?? 0}</p>
              <p className="text-sm text-muted-foreground">payment issues in the current business window</p>
            </div>
            <div className="premium-mini-card p-4">
              <p className="text-sm font-medium text-muted-foreground">Trial conversion</p>
              <p className="mt-2 text-2xl font-semibold">{businessMetrics?.trialConversion ?? 0}%</p>
              <p className="text-sm text-muted-foreground">derived from active and trial suite profiles</p>
            </div>
          </div>
        </StoryEvidencePanel>
      </div>

      <TelemetryDrawer
        title="Resolved user-impact history"
        summary={`${partitions.resolved.length} resolved incident${partitions.resolved.length === 1 ? '' : 's'} remain searchable after the active problem is gone`}
        emptyText="No resolved incident history is visible in the current incident set."
        items={partitions.resolved.map((incident) => ({
          id: incident.id,
          title: summarizeIncident(incident),
          meta: `${incident.severity} - ${classifyIncident(incident).sourceLabel} - ${customerLabel(incident)}`,
          to: `/incidents?id=${incident.id}`,
        }))}
      />
    </div>
  );
}
