import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Session } from '@supabase/supabase-js';

// --- Security Constants ---
const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;    // 30 minutes — auto-logout
const SESSION_CHECK_INTERVAL_MS = 5 * 60 * 1000;  // 5 minutes — verify session is still valid
const INACTIVITY_CHECK_INTERVAL_MS = 60 * 1000;   // 1 minute — check for inactivity
const TAB_HIDDEN_TIMEOUT_MS = 15 * 60 * 1000;     // 15 minutes — force re-auth when tab hidden

// User activity events to track
const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'scroll', 'touchstart', 'mousemove'] as const;

interface AuthUser {
  id: string;
  email: string;
  displayName: string;
}

interface SessionInfo {
  user: AuthUser;
  roles: string[];
  isAllowlisted: boolean;
  isAdmin: boolean;
  mfaEnabled: boolean;
  mfaVerified: boolean;
  mfaVerifiedAt: string | null;
}

interface AuthContextType {
  user: AuthUser | null;
  session: Session | null;
  sessionInfo: SessionInfo | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: { message: string } | null }>;
  signOut: () => Promise<void>;
  forceLogout: (reason?: string) => Promise<void>;
  refreshSession: () => Promise<void>;
  mfaRequired: boolean;
  lastActivity: number;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [lastActivity, setLastActivity] = useState<number>(Date.now());

  // Ref to track when tab was hidden (survives re-renders without triggering them)
  const tabHiddenAtRef = useRef<number | null>(null);

  // Ref for latest signOut to avoid stale closures in event listeners
  const signOutRef = useRef<() => Promise<void>>(async () => {});

  // --- Clear all auth state (used on any auth error or forced logout) ---
  const clearAuthState = useCallback(() => {
    setUser(null);
    setSession(null);
    setSessionInfo(null);
    setMfaRequired(false);
  }, []);

  // --- Fetch session info from edge function ---
  const fetchSessionInfo = useCallback(async (accessToken: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('auth-session', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (error || !data?.user) {
        console.warn('auth-session error:', error);
        clearAuthState();
        return null;
      }
      const info = data as SessionInfo;
      setSessionInfo(info);
      setUser(info.user);
      setMfaRequired(info.mfaEnabled && !info.mfaVerified);
      return info;
    } catch (err) {
      console.warn('auth-session fetch failed:', err);
      clearAuthState();
      return null;
    }
  }, [clearAuthState]);

  // --- Refresh session ---
  const refreshSession = useCallback(async () => {
    try {
      const { data: { session: s } } = await supabase.auth.getSession();
      if (s?.access_token) {
        setSession(s);
        await fetchSessionInfo(s.access_token);
      } else {
        clearAuthState();
      }
    } catch (err) {
      console.warn('refreshSession failed:', err);
      clearAuthState();
    }
  }, [fetchSessionInfo, clearAuthState]);

  // --- Sign Out (normal) ---
  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('signOut error:', err);
    }
    clearAuthState();
  }, [clearAuthState]);

  // Keep signOutRef in sync
  useEffect(() => {
    signOutRef.current = signOut;
  }, [signOut]);

  // --- Force Logout (for security-critical scenarios) ---
  const forceLogout = useCallback(async (reason?: string) => {
    console.warn('Force logout triggered:', reason || 'unspecified');
    try {
      // Log the forced logout for audit trail
      await supabase.from('audit_log').insert({
        event: 'force_logout',
        details: { reason: reason || 'security_policy', user_id: user?.id },
        user_id: user?.id || null,
        ip_address: null,
      });
    } catch {
      // Don't block logout if audit logging fails
    }
    await signOut();
  }, [signOut, user?.id]);

  // --- Sign In ---
  const signIn = useCallback(async (email: string, password: string) => {
    try {
      // Try normal sign-in first
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        // If email provider is disabled, use the admin-sign-in edge function fallback
        if (error.message.includes('Email logins are disabled')) {
          console.log('Email provider disabled, trying admin-sign-in fallback...');
          const { data: fallbackData, error: fallbackError } = await supabase.functions.invoke('admin-sign-in', {
            body: { email, password },
          });

          if (fallbackError) {
            return { error: { message: fallbackError.message || 'Authentication failed' } };
          }

          if (fallbackData?.error) {
            return { error: { message: fallbackData.error } };
          }

          // If we got a magiclink fallback, verify the OTP to create a session
          if (fallbackData?.type === 'magiclink_fallback') {
            const { error: verifyError } = await supabase.auth.verifyOtp({
              token_hash: fallbackData.token_hash,
              type: 'magiclink',
            });
            if (verifyError) {
              console.error('verifyOtp error:', verifyError);
              return { error: { message: verifyError.message || 'Session creation failed' } };
            }
            // Reset activity timestamp on successful login
            setLastActivity(Date.now());
            return { error: null };
          }

          // If we got a normal session response (email provider was re-enabled)
          if (fallbackData?.access_token) {
            const { error: setError } = await supabase.auth.setSession({
              access_token: fallbackData.access_token,
              refresh_token: fallbackData.refresh_token,
            });
            if (setError) {
              return { error: { message: setError.message } };
            }
            setLastActivity(Date.now());
            return { error: null };
          }

          return { error: { message: 'Unexpected authentication response' } };
        }
        return { error: { message: error.message } };
      }
      // Reset activity timestamp on successful login
      setLastActivity(Date.now());
      return { error: null };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred.';
      console.error('signIn error:', err);
      return { error: { message: errorMessage } };
    }
  }, []);

  // --- Auth State Change Listener ---
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, s) => {
        setSession(s);
        if (s?.access_token) {
          setTimeout(() => {
            fetchSessionInfo(s.access_token).catch(console.warn).finally(() => setLoading(false));
          }, 0);
        } else {
          clearAuthState();
          setLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s?.access_token) {
        fetchSessionInfo(s.access_token).catch(console.warn).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    }).catch(() => setLoading(false));

    return () => subscription.unsubscribe();
  }, [fetchSessionInfo, clearAuthState]);

  // --- User Activity Tracking ---
  useEffect(() => {
    const updateActivity = () => setLastActivity(Date.now());

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, updateActivity, { passive: true });
    }

    return () => {
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, updateActivity);
      }
    };
  }, []);

  // --- Inactivity Timeout (auto-logout after 30 min of no activity) ---
  useEffect(() => {
    if (!session) return;

    const interval = setInterval(() => {
      if (Date.now() - lastActivity > INACTIVITY_TIMEOUT_MS) {
        console.warn('Inactivity timeout reached. Logging out.');
        signOutRef.current();
      }
    }, INACTIVITY_CHECK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [session, lastActivity]);

  // --- Session Validity Heartbeat (verify session every 5 min) ---
  useEffect(() => {
    if (!session?.access_token) return;

    const interval = setInterval(() => {
      fetchSessionInfo(session.access_token).catch(() => {
        console.warn('Session heartbeat failed. Forcing logout.');
        signOutRef.current();
      });
    }, SESSION_CHECK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [session?.access_token, fetchSessionInfo]);

  // --- Tab Visibility Handler (force re-auth when tab hidden >15 min) ---
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab became hidden — record timestamp
        tabHiddenAtRef.current = Date.now();
      } else {
        // Tab became visible again — check how long it was hidden
        const hiddenAt = tabHiddenAtRef.current;
        if (hiddenAt && Date.now() - hiddenAt > TAB_HIDDEN_TIMEOUT_MS) {
          console.warn('Tab was hidden for >15 minutes. Forcing re-authentication.');
          signOutRef.current();
        }
        tabHiddenAtRef.current = null;
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        sessionInfo,
        loading,
        signIn,
        signOut,
        forceLogout,
        refreshSession,
        mfaRequired,
        lastActivity,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
