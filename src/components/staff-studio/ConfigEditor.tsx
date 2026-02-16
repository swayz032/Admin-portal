import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useSystem } from '@/contexts/SystemContext';
import type { 
  StaffMember, 
  StaffRuntimeConfig, 
  ToolCatalogEntry,
  ProviderDef,
  SkillpackRef 
} from '@/contracts/ecosystem';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  ChevronDown, 
  Shield, 
  Wrench, 
  Link2, 
  Rocket, 
  AlertCircle,
  CheckCircle,
  Clock,
  Info
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface ConfigEditorProps {
  member: StaffMember;
  config: StaffRuntimeConfig;
  toolCatalog: ToolCatalogEntry[];
  providers: ProviderDef[];
  skillpack: SkillpackRef | null;
  onConfigChange: (config: StaffRuntimeConfig) => void;
}

const approvalModeLabels = {
  auto: { operator: 'Automatic', engineer: 'auto' },
  voice_confirm: { operator: 'Live presence required', engineer: 'voice_confirm' },
  async_approval: { operator: 'Queued for approval', engineer: 'async_approval' },
  escalate: { operator: 'Always escalate', engineer: 'escalate' },
};

const riskLabels = {
  low: { operator: 'Safe', engineer: 'low', color: 'bg-success/20 text-success' },
  medium: { operator: 'Moderate', engineer: 'medium', color: 'bg-warning/20 text-warning' },
  high: { operator: 'High impact', engineer: 'high', color: 'bg-destructive/20 text-destructive' },
  critical: { operator: 'Critical', engineer: 'critical', color: 'bg-destructive/30 text-destructive' },
};

const rolloutLabels = {
  draft: { operator: 'Draft', engineer: 'draft' },
  proposed: { operator: 'Pending Review', engineer: 'proposed' },
  active: { operator: 'Live', engineer: 'active' },
  paused: { operator: 'Paused', engineer: 'paused' },
  deprecated: { operator: 'Retired', engineer: 'deprecated' },
};

export function ConfigEditor({ 
  member, 
  config, 
  toolCatalog, 
  providers,
  skillpack,
  onConfigChange 
}: ConfigEditorProps) {
  const { viewMode } = useSystem();
  const isOperator = viewMode === 'operator';
  const [sectionsOpen, setSectionsOpen] = useState({
    status: true,
    thresholds: true,
    approval: true,
    tools: true,
    providers: true,
    rollout: true,
  });

  const toggleSection = (section: keyof typeof sectionsOpen) => {
    setSectionsOpen(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const renderSectionHeader = (
    title: string, 
    icon: React.ReactNode, 
    section: keyof typeof sectionsOpen,
    tooltip?: string
  ) => (
    <CollapsibleTrigger className="w-full" onClick={() => toggleSection(section)}>
      <div className="flex items-center justify-between p-4 hover:bg-accent/30 rounded-t-lg transition-colors">
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-medium text-sm">{title}</span>
          {tooltip && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">{tooltip}</TooltipContent>
            </Tooltip>
          )}
        </div>
        <ChevronDown className={cn(
          'h-4 w-4 text-muted-foreground transition-transform',
          sectionsOpen[section] && 'rotate-180'
        )} />
      </div>
    </CollapsibleTrigger>
  );

  return (
    <ScrollArea className="h-full">
      <div className="p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-4 pb-4 border-b border-border">
          <span className="text-4xl">{member.avatar_emoji}</span>
          <div>
            <h2 className="text-xl font-semibold text-foreground">{member.name}</h2>
            <p className="text-sm text-muted-foreground">
              {isOperator ? member.title : `${member.staff_id} • ${member.role}`}
            </p>
            {skillpack && (
              <p className="text-xs text-primary mt-1">
                {isOperator ? `Using: ${skillpack.name}` : `skillpack: ${skillpack.skillpack_id}`}
              </p>
            )}
          </div>
        </div>

        {/* Enable/Disable */}
        <Collapsible open={sectionsOpen.status}>
          <Card className="border-border bg-surface-2">
            {renderSectionHeader(
              isOperator ? 'Status' : 'Enabled State',
              <CheckCircle className="h-4 w-4 text-success" />,
              'status',
              isOperator ? 'Turn this team member on or off' : 'Controls staff.enabled flag'
            )}
            <CollapsibleContent>
              <CardContent className="pt-0">
                <div className="flex items-center justify-between py-2">
                  <div>
                    <Label className="text-sm font-medium">
                      {isOperator ? 'Enable this team member' : 'enabled'}
                    </Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {isOperator 
                        ? 'When enabled, this team member can handle tasks'
                        : 'When true, staff participates in task routing'
                      }
                    </p>
                  </div>
                  <Switch
                    checked={config.enabled}
                    onCheckedChange={(enabled) => onConfigChange({ ...config, enabled })}
                  />
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Thresholds */}
        {Object.keys(config.thresholds).length > 0 && (
          <Collapsible open={sectionsOpen.thresholds}>
            <Card className="border-border bg-surface-2">
              {renderSectionHeader(
                isOperator ? 'Limits & Thresholds' : 'Thresholds',
                <AlertCircle className="h-4 w-4 text-warning" />,
                'thresholds',
                isOperator ? 'Set limits for automatic actions' : 'Numeric thresholds for policy enforcement'
              )}
              <CollapsibleContent>
                <CardContent className="pt-0 space-y-4">
                  {Object.entries(config.thresholds).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between gap-4">
                      <div className="flex-1">
                        <Label className="text-sm font-medium">
                          {isOperator 
                            ? key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
                            : key
                          }
                        </Label>
                      </div>
                      <Input
                        type="number"
                        value={value}
                        onChange={(e) => onConfigChange({
                          ...config,
                          thresholds: { ...config.thresholds, [key]: Number(e.target.value) }
                        })}
                        className="w-24 h-8 text-sm"
                      />
                    </div>
                  ))}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        )}

        {/* Approval Rules */}
        <Collapsible open={sectionsOpen.approval}>
          <Card className="border-border bg-surface-2">
            {renderSectionHeader(
              isOperator ? 'Approval Rules' : 'Approval Config',
              <Shield className="h-4 w-4 text-primary" />,
              'approval',
              isOperator ? 'Control when you need to approve actions' : 'approval_rules[] configuration'
            )}
            <CollapsibleContent>
              <CardContent className="pt-0 space-y-3">
                {config.approval_rules.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">
                    {isOperator ? 'No special approval rules configured' : 'approval_rules: []'}
                  </p>
                ) : (
                  config.approval_rules.map((rule, idx) => (
                    <div key={idx} className="p-3 rounded-lg bg-surface-1 border border-border">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">
                          {isOperator 
                            ? rule.action_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
                            : rule.action_type
                          }
                        </span>
                        <Switch
                          checked={rule.requires_approval}
                          onCheckedChange={(checked) => {
                            const newRules = [...config.approval_rules];
                            newRules[idx] = { ...rule, requires_approval: checked };
                            onConfigChange({ ...config, approval_rules: newRules });
                          }}
                        />
                      </div>
                      {rule.requires_approval && (
                        <Select
                          value={rule.approval_mode}
                          onValueChange={(value) => {
                            const newRules = [...config.approval_rules];
                            newRules[idx] = { ...rule, approval_mode: value as any };
                            onConfigChange({ ...config, approval_rules: newRules });
                          }}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(approvalModeLabels).map(([key, labels]) => (
                              <SelectItem key={key} value={key} className="text-xs">
                                {isOperator ? labels.operator : labels.engineer}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      {rule.threshold && (
                        <p className="text-xs text-muted-foreground mt-2">
                          {isOperator 
                            ? `Required above ${rule.threshold} ${rule.threshold_unit || ''}`
                            : `threshold: ${rule.threshold} ${rule.threshold_unit || ''}`
                          }
                        </p>
                      )}
                    </div>
                  ))
                )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Tool Policy */}
        <Collapsible open={sectionsOpen.tools}>
          <Card className="border-border bg-surface-2">
            {renderSectionHeader(
              isOperator ? 'Allowed Tools' : 'Tool Policy',
              <Wrench className="h-4 w-4 text-accent-foreground" />,
              'tools',
              isOperator ? 'What this team member can do' : 'tool_policy.allowlist configuration'
            )}
            <CollapsibleContent>
              <CardContent className="pt-0">
                {toolCatalog.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">
                    {isOperator ? 'No tools available for this team member' : 'No tool catalog found'}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {toolCatalog.map((tool) => {
                      const isAllowed = config.tool_policy.allowlist.includes(tool.name) ||
                        config.tool_policy.allowlist.includes('*');
                      const risk = riskLabels[tool.risk];

                      return (
                        <div 
                          key={tool.name}
                          className="flex items-center justify-between p-2 rounded-lg bg-surface-1 border border-border"
                        >
                          <div className="flex items-center gap-3">
                            <Checkbox
                              checked={isAllowed}
                              onCheckedChange={(checked) => {
                                const newAllowlist = checked
                                  ? [...config.tool_policy.allowlist, tool.name]
                                  : config.tool_policy.allowlist.filter(t => t !== tool.name);
                                onConfigChange({
                                  ...config,
                                  tool_policy: { ...config.tool_policy, allowlist: newAllowlist }
                                });
                              }}
                            />
                            <div>
                              <p className="text-sm font-medium">
                                {isOperator 
                                  ? tool.name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
                                  : tool.name
                                }
                              </p>
                              <p className="text-xs text-muted-foreground">{tool.description}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={cn('text-[10px]', risk.color)}>
                              {isOperator ? risk.operator : risk.engineer}
                            </Badge>
                            {tool.requires_approval && (
                              <Badge variant="outline" className="text-[10px]">
                                {isOperator ? 'Approval' : 'approval_req'}
                              </Badge>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Provider Bindings */}
        <Collapsible open={sectionsOpen.providers}>
          <Card className="border-border bg-surface-2">
            {renderSectionHeader(
              isOperator ? 'Connected Services' : 'Provider Bindings',
              <Link2 className="h-4 w-4 text-muted-foreground" />,
              'providers',
              isOperator ? 'External services this team member uses' : 'provider_bindings[] configuration'
            )}
            <CollapsibleContent>
              <CardContent className="pt-0">
                {config.provider_bindings.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">
                    {isOperator ? 'No services connected' : 'provider_bindings: []'}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {config.provider_bindings.map((binding) => {
                      const provider = providers.find(p => p.provider_id === binding.provider_id);
                      const statusColor = {
                        connected: 'text-success',
                        disconnected: 'text-destructive',
                        degraded: 'text-warning',
                        pending: 'text-muted-foreground',
                      }[binding.connection_status];

                      return (
                        <div 
                          key={binding.provider_id}
                          className="flex items-center justify-between p-3 rounded-lg bg-surface-1 border border-border"
                        >
                          <div>
                            <p className="text-sm font-medium">
                              {provider?.name || binding.provider_id}
                            </p>
                            <p className={cn('text-xs', statusColor)}>
                              {isOperator 
                                ? binding.connection_status.replace(/\b\w/g, c => c.toUpperCase())
                                : `status: ${binding.connection_status}`
                              }
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="text-xs text-muted-foreground">
                              {binding.scopes.join(', ')}
                            </div>
                            <Switch
                              checked={binding.enabled}
                              disabled
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Rollout State */}
        <Collapsible open={sectionsOpen.rollout}>
          <Card className="border-border bg-surface-2">
            {renderSectionHeader(
              isOperator ? 'Deployment Status' : 'Rollout State',
              <Rocket className="h-4 w-4 text-primary" />,
              'rollout',
              isOperator ? 'Current deployment status' : 'rollout_state field'
            )}
            <CollapsibleContent>
              <CardContent className="pt-0">
                <Select
                  value={config.rollout_state}
                  onValueChange={(value) => onConfigChange({ 
                    ...config, 
                    rollout_state: value as any 
                  })}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(rolloutLabels).map(([key, labels]) => (
                      <SelectItem key={key} value={key}>
                        {isOperator ? labels.operator : labels.engineer}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-2">
                  {isOperator 
                    ? 'Last updated by ' + config.updated_by
                    : `updated_by: ${config.updated_by} @ ${config.updated_at}`
                  }
                </p>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Save Button */}
        <div className="pt-4">
          <Button className="w-full" size="lg">
            {isOperator ? 'Save Changes' : 'Update Config'}
          </Button>
        </div>
      </div>
    </ScrollArea>
  );
}
