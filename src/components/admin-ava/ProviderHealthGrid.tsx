/**
 * Live provider health grid — status dot, name, lane, latency, error rate.
 * Updates live via SSE stream from /admin/ops/providers/stream.
 */

import { useProviderHealthStream, type ProviderHealth, type ProviderStatus } from '@/hooks/useProviderHealthStream';
import { cn } from '@/lib/utils';
import { formatTimeAgo } from '@/lib/formatters';
import { Wifi, WifiOff, AlertTriangle, Clock, Activity } from 'lucide-react';

const statusConfig: Record<ProviderStatus, { label: string; color: string; bg: string; dot: string }> = {
  connected: { label: 'Connected', color: 'text-green-400', bg: 'bg-green-500/5 border-green-500/20', dot: 'bg-green-500' },
  degraded: { label: 'Degraded', color: 'text-amber-400', bg: 'bg-amber-500/5 border-amber-500/20', dot: 'bg-amber-500' },
  disconnected: { label: 'Disconnected', color: 'text-red-400', bg: 'bg-red-500/5 border-red-500/20', dot: 'bg-red-500' },
};

function ProviderCard({ provider }: { provider: ProviderHealth }) {
  const config = statusConfig[provider.status];

  return (
    <div className={cn('rounded-lg border p-3 space-y-2 transition-all', config.bg)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={cn('w-2 h-2 rounded-full', config.dot, provider.status === 'degraded' && 'animate-pulse')} />
          <span className="text-sm font-medium">{provider.provider}</span>
        </div>
        <span className={cn('text-xs', config.color)}>{config.label}</span>
      </div>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-1" title="Latency">
          <Clock className="w-3 h-3" />
          {provider.latencyMs}ms
        </div>
        <div className="flex items-center gap-1" title="Error rate">
          <Activity className="w-3 h-3" />
          {(provider.errorRate * 100).toFixed(1)}%
        </div>
        <div className="flex items-center gap-1 ml-auto" title="Lane">
          {provider.lane}
        </div>
      </div>

      <div className="text-[10px] text-muted-foreground/60">
        Last check: {formatTimeAgo(provider.lastChecked)}
      </div>
    </div>
  );
}

export function ProviderHealthGrid() {
  const { providers, hasIssues, isConnected, degradedCount, disconnectedCount } = useProviderHealthStream();

  return (
    <div className="space-y-3">
      {/* Status bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isConnected ? (
            <Wifi className="w-4 h-4 text-green-400" />
          ) : (
            <WifiOff className="w-4 h-4 text-muted-foreground" />
          )}
          <span className="text-sm font-semibold">
            {providers.length} Providers
          </span>
        </div>
        {hasIssues && (
          <div className="flex items-center gap-2">
            {disconnectedCount > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                {disconnectedCount} down
              </span>
            )}
            {degradedCount > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400">
                {degradedCount} degraded
              </span>
            )}
          </div>
        )}
      </div>

      {/* Grid */}
      {providers.length === 0 ? (
        <div className="text-center text-sm text-muted-foreground py-8">
          {isConnected ? 'No providers configured' : 'Connecting to provider health stream...'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {providers.map(p => (
            <ProviderCard key={p.provider} provider={p} />
          ))}
        </div>
      )}
    </div>
  );
}
