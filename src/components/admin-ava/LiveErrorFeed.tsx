/**
 * Scrolling live error feed — severity icon, timestamp, source tag, message preview.
 * Click to expand full stack trace.
 */

import { useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useErrorStream, type LiveError } from '@/hooks/useErrorStream';
import { cn } from '@/lib/utils';
import { formatTimeAgo } from '@/lib/formatters';
import { AlertTriangle, AlertOctagon, Info, ChevronDown, ChevronUp } from 'lucide-react';

const severityConfig = {
  P0: { icon: AlertOctagon, color: 'text-red-500', bg: 'bg-red-500/10', label: 'CRITICAL' },
  P1: { icon: AlertTriangle, color: 'text-orange-500', bg: 'bg-orange-500/10', label: 'HIGH' },
  P2: { icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-500/10', label: 'MEDIUM' },
  P3: { icon: Info, color: 'text-blue-400', bg: 'bg-blue-500/10', label: 'LOW' },
};

function ErrorRow({ error }: { error: LiveError }) {
  const [expanded, setExpanded] = useState(false);
  const config = severityConfig[error.severity];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        'border-b border-border/50 px-3 py-2 cursor-pointer hover:bg-muted/30 transition-colors',
        error.severity === 'P0' && 'border-l-2 border-l-red-500',
        error.severity === 'P1' && 'border-l-2 border-l-orange-500',
      )}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-start gap-2">
        <Icon className={cn('w-4 h-4 mt-0.5 flex-shrink-0', config.color)} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium', config.bg, config.color)}>
              {config.label}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
              {error.source}
            </span>
            {error.provider && error.provider !== 'Internal' && (
              <span className="text-[10px] text-muted-foreground">{error.provider}</span>
            )}
            <span className="text-[10px] text-muted-foreground ml-auto">{formatTimeAgo(error.timestamp)}</span>
          </div>
          <p className="text-xs mt-1 truncate">{error.message}</p>
        </div>
        {error.stackTrace && (
          expanded ? <ChevronUp className="w-3 h-3 text-muted-foreground flex-shrink-0" /> :
          <ChevronDown className="w-3 h-3 text-muted-foreground flex-shrink-0" />
        )}
      </div>
      {expanded && error.stackTrace && (
        <pre className="mt-2 text-[10px] text-muted-foreground bg-muted/50 rounded p-2 overflow-x-auto whitespace-pre-wrap">
          {error.stackTrace}
        </pre>
      )}
    </div>
  );
}

export function LiveErrorFeed() {
  const { errors, counts } = useErrorStream();

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-semibold">Live Errors</span>
        </div>
        <div className="flex items-center gap-2">
          {counts.p0 > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-500 font-medium">{counts.p0} P0</span>}
          {counts.p1 > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-500 font-medium">{counts.p1} P1</span>}
          <span className="text-[10px] text-muted-foreground">{counts.total} total</span>
        </div>
      </div>
      <ScrollArea className="max-h-[400px]">
        {errors.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No errors detected
          </div>
        ) : (
          errors.map(error => <ErrorRow key={error.id} error={error} />)
        )}
      </ScrollArea>
    </div>
  );
}
