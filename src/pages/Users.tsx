import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Building2,
  CheckSquare,
  CircleDollarSign,
  Search,
  ShieldAlert,
  Users as UsersIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  StoryBrief,
  StoryEvidencePanel,
  StoryMetricCard,
} from '@/components/story/StoryPrimitives';
import { PageLoadingState } from '@/components/shared/PageLoadingState';
import { useApprovals } from '@/hooks/useAdminData';
import { useRealtimeCustomers } from '@/hooks/useRealtimeCustomers';
import { useUnifiedIncidents } from '@/hooks/useUnifiedIncidents';
import { formatCurrency, formatTimeAgo } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type { Customer } from '@/data/seed';
import { approvalBelongsToCustomer, incidentBelongsToCustomer } from '@/lib/customerIdentity';

type StatusFilter = 'All' | Customer['status'];

const statusOptions: StatusFilter[] = ['All', 'Active', 'Trial', 'At Risk', 'Paused'];

function statusTone(customer: Customer): 'healthy' | 'watch' | 'critical' {
  if (customer.status === 'At Risk' || customer.riskFlag === 'High') return 'critical';
  if (customer.status === 'Trial' || customer.riskFlag === 'Medium' || customer.openApprovals > 0) return 'watch';
  return 'healthy';
}

export default function Users() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('All');
  const { data: customers, loading: customersLoading, error: customersError } = useRealtimeCustomers({ pageSize: 500 });
  const { data: approvals, loading: approvalsLoading, error: approvalsError } = useApprovals();
  const { data: incidents, loading: incidentsLoading, error: incidentsError } = useUnifiedIncidents();

  const loading = customersLoading && approvalsLoading && incidentsLoading;
  const errors = [customersError, approvalsError, incidentsError].filter(Boolean);

  const enrichedCustomers = useMemo(() => customers.map((customer) => {
    const matchedApprovals = approvals.filter((approval) => approvalBelongsToCustomer(approval, customer));
    const matchedIncidents = incidents.filter((incident) => incidentBelongsToCustomer(incident, customer));

    return {
      customer,
      pendingApprovals: matchedApprovals.filter((approval) => approval.status === 'Pending').length + customer.openApprovals,
      openIncidents: matchedIncidents.filter((incident) => incident.status === 'Open').length + customer.openIncidents,
      matchedSignals: matchedApprovals.length + matchedIncidents.length,
    };
  }), [approvals, customers, incidents]);

  const filteredCustomers = enrichedCustomers.filter(({ customer }) => {
    const query = search.trim().toLowerCase();
    const matchesSearch = query.length === 0 || [
      customer.name,
      customer.ownerEmail,
      customer.ownerName,
      customer.industry,
      customer.displayId,
      customer.officeDisplayId,
    ].some((value) => String(value ?? '').toLowerCase().includes(query));

    return matchesSearch && (status === 'All' || customer.status === status);
  });

  const activeCustomers = customers.filter((customer) => customer.status === 'Active');
  const trialCustomers = customers.filter((customer) => customer.status === 'Trial');
  const atRiskCustomers = customers.filter((customer) => customer.status === 'At Risk' || customer.riskFlag === 'High');
  const totalMrr = customers.reduce((sum, customer) => sum + customer.mrr, 0);
  const latestActivity = customers.map((customer) => customer.lastActivity).filter(Boolean).sort().at(-1);

  if (loading) {
    return <PageLoadingState showKPIs kpiCount={4} rows={6} />;
  }

  return (
    <div className="story-shell">
      <StoryBrief
        eyebrow="Users"
        title="Every company opens into its own health story"
        summary="Search a company, click it, and see its approvals, incidents, receipts, provider calls, revenue, and profile in one place. This keeps user-impact problems separate from platform noise."
        tone={atRiskCustomers.length > 0 ? 'watch' : 'healthy'}
        meta={[
          `${customers.length} companies`,
          `${activeCustomers.length} active`,
          latestActivity ? `Fresh ${formatTimeAgo(latestActivity)}` : 'No recent activity',
        ]}
        primaryAction={{ label: 'Aspire Health', to: '/aspire-health' }}
        secondaryAction={{ label: 'Admin Logs', to: '/admin-logs' }}
      />

      {errors.length > 0 && (
        <div className="story-surface border-destructive/35 bg-destructive/5 px-5 py-4 text-sm text-destructive">
          Some live sources could not load: {errors.join(' | ')}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StoryMetricCard
          label="Companies"
          value={customers.length}
          story="All suite profiles stay visible so incidents can be traced to a real company instead of becoming unlinked platform noise."
          source={`${activeCustomers.length} active`}
          freshness={latestActivity ? formatTimeAgo(latestActivity) : 'No activity'}
          tone="healthy"
          icon={UsersIcon}
        />
        <StoryMetricCard
          label="At Risk"
          value={atRiskCustomers.length}
          story="Accounts with risk flags or at-risk status are kept in the user story lane."
          source={`${trialCustomers.length} trial`}
          freshness="Live suite profiles"
          tone={atRiskCustomers.length > 0 ? 'watch' : 'healthy'}
          icon={ShieldAlert}
        />
        <StoryMetricCard
          label="Open Decisions"
          value={enrichedCustomers.reduce((sum, item) => sum + item.pendingApprovals, 0)}
          story="Approval waits are counted against the company they affect when a match is available."
          source={`${approvals.length} approval records`}
          freshness="Authority Queue"
          tone={approvals.some((approval) => approval.status === 'Pending') ? 'watch' : 'healthy'}
          icon={CheckSquare}
          action={{ label: 'Approvals', to: '/approvals' }}
        />
        <StoryMetricCard
          label="Revenue"
          value={formatCurrency(totalMrr)}
          story="Revenue is attached to users, not mixed into admin incidents."
          source="Suite profiles"
          freshness="Live user data"
          tone="healthy"
          icon={CircleDollarSign}
        />
      </div>

      <StoryEvidencePanel
        title="Company map"
        description="Click any company to open its full story with metrics, incidents, receipts, provider calls, and profile data."
      >
        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search company, owner, email, industry..."
              className="h-11 rounded-lg bg-background pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {statusOptions.map((option) => (
              <Button
                key={option}
                type="button"
                variant={status === option ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatus(option)}
              >
                {option}
              </Button>
            ))}
          </div>
        </div>

        {filteredCustomers.length === 0 ? (
          <div className="rounded-lg border border-border bg-background p-6 text-sm text-muted-foreground">
            No companies match the current filters.
          </div>
        ) : (
          <div className="story-list-scroll grid gap-3 pr-1 xl:grid-cols-2">
            {filteredCustomers.map(({ customer, pendingApprovals, openIncidents, matchedSignals }) => (
              <Link
                key={customer.id}
                to={`/users/${encodeURIComponent(customer.id)}`}
                className={cn(
                  'xtract-lane-card group min-h-[230px] p-5 transition-colors hover:border-primary/60',
                  statusTone(customer) === 'critical' && 'border-destructive/40',
                  statusTone(customer) === 'watch' && 'border-warning/40',
                  statusTone(customer) === 'healthy' && 'border-success/30',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-background">
                    <Building2 className="h-5 w-5 text-primary" />
                  </span>
                  <span className="rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground">
                    {customer.status}
                  </span>
                </div>

                <div className="mt-5 space-y-2">
                  <h2 className="text-xl font-semibold tracking-tight text-foreground">{customer.name}</h2>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {customer.ownerEmail || 'No owner email'} - {customer.industry || 'Industry not set'}
                  </p>
                </div>

                <div className="mt-5 grid grid-cols-3 gap-2">
                  <div className="premium-mini-card p-3">
                    <p className="text-lg font-semibold text-foreground">{formatCurrency(customer.mrr)}</p>
                    <p className="text-xs text-muted-foreground">MRR</p>
                  </div>
                  <div className="premium-mini-card p-3">
                    <p className="text-lg font-semibold text-foreground">{pendingApprovals}</p>
                    <p className="text-xs text-muted-foreground">decisions</p>
                  </div>
                  <div className="premium-mini-card p-3">
                    <p className="text-lg font-semibold text-foreground">{openIncidents}</p>
                    <p className="text-xs text-muted-foreground">incidents</p>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-border pt-4 text-sm">
                  <span className="text-muted-foreground">
                    {matchedSignals} linked signal{matchedSignals === 1 ? '' : 's'} - {customer.lastActivity ? formatTimeAgo(customer.lastActivity) : 'no activity'}
                  </span>
                  <span className="inline-flex items-center gap-1 font-medium text-primary">
                    Open story
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </StoryEvidencePanel>
    </div>
  );
}
