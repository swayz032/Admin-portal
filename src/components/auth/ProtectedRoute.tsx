import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, session, sessionInfo, loading, mfaRequired } = useAuth();

  // 1. Loading → spinner
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // 2. No session/user → login
  if (!session || !user) {
    return <Navigate to="/auth" replace />;
  }

  // 3. MFA required but not verified → MFA page
  if (mfaRequired) {
    return <Navigate to="/auth/mfa" replace />;
  }

  // 4. Session expired → login (Supabase provides expires_at as Unix epoch seconds)
  if (session.expires_at) {
    const expiresAtMs = session.expires_at * 1000;
    if (expiresAtMs < Date.now()) {
      return <Navigate to="/auth" replace />;
    }
  }

  // 5. Not allowlisted → access denied
  if (sessionInfo && !sessionInfo.isAllowlisted) {
    return <Navigate to="/access-denied" replace />;
  }

  // 6. Not admin → access denied
  if (sessionInfo && !sessionInfo.isAdmin) {
    return <Navigate to="/access-denied" replace />;
  }

  // 7. All checks pass → render children
  return <>{children}</>;
}
