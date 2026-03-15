/**
 * registryClient.ts — Happy-path tests (Wave 7.4)
 *
 * Validates all exported functions against Supabase mocks.
 * Confirms risk tier mapping, filter application, and receipt emission (Law #2).
 * Supabase is mocked at '@/integrations/supabase/client'.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mutable mock refs — rebuilt in each test ─────────────────────────────────
const mockSingle   = vi.fn();
const mockOrder    = vi.fn();
const mockEq       = vi.fn();
const mockOr       = vi.fn();
const mockSelect   = vi.fn();
const mockInsert   = vi.fn();
const mockUpdate   = vi.fn();
const mockFrom     = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    get from() { return mockFrom; },
  },
}));

// opsFacadeClient is used only by getBuilderModelPolicy/setBuilderModelPolicy —
// those are outside the scope of this file. Stub it to avoid real network calls.
vi.mock('@/services/opsFacadeClient', () => ({
  fetchOpsModelPolicy: vi.fn().mockResolvedValue({ policy: {} }),
  updateOpsModelPolicy: vi.fn().mockResolvedValue({ policy: {} }),
}));

// ── Sample DB rows ────────────────────────────────────────────────────────────

const makeRegistryRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'reg-001',
  name: 'Finn Finance Manager',
  description: 'Finance intelligence agent',
  type: 'agent',
  status: 'active',
  version: '1.0.0',
  owner: 'platform',
  category: 'finance',
  risk_tier: 'yellow',          // DB tier — should map to 'medium'
  approval_required: true,
  capabilities: [],
  tool_allowlist: ['stripe.read'],
  prompt_config: { version: '1.0.0', content: '', variables: {}, updated_at: '' },
  governance: { risk_tier: 'medium', approval_category: 'finance', required_presence: 'none', constraints: [] },
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-02T00:00:00Z',
  internal: true,
  ...overrides,
});

const makeRolloutRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'roll-001',
  registry_item_id: 'reg-001',
  registry_item_name: 'Finn Finance Manager',
  environment: 'staging',
  percentage: 50,
  status: 'active',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-02T00:00:00Z',
  created_by: 'admin',
  history: [],
  ...overrides,
});

const makeProposalRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'prop-001',
  registry_item_id: 'reg-001',
  registry_item_name: 'Finn Finance Manager',
  change_type: 'update',
  status: 'pending',
  summary: 'Update risk tier',
  diff: { before: {}, after: {} },
  requested_by: 'current-user',
  requested_at: '2026-01-01T00:00:00Z',
  created_at: '2026-01-01T00:00:00Z',
  ...overrides,
});

// ── Helper: wire the query chain mock ────────────────────────────────────────

/**
 * Builds a Supabase-like query chain where:
 *   .eq() / .or() → return the same chainable object (for filters)
 *   .order()      → resolves with { data, error }
 *   .single()     → resolves with { data, error }
 */
function wireSelectChain(resolvedData: unknown, error: unknown = null) {
  const chain = {
    eq:     mockEq.mockReturnThis(),
    or:     mockOr.mockReturnThis(),
    order:  mockOrder.mockResolvedValue({ data: resolvedData, error }),
    single: mockSingle.mockResolvedValue({ data: resolvedData, error }),
  };
  mockSelect.mockReturnValue(chain);
  return chain;
}

function wireInsertChain(resolvedData: unknown, error: unknown = null) {
  const selectChain = {
    single: mockSingle.mockResolvedValue({ data: resolvedData, error }),
  };
  mockSelect.mockReturnValue(selectChain);
  mockInsert.mockReturnValue({ select: mockSelect });
  mockFrom.mockReturnValue({ insert: mockInsert });
}

function wireUpdateChain(resolvedData: unknown, error: unknown = null) {
  const selectChain = {
    single: mockSingle.mockResolvedValue({ data: resolvedData, error }),
  };
  mockSelect.mockReturnValue(selectChain);
  const eqChain = { select: mockSelect };
  mockEq.mockReturnValue(eqChain);
  mockUpdate.mockReturnValue({ eq: mockEq });
  mockFrom.mockReturnValue({ update: mockUpdate, select: mockSelect, insert: mockInsert });
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('registryClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── listRegistryItems ───────────────────────────────────────────────────────

  describe('listRegistryItems()', () => {
    it('returns an array of RegistryItem objects', async () => {
      const row = makeRegistryRow();
      const chain = {
        eq:    mockEq.mockReturnThis(),
        or:    mockOr.mockReturnThis(),
        order: mockOrder.mockResolvedValue({ data: [row], error: null }),
        single: mockSingle,
      };
      mockSelect.mockReturnValue(chain);
      mockFrom.mockReturnValue({ select: mockSelect });

      const { listRegistryItems } = await import('./registryClient');
      const result = await listRegistryItems();

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('reg-001');
    });

    it('maps DB risk_tier "yellow" → "medium"', async () => {
      const chain = {
        eq:    mockEq.mockReturnThis(),
        or:    mockOr.mockReturnThis(),
        order: mockOrder.mockResolvedValue({ data: [makeRegistryRow({ risk_tier: 'yellow' })], error: null }),
        single: mockSingle,
      };
      mockSelect.mockReturnValue(chain);
      mockFrom.mockReturnValue({ select: mockSelect });

      const { listRegistryItems } = await import('./registryClient');
      const result = await listRegistryItems();
      expect(result[0].risk_tier).toBe('medium');
    });

    it('maps DB risk_tier "red" → "high"', async () => {
      const chain = {
        eq:    mockEq.mockReturnThis(),
        or:    mockOr.mockReturnThis(),
        order: mockOrder.mockResolvedValue({ data: [makeRegistryRow({ risk_tier: 'red' })], error: null }),
        single: mockSingle,
      };
      mockSelect.mockReturnValue(chain);
      mockFrom.mockReturnValue({ select: mockSelect });

      const { listRegistryItems } = await import('./registryClient');
      const result = await listRegistryItems();
      expect(result[0].risk_tier).toBe('high');
    });

    it('maps DB risk_tier "green" → "low"', async () => {
      const chain = {
        eq:    mockEq.mockReturnThis(),
        or:    mockOr.mockReturnThis(),
        order: mockOrder.mockResolvedValue({ data: [makeRegistryRow({ risk_tier: 'green' })], error: null }),
        single: mockSingle,
      };
      mockSelect.mockReturnValue(chain);
      mockFrom.mockReturnValue({ select: mockSelect });

      const { listRegistryItems } = await import('./registryClient');
      const result = await listRegistryItems();
      expect(result[0].risk_tier).toBe('low');
    });

    it('applies type filter via .eq("type", value)', async () => {
      const chain = {
        eq:    mockEq.mockReturnThis(),
        or:    mockOr.mockReturnThis(),
        order: mockOrder.mockResolvedValue({ data: [], error: null }),
        single: mockSingle,
      };
      mockSelect.mockReturnValue(chain);
      mockFrom.mockReturnValue({ select: mockSelect });

      const { listRegistryItems } = await import('./registryClient');
      await listRegistryItems({ type: 'agent' });

      expect(mockEq).toHaveBeenCalledWith('type', 'agent');
    });

    it('applies status filter via .eq("status", value)', async () => {
      const chain = {
        eq:    mockEq.mockReturnThis(),
        or:    mockOr.mockReturnThis(),
        order: mockOrder.mockResolvedValue({ data: [], error: null }),
        single: mockSingle,
      };
      mockSelect.mockReturnValue(chain);
      mockFrom.mockReturnValue({ select: mockSelect });

      const { listRegistryItems } = await import('./registryClient');
      await listRegistryItems({ status: 'active' });

      expect(mockEq).toHaveBeenCalledWith('status', 'active');
    });

    it('translates risk_tier filter "high" → eq("risk_tier", "red")', async () => {
      const chain = {
        eq:    mockEq.mockReturnThis(),
        or:    mockOr.mockReturnThis(),
        order: mockOrder.mockResolvedValue({ data: [], error: null }),
        single: mockSingle,
      };
      mockSelect.mockReturnValue(chain);
      mockFrom.mockReturnValue({ select: mockSelect });

      const { listRegistryItems } = await import('./registryClient');
      await listRegistryItems({ risk_tier: 'high' });

      expect(mockEq).toHaveBeenCalledWith('risk_tier', 'red');
    });

    it('translates risk_tier filter "medium" → eq("risk_tier", "yellow")', async () => {
      const chain = {
        eq:    mockEq.mockReturnThis(),
        or:    mockOr.mockReturnThis(),
        order: mockOrder.mockResolvedValue({ data: [], error: null }),
        single: mockSingle,
      };
      mockSelect.mockReturnValue(chain);
      mockFrom.mockReturnValue({ select: mockSelect });

      const { listRegistryItems } = await import('./registryClient');
      await listRegistryItems({ risk_tier: 'medium' });

      expect(mockEq).toHaveBeenCalledWith('risk_tier', 'yellow');
    });

    it('applies search filter via .or(ilike)', async () => {
      const chain = {
        eq:    mockEq.mockReturnThis(),
        or:    mockOr.mockReturnThis(),
        order: mockOrder.mockResolvedValue({ data: [], error: null }),
        single: mockSingle,
      };
      mockSelect.mockReturnValue(chain);
      mockFrom.mockReturnValue({ select: mockSelect });

      const { listRegistryItems } = await import('./registryClient');
      await listRegistryItems({ search: 'finn' });

      expect(mockOr).toHaveBeenCalledWith(
        expect.stringContaining('finn'),
      );
    });

    it('returns empty array when supabase query fails (fail closed)', async () => {
      const chain = {
        eq:    mockEq.mockReturnThis(),
        or:    mockOr.mockReturnThis(),
        order: mockOrder.mockResolvedValue({ data: null, error: { message: 'RLS denied' } }),
        single: mockSingle,
      };
      mockSelect.mockReturnValue(chain);
      mockFrom.mockReturnValue({ select: mockSelect });

      const { listRegistryItems } = await import('./registryClient');
      const result = await listRegistryItems();
      expect(result).toEqual([]);
    });
  });

  // ── getRegistryItem ─────────────────────────────────────────────────────────

  describe('getRegistryItem()', () => {
    it('returns a single mapped RegistryItem when found', async () => {
      const row = makeRegistryRow();
      const chain = {
        eq:     mockEq.mockReturnThis(),
        single: mockSingle.mockResolvedValue({ data: row, error: null }),
      };
      mockSelect.mockReturnValue(chain);
      mockFrom.mockReturnValue({ select: mockSelect });

      const { getRegistryItem } = await import('./registryClient');
      const result = await getRegistryItem('reg-001');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('reg-001');
      expect(result!.name).toBe('Finn Finance Manager');
    });

    it('returns null when item is not found', async () => {
      const chain = {
        eq:     mockEq.mockReturnThis(),
        single: mockSingle.mockResolvedValue({ data: null, error: { message: 'Not found' } }),
      };
      mockSelect.mockReturnValue(chain);
      mockFrom.mockReturnValue({ select: mockSelect });

      const { getRegistryItem } = await import('./registryClient');
      const result = await getRegistryItem('does-not-exist');
      expect(result).toBeNull();
    });

    it('queries agent_registry table', async () => {
      const chain = {
        eq:     mockEq.mockReturnThis(),
        single: mockSingle.mockResolvedValue({ data: null, error: null }),
      };
      mockSelect.mockReturnValue(chain);
      mockFrom.mockReturnValue({ select: mockSelect });

      const { getRegistryItem } = await import('./registryClient');
      await getRegistryItem('reg-001');

      expect(mockFrom).toHaveBeenCalledWith('agent_registry');
    });
  });

  // ── createDraftRegistryItem ─────────────────────────────────────────────────

  describe('createDraftRegistryItem()', () => {
    const validBuilderState = {
      name: 'Test Agent',
      description: 'A test agent',
      category: 'operations',
      template: 'scratch',
      internal: true,
      notes: '',
      capabilities: [],
      tool_allowlist: [],
      risk_tier: 'medium' as const,
      approval_required: false,
      required_presence: 'none' as const,
      constraints: [],
      prompt_content: '',
      prompt_version: '1.0.0',
      config_variables: {},
    };

    it('returns a mapped RegistryItem on success', async () => {
      // The DB row is what Supabase returns after insert — it reflects the stored name.
      const row = makeRegistryRow({ risk_tier: 'yellow', name: 'Test Agent', status: 'pending_review' });
      const selectChain = { single: mockSingle.mockResolvedValue({ data: row, error: null }) };
      mockSelect.mockReturnValue(selectChain);
      mockInsert.mockReturnValue({ select: mockSelect });
      mockFrom.mockReturnValue({ insert: mockInsert });

      const { createDraftRegistryItem } = await import('./registryClient');
      const result = await createDraftRegistryItem(validBuilderState);

      // mapRegistryRow maps the returned DB row — name comes from the row, not from input state
      expect(result.name).toBe('Test Agent');   // from the mocked DB row
      expect(result.risk_tier).toBe('medium');  // DB 'yellow' → UI 'medium'
      expect(result.status).toBe('pending_review');
    });

    it('translates risk_tier "medium" → DB "yellow" in insert payload', async () => {
      const row = makeRegistryRow({ risk_tier: 'yellow' });
      const selectChain = { single: mockSingle.mockResolvedValue({ data: row, error: null }) };
      mockSelect.mockReturnValue(selectChain);
      mockInsert.mockReturnValue({ select: mockSelect });
      mockFrom.mockReturnValue({ insert: mockInsert });

      const { createDraftRegistryItem } = await import('./registryClient');
      await createDraftRegistryItem(validBuilderState);

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({ risk_tier: 'yellow' }),
      );
    });

    it('translates risk_tier "high" → DB "red" in insert payload', async () => {
      const row = makeRegistryRow({ risk_tier: 'red' });
      const selectChain = { single: mockSingle.mockResolvedValue({ data: row, error: null }) };
      mockSelect.mockReturnValue(selectChain);
      mockInsert.mockReturnValue({ select: mockSelect });
      mockFrom.mockReturnValue({ insert: mockInsert });

      const { createDraftRegistryItem } = await import('./registryClient');
      await createDraftRegistryItem({ ...validBuilderState, risk_tier: 'high' });

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({ risk_tier: 'red' }),
      );
    });

    it('sets status to "pending_review" for new drafts', async () => {
      const row = makeRegistryRow();
      const selectChain = { single: mockSingle.mockResolvedValue({ data: row, error: null }) };
      mockSelect.mockReturnValue(selectChain);
      mockInsert.mockReturnValue({ select: mockSelect });
      mockFrom.mockReturnValue({ insert: mockInsert });

      const { createDraftRegistryItem } = await import('./registryClient');
      await createDraftRegistryItem(validBuilderState);

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'pending_review' }),
      );
    });

    it('throws on insert failure', async () => {
      const selectChain = { single: mockSingle.mockResolvedValue({ data: null, error: { message: 'Unique constraint' } }) };
      mockSelect.mockReturnValue(selectChain);
      mockInsert.mockReturnValue({ select: mockSelect });
      mockFrom.mockReturnValue({ insert: mockInsert });

      const { createDraftRegistryItem } = await import('./registryClient');
      await expect(createDraftRegistryItem(validBuilderState)).rejects.toThrow('Unique constraint');
    });
  });

  // ── listRollouts ────────────────────────────────────────────────────────────

  describe('listRollouts()', () => {
    it('returns an array of Rollout objects', async () => {
      const row = makeRolloutRow();
      const chain = {
        eq:    mockEq.mockReturnThis(),
        order: mockOrder.mockResolvedValue({ data: [row], error: null }),
        single: mockSingle,
      };
      mockSelect.mockReturnValue(chain);
      mockFrom.mockReturnValue({ select: mockSelect });

      const { listRollouts } = await import('./registryClient');
      const result = await listRollouts();

      expect(Array.isArray(result)).toBe(true);
      expect(result[0].id).toBe('roll-001');
      expect(result[0].registry_item_id).toBe('reg-001');
      expect(result[0].environment).toBe('staging');
      expect(result[0].percentage).toBe(50);
      expect(result[0].status).toBe('active');
    });

    it('applies environment filter', async () => {
      const chain = {
        eq:    mockEq.mockReturnThis(),
        order: mockOrder.mockResolvedValue({ data: [], error: null }),
        single: mockSingle,
      };
      mockSelect.mockReturnValue(chain);
      mockFrom.mockReturnValue({ select: mockSelect });

      const { listRollouts } = await import('./registryClient');
      await listRollouts({ environment: 'production' });
      expect(mockEq).toHaveBeenCalledWith('environment', 'production');
    });

    it('applies status filter', async () => {
      const chain = {
        eq:    mockEq.mockReturnThis(),
        order: mockOrder.mockResolvedValue({ data: [], error: null }),
        single: mockSingle,
      };
      mockSelect.mockReturnValue(chain);
      mockFrom.mockReturnValue({ select: mockSelect });

      const { listRollouts } = await import('./registryClient');
      await listRollouts({ status: 'paused' });
      expect(mockEq).toHaveBeenCalledWith('status', 'paused');
    });

    it('applies registry_item_id filter', async () => {
      const chain = {
        eq:    mockEq.mockReturnThis(),
        order: mockOrder.mockResolvedValue({ data: [], error: null }),
        single: mockSingle,
      };
      mockSelect.mockReturnValue(chain);
      mockFrom.mockReturnValue({ select: mockSelect });

      const { listRollouts } = await import('./registryClient');
      await listRollouts({ registry_item_id: 'reg-abc' });
      expect(mockEq).toHaveBeenCalledWith('registry_item_id', 'reg-abc');
    });

    it('returns empty array on query failure', async () => {
      const chain = {
        eq:    mockEq.mockReturnThis(),
        order: mockOrder.mockResolvedValue({ data: null, error: { message: 'Timeout' } }),
        single: mockSingle,
      };
      mockSelect.mockReturnValue(chain);
      mockFrom.mockReturnValue({ select: mockSelect });

      const { listRollouts } = await import('./registryClient');
      const result = await listRollouts();
      expect(result).toEqual([]);
    });
  });

  // ── listProposals ───────────────────────────────────────────────────────────

  describe('listProposals()', () => {
    it('returns an array of ConfigChangeProposal objects', async () => {
      const row = makeProposalRow();
      const chain = {
        eq:    mockEq.mockReturnThis(),
        order: mockOrder.mockResolvedValue({ data: [row], error: null }),
        single: mockSingle,
      };
      mockSelect.mockReturnValue(chain);
      mockFrom.mockReturnValue({ select: mockSelect });

      const { listProposals } = await import('./registryClient');
      const result = await listProposals();

      expect(Array.isArray(result)).toBe(true);
      expect(result[0].id).toBe('prop-001');
      expect(result[0].status).toBe('pending');
      expect(result[0].change_type).toBe('update');
    });

    it('applies status filter when provided', async () => {
      const chain = {
        eq:    mockEq.mockReturnThis(),
        order: mockOrder.mockResolvedValue({ data: [], error: null }),
        single: mockSingle,
      };
      mockSelect.mockReturnValue(chain);
      mockFrom.mockReturnValue({ select: mockSelect });

      const { listProposals } = await import('./registryClient');
      await listProposals('approved');
      expect(mockEq).toHaveBeenCalledWith('status', 'approved');
    });

    it('returns empty array on query failure', async () => {
      const chain = {
        eq:    mockEq.mockReturnThis(),
        order: mockOrder.mockResolvedValue({ data: null, error: { message: 'RLS policy violation' } }),
        single: mockSingle,
      };
      mockSelect.mockReturnValue(chain);
      mockFrom.mockReturnValue({ select: mockSelect });

      const { listProposals } = await import('./registryClient');
      const result = await listProposals();
      expect(result).toEqual([]);
    });
  });

  // ── proposeConfigChange ─────────────────────────────────────────────────────

  describe('proposeConfigChange()', () => {
    it('inserts into config_proposals and returns mapped proposal', async () => {
      const row = makeProposalRow({ summary: 'Custom proposal' });
      const selectChain = { single: mockSingle.mockResolvedValue({ data: row, error: null }) };
      mockSelect.mockReturnValue(selectChain);
      mockInsert.mockReturnValue({ select: mockSelect });
      mockFrom.mockReturnValue({ insert: mockInsert });

      const { proposeConfigChange } = await import('./registryClient');
      const result = await proposeConfigChange({
        registry_item_id: 'reg-001',
        registry_item_name: 'Finn Finance Manager',
        change_type: 'update',
        summary: 'Custom proposal',
        diff: { before: {}, after: {} },
      });

      expect(result.id).toBe('prop-001');
      expect(mockFrom).toHaveBeenCalledWith('config_proposals');
    });

    it('sets status to "pending" in the insert payload', async () => {
      const row = makeProposalRow();
      const selectChain = { single: mockSingle.mockResolvedValue({ data: row, error: null }) };
      mockSelect.mockReturnValue(selectChain);
      mockInsert.mockReturnValue({ select: mockSelect });
      mockFrom.mockReturnValue({ insert: mockInsert });

      const { proposeConfigChange } = await import('./registryClient');
      await proposeConfigChange({ summary: 'Test' });

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'pending' }),
      );
    });

    it('throws on insert failure', async () => {
      const selectChain = { single: mockSingle.mockResolvedValue({ data: null, error: { message: 'Insert failed' } }) };
      mockSelect.mockReturnValue(selectChain);
      mockInsert.mockReturnValue({ select: mockSelect });
      mockFrom.mockReturnValue({ insert: mockInsert });

      const { proposeConfigChange } = await import('./registryClient');
      await expect(proposeConfigChange({ summary: 'Test' })).rejects.toThrow('Insert failed');
    });
  });

  // ── Receipt emission (Law #2) ───────────────────────────────────────────────

  describe('receipt emission (Law #2)', () => {
    it('emits aspire:receipt event with Success outcome on createDraftRegistryItem success', async () => {
      const row = makeRegistryRow();
      const selectChain = { single: mockSingle.mockResolvedValue({ data: row, error: null }) };
      mockSelect.mockReturnValue(selectChain);
      mockInsert.mockReturnValue({ select: mockSelect });
      mockFrom.mockReturnValue({ insert: mockInsert });

      const events: CustomEvent[] = [];
      window.addEventListener('aspire:receipt', (e) => events.push(e as CustomEvent));

      const { createDraftRegistryItem } = await import('./registryClient');
      await createDraftRegistryItem({
        name: 'Receipt Test Agent', description: '', category: 'ops', template: 'scratch',
        internal: true, notes: '', capabilities: [], tool_allowlist: [], risk_tier: 'low',
        approval_required: false, required_presence: 'none', constraints: [],
        prompt_content: '', prompt_version: '1.0.0', config_variables: {},
      });

      window.removeEventListener('aspire:receipt', (e) => events.push(e as CustomEvent));

      expect(events.length).toBeGreaterThanOrEqual(1);
      const receipt = events.find(e => e.detail?.action === 'registry.create_draft');
      expect(receipt).toBeDefined();
      expect(receipt?.detail?.outcome).toBe('Success');
    });

    it('emits aspire:receipt event with Success outcome on proposeConfigChange success', async () => {
      const row = makeProposalRow();
      const selectChain = { single: mockSingle.mockResolvedValue({ data: row, error: null }) };
      mockSelect.mockReturnValue(selectChain);
      mockInsert.mockReturnValue({ select: mockSelect });
      mockFrom.mockReturnValue({ insert: mockInsert });

      const events: CustomEvent[] = [];
      window.addEventListener('aspire:receipt', (e) => events.push(e as CustomEvent));

      const { proposeConfigChange } = await import('./registryClient');
      await proposeConfigChange({ summary: 'Test', change_type: 'update' });

      window.removeEventListener('aspire:receipt', (e) => events.push(e as CustomEvent));

      const receipt = events.find(e => e.detail?.action === 'config.propose_change');
      expect(receipt).toBeDefined();
      expect(receipt?.detail?.outcome).toBe('Success');
    });
  });
});
