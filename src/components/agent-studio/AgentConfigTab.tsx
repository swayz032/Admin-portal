import { cn } from '@/lib/utils';
import { useSystem } from '@/contexts/SystemContext';
import type {
  StaffMember,
  StaffRuntimeConfig,
  ToolCatalogEntry,
  ProviderDef,
  SkillpackRef,
  RiskLevel,
} from '@/contracts/ecosystem';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface AgentConfigTabProps {
  member: StaffMember;
  config: StaffRuntimeConfig;
  toolCatalog: ToolCatalogEntry[];
  providers: ProviderDef[];
  skillpack: SkillpackRef | null;
  onConfigChange: (config: StaffRuntimeConfig) => void;
}

const approvalModeLabels: Record<string, { operator: string; engineer: string }> = {
  auto: { operator: 'Automatic', engineer: 'auto' },
  voice_confirm: { operator: 'Live confirmation', engineer: 'voice_confirm' },
  async_approval: { operator: 'Queued for approval', engineer: 'async_approval' },
  escalate: { operator: 'Always escalate', engineer: 'escalate' },
};

export function AgentConfigTab({
  member,
  config,
  toolCatalog,
  providers,
  skillpack,
  onConfigChange,
}: AgentConfigTabProps) {
  const { viewMode } = useSystem();
  const isOperator = viewMode === 'operator';

  const effectiveTools = toolCatalog.filter(
    (t) =>
      config.tool_policy.allowlist.includes(t.name) ||
      config.tool_policy.allowlist.includes('*')
  );

  return (
    <div className="max-w-4xl mx-auto p-8 space-y-6">
      <h3 className="text-lg font-semibold text-foreground">
        {isOperator ? 'Settings' : 'Runtime Configuration'}
      </h3>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: isOperator ? 'Tools' : 'effective_tools', value: effectiveTools.length },
          { label: isOperator ? 'Approvals' : 'approval_rules', value: config.approval_rules.filter(r => r.requires_approval).length },
          { label: 'Channel', value: member.channel },
          { label: isOperator ? 'Visibility' : 'visibility', value: member.visibility },
        ].map((stat) => (
          <div key={stat.label} className="p-4 rounded-xl bg-card border border-border">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">{stat.label}</p>
            <p className="text-lg font-semibold text-foreground mt-1 capitalize">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Thresholds */}
      {Object.keys(config.thresholds).length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-foreground">
            {isOperator ? 'Limits & Thresholds' : 'Thresholds'}
          </h4>
          <div className="space-y-2">
            {Object.entries(config.thresholds).map(([key, value]) => (
              <div
                key={key}
                className="flex items-center justify-between p-4 rounded-xl bg-card border border-border"
              >
                <Label className="text-sm">
                  {isOperator
                    ? key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
                    : key}
                </Label>
                <Input
                  type="number"
                  value={value}
                  onChange={(e) =>
                    onConfigChange({
                      ...config,
                      thresholds: {
                        ...config.thresholds,
                        [key]: Number(e.target.value),
                      },
                    })
                  }
                  className="w-24 h-8 text-right bg-surface-1 border-border text-sm"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Approval Rules */}
      {config.approval_rules.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-foreground">
            {isOperator ? 'Approval Settings' : 'Approval Rules'}
          </h4>
          <div className="space-y-2">
              {config.approval_rules.map((rule, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-4 rounded-xl bg-card border border-border"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {isOperator
                      ? rule.action_type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
                      : rule.action_type}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Mode: {isOperator
                      ? approvalModeLabels[rule.approval_mode]?.operator || rule.approval_mode
                      : rule.approval_mode}
                  </p>
                </div>
                <Switch
                  checked={rule.requires_approval}
                  onCheckedChange={(checked) => {
                    const newRules = [...config.approval_rules];
                    newRules[idx] = { ...rule, requires_approval: checked };
                    onConfigChange({ ...config, approval_rules: newRules });
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
