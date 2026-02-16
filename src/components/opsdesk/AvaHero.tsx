import { useOpsDesk, orbStateLabels, AutomationMode } from '@/contexts/OpsDeskContext';
import { useSystem } from '@/contexts/SystemContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { 
  Shield, 
  Info, 
  Settings,
  Mic, 
  PhoneOff,
  Eye,
  Hand,
  Zap,
  CheckCircle,
} from 'lucide-react';
import avaOrbVideo from '@/assets/ava-orb-video.mp4';
import { cn } from '@/lib/utils';

const automationModeLabels: Record<AutomationMode, { label: string; icon: React.ReactNode; description: string }> = {
  advisory: { 
    label: 'Observe', 
    icon: <Eye className="h-4 w-4" />,
    description: 'Analysis only. No automated actions.',
  },
  standard: { 
    label: 'Assist', 
    icon: <Hand className="h-4 w-4" />,
    description: 'Full pipeline with human approval gates.',
  },
  emergency_stop: { 
    label: 'Autopilot', 
    icon: <Zap className="h-4 w-4" />,
    description: 'Maximum automation. Releases still gated.',
  },
};

export function AvaHero() {
  const { systemState } = useSystem();
  const {
    orbState,
    automationMode,
    setAutomationMode,
    analysisResult,
    fixPlanResult,
    patchDraftResult,
    createdApprovalId,
    isConversationActive,
    startConversation,
    endConversation,
    interruptSpeaking,
    isAnalyzing,
    isGeneratingPlan,
    isDraftingPatch,
  } = useOpsDesk();
  
  // Determine pipeline step
  const getPipelineStep = () => {
    if (!analysisResult) return 1;
    if (!fixPlanResult) return 2;
    if (!patchDraftResult) return 3;
    if (!createdApprovalId) return 4;
    return 5;
  };
  
  const pipelineStep = getPipelineStep();
  const totalSteps = 5;
  
  const isAnimating = ['listening', 'thinking', 'searching_web', 'searching_files', 'querying_data', 'connecting_agents', 'drafting', 'speaking'].includes(orbState);
  
  // Generate status sentence for no-coder
  const getStatusSentence = () => {
    if (orbState === 'idle' && pipelineStep === 1) {
      return "Ready to analyze. Start a session to begin.";
    }
    if (orbState === 'blocked') {
      return "Action blocked due to safety restrictions. Check automation mode.";
    }
    if (isAnalyzing) {
      return `Ava is analyzing the incident. No production changes can happen without your approval.`;
    }
    if (isGeneratingPlan) {
      return `Ava is creating a fix plan. No production changes can happen without your approval.`;
    }
    if (isDraftingPatch) {
      return `Claude is drafting a patch. Running tests in sandbox. No production changes can happen without your approval.`;
    }
    if (patchDraftResult && !createdApprovalId) {
      return `Tests passed! Ready for your approval.`;
    }
    if (createdApprovalId) {
      return `Approval created. Review the release checklist to proceed.`;
    }
    if (orbState === 'speaking') {
      return `Ava is speaking. Tap to interrupt.`;
    }
    if (orbState === 'listening') {
      return `Listening... Speak your command.`;
    }
    
    return `Right now: ${orbStateLabels[orbState]}. No production changes can happen without your approval.`;
  };
  
  const handleSessionToggle = () => {
    if (orbState === 'speaking') {
      interruptSpeaking();
    } else if (isConversationActive) {
      endConversation();
    } else {
      startConversation();
    }
  };
  
  return (
    <div className="min-h-[70vh] bg-black flex flex-col">
      {/* Top Strip */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/30">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold text-white">LLM Ops Desk</h1>
          
          {/* Status Chip */}
          <Badge variant="outline" className={cn(
            'text-xs',
            orbState === 'idle' && 'border-muted-foreground/30 text-muted-foreground',
            isAnimating && 'border-primary/30 text-primary bg-primary/10',
            orbState === 'blocked' && 'border-warning/30 text-warning bg-warning/10',
            orbState === 'error' && 'border-destructive/30 text-destructive bg-destructive/10'
          )}>
            {orbStateLabels[orbState]}
          </Badge>
          
          {systemState.safetyMode && (
            <Badge variant="outline" className="bg-warning/10 border-warning/30 text-warning">
              <Shield className="h-3 w-3 mr-1" />
              Safety Mode
            </Badge>
          )}
        </div>
        
        <div className="flex items-center gap-3">
          {/* Step indicator */}
          <span className="text-xs text-muted-foreground">Step {pipelineStep} of {totalSteps}</span>
          
          {/* Automation Mode Selector */}
          <div className="flex items-center gap-1 p-1 bg-surface-1 rounded-lg">
            {(Object.keys(automationModeLabels) as AutomationMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setAutomationMode(mode)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all',
                  automationMode === mode 
                    ? 'bg-primary text-primary-foreground' 
                    : 'text-muted-foreground hover:text-foreground hover:bg-surface-2'
                )}
              >
                {automationModeLabels[mode].icon}
                {automationModeLabels[mode].label}
              </button>
            ))}
          </div>
          
          {/* How it works */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                <Info className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent className="bg-card border-border">
              <SheetHeader>
                <SheetTitle className="text-foreground">How This Works</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-4">
                {[
                  { step: 1, text: 'Ava reads evidence and explains what\'s happening (no execution authority).' },
                  { step: 2, text: 'Ava writes a fix plan (what to change, how to test, how to rollback).' },
                  { step: 3, text: 'Claude drafts a patch in a safe sandbox and runs tests.' },
                  { step: 4, text: 'Robots verify the app in staging/canary to prove it\'s fixed.' },
                  { step: 5, text: 'You approve release, then the system deploys and verifies again.' },
                ].map((item) => (
                  <div 
                    key={item.step} 
                    className={cn(
                      'flex gap-3 p-3 rounded-lg transition-colors',
                      pipelineStep === item.step ? 'bg-primary/10 border border-primary/30' : 'bg-surface-1'
                    )}
                  >
                    <div className={cn(
                      'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0',
                      pipelineStep > item.step ? 'bg-success text-success-foreground' :
                      pipelineStep === item.step ? 'bg-primary text-primary-foreground' :
                      'bg-surface-2 text-muted-foreground'
                    )}>
                      {pipelineStep > item.step ? <CheckCircle className="h-3 w-3" /> : item.step}
                    </div>
                    <p className="text-sm text-muted-foreground">{item.text}</p>
                  </div>
                ))}
              </div>
            </SheetContent>
          </Sheet>
          
          {/* Settings */}
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
            <Settings className="h-5 w-5" />
          </Button>
        </div>
      </div>
      
      {/* Center Body - Orb */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        {/* Large Orb - Video */}
        <div 
          className={cn(
            'relative w-72 h-72 md:w-80 md:h-80 rounded-full overflow-hidden transition-all duration-500',
            isAnimating && 'shadow-2xl shadow-primary/30'
          )}
        >
          <video
            src={avaOrbVideo}
            autoPlay
            loop
            muted
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
          />
          
          {/* Pulse ring for active states */}
          {isAnimating && (
            <div className="absolute inset-0 rounded-full border-2 border-primary/30 animate-ping opacity-30" />
          )}
        </div>
        
        {/* Under orb info */}
        <div className="text-center mt-6">
          <h3 className="text-xl font-semibold text-white">Ava</h3>
          <p className="text-sm text-muted-foreground">GPT Orchestrator</p>
        </div>
        
        {/* Status sentence */}
        <p className="text-sm text-muted-foreground text-center mt-4 max-w-md">
          {getStatusSentence()}
        </p>
        
        {/* Primary Controls - ONLY TWO */}
        <div className="flex items-center gap-4 mt-8">
          <Button
            size="lg"
            variant={isConversationActive ? 'default' : 'outline'}
            className={cn(
              'gap-2 min-w-[180px]',
              isConversationActive && 'bg-primary hover:bg-primary/90'
            )}
            onClick={handleSessionToggle}
          >
            <Mic className={cn('h-5 w-5', isConversationActive && 'animate-pulse')} />
            {isConversationActive ? 'Stop Session' : 'Start Session'}
          </Button>
          
          <Button
            size="lg"
            variant="destructive"
            className="gap-2 min-w-[180px]"
            onClick={endConversation}
            disabled={!isConversationActive && orbState === 'idle'}
          >
            <PhoneOff className="h-5 w-5" />
            End Session
          </Button>
        </div>
      </div>
    </div>
  );
}
