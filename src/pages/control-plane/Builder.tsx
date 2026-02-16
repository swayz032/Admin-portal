import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useSystem } from '@/contexts/SystemContext';
import { BuilderState, DEFAULT_BUILDER_STATE, DEFAULT_CAPABILITIES } from '@/contracts/control-plane';
import { createDraftRegistryItem, proposeConfigChange } from '@/services/controlPlaneClient';
import { Button } from '@/components/ui/button';
import {
  IdentityStep,
  CapabilitiesStep,
  GovernanceStep,
  PromptStep,
  ReviewStep,
} from '@/components/control-plane/BuilderSteps';
import { ChevronLeft, ChevronRight, Save, Send, Check } from 'lucide-react';
import { toast } from 'sonner';

const STEPS = [
  { id: 'identity', label: 'Identity' },
  { id: 'capabilities', label: 'Capabilities' },
  { id: 'governance', label: 'Governance' },
  { id: 'prompt', label: 'Prompt' },
  { id: 'review', label: 'Review' },
];

export default function Builder() {
  const { viewMode } = useSystem();
  const navigate = useNavigate();
  const isOperator = viewMode === 'operator';
  
  const [currentStep, setCurrentStep] = useState(0);
  const [state, setState] = useState<BuilderState>({
    ...DEFAULT_BUILDER_STATE,
    capabilities: DEFAULT_CAPABILITIES,
  });
  const [saving, setSaving] = useState(false);

  const handleChange = (updates: Partial<BuilderState>) => {
    setState(prev => ({ ...prev, ...updates }));
  };

  const canProceed = () => {
    switch (currentStep) {
      case 0: return state.name.trim().length > 0 && state.description.trim().length > 0;
      case 1: return true;
      case 2: return true;
      case 3: return state.prompt_content.trim().length > 0;
      case 4: return true;
      default: return true;
    }
  };

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) setCurrentStep(prev => prev + 1);
  };

  const handleBack = () => {
    if (currentStep > 0) setCurrentStep(prev => prev - 1);
  };

  const handleSaveDraft = async () => {
    setSaving(true);
    try {
      await createDraftRegistryItem(state);
      toast.success(isOperator ? 'Draft saved!' : 'Draft registry item created');
      navigate('/agent-studio');
    } catch (error) {
      toast.error('Failed to save draft');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const item = await createDraftRegistryItem(state);
      await proposeConfigChange({
        registry_item_id: item.id,
        registry_item_name: item.name,
        change_type: 'create',
        summary: `Create new ${item.type}: ${item.name}`,
        diff: {
          before: {},
          after: { name: item.name, description: item.description, risk_tier: item.risk_tier },
        },
      });
      toast.success(isOperator ? 'Agent submitted for review!' : 'ConfigChangeProposal created');
      navigate('/agent-studio');
    } catch (error) {
      toast.error('Failed to submit');
    } finally {
      setSaving(false);
    }
  };

  const renderStepContent = () => {
    const stepProps = { state, onChange: handleChange };
    switch (currentStep) {
      case 0: return <IdentityStep {...stepProps} />;
      case 1: return <CapabilitiesStep {...stepProps} />;
      case 2: return <GovernanceStep {...stepProps} />;
      case 3: return <PromptStep {...stepProps} />;
      case 4: return <ReviewStep {...stepProps} />;
      default: return null;
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Clean progress bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          {STEPS.map((step, index) => {
            const isCompleted = index < currentStep;
            const isCurrent = index === currentStep;
            
            return (
              <button
                key={step.id}
                onClick={() => index <= currentStep && setCurrentStep(index)}
                disabled={index > currentStep}
                className={cn(
                  'flex items-center gap-2 text-[13px] font-medium transition-colors',
                  isCurrent && 'text-foreground',
                  isCompleted && 'text-muted-foreground hover:text-foreground cursor-pointer',
                  !isCurrent && !isCompleted && 'text-muted-foreground/40 cursor-not-allowed'
                )}
              >
                <span className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-medium transition-all',
                  isCurrent && 'bg-primary text-primary-foreground',
                  isCompleted && 'bg-muted text-foreground',
                  !isCurrent && !isCompleted && 'bg-muted/50 text-muted-foreground/50'
                )}>
                  {isCompleted ? <Check className="h-3 w-3" /> : index + 1}
                </span>
                <span className="hidden sm:inline">{step.label}</span>
              </button>
            );
          })}
        </div>
        <div className="h-0.5 bg-muted rounded-full overflow-hidden">
          <div 
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${((currentStep) / (STEPS.length - 1)) * 100}%` }}
          />
        </div>
      </div>

      {/* Step Content — clean card */}
      <div className="rounded-xl border border-border bg-card p-8">
        {renderStepContent()}
      </div>

      {/* Navigation — minimal footer */}
      <div className="flex items-center justify-between mt-6 pb-8">
        <Button
          variant="ghost"
          onClick={handleBack}
          disabled={currentStep === 0}
          className="gap-2 text-muted-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </Button>

        <div className="flex items-center gap-3">
          {currentStep === STEPS.length - 1 ? (
            <>
              <Button
                variant="outline"
                onClick={handleSaveDraft}
                disabled={saving}
                className="gap-2"
              >
                <Save className="h-3.5 w-3.5" />
                {isOperator ? 'Save Draft' : 'Save as Draft'}
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={saving || !canProceed()}
                className="gap-2"
              >
                <Send className="h-3.5 w-3.5" />
                {isOperator ? 'Submit for Review' : 'Create Proposal'}
              </Button>
            </>
          ) : (
            <Button
              onClick={handleNext}
              disabled={!canProceed()}
              className="gap-2"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
