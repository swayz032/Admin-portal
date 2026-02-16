import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useSystem } from '@/contexts/SystemContext';
import { 
  BuilderState, 
  DEFAULT_CAPABILITIES, 
  AVAILABLE_TOOLS, 
  AGENT_TEMPLATES,
  RiskTier,
  RequiredPresence,
} from '@/contracts/control-plane';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Check, ChevronDown, X, Plus } from 'lucide-react';

interface StepProps {
  state: BuilderState;
  onChange: (updates: Partial<BuilderState>) => void;
}

// ============================================================================
// STEP 1: IDENTITY
// ============================================================================

export function IdentityStep({ state, onChange }: StepProps) {
  const { viewMode } = useSystem();
  const isOperator = viewMode === 'operator';
  const [showNotes, setShowNotes] = useState(false);

  const handleTemplateChange = (templateId: string) => {
    const template = AGENT_TEMPLATES.find(t => t.id === templateId);
    if (template) {
      onChange({ template: templateId, ...template.defaults });
    } else {
      onChange({ template: templateId });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-1">
          {isOperator ? 'Name Your Agent' : 'Identity Configuration'}
        </h2>
        <p className="text-sm text-muted-foreground">
          {isOperator 
            ? 'Give your agent a clear name and description.'
            : 'Configure registry item identity and metadata.'}
        </p>
      </div>

      {/* Template Selector */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground uppercase tracking-wide">
          {isOperator ? 'Start from a template' : 'Template'}
        </Label>
        <div className="grid grid-cols-2 gap-2">
          {AGENT_TEMPLATES.map(template => (
            <button
              key={template.id}
              onClick={() => handleTemplateChange(template.id)}
              className={cn(
                'p-3 rounded-lg border text-left transition-all',
                state.template === template.id 
                  ? 'border-primary/50 bg-primary/5' 
                  : 'border-border hover:border-border/80 hover:bg-accent/20'
              )}
            >
              <div className="text-sm font-medium text-foreground">{template.name}</div>
              <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                {template.description}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Name */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground uppercase tracking-wide">
          {isOperator ? 'Agent Name' : 'Name'} *
        </Label>
        <Input
          value={state.name}
          onChange={e => onChange({ name: e.target.value })}
          placeholder={isOperator ? 'e.g., Invoice Processor' : 'registry_item_name'}
        />
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground uppercase tracking-wide">
          {isOperator ? 'What does it do?' : 'Description'} *
        </Label>
        <Textarea
          value={state.description}
          onChange={e => onChange({ description: e.target.value })}
          placeholder={isOperator 
            ? 'Describe what this agent does...'
            : 'Brief description of agent functionality'}
          rows={3}
        />
      </div>

      {/* Category */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground uppercase tracking-wide">Category</Label>
        <Select value={state.category} onValueChange={v => onChange({ category: v })}>
          <SelectTrigger>
            <SelectValue placeholder="Select a category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="operations">Operations</SelectItem>
            <SelectItem value="finance">Finance</SelectItem>
            <SelectItem value="sales">Sales</SelectItem>
            <SelectItem value="support">Support</SelectItem>
            <SelectItem value="legal">Legal</SelectItem>
            <SelectItem value="engineering">Engineering</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Internal Toggle */}
      <div className="flex items-center justify-between py-3 px-4 rounded-lg bg-accent/30">
        <div>
          <div className="text-sm font-medium text-foreground">
            {isOperator ? 'Internal only' : 'Internal Flag'}
          </div>
          <div className="text-xs text-muted-foreground">
            {isOperator ? 'Only visible to your team' : 'internal: true restricts visibility'}
          </div>
        </div>
        <Switch
          checked={state.internal}
          onCheckedChange={checked => onChange({ internal: checked })}
        />
      </div>

      {/* Notes */}
      <Collapsible open={showNotes} onOpenChange={setShowNotes}>
        <CollapsibleTrigger asChild>
          <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', showNotes && 'rotate-180')} />
            {isOperator ? 'Add internal notes' : 'Internal Notes'}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3">
          <Textarea
            value={state.notes}
            onChange={e => onChange({ notes: e.target.value })}
            placeholder="Internal notes for your team..."
            rows={3}
          />
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

// ============================================================================
// STEP 2: CAPABILITIES
// ============================================================================

export function CapabilitiesStep({ state, onChange }: StepProps) {
  const { viewMode } = useSystem();
  const isOperator = viewMode === 'operator';
  const [toolSearch, setToolSearch] = useState('');
  const [expandedCategory, setExpandedCategory] = useState<string | null>('communication');

  const capabilities = state.capabilities.length > 0 ? state.capabilities : DEFAULT_CAPABILITIES;

  const handleCapabilityToggle = (capId: string, enabled: boolean) => {
    const updated = capabilities.map(c => c.id === capId ? { ...c, enabled } : c);
    onChange({ capabilities: updated });
  };

  const handleToolToggle = (toolId: string) => {
    const current = state.tool_allowlist;
    const updated = current.includes(toolId)
      ? current.filter(t => t !== toolId)
      : [...current, toolId];
    onChange({ tool_allowlist: updated });
  };

  const toolCategories = ['communication', 'data', 'finance', 'crm', 'automation'] as const;
  
  const filteredTools = AVAILABLE_TOOLS.filter(t => 
    !toolSearch || 
    t.name.toLowerCase().includes(toolSearch.toLowerCase()) ||
    t.description.toLowerCase().includes(toolSearch.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-1">
          {isOperator ? 'What Can It Do?' : 'Capabilities & Tools'}
        </h2>
        <p className="text-sm text-muted-foreground">
          {isOperator 
            ? 'Choose what actions this agent is allowed to perform.'
            : 'Configure capability flags and tool allowlist.'}
        </p>
      </div>

      {/* Capability Cards */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground uppercase tracking-wide">
          {isOperator ? 'Core Capabilities' : 'Capability Flags'}
        </Label>
        <div className="space-y-2">
          {capabilities.map(cap => (
            <div
              key={cap.id}
              className={cn(
                'flex items-center justify-between p-3.5 rounded-lg border transition-all',
                cap.enabled ? 'border-primary/30 bg-primary/5' : 'border-border'
              )}
            >
              <div>
                <div className="text-sm font-medium text-foreground">{cap.name}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{cap.description}</div>
              </div>
              <Switch
                checked={cap.enabled}
                onCheckedChange={checked => handleCapabilityToggle(cap.id, checked)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Tool Allowlist */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-foreground uppercase tracking-wide">
            {isOperator ? 'Allowed Tools' : 'Tool Allowlist'}
          </Label>
          <span className="text-xs text-muted-foreground">
            {state.tool_allowlist.length} selected
          </span>
        </div>
        
        <Input
          placeholder="Search tools..."
          value={toolSearch}
          onChange={e => setToolSearch(e.target.value)}
        />

        <div className="space-y-1.5 max-h-72 overflow-y-auto">
          {toolCategories.map(category => {
            const categoryTools = filteredTools.filter(t => t.category === category);
            if (categoryTools.length === 0) return null;
            
            return (
              <Collapsible 
                key={category}
                open={expandedCategory === category}
                onOpenChange={() => setExpandedCategory(expandedCategory === category ? null : category)}
              >
                <CollapsibleTrigger className="flex items-center justify-between w-full p-2.5 rounded-lg bg-accent/30 hover:bg-accent/50 transition-colors">
                  <span className="text-sm font-medium text-foreground capitalize">{category}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {categoryTools.filter(t => state.tool_allowlist.includes(t.id)).length}/{categoryTools.length}
                    </span>
                    <ChevronDown className={cn(
                      'h-3.5 w-3.5 text-muted-foreground transition-transform',
                      expandedCategory === category && 'rotate-180'
                    )} />
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-1 pl-2 space-y-0.5">
                  {categoryTools.map(tool => (
                    <label
                      key={tool.id}
                      className="flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-accent/20 transition-colors"
                    >
                      <Checkbox
                        checked={state.tool_allowlist.includes(tool.id)}
                        onCheckedChange={() => handleToolToggle(tool.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-foreground">{tool.name}</div>
                        <div className="text-xs text-muted-foreground">{tool.description}</div>
                      </div>
                      <span className={cn(
                        'text-[10px] px-1.5 py-0.5 rounded font-medium',
                        tool.risk_level === 'high' && 'bg-destructive/10 text-destructive',
                        tool.risk_level === 'medium' && 'bg-warning/10 text-warning',
                        tool.risk_level === 'low' && 'bg-success/10 text-success',
                      )}>
                        {tool.risk_level}
                      </span>
                    </label>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// STEP 3: GOVERNANCE
// ============================================================================

export function GovernanceStep({ state, onChange }: StepProps) {
  const { viewMode } = useSystem();
  const isOperator = viewMode === 'operator';
  const [newConstraint, setNewConstraint] = useState('');

  const riskOptions: { value: RiskTier; label: string; description: string }[] = [
    { 
      value: 'low', 
      label: isOperator ? 'Low Risk' : 'Low',
      description: isOperator 
        ? 'Can run automatically with minimal oversight'
        : 'Minimal approval requirements'
    },
    { 
      value: 'medium', 
      label: isOperator ? 'Medium Risk' : 'Medium',
      description: isOperator
        ? 'Requires periodic review and monitoring'
        : 'Standard approval workflow'
    },
    { 
      value: 'high', 
      label: isOperator ? 'High Risk' : 'High',
      description: isOperator
        ? 'Requires approval for most actions'
        : 'Strict approval requirements'
    },
  ];

  const addConstraint = () => {
    if (newConstraint.trim()) {
      onChange({ constraints: [...state.constraints, newConstraint.trim()] });
      setNewConstraint('');
    }
  };

  const removeConstraint = (index: number) => {
    onChange({ constraints: state.constraints.filter((_, i) => i !== index) });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-1">
          {isOperator ? 'Safety & Controls' : 'Governance Configuration'}
        </h2>
        <p className="text-sm text-muted-foreground">
          {isOperator 
            ? 'Set safety rules and approval requirements.'
            : 'Configure risk tier, approval policies, and constraints.'}
        </p>
      </div>

      {/* Risk Tier */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground uppercase tracking-wide">
          {isOperator ? 'Safety Level' : 'Risk Tier'}
        </Label>
        <div className="space-y-2">
          {riskOptions.map(option => (
            <button
              key={option.value}
              onClick={() => onChange({ risk_tier: option.value })}
              className={cn(
                'flex items-center gap-3 w-full p-3.5 rounded-lg border text-left transition-all',
                state.risk_tier === option.value 
                  ? 'border-primary/30 bg-primary/5' 
                  : 'border-border hover:border-border/80'
              )}
            >
              <div className={cn(
                'w-2 h-2 rounded-full shrink-0',
                option.value === 'low' && 'bg-success',
                option.value === 'medium' && 'bg-warning',
                option.value === 'high' && 'bg-destructive'
              )} />
              <div>
                <div className="text-sm font-medium text-foreground">{option.label}</div>
                <div className="text-xs text-muted-foreground">{option.description}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Approval Required */}
      <div className="flex items-center justify-between p-3.5 rounded-lg bg-accent/30">
        <div>
          <div className="text-sm font-medium text-foreground">
            {isOperator ? 'Require my approval' : 'Approval Required'}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {isOperator 
              ? 'Actions must be approved before they run'
              : 'approval_required: true adds to Authority Queue'}
          </div>
        </div>
        <Switch
          checked={state.approval_required}
          onCheckedChange={checked => onChange({ approval_required: checked })}
        />
      </div>

      {/* Required Presence */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground uppercase tracking-wide">
          {isOperator ? 'Presence Required' : 'Required Presence'}
        </Label>
        <Select 
          value={state.required_presence} 
          onValueChange={(v: RequiredPresence) => onChange({ required_presence: v })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">{isOperator ? 'No presence required' : 'none'}</SelectItem>
            <SelectItem value="voice">{isOperator ? 'Voice available' : 'voice'}</SelectItem>
            <SelectItem value="video">{isOperator ? 'Video available' : 'video'}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Constraints */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground uppercase tracking-wide">
          {isOperator ? 'Rules & Limits' : 'Constraints'}
        </Label>
        
        <div className="flex gap-2">
          <Input
            value={newConstraint}
            onChange={e => setNewConstraint(e.target.value)}
            placeholder={isOperator 
              ? 'Add a rule, e.g., "Cannot send more than 10 emails per hour"'
              : 'Add constraint...'}
            onKeyDown={e => e.key === 'Enter' && addConstraint()}
          />
          <Button onClick={addConstraint} size="icon" variant="outline" className="shrink-0">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        
        {state.constraints.length > 0 ? (
          <div className="space-y-1.5">
            {state.constraints.map((constraint, index) => (
              <div key={index} className="flex items-center justify-between p-2.5 rounded-lg bg-accent/30">
                <span className="text-sm text-foreground">{constraint}</span>
                <button
                  className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors"
                  onClick={() => removeConstraint(index)}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {isOperator ? 'No rules added yet.' : 'No constraints defined.'}
          </p>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// STEP 4: PROMPT & CONFIG
// ============================================================================

export function PromptStep({ state, onChange }: StepProps) {
  const { viewMode } = useSystem();
  const isOperator = viewMode === 'operator';
  const [showVariables, setShowVariables] = useState(false);
  const charCount = state.prompt_content.length;
  const maxChars = 10000;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-1">
          {isOperator ? 'Instructions' : 'Prompt & Config'}
        </h2>
        <p className="text-sm text-muted-foreground">
          {isOperator 
            ? 'Tell your agent how to behave and what to do.'
            : 'Configure versioned prompt and config variables.'}
        </p>
      </div>

      {/* Version */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground uppercase tracking-wide">Version</Label>
        <Input
          value={state.prompt_version}
          onChange={e => onChange({ prompt_version: e.target.value })}
          placeholder="1.0.0"
          className="w-32"
        />
      </div>

      {/* Prompt Content */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-foreground uppercase tracking-wide">
            {isOperator ? 'Agent Instructions' : 'Prompt Content'}
          </Label>
          <span className={cn(
            'text-xs',
            charCount > maxChars * 0.9 ? 'text-warning' : 'text-muted-foreground'
          )}>
            {charCount.toLocaleString()} / {maxChars.toLocaleString()}
          </span>
        </div>
        <Textarea
          value={state.prompt_content}
          onChange={e => onChange({ prompt_content: e.target.value })}
          placeholder={isOperator
            ? 'Write instructions for your agent...'
            : 'System prompt content...'}
          rows={14}
          className="font-mono text-sm resize-none"
        />
      </div>

      {/* Config Variables */}
      <Collapsible open={showVariables} onOpenChange={setShowVariables}>
        <CollapsibleTrigger asChild>
          <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', showVariables && 'rotate-180')} />
            {isOperator ? 'Advanced: Variables' : 'Config Variables'}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3">
          <div className="bg-accent/30 p-4 rounded-lg">
            <pre className="text-xs font-mono text-muted-foreground overflow-x-auto">
              {JSON.stringify(state.config_variables, null, 2) || '{}'}
            </pre>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

// ============================================================================
// STEP 5: REVIEW
// ============================================================================

export function ReviewStep({ state }: StepProps) {
  const { viewMode } = useSystem();
  const isOperator = viewMode === 'operator';
  const enabledCapabilities = state.capabilities.filter(c => c.enabled);

  const sections = [
    {
      title: 'Identity',
      items: [
        { label: 'Name', value: state.name || '—' },
        { label: 'Description', value: state.description || '—' },
        { label: 'Category', value: state.category },
        { label: isOperator ? 'Internal only' : 'Internal', value: state.internal ? 'Yes' : 'No' },
      ],
    },
    {
      title: 'Capabilities',
      items: [
        { label: isOperator ? 'Enabled' : 'Capability Count', value: `${enabledCapabilities.length} capabilities` },
        { label: isOperator ? 'Tools' : 'Tool Allowlist', value: `${state.tool_allowlist.length} tools` },
      ],
    },
    {
      title: isOperator ? 'Safety' : 'Governance',
      items: [
        { label: isOperator ? 'Safety Level' : 'Risk Tier', value: state.risk_tier },
        { label: isOperator ? 'Needs Approval' : 'Approval Required', value: state.approval_required ? 'Yes' : 'No' },
        { label: isOperator ? 'Rules' : 'Constraints', value: `${state.constraints.length} defined` },
      ],
    },
    {
      title: isOperator ? 'Instructions' : 'Prompt',
      items: [
        { label: 'Version', value: state.prompt_version },
        { label: isOperator ? 'Length' : 'Char Count', value: `${state.prompt_content.length} characters` },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-1">
          {isOperator ? 'Review Your Agent' : 'Review & Propose'}
        </h2>
        <p className="text-sm text-muted-foreground">
          {isOperator 
            ? 'Check everything looks right before submitting.'
            : 'Review configuration before creating ConfigChangeProposal.'}
        </p>
      </div>

      <div className="space-y-3">
        {sections.map(section => (
          <div key={section.title} className="rounded-lg border border-border p-4">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">{section.title}</h3>
            <div className="space-y-2">
              {section.items.map(item => (
                <div key={item.label} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className="text-foreground font-medium">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-lg bg-primary/5 border border-primary/15 p-4">
        <h4 className="text-sm font-medium text-foreground mb-1">
          {isOperator ? 'What happens next?' : 'Next Steps'}
        </h4>
        <p className="text-sm text-muted-foreground">
          {isOperator
            ? 'Your agent will be saved and submitted for review. Once approved, you can deploy it.'
            : 'Creates a ConfigChangeProposal with change_type: create. Enters Authority Queue.'}
        </p>
      </div>
    </div>
  );
}
