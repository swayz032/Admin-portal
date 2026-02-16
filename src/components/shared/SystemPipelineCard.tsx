import { useSystem } from '@/contexts/SystemContext';
import { cn } from '@/lib/utils';
import { 
  FileQuestion, 
  Shield, 
  CheckCircle, 
  Inbox, 
  Zap, 
  Server, 
  FileCheck,
  ChevronRight 
} from 'lucide-react';

interface PipelineStep {
  operatorLabel: string;
  engineerLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  status?: 'active' | 'pending' | 'complete';
}

const PIPELINE_STEPS: PipelineStep[] = [
  { operatorLabel: 'Request', engineerLabel: 'Proposal', icon: FileQuestion },
  { operatorLabel: 'Safety checks', engineerLabel: 'Policy', icon: Shield },
  { operatorLabel: 'You approve', engineerLabel: 'Approval', icon: CheckCircle },
  { operatorLabel: 'Queued', engineerLabel: 'Outbox', icon: Inbox },
  { operatorLabel: 'Runs', engineerLabel: 'Executor', icon: Zap },
  { operatorLabel: 'Provider calls', engineerLabel: 'ProviderCallLog', icon: Server },
  { operatorLabel: 'Proof saved', engineerLabel: 'Receipts', icon: FileCheck },
];

interface SystemPipelineCardProps {
  className?: string;
  variant?: 'full' | 'compact' | 'mini';
  highlightStep?: number;
}

export function SystemPipelineCard({ 
  className = '', 
  variant = 'full',
  highlightStep,
}: SystemPipelineCardProps) {
  const { viewMode } = useSystem();
  const isOperator = viewMode === 'operator';

  if (variant === 'mini') {
    return (
      <div className={cn(
        'flex items-center gap-1 px-3 py-2 rounded-lg',
        'bg-surface-2 border border-border/50',
        className
      )}>
        <span className="text-xs text-muted-foreground">Pipeline:</span>
        {PIPELINE_STEPS.map((step, index) => (
          <div key={index} className="flex items-center">
            <step.icon 
              className={cn(
                'h-3.5 w-3.5',
                highlightStep === index ? 'text-primary' : 'text-muted-foreground/50'
              )} 
            />
            {index < PIPELINE_STEPS.length - 1 && (
              <ChevronRight className="h-3 w-3 text-border mx-0.5" />
            )}
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className={cn(
        'p-3 rounded-xl bg-surface-2 border border-border/50',
        className
      )}>
        <div className="flex items-center justify-between overflow-x-auto pb-1">
          {PIPELINE_STEPS.map((step, index) => (
            <div key={index} className="flex items-center min-w-0">
              <div className={cn(
                'flex flex-col items-center gap-1 px-2',
                highlightStep === index && 'text-primary'
              )}>
                <step.icon 
                  className={cn(
                    'h-4 w-4',
                    highlightStep === index ? 'text-primary' : 'text-muted-foreground'
                  )} 
                />
                <span className={cn(
                  'text-[10px] whitespace-nowrap',
                  highlightStep === index ? 'text-primary font-medium' : 'text-muted-foreground'
                )}>
                  {isOperator ? step.operatorLabel : step.engineerLabel}
                </span>
              </div>
              {index < PIPELINE_STEPS.length - 1 && (
                <ChevronRight className="h-3 w-3 text-border flex-shrink-0" />
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Full variant
  return (
    <div className={cn(
      'p-4 rounded-xl',
      'bg-gradient-to-br from-surface-2 to-surface-1',
      'border border-border/50',
      className
    )}>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {isOperator ? 'How it works' : 'Trust Spine Pipeline'}
        </h4>
      </div>
      
      <div className="flex items-stretch justify-between gap-1">
        {PIPELINE_STEPS.map((step, index) => (
          <div key={index} className="flex items-center flex-1">
            <div className={cn(
              'flex flex-col items-center gap-2 p-2 rounded-lg flex-1 min-w-0 transition-all',
              highlightStep === index 
                ? 'bg-primary/10 border border-primary/30' 
                : 'hover:bg-surface-3'
            )}>
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center',
                highlightStep === index 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-surface-3 text-muted-foreground'
              )}>
                <step.icon className="h-4 w-4" />
              </div>
              <span className={cn(
                'text-[10px] text-center leading-tight',
                highlightStep === index ? 'text-primary font-medium' : 'text-muted-foreground'
              )}>
                {isOperator ? step.operatorLabel : step.engineerLabel}
              </span>
            </div>
            {index < PIPELINE_STEPS.length - 1 && (
              <ChevronRight className="h-4 w-4 text-border flex-shrink-0 mx-0.5" />
            )}
          </div>
        ))}
      </div>
      
      {isOperator && (
        <p className="text-[10px] text-muted-foreground/70 mt-3 text-center">
          Every action flows through this pipeline, creating proof at each step
        </p>
      )}
    </div>
  );
}
