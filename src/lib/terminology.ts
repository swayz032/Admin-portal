/**
 * TERMINOLOGY DICTIONARY
 * 
 * Centralized dictionary for Operator/Engineer mode text switching.
 * Operator mode uses plain English; Engineer mode uses canonical terms.
 */

export type ViewMode = 'operator' | 'engineer';

interface TermEntry {
  operator: string;
  engineer: string;
}

interface GlossaryEntry {
  term: string;
  definition: string;
  example?: string;
}

// ============================================================================
// TERMINOLOGY DICTIONARY
// ============================================================================
const TERMINOLOGY: Record<string, TermEntry> = {
  // Core objects
  'term.receipt': { operator: 'Proof log', engineer: 'Receipts' },
  'term.receipt.singular': { operator: 'Proof', engineer: 'Receipt' },
  'term.authority_queue': { operator: 'Approval queue', engineer: 'Authority Queue' },
  'term.authority_queue.singular': { operator: 'Approval', engineer: 'Authority Queue Item' },
  'term.outbox': { operator: 'Execution queue', engineer: 'Outbox' },
  'term.outbox.singular': { operator: 'Pending task', engineer: 'Outbox Job' },
  'term.provider_call_log': { operator: 'Service calls', engineer: 'Provider Call Log' },
  'term.provider_call_log.singular': { operator: 'Service call', engineer: 'Provider Call' },
  'term.incident': { operator: 'Issue', engineer: 'Incident' },
  'term.incidents': { operator: 'Issues', engineer: 'Incidents' },
  
  // IDs and linking
  'term.correlation_id': { operator: 'Request link', engineer: 'Correlation ID' },
  'term.suite_id': { operator: 'Office group', engineer: 'Suite ID' },
  'term.office_id': { operator: 'Office', engineer: 'Office ID' },
  'term.request_id': { operator: 'Request #', engineer: 'Request ID' },
  
  // Concepts
  'term.idempotency': { operator: 'Duplicate protection', engineer: 'Idempotency' },
  'term.safety_mode': { operator: 'Safety Mode', engineer: 'Safety Mode' },
  'term.risk_level': { operator: 'Priority', engineer: 'Risk Level' },
  'term.provider': { operator: 'Service', engineer: 'Provider' },
  'term.providers': { operator: 'Connected services', engineer: 'Providers' },
  
  // Status terms
  'term.status.pending': { operator: 'Waiting', engineer: 'Pending' },
  'term.status.approved': { operator: 'Approved', engineer: 'Approved' },
  'term.status.denied': { operator: 'Denied', engineer: 'Denied' },
  'term.status.success': { operator: 'Completed', engineer: 'Success' },
  'term.status.failed': { operator: 'Failed', engineer: 'Failed' },
  'term.status.blocked': { operator: 'Stopped', engineer: 'Blocked' },
  'term.status.queued': { operator: 'Waiting to run', engineer: 'Queued' },
  'term.status.processing': { operator: 'Running', engineer: 'Processing' },
  
  // Actions
  'term.action.approve': { operator: 'Approve', engineer: 'Approve' },
  'term.action.deny': { operator: 'Deny', engineer: 'Deny' },
  'term.action.pause_writes': { operator: 'Pause changes', engineer: 'Pause Writes' },
  'term.action.resume_writes': { operator: 'Resume changes', engineer: 'Resume Writes' },
  
  // Pages
  'page.dashboard': { operator: "What's Happening", engineer: 'Dashboard' },
  'page.authority_queue': { operator: 'Approvals', engineer: 'Authority Queue' },
  'page.receipts': { operator: 'Proof Log', engineer: 'Receipts' },
  'page.outbox': { operator: 'Task Queue', engineer: 'Outbox' },
  'page.provider_logs': { operator: 'Service Calls', engineer: 'Provider Call Log' },
  'page.providers': { operator: 'Connected Services', engineer: 'Provider Control Center' },
  'page.safety': { operator: 'Safety Controls', engineer: 'Safety Mode' },
  'page.incidents': { operator: 'Issues', engineer: 'Incidents' },
  
  // Control Plane terms
  'term.registry': { operator: 'Agents', engineer: 'Registry Items' },
  'term.registry.singular': { operator: 'Agent', engineer: 'Registry Item' },
  'term.rollout': { operator: 'Deployment', engineer: 'Rollout' },
  'term.rollouts': { operator: 'Deploy Controls', engineer: 'Rollouts' },
  'term.builder': { operator: 'Create Agent', engineer: 'Agent Builder' },
  'term.risk_tier': { operator: 'Safety Level', engineer: 'Risk Tier' },
  'term.approval_required': { operator: 'Needs Your OK', engineer: 'Approval Required' },
  'term.required_presence': { operator: 'Presence Required', engineer: 'Required Presence' },
  'term.tool_allowlist': { operator: 'Allowed Tools', engineer: 'Tool Allowlist' },
  'term.capability': { operator: 'What it can do', engineer: 'Capability' },
  'term.config_change_proposal': { operator: 'Change Request', engineer: 'Config Change Proposal' },
  
  // Staff Config Studio terms
  'term.staff': { operator: 'Team Member', engineer: 'Staff' },
  'term.staff.plural': { operator: 'Team', engineer: 'Staff Registry' },
  'term.skillpack': { operator: 'Skill Set', engineer: 'Skillpack' },
  'term.tool_catalog': { operator: 'Available Actions', engineer: 'Tool Catalog' },
  'term.runtime_config': { operator: 'Settings', engineer: 'Runtime Config' },
  'term.approval_mode': { operator: 'How it needs approval', engineer: 'Approval Mode' },
  'term.approval_mode.auto': { operator: 'Automatic', engineer: 'auto' },
  'term.approval_mode.voice_confirm': { operator: 'Live presence required', engineer: 'voice_confirm' },
  'term.approval_mode.async_approval': { operator: 'Queued for approval', engineer: 'async_approval' },
  'term.approval_mode.escalate': { operator: 'Always escalate', engineer: 'escalate' },
  'term.rollout_state': { operator: 'Status', engineer: 'Rollout State' },
  'term.provider_binding': { operator: 'Connected Service', engineer: 'Provider Binding' },
  
  // Page titles
  'page.registry': { operator: 'Your Agents', engineer: 'Registry Items' },
  'page.builder': { operator: 'Create Agent', engineer: 'Agent Builder' },
  'page.rollouts': { operator: 'Deploy Controls', engineer: 'Rollouts' },
  'page.staff_config': { operator: 'Staff Config Studio', engineer: 'Staff Runtime Configuration' },
};

// ============================================================================
// GLOSSARY DEFINITIONS
// ============================================================================
const GLOSSARY: Record<string, { operator: GlossaryEntry; engineer: GlossaryEntry }> = {
  'glossary.suite_id': {
    operator: {
      term: 'Office Group',
      definition: 'A group of related offices that share settings and data.',
      example: 'Acme Corp West Coast Offices',
    },
    engineer: {
      term: 'Suite ID',
      definition: 'Unique identifier for a tenant partition. All objects within a suite share the same isolation boundary.',
      example: 'suite-acme-corp-001',
    },
  },
  'glossary.office_id': {
    operator: {
      term: 'Office',
      definition: 'A specific location or team within your organization.',
      example: 'San Francisco HQ',
    },
    engineer: {
      term: 'Office ID',
      definition: 'Sub-partition within a suite. Enables per-office isolation and audit trails.',
      example: 'office-sf-hq',
    },
  },
  'glossary.receipt': {
    operator: {
      term: 'Proof',
      definition: 'A record of something that happened - like a receipt at a store. It proves what action was taken.',
    },
    engineer: {
      term: 'Receipt',
      definition: 'Immutable audit log entry capturing action execution. Contains correlation_id for trace linking.',
    },
  },
  'glossary.authority_queue': {
    operator: {
      term: 'Approval',
      definition: 'A request waiting for you to approve or deny. High-priority items need attention first.',
    },
    engineer: {
      term: 'Authority Queue Item',
      definition: 'Pending approval request in the AuthorityQueue. Blocks downstream execution until resolved.',
    },
  },
  'glossary.outbox': {
    operator: {
      term: 'Task Queue',
      definition: 'Actions waiting to be executed. Once approved, tasks move here before running.',
    },
    engineer: {
      term: 'Outbox',
      definition: 'Transactional outbox pattern implementation. Ensures exactly-once execution semantics.',
    },
  },
  'glossary.provider_call_log': {
    operator: {
      term: 'Service Call',
      definition: 'A record of communication with connected services like Stripe or Salesforce.',
    },
    engineer: {
      term: 'Provider Call Log',
      definition: 'Request/response log for external API calls. Includes timing, status, and correlation.',
    },
  },
  'glossary.correlation_id': {
    operator: {
      term: 'Request Link',
      definition: 'A unique ID that connects related actions together. Helps you trace what happened.',
    },
    engineer: {
      term: 'Correlation ID',
      definition: 'Distributed tracing identifier. Links Receipts, AuthorityQueue items, and ProviderCallLogs.',
    },
  },
  'glossary.idempotency': {
    operator: {
      term: 'Duplicate Protection',
      definition: 'The system ensures actions only happen once, even if requested multiple times.',
    },
    engineer: {
      term: 'Idempotency',
      definition: 'Guarantee that repeated requests with same idempotency key produce identical results.',
    },
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get a term in the appropriate mode
 */
export function getTerm(key: string, mode: ViewMode): string {
  const entry = TERMINOLOGY[key];
  if (!entry) {
    console.warn(`Missing terminology key: ${key}`);
    return key;
  }
  return entry[mode];
}

/**
 * Get a glossary entry in the appropriate mode
 */
export function getGlossaryEntry(key: string, mode: ViewMode): GlossaryEntry | null {
  const entry = GLOSSARY[key];
  if (!entry) {
    console.warn(`Missing glossary key: ${key}`);
    return null;
  }
  return entry[mode];
}

/**
 * Get all glossary entries for a mode
 */
export function getAllGlossaryEntries(mode: ViewMode): GlossaryEntry[] {
  return Object.values(GLOSSARY).map(entry => entry[mode]);
}

/**
 * Create a mode-aware text helper
 */
export function createModeText(mode: ViewMode) {
  return (operatorText: string, engineerText: string): string => {
    return mode === 'operator' ? operatorText : engineerText;
  };
}
