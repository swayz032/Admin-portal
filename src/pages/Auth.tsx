import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Loader2, AlertCircle, Lock, CheckCircle2, XCircle } from 'lucide-react';
import { z } from 'zod';

// --- Rate Limiting Constants ---
const MAX_ATTEMPTS_TIER1 = 5;   // 5 failed attempts → 60s lockout
const MAX_ATTEMPTS_TIER2 = 10;  // 10 failed attempts → 5 min lockout
const LOCKOUT_TIER1_MS = 60 * 1000;        // 60 seconds
const LOCKOUT_TIER2_MS = 5 * 60 * 1000;    // 5 minutes
const LOCKOUT_STORAGE_KEY = 'aspire_auth_lockout';

// --- Password Validation Schema (Enterprise-grade) ---
const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email({ message: 'Please enter a valid email address' }),
  password: z
    .string()
    .min(12, { message: 'Password must be at least 12 characters' })
    .regex(/[A-Z]/, { message: 'Password must contain at least one uppercase letter' })
    .regex(/[a-z]/, { message: 'Password must contain at least one lowercase letter' })
    .regex(/[0-9]/, { message: 'Password must contain at least one number' })
    .regex(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/, {
      message: 'Password must contain at least one special character',
    }),
});

// --- Password Strength Helpers ---
interface PasswordRequirement {
  label: string;
  met: boolean;
}

function getPasswordRequirements(password: string): PasswordRequirement[] {
  return [
    { label: 'At least 12 characters', met: password.length >= 12 },
    { label: 'One uppercase letter (A-Z)', met: /[A-Z]/.test(password) },
    { label: 'One lowercase letter (a-z)', met: /[a-z]/.test(password) },
    { label: 'One number (0-9)', met: /[0-9]/.test(password) },
    { label: 'One special character (!@#$...)', met: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password) },
  ];
}

function getPasswordStrength(password: string): { score: number; label: string; color: string } {
  if (!password) return { score: 0, label: '', color: '' };
  const reqs = getPasswordRequirements(password);
  const met = reqs.filter((r) => r.met).length;
  if (met <= 1) return { score: 20, label: 'Very weak', color: 'bg-red-500' };
  if (met === 2) return { score: 40, label: 'Weak', color: 'bg-orange-500' };
  if (met === 3) return { score: 60, label: 'Fair', color: 'bg-yellow-500' };
  if (met === 4) return { score: 80, label: 'Strong', color: 'bg-blue-500' };
  return { score: 100, label: 'Very strong', color: 'bg-green-500' };
}

// --- Lockout State Persistence (survives page refresh within browser) ---
interface LockoutState {
  attempts: number;
  lockoutUntil: number | null;
}

function loadLockoutState(): LockoutState {
  try {
    const raw = sessionStorage.getItem(LOCKOUT_STORAGE_KEY);
    if (!raw) return { attempts: 0, lockoutUntil: null };
    const parsed = JSON.parse(raw) as LockoutState;
    // If lockout has expired, reset
    if (parsed.lockoutUntil && Date.now() >= parsed.lockoutUntil) {
      return { attempts: parsed.attempts, lockoutUntil: null };
    }
    return parsed;
  } catch {
    return { attempts: 0, lockoutUntil: null };
  }
}

function saveLockoutState(state: LockoutState): void {
  try {
    sessionStorage.setItem(LOCKOUT_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage might be full or disabled — fail silently, in-memory state still works
  }
}

// --- Audit Logging ---
async function logAuthEvent(event: string, details: Record<string, unknown>): Promise<void> {
  try {
    await supabase.from('audit_log').insert({
      event,
      details,
      user_id: null, // null for pre-auth events (failed/successful login attempts)
      ip_address: null, // can't reliably get client IP from browser-side
    });
  } catch {
    // Never block the login flow if audit logging fails
  }
}

// --- Forgot Password Handler ---
async function handleForgotPassword(email: string): Promise<{ success: boolean; message: string }> {
  if (!email || !z.string().email().safeParse(email).success) {
    return { success: false, message: 'Please enter a valid email address first.' };
  }
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/auth`,
    });
    if (error) {
      // Never reveal if the email exists — always show the same message
      console.warn('Password reset error:', error.message);
    }
    // Always show the same success message regardless of whether email exists
    return {
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.',
    };
  } catch {
    return {
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.',
    };
  }
}

export default function Auth() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPasswordHints, setShowPasswordHints] = useState(false);
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);

  // --- Rate Limiting State ---
  const [attempts, setAttempts] = useState<number>(() => loadLockoutState().attempts);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(
    () => loadLockoutState().lockoutUntil,
  );
  const [lockoutRemaining, setLockoutRemaining] = useState<number>(0);

  // Persist lockout state to sessionStorage when it changes
  useEffect(() => {
    saveLockoutState({ attempts, lockoutUntil });
  }, [attempts, lockoutUntil]);

  // Lockout countdown timer
  useEffect(() => {
    if (!lockoutUntil) {
      setLockoutRemaining(0);
      return;
    }

    const tick = () => {
      const remaining = Math.max(0, Math.ceil((lockoutUntil - Date.now()) / 1000));
      setLockoutRemaining(remaining);
      if (remaining <= 0) {
        setLockoutUntil(null);
      }
    };

    tick(); // Immediately calculate on mount
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [lockoutUntil]);

  // --- Password Strength ---
  const passwordRequirements = useMemo(() => getPasswordRequirements(password), [password]);
  const passwordStrength = useMemo(() => getPasswordStrength(password), [password]);

  const isLockedOut = lockoutUntil !== null && Date.now() < lockoutUntil;

  const handleLogin = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setInfo(null);

      // --- Rate limit check (BEFORE any network call) ---
      if (isLockedOut) {
        setError(`Too many login attempts. Please try again in ${lockoutRemaining} seconds.`);
        await logAuthEvent('login_blocked_ratelimit', {
          email: email.trim().toLowerCase(),
          attempts,
          lockout_remaining_s: lockoutRemaining,
        });
        return;
      }

      // --- Input validation ---
      const sanitizedEmail = email.trim().toLowerCase();
      const result = loginSchema.safeParse({ email: sanitizedEmail, password });
      if (!result.success) {
        // Show the first validation error, but NEVER reveal which field is wrong for
        // a real attacker — validation errors are fine since the user is typing locally
        setError(result.error.errors[0].message);
        return;
      }

      setIsLoading(true);

      try {
        const { error: authError } = await signIn(sanitizedEmail, password);

        if (authError) {
          // --- Failed login: increment attempts, apply lockout ---
          const newAttempts = attempts + 1;
          setAttempts(newAttempts);

          // Always show a generic message — NEVER reveal if email exists
          setError('Invalid email or password.');

          await logAuthEvent('login_failed', {
            email: sanitizedEmail,
            attempt_number: newAttempts,
            error_type: authError.message.includes('Invalid login credentials')
              ? 'invalid_credentials'
              : 'auth_error',
          });

          if (newAttempts >= MAX_ATTEMPTS_TIER2) {
            const lockout = Date.now() + LOCKOUT_TIER2_MS;
            setLockoutUntil(lockout);
            setError(
              `Too many failed attempts. Your account is locked for 5 minutes. If this wasn't you, reset your password immediately.`,
            );
          } else if (newAttempts >= MAX_ATTEMPTS_TIER1) {
            const lockout = Date.now() + LOCKOUT_TIER1_MS;
            setLockoutUntil(lockout);
            setError(
              `Too many failed attempts. Please wait 60 seconds before trying again.`,
            );
          }

          setIsLoading(false);
          return;
        }

        // --- Successful login: reset rate limiting ---
        setAttempts(0);
        setLockoutUntil(null);
        saveLockoutState({ attempts: 0, lockoutUntil: null });

        await logAuthEvent('login_success', {
          email: sanitizedEmail,
        });

        navigate('/home');
      } catch (err: unknown) {
        setError('An unexpected error occurred. Please try again.');
        setIsLoading(false);
      }
    },
    [email, password, signIn, navigate, attempts, isLockedOut, lockoutRemaining],
  );

  const onForgotPassword = useCallback(async () => {
    setError(null);
    setInfo(null);
    setForgotPasswordLoading(true);
    const result = await handleForgotPassword(email);
    if (result.success) {
      setInfo(result.message);
    } else {
      setError(result.message);
    }
    setForgotPasswordLoading(false);
  }, [email]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      {/* Subtle radial gradient background */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at 50% 0%, hsl(187 82% 53% / 0.04) 0%, transparent 60%)',
        }}
      />

      <div className="relative w-full max-w-sm px-6">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-11 h-11 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center mb-5">
            <span className="text-primary font-semibold text-lg tracking-tight">A</span>
          </div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">
            Aspire Admin
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5">Sign in to continue</p>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive" className="mb-5 border-destructive/30 bg-destructive/5">
            <AlertCircle className="h-3.5 w-3.5" />
            <AlertDescription className="text-sm">{error}</AlertDescription>
          </Alert>
        )}

        {/* Info Alert (for forgot password success, etc.) */}
        {info && (
          <Alert className="mb-5 border-primary/30 bg-primary/5">
            <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
            <AlertDescription className="text-sm text-primary">{info}</AlertDescription>
          </Alert>
        )}

        {/* Lockout Countdown */}
        {isLockedOut && (
          <div className="mb-5 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-center">
            <p className="text-sm font-medium text-destructive">
              Account locked — {lockoutRemaining}s remaining
            </p>
            <Progress
              value={
                lockoutUntil
                  ? ((lockoutUntil - Date.now()) /
                      (attempts >= MAX_ATTEMPTS_TIER2
                        ? LOCKOUT_TIER2_MS
                        : LOCKOUT_TIER1_MS)) *
                    100
                  : 0
              }
              className="mt-2 h-1.5"
            />
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-5">
          <div className="space-y-1.5">
            <Label
              htmlFor="email"
              className="text-xs font-medium text-muted-foreground uppercase tracking-wider"
            >
              Email
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="admin@aspire.ai"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading || isLockedOut}
              required
              autoComplete="email"
              className="h-10 bg-secondary/50 border-border/50 focus:border-primary/40 transition-colors"
            />
          </div>
          <div className="space-y-1.5">
            <Label
              htmlFor="password"
              className="text-xs font-medium text-muted-foreground uppercase tracking-wider"
            >
              Password
            </Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onFocus={() => setShowPasswordHints(true)}
              onBlur={() => {
                // Keep hints visible if password is partially filled but incomplete
                if (passwordStrength.score >= 100) setShowPasswordHints(false);
              }}
              disabled={isLoading || isLockedOut}
              required
              autoComplete="current-password"
              className="h-10 bg-secondary/50 border-border/50 focus:border-primary/40 transition-colors"
            />

            {/* Password Strength Indicator */}
            {showPasswordHints && password.length > 0 && (
              <div className="mt-2.5 space-y-2">
                <div className="flex items-center gap-2">
                  <Progress
                    value={passwordStrength.score}
                    className="h-1.5 flex-1"
                  />
                  <span
                    className={`text-[10px] font-medium uppercase tracking-wider ${
                      passwordStrength.score <= 40
                        ? 'text-red-500'
                        : passwordStrength.score <= 60
                          ? 'text-yellow-500'
                          : passwordStrength.score <= 80
                            ? 'text-blue-500'
                            : 'text-green-500'
                    }`}
                  >
                    {passwordStrength.label}
                  </span>
                </div>
                <ul className="space-y-0.5">
                  {passwordRequirements.map((req) => (
                    <li
                      key={req.label}
                      className="flex items-center gap-1.5 text-[11px]"
                    >
                      {req.met ? (
                        <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
                      ) : (
                        <XCircle className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                      )}
                      <span
                        className={
                          req.met ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'
                        }
                      >
                        {req.label}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <Button
            type="submit"
            className="w-full h-10 font-medium"
            disabled={isLoading || isLockedOut}
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sign In'}
          </Button>
        </form>

        {/* Forgot Password */}
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={onForgotPassword}
            disabled={forgotPasswordLoading || isLockedOut}
            className="text-xs text-muted-foreground hover:text-primary underline underline-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {forgotPasswordLoading ? 'Sending...' : 'Forgot your password?'}
          </button>
        </div>

        {/* Footer */}
        <div className="mt-6 flex items-center justify-center gap-1.5 text-xs text-muted-foreground/60">
          <Lock className="h-3 w-3" />
          <span>Invite-only access</span>
        </div>
      </div>
    </div>
  );
}
