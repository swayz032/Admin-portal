import { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Session } from '@supabase/supabase-js';
import { devLog, devWarn, devError } from '@/lib/devLog';
import { clearAdminToken, exchangeAdminToken, isOpsFacadeEnabled } from '@/services/opsFacadeClient';

// --- Security Constants ---
const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;    // 30 minutes — auto-logout
const SESSION_CHECK_INTERVAL_MS = 5 * 60 * 1000;  // 5 minutes — verify session is still valid
const INACTIVITY_CHECK_INTERVAL_MS = 60 * 1000;   // 1 minute — check for inactivity
const TAB_HIDDEN_TIMEOUT_MS = 15 * 60 * 1000;     // 15 minutes — force re-auth when tab hidden

// User activity events to track
const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'scroll', 'touchstart', 'mousemove'] as const;
const nextTraceId = () => crypto.randomUUID();
const AUTH_SESSION_FALLBACK_ENABLED = import.meta.env.DEV || import.meta.env.VITE_AUTH_SESSION_FALLBACK === 'true';

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

function stringFromMetadata(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function userFromSession(session: Session): AuthUser {
  const metadata = session.user.user_metadata ?? {};
  const email = session.user.email ?? '';
  const displayName = stringFromMetadata(metadata.display_name)
    || stringFromMetadata(metadata.full_name)
    || stringFromMetadata(metadata.name)
    || email.split('@')[0]
    || 'Admin';

  return {
    id: session.user.id,
    email,
    displayName,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [mfaRequired, setMfaRequired] = useState(false);
  // Use ref for activity tracking — avoids re-rendering entire tree on every mouse move
  const lastActivityRef = useRef<number>(Date.now());

  // Ref to track when tab was hidden (survives re-renders without triggering them)
  const tabHiddenAtRef = useRef<number | null>(null);

  // Ref for latest signOut to avoid stale closures in event listeners
  const signOutRef = useRef<() => Promise<void>>(async () => {});
  const authSessionFallbackWarnedRef = useRef(false);

  // --- Clear all auth state (used on any auth error or forced logout) ---
  const clearAuthState = useCallback(() => {
    setUser(null);
    setSession(null);
    setSessionInfo(null);
    setMfaRequired(false);
    clearAdminToken();
  }, []);

  const keepLocalSessionWithoutAdminInfo = useCallback((s: Session, traceId: string, reason: string) => {
    if (!AUTH_SESSION_FALLBACK_ENABLED) {
      clearAuthState();
      return null;
    }

    const fallbackUser = userFromSession(s);
    if (!authSessionFallbackWarnedRef.current) {
      devWarn('auth-session unavailable; keeping local Supabase session without admin metadata:', { traceId, reason });
      authSessionFallbackWarnedRef.current = true;
    }
    setSessionInfo(null);
    setUser(fallbackUser);
    setMfaRequired(false);
    return null;
  }, [clearAuthState]);

  // --- Fetch session info from edge function ---
  const fetchSessionInfo = useCallback(async (s: Session) => {
    const traceId = nextTraceId();
    const accessToken = s.access_token;
    try {
      const { data, error } = await supabase.functions.invoke('auth-session', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'x-correlation-id': traceId,
        },
      });
      if (error || !data?.user) {
        if (!AUTH_SESSION_FALLBACK_ENABLED) {
          devWarn('auth-session error:', { traceId, error });
        }
        return keepLocalSessionWithoutAdminInfo(s, traceId, error?.message || 'missing auth-session user');
      }
      const info = data as SessionInfo;
      setSessionInfo(info);
      setUser(info.user);
      setMfaRequired(info.mfaEnabled && !info.mfaVerified);
      if (isOpsFacadeEnabled()) {
        try {
          await exchangeAdminToken(accessToken);
        } catch (exchangeErr) {
          // Keep primary auth/session valid even if ops facade token exchange fails.
          devWarn('admin token exchange failed:', { traceId, exchangeErr });
        }
      }
      return info;
    } catch (err) {
      if (!AUTH_SESSION_FALLBACK_ENABLED) {
        devWarn('auth-session fetch failed:', { traceId, err });
      }
      return keepLocalSessionWithoutAdminInfo(s, traceId, err instanceof Error ? err.message : 'auth-session request failed');
    }
  }, [keepLocalSessionWithoutAdminInfo]);

  // --- Refresh session ---
  const refreshSession = useCallback(async () => {
    try {
      const { data: { session: s } } = await supabase.auth.getSession();
      if (s?.access_token) {
        setSession(s);
        await fetchSessionInfo(s);
      } else {
        clearAuthState();
      }
    } catch (err) {
      devWarn('refreshSession failed:', err);
      clearAuthState();
    }
  }, [fetchSessionInfo, clearAuthState]);

  // --- Sign Out (normal) ---
  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      devWarn('signOut error:', err);
    }
    clearAuthState();
  }, [clearAuthState]);

  // Keep signOutRef in sync
  useEffect(() => {
    signOutRef.current = signOut;
  }, [signOut]);

  // --- Force Logout (for security-critical scenarios) ---
  const forceLogout = useCallback(async (reason?: string) => {
    devWarn('Force logout triggered:', reason || 'unspecified');
    try {
      // Log the forced logout for audit trail
      await supabase.from('audit_log').insert({
        event: 'force_logout',
        details: { reason: reason || 'security_policy', user_id: user?.id },
        user_id: user?.id || null,
        ip_address: null,
      });
    } catch (err) {
      // Don't block logout if audit logging fails
      if (import.meta.env.DEV) console.warn('audit_log insert failed:', err);
    }
    await signOut();
  }, [signOut, user?.id]);

  // --- Sign In ---
  const signIn = useCallback(async (email: string, password: string) => {
    try {
      // Try normal sign-in first
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        // If email provider is disabled, use the admin-sign-in edge function fallback
        if (error.message.includes('Email logins are disabled')) {
          devLog('Email provider disabled, trying admin-sign-in fallback...');
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
              devError('verifyOtp error:', verifyError);
              return { error: { message: verifyError.message || 'Session creation failed' } };
            }
            // Reset activity timestamp on successful login
            lastActivityRef.current = Date.now();
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
            lastActivityRef.current = Date.now();
            return { error: null };
          }

          return { error: { message: 'Unexpected authentication response' } };
        }
        return { error: { message: error.message } };
      }
      // Reset activity timestamp on successful login
      lastActivityRef.current = Date.now();
      if (data.session?.access_token) {
        setSession(data.session);
        setUser(userFromSession(data.session));
        const info = await fetchSessionInfo(data.session);
        if (!AUTH_SESSION_FALLBACK_ENABLED && !info) {
          return { error: { message: 'Admin session could not be verified.' } };
        }
      }
      return { error: null };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred.';
      devError('signIn error:', err);
      return { error: { message: errorMessage } };
    }
  }, [fetchSessionInfo]);

  // --- Auth State Change Listener ---
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, s) => {
        if (s?.access_token) {
          // Set session and fetch user info atomically to prevent flash
          // where session exists but user is still null
          setSession(s);
          setTimeout(() => {
            fetchSessionInfo(s).catch(devWarn).finally(() => setLoading(false));
          }, 0);
        } else {
          clearAuthState();
          setLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (s?.access_token) {
        setSession(s);
        fetchSessionInfo(s).catch(devWarn).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    }).catch(() => setLoading(false));

    return () => subscription.unsubscribe();
  }, [fetchSessionInfo, clearAuthState]);

  // --- User Activity Tracking ---
  useEffect(() => {
    const updateActivity = () => lastActivityRef.current = Date.now();

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
      if (Date.now() - lastActivityRef.current > INACTIVITY_TIMEOUT_MS) {
        devWarn('Inactivity timeout reached. Logging out.');
        signOutRef.current();
      }
    }, INACTIVITY_CHECK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [session]);

  // --- Session Validity Heartbeat (verify session every 5 min) ---
  useEffect(() => {
    if (!session?.access_token) return;

    const interval = setInterval(() => {
      fetchSessionInfo(session).catch(() => {
        devWarn('Session heartbeat failed. Forcing logout.');
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
          devWarn('Tab was hidden for >15 minutes. Forcing re-authentication.');
          signOutRef.current();
        }
        tabHiddenAtRef.current = null;
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const value = useMemo(() => ({
    user,
    session,
    sessionInfo,
    loading,
    signIn,
    signOut,
    forceLogout,
    refreshSession,
    mfaRequired,
    lastActivity: lastActivityRef.current,
  }), [user, session, sessionInfo, loading, signIn, signOut, forceLogout, refreshSession, mfaRequired]);

  return (
    <AuthContext.Provider value={value}>
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
