import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen } from '@testing-library/react';

const useAuthMock = vi.fn();

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => useAuthMock(),
}));

describe('auth route guards', () => {
  it('keeps the public route in a loading state while auth hydration is pending', async () => {
    useAuthMock.mockReturnValue({
      user: null,
      session: { access_token: 'session-token' },
      loading: false,
      mfaRequired: false,
    });

    const { PublicRoute } = await import('./PublicRoute');

    const { container } = render(
      <MemoryRouter initialEntries={['/auth']}>
        <Routes>
          <Route path="/auth" element={<PublicRoute><div>auth-screen</div></PublicRoute>} />
          <Route path="/home" element={<div>home-screen</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(container.querySelector('svg.animate-spin')).toBeTruthy();
    expect(screen.queryByText('auth-screen')).toBeNull();
    expect(screen.queryByText('home-screen')).toBeNull();
  });

  it('keeps the protected route in a loading state while auth hydration is pending', async () => {
    useAuthMock.mockReturnValue({
      user: null,
      session: { access_token: 'session-token' },
      sessionInfo: null,
      loading: false,
      mfaRequired: false,
    });

    const { ProtectedRoute } = await import('./ProtectedRoute');

    render(
      <MemoryRouter initialEntries={['/home']}>
        <Routes>
          <Route path="/home" element={<ProtectedRoute><div>home-screen</div></ProtectedRoute>} />
          <Route path="/auth" element={<div>auth-screen</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Loading Aspire...')).toBeInTheDocument();
    expect(screen.queryByText('home-screen')).toBeNull();
    expect(screen.queryByText('auth-screen')).toBeNull();
  });
});
