import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(() => ({
    auth: {},
    functions: { invoke: vi.fn() },
    from: vi.fn(),
  })),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: createClientMock,
}));

describe('supabase client auth config', () => {
  const originalUrl = import.meta.env.VITE_SUPABASE_URL;
  const originalKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  beforeEach(() => {
    vi.resetModules();
    createClientMock.mockClear();

    import.meta.env.VITE_SUPABASE_URL = 'https://example.supabase.co';
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY = 'public-anon-key';
  });

  afterEach(() => {
    if (originalUrl === undefined) {
      Reflect.deleteProperty(import.meta.env, 'VITE_SUPABASE_URL');
    } else {
      import.meta.env.VITE_SUPABASE_URL = originalUrl;
    }

    if (originalKey === undefined) {
      Reflect.deleteProperty(import.meta.env, 'VITE_SUPABASE_PUBLISHABLE_KEY');
    } else {
      import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY = originalKey;
    }
  });

  it('keeps admin auth in memory instead of restoring from browser storage', async () => {
    await import('./client');

    expect(createClientMock).toHaveBeenCalledTimes(1);
    expect(createClientMock).toHaveBeenCalledWith(
      'https://example.supabase.co',
      'public-anon-key',
      {
        auth: {
          persistSession: false,
          autoRefreshToken: true,
        },
      },
    );
  });
});
