import { useOpsDesk } from '@/contexts/OpsDeskContext';
import { cn } from '@/lib/utils';

interface SectionStatus {
  id: string;
  label: string;
  status: 'not_started' | 'in_progress' | 'complete' | 'blocked';
}

interface StickyJumpBarProps {
  visible: boolean;
}

export function StickyJumpBar({ visible }: StickyJumpBarProps) {
  const {
    analysisResult,
    fixPlanResult,
    patchDraftResult,
    currentPatchJob,
    createdApprovalId,
    notes,
    transcript,
    attachments,
    receipts,
    isAnalyzing,
    isGeneratingPlan,
    isDraftingPatch,
  } = useOpsDesk();
  
  const getSections = (): SectionStatus[] => {
    // Pipeline status
    let pipelineStatus: SectionStatus['status'] = 'not_started';
    if (createdApprovalId) pipelineStatus = 'complete';
    else if (isAnalyzing || isGeneratingPlan || isDraftingPatch) pipelineStatus = 'in_progress';
    else if (analysisResult || fixPlanResult || patchDraftResult) pipelineStatus = 'in_progress';
    
    // Proof status
    let proofStatus: SectionStatus['status'] = 'not_started';
    if (currentPatchJob?.state === 'tests_passed') proofStatus = 'complete';
    else if (currentPatchJob?.state === 'tests_running') proofStatus = 'in_progress';
    else if (currentPatchJob?.state === 'tests_failed') proofStatus = 'blocked';
    else if (patchDraftResult) proofStatus = 'in_progress';
    
    // Notes status
    const notesStatus: SectionStatus['status'] = notes.length > 0 ? 'complete' : 'not_started';
    
    // Transcript status
    const transcriptStatus: SectionStatus['status'] = transcript.length > 0 ? 'complete' : 'not_started';
    
    // Context status
    const contextStatus: SectionStatus['status'] = attachments.length > 0 ? 'complete' : 'not_started';
    
    // Release status
    let releaseStatus: SectionStatus['status'] = 'not_started';
    if (createdApprovalId) releaseStatus = 'complete';
    else if (currentPatchJob?.state === 'tests_passed') releaseStatus = 'in_progress';
    
    // Receipts status
    const receiptsStatus: SectionStatus['status'] = receipts.length > 0 ? 'complete' : 'not_started';
    
    return [
      { id: 'pipeline', label: 'Pipeline', status: pipelineStatus },
      { id: 'proof', label: 'Proof', status: proofStatus },
      { id: 'notes', label: 'Notes', status: notesStatus },
      { id: 'transcript', label: 'Transcript', status: transcriptStatus },
      { id: 'context', label: 'Context', status: contextStatus },
      { id: 'release', label: 'Release', status: releaseStatus },
      { id: 'receipts', label: 'Receipts', status: receiptsStatus },
    ];
  };
  
  const sections = getSections();
  
  const statusColors = {
    not_started: 'bg-muted-foreground/50',
    in_progress: 'bg-primary',
    complete: 'bg-success',
    blocked: 'bg-warning',
  };
  
  const scrollToSection = (id: string) => {
    const element = document.getElementById(`section-${id}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };
  
  return (
    <div 
      className={cn(
        'fixed top-0 left-0 right-0 z-50 bg-black/95 backdrop-blur-sm border-b border-border/30 transition-transform duration-300',
        visible ? 'translate-y-0' : '-translate-y-full'
      )}
    >
      <div className="max-w-5xl mx-auto px-6 py-3">
        <div className="flex items-center justify-center gap-6">
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => scrollToSection(section.id)}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <div className={cn('w-2 h-2 rounded-full', statusColors[section.status])} />
              {section.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
