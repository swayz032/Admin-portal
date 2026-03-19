import { cn } from '@/lib/utils';

export type SourceCategory = 'backend' | 'desktop' | 'n8n' | 'provider' | 'orchestrator' | 'security';

interface SourceBadgeProps {
  source: SourceCategory;
  className?: string;
}

const SOURCE_CONFIG: Record<SourceCategory, { label: string; colorClass: string }> = {
  backend: { label: 'Backend', colorClass: 'bg-slate-500/15 text-slate-400' },
  desktop: { label: 'Desktop', colorClass: 'bg-blue-500/15 text-blue-400' },
  n8n: { label: 'n8n', colorClass: 'bg-orange-500/15 text-orange-400' },
  provider: { label: 'Provider', colorClass: 'bg-yellow-500/15 text-yellow-400' },
  orchestrator: { label: 'Orchestrator', colorClass: 'bg-purple-500/15 text-purple-400' },
  security: { label: 'Security', colorClass: 'bg-red-500/15 text-red-400' },
};

export function deriveSourceCategory(receiptType: string | null | undefined): SourceCategory {
  if (!receiptType) return 'backend';
  const rt = receiptType.toLowerCase();

  // n8n workflows
  if (rt.startsWith('n8n_') || rt.startsWith('n8n.')) return 'n8n';

  // Orchestrator / brain
  if (rt === 'orchestrator' || rt.startsWith('orchestrator.') || rt === 'tool_execution' || rt === 'param_extraction')
    return 'orchestrator';

  // Provider integrations
  if (
    rt.startsWith('stripe') || rt.startsWith('mail.') || rt.startsWith('calendar') ||
    rt.startsWith('pandadoc') || rt.startsWith('quickbooks') || rt.startsWith('twilio') ||
    rt.startsWith('livekit') || rt.startsWith('elevenlabs') || rt.startsWith('deepgram') ||
    rt.startsWith('gusto') || rt.startsWith('moov') || rt.startsWith('plaid') ||
    rt.startsWith('exa') || rt.startsWith('brave')
  ) return 'provider';

  // Security / auth
  if (rt.includes('oauth') || rt.includes('csrf') || rt.includes('security') ||
      rt.includes('auth_denial') || rt === 'onboarding')
    return 'security';

  // Desktop / client
  if (rt.startsWith('desktop') || rt.startsWith('client'))
    return 'desktop';

  return 'backend';
}

export function SourceBadge({ source, className }: SourceBadgeProps) {
  const config = SOURCE_CONFIG[source];
  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
      config.colorClass,
      className
    )}>
      {config.label}
    </span>
  );
}
