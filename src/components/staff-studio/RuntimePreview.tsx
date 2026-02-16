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
import { Separator } from '@/components/ui/separator';
import { 
  Wrench, 
  Receipt, 
  AlertTriangle, 
  Link2, 
  FileCheck,
  ChevronRight,
  Shield,
  Zap,
  Server,
  CheckCircle,
  Inbox
} from 'lucide-react';

interface RuntimePreviewProps {
  member: StaffMember;
  config: StaffRuntimeConfig;
  toolCatalog: ToolCatalogEntry[];
  skillpack: SkillpackRef | null;
}

const riskColors: Record<RiskLevel, string> = {
  low: 'bg-success/20 text-success',
  medium: 'bg-warning/20 text-warning',
  high: 'bg-destructive/20 text-destructive',
  critical: 'bg-destructive/30 text-destructive',
};

const PIPELINE_STEPS = [
  { label: 'Request', icon: Inbox },
  { label: 'Policy', icon: Shield },
  { label: 'Queue', icon: CheckCircle },
  { label: 'Outbox', icon: Zap },
  { label: 'Provider', icon: Server },
  { label: 'Receipts', icon: Receipt },
];

export function RuntimePreview({ 
  member, 
  config, 
  toolCatalog,
  skillpack 
}: RuntimePreviewProps) {
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

  return (
    <div className="h-full flex flex-col bg-surface-1 border-l border-border">
      <div className="p-4 border-b border-border">
        <h2 className="text-sm font-semibold text-foreground">
          {isOperator ? 'What This Looks Like' : 'Runtime Preview'}
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          {isOperator ? 'Preview of effective configuration' : 'Computed effective_config view'}
        </p>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Mini Pipeline */}
          <Card className="bg-surface-2 border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {isOperator ? 'How Actions Flow' : 'Trust Spine Pipeline'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                {PIPELINE_STEPS.map((step, idx) => (
                  <div key={step.label} className="flex items-center">
                    <div className="flex flex-col items-center">
                      <step.icon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-[9px] text-muted-foreground mt-1">
                        {step.label}
                      </span>
                    </div>
                    {idx < PIPELINE_STEPS.length - 1 && (
                      <ChevronRight className="h-3 w-3 text-border mx-1" />
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Effective Tools */}
          <Card className="bg-surface-2 border-border">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Wrench className="h-4 w-4 text-primary" />
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {isOperator ? 'Available Actions' : 'Effective Tools'}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {effectiveTools.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  {isOperator ? 'No actions enabled' : 'effective_tools: []'}
                </p>
              ) : (
                <div className="space-y-1.5">
                  {effectiveTools.map((tool) => (
                    <div 
                      key={tool.name}
                      className="flex items-center justify-between py-1"
                    >
                      <span className="text-xs text-foreground">
                        {isOperator 
                          ? tool.name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
                          : tool.name
                        }
                      </span>
                      <div className="flex items-center gap-1">
                        <Badge className={cn('text-[9px] px-1', riskColors[tool.risk])}>
                          {tool.risk}
                        </Badge>
                        {tool.receipted && (
                          <FileCheck className="h-3 w-3 text-success" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Expected Receipts */}
          <Card className="bg-surface-2 border-border">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Receipt className="h-4 w-4 text-success" />
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {isOperator ? 'Proof Trail' : 'Expected Receipts'}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {expectedReceipts.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  {isOperator ? 'No proof records expected' : 'expected_receipts: []'}
                </p>
              ) : (
                <div className="space-y-1">
                  {expectedReceipts.map((receipt) => (
                    <p key={receipt} className="text-xs font-mono text-muted-foreground">
                      {receipt}
                    </p>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Risk Summary */}
          <Card className="bg-surface-2 border-border">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-warning" />
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {isOperator ? 'Risk Profile' : 'Risk Summary'}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-2">
                {(Object.entries(riskSummary) as [RiskLevel, number][]).map(([level, count]) => (
                  <div 
                    key={level}
                    className={cn(
                      'text-center p-2 rounded-lg',
                      riskColors[level]
                    )}
                  >
                    <p className="text-lg font-semibold">{count}</p>
                    <p className="text-[10px] uppercase">
                      {isOperator ? level.charAt(0).toUpperCase() + level.slice(1) : level}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Linked Skillpack */}
          {skillpack && (
            <Card className="bg-surface-2 border-border">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Link2 className="h-4 w-4 text-primary" />
                  <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {isOperator ? 'Skill Set' : 'Linked Skillpack'}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">
                    {skillpack.name}
                  </p>
                  {!isOperator && (
                    <p className="text-xs font-mono text-muted-foreground">
                      {skillpack.skillpack_id}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {skillpack.description}
                  </p>
                  <div className="flex gap-2 mt-2">
                    <Badge variant="outline" className="text-[10px]">
                      {isOperator ? skillpack.channel : `channel: ${skillpack.channel}`}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      v{skillpack.version}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Provider Lane */}
          {config.provider_bindings.length > 0 && (
            <Card className="bg-surface-2 border-border">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Server className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {isOperator ? 'Services Used' : 'Provider Lane'}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1.5">
                  {config.provider_bindings.map((binding) => (
                    <Badge 
                      key={binding.provider_id}
                      variant="outline"
                      className={cn(
                        'text-[10px]',
                        binding.connection_status === 'connected' && 'border-success/50 text-success'
                      )}
                    >
                      {binding.provider_id}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
