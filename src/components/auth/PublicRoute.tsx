import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

interface PublicRouteProps {
  children: React.ReactNode;
}

export function PublicRoute({ children }: PublicRouteProps) {
  const { session, user, loading } = useAuth();

  // Hold public routes in a loading state while Supabase has produced a session
  // but AuthContext has not finished hydrating the user/sessionInfo yet.
  if (loading || (session && !user)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Never auto-redirect to /home from the auth page.
  // Security: users must explicitly sign in even if a persisted session exists.
  // The Auth page clears stale sessions on mount and handles post-login
  // navigation itself (navigate('/home') after successful signIn).
  return <>{children}</>;
}
