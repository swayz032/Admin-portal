/**
 * Alert banner at top of admin portal when any provider is degraded/disconnected.
 * Auto-dismisses when all providers recover.
 */

import { useProviderHealthStream } from '@/hooks/useProviderHealthStream';
import { AlertTriangle, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

export function ProviderAlertBanner() {
  const { hasIssues, degradedCount, disconnectedCount, providers } = useProviderHealthStream();
  const [dismissed, setDismissed] = useState(false);

  // Auto-undismiss when new issues appear (moved to useEffect to avoid setState-during-render)
  useEffect(() => {
    if (!hasIssues && dismissed) {
      setDismissed(false);
    }
  }, [hasIssues, dismissed]);

  if (!hasIssues) return null;

  if (dismissed) return null;

  const disconnectedNames = providers
    .filter(p => p.status === 'disconnected')
    .map(p => p.provider)
    .join(', ');

  const degradedNames = providers
    .filter(p => p.status === 'degraded')
    .map(p => p.provider)
    .join(', ');

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-4 py-2 text-sm border-b',
        disconnectedCount > 0
          ? 'bg-red-500/10 border-red-500/20 text-red-400'
          : 'bg-amber-500/10 border-amber-500/20 text-amber-400',
      )}
    >
      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
      <span className="flex-1">
        {disconnectedCount > 0 && (
          <><strong>{disconnectedCount} provider{disconnectedCount > 1 ? 's' : ''} down:</strong> {disconnectedNames}. </>
        )}
        {degradedCount > 0 && (
          <><strong>{degradedCount} degraded:</strong> {degradedNames}.</>
        )}
      </span>
      <button onClick={() => setDismissed(true)} className="hover:opacity-70">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
