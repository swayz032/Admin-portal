/**
 * REGISTRY CLIENT — Real Supabase queries for Agent Registry, Rollouts, Proposals
 *
 * Replaces controlPlaneClient.ts mock data with live Supabase queries.
 * RLS policies enforce tenant isolation (Law #6).
 * State-changing operations emit receipts via window event (Law #2).
 */

import { supabase } from '@/integrations/supabase/client';
import { devError } from '@/lib/devLog';
import { fetchOpsModelPolicy, updateOpsModelPolicy } from './opsFacadeClient';
import type {
  RegistryItem,
  RegistryFilters,
  Rollout,
  RolloutFilters,
  ConfigChangeProposal,
  BuilderState,
  BuilderModelPolicy,
} from '@/contracts/control-plane';

// ============================================================================
// RECEIPT EMISSION (Law #2) — persisted to Supabase audit_log + window event
// ============================================================================

async function getAuthUserId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? 'unknown';
}

async function emitControlPlaneReceipt(action: string, outcome: 'Success' | 'Failed', detail?: string): Promise<void> {
  const userId = await getAuthUserId();
  const receiptPayload = {
    action,
    outcome,
    actor: userId,
    receiptType: 'control_plane',
    summary: detail,
    timestamp: new Date().toISOString(),
  };

  // Persist to audit_log (primary — Law #2)
  try {
    await supabase.from('audit_log').insert({
      user_id: userId !== 'unknown' ? userId : null,
      event: `control_plane.${action}`,
      details: receiptPayload,
      ip_address: null,
    });
  } catch (err) {
    devError('Failed to persist control plane receipt:', err);
  }

  // Also emit window event for in-page listeners (secondary)
  if (typeof window !== 'undefined' && window.dispatchEvent) {
    window.dispatchEvent(new CustomEvent('aspire:receipt', { detail: receiptPayload }));
  }
}

// ============================================================================
// REGISTRY ITEMS
// ============================================================================

function mapRegistryRow(row: Record<string, unknown>): RegistryItem {
  return {
    id: row.id as string,
    name: row.name as string,
    description: (row.description as string) || '',
    type: row.type as RegistryItem['type'],
    status: row.status as RegistryItem['status'],
    version: (row.version as string) || '1.0.0',
    owner: (row.owner as string) || '',
    category: (row.category as string) || '',
    risk_tier: (row.risk_tier === 'red' ? 'high' : row.risk_tier === 'yellow' ? 'medium' : 'low') as RegistryItem['risk_tier'],
    approval_required: (row.approval_required as boolean) || false,
    capabilities: (row.capabilities as RegistryItem['capabilities']) || [],
    tool_allowlist: (row.tool_allowlist as string[]) || [],
    prompt_config: (row.prompt_config as RegistryItem['prompt_config']) || { version: '1.0.0', content: '', variables: {}, updated_at: '' },
    governance: (row.governance as RegistryItem['governance']) || { risk_tier: 'low', approval_category: '', required_presence: 'none', constraints: [] },
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    internal: (row.internal as boolean) || false,
  };
}

export async function listRegistryItems(filters?: RegistryFilters): Promise<RegistryItem[]> {
  let query = supabase.from('agent_registry').select('*');

  if (filters?.type) {
    query = query.eq('type', filters.type);
  }
  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  if (filters?.risk_tier) {
    const dbTier = filters.risk_tier === 'high' ? 'red' : filters.risk_tier === 'medium' ? 'yellow' : 'green';
    query = query.eq('risk_tier', dbTier);
  }
  if (filters?.search) {
    // Sanitize search input to prevent PostgREST filter injection (Law #9)
    const sanitized = filters.search.replace(/[%_(),.'"\\]/g, '');
    if (sanitized) {
      query = query.or(`name.ilike.%${sanitized}%,description.ilike.%${sanitized}%`);
    }
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    devError('Failed to fetch registry items:', error.message);
    return [];
  }

  return (data || []).map(mapRegistryRow);
}

export async function getRegistryItem(id: string): Promise<RegistryItem | null> {
  const { data, error } = await supabase
    .from('agent_registry')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) return null;
  return mapRegistryRow(data);
}

export async function createDraftRegistryItem(state: BuilderState): Promise<RegistryItem> {
  const dbRiskTier = state.risk_tier === 'high' ? 'red' : state.risk_tier === 'medium' ? 'yellow' : 'green';
  const userId = await getAuthUserId();

  const { data, error } = await supabase
    .from('agent_registry')
    .insert({
      name: state.name,
      description: state.description,
      type: 'agent',
      status: 'pending_review',
      version: '0.1.0',
      owner: userId,
      category: state.category,
      risk_tier: dbRiskTier,
      approval_required: state.approval_required,
      capabilities: state.capabilities,
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
      internal: state.internal,
    })
    .select()
    .single();

  if (error || !data) {
    emitControlPlaneReceipt('registry.create_draft', 'Failed', error?.message);
    throw new Error(error?.message || 'Failed to create registry item');
  }

  emitControlPlaneReceipt('registry.create_draft', 'Success', `Created draft: ${state.name}`);
  return mapRegistryRow(data);
}

export async function updateDraftRegistryItem(
  id: string,
  patch: Partial<BuilderState>,
): Promise<RegistryItem> {
  const updateFields: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.name !== undefined) updateFields.name = patch.name;
  if (patch.description !== undefined) updateFields.description = patch.description;
  if (patch.category !== undefined) updateFields.category = patch.category;
  if (patch.risk_tier !== undefined) {
    updateFields.risk_tier = patch.risk_tier === 'high' ? 'red' : patch.risk_tier === 'medium' ? 'yellow' : 'green';
  }
  if (patch.approval_required !== undefined) updateFields.approval_required = patch.approval_required;
  if (patch.capabilities !== undefined) updateFields.capabilities = patch.capabilities;
  if (patch.tool_allowlist !== undefined) updateFields.tool_allowlist = patch.tool_allowlist;
  if (patch.internal !== undefined) updateFields.internal = patch.internal;

  const { data, error } = await supabase
    .from('agent_registry')
    .update(updateFields)
    .eq('id', id)
    .select()
    .single();

  if (error || !data) {
    emitControlPlaneReceipt('registry.update_draft', 'Failed', error?.message);
    throw new Error(error?.message || `Registry item ${id} not found`);
  }

  emitControlPlaneReceipt('registry.update_draft', 'Success', `Updated draft: ${id}`);
  return mapRegistryRow(data);
}

// ============================================================================
// ROLLOUTS
// ============================================================================

function mapRolloutRow(row: Record<string, unknown>): Rollout {
  return {
    id: row.id as string,
    registry_item_id: row.registry_item_id as string,
    registry_item_name: (row.registry_item_name as string) || '',
    environment: (row.environment as Rollout['environment']) || 'staging',
    percentage: (row.percentage as number) || 0,
    status: (row.status as Rollout['status']) || 'active',
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    created_by: (row.created_by as string) || '',
    history: (row.history as Rollout['history']) || [],
  };
}

export async function listRollouts(filters?: RolloutFilters): Promise<Rollout[]> {
  let query = supabase.from('config_rollouts').select('*');

  if (filters?.environment) {
    query = query.eq('environment', filters.environment);
  }
  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  if (filters?.registry_item_id) {
    query = query.eq('registry_item_id', filters.registry_item_id);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    devError('Failed to fetch rollouts:', error.message);
    return [];
  }

  return (data || []).map(mapRolloutRow);
}

export async function getRollout(id: string): Promise<Rollout | null> {
  const { data, error } = await supabase
    .from('config_rollouts')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) return null;
  return mapRolloutRow(data);
}

export async function createRollout(payload: Partial<Rollout>): Promise<Rollout> {
  const userId = await getAuthUserId();
  const historyEntry = {
    timestamp: new Date().toISOString(),
    action: 'created',
    percentage: payload.percentage || 0,
    actor: userId,
  };

  const { data, error } = await supabase
    .from('config_rollouts')
    .insert({
      registry_item_id: payload.registry_item_id,
      registry_item_name: payload.registry_item_name || 'Unknown',
      environment: payload.environment || 'staging',
      percentage: payload.percentage || 0,
      status: 'active',
      created_by: userId,
      history: [historyEntry],
    })
    .select()
    .single();

  if (error || !data) {
    emitControlPlaneReceipt('rollout.create', 'Failed', error?.message);
    throw new Error(error?.message || 'Failed to create rollout');
  }

  emitControlPlaneReceipt('rollout.create', 'Success', `Rollout: ${data.registry_item_name} → ${data.environment}`);
  return mapRolloutRow(data);
}

export async function setRolloutPercentage(rolloutId: string, percentage: number): Promise<Rollout> {
  const existing = await getRollout(rolloutId);
  if (!existing) throw new Error(`Rollout ${rolloutId} not found`);

  const userId = await getAuthUserId();
  const historyEntry = {
    timestamp: new Date().toISOString(),
    action: 'percentage_changed',
    percentage,
    actor: userId,
  };

  const { data, error } = await supabase
    .from('config_rollouts')
    .update({
      percentage,
      status: percentage === 100 ? 'completed' : 'active',
      updated_at: new Date().toISOString(),
      history: [...existing.history, historyEntry],
    })
    .eq('id', rolloutId)
    .select()
    .single();

  if (error || !data) {
    emitControlPlaneReceipt('rollout.set_percentage', 'Failed', error?.message);
    throw new Error(error?.message || 'Failed to update rollout');
  }

  emitControlPlaneReceipt('rollout.set_percentage', 'Success', `${rolloutId} → ${percentage}%`);
  return mapRolloutRow(data);
}

export async function pauseRollout(rolloutId: string): Promise<Rollout> {
  const existing = await getRollout(rolloutId);
  if (!existing) throw new Error(`Rollout ${rolloutId} not found`);

  const userId = await getAuthUserId();
  const historyEntry = {
    timestamp: new Date().toISOString(),
    action: 'paused',
    percentage: existing.percentage,
    actor: userId,
  };

  const { data, error } = await supabase
    .from('config_rollouts')
    .update({
      status: 'paused',
      updated_at: new Date().toISOString(),
      history: [...existing.history, historyEntry],
    })
    .eq('id', rolloutId)
    .select()
    .single();

  if (error || !data) {
    emitControlPlaneReceipt('rollout.pause', 'Failed', error?.message);
    throw new Error(error?.message || 'Failed to pause rollout');
  }

  emitControlPlaneReceipt('rollout.pause', 'Success', `Paused: ${rolloutId}`);
  return mapRolloutRow(data);
}

export async function rollbackRollout(rolloutId: string): Promise<ConfigChangeProposal> {
  const rollout = await getRollout(rolloutId);
  if (!rollout) throw new Error(`Rollout ${rolloutId} not found`);

  return proposeConfigChange({
    registry_item_id: rollout.registry_item_id,
    registry_item_name: rollout.registry_item_name,
    change_type: 'rollout_change',
    summary: `Rollback request for ${rollout.registry_item_name} in ${rollout.environment}`,
    diff: {
      before: { percentage: rollout.percentage, status: rollout.status },
      after: { percentage: 0, status: 'rolling_back' },
    },
  });
}

// ============================================================================
// PROPOSALS
// ============================================================================

function mapProposalRow(row: Record<string, unknown>): ConfigChangeProposal {
  return {
    id: row.id as string,
    registry_item_id: (row.registry_item_id as string) || '',
    registry_item_name: (row.registry_item_name as string) || '',
    change_type: (row.change_type as ConfigChangeProposal['change_type']) || 'update',
    status: (row.status as ConfigChangeProposal['status']) || 'pending',
    summary: (row.summary as string) || '',
    diff: (row.diff as ConfigChangeProposal['diff']) || { before: {}, after: {} },
    requested_by: (row.requested_by as string) || '',
    requested_at: (row.requested_at as string) || row.created_at as string,
    decided_at: row.decided_at as string | undefined,
    decided_by: row.decided_by as string | undefined,
    correlation_id: row.correlation_id as string | undefined,
  };
}

export async function listProposals(statusFilter?: string): Promise<ConfigChangeProposal[]> {
  let query = supabase.from('config_proposals').select('*');

  if (statusFilter) {
    query = query.eq('status', statusFilter);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    devError('Failed to fetch proposals:', error.message);
    return [];
  }

  return (data || []).map(mapProposalRow);
}

export async function proposeConfigChange(
  payload: Partial<ConfigChangeProposal>,
): Promise<ConfigChangeProposal> {
  const { data, error } = await supabase
    .from('config_proposals')
    .insert({
      registry_item_id: payload.registry_item_id || null,
      registry_item_name: payload.registry_item_name || 'Unknown',
      change_type: payload.change_type || 'create',
      status: 'pending',
      summary: payload.summary || 'Configuration change proposal',
      diff: payload.diff || { before: {}, after: {} },
      requested_by: await getAuthUserId(),
      correlation_id: payload.correlation_id || null,
    })
    .select()
    .single();

  if (error || !data) {
    emitControlPlaneReceipt('config.propose_change', 'Failed', error?.message);
    throw new Error(error?.message || 'Failed to create proposal');
  }

  emitControlPlaneReceipt('config.propose_change', 'Success', `Proposal: ${data.summary}`);
  return mapProposalRow(data);
}

// ============================================================================
// MODEL POLICY (delegates to opsFacadeClient)
// ============================================================================

export { type BuilderModelPolicy } from '@/contracts/control-plane';

export async function getBuilderModelPolicy(): Promise<BuilderModelPolicy> {
  const response = await fetchOpsModelPolicy();
  return response.policy;
}

export async function setBuilderModelPolicy(policy: {
  builder_primary_model: string;
  builder_fallback_model: string;
  reasoning_model: string;
}): Promise<BuilderModelPolicy> {
  const response = await updateOpsModelPolicy(policy);
  return response.policy;
}
