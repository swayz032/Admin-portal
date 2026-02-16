// Canonical Ecosystem Contracts - Source of truth for Staff, Skillpacks, Tools, Providers

// ============================================
// Staff Member (Canonical from STAFF_CATALOG)
// ============================================
export type StaffChannel = 'voice' | 'text' | 'email' | 'internal' | 'multi';
export type StaffVisibility = 'external' | 'internal';
export type StaffRole = 
  | 'orchestrator' 
  | 'front_desk' 
  | 'inbox_manager' 
  | 'invoicing' 
  | 'conference_ops' 
  | 'documentation' 
  | 'research'
  | 'finance_analyst'
  | 'operations_analyst'
  | 'legal_analyst';

export interface StaffMember {
  staff_id: string;
  name: string;
  role: StaffRole;
  title: string;
  channel: StaffChannel;
  visibility: StaffVisibility;
  default_skillpack_id?: string;
  hard_rules: string[];
  description: string;
  avatar_emoji: string;
}

// ============================================
// Skillpack Reference
// ============================================
export type SkillpackChannel = 'voice' | 'text' | 'email' | 'internal';
export type CapabilityProfile = 'reactive' | 'proactive' | 'autonomous' | 'supervised';

export interface SkillpackRef {
  skillpack_id: string;
  name: string;
  channel: SkillpackChannel;
  capability_profile: CapabilityProfile;
  owner: 'platform' | 'partner' | 'custom';
  description: string;
  version: string;
}

// ============================================
// Tool Definition (from tool registry)
// ============================================
export type ToolCategory = 
  | 'stt' 
  | 'tts' 
  | 'search' 
  | 'document' 
  | 'communication' 
  | 'payment' 
  | 'crm' 
  | 'calendar'
  | 'storage'
  | 'analytics';

export interface ToolDef {
  tool_id: string;
  name: string;
  category: ToolCategory;
  provider: string;
  requires_secrets: string[];
  capabilities: string[];
  description: string;
}

// ============================================
// Provider Definition (from provider registry)
// ============================================
export type ProviderLane = 'payments' | 'payroll' | 'banking' | 'invoicing' | 'crm' | 'telephony' | 'ai';
export type ProviderStatus = 'connected' | 'disconnected' | 'degraded' | 'pending';

export interface ProviderDef {
  provider_id: string;
  name: string;
  lane: ProviderLane;
  envs: ('development' | 'staging' | 'production')[];
  capabilities: string[];
  status: ProviderStatus;
  icon_url?: string;
}

// ============================================
// Tool Catalog Entry (staff-specific tool config)
// ============================================
export type ApprovalMode = 'auto' | 'voice_confirm' | 'async_approval' | 'escalate';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface ToolCatalogEntry {
  name: string;
  description: string;
  requires_approval: boolean;
  risk: RiskLevel;
  approval_mode?: ApprovalMode;
  receipted: boolean;
}

// ============================================
// Staff Runtime Config (admin-configurable)
// ============================================
export type RolloutState = 'draft' | 'proposed' | 'active' | 'paused' | 'deprecated';

export interface ApprovalRule {
  action_type: string;
  requires_approval: boolean;
  approval_mode: ApprovalMode;
  threshold?: number;
  threshold_unit?: string;
}

export interface ToolPolicy {
  allowlist: string[];
  denylist: string[];
  require_receipts: boolean;
}

export interface ProviderBinding {
  provider_id: string;
  enabled: boolean;
  connection_status: ProviderStatus;
  scopes: string[];
}

export interface StaffRuntimeConfig {
  staff_id: string;
  enabled: boolean;
  suite_id?: string;
  thresholds: Record<string, number>;
  approval_rules: ApprovalRule[];
  tool_policy: ToolPolicy;
  provider_bindings: ProviderBinding[];
  rollout_state: RolloutState;
  updated_at: string;
  updated_by: string;
}

// ============================================
// Sarah-specific Policy (from sarah_policy.yaml)
// ============================================
export interface SarahPolicy {
  max_questions_before_escalate: number;
  forbidden_topics: string[];
  escalation_timing_seconds: number;
  greeting_template: string;
  fallback_action: 'transfer' | 'voicemail' | 'callback';
}

// ============================================
// Nora Admin Controls (from NORA_ADMIN_CONTROLS.md)
// ============================================
export type TranscriptMode = 'full' | 'summary' | 'off';
export type RoutingPolicy = 'round_robin' | 'least_busy' | 'skill_based' | 'manual';

export interface NoraAdminControls {
  transcript_mode: TranscriptMode;
  retention_days: number;
  routing_policy: RoutingPolicy;
  stt_model: string;
  tts_model: string;
  auto_record: boolean;
  max_participants: number;
}

// ============================================
// Effective Config (computed view)
// ============================================
export interface EffectiveToolConfig {
  tool_id: string;
  name: string;
  source: 'base' | 'provider_overlay' | 'override';
  risk: RiskLevel;
  requires_approval: boolean;
  approval_mode: ApprovalMode;
  receipted: boolean;
}

export interface EffectiveConfig {
  staff_id: string;
  staff_name: string;
  enabled: boolean;
  effective_tools: EffectiveToolConfig[];
  expected_receipts: string[];
  risk_summary: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  linked_skillpack: SkillpackRef | null;
  provider_lane: ProviderLane | null;
}
