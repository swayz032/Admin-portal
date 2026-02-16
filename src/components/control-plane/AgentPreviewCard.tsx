import { cn } from '@/lib/utils';
import { useSystem } from '@/contexts/SystemContext';
import { BuilderState, RiskTier } from '@/contracts/control-plane';
import { Bot, Shield, Wrench, AlertTriangle } from 'lucide-react';

interface AgentPreviewCardProps {
  state: BuilderState;
  className?: string;
}

const riskColors: Record<RiskTier, { bg: string; text: string; label: string }> = {
  low: { bg: 'bg-success/20', text: 'text-success', label: 'Low Risk' },
  medium: { bg: 'bg-warning/20', text: 'text-warning', label: 'Medium Risk' },
  high: { bg: 'bg-destructive/20', text: 'text-destructive', label: 'High Risk' },
};

export function AgentPreviewCard({ state, className }: AgentPreviewCardProps) {
  const { viewMode } = useSystem();
  
  const enabledCapabilities = state.capabilities.filter(c => c.enabled);
  const riskStyle = riskColors[state.risk_tier];
  
  return (
    <div className={cn(
      'rounded-xl border border-border bg-card p-5 space-y-4',
      'shadow-lg shadow-black/20',
      className
    )}>
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
          <Bot className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground truncate">
            {state.name || 'Untitled Agent'}
          </h3>
          <p className="text-sm text-muted-foreground truncate">
            {state.description || 'No description yet'}
          </p>
        </div>
      </div>
      
      {/* Risk Tier */}
      <div className="flex items-center gap-2">
        <span className={cn(
          'inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium',
          riskStyle.bg,
          riskStyle.text
        )}>
          <Shield className="h-3 w-3" />
          {viewMode === 'operator' ? riskStyle.label : state.risk_tier.toUpperCase()}
        </span>
        
        {state.approval_required && (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-primary/20 text-primary">
            <AlertTriangle className="h-3 w-3" />
            {viewMode === 'operator' ? 'Needs Approval' : 'Approval Required'}
          </span>
        )}
      </div>
      
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-surface-2 rounded-lg p-3">
          <div className="text-2xl font-bold text-foreground">
            {enabledCapabilities.length}
          </div>
          <div className="text-xs text-muted-foreground">
            {viewMode === 'operator' ? 'Capabilities' : 'Enabled Caps'}
          </div>
        </div>
        <div className="bg-surface-2 rounded-lg p-3">
          <div className="text-2xl font-bold text-foreground">
            {state.tool_allowlist.length}
          </div>
          <div className="text-xs text-muted-foreground">
            {viewMode === 'operator' ? 'Tools' : 'Allowlisted'}
          </div>
        </div>
      </div>
      
      {/* Capabilities Preview */}
      {enabledCapabilities.length > 0 && (
        <div>
          <div className="text-xs font-medium text-muted-foreground mb-2">
            {viewMode === 'operator' ? 'What it can do' : 'Capabilities'}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {enabledCapabilities.slice(0, 3).map(cap => (
              <span 
                key={cap.id}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-accent text-accent-foreground text-xs"
              >
                <Wrench className="h-3 w-3" />
                {cap.name}
              </span>
            ))}
            {enabledCapabilities.length > 3 && (
              <span className="px-2 py-0.5 rounded-md bg-muted text-muted-foreground text-xs">
                +{enabledCapabilities.length - 3} more
              </span>
            )}
          </div>
        </div>
      )}
      
      {/* Category & Version */}
      <div className="pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
        <span className="capitalize">{state.category || 'No category'}</span>
        <span>v{state.prompt_version}</span>
      </div>
      
      {viewMode === 'engineer' && state.internal && (
        <div className="text-xs text-muted-foreground font-mono">
          internal: true
        </div>
      )}
    </div>
  );
}
