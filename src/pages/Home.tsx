import { Link } from 'react-router-dom';
import { ArrowRight, Building2, HeartPulse, ServerCog, ShieldAlert, Users } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useApprovals, useBusinessMetrics, useProviders } from '@/hooks/useAdminData';
import { useRealtimeCustomers } from '@/hooks/useRealtimeCustomers';
import { useRealtimeReceipts } from '@/hooks/useRealtimeReceipts';
import { useUnifiedIncidents } from '@/hooks/useUnifiedIncidents';
import { PageLoadingState } from '@/components/shared/PageLoadingState';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatTimeAgo } from '@/lib/formatters';
import { incidentTimestamp, partitionIncidents } from '@/lib/storyTriage';
import { cn } from '@/lib/utils';

function latest(values: string[]): string | undefined {
  return values.filter(Boolean).sort().at(-1);
}

interface PortalOptionProps {
  to: string;
  label: string;
  title: string;
  summary: string;
  signal: string;
  icon: typeof HeartPulse;
  stats: Array<{ label: string; value: string | number }>;
  tone: 'healthy' | 'watch' | 'critical';
  visual: 'ops' | 'users';
}

function PremiumCardVisual({ visual }: { visual: 'ops' | 'users' }) {
  const bars = visual === 'ops' ? [42, 66, 36, 78, 52, 88, 44] : [34, 48, 62, 58, 72, 84, 76];

  return (
    <div className="premium-visual">
      <div className="premium-bars" aria-hidden="true">
        {bars.map((height, index) => (
          <span key={`${visual}-${index}`} style={{ height: `${height}%` }} />
        ))}
      </div>
      <span className="premium-chart-caption">
        {visual === 'ops' ? 'source map' : 'user trend'}
      </span>
    </div>
  );
}

function PortalOption({ to, label, title, summary, signal, icon: Icon, stats, tone, visual }: PortalOptionProps) {
  const accentClass = tone === 'critical'
    ? 'bg-destructive'
    : tone === 'watch'
      ? 'bg-warning'
      : 'bg-primary';

  return (
    <Link
      to={to}
      className="xtract-lane-card group flex min-h-[300px] flex-col justify-between p-5"
    >
      <div className={cn('absolute left-0 top-5 h-16 w-1 rounded-r-full', accentClass)} />
      <div className="relative z-10 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <span className="canvas-tile flex h-11 w-11 items-center justify-center">
            <Icon className="h-5 w-5 text-primary" />
          </span>
          <span className="rounded-full bg-black/35 px-3 py-1 text-xs font-medium text-muted-foreground shadow-inner">
            {label}
          </span>
        </div>
        <div className="space-y-3">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h2>
          <p className="max-w-xl text-sm leading-6 text-muted-foreground">{summary}</p>
        </div>
        <PremiumCardVisual visual={visual} />
        <p className="rounded-lg bg-black/20 px-3 py-2 text-sm text-foreground shadow-inner">{signal}</p>
      </div>
      <div className="relative z-10 mt-5 space-y-4">
        <div className="grid grid-cols-3 gap-2">
          {stats.map((stat) => (
            <div key={stat.label} className="premium-mini-card p-3">
              <p className="text-xl font-semibold text-foreground">{stat.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between text-sm font-medium text-primary">
          Open story
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </div>
      </div>
    </Link>
  );
}

export default function Home() {
  const { user } = useAuth();
  const { data: incidents, loading: incidentsLoading } = useUnifiedIncidents();
  const { data: receipts, loading: receiptsLoading } = useRealtimeReceipts({ pageSize: 500 });
  const { data: providers, loading: providersLoading } = useProviders();
  const { data: customers, loading: customersLoading } = useRealtimeCustomers({ pageSize: 500 });
  const { data: approvals, loading: approvalsLoading } = useApprovals();
  const { data: businessMetrics, loading: metricsLoading } = useBusinessMetrics();

  const loading = incidentsLoading && receiptsLoading && providersLoading && customersLoading && approvalsLoading && metricsLoading;
  const partitions = partitionIncidents(incidents);
  const providerIssues = providers.filter((provider) => provider.status !== 'Healthy');
  const failedReceipts = receipts.filter((receipt) => receipt.outcome !== 'Success');
  const pendingApprovals = approvals.filter((approval) => approval.status === 'Pending');
  const activeCustomers = customers.filter((customer) => customer.status === 'Active');
  const atRiskCustomers = customers.filter((customer) => customer.status === 'At Risk' || customer.riskFlag === 'High');
  const latestSignal = latest([
    ...incidents.map(incidentTimestamp),
    ...receipts.map((receipt) => receipt.timestamp),
    ...customers.map((customer) => customer.lastActivity),
  ]);

  if (loading) {
    return <PageLoadingState showKPIs kpiCount={4} rows={4} />;
  }

  const firstName = user?.displayName?.split(' ')[0] || user?.email?.split('@')[0] || 'Admin';
  const adminTone = partitions.realIncidents.length > 0 ? 'critical' : providerIssues.length > 0 || failedReceipts.length > 0 ? 'watch' : 'healthy';
  const aspireTone = pendingApprovals.some((approval) => approval.risk === 'High') || atRiskCustomers.length > 0
    ? 'watch'
    : 'healthy';

  return (
    <div className="story-shell">
      <section className="xtract-hero-panel px-5 py-5 sm:px-7 sm:py-6">
        <div className="absolute left-0 top-0 h-full w-1 bg-primary" />
        <div className="relative z-10 grid gap-6 lg:grid-cols-[1fr_320px] lg:items-center">
          <div className="max-w-3xl space-y-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Aspire Admin Portal</p>
            <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
              Choose the story first, {firstName}.
            </h1>
            <p className="text-sm leading-6 text-muted-foreground sm:text-base">
              The portal now starts with two clear paths: Admin Health for platform operations and Aspire Health for users, approvals, and business impact.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" asChild>
                <Link to="/admin-logs">Admin Logs</Link>
              </Button>
              <Button asChild>
                <Link to="/users" className="gap-2">
                  Users
                  <Users className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>

          <div className="xtract-phone hidden min-h-[250px] p-4 lg:block">
            <div className="mx-auto mb-4 h-1.5 w-16 rounded-full bg-white/15" />
            <div className="space-y-3">
              <div className="rounded-lg bg-black/55 p-4 shadow-inner">
                <p className="text-xs uppercase tracking-widest text-primary">Live story</p>
                <p className="mt-2 text-2xl font-semibold">Admin or Aspire</p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">Pick the operating lane before reading the metrics.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="premium-mini-card p-3">
                  <p className="text-xl font-semibold">{partitions.realIncidents.length}</p>
                  <p className="text-xs text-muted-foreground">incidents</p>
                </div>
                <div className="premium-mini-card p-3">
                  <p className="text-xl font-semibold">{pendingApprovals.length}</p>
                  <p className="text-xs text-muted-foreground">decisions</p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-2 rounded bg-primary/70" />
                <div className="h-2 w-3/4 rounded bg-white/20" />
                <div className="h-2 w-1/2 rounded bg-white/10" />
              </div>
            </div>
          </div>
        </div>
        <div className="relative z-10 mt-5 flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span className="rounded-full border border-border bg-surface-2 px-3 py-1">
            {latestSignal ? `Fresh ${formatTimeAgo(latestSignal)}` : 'No live signal yet'}
          </span>
          <span className="rounded-full border border-border bg-surface-2 px-3 py-1">
            {partitions.noise.length} noise signal{partitions.noise.length === 1 ? '' : 's'} separated
          </span>
          <span className="rounded-full border border-border bg-surface-2 px-3 py-1">
            {partitions.resolved.length} resolved retained
          </span>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <PortalOption
          to="/admin-health"
          label="Operations"
          title="Admin Health"
          summary="See platform incidents, provider problems, failed receipts, and admin telemetry separated by source and severity."
          signal={
            partitions.realIncidents.length > 0
              ? `${partitions.realIncidents.length} promoted incident${partitions.realIncidents.length === 1 ? '' : 's'} need action.`
              : providerIssues.length > 0
                ? `${providerIssues.length} provider issue${providerIssues.length === 1 ? '' : 's'} need review.`
                : 'No real admin incidents are promoted right now.'
          }
          icon={ServerCog}
          tone={adminTone}
          visual="ops"
          stats={[
            { label: 'real incidents', value: partitions.realIncidents.length },
            { label: 'provider issues', value: providerIssues.length },
            { label: 'failed receipts', value: failedReceipts.length },
          ]}
        />

        <PortalOption
          to="/aspire-health"
          label="Users"
          title="Aspire Health"
          summary="Follow the customer story: users, account status, approvals, revenue exposure, and incidents that affect the Aspire experience."
          signal={
            pendingApprovals.length > 0
              ? `${pendingApprovals.length} approval${pendingApprovals.length === 1 ? '' : 's'} are waiting before work can continue.`
              : atRiskCustomers.length > 0
                ? `${atRiskCustomers.length} user${atRiskCustomers.length === 1 ? '' : 's'} need follow-up.`
                : 'No customer-facing action is blocked right now.'
          }
          icon={HeartPulse}
          tone={aspireTone}
          visual="users"
          stats={[
            { label: 'active users', value: activeCustomers.length },
            { label: 'approvals', value: pendingApprovals.length },
            { label: 'MRR', value: formatCurrency(businessMetrics?.totalMRR ?? 0) },
          ]}
        />
      </div>

      <section className="story-surface grid gap-4 p-5 md:grid-cols-3">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-md border border-border bg-surface-2">
            <ShieldAlert className="h-4 w-4 text-primary" />
          </span>
          <div>
            <p className="font-medium text-foreground">Noise stays out of the queue</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">Weak telemetry stays searchable in logs without hiding real incidents.</p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-md border border-border bg-surface-2">
            <Building2 className="h-4 w-4 text-primary" />
          </span>
          <div>
            <p className="font-medium text-foreground">Users are a first-class path</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">Companies, owners, approvals, and user-impact incidents are grouped under Aspire Health.</p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-md border border-border bg-surface-2">
            <ServerCog className="h-4 w-4 text-primary" />
          </span>
          <div>
            <p className="font-medium text-foreground">Source stays visible</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">Provider calls, receipts, automation, security, and core brain failures keep separate lanes.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
