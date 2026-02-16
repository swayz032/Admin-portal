import { cn } from '@/lib/utils';
import { useSystem } from '@/contexts/SystemContext';
import type { 
  StaffMember, 
  StaffRuntimeConfig, 
  ToolCatalogEntry,
  SkillpackRef,
  RiskLevel 
} from '@/contracts/ecosystem';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Wrench, 
  Receipt, 
  Link2, 
  FileCheck,
  Shield,
  Zap,
  Server,
  CheckCircle,
  Inbox,
  AlertTriangle,
  TrendingUp
} from 'lucide-react';

interface EffectiveConfigProps {
  member: StaffMember;
  config: StaffRuntimeConfig;
  toolCatalog: ToolCatalogEntry[];
  skillpack: SkillpackRef | null;
}

const riskColors: Record<RiskLevel, string> = {
  low: 'bg-success/20 text-success border-success/30',
  medium: 'bg-warning/20 text-warning border-warning/30',
  high: 'bg-destructive/20 text-destructive border-destructive/30',
  critical: 'bg-destructive/30 text-destructive border-destructive/40',
};

const PIPELINE_STEPS = [
  { id: 'request', label: 'Request', icon: Inbox, color: 'from-blue-500 to-blue-600' },
  { id: 'policy', label: 'Policy', icon: Shield, color: 'from-purple-500 to-purple-600' },
  { id: 'queue', label: 'Queue', icon: CheckCircle, color: 'from-cyan-500 to-cyan-600' },
  { id: 'outbox', label: 'Outbox', icon: Zap, color: 'from-amber-500 to-amber-600' },
  { id: 'provider', label: 'Provider', icon: Server, color: 'from-green-500 to-green-600' },
  { id: 'receipts', label: 'Receipts', icon: Receipt, color: 'from-emerald-500 to-emerald-600' },
];

export function EffectiveConfig({ 
  member, 
  config, 
  toolCatalog,
  skillpack 
}: EffectiveConfigProps) {
  const { viewMode } = useSystem();
  const isOperator = viewMode === 'operator';

  // Compute effective tools
  const effectiveTools = toolCatalog.filter(tool => 
    config.tool_policy.allowlist.includes(tool.name) ||
    config.tool_policy.allowlist.includes('*')
  );

  // Compute expected receipts
  const expectedReceipts = effectiveTools
    .filter(tool => tool.receipted)
    .map(tool => `${member.default_skillpack_id || member.staff_id}.${tool.name}`);

  // Compute risk summary
  const riskSummary = effectiveTools.reduce(
    (acc, tool) => {
      acc[tool.risk] = (acc[tool.risk] || 0) + 1;
      return acc;
    },
    { low: 0, medium: 0, high: 0, critical: 0 } as Record<RiskLevel, number>
  );

  const highRiskCount = riskSummary.high + riskSummary.critical;
  const approvalCount = config.approval_rules.filter(r => r.requires_approval).length;

  return (
    <div className="h-full flex flex-col bg-surface-1">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-gradient-to-r from-surface-2/80 to-transparent">
        <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider">
          {isOperator ? 'Effective Configuration' : 'Runtime Preview'}
        </h2>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          {isOperator ? 'What this agent will do' : 'Computed effective_config'}
        </p>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 xl:p-4 space-y-3">
          {/* Premium Trust Spine Pipeline */}
          <Card className="bg-card border-border overflow-hidden">
            <CardHeader className="pb-2 pt-3 px-4 bg-gradient-to-r from-primary/5 to-transparent">
              <CardTitle className="text-[10px] font-semibold text-primary uppercase tracking-wider">
                {isOperator ? 'Action Pipeline' : 'Trust Spine'}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="relative pt-2">
                {/* Animated connecting line */}
                <div className="absolute top-[22px] left-[18px] right-[18px] h-0.5 bg-gradient-to-r from-primary/20 via-primary/40 to-primary/20" />
                <div 
                  className="absolute top-[22px] left-[18px] right-[18px] h-0.5 bg-gradient-to-r from-primary via-primary to-primary opacity-50"
                  style={{
                    backgroundSize: '200% 100%',
                    animation: 'shimmer 3s linear infinite',
                  }}
                />
                
                <div className="relative flex items-start justify-between">
                  {PIPELINE_STEPS.map((step, idx) => {
                    const StepIcon = step.icon;
                    return (
                      <div 
                        key={step.id} 
                        className="flex flex-col items-center group"
                        style={{ animationDelay: `${idx * 100}ms` }}
                      >
                        <div className={cn(
                          'relative h-9 w-9 rounded-full flex items-center justify-center',
                          'bg-gradient-to-br', step.color,
                          'shadow-lg group-hover:scale-110 transition-transform duration-200',
                          'ring-2 ring-background'
                        )}>
                          <StepIcon className="h-4 w-4 text-white drop-shadow" />
                          {/* Glow effect on hover */}
                          <div className={cn(
                            'absolute inset-0 rounded-full opacity-0 group-hover:opacity-100',
                            'bg-gradient-to-br', step.color, 'blur-md transition-opacity'
                          )} />
                        </div>
                        <span className="text-[9px] text-muted-foreground mt-2 font-medium text-center whitespace-nowrap">
                          {step.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Premium Stats Grid */}
          <div className="grid grid-cols-2 gap-3">
            <Card className={cn(
              'border-border overflow-hidden',
              'bg-gradient-to-br from-card to-surface-2'
            )}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Wrench className="h-4 w-4 text-primary" />
                  </div>
                  <TrendingUp className="h-3 w-3 text-success" />
                </div>
                <p className="text-2xl font-bold text-foreground">{effectiveTools.length}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                  {isOperator ? 'Active Tools' : 'effective_tools'}
                </p>
              </CardContent>
            </Card>
            
            <Card className={cn(
              'border-border overflow-hidden',
              highRiskCount > 0 
                ? 'bg-gradient-to-br from-warning/10 to-warning/5 border-warning/20' 
                : 'bg-gradient-to-br from-success/10 to-success/5 border-success/20'
            )}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className={cn(
                    'h-8 w-8 rounded-lg flex items-center justify-center',
                    highRiskCount > 0 ? 'bg-warning/20' : 'bg-success/20'
                  )}>
                    <AlertTriangle className={cn(
                      'h-4 w-4',
                      highRiskCount > 0 ? 'text-warning' : 'text-success'
                    )} />
                  </div>
                </div>
                <p className={cn(
                  'text-2xl font-bold',
                  highRiskCount > 0 ? 'text-warning' : 'text-success'
                )}>
                  {highRiskCount}
                </p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                  {isOperator ? 'High Risk' : 'risk: high+critical'}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Enabled Tools List */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-2 pt-3 px-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center">
                    <Wrench className="h-3 w-3 text-primary" />
                  </div>
                  <CardTitle className="text-xs font-semibold text-foreground">
                    {isOperator ? 'Enabled Tools' : 'Effective Tools'}
                  </CardTitle>
                </div>
                <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px]">
                  {effectiveTools.length}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {effectiveTools.length === 0 ? (
                <div className="py-4 text-center">
                  <p className="text-xs text-muted-foreground">
                    {isOperator ? 'No tools enabled' : 'effective_tools: []'}
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {effectiveTools.slice(0, 6).map((tool) => (
                    <div 
                      key={tool.name}
                      className={cn(
                        'flex items-center justify-between py-2 px-3 rounded-lg',
                        'bg-surface-1/50 hover:bg-surface-1 transition-colors'
                      )}
                    >
                      <span className="text-xs text-foreground truncate flex-1 font-medium">
                        {isOperator 
                          ? tool.name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
                          : tool.name
                        }
                      </span>
                      <div className="flex items-center gap-1.5 ml-2">
                        <Badge variant="outline" className={cn('text-[9px] px-1.5 h-4', riskColors[tool.risk])}>
                          {tool.risk}
                        </Badge>
                        {tool.receipted && (
                          <FileCheck className="h-3.5 w-3.5 text-success" />
                        )}
                      </div>
                    </div>
                  ))}
                  {effectiveTools.length > 6 && (
                    <p className="text-[10px] text-muted-foreground pt-1 text-center">
                      +{effectiveTools.length - 6} more tools
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Approval Rules Summary */}
          {approvalCount > 0 && (
            <Card className="bg-card border-border">
              <CardHeader className="pb-2 pt-3 px-4">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-md bg-warning/10 flex items-center justify-center">
                    <Shield className="h-3 w-3 text-warning" />
                  </div>
                  <CardTitle className="text-xs font-semibold text-foreground">
                    {isOperator ? 'Requires Approval' : 'Approval Rules'}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="space-y-1.5">
                  {config.approval_rules.filter(r => r.requires_approval).map((rule, idx) => (
                    <div key={idx} className="flex items-center justify-between py-2 px-3 rounded-lg bg-surface-1/50">
                      <span className="text-xs text-foreground font-medium">
                        {isOperator 
                          ? rule.action_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
                          : rule.action_type
                        }
                      </span>
                      <Badge variant="outline" className="text-[10px] h-5 bg-warning/10 text-warning border-warning/20">
                        {isOperator 
                          ? (rule.approval_mode === 'voice_confirm' ? 'Live' : 'Queue')
                          : rule.approval_mode
                        }
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Expected Receipts / Proof Trail */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-2 pt-3 px-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-md bg-success/10 flex items-center justify-center">
                    <Receipt className="h-3 w-3 text-success" />
                  </div>
                  <CardTitle className="text-xs font-semibold text-foreground">
                    {isOperator ? 'Proof Trail' : 'Expected Receipts'}
                  </CardTitle>
                </div>
                <Badge className="bg-success/10 text-success border-success/20 text-[10px]">
                  {expectedReceipts.length}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {expectedReceipts.length === 0 ? (
                <div className="py-4 text-center">
                  <p className="text-xs text-muted-foreground">
                    {isOperator ? 'No proof records configured' : 'expected_receipts: []'}
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  {expectedReceipts.slice(0, 4).map((receipt) => (
                    <div 
                      key={receipt} 
                      className="flex items-center gap-2 py-1.5 px-2 rounded bg-surface-1/50"
                    >
                      <FileCheck className="h-3 w-3 text-success shrink-0" />
                      <p className="text-[10px] font-mono text-muted-foreground truncate">
                        {receipt}
                      </p>
                    </div>
                  ))}
                  {expectedReceipts.length > 4 && (
                    <p className="text-[10px] text-muted-foreground pt-1 text-center">
                      +{expectedReceipts.length - 4} more receipts
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Provider Bindings */}
          {config.provider_bindings.length > 0 && (
            <Card className="bg-card border-border">
              <CardHeader className="pb-2 pt-3 px-4">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-md bg-muted flex items-center justify-center">
                    <Server className="h-3 w-3 text-muted-foreground" />
                  </div>
                  <CardTitle className="text-xs font-semibold text-foreground">
                    {isOperator ? 'Connected Services' : 'Provider Bindings'}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="flex flex-wrap gap-1.5">
                  {config.provider_bindings.map((binding) => (
                    <Badge 
                      key={binding.provider_id}
                      variant="outline"
                      className={cn(
                        'text-[10px] gap-1',
                        binding.connection_status === 'connected' && 'border-success/50 text-success bg-success/5'
                      )}
                    >
                      <div className={cn(
                        'h-1.5 w-1.5 rounded-full',
                        binding.connection_status === 'connected' ? 'bg-success' : 'bg-muted-foreground'
                      )} />
                      {binding.provider_id}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Linked Skillpack */}
          {skillpack && (
            <Card className="bg-card border-border">
              <CardHeader className="pb-2 pt-3 px-4">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center">
                    <Link2 className="h-3 w-3 text-primary" />
                  </div>
                  <CardTitle className="text-xs font-semibold text-foreground">
                    {isOperator ? 'Skill Set' : 'Skillpack'}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <p className="text-sm font-medium text-foreground">
                  {skillpack.name}
                </p>
                {!isOperator && (
                  <p className="text-[10px] font-mono text-muted-foreground mt-1">
                    {skillpack.skillpack_id}
                  </p>
                )}
                <div className="flex gap-1.5 mt-2">
                  <Badge variant="outline" className="text-[10px] h-5">
                    {skillpack.channel}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] h-5">
                    v{skillpack.version}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
