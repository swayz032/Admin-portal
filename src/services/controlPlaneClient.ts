/**
 * CONTROL PLANE API CLIENT
 * 
 * Stubbed async functions that return canonical-shaped mock data.
 * Ready to wire to real Control Plane API endpoints.
 */

import {
  RegistryItem,
  RegistryFilters,
  Rollout,
  RolloutFilters,
  ConfigChangeProposal,
  BuilderState,
  DEFAULT_CAPABILITIES,
} from '@/contracts/control-plane';

// ============================================================================
// MOCK DATA
// ============================================================================

const MOCK_REGISTRY_ITEMS: RegistryItem[] = [
  {
    id: 'reg-001',
    name: 'Invoice Processor',
    description: 'Automatically processes incoming invoices and routes for approval',
    type: 'agent',
    status: 'active',
    version: '2.1.0',
    owner: 'finance-team',
    category: 'finance',
    risk_tier: 'medium',
    approval_required: true,
    capabilities: [
      { id: 'cap.read_data', name: 'Read Data', description: 'Can read data', enabled: true, category: 'data' },
      { id: 'cap.write_data', name: 'Write Data', description: 'Can write data', enabled: true, category: 'data' },
      { id: 'cap.send_notifications', name: 'Send Notifications', description: 'Can send alerts', enabled: true, category: 'communication' },
    ],
    tool_allowlist: ['db.read', 'db.write', 'email.send', 'invoice.create'],
    prompt_config: {
      version: '2.1.0',
      content: 'You are an invoice processing agent. Analyze incoming invoices, extract key information, and route for appropriate approval based on amount thresholds.',
      variables: { threshold_low: '1000', threshold_high: '10000' },
      updated_at: '2024-01-15T10:30:00Z',
    },
    governance: {
      risk_tier: 'medium',
      approval_category: 'finance',
      required_presence: 'none',
      constraints: ['No auto-approval over $10,000', 'Require manager review for new vendors'],
    },
    created_at: '2023-06-15T08:00:00Z',
    updated_at: '2024-01-15T10:30:00Z',
    internal: true,
  },
  {
    id: 'reg-002',
    name: 'Customer Support Agent',
    description: 'Handles tier-1 customer support inquiries and escalations',
    type: 'agent',
    status: 'active',
    version: '3.0.1',
    owner: 'support-team',
    category: 'support',
    risk_tier: 'low',
    approval_required: false,
    capabilities: [
      { id: 'cap.read_data', name: 'Read Data', description: 'Can read data', enabled: true, category: 'data' },
      { id: 'cap.send_notifications', name: 'Send Notifications', description: 'Can send messages', enabled: true, category: 'communication' },
    ],
    tool_allowlist: ['crm.read', 'email.send', 'slack.post'],
    prompt_config: {
      version: '3.0.1',
      content: 'You are a friendly customer support agent. Help customers with their inquiries, provide accurate information, and escalate complex issues to human agents.',
      variables: { escalation_threshold: '3', tone: 'friendly' },
      updated_at: '2024-01-20T14:00:00Z',
    },
    governance: {
      risk_tier: 'low',
      approval_category: 'support',
      required_presence: 'none',
      constraints: ['Cannot offer refunds', 'Cannot modify account settings'],
    },
    created_at: '2023-04-01T09:00:00Z',
    updated_at: '2024-01-20T14:00:00Z',
    internal: true,
  },
  {
    id: 'reg-003',
    name: 'Data Sync Agent',
    description: 'Synchronizes data between CRM and internal systems',
    type: 'skill_pack',
    status: 'active',
    version: '1.5.0',
    owner: 'engineering-team',
    category: 'engineering',
    risk_tier: 'medium',
    approval_required: false,
    capabilities: [
      { id: 'cap.read_data', name: 'Read Data', description: 'Can read data', enabled: true, category: 'data' },
      { id: 'cap.write_data', name: 'Write Data', description: 'Can write data', enabled: true, category: 'data' },
      { id: 'cap.external_apis', name: 'Access External APIs', description: 'Can call external services', enabled: true, category: 'external' },
    ],
    tool_allowlist: ['db.read', 'db.write', 'crm.read', 'crm.update', 'webhook.call'],
    prompt_config: {
      version: '1.5.0',
      content: 'Data synchronization skill pack for keeping CRM and internal systems in sync.',
      variables: { sync_interval: '5m', batch_size: '100' },
      updated_at: '2024-01-10T16:00:00Z',
    },
    governance: {
      risk_tier: 'medium',
      approval_category: 'engineering',
      required_presence: 'none',
      constraints: ['Rate limited to 1000 ops/hour', 'No delete operations'],
    },
    created_at: '2023-08-20T11:00:00Z',
    updated_at: '2024-01-10T16:00:00Z',
    internal: true,
  },
  {
    id: 'reg-004',
    name: 'Compliance Checker',
    description: 'Reviews transactions for compliance violations',
    type: 'agent',
    status: 'pending_review',
    version: '1.0.0',
    owner: 'legal-team',
    category: 'legal',
    risk_tier: 'high',
    approval_required: true,
    capabilities: [
      { id: 'cap.read_data', name: 'Read Data', description: 'Can read data', enabled: true, category: 'data' },
    ],
    tool_allowlist: ['db.read', 'file.read'],
    prompt_config: {
      version: '1.0.0',
      content: 'You are a compliance review agent. Analyze transactions and flag potential violations.',
      variables: {},
      updated_at: '2024-01-22T09:00:00Z',
    },
    governance: {
      risk_tier: 'high',
      approval_category: 'legal',
      required_presence: 'voice',
      constraints: ['Read-only access', 'All flags require human review'],
    },
    created_at: '2024-01-22T09:00:00Z',
    updated_at: '2024-01-22T09:00:00Z',
    internal: true,
  },
  {
    id: 'reg-005',
    name: 'Legacy Import Tool',
    description: 'One-time data import from legacy system',
    type: 'skill_pack',
    status: 'deprecated',
    version: '1.0.0',
    owner: 'engineering-team',
    category: 'engineering',
    risk_tier: 'medium',
    approval_required: false,
    capabilities: [
      { id: 'cap.read_data', name: 'Read Data', description: 'Can read data', enabled: true, category: 'data' },
      { id: 'cap.write_data', name: 'Write Data', description: 'Can write data', enabled: true, category: 'data' },
    ],
    tool_allowlist: ['db.read', 'db.write', 'file.read'],
    prompt_config: {
      version: '1.0.0',
      content: 'Legacy import skill pack - deprecated.',
      variables: {},
      updated_at: '2023-12-01T10:00:00Z',
    },
    governance: {
      risk_tier: 'medium',
      approval_category: 'engineering',
      required_presence: 'none',
      constraints: [],
    },
    created_at: '2023-03-15T12:00:00Z',
    updated_at: '2023-12-01T10:00:00Z',
    internal: true,
  },
];

const MOCK_ROLLOUTS: Rollout[] = [
  {
    id: 'roll-001',
    registry_item_id: 'reg-001',
    registry_item_name: 'Invoice Processor',
    environment: 'production',
    percentage: 100,
    status: 'completed',
    created_at: '2024-01-15T10:30:00Z',
    updated_at: '2024-01-16T08:00:00Z',
    created_by: 'alice@example.com',
    history: [
      { timestamp: '2024-01-15T10:30:00Z', action: 'created', percentage: 10, actor: 'alice@example.com' },
      { timestamp: '2024-01-15T14:00:00Z', action: 'percentage_changed', percentage: 50, actor: 'alice@example.com' },
      { timestamp: '2024-01-16T08:00:00Z', action: 'completed', percentage: 100, actor: 'alice@example.com' },
    ],
  },
  {
    id: 'roll-002',
    registry_item_id: 'reg-002',
    registry_item_name: 'Customer Support Agent',
    environment: 'production',
    percentage: 75,
    status: 'active',
    created_at: '2024-01-20T14:00:00Z',
    updated_at: '2024-01-21T10:00:00Z',
    created_by: 'bob@example.com',
    history: [
      { timestamp: '2024-01-20T14:00:00Z', action: 'created', percentage: 25, actor: 'bob@example.com' },
      { timestamp: '2024-01-21T10:00:00Z', action: 'percentage_changed', percentage: 75, actor: 'bob@example.com' },
    ],
  },
  {
    id: 'roll-003',
    registry_item_id: 'reg-003',
    registry_item_name: 'Data Sync Agent',
    environment: 'staging',
    percentage: 100,
    status: 'active',
    created_at: '2024-01-22T09:00:00Z',
    updated_at: '2024-01-22T09:00:00Z',
    created_by: 'carol@example.com',
    history: [
      { timestamp: '2024-01-22T09:00:00Z', action: 'created', percentage: 100, actor: 'carol@example.com' },
    ],
  },
  {
    id: 'roll-004',
    registry_item_id: 'reg-002',
    registry_item_name: 'Customer Support Agent',
    environment: 'staging',
    percentage: 0,
    status: 'paused',
    created_at: '2024-01-19T11:00:00Z',
    updated_at: '2024-01-19T15:00:00Z',
    created_by: 'bob@example.com',
    history: [
      { timestamp: '2024-01-19T11:00:00Z', action: 'created', percentage: 50, actor: 'bob@example.com' },
      { timestamp: '2024-01-19T15:00:00Z', action: 'paused', percentage: 0, actor: 'bob@example.com', notes: 'Paused for investigation' },
    ],
  },
];

const MOCK_PROPOSALS: ConfigChangeProposal[] = [
  {
    id: 'prop-001',
    registry_item_id: 'reg-004',
    registry_item_name: 'Compliance Checker',
    change_type: 'create',
    status: 'pending',
    summary: 'New compliance checking agent for transaction review',
    diff: {
      before: {},
      after: { name: 'Compliance Checker', risk_tier: 'high' },
    },
    requested_by: 'legal@example.com',
    requested_at: '2024-01-22T09:00:00Z',
  },
];

// ============================================================================
// API FUNCTIONS
// ============================================================================

// Simulate network delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * List all registry items with optional filters
 */
export async function listRegistryItems(filters?: RegistryFilters): Promise<RegistryItem[]> {
  await delay(300);
  
  let items = [...MOCK_REGISTRY_ITEMS];
  
  if (filters?.type) {
    items = items.filter(i => i.type === filters.type);
  }
  if (filters?.status) {
    items = items.filter(i => i.status === filters.status);
  }
  if (filters?.risk_tier) {
    items = items.filter(i => i.risk_tier === filters.risk_tier);
  }
  if (filters?.search) {
    const term = filters.search.toLowerCase();
    items = items.filter(i => 
      i.name.toLowerCase().includes(term) ||
      i.description.toLowerCase().includes(term)
    );
  }
  
  return items;
}

/**
 * Get a single registry item by ID
 */
export async function getRegistryItem(id: string): Promise<RegistryItem | null> {
  await delay(200);
  return MOCK_REGISTRY_ITEMS.find(i => i.id === id) || null;
}

/**
 * Create a new draft registry item
 */
export async function createDraftRegistryItem(state: BuilderState): Promise<RegistryItem> {
  await delay(400);
  
  const newItem: RegistryItem = {
    id: `reg-${Date.now()}`,
    name: state.name,
    description: state.description,
    type: 'agent',
    status: 'draft',
    version: '0.1.0',
    owner: 'current-user',
    category: state.category,
    risk_tier: state.risk_tier,
    approval_required: state.approval_required,
    capabilities: state.capabilities.length > 0 ? state.capabilities : DEFAULT_CAPABILITIES,
    tool_allowlist: state.tool_allowlist,
    prompt_config: {
      version: state.prompt_version,
      content: state.prompt_content,
      variables: state.config_variables,
      updated_at: new Date().toISOString(),
    },
    governance: {
      risk_tier: state.risk_tier,
      approval_category: state.category,
      required_presence: state.required_presence,
      constraints: state.constraints,
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    internal: state.internal,
  };
  
  return newItem;
}

/**
 * Update an existing draft registry item
 */
export async function updateDraftRegistryItem(
  id: string, 
  patch: Partial<BuilderState>
): Promise<RegistryItem> {
  await delay(300);
  
  const existing = MOCK_REGISTRY_ITEMS.find(i => i.id === id);
  if (!existing) {
    throw new Error(`Registry item ${id} not found`);
  }
  
  return {
    ...existing,
    ...patch,
    updated_at: new Date().toISOString(),
  } as RegistryItem;
}

/**
 * Propose a config change (creates approval request)
 */
export async function proposeConfigChange(
  payload: Partial<ConfigChangeProposal>
): Promise<ConfigChangeProposal> {
  await delay(400);
  
  const proposal: ConfigChangeProposal = {
    id: `prop-${Date.now()}`,
    registry_item_id: payload.registry_item_id || '',
    registry_item_name: payload.registry_item_name,
    change_type: payload.change_type || 'create',
    status: 'pending',
    summary: payload.summary || 'Configuration change proposal',
    diff: payload.diff || { before: {}, after: {} },
    requested_by: 'current-user',
    requested_at: new Date().toISOString(),
  };
  
  return proposal;
}

/**
 * List all rollouts with optional filters
 */
export async function listRollouts(filters?: RolloutFilters): Promise<Rollout[]> {
  await delay(300);
  
  let rollouts = [...MOCK_ROLLOUTS];
  
  if (filters?.environment) {
    rollouts = rollouts.filter(r => r.environment === filters.environment);
  }
  if (filters?.status) {
    rollouts = rollouts.filter(r => r.status === filters.status);
  }
  if (filters?.registry_item_id) {
    rollouts = rollouts.filter(r => r.registry_item_id === filters.registry_item_id);
  }
  
  return rollouts;
}

/**
 * Get a single rollout by ID
 */
export async function getRollout(id: string): Promise<Rollout | null> {
  await delay(200);
  return MOCK_ROLLOUTS.find(r => r.id === id) || null;
}

/**
 * Create a new rollout
 */
export async function createRollout(payload: Partial<Rollout>): Promise<Rollout> {
  await delay(400);
  
  const rollout: Rollout = {
    id: `roll-${Date.now()}`,
    registry_item_id: payload.registry_item_id || '',
    registry_item_name: payload.registry_item_name || 'Unknown',
    environment: payload.environment || 'staging',
    percentage: payload.percentage || 0,
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    created_by: 'current-user',
    history: [
      {
        timestamp: new Date().toISOString(),
        action: 'created',
        percentage: payload.percentage || 0,
        actor: 'current-user',
      },
    ],
  };
  
  return rollout;
}

/**
 * Set rollout percentage
 */
export async function setRolloutPercentage(
  rolloutId: string, 
  percentage: number
): Promise<Rollout> {
  await delay(300);
  
  const rollout = MOCK_ROLLOUTS.find(r => r.id === rolloutId);
  if (!rollout) {
    throw new Error(`Rollout ${rolloutId} not found`);
  }
  
  return {
    ...rollout,
    percentage,
    status: percentage === 100 ? 'completed' : 'active',
    updated_at: new Date().toISOString(),
    history: [
      ...rollout.history,
      {
        timestamp: new Date().toISOString(),
        action: 'percentage_changed',
        percentage,
        actor: 'current-user',
      },
    ],
  };
}

/**
 * Pause a rollout
 */
export async function pauseRollout(rolloutId: string): Promise<Rollout> {
  await delay(300);
  
  const rollout = MOCK_ROLLOUTS.find(r => r.id === rolloutId);
  if (!rollout) {
    throw new Error(`Rollout ${rolloutId} not found`);
  }
  
  return {
    ...rollout,
    status: 'paused',
    updated_at: new Date().toISOString(),
    history: [
      ...rollout.history,
      {
        timestamp: new Date().toISOString(),
        action: 'paused',
        percentage: rollout.percentage,
        actor: 'current-user',
      },
    ],
  };
}

/**
 * Rollback a rollout (creates a proposal)
 */
export async function rollbackRollout(rolloutId: string): Promise<ConfigChangeProposal> {
  await delay(400);
  
  const rollout = MOCK_ROLLOUTS.find(r => r.id === rolloutId);
  if (!rollout) {
    throw new Error(`Rollout ${rolloutId} not found`);
  }
  
  return {
    id: `prop-${Date.now()}`,
    registry_item_id: rollout.registry_item_id,
    registry_item_name: rollout.registry_item_name,
    change_type: 'rollout_change',
    status: 'pending',
    summary: `Rollback request for ${rollout.registry_item_name} in ${rollout.environment}`,
    diff: {
      before: { percentage: rollout.percentage, status: rollout.status },
      after: { percentage: 0, status: 'rolling_back' },
    },
    requested_by: 'current-user',
    requested_at: new Date().toISOString(),
  };
}

/**
 * List pending proposals
 */
export async function listProposals(): Promise<ConfigChangeProposal[]> {
  await delay(200);
  return [...MOCK_PROPOSALS];
}
