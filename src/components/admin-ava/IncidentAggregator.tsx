/**
 * Unified incident aggregation panel — combined frontend + backend incidents.
 * Severity-sorted, source-tagged.
 */

import { ScrollArea } from '@/components/ui/scroll-area';
import { useUnifiedIncidents, type UnifiedIncident } from '@/hooks/useUnifiedIncidents';
import { cn } from '@/lib/utils';
import { formatTimeAgo } from '@/lib/formatters';
import { AlertOctagon, AlertTriangle, Info, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

const severityIcons = {
  P0: AlertOctagon,
  P1: AlertTriangle,
  P2: AlertTriangle,
  P3: Info,
};

const severityColors = {
  P0: 'text-red-500 border-l-red-500',
  P1: 'text-orange-500 border-l-orange-500',
  P2: 'text-amber-500 border-l-amber-500',
  P3: 'text-blue-400 border-l-blue-400',
};

const sourceLabels = {
  frontend: 'FE',
  backend: 'BE',
  both: 'FE+BE',
};

function IncidentRow({ incident }: { incident: UnifiedIncident }) {
  const Icon = severityIcons[incident.severity];
  const colors = severityColors[incident.severity];

  return (
    <div className={cn('border-b border-border/50 border-l-2 px-3 py-2', colors)}>
      <div className="flex items-start gap-2">
        <Icon className={cn('w-4 h-4 mt-0.5 flex-shrink-0', colors.split(' ')[0])} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium">{incident.severity}</span>
            <span className="text-[10px] px-1 py-0 rounded bg-muted text-muted-foreground">
              {sourceLabels[incident.source]}
            </span>
            <span className="text-[10px] text-muted-foreground ml-auto">
              {formatTimeAgo(incident.createdAt)}
            </span>
          </div>
          <p className="text-xs mt-0.5 truncate">{incident.summary}</p>
          {incident.provider && incident.provider !== 'Internal' && (
            <span className="text-[10px] text-muted-foreground">{incident.provider}</span>
          )}
        </div>
      </div>
    </div>
  );
}

export function IncidentAggregator() {
  const { data: incidents, loading } = useUnifiedIncidents();

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">Unified Incidents</span>
        <Link to="/incidents" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
          View all <ExternalLink className="w-3 h-3" />
        </Link>
      </div>

      <ScrollArea className="max-h-[300px]">
        {loading ? (
          <div className="p-4 text-center text-sm text-muted-foreground">Loading...</div>
        ) : incidents.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">No incidents</div>
        ) : (
          incidents.map(incident => <IncidentRow key={incident.id} incident={incident} />)
        )}
      </ScrollArea>
    </div>
  );
}
