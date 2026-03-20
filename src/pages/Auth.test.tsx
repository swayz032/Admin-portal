import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const signInMock = vi.fn();

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    signIn: signInMock,
  }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      setSession: vi.fn(),
      resetPasswordForEmail: vi.fn(),
    },
    functions: {
      invoke: vi.fn(),
    },
    from: vi.fn(() => ({
      insert: vi.fn(),
    })),
  },
}));

describe('Auth page autofill hardening', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    signInMock.mockReset();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: async () => ({
          transform: { scale: [1, 1], translate: [0, 0] },
          arcs: [],
        }),
      }),
    );
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  });

  it('renders the sign-in form with autofill disabled by default', async () => {
    const { default: Auth } = await import('./Auth');
    const { container } = render(
      <MemoryRouter>
        <Auth />
      </MemoryRouter>,
    );

    const form = container.querySelector('form');
    const emailInput = screen.getByPlaceholderText('admin@aspire.ai');
    const passwordInput = screen.getByPlaceholderText('Enter your password');

    expect(form).toHaveAttribute('autocomplete', 'off');
    expect(form).toHaveAttribute('data-1p-ignore', 'true');
    expect(form).toHaveAttribute('data-lpignore', 'true');
    expect(container.querySelector('input[name="admin-username-trap"]')).toBeTruthy();
    expect(container.querySelector('input[name="admin-password-trap"]')).toBeTruthy();
    expect(emailInput).toHaveAttribute('autocomplete', 'off');
    expect(emailInput).toHaveAttribute('readonly');
    expect(passwordInput).toHaveAttribute('autocomplete', 'new-password');
    expect(passwordInput).toHaveAttribute('readonly');
  });

  it('unlocks the login fields when the operator interacts with them', async () => {
    const { default: Auth } = await import('./Auth');
    render(
      <MemoryRouter>
        <Auth />
      </MemoryRouter>,
    );

    const emailInput = screen.getByPlaceholderText('admin@aspire.ai');

    expect(emailInput).toHaveAttribute('readonly');
    fireEvent.pointerDown(emailInput);
    fireEvent.focus(emailInput);
    expect(emailInput).not.toHaveAttribute('readonly');
  });
});
