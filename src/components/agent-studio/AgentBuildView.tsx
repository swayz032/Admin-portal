import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useSystem } from '@/contexts/SystemContext';
import type {
  StaffMember,
  StaffRuntimeConfig,
  ToolCatalogEntry,
  ProviderDef,
  SkillpackRef,
} from '@/contracts/ecosystem';
import { StaffAvatar } from './StaffAvatar';
import { PromptEditor } from './PromptEditor';
import { AgentConfigTab } from './AgentConfigTab';
import { SkillpackPromptsTab } from './SkillpackPromptsTab';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, Save, Check } from 'lucide-react';

// Avatar imports
import avaAvatar from '@/assets/staff/ava.png';
import sarahAvatar from '@/assets/staff/sarah.png';
import eliAvatar from '@/assets/staff/eli.png';
import quinnAvatar from '@/assets/staff/quinn.png';
import noraAvatar from '@/assets/staff/nora.png';
import claraAvatar from '@/assets/staff/clara.png';

const staffPhotos: Record<string, string> = {
  ava: avaAvatar,
  sarah: sarahAvatar,
  eli: eliAvatar,
  quinn: quinnAvatar,
  nora: noraAvatar,
  clara: claraAvatar,
};

interface AgentBuildViewProps {
  member: StaffMember;
  config: StaffRuntimeConfig;
  toolCatalog: ToolCatalogEntry[];
  providers: ProviderDef[];
  skillpack: SkillpackRef | null;
  onConfigChange: (config: StaffRuntimeConfig) => void;
  onBack: () => void;
}

type BuildTab = 'prompt' | 'config' | 'skillpack' | 'tools' | 'advanced';

export function AgentBuildView({
  member,
  config,
  toolCatalog,
  providers,
  skillpack,
  onConfigChange,
  onBack,
}: AgentBuildViewProps) {
  const { viewMode } = useSystem();
  const isOperator = viewMode === 'operator';
  const [activeTab, setActiveTab] = useState<BuildTab>('prompt');
  const [saved, setSaved] = useState(false);

  const photoUrl = staffPhotos[member.staff_id];

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const tabs: { id: BuildTab; label: string; operatorLabel: string }[] = [
    { id: 'prompt', label: 'Prompt', operatorLabel: 'Behavior' },
    { id: 'config', label: 'Config', operatorLabel: 'Settings' },
    { id: 'skillpack', label: 'Skillpack', operatorLabel: 'Skills' },
    { id: 'tools', label: 'Tools', operatorLabel: 'Tools' },
    { id: 'advanced', label: 'Advanced', operatorLabel: 'Advanced' },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Top bar — back + name + save — single clean header */}
      <div className="shrink-0 border-b border-border">
        <div className="flex items-center justify-between px-1 h-12">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="h-5 w-px bg-border" />
            <h1 className="text-sm font-medium text-foreground">
              {member.name}
            </h1>
            <Badge variant="outline" className="text-[11px] text-muted-foreground font-normal border-border">
              {isOperator ? member.title : member.staff_id}
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 mr-2">
              <Switch
                checked={config.enabled}
                onCheckedChange={(enabled) => onConfigChange({ ...config, enabled })}
                className="data-[state=checked]:bg-success scale-90"
              />
              <span className={cn(
                'text-xs',
                config.enabled ? 'text-success' : 'text-muted-foreground'
              )}>
                {config.enabled ? 'Active' : 'Off'}
              </span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleSave}
              className="h-7 px-3 text-xs gap-1.5 border-border"
            >
              {saved ? <Check className="h-3 w-3" /> : <Save className="h-3 w-3" />}
              {saved ? 'Saved' : 'Save'}
            </Button>
          </div>
        </div>

        {/* Tabs — clean underline style */}
        <div className="px-4 -mb-px">
          <div className="flex items-center gap-0">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'px-4 py-2 text-[13px] font-medium transition-colors',
                  'border-b-2',
                  activeTab === tab.id
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground/80'
                )}
              >
                {isOperator ? tab.operatorLabel : tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content area — fills remaining viewport, no page-level scroll */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === 'prompt' && (
          <div className="h-full flex">
            {/* Left: Agent photo — fixed width, contained */}
            <div className={cn(
              'shrink-0 flex flex-col items-center',
              'w-[280px] xl:w-[320px]',
              'border-r border-border',
              'p-5'
            )}>
              {photoUrl ? (
                <div className="w-full aspect-[4/5] max-h-[360px] rounded-xl overflow-hidden bg-surface-1">
                  <img
                    src={photoUrl}
                    alt={member.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className={cn(
                  'w-full aspect-[4/5] max-h-[360px] rounded-xl overflow-hidden',
                  'bg-gradient-to-br from-surface-1 to-surface-2',
                  'flex items-center justify-center'
                )}>
                  <StaffAvatar
                    staffId={member.staff_id}
                    name={member.name}
                    size="xl"
                  />
                </div>
              )}
              <div className="mt-3 text-center">
                <p className="text-sm font-medium text-foreground">{member.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{member.title}</p>
              </div>
            </div>

            {/* Right: Prompt editor — internal scroll */}
            <div className="flex-1 min-w-0 min-h-0">
              <PromptEditor member={member} />
            </div>
          </div>
        )}

        {activeTab === 'config' && (
          <AgentConfigTab
            member={member}
            config={config}
            toolCatalog={toolCatalog}
            providers={providers}
            skillpack={skillpack}
            onConfigChange={onConfigChange}
          />
        )}

        {activeTab === 'skillpack' && (
          <SkillpackPromptsTab member={member} skillpack={skillpack} />
        )}

        {activeTab === 'tools' && (
          <div className="max-w-4xl mx-auto p-8 space-y-4">
            <h3 className="text-base font-semibold text-foreground">
              {isOperator ? 'Active Tools' : 'Tool Policy'}
            </h3>
            <p className="text-sm text-muted-foreground">
              {toolCatalog.length} tools available for {member.name}
            </p>
            <div className="space-y-2">
              {toolCatalog.map(tool => (
                <div key={tool.name} className="flex items-center justify-between p-4 rounded-xl bg-card border border-border">
                  <div>
                    <p className="text-sm font-medium text-foreground">{tool.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{tool.description}</p>
                  </div>
                  <Badge variant="outline" className={cn(
                    'text-[11px]',
                    tool.risk === 'low' && 'bg-success/10 text-success border-success/20',
                    tool.risk === 'medium' && 'bg-warning/10 text-warning border-warning/20',
                    tool.risk === 'high' && 'bg-destructive/10 text-destructive border-destructive/20',
                    tool.risk === 'critical' && 'bg-destructive/15 text-destructive border-destructive/25',
                  )}>
                    {isOperator ? tool.risk.charAt(0).toUpperCase() + tool.risk.slice(1) : tool.risk}
                  </Badge>
                </div>
              ))}
              {toolCatalog.length === 0 && (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  No tools configured for this agent
                </p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'advanced' && (
          <div className="max-w-4xl mx-auto p-8 space-y-6">
            <h3 className="text-base font-semibold text-foreground">Advanced Configuration</h3>
            <div className="space-y-3">
              <div className="p-4 rounded-xl bg-card border border-border">
                <p className="text-sm font-medium text-foreground mb-1">Rollout State</p>
                <p className="text-xs text-muted-foreground capitalize">
                  {config.rollout_state}
                  {config.rollout_state === 'active' && ' • Live traffic'}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-card border border-border">
                <p className="text-sm font-medium text-foreground mb-1">
                  {isOperator ? 'Connected Services' : 'Provider Bindings'}
                </p>
                <div className="space-y-2 mt-2">
                  {config.provider_bindings.map(binding => (
                    <div key={binding.provider_id} className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {isOperator ? binding.provider_id.replace(/_/g, ' ') : binding.provider_id}
                      </span>
                      <Badge variant="outline" className={cn(
                        'text-[10px]',
                        binding.connection_status === 'connected'
                          ? 'bg-success/10 text-success border-success/20'
                          : 'bg-muted/50 text-muted-foreground border-border'
                      )}>
                        {binding.connection_status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-4 rounded-xl bg-card border border-border">
                <p className="text-sm font-medium text-foreground mb-1">
                  {isOperator ? 'Safety Rules' : 'Hard Rules'}
                </p>
                <ul className="space-y-1.5 mt-2">
                  {member.hard_rules.map((rule, i) => (
                    <li key={i} className="text-xs text-muted-foreground flex gap-2">
                      <span className="text-primary/60 shrink-0">•</span>
                      {rule}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
