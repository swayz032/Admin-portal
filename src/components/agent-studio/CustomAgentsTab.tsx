import { useState } from 'react';
import { useSystem } from '@/contexts/SystemContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { 
  Plus, 
  Sparkles, 
  Shield, 
  Wrench, 
  Receipt,
  CheckCircle,
  Bot,
  Zap,
  AlertTriangle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { tools } from '@/ecosystem/snapshot';

interface CustomAgent {
  id: string;
  name: string;
  description: string;
  status: 'draft' | 'proposed' | 'active' | 'paused';
  risk_tier: 'low' | 'medium' | 'high';
  tools: string[];
  created_at: string;
}

const MOCK_CUSTOM_AGENTS: CustomAgent[] = [];

const STEPS = [
  { id: 'purpose', label: 'Purpose', icon: Bot, description: 'Name and describe your agent' },
  { id: 'permissions', label: 'Permissions', icon: Wrench, description: 'Select tools and capabilities' },
  { id: 'governance', label: 'Governance', icon: Shield, description: 'Set approval rules' },
  { id: 'proof', label: 'Deploy', icon: Receipt, description: 'Review and create' },
];

const riskTierConfig = {
  low: { 
    label: 'Low Risk', 
    description: 'Runs automatically with minimal oversight',
    color: 'border-success/40 bg-success/5',
    icon: CheckCircle,
    iconColor: 'text-success'
  },
  medium: { 
    label: 'Medium Risk', 
    description: 'Periodic review recommended',
    color: 'border-warning/40 bg-warning/5',
    icon: AlertTriangle,
    iconColor: 'text-warning'
  },
  high: { 
    label: 'High Risk', 
    description: 'Requires approval for most actions',
    color: 'border-destructive/40 bg-destructive/5',
    icon: Shield,
    iconColor: 'text-destructive'
  },
};

export function CustomAgentsTab() {
  const { viewMode } = useSystem();
  const isOperator = viewMode === 'operator';
  const [agents] = useState<CustomAgent[]>(MOCK_CUSTOM_AGENTS);
  const [createOpen, setCreateOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    tools: [] as string[],
    risk_tier: 'low' as 'low' | 'medium' | 'high',
    approval_required: false,
  });

  const handleCreate = () => {
    setFormData({
      name: '',
      description: '',
      tools: [],
      risk_tier: 'low',
      approval_required: false,
    });
    setCurrentStep(0);
    setCreateOpen(true);
  };

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 0: return formData.name.trim().length > 0;
      case 1: return true;
      case 2: return true;
      case 3: return true;
      default: return true;
    }
  };

  const toolsByCategory = tools.reduce((acc, tool) => {
    const cat = tool.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(tool);
    return acc;
  }, {} as Record<string, typeof tools>);

  const progressPercentage = ((currentStep + 1) / STEPS.length) * 100;

  return (
    <div className="h-full flex flex-col">
      <ScrollArea className="flex-1">
        <div className="p-6 max-w-4xl mx-auto">
          {agents.length === 0 ? (
            /* Premium Empty State */
            <div className="flex flex-col items-center justify-center py-20">
              {/* Animated floating icon */}
              <div className={cn(
                'relative mb-8',
                'animate-float'
              )}>
                <div className={cn(
                  'h-24 w-24 rounded-3xl flex items-center justify-center',
                  'bg-gradient-to-br from-primary/20 via-primary/10 to-transparent',
                  'border border-primary/20',
                  'shadow-[0_0_60px_hsl(var(--primary)/0.2)]'
                )}>
                  <Sparkles className="h-12 w-12 text-primary" />
                </div>
                {/* Glow effect */}
                <div className="absolute inset-0 rounded-3xl bg-primary/10 blur-2xl -z-10" />
              </div>
              
              <h2 className="text-2xl font-bold text-foreground mb-3 text-center">
                {isOperator ? 'Create Your First Custom Agent' : 'No Custom Registry Items'}
              </h2>
              <p className="text-sm text-muted-foreground text-center max-w-md mb-8 leading-relaxed">
                {isOperator 
                  ? 'Build specialized agents tailored to your unique workflows. Define capabilities, set governance rules, and deploy with confidence.'
                  : 'No custom registry_items created. Use the builder to define new agents with governance policies.'
                }
              </p>
              
              <Button 
                onClick={handleCreate} 
                size="lg"
                className={cn(
                  'gap-2 px-6',
                  'bg-primary hover:bg-primary/90',
                  'shadow-[0_0_30px_hsl(var(--primary)/0.3)]',
                  'hover:shadow-[0_0_40px_hsl(var(--primary)/0.4)]',
                  'transition-all duration-300'
                )}
              >
                <Plus className="h-5 w-5" />
                {isOperator ? 'Create Agent' : 'New Registry Item'}
              </Button>
              
              {/* Feature highlights */}
              <div className="grid grid-cols-3 gap-6 mt-12 w-full max-w-lg">
                {[
                  { icon: Wrench, label: 'Custom Tools' },
                  { icon: Shield, label: 'Governance' },
                  { icon: Zap, label: 'Instant Deploy' },
                ].map((feature) => (
                  <div key={feature.label} className="flex flex-col items-center text-center">
                    <div className="h-10 w-10 rounded-lg bg-surface-2 flex items-center justify-center mb-2">
                      <feature.icon className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <span className="text-xs text-muted-foreground">{feature.label}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">
                  {isOperator ? 'Your Custom Agents' : 'Custom Registry Items'}
                </h2>
                <Button onClick={handleCreate} size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  {isOperator ? 'Create Agent' : 'New Item'}
                </Button>
              </div>
              <div className="grid gap-4">
                {agents.map((agent) => (
                  <Card key={agent.id} className="border-border hover:border-primary/20 transition-colors">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-medium text-foreground">{agent.name}</h3>
                          <p className="text-sm text-muted-foreground">{agent.description}</p>
                        </div>
                        <Badge variant="outline">{agent.status}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Premium Create Agent Drawer */}
      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent className="w-full sm:max-w-lg p-0 flex flex-col">
          <SheetHeader className="p-6 border-b border-border shrink-0 bg-gradient-to-r from-surface-2/50 to-transparent">
            <SheetTitle className="text-lg">
              {isOperator ? 'Create Custom Agent' : 'New Registry Item'}
            </SheetTitle>
            <p className="text-xs text-muted-foreground mt-1">
              {STEPS[currentStep].description}
            </p>
          </SheetHeader>

          {/* Premium Step Indicator */}
          <div className="px-6 py-4 border-b border-border shrink-0 bg-surface-1/50">
            <div className="mb-3">
              <Progress value={progressPercentage} className="h-1" />
            </div>
            <div className="flex items-center justify-between">
              {STEPS.map((step, idx) => {
                const isComplete = idx < currentStep;
                const isCurrent = idx === currentStep;
                const StepIcon = step.icon;
                
                return (
                  <div key={step.id} className="flex flex-col items-center">
                    <div className={cn(
                      'h-10 w-10 rounded-xl flex items-center justify-center text-xs font-medium',
                      'transition-all duration-300',
                      isCurrent && 'bg-primary text-primary-foreground shadow-[0_0_20px_hsl(var(--primary)/0.3)]',
                      isComplete && 'bg-success/20 text-success',
                      !isCurrent && !isComplete && 'bg-muted text-muted-foreground'
                    )}>
                      {isComplete ? <CheckCircle className="h-5 w-5" /> : <StepIcon className="h-5 w-5" />}
                    </div>
                    <span className={cn(
                      'text-[10px] font-medium mt-2',
                      isCurrent ? 'text-primary' : 'text-muted-foreground'
                    )}>
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Step Content */}
          <ScrollArea className="flex-1">
            <div className="p-6 space-y-4">
              {currentStep === 0 && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-sm font-medium">
                      {isOperator ? 'Agent Name' : 'name'}
                    </Label>
                    <Input
                      id="name"
                      placeholder={isOperator ? 'e.g., Invoice Approver' : 'agent_name'}
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description" className="text-sm font-medium">
                      {isOperator ? 'What does it do?' : 'description'}
                    </Label>
                    <Textarea
                      id="description"
                      placeholder={isOperator 
                        ? 'Describe what this agent will handle...'
                        : 'Agent description for registry'
                      }
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={4}
                      className="resize-none"
                    />
                  </div>
                </>
              )}

              {currentStep === 1 && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    {isOperator 
                      ? 'Select the tools this agent can use'
                      : 'Configure tool_policy.allowlist'
                    }
                  </p>
                  {Object.entries(toolsByCategory).map(([category, categoryTools]) => (
                    <div key={category}>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                        {category}
                      </h4>
                      <div className="space-y-2">
                        {categoryTools.map((tool) => {
                          const isSelected = formData.tools.includes(tool.tool_id);
                          return (
                            <div 
                              key={tool.tool_id}
                              className={cn(
                                'flex items-center gap-3 p-4 rounded-xl border transition-all',
                                isSelected 
                                  ? 'bg-primary/5 border-primary/30' 
                                  : 'bg-surface-1 border-border hover:border-primary/20'
                              )}
                            >
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={(checked) => {
                                  setFormData({
                                    ...formData,
                                    tools: checked
                                      ? [...formData.tools, tool.tool_id]
                                      : formData.tools.filter(t => t !== tool.tool_id)
                                  });
                                }}
                                className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                              />
                              <div className="flex-1">
                                <p className="text-sm font-medium">{tool.name}</p>
                                <p className="text-xs text-muted-foreground">{tool.description}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {currentStep === 2 && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">
                      {isOperator ? 'Risk Level' : 'risk_tier'}
                    </Label>
                    <div className="grid gap-3">
                      {(Object.entries(riskTierConfig) as [keyof typeof riskTierConfig, typeof riskTierConfig.low][]).map(([tier, config]) => {
                        const isSelected = formData.risk_tier === tier;
                        const TierIcon = config.icon;
                        return (
                          <button
                            key={tier}
                            type="button"
                            onClick={() => setFormData({ ...formData, risk_tier: tier })}
                            className={cn(
                              'flex items-center gap-4 p-4 rounded-xl border text-left transition-all',
                              isSelected ? config.color : 'bg-surface-1 border-border hover:border-primary/20'
                            )}
                          >
                            <div className={cn(
                              'h-10 w-10 rounded-lg flex items-center justify-center',
                              isSelected ? 'bg-background/50' : 'bg-surface-2'
                            )}>
                              <TierIcon className={cn('h-5 w-5', isSelected ? config.iconColor : 'text-muted-foreground')} />
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-medium">{config.label}</p>
                              <p className="text-xs text-muted-foreground">{config.description}</p>
                            </div>
                            {isSelected && (
                              <CheckCircle className={cn('h-5 w-5', config.iconColor)} />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  
                  <div className={cn(
                    'flex items-center gap-4 p-4 rounded-xl border transition-all',
                    formData.approval_required 
                      ? 'bg-warning/5 border-warning/30' 
                      : 'bg-surface-1 border-border'
                  )}>
                    <Checkbox
                      checked={formData.approval_required}
                      onCheckedChange={(checked) => setFormData({ ...formData, approval_required: !!checked })}
                      className="data-[state=checked]:bg-warning data-[state=checked]:border-warning"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        {isOperator ? 'Require approval for all actions' : 'approval_required: true'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {isOperator 
                          ? 'You will be asked before the agent takes any action'
                          : 'Enables approval queue for all actions'
                        }
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {currentStep === 3 && (
                <div className="space-y-4">
                  {/* Summary Card */}
                  <Card className="border-border overflow-hidden">
                    <CardHeader className="pb-2 bg-gradient-to-r from-surface-2/50 to-transparent">
                      <CardTitle className="text-sm">Configuration Summary</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-4">
                      <div className="flex justify-between items-center py-2 border-b border-border/50">
                        <span className="text-sm text-muted-foreground">Name</span>
                        <span className="text-sm font-medium">{formData.name || '—'}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-border/50">
                        <span className="text-sm text-muted-foreground">Tools</span>
                        <Badge variant="outline">{formData.tools.length} selected</Badge>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-border/50">
                        <span className="text-sm text-muted-foreground">Risk Tier</span>
                        <Badge className={cn(
                          'text-xs',
                          formData.risk_tier === 'low' && 'bg-success/20 text-success border-success/30',
                          formData.risk_tier === 'medium' && 'bg-warning/20 text-warning border-warning/30',
                          formData.risk_tier === 'high' && 'bg-destructive/20 text-destructive border-destructive/30'
                        )}>
                          {formData.risk_tier}
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center py-2">
                        <span className="text-sm text-muted-foreground">Approval</span>
                        <span className="text-sm font-medium">
                          {formData.approval_required ? 'Required' : 'Automatic'}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                  
                  {/* Status Flow */}
                  <div className={cn(
                    'p-4 rounded-xl',
                    'bg-gradient-to-r from-primary/10 to-primary/5',
                    'border border-primary/20'
                  )}>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center">
                        <Zap className="h-4 w-4 text-primary" />
                      </div>
                      <p className="text-sm font-medium text-foreground">
                        {isOperator ? 'What happens next' : 'Status Flow'}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground ml-11">
                      {isOperator 
                        ? 'Your agent will be saved as a draft. Submit for review to make it live.'
                        : 'Draft → Proposed → Active'
                      }
                    </p>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Footer */}
          <div className="p-6 border-t border-border shrink-0 flex justify-between bg-surface-1/50">
            <Button
              variant="ghost"
              onClick={currentStep === 0 ? () => setCreateOpen(false) : handleBack}
            >
              {currentStep === 0 ? 'Cancel' : 'Back'}
            </Button>
            <Button
              onClick={currentStep === STEPS.length - 1 ? () => setCreateOpen(false) : handleNext}
              disabled={!canProceed()}
              className={cn(
                currentStep === STEPS.length - 1 && 'shadow-[0_0_20px_hsl(var(--primary)/0.2)]'
              )}
            >
              {currentStep === STEPS.length - 1 
                ? (isOperator ? 'Create Draft' : 'Create Proposal')
                : 'Continue'
              }
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
