/**
 * registryClient-errors.test.ts — Error path tests (Wave 7.4)
 *
 * Evil/negative tests for registryClient.ts.
 * Validates fail-closed behavior (Law #3) and Failed receipt emission (Law #2).
 *
 * Covered cases:
 *   - listRegistryItems  → empty array on Supabase error
 *   - createDraftRegistryItem → throws + emits Failed receipt
 *   - updateDraftRegistryItem → throws when item not found
 *   - rollbackRollout         → throws when rollout not found
 *   - proposeConfigChange     → throws + emits Failed receipt
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock refs ─────────────────────────────────────────────────────────────────
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

vi.mock('@/services/opsFacadeClient', () => ({
  fetchOpsModelPolicy: vi.fn().mockResolvedValue({ policy: {} }),
  updateOpsModelPolicy: vi.fn().mockResolvedValue({ policy: {} }),
}));

// ── Default builder state ─────────────────────────────────────────────────────
const VALID_STATE = {
  name: 'Error Test Agent',
  description: 'Testing error paths',
  category: 'operations',
  template: 'scratch',
  internal: true,
  notes: '',
  capabilities: [],
  tool_allowlist: [],
  risk_tier: 'low'  as const,
  approval_required: false,
  required_presence: 'none' as const,
  constraints: [],
  prompt_content: '',
  prompt_version: '1.0.0',
  config_variables: {},
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('registryClient — error paths (Law #3 fail-closed)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── listRegistryItems ─────────────────────────────────────────────────────

  describe('listRegistryItems() — Supabase failure', () => {
    it('returns [] when supabase query returns an error (fail closed)', async () => {
      const chain = {
        eq:    mockEq.mockReturnThis(),
        or:    mockOr.mockReturnThis(),
        order: mockOrder.mockResolvedValue({ data: null, error: { message: 'connection refused' } }),
        single: mockSingle,
      };
      mockSelect.mockReturnValue(chain);
      mockFrom.mockReturnValue({ select: mockSelect });

      const { listRegistryItems } = await import('./registryClient');
      const result = await listRegistryItems();

      expect(result).toEqual([]);
      expect(Array.isArray(result)).toBe(true);
    });

    it('returns [] when supabase returns null data with no error', async () => {
      const chain = {
        eq:    mockEq.mockReturnThis(),
        or:    mockOr.mockReturnThis(),
        order: mockOrder.mockResolvedValue({ data: null, error: null }),
        single: mockSingle,
      };
      mockSelect.mockReturnValue(chain);
      mockFrom.mockReturnValue({ select: mockSelect });

      const { listRegistryItems } = await import('./registryClient');
      const result = await listRegistryItems();
      expect(result).toEqual([]);
    });

    it('NEVER throws — always returns array even on unexpected failure', async () => {
      const chain = {
        eq:    mockEq.mockReturnThis(),
        or:    mockOr.mockReturnThis(),
        order: mockOrder.mockResolvedValue({ data: undefined, error: { message: 'RLS violation' } }),
        single: mockSingle,
      };
      mockSelect.mockReturnValue(chain);
      mockFrom.mockReturnValue({ select: mockSelect });

      const { listRegistryItems } = await import('./registryClient');
      await expect(listRegistryItems()).resolves.toEqual([]);
    });
  });

  // ── createDraftRegistryItem ────────────────────────────────────────────────

  describe('createDraftRegistryItem() — insert failure', () => {
    it('throws when supabase insert returns an error', async () => {
      const selectChain = {
        single: mockSingle.mockResolvedValue({ data: null, error: { message: 'duplicate key value' } }),
      };
      mockSelect.mockReturnValue(selectChain);
      mockInsert.mockReturnValue({ select: mockSelect });
      mockFrom.mockReturnValue({ insert: mockInsert });

      const { createDraftRegistryItem } = await import('./registryClient');
      await expect(createDraftRegistryItem(VALID_STATE)).rejects.toThrow('duplicate key value');
    });

    it('throws when supabase insert returns null data (item not created)', async () => {
      const selectChain = {
        single: mockSingle.mockResolvedValue({ data: null, error: null }),
      };
      mockSelect.mockReturnValue(selectChain);
      mockInsert.mockReturnValue({ select: mockSelect });
      mockFrom.mockReturnValue({ insert: mockInsert });

      const { createDraftRegistryItem } = await import('./registryClient');
      await expect(createDraftRegistryItem(VALID_STATE)).rejects.toThrow('Failed to create registry item');
    });

    it('emits aspire:receipt with Failed outcome on insert error (Law #2)', async () => {
      const selectChain = {
        single: mockSingle.mockResolvedValue({ data: null, error: { message: 'RLS denied' } }),
      };
      mockSelect.mockReturnValue(selectChain);
      mockInsert.mockReturnValue({ select: mockSelect });
      mockFrom.mockReturnValue({ insert: mockInsert });

      const events: CustomEvent[] = [];
      const handler = (e: Event) => events.push(e as CustomEvent);
      window.addEventListener('aspire:receipt', handler);

      const { createDraftRegistryItem } = await import('./registryClient');
      await createDraftRegistryItem(VALID_STATE).catch(() => {});

      window.removeEventListener('aspire:receipt', handler);

      const failedReceipt = events.find(
        e => e.detail?.action === 'registry.create_draft' && e.detail?.outcome === 'Failed',
      );
      expect(failedReceipt).toBeDefined();
    });
  });

  // ── updateDraftRegistryItem ────────────────────────────────────────────────

  describe('updateDraftRegistryItem() — update failure', () => {
    it('throws when item not found (data=null, no supabase error)', async () => {
      const eqChain = {
        select: vi.fn().mockReturnValue({
          single: mockSingle.mockResolvedValue({ data: null, error: null }),
        }),
      };
      mockEq.mockReturnValue(eqChain);
      mockUpdate.mockReturnValue({ eq: mockEq });
      mockFrom.mockReturnValue({ update: mockUpdate });

      const { updateDraftRegistryItem } = await import('./registryClient');
      await expect(updateDraftRegistryItem('nonexistent-id', { name: 'New Name' }))
        .rejects.toThrow(/nonexistent-id/);
    });

    it('throws with supabase error message when update fails', async () => {
      const eqChain = {
        select: vi.fn().mockReturnValue({
          single: mockSingle.mockResolvedValue({ data: null, error: { message: 'record not found' } }),
        }),
      };
      mockEq.mockReturnValue(eqChain);
      mockUpdate.mockReturnValue({ eq: mockEq });
      mockFrom.mockReturnValue({ update: mockUpdate });

      const { updateDraftRegistryItem } = await import('./registryClient');
      await expect(updateDraftRegistryItem('reg-999', { name: 'Foo' }))
        .rejects.toThrow('record not found');
    });

    it('emits aspire:receipt with Failed outcome on update error (Law #2)', async () => {
      const eqChain = {
        select: vi.fn().mockReturnValue({
          single: mockSingle.mockResolvedValue({ data: null, error: { message: 'update failed' } }),
        }),
      };
      mockEq.mockReturnValue(eqChain);
      mockUpdate.mockReturnValue({ eq: mockEq });
      mockFrom.mockReturnValue({ update: mockUpdate });

      const events: CustomEvent[] = [];
      const handler = (e: Event) => events.push(e as CustomEvent);
      window.addEventListener('aspire:receipt', handler);

      const { updateDraftRegistryItem } = await import('./registryClient');
      await updateDraftRegistryItem('reg-999', { name: 'Foo' }).catch(() => {});

      window.removeEventListener('aspire:receipt', handler);

      const failedReceipt = events.find(
        e => e.detail?.action === 'registry.update_draft' && e.detail?.outcome === 'Failed',
      );
      expect(failedReceipt).toBeDefined();
    });
  });

  // ── rollbackRollout ───────────────────────────────────────────────────────

  describe('rollbackRollout() — rollout not found', () => {
    it('throws when rollout does not exist', async () => {
      // getRollout() (called internally) calls supabase.from().select().eq().single()
      // We need to return { data: null } for the getRollout path.
      const getChain = {
        eq:     mockEq.mockReturnThis(),
        single: mockSingle.mockResolvedValue({ data: null, error: { message: 'Not found' } }),
      };
      mockSelect.mockReturnValue(getChain);
      mockFrom.mockReturnValue({ select: mockSelect });

      const { rollbackRollout } = await import('./registryClient');
      await expect(rollbackRollout('nonexistent-rollout')).rejects.toThrow(/nonexistent-rollout/);
    });

    it('throws with a descriptive error message including rollout ID', async () => {
      const getChain = {
        eq:     mockEq.mockReturnThis(),
        single: mockSingle.mockResolvedValue({ data: null, error: null }),
      };
      mockSelect.mockReturnValue(getChain);
      mockFrom.mockReturnValue({ select: mockSelect });

      const { rollbackRollout } = await import('./registryClient');
      await expect(rollbackRollout('roll-missing')).rejects.toThrow('roll-missing');
    });
  });

  // ── proposeConfigChange ───────────────────────────────────────────────────

  describe('proposeConfigChange() — insert failure', () => {
    it('throws when supabase insert fails', async () => {
      const selectChain = {
        single: mockSingle.mockResolvedValue({ data: null, error: { message: 'proposals table offline' } }),
      };
      mockSelect.mockReturnValue(selectChain);
      mockInsert.mockReturnValue({ select: mockSelect });
      mockFrom.mockReturnValue({ insert: mockInsert });

      const { proposeConfigChange } = await import('./registryClient');
      await expect(proposeConfigChange({ summary: 'Fail test' })).rejects.toThrow('proposals table offline');
    });

    it('throws with generic message when data is null and no error returned', async () => {
      const selectChain = {
        single: mockSingle.mockResolvedValue({ data: null, error: null }),
      };
      mockSelect.mockReturnValue(selectChain);
      mockInsert.mockReturnValue({ select: mockSelect });
      mockFrom.mockReturnValue({ insert: mockInsert });

      const { proposeConfigChange } = await import('./registryClient');
      await expect(proposeConfigChange({})).rejects.toThrow('Failed to create proposal');
    });

    it('emits aspire:receipt with Failed outcome on proposal insert error (Law #2)', async () => {
      const selectChain = {
        single: mockSingle.mockResolvedValue({ data: null, error: { message: 'DB error' } }),
      };
      mockSelect.mockReturnValue(selectChain);
      mockInsert.mockReturnValue({ select: mockSelect });
      mockFrom.mockReturnValue({ insert: mockInsert });

      const events: CustomEvent[] = [];
      const handler = (e: Event) => events.push(e as CustomEvent);
      window.addEventListener('aspire:receipt', handler);

      const { proposeConfigChange } = await import('./registryClient');
      await proposeConfigChange({ summary: 'Fail' }).catch(() => {});

      window.removeEventListener('aspire:receipt', handler);

      const failedReceipt = events.find(
        e => e.detail?.action === 'config.propose_change' && e.detail?.outcome === 'Failed',
      );
      expect(failedReceipt).toBeDefined();
    });
  });

  // ── listProposals ─────────────────────────────────────────────────────────

  describe('listProposals() — Supabase failure', () => {
    it('returns [] on Supabase error (fail closed)', async () => {
      const chain = {
        eq:    mockEq.mockReturnThis(),
        order: mockOrder.mockResolvedValue({ data: null, error: { message: 'timeout' } }),
        single: mockSingle,
      };
      mockSelect.mockReturnValue(chain);
      mockFrom.mockReturnValue({ select: mockSelect });

      const { listProposals } = await import('./registryClient');
      const result = await listProposals();
      expect(result).toEqual([]);
    });
  });
});
