---
name: Admin Portal Test Patterns
description: Supabase mock patterns, module mock patterns, and test anti-patterns discovered in this codebase
type: project
---

## Critical: Module Isolation with vi.mock

All Supabase tests must mock `@/integrations/supabase/client`, NOT `@/lib/supabase`.
- registryClient.ts, useRealtimeSubscription.ts → use `@/integrations/supabase/client`
- Some older hooks (useRealtimeApprovals, useRealtimeReceipts) mock `@/lib/supabase` — they use a different import path

## Supabase Query Chain Mock Pattern (registryClient style)

registryClient.ts uses a fluent builder pattern where .eq()/.or() are chainable filter calls
before a terminal .order() or .single() call. The mock must reflect this:

```typescript
const mockSingle = vi.fn();
const mockOrder  = vi.fn();
const mockEq     = vi.fn();
const mockOr     = vi.fn();
const mockSelect = vi.fn();
const mockFrom   = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { get from() { return mockFrom; } },
}));

// Per-test setup for list queries:
const chain = {
  eq:    mockEq.mockReturnThis(),   // .eq() returns chain for chaining
  or:    mockOr.mockReturnThis(),   // .or() returns chain for chaining
  order: mockOrder.mockResolvedValue({ data: [...], error: null }),
  single: mockSingle,               // not used in list path
};
mockSelect.mockReturnValue(chain);
mockFrom.mockReturnValue({ select: mockSelect });

// For insert queries:
const selectChain = { single: mockSingle.mockResolvedValue({ data: row, error: null }) };
mockSelect.mockReturnValue(selectChain);
mockInsert.mockReturnValue({ select: mockSelect });
mockFrom.mockReturnValue({ insert: mockInsert });

// For update queries:
const eqChain = {
  select: vi.fn().mockReturnValue({
    single: mockSingle.mockResolvedValue({ data: row, error: null }),
  }),
};
mockEq.mockReturnValue(eqChain);
mockUpdate.mockReturnValue({ eq: mockEq });
mockFrom.mockReturnValue({ update: mockUpdate });
```

## opsFacadeClient Must Be Mocked

registryClient.ts imports from `@/services/opsFacadeClient` for model policy functions.
Always stub it to prevent real network calls:
```typescript
vi.mock('@/services/opsFacadeClient', () => ({
  fetchOpsModelPolicy: vi.fn().mockResolvedValue({ policy: {} }),
  updateOpsModelPolicy: vi.fn().mockResolvedValue({ policy: {} }),
}));
```

## createDraftRegistryItem Returns DB Row, Not Input State

The function maps the RETURNED DB row through mapRegistryRow().
If the mock returns `{ name: 'DB Name' }`, the result.name will be 'DB Name' —
not the name from the BuilderState input. Test assertions must match the mocked DB row.

## Receipt Emission Testing (Law #2)

registryClient.ts emits `window.dispatchEvent(new CustomEvent('aspire:receipt', ...))`.
Test pattern:
```typescript
const events: CustomEvent[] = [];
const handler = (e: Event) => events.push(e as CustomEvent);
window.addEventListener('aspire:receipt', handler);
// ... call the function ...
window.removeEventListener('aspire:receipt', handler);
const receipt = events.find(e => e.detail?.action === 'registry.create_draft');
expect(receipt?.detail?.outcome).toBe('Success'); // or 'Failed'
```

## Risk Tier Mapping (DB ↔ UI)

| DB value | UI value |
|----------|----------|
| 'red'    | 'high'   |
| 'yellow' | 'medium' |
| 'green'  | 'low'    |

Filters also translate: UI 'high' → DB 'red' when passed to .eq('risk_tier', ...)

## vi.clearAllMocks() in beforeEach is Essential

The mock refs (mockFrom, mockSelect, etc.) are shared across tests via module-level vars.
Without clearAllMocks(), previous test mock return values bleed into subsequent tests.

## Dynamic Import Pattern for Module-level Mocks

Tests use `await import('./registryClient')` inside each test body (not at top level).
This works with vi.mock hoisting. The mock is applied before the dynamic import resolves.
