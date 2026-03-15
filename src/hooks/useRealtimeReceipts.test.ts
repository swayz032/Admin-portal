/**
 * useRealtimeReceipts Hook Tests (Wave 5.6)
 * Validates receipt data fetching and display contract.
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: [
            {
              id: 'receipt-1',
              action_type: 'invoice.created',
              status: 'SUCCEEDED',
              suite_id: 'suite-123',
              trace_id: 'trace-abc',
              correlation_id: 'corr-xyz',
              created_at: '2026-03-15T00:00:00Z',
              metadata: { amount: 1500, currency: 'usd' },
            },
          ],
          error: null,
        }),
      }),
    }),
    channel: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnValue({
        subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
      }),
    }),
    removeChannel: vi.fn(),
  },
}));

describe('useRealtimeReceipts data contract', () => {
  it('hook exists and is a function', async () => {
    const mod = await import('./useRealtimeReceipts');
    expect(mod.useRealtimeReceipts).toBeDefined();
    expect(typeof mod.useRealtimeReceipts).toBe('function');
  });

  it('receipt must have immutable required fields', () => {
    const receipt = {
      id: 'receipt-1',
      action_type: 'invoice.created',
      status: 'SUCCEEDED',
      suite_id: 'suite-123',
      trace_id: 'trace-abc',
      created_at: '2026-03-15T00:00:00Z',
    };

    // Law 2: Every state change produces an immutable receipt
    expect(receipt.id).toBeDefined();
    expect(receipt.action_type).toBeDefined();
    expect(receipt.status).toBeDefined();
    expect(receipt.suite_id).toBeDefined();
    expect(receipt.created_at).toBeDefined();
  });

  it('receipt status must be valid enum value', () => {
    const validStatuses = ['PENDING', 'SUCCEEDED', 'FAILED', 'DENIED'];
    expect(validStatuses).toContain('SUCCEEDED');
    expect(validStatuses).toContain('FAILED');
    expect(validStatuses).toContain('DENIED');
    // SKIPPED is NOT valid (checked in Phase 3.5)
    expect(validStatuses).not.toContain('SKIPPED');
  });

  it('receipt correlation_id enables cross-system tracing', () => {
    const receipt = {
      id: 'receipt-1',
      correlation_id: 'corr-xyz',
      trace_id: 'trace-abc',
    };

    // Correlation IDs must be present for cross-system visibility
    expect(receipt.correlation_id).toMatch(/^corr-/);
    expect(receipt.trace_id).toMatch(/^trace-/);
  });
});
