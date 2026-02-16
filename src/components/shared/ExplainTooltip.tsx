import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useSystem } from '@/contexts/SystemContext';
import { cn } from '@/lib/utils';

interface ExplainContent {
  operator: {
    what: string;
    why: string;
    action: string;
    afterApproval?: string;
  };
  engineer: {
    definition: string;
    fields: string;
    links?: string;
  };
}

interface ExplainTooltipProps {
  content: ExplainContent;
  className?: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
}

export function ExplainTooltip({ content, className, side = 'top' }: ExplainTooltipProps) {
  const { viewMode } = useSystem();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button 
          type="button" 
          className={cn(
            "inline-flex items-center justify-center w-4 h-4 rounded-full",
            "bg-surface-2 hover:bg-surface-3 transition-colors",
            "text-text-tertiary hover:text-text-secondary",
            className
          )}
        >
          <Info className="h-3 w-3" />
        </button>
      </TooltipTrigger>
      <TooltipContent side={side} className="max-w-xs p-3 space-y-2">
        {viewMode === 'operator' ? (
          <>
            <div>
              <p className="text-xs font-medium text-foreground">What this is</p>
              <p className="text-xs text-muted-foreground">{content.operator.what}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-foreground">Why it matters</p>
              <p className="text-xs text-muted-foreground">{content.operator.why}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-foreground">What you can do</p>
              <p className="text-xs text-muted-foreground">{content.operator.action}</p>
            </div>
            {content.operator.afterApproval && (
              <div>
                <p className="text-xs font-medium text-foreground">After approval</p>
                <p className="text-xs text-muted-foreground">{content.operator.afterApproval}</p>
              </div>
            )}
          </>
        ) : (
          <>
            <div>
              <p className="text-xs font-medium text-foreground">Definition</p>
              <p className="text-xs text-muted-foreground font-mono">{content.engineer.definition}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-foreground">Fields used</p>
              <p className="text-xs text-muted-foreground font-mono">{content.engineer.fields}</p>
            </div>
            {content.engineer.links && (
              <div>
                <p className="text-xs font-medium text-foreground">Links</p>
                <p className="text-xs text-muted-foreground font-mono">{content.engineer.links}</p>
              </div>
            )}
          </>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

// Pre-defined explain content for common KPIs
export const explainContent = {
  receiptCoverage: {
    operator: {
      what: 'Percentage of actions that have proof recorded',
      why: 'Higher coverage means better audit trail and accountability',
      action: 'Review actions with missing proof',
      afterApproval: 'Missing receipts will be flagged for investigation',
    },
    engineer: {
      definition: 'COUNT(receipts) / COUNT(actions) * 100',
      fields: 'receipts.id, actions.id, actions.created_at',
      links: 'LLM Ops Desk → Receipts tab',
    },
  },
  missingReceipts: {
    operator: {
      what: 'Actions completed without proper proof recorded',
      why: 'Missing proof can indicate system issues or policy violations',
      action: 'Click to see which actions need investigation',
    },
    engineer: {
      definition: 'Actions where receipt_id IS NULL or receipt.status != ok',
      fields: 'actions.id, actions.receipt_id, receipts.status',
      links: 'Incidents → Proof Status filter',
    },
  },
  approvalsPending: {
    operator: {
      what: 'Requests waiting for someone to approve or deny',
      why: 'Old approvals can block important work from completing',
      action: 'Review and decide on pending approvals',
    },
    engineer: {
      definition: 'COUNT(approvals WHERE status = pending)',
      fields: 'approvals.id, approvals.status, approvals.created_at',
      links: '/approvals',
    },
  },
  policyBlocks: {
    operator: {
      what: 'Actions stopped by safety rules in the last 24 hours',
      why: 'Shows the safety system is protecting against risky actions',
      action: 'Review blocked actions to ensure they were correctly stopped',
    },
    engineer: {
      definition: 'COUNT(actions WHERE policy_decision = blocked, last 24h)',
      fields: 'actions.policy_decision_ref, policy_decisions.result',
      links: '/safety',
    },
  },
  providerErrors: {
    operator: {
      what: 'Errors from connected services (Stripe, HubSpot, etc.)',
      why: 'Provider issues can disrupt automations and customer experience',
      action: 'Check provider status and investigate specific errors',
    },
    engineer: {
      definition: 'COUNT(provider_calls WHERE status >= 400, last 24h)',
      fields: 'provider_calls.status, provider_calls.latency_ms',
      links: 'LLM Ops Desk → Provider log',
    },
  },
  outboxHealth: {
    operator: {
      what: 'Work waiting to be processed by the system',
      why: 'High queue or lag means work is backing up',
      action: 'Monitor queue depth and investigate if lag increases',
    },
    engineer: {
      definition: 'queue_depth: COUNT(jobs WHERE status = queued), lag: MAX(NOW() - jobs.next_run_at)',
      fields: 'jobs.status, jobs.next_run_at, jobs.created_at',
      links: '/automation → Work Queue',
    },
  },
  queueDepth: {
    operator: {
      what: 'Number of tasks waiting to run',
      why: 'More work waiting means the system is busy or backed up',
      action: 'If too high, investigate what is causing the backlog',
    },
    engineer: {
      definition: 'COUNT(jobs WHERE status IN (queued, retrying))',
      fields: 'jobs.status, jobs.next_run_at',
      links: '/automation',
    },
  },
  workerLag: {
    operator: {
      what: 'How long the oldest task has been waiting',
      why: 'Long waits can mean worker issues or resource constraints',
      action: 'Check worker health if lag exceeds normal levels',
    },
    engineer: {
      definition: 'MAX(NOW() - jobs.created_at) WHERE status = queued',
      fields: 'jobs.created_at, jobs.status',
      links: '/automation',
    },
  },
};
