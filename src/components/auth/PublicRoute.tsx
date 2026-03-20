import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

interface PublicRouteProps {
  children: React.ReactNode;
}

export function PublicRoute({ children }: PublicRouteProps) {
  const { user, session, loading, mfaRequired } = useAuth();

  // Hold public routes in a loading state while Supabase has produced a session
  // but AuthContext has not finished hydrating the user/sessionInfo yet.
  if (loading || (session && !user)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (session && !mfaRequired) {
    return <Navigate to="/home" replace />;
  }

  return <>{children}</>;
}
