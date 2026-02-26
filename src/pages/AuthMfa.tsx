import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { devError } from '@/lib/devLog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Loader2, AlertCircle, ShieldCheck, Copy, Check } from 'lucide-react';

type MfaStep = 'loading' | 'enroll' | 'verify' | 'resetting';

/** Maximum MFA verification attempts before lockout */
const MAX_ATTEMPTS = 5;
/** Lockout duration in milliseconds (5 minutes) */
const LOCKOUT_DURATION_MS = 300_000;

export default function AuthMfa() {
  const navigate = useNavigate();
  const { refreshSession } = useAuth();
  const [step, setStep] = useState<MfaStep>('loading');
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Rate limiting state
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [lockdownRemaining, setLockdownRemaining] = useState('');

  // Enrollment state
  const [qrUri, setQrUri] = useState('');
  const [secret, setSecret] = useState('');
  const [enrollFactorId, setEnrollFactorId] = useState('');

  // Verification state (existing factor)
  const [verifyFactorId, setVerifyFactorId] = useState('');

  // Lockout countdown timer
  useEffect(() => {
    if (lockedUntil <= Date.now()) {
      setLockdownRemaining('');
      return;
    }

    const tick = () => {
      const remaining = lockedUntil - Date.now();
      if (remaining <= 0) {
        setLockdownRemaining('');
        setAttempts(0);
        setLockedUntil(0);
        setError(null);
      } else {
        const mins = Math.floor(remaining / 60_000);
        const secs = Math.ceil((remaining % 60_000) / 1000);
        setLockdownRemaining(
          mins > 0 ? `${mins}m ${secs}s` : `${secs}s`
        );
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [lockedUntil]);

  /** Check if rate-limited; returns true if locked out */
  const isLockedOut = useCallback((): boolean => {
    if (lockedUntil > Date.now()) {
      const remaining = lockedUntil - Date.now();
      const mins = Math.ceil(remaining / 60_000);
      setError(`Too many failed attempts. Try again in ${mins} minute${mins !== 1 ? 's' : ''}.`);
      return true;
    }
    return false;
  }, [lockedUntil]);

  /** Handle a failed verification attempt */
  const recordFailedAttempt = useCallback(() => {
    const newAttempts = attempts + 1;
    setAttempts(newAttempts);

    if (newAttempts >= MAX_ATTEMPTS) {
      const lockTime = Date.now() + LOCKOUT_DURATION_MS;
      setLockedUntil(lockTime);
      setError('Too many failed attempts. Try again in 5 minutes.');
    } else {
      const remaining = MAX_ATTEMPTS - newAttempts;
      setError(`Invalid code. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`);
    }
  }, [attempts]);

  /** Reset rate limiting on successful verification */
  const resetRateLimit = useCallback(() => {
    setAttempts(0);
    setLockedUntil(0);
  }, []);

  useEffect(() => {
    detectMfaState();
  }, []);

  const detectMfaState = async () => {
    try {
      const { data, error: listErr } = await supabase.auth.mfa.listFactors();
      if (listErr) throw listErr;

      const verified = data?.totp?.find(f => f.status === 'verified');
      if (verified) {
        setVerifyFactorId(verified.id);
        setStep('verify');
        return;
      }

      // No verified factor — enroll new one
      const { data: enrollData, error: enrollErr } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'Aspire Admin TOTP',
      });
      if (enrollErr) throw enrollErr;

      setQrUri(enrollData.totp.uri);
      setSecret(enrollData.totp.secret);
      setEnrollFactorId(enrollData.id);
      setStep('enroll');
    } catch (err: any) {
      devError('MFA detect error:', err);
      setError(err?.message || 'Failed to initialize MFA.');
      setStep('verify'); // fallback
    }
  };

  const handleCopySecret = () => {
    navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleResetMfa = async () => {
    setStep('resetting');
    setError(null);
    setCode('');
    try {
      // Unenroll existing verified factor
      if (verifyFactorId) {
        const { error: unenrollErr } = await supabase.auth.mfa.unenroll({ factorId: verifyFactorId });
        if (unenrollErr) throw unenrollErr;
      }
      // Enroll a fresh factor
      const { data: enrollData, error: enrollErr } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'Aspire Admin TOTP',
      });
      if (enrollErr) throw enrollErr;

      setQrUri(enrollData.totp.uri);
      setSecret(enrollData.totp.secret);
      setEnrollFactorId(enrollData.id);
      setVerifyFactorId('');
      setStep('enroll');
    } catch (err: any) {
      devError('MFA reset error:', err);
      setError(err?.message || 'Failed to reset MFA. Please try again.');
      setStep('verify');
    }
  };

  const handleEnrollVerify = async () => {
    if (isLockedOut()) return;

    if (code.length !== 6) {
      setError('Please enter the full 6-digit code.');
      return;
    }
    setError(null);
    setIsLoading(true);

    try {
      const { data: challengeData, error: challengeErr } = await supabase.auth.mfa.challenge({
        factorId: enrollFactorId,
      });
      if (challengeErr) throw challengeErr;

      const { error: verifyErr } = await supabase.auth.mfa.verify({
        factorId: enrollFactorId,
        challengeId: challengeData.id,
        code,
      });

      if (verifyErr) {
        recordFailedAttempt();
        setCode('');
        setIsLoading(false);
        return;
      }

      resetRateLimit();
      await refreshSession();
      navigate('/home');
    } catch (err: any) {
      setError(err?.message || 'Verification failed.');
      setIsLoading(false);
    }
  };

  const handleVerify = async () => {
    if (isLockedOut()) return;

    if (code.length !== 6) {
      setError('Please enter the full 6-digit code.');
      return;
    }
    setError(null);
    setIsLoading(true);

    try {
      const { data: challengeData, error: challengeErr } = await supabase.auth.mfa.challenge({
        factorId: verifyFactorId,
      });
      if (challengeErr) throw challengeErr;

      const { error: verifyErr } = await supabase.auth.mfa.verify({
        factorId: verifyFactorId,
        challengeId: challengeData.id,
        code,
      });

      if (verifyErr) {
        recordFailedAttempt();
        setCode('');
        setIsLoading(false);
        return;
      }

      resetRateLimit();
      await refreshSession();
      navigate('/home');
    } catch (err: any) {
      setError(err?.message || 'Verification failed.');
      setIsLoading(false);
    }
  };

  if (step === 'loading' || step === 'resetting') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          {step === 'resetting' && <p className="text-sm text-muted-foreground">Resetting MFA…</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="fixed inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse at 50% 0%, hsl(187 82% 53% / 0.04) 0%, transparent 60%)',
      }} />

      <div className="relative w-full max-w-sm px-6">
        {/* Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-11 h-11 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center mb-5">
            <ShieldCheck className="h-5 w-5 text-primary" />
          </div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">
            {step === 'enroll' ? 'Set Up MFA' : 'Verify Identity'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5 text-center">
            {step === 'enroll'
              ? 'Multi-factor authentication is required. Scan the QR code below with your authenticator app.'
              : 'Enter the 6-digit code from your authenticator app'}
          </p>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-5 border-destructive/30 bg-destructive/5">
            <AlertCircle className="h-3.5 w-3.5" />
            <AlertDescription className="text-sm">{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col items-center gap-5">
          {/* QR Code — enrollment only */}
          {step === 'enroll' && qrUri && (
            <>
              <div className="w-full rounded-xl border border-border bg-card p-4 flex items-center justify-center">
                <div className="bg-white rounded-lg p-3">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(qrUri)}`}
                    alt="MFA QR Code"
                    className="w-[180px] h-[180px]"
                  />
                </div>
              </div>

              {/* Manual entry key */}
              <div className="w-full rounded-lg border border-border bg-card/50 p-3">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest mb-1.5">
                  Manual Entry Key
                </p>
                <div className="flex items-center justify-between gap-2">
                  <code className="text-xs font-mono text-primary break-all leading-relaxed">
                    {secret}
                  </code>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={handleCopySecret}
                  >
                    {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
                  </Button>
                </div>
              </div>
            </>
          )}

          {/* Verification Code Input */}
          <div className="w-full">
            <p className="text-xs font-medium text-muted-foreground mb-3">
              Verification Code
            </p>
            <div className="flex justify-center">
              <InputOTP maxLength={6} value={code} onChange={setCode}>
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>
          </div>

          <Button
            onClick={step === 'enroll' ? handleEnrollVerify : handleVerify}
            className="w-full h-10 font-medium"
            disabled={isLoading || code.length !== 6 || lockedUntil > Date.now()}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : lockedUntil > Date.now() ? (
              `Locked (${lockdownRemaining})`
            ) : step === 'enroll' ? (
              'Enable & Verify'
            ) : (
              'Verify'
            )}
          </Button>
        </div>

        {/* Lost authenticator - only show on verify step */}
        {step === 'verify' && (
          <div className="mt-5 text-center">
            <button
              type="button"
              onClick={handleResetMfa}
              className="text-xs text-muted-foreground hover:text-primary underline underline-offset-2 transition-colors"
            >
              Lost your authenticator? Reset MFA
            </button>
          </div>
        )}

        <div className="mt-8 flex items-center justify-center gap-1.5 text-xs text-muted-foreground/60">
          <ShieldCheck className="h-3 w-3" />
          <span>Multi-factor authentication required</span>
        </div>
      </div>
    </div>
  );
}
