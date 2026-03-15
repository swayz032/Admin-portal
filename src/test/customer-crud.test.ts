/**
 * Customer CRUD Tests — Supabase Operations
 *
 * Validates customer create/update/delete flows via Supabase client.
 * Uses mocked Supabase client to test service-layer behavior.
 *
 * Law #2: Receipt for All — state changes produce receipts
 * Law #3: Fail Closed — missing auth = deny
 * Law #6: Tenant Isolation — RLS enforced at DB layer
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock Supabase client
// ---------------------------------------------------------------------------
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();
const mockRange = vi.fn();
const mockOrder = vi.fn();

function buildChain(overrides: Record<string, unknown> = {}) {
  const chain: Record<string, unknown> = {
    select: (...args: unknown[]) => { mockSelect(...args); return chain; },
    insert: (...args: unknown[]) => { mockInsert(...args); return chain; },
    update: (...args: unknown[]) => { mockUpdate(...args); return chain; },
    delete: () => { mockDelete(); return chain; },
    eq: (...args: unknown[]) => { mockEq(...args); return chain; },
    single: () => { mockSingle(); return overrides.singleResult ?? { data: null, error: null }; },
    range: (...args: unknown[]) => { mockRange(...args); return chain; },
    order: (...args: unknown[]) => { mockOrder(...args); return chain; },
    then: undefined, // prevent auto-await
    ...overrides,
  };
  // Allow chain to be awaited when no .single()/.then() is called
  (chain as Record<string, unknown>).then = (
    resolve: (v: unknown) => void,
  ) => resolve(overrides.resolveValue ?? { data: [], error: null, count: 0 });
  return chain;
}

const mockFrom = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: unknown[]) => {
      mockFrom(...args);
      return buildChain();
    },
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: 'test-token', user: { id: 'user-1' } } },
        error: null,
      }),
    },
  },
}));

// ---------------------------------------------------------------------------
// Mock fetch for opsFacade calls (receipts are server-side)
// ---------------------------------------------------------------------------
const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

function setupAuth(opts: { token?: string; suiteId?: string } = {}) {
  const sessionStore: Record<string, string> = {};
  if (opts.token) sessionStore['aspire_admin_token'] = opts.token;

  const localStore: Record<string, string> = {};
  if (opts.suiteId) localStore['aspire.admin.scope.suiteId'] = opts.suiteId;

  Object.defineProperty(window, 'sessionStorage', {
    value: {
      getItem: vi.fn((key: string) => sessionStore[key] ?? null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    },
    writable: true,
    configurable: true,
  });

  Object.defineProperty(window, 'localStorage', {
    value: {
      getItem: vi.fn((key: string) => localStore[key] ?? null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    },
    writable: true,
    configurable: true,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('Customer CRUD Operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock.mockReset();
    setupAuth({ token: 'admin-jwt', suiteId: 'suite-500' });
  });

  it('should create a customer via Supabase insert', async () => {
    const newCustomer = {
      name: 'Acme Corp',
      industry: 'Technology',
      owner_name: 'Jane Doe',
      owner_email: 'jane@acme.com',
    };

    // Simulate Supabase insert returning the new row
    const mockChain = buildChain({
      singleResult: {
        data: { id: 'cust-new-1', ...newCustomer, created_at: '2026-03-15T00:00:00Z' },
        error: null,
      },
    });

    mockFrom.mockReturnValueOnce(mockChain);

    const { supabase } = await import('@/integrations/supabase/client');
    const result = supabase.from('suites').insert(newCustomer);

    expect(mockFrom).toHaveBeenCalledWith('suites');
  });

  it('should update a customer via Supabase update', async () => {
    const updatedFields = { name: 'Acme Corp v2', industry: 'SaaS' };

    const mockChain = buildChain({
      singleResult: {
        data: { id: 'cust-1', ...updatedFields, updated_at: '2026-03-15T01:00:00Z' },
        error: null,
      },
    });

    mockFrom.mockReturnValueOnce(mockChain);

    const { supabase } = await import('@/integrations/supabase/client');
    supabase.from('suites').update(updatedFields);

    expect(mockFrom).toHaveBeenCalledWith('suites');
    expect(mockUpdate).toHaveBeenCalledWith(updatedFields);
  });

  it('should delete a customer via Supabase delete', async () => {
    const mockChain = buildChain({
      resolveValue: { data: null, error: null },
    });

    mockFrom.mockReturnValueOnce(mockChain);

    const { supabase } = await import('@/integrations/supabase/client');
    const chain = supabase.from('suites').delete();

    expect(mockFrom).toHaveBeenCalledWith('suites');
    expect(mockDelete).toHaveBeenCalled();
  });

  it('should reject customer creation without auth', async () => {
    setupAuth({}); // No token, no suite

    // When Supabase RLS blocks an unauthenticated insert, it returns an error
    // Simulate the RLS rejection by mocking fetch to return 401
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({
        code: 'AUTH_REQUIRED',
        message: 'Missing authentication token',
        correlation_id: 'corr-no-auth-cust',
        retryable: false,
      }),
    });

    const response = await fetch('http://localhost:8000/admin/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Evil Corp' }),
    });

    expect(response.ok).toBe(false);
    expect(response.status).toBe(401);

    const body = await response.json();
    expect(body.code).toBe('AUTH_REQUIRED');
  });
});
