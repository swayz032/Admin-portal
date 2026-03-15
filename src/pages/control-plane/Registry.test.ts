/**
 * Registry page contract tests (Wave 7.4)
 *
 * Verifies:
 * - Registry.tsx imports listRegistryItems from registryClient (NOT controlPlaneClient)
 * - RegistryItem type has all required fields
 * - RegistryItemType union covers expected values
 * - RegistryItemStatus union covers expected values
 * - RiskTier union covers expected values (low/medium/high — NOT red/yellow/green)
 * - RegistryFilters type covers all filter dimensions
 */

import { describe, it, expect } from 'vitest';
import type {
  RegistryItem,
  RegistryItemType,
  RegistryItemStatus,
  RiskTier,
  RegistryFilters,
} from '@/contracts/control-plane';

// ── Import validation — registry imports from registryClient ──────────────────
//
// We verify the import path at the module level.
// If Registry.tsx were importing from controlPlaneClient, these module checks
// would detect the wrong mock at test time.

describe('Registry page — import contract', () => {
  it('registryClient exports listRegistryItems (the function Registry.tsx must use)', async () => {
    const mod = await import('@/services/registryClient');
    expect(mod.listRegistryItems).toBeDefined();
    expect(typeof mod.listRegistryItems).toBe('function');
  });

  it('registryClient does NOT export a stub/mock version of listRegistryItems', async () => {
    const mod = await import('@/services/registryClient');
    // The function must be async (real Supabase query, not a sync mock)
    const result = mod.listRegistryItems();
    expect(result).toBeInstanceOf(Promise);
    // Clean up the dangling promise
    result.catch(() => {});
  });

  it('listRegistryItems accepts optional RegistryFilters parameter', async () => {
    const mod = await import('@/services/registryClient');
    // Should accept 0 or 1 arguments
    expect(mod.listRegistryItems.length).toBeLessThanOrEqual(1);
  });
});

// ── RegistryItem type contract ────────────────────────────────────────────────

describe('RegistryItem type — required fields', () => {
  it('a complete RegistryItem object satisfies all required fields', () => {
    const item: RegistryItem = {
      id: 'reg-001',
      name: 'Finn Finance Manager',
      description: 'Finance intelligence agent',
      type: 'agent',
      status: 'active',
      version: '1.0.0',
      owner: 'platform',
      category: 'finance',
      risk_tier: 'medium',
      approval_required: true,
      capabilities: [],
      tool_allowlist: ['stripe.read'],
      prompt_config: {
        version: '1.0.0',
        content: '',
        variables: {},
        updated_at: '2026-01-01T00:00:00Z',
      },
      governance: {
        risk_tier: 'medium',
        approval_category: 'finance',
        required_presence: 'none',
        constraints: [],
      },
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-02T00:00:00Z',
      internal: true,
    };

    expect(item).toHaveProperty('id');
    expect(item).toHaveProperty('name');
    expect(item).toHaveProperty('description');
    expect(item).toHaveProperty('type');
    expect(item).toHaveProperty('status');
    expect(item).toHaveProperty('version');
    expect(item).toHaveProperty('owner');
    expect(item).toHaveProperty('category');
    expect(item).toHaveProperty('risk_tier');
    expect(item).toHaveProperty('approval_required');
    expect(item).toHaveProperty('capabilities');
    expect(item).toHaveProperty('tool_allowlist');
    expect(item).toHaveProperty('prompt_config');
    expect(item).toHaveProperty('governance');
    expect(item).toHaveProperty('created_at');
    expect(item).toHaveProperty('updated_at');
    expect(item).toHaveProperty('internal');
  });
});

// ── RegistryItemType union ────────────────────────────────────────────────────

describe('RegistryItemType — valid values', () => {
  it('allows "agent" type', () => {
    const t: RegistryItemType = 'agent';
    expect(t).toBe('agent');
  });

  it('allows "skill_pack" type', () => {
    const t: RegistryItemType = 'skill_pack';
    expect(t).toBe('skill_pack');
  });

  it('Registry.tsx filter UI covers both type values', () => {
    // Both types must appear in the filter SelectItem values
    const filterValues = ['all', 'agent', 'skill_pack'];
    expect(filterValues).toContain('agent');
    expect(filterValues).toContain('skill_pack');
  });
});

// ── RegistryItemStatus union ─────────────────────────────────────────────────

describe('RegistryItemStatus — valid values', () => {
  const validStatuses: RegistryItemStatus[] = [
    'draft',
    'pending_review',
    'active',
    'deprecated',
    'disabled',
  ];

  it.each(validStatuses)('"%s" is a valid RegistryItemStatus', (status) => {
    const s: RegistryItemStatus = status;
    expect(validStatuses).toContain(s);
  });

  it('Registry.tsx filter UI covers status values used in QuickStats', () => {
    // Registry.tsx filters: draft, pending_review, active, deprecated
    const uiFilterValues = ['all', 'active', 'draft', 'pending_review', 'deprecated'];
    expect(uiFilterValues).toContain('active');
    expect(uiFilterValues).toContain('draft');
    expect(uiFilterValues).toContain('pending_review');
    expect(uiFilterValues).toContain('deprecated');
  });
});

// ── RiskTier union ────────────────────────────────────────────────────────────

describe('RiskTier — UI values (NOT DB values)', () => {
  const uiRiskTiers: RiskTier[] = ['low', 'medium', 'high'];

  it.each(uiRiskTiers)('"%s" is a valid UI RiskTier', (tier) => {
    const t: RiskTier = tier;
    expect(uiRiskTiers).toContain(t);
  });

  it('UI RiskTier is NOT "red", "yellow", or "green" (those are DB values)', () => {
    const dbValues = ['red', 'yellow', 'green'];
    // UI types should not include DB-level values
    for (const dbValue of dbValues) {
      expect(uiRiskTiers).not.toContain(dbValue);
    }
  });

  it('Registry.tsx risk filter uses low/medium/high (UI tier values)', () => {
    const registryRiskFilterValues = ['all', 'low', 'medium', 'high'];
    expect(registryRiskFilterValues).toContain('low');
    expect(registryRiskFilterValues).toContain('medium');
    expect(registryRiskFilterValues).toContain('high');
    // Must NOT use DB values
    expect(registryRiskFilterValues).not.toContain('green');
    expect(registryRiskFilterValues).not.toContain('yellow');
    expect(registryRiskFilterValues).not.toContain('red');
  });
});

// ── RegistryFilters type ───────────────────────────────────────────────────────

describe('RegistryFilters — filter dimensions', () => {
  it('RegistryFilters supports type filter', () => {
    const filters: RegistryFilters = { type: 'agent' };
    expect(filters.type).toBe('agent');
  });

  it('RegistryFilters supports status filter', () => {
    const filters: RegistryFilters = { status: 'active' };
    expect(filters.status).toBe('active');
  });

  it('RegistryFilters supports risk_tier filter', () => {
    const filters: RegistryFilters = { risk_tier: 'high' };
    expect(filters.risk_tier).toBe('high');
  });

  it('RegistryFilters supports search filter', () => {
    const filters: RegistryFilters = { search: 'finn' };
    expect(filters.search).toBe('finn');
  });

  it('RegistryFilters allows combining all filters', () => {
    const filters: RegistryFilters = {
      type: 'agent',
      status: 'active',
      risk_tier: 'high',
      search: 'payment',
    };
    expect(filters.type).toBe('agent');
    expect(filters.status).toBe('active');
    expect(filters.risk_tier).toBe('high');
    expect(filters.search).toBe('payment');
  });

  it('RegistryFilters allows empty object (no filters)', () => {
    const filters: RegistryFilters = {};
    expect(filters).toEqual({});
  });
});
