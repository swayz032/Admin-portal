import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

// Types
export type OrbState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'acting' | 'error' | 'blocked' | 'searching_web' | 'searching_files' | 'querying_data' | 'connecting_agents' | 'drafting';
export type AutomationMode = 'advisory' | 'standard' | 'emergency_stop';
export type ActionEventCategory = 'analysis' | 'planning' | 'execution' | 'approval' | 'release';

export const orbStateLabels: Record<OrbState, string> = {
  idle: 'Ready',
  listening: 'Listening...',
  thinking: 'Thinking...',
  speaking: 'Speaking...',
  acting: 'Acting...',
  error: 'Error',
  blocked: 'Blocked',
  searching_web: 'Searching Web...',
  searching_files: 'Searching Files...',
  querying_data: 'Querying Data...',
  connecting_agents: 'Connecting Agents...',
  drafting: 'Drafting...',
};

export interface ActionEvent {
  id: string;
  category: ActionEventCategory;
  action: string;
  timestamp: string;
  status: 'pending' | 'in-progress' | 'complete' | 'failed';
  details?: string;
}

export interface OpsDeskReceipt {
  id: string;
  timestamp: string;
  action: string;
  outcome: 'Success' | 'Failed' | 'Pending' | 'Blocked';
  details?: string;
  correlationId?: string;
  actor?: string;
  summary?: string;
  receiptType?: string;
  attachedContext?: string[];
  redactedInputs?: string;
  redactedOutputs?: string;
}

export interface ContextAttachment {
  id: string;
  type: 'incident' | 'customer' | 'approval' | 'provider' | 'timeRange' | 'file';
  label: string;
  entityId: string;
}

export interface OpsDeskAttachment extends ContextAttachment {}

export interface OpsDeskNote {
  id: string;
  content: string;
  body?: string;
  author: string;
  timestamp: string;
  isLLMGenerated?: boolean;
  type?: 'user' | 'llm' | 'system' | 'Analysis' | 'Fix Plan' | 'Patch Draft' | 'Decision';
}

export interface TranscriptEntry {
  id: string;
  speaker: 'You' | 'Ava' | 'Claude';
  message: string;
  timestamp: string;
}

export interface PipelineStep {
  id: string;
  label: string;
  status: 'pending' | 'in-progress' | 'complete' | 'failed';
  details?: string;
}

export interface ReleaseChecklistItem {
  id: string;
  label: string;
  checked: boolean;
}

export interface AnalysisResult {
  summary: string;
  rootCause: string;
  suspectedCause: string;
  confidence: 'High' | 'Medium' | 'Low';
  affectedSystems: string[];
  recommendations: string[];
}

export interface FixPlanResult {
  steps: string[];
  estimatedDuration: string;
  riskLevel: 'low' | 'medium' | 'high';
  riskRating: string;
  rollbackPlan: string;
}

export interface PatchDraftResult {
  description: string;
  changes: string[];
  testPlan: string;
  impactedAreas: string;
}

export interface TestResult {
  name: string;
  status: 'pending' | 'running' | 'passed' | 'failed';
  duration?: number;
  error?: string;
}

export interface PatchJob {
  id: string;
  state: 'pending' | 'drafting' | 'tests_running' | 'tests_passed' | 'tests_failed' | 'awaiting_approval';
  testResults?: TestResult[];
  artifacts?: {
    impactedFiles?: string[];
    patchSummary?: string;
  };
}

export interface VoiceSettings {
  isMuted: boolean;
  autoSpeak: boolean;
}

interface OpsDeskContextType {
  receipts: OpsDeskReceipt[];
  addReceipt: (receipt: Omit<OpsDeskReceipt, 'id' | 'timestamp'>) => void;
  attachments: ContextAttachment[];
  addAttachment: (attachment: Omit<ContextAttachment, 'id'>) => void;
  removeAttachment: (id: string) => void;
  notes: OpsDeskNote[];
  addNote: (content: string, author?: string, isLLMGenerated?: boolean) => void;
  transcript: TranscriptEntry[];
  addTranscriptEntry: (speaker: 'You' | 'Ava' | 'Claude', message: string) => void;
  pipelineSteps: PipelineStep[];
  updatePipelineStep: (id: string, status: PipelineStep['status'], details?: string) => void;
  orbState: OrbState;
  setOrbState: (state: OrbState) => void;
  liveOrbActions: ActionEvent[];
  fullActionTrace: ActionEvent[];
  automationMode: AutomationMode;
  setAutomationMode: (mode: AutomationMode) => void;
  analysisResult: AnalysisResult | null;
  fixPlanResult: FixPlanResult | null;
  patchDraftResult: PatchDraftResult | null;
  createdApprovalId: string | null;
  releaseChecklist: ReleaseChecklistItem[];
  runAnalysis: () => Promise<void>;
  runFixPlan: () => Promise<void>;
  runPatchDraft: () => Promise<void>;
  createApproval: (reason?: string) => Promise<void>;
  toggleReleaseChecklistItem: (id: string) => void;
  isConversationActive: boolean;
  startConversation: () => void;
  endConversation: () => void;
  interruptSpeaking: () => void;
  isAnalyzing: boolean;
  isGeneratingPlan: boolean;
  isDraftingPatch: boolean;
  isCreatingApproval: boolean;
  currentPatchJob: PatchJob | null;
  voiceSettings: VoiceSettings;
  setVoiceSettings: (settings: Partial<VoiceSettings>) => void;
  isElevenLabsConfigured: boolean;
  seedDemoData: () => void;
  clearAll: () => void;
}

const OpsDeskContext = createContext<OpsDeskContextType | undefined>(undefined);

const initialPipelineSteps: PipelineStep[] = [
  { id: 'analyze', label: 'Analyze Issue', status: 'pending' },
  { id: 'identify', label: 'Identify Root Cause', status: 'pending' },
  { id: 'plan', label: 'Plan Fix', status: 'pending' },
  { id: 'execute', label: 'Execute Fix', status: 'pending' },
  { id: 'verify', label: 'Verify Resolution', status: 'pending' },
];

const initialReleaseChecklist: ReleaseChecklistItem[] = [
  { id: 'tests', label: 'All tests passing', checked: false },
  { id: 'review', label: 'Code review complete', checked: false },
  { id: 'rollback', label: 'Rollback plan ready', checked: false },
  { id: 'monitoring', label: 'Monitoring configured', checked: false },
];

export function OpsDeskProvider({ children }: { children: ReactNode }) {
  const [receipts, setReceipts] = useState<OpsDeskReceipt[]>([]);
  const [attachments, setAttachments] = useState<ContextAttachment[]>([]);
  const [notes, setNotes] = useState<OpsDeskNote[]>([]);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [pipelineSteps, setPipelineSteps] = useState<PipelineStep[]>(initialPipelineSteps);
  const [orbState, setOrbState] = useState<OrbState>('idle');
  const [liveOrbActions] = useState<ActionEvent[]>([]);
  const [fullActionTrace] = useState<ActionEvent[]>([]);
  const [automationMode, setAutomationMode] = useState<AutomationMode>('standard');
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [fixPlanResult, setFixPlanResult] = useState<FixPlanResult | null>(null);
  const [patchDraftResult, setPatchDraftResult] = useState<PatchDraftResult | null>(null);
  const [createdApprovalId, setCreatedApprovalId] = useState<string | null>(null);
  const [releaseChecklist, setReleaseChecklist] = useState<ReleaseChecklistItem[]>(initialReleaseChecklist);
  const [isConversationActive, setIsConversationActive] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [isDraftingPatch, setIsDraftingPatch] = useState(false);
  const [isCreatingApproval, setIsCreatingApproval] = useState(false);
  const [currentPatchJob, setCurrentPatchJob] = useState<PatchJob | null>(null);
  const [voiceSettings, setVoiceSettingsState] = useState<VoiceSettings>({
    isMuted: false,
    autoSpeak: true,
  });

  const addReceipt = useCallback((receipt: Omit<OpsDeskReceipt, 'id' | 'timestamp'>) => {
    setReceipts(prev => [...prev, { 
      ...receipt, 
      id: `RCP-${Date.now()}`, 
      timestamp: new Date().toISOString(),
      correlationId: receipt.correlationId || `COR-${Date.now()}`,
      attachedContext: receipt.attachedContext || [],
    }]);
  }, []);

  const addAttachment = useCallback((attachment: Omit<ContextAttachment, 'id'>) => {
    setAttachments(prev => {
      if (prev.some(a => a.entityId === attachment.entityId)) return prev;
      return [...prev, { ...attachment, id: `ATT-${Date.now()}` }];
    });
  }, []);

  const removeAttachment = useCallback((id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  }, []);

  const addNote = useCallback((content: string, author = 'You', isLLMGenerated = false) => {
    setNotes(prev => [...prev, {
      id: `NOTE-${Date.now()}`,
      content,
      body: content,
      author,
      timestamp: new Date().toISOString(),
      isLLMGenerated,
      type: isLLMGenerated ? 'Analysis' : 'Decision',
    }]);
  }, []);

  const addTranscriptEntry = useCallback((speaker: 'You' | 'Ava' | 'Claude', message: string) => {
    setTranscript(prev => [...prev, { 
      id: `TR-${Date.now()}`, 
      speaker, 
      message, 
      timestamp: new Date().toISOString() 
    }]);
  }, []);

  const updatePipelineStep = useCallback((id: string, status: PipelineStep['status'], details?: string) => {
    setPipelineSteps(prev => prev.map(step => step.id === id ? { ...step, status, details } : step));
  }, []);

  const runAnalysis = useCallback(async () => {
    setIsAnalyzing(true);
    setOrbState('thinking');
    await new Promise(resolve => setTimeout(resolve, 2000));
    setAnalysisResult({ 
      summary: 'Payment processing failure detected in Stripe integration', 
      rootCause: 'Expired API key', 
      suspectedCause: 'API key expired on 2024-01-15',
      confidence: 'High',
      affectedSystems: ['Stripe', 'Payment Gateway'], 
      recommendations: ['Rotate API key', 'Update vault secrets'] 
    });
    updatePipelineStep('analyze', 'complete');
    updatePipelineStep('identify', 'complete');
    addNote('**Analysis Complete**\n\nSuspected Cause: Expired Stripe API key\nConfidence: High\nAffected Systems: Stripe, Payment Gateway', 'Ava', true);
    addReceipt({ action: 'Analyzed incident', outcome: 'Success', actor: 'Ava', summary: 'Analysis complete', receiptType: 'attachment_summarized' });
    setIsAnalyzing(false);
    setOrbState('idle');
  }, [updatePipelineStep, addNote, addReceipt]);

  const runFixPlan = useCallback(async () => {
    setIsGeneratingPlan(true);
    setOrbState('thinking');
    await new Promise(resolve => setTimeout(resolve, 1500));
    setFixPlanResult({ 
      steps: ['1. Generate new Stripe API key', '2. Update vault secrets', '3. Restart payment service', '4. Run smoke tests'], 
      estimatedDuration: '15 min', 
      riskLevel: 'low',
      riskRating: 'Low',
      rollbackPlan: 'Revert to previous API key from vault backup'
    });
    updatePipelineStep('plan', 'complete');
    addNote('**Fix Plan Created**\n\n4 steps planned\nEstimated duration: 15 min\nRisk: Low\nRollback: Revert to previous API key', 'Ava', true);
    setIsGeneratingPlan(false);
    setOrbState('idle');
  }, [updatePipelineStep, addNote]);

  const runPatchDraft = useCallback(async () => {
    setIsDraftingPatch(true);
    setOrbState('acting');
    setCurrentPatchJob({
      id: `PATCH-${Date.now()}`,
      state: 'drafting',
      testResults: [
        { name: 'typecheck', status: 'pending' },
        { name: 'lint', status: 'pending' },
        { name: 'unit', status: 'pending' },
        { name: 'smoke', status: 'pending' },
      ],
    });
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Simulate tests running
    setCurrentPatchJob(prev => prev ? {
      ...prev,
      state: 'tests_running',
      testResults: [
        { name: 'typecheck', status: 'running' },
        { name: 'lint', status: 'pending' },
        { name: 'unit', status: 'pending' },
        { name: 'smoke', status: 'pending' },
      ],
    } : null);
    await new Promise(resolve => setTimeout(resolve, 800));
    
    setCurrentPatchJob(prev => prev ? {
      ...prev,
      testResults: [
        { name: 'typecheck', status: 'passed', duration: 1200 },
        { name: 'lint', status: 'running' },
        { name: 'unit', status: 'pending' },
        { name: 'smoke', status: 'pending' },
      ],
    } : null);
    await new Promise(resolve => setTimeout(resolve, 600));
    
    setCurrentPatchJob(prev => prev ? {
      ...prev,
      testResults: [
        { name: 'typecheck', status: 'passed', duration: 1200 },
        { name: 'lint', status: 'passed', duration: 800 },
        { name: 'unit', status: 'running' },
        { name: 'smoke', status: 'pending' },
      ],
    } : null);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    setCurrentPatchJob(prev => prev ? {
      ...prev,
      testResults: [
        { name: 'typecheck', status: 'passed', duration: 1200 },
        { name: 'lint', status: 'passed', duration: 800 },
        { name: 'unit', status: 'passed', duration: 1500 },
        { name: 'smoke', status: 'running' },
      ],
    } : null);
    await new Promise(resolve => setTimeout(resolve, 1200));
    
    setPatchDraftResult({ 
      description: 'Credential rotation patch', 
      changes: ['Updated STRIPE_API_KEY in vault', 'Rotated secrets'], 
      testPlan: 'Run smoke tests',
      impactedAreas: 'payment-service/config, vault/secrets'
    });
    setCurrentPatchJob(prev => prev ? {
      ...prev,
      state: 'tests_passed',
      testResults: [
        { name: 'typecheck', status: 'passed', duration: 1200 },
        { name: 'lint', status: 'passed', duration: 800 },
        { name: 'unit', status: 'passed', duration: 1500 },
        { name: 'smoke', status: 'passed', duration: 1800 },
      ],
      artifacts: {
        impactedFiles: ['payment-service/config.ts', 'vault/secrets.json'],
        patchSummary: 'Rotated Stripe API credentials'
      }
    } : null);
    updatePipelineStep('execute', 'complete');
    addNote('**Patch Drafted**\n\nDescription: Credential rotation\nFiles: payment-service/config, vault/secrets\nAll tests passed!', 'Claude', true);
    addReceipt({ action: 'Drafted patch', outcome: 'Success', actor: 'Claude', summary: 'Patch ready', receiptType: 'patch_drafted' });
    setIsDraftingPatch(false);
    setOrbState('idle');
  }, [updatePipelineStep, addNote, addReceipt]);

  const createApproval = useCallback(async (reason?: string) => {
    setIsCreatingApproval(true);
    await new Promise(resolve => setTimeout(resolve, 500));
    const id = `APR-${Date.now()}`;
    setCreatedApprovalId(id);
    addReceipt({ 
      action: 'Created approval', 
      outcome: 'Success', 
      details: `Approval ${id} created`, 
      actor: 'You',
      summary: reason || 'Approval created',
      receiptType: 'approval_created'
    });
    setIsCreatingApproval(false);
  }, [addReceipt]);

  const toggleReleaseChecklistItem = useCallback((id: string) => {
    setReleaseChecklist(prev => prev.map(item => item.id === id ? { ...item, checked: !item.checked } : item));
  }, []);

  const startConversation = useCallback(() => { 
    setIsConversationActive(true); 
    setOrbState('listening'); 
    addReceipt({ action: 'Started session', outcome: 'Success', actor: 'You', summary: 'Voice session started', receiptType: 'voice_session_started' });
  }, [addReceipt]);
  
  const endConversation = useCallback(() => { 
    setIsConversationActive(false); 
    setOrbState('idle'); 
  }, []);
  
  const interruptSpeaking = useCallback(() => { 
    if (orbState === 'speaking') setOrbState('idle'); 
  }, [orbState]);

  const setVoiceSettings = useCallback((settings: Partial<VoiceSettings>) => {
    setVoiceSettingsState(prev => ({ ...prev, ...settings }));
  }, []);

  const seedDemoData = useCallback(() => {
    setTranscript([
      { id: 'TR-1', speaker: 'You', message: 'Ava, analyze the Stripe failure', timestamp: new Date(Date.now() - 300000).toISOString() },
      { id: 'TR-2', speaker: 'Ava', message: 'I found an expired API key. The Stripe integration stopped working on January 15th when the key expired. I recommend rotating the credentials.', timestamp: new Date(Date.now() - 240000).toISOString() },
      { id: 'TR-3', speaker: 'You', message: 'Generate a fix plan', timestamp: new Date(Date.now() - 180000).toISOString() },
      { id: 'TR-4', speaker: 'Ava', message: 'I\'ve created a 4-step plan: generate new key, update vault, restart service, and run tests. Estimated time is 15 minutes with low risk.', timestamp: new Date(Date.now() - 120000).toISOString() },
    ]);
    setReceipts([
      { id: 'RCP-001', timestamp: new Date(Date.now() - 300000).toISOString(), action: 'Started session', outcome: 'Success', actor: 'You', summary: 'Voice session started', receiptType: 'voice_session_started', correlationId: 'COR-001', attachedContext: ['INC-001'] },
      { id: 'RCP-002', timestamp: new Date(Date.now() - 240000).toISOString(), action: 'Analyzed incident', outcome: 'Success', actor: 'Ava', summary: 'Found expired Stripe API key', receiptType: 'attachment_summarized', correlationId: 'COR-001', attachedContext: ['INC-001', 'Stripe'] },
      { id: 'RCP-003', timestamp: new Date(Date.now() - 120000).toISOString(), action: 'Created fix plan', outcome: 'Success', actor: 'Ava', summary: '4-step remediation plan created', receiptType: 'patch_drafted', correlationId: 'COR-001', attachedContext: ['INC-001'] },
    ]);
    setNotes([
      { id: 'NOTE-001', content: 'Analysis', body: '**Analysis Complete**\n\nSuspected Cause: Expired Stripe API key\nConfidence: High\nAffected Systems: Stripe, Payment Gateway', author: 'Ava', timestamp: new Date(Date.now() - 240000).toISOString(), isLLMGenerated: true, type: 'Analysis' },
      { id: 'NOTE-002', content: 'Fix Plan', body: '**Fix Plan Created**\n\n4 steps planned\nEstimated duration: 15 min\nRisk: Low', author: 'Ava', timestamp: new Date(Date.now() - 120000).toISOString(), isLLMGenerated: true, type: 'Fix Plan' },
    ]);
    setPipelineSteps([
      { id: 'analyze', label: 'Analyze Issue', status: 'complete', details: 'Reviewed logs and API responses' },
      { id: 'identify', label: 'Identify Root Cause', status: 'complete', details: 'Expired Stripe API key' },
      { id: 'plan', label: 'Plan Fix', status: 'in-progress', details: 'Preparing credential rotation' },
      { id: 'execute', label: 'Execute Fix', status: 'pending' },
      { id: 'verify', label: 'Verify Resolution', status: 'pending' },
    ]);
    setAnalysisResult({ 
      summary: 'Payment failure due to expired credentials', 
      rootCause: 'Expired Stripe key', 
      suspectedCause: 'API key expired on 2024-01-15',
      confidence: 'High',
      affectedSystems: ['Stripe', 'Payment Gateway'], 
      recommendations: ['Rotate key', 'Set up key expiration alerts'] 
    });
  }, []);

  const clearAll = useCallback(() => {
    setReceipts([]); 
    setAttachments([]); 
    setNotes([]); 
    setTranscript([]);
    setPipelineSteps(initialPipelineSteps); 
    setOrbState('idle');
    setAnalysisResult(null); 
    setFixPlanResult(null); 
    setPatchDraftResult(null);
    setCreatedApprovalId(null); 
    setReleaseChecklist(initialReleaseChecklist);
    setIsConversationActive(false);
    setCurrentPatchJob(null);
  }, []);

  return (
    <OpsDeskContext.Provider value={{
      receipts, addReceipt, attachments, addAttachment, removeAttachment,
      notes, addNote, transcript, addTranscriptEntry, pipelineSteps, updatePipelineStep,
      orbState, setOrbState, liveOrbActions, fullActionTrace,
      automationMode, setAutomationMode,
      analysisResult, fixPlanResult, patchDraftResult, createdApprovalId, releaseChecklist,
      runAnalysis, runFixPlan, runPatchDraft, createApproval, toggleReleaseChecklistItem,
      isConversationActive, startConversation, endConversation, interruptSpeaking,
      isAnalyzing, isGeneratingPlan, isDraftingPatch, isCreatingApproval,
      currentPatchJob, voiceSettings, setVoiceSettings,
      isElevenLabsConfigured: false, // Placeholder - would be true if ElevenLabs is configured
      seedDemoData, clearAll,
    }}>
      {children}
    </OpsDeskContext.Provider>
  );
}

export function useOpsDesk() {
  const context = useContext(OpsDeskContext);
  if (!context) throw new Error('useOpsDesk must be used within an OpsDeskProvider');
  return context;
}
