/**
 * CONTROL PLANE CONTRACTS
 * 
 * TypeScript interfaces aligned with Aspire Ecosystem control-plane schemas.
 * These represent canonical shapes for Registry Items, Rollouts, and Config Change Proposals.
 */

// ============================================================================
// REGISTRY ITEM (Agent / Skill Pack Definition)
// ============================================================================

export type RegistryItemType = 'agent' | 'skill_pack';
export type RegistryItemStatus = 'draft' | 'pending_review' | 'active' | 'deprecated' | 'disabled';
export type RiskTier = 'low' | 'medium' | 'high';
export type RequiredPresence = 'none' | 'voice' | 'video';

export interface RegistryCapability {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  category: 'data' | 'communication' | 'automation' | 'external';
}

export interface PromptConfig {
  version: string;
  content: string;
  variables: Record<string, string>;
  updated_at: string;
}

export interface GovernanceConfig {
  risk_tier: RiskTier;
  approval_category: string;
  required_presence: RequiredPresence;
  constraints: string[];
}

export interface RegistryItem {
  id: string;
  name: string;
  description: string;
  type: RegistryItemType;
  status: RegistryItemStatus;
  version: string;
  owner: string;
  category: string;
  risk_tier: RiskTier;
  approval_required: boolean;
  capabilities: RegistryCapability[];
  tool_allowlist: string[];
  prompt_config: PromptConfig;
  governance: GovernanceConfig;
  created_at: string;
  updated_at: string;
  internal: boolean;
}

// ============================================================================
// ROLLOUT
// ============================================================================

export type RolloutEnvironment = 'development' | 'staging' | 'production';
export type RolloutStatus = 'active' | 'paused' | 'rolling_back' | 'completed';

export interface RolloutHistoryEntry {
  timestamp: string;
  action: 'created' | 'percentage_changed' | 'paused' | 'resumed' | 'rollback_initiated' | 'completed';
  percentage: number;
  actor: string;
  notes?: string;
}

export interface Rollout {
  id: string;
  registry_item_id: string;
  registry_item_name: string;
  environment: RolloutEnvironment;
  percentage: number;
  status: RolloutStatus;
  created_at: string;
  updated_at: string;
  created_by: string;
  history: RolloutHistoryEntry[];
}

// ============================================================================
// CONFIG CHANGE PROPOSAL
// ============================================================================

export type ChangeType = 'create' | 'update' | 'deprecate' | 'rollout_change';
export type ProposalStatus = 'pending' | 'approved' | 'denied' | 'applied';

export interface ProposalDiff {
  before: Record<string, unknown>;
  after: Record<string, unknown>;
}

export interface ConfigChangeProposal {
  id: string;
  registry_item_id: string;
  registry_item_name?: string;
  change_type: ChangeType;
  status: ProposalStatus;
  summary: string;
  diff: ProposalDiff;
  requested_by: string;
  requested_at: string;
  decided_at?: string;
  decided_by?: string;
  correlation_id?: string;
}

// ============================================================================
// BUILDER STATE (for multi-step wizard)
// ============================================================================

export interface BuilderState {
  // Step 1: Identity
  name: string;
  description: string;
  category: string;
  template: string;
  internal: boolean;
  notes: string;
  
  // Step 2: Capabilities
  capabilities: RegistryCapability[];
  tool_allowlist: string[];
  
  // Step 3: Governance
  risk_tier: RiskTier;
  approval_required: boolean;
  required_presence: RequiredPresence;
  constraints: string[];
  
  // Step 4: Prompt & Config
  prompt_content: string;
  prompt_version: string;
  config_variables: Record<string, string>;
}

export const DEFAULT_BUILDER_STATE: BuilderState = {
  name: '',
  description: '',
  category: 'operations',
  template: 'scratch',
  internal: true,
  notes: '',
  capabilities: [],
  tool_allowlist: [],
  risk_tier: 'low',
  approval_required: false,
  required_presence: 'none',
  constraints: [],
  prompt_content: '',
  prompt_version: '1.0.0',
  config_variables: {},
};

// ============================================================================
// FILTER TYPES
// ============================================================================

export interface RegistryFilters {
  type?: RegistryItemType;
  status?: RegistryItemStatus;
  risk_tier?: RiskTier;
  search?: string;
}

export interface RolloutFilters {
  environment?: RolloutEnvironment;
  status?: RolloutStatus;
  registry_item_id?: string;
}

// ============================================================================
// AVAILABLE TOOLS (for builder)
// ============================================================================

export interface AvailableTool {
  id: string;
  name: string;
  description: string;
  category: 'communication' | 'data' | 'finance' | 'crm' | 'automation';
  risk_level: RiskTier;
}

export const AVAILABLE_TOOLS: AvailableTool[] = [
  // Communication
  { id: 'email.send', name: 'Send Email', description: 'Send emails to customers or team', category: 'communication', risk_level: 'medium' },
  { id: 'email.read', name: 'Read Email', description: 'Read incoming emails', category: 'communication', risk_level: 'low' },
  { id: 'slack.post', name: 'Post to Slack', description: 'Send messages to Slack channels', category: 'communication', risk_level: 'low' },
  { id: 'sms.send', name: 'Send SMS', description: 'Send text messages', category: 'communication', risk_level: 'medium' },
  
  // Data
  { id: 'db.read', name: 'Read Database', description: 'Query database records', category: 'data', risk_level: 'low' },
  { id: 'db.write', name: 'Write Database', description: 'Create or update records', category: 'data', risk_level: 'medium' },
  { id: 'db.delete', name: 'Delete Records', description: 'Remove database records', category: 'data', risk_level: 'high' },
  { id: 'file.read', name: 'Read Files', description: 'Read file contents', category: 'data', risk_level: 'low' },
  { id: 'file.write', name: 'Write Files', description: 'Create or update files', category: 'data', risk_level: 'medium' },
  
  // Finance
  { id: 'stripe.read', name: 'Read Stripe', description: 'View payment data', category: 'finance', risk_level: 'low' },
  { id: 'stripe.charge', name: 'Create Charge', description: 'Process payments', category: 'finance', risk_level: 'high' },
  { id: 'stripe.refund', name: 'Issue Refund', description: 'Refund payments', category: 'finance', risk_level: 'high' },
  { id: 'invoice.create', name: 'Create Invoice', description: 'Generate invoices', category: 'finance', risk_level: 'medium' },
  
  // CRM
  { id: 'crm.read', name: 'Read CRM', description: 'View customer records', category: 'crm', risk_level: 'low' },
  { id: 'crm.update', name: 'Update CRM', description: 'Modify customer records', category: 'crm', risk_level: 'medium' },
  { id: 'crm.contact', name: 'Contact Customer', description: 'Initiate customer contact', category: 'crm', risk_level: 'medium' },
  
  // Automation
  { id: 'workflow.trigger', name: 'Trigger Workflow', description: 'Start automated workflows', category: 'automation', risk_level: 'medium' },
  { id: 'webhook.call', name: 'Call Webhook', description: 'Invoke external webhooks', category: 'automation', risk_level: 'medium' },
  { id: 'schedule.create', name: 'Schedule Task', description: 'Create scheduled tasks', category: 'automation', risk_level: 'low' },
];

// ============================================================================
// DEFAULT CAPABILITIES
// ============================================================================

export const DEFAULT_CAPABILITIES: RegistryCapability[] = [
  { id: 'cap.read_data', name: 'Read Data', description: 'Can read data from connected systems', enabled: false, category: 'data' },
  { id: 'cap.write_data', name: 'Write Data', description: 'Can create or modify data', enabled: false, category: 'data' },
  { id: 'cap.send_notifications', name: 'Send Notifications', description: 'Can send emails, messages, or alerts', enabled: false, category: 'communication' },
  { id: 'cap.trigger_automations', name: 'Trigger Automations', description: 'Can start automated workflows', enabled: false, category: 'automation' },
  { id: 'cap.external_apis', name: 'Access External APIs', description: 'Can call external services', enabled: false, category: 'external' },
];

// ============================================================================
// TEMPLATE DEFINITIONS
// ============================================================================

export interface AgentTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  defaults: Partial<BuilderState>;
}

export const AGENT_TEMPLATES: AgentTemplate[] = [
  {
    id: 'scratch',
    name: 'Start from Scratch',
    description: 'Build a custom agent with no preset configuration',
    category: 'custom',
    defaults: {},
  },
  {
    id: 'general_ops',
    name: 'General Operations',
    description: 'Standard operations agent with balanced capabilities',
    category: 'operations',
    defaults: {
      category: 'operations',
      risk_tier: 'medium',
      capabilities: [
        { id: 'cap.read_data', name: 'Read Data', description: 'Can read data', enabled: true, category: 'data' },
        { id: 'cap.send_notifications', name: 'Send Notifications', description: 'Can send alerts', enabled: true, category: 'communication' },
      ],
    },
  },
  {
    id: 'finance_ops',
    name: 'Finance Operations',
    description: 'Specialized for financial operations with higher governance',
    category: 'finance',
    defaults: {
      category: 'finance',
      risk_tier: 'high',
      approval_required: true,
      capabilities: [
        { id: 'cap.read_data', name: 'Read Data', description: 'Can read data', enabled: true, category: 'data' },
      ],
    },
  },
  {
    id: 'support_ops',
    name: 'Support Operations',
    description: 'Customer support agent with communication focus',
    category: 'support',
    defaults: {
      category: 'support',
      risk_tier: 'low',
      capabilities: [
        { id: 'cap.read_data', name: 'Read Data', description: 'Can read data', enabled: true, category: 'data' },
        { id: 'cap.send_notifications', name: 'Send Notifications', description: 'Can send messages', enabled: true, category: 'communication' },
      ],
    },
  },
  {
    id: 'engineering_ops',
    name: 'Engineering Operations',
    description: 'Development and infrastructure operations',
    category: 'engineering',
    defaults: {
      category: 'engineering',
      risk_tier: 'medium',
      capabilities: [
        { id: 'cap.read_data', name: 'Read Data', description: 'Can read data', enabled: true, category: 'data' },
        { id: 'cap.trigger_automations', name: 'Trigger Automations', description: 'Can trigger workflows', enabled: true, category: 'automation' },
      ],
    },
  },
];
