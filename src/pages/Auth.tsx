import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { devWarn } from '@/lib/devLog';
import { z } from 'zod';

// --- Rate Limiting Constants ---
const MAX_ATTEMPTS_TIER1 = 5;
const MAX_ATTEMPTS_TIER2 = 10;
const LOCKOUT_TIER1_MS = 60 * 1000;
const LOCKOUT_TIER2_MS = 5 * 60 * 1000;
const LOCKOUT_STORAGE_KEY = 'aspire_auth_lockout';

// --- Validation Schemas ---
const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email({ message: 'Please enter a valid email address' }),
  password: z.string().min(1, { message: 'Please enter your password' }),
});

const signupSchema = z.object({
  email: z.string().trim().toLowerCase().email({ message: 'Please enter a valid email address' }),
  password: z.string().min(8, { message: 'Password must be at least 8 characters' }),
  inviteCode: z.string().min(1, { message: 'Invite code is required' }),
});

// --- Lockout State ---
interface LockoutState { attempts: number; lockoutUntil: number | null; }

function loadLockoutState(): LockoutState {
  try {
    const raw = sessionStorage.getItem(LOCKOUT_STORAGE_KEY);
    if (!raw) return { attempts: 0, lockoutUntil: null };
    const parsed = JSON.parse(raw) as LockoutState;
    if (parsed.lockoutUntil && Date.now() >= parsed.lockoutUntil) {
      return { attempts: parsed.attempts, lockoutUntil: null };
    }
    return parsed;
  } catch { return { attempts: 0, lockoutUntil: null }; }
}

function saveLockoutState(state: LockoutState): void {
  try { sessionStorage.setItem(LOCKOUT_STORAGE_KEY, JSON.stringify(state)); } catch { /* */ }
}

// --- Audit Logging ---
async function logAuthEvent(event: string, details: Record<string, unknown>): Promise<void> {
  try {
    await supabase.from('audit_log').insert({ event, details, user_id: null, ip_address: null });
  } catch (err) {
    if (import.meta.env.DEV) console.warn('audit_log insert failed:', err);
  }
}

// --- Forgot Password ---
async function handleForgotPasswordFn(email: string): Promise<{ success: boolean; message: string }> {
  if (!email || !z.string().email().safeParse(email).success) {
    return { success: false, message: 'Please enter a valid email address first.' };
  }
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/auth`,
    });
    if (error) devWarn('Password reset error:', error.message);
    return { success: true, message: 'If an account with that email exists, a password reset link has been sent.' };
  } catch {
    return { success: true, message: 'If an account with that email exists, a password reset link has been sent.' };
  }
}

// ─── City lights [lat, lon] ────────────────────────────────────────────────
const CITIES: [number, number][] = [
  [40.71,-74.01],[51.51,-0.13],[48.85,2.35],[52.52,13.40],[55.75,37.62],
  [39.91,116.39],[35.68,139.69],[37.56,126.98],[1.35,103.82],[22.28,114.16],
  [19.08,72.88],[28.61,77.21],[12.97,77.59],[13.07,80.27],[23.13,113.27],
  [-23.55,-46.63],[-34.61,-58.38],[-33.87,151.21],[-37.81,144.96],
  [6.52,3.38],[30.06,31.25],[36.82,10.17],[-1.29,36.82],[25.20,55.27],
  [24.69,46.72],[41.01,28.95],[59.91,10.75],[59.33,18.07],[55.68,12.57],
  [60.17,24.94],[47.50,19.04],[50.07,14.44],[52.23,21.01],[48.15,17.11],
  [44.80,20.47],[37.98,23.73],[41.33,19.82],[45.81,15.98],[46.05,14.51],
  [47.37,8.54],[46.20,6.15],[48.21,16.37],[53.34,-6.27],[52.37,4.90],
  [50.85,4.35],[43.30,5.37],[45.76,4.84],[40.42,-3.70],[38.72,-9.14],
  [41.16,-8.63],[34.02,-6.84],[36.74,3.06],[33.89,35.50],[33.34,44.40],
  [35.69,51.42],[21.49,39.19],[3.15,101.69],[13.75,100.50],[21.03,105.85],
  [10.82,106.63],[11.56,104.92],[16.87,96.19],[47.91,106.92],
  [-4.32,15.32],[9.03,38.74],[2.05,45.34],[-26.32,31.14],[-33.93,18.42],
  [5.35,-4.01],[12.37,-1.52],[5.56,-0.20],[18.54,-72.34],[23.13,-82.38],
  [19.43,-99.13],[14.09,-87.21],[4.71,-74.07],[10.49,-66.88],
  [-0.23,-78.52],[-12.05,-77.03],[-16.50,-68.15],[-33.46,-70.65],[-34.90,-56.19],
  [47.61,-122.33],[37.77,-122.42],[34.05,-118.24],[29.76,-95.37],
  [41.88,-87.63],[43.65,-79.38],[45.51,-73.55],
];

// ─── Shared land points cache ──────────────────────────────────────────────
let _landCache: [number, number][] | null = null;
let _landPromise: Promise<[number, number][]> | null = null;

function getLandPoints(): Promise<[number, number][]> {
  if (_landCache) return Promise.resolve(_landCache);
  if (_landPromise) return _landPromise;
  _landPromise = fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/land-110m.json')
    .then(r => r.json())
    .then((topo: { transform: { scale: number[]; translate: number[] }; arcs: number[][][] }) => {
      const { scale, translate } = topo.transform;
      const pts: [number, number][] = [];
      for (const arc of topo.arcs) {
        let qx = 0, qy = 0, prevLon = 0, prevLat = 0;
        for (let j = 0; j < arc.length; j++) {
          qx += arc[j][0]; qy += arc[j][1];
          const lon = qx * scale[0] + translate[0];
          const lat = qy * scale[1] + translate[1];
          pts.push([lon, lat]);
          if (j > 0) pts.push([(lon + prevLon) / 2, (lat + prevLat) / 2]);
          prevLon = lon; prevLat = lat;
        }
      }
      _landCache = pts;
      return pts;
    })
    .catch(() => {
      const fallback: [number, number][] = [];
      for (let lat = -80; lat <= 80; lat += 5) {
        const n = Math.floor(Math.cos((lat * Math.PI) / 180) * 36);
        for (let i = 0; i < n; i++) fallback.push([(i / n) * 360 - 180, lat]);
      }
      _landCache = fallback;
      return fallback;
    });
  return _landPromise;
}

// ─── GlobeCanvas ───────────────────────────────────────────────────────────
const ACCENT_RGB = '59,130,246';
const LAND_COLOR = '68,76,84';

function GlobeCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const angleRef = useRef(1.1);
  const tRef = useRef(0);
  const ptsRef = useRef<[number, number][]>([]);

  useEffect(() => {
    getLandPoints().then(pts => { ptsRef.current = pts; });
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = 520, H = 520, R = 215;
    const cx = W / 2, cy = H / 2;
    const TILT = (20 * Math.PI) / 180;

    const project = (lat: number, lon: number, rot: number) => {
      const phi = (lat * Math.PI) / 180;
      const lam = (lon * Math.PI) / 180 + rot;
      const x3 = Math.cos(phi) * Math.cos(lam);
      const y3 = Math.sin(phi);
      const z3 = Math.cos(phi) * Math.sin(lam);
      const y2 = y3 * Math.cos(TILT) - z3 * Math.sin(TILT);
      const z2 = y3 * Math.sin(TILT) + z3 * Math.cos(TILT);
      return { sx: cx + x3 * R, sy: cy - y2 * R, d: z2 };
    };

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);
      angleRef.current += 0.0022;
      tRef.current += 0.016;
      const rot = angleRef.current;
      const t = tRef.current;

      ctx.clearRect(0, 0, W, H);

      const pts = ptsRef.current;
      for (let i = 0; i < pts.length; i++) {
        const { sx, sy, d } = project(pts[i][1], pts[i][0], rot);
        if (d >= 0) {
          ctx.beginPath();
          ctx.arc(sx, sy, 1.35, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${LAND_COLOR},${(0.3 + d * 0.6).toFixed(2)})`;
          ctx.fill();
        } else if (d > -0.25) {
          ctx.beginPath();
          ctx.arc(sx, sy, 0.7, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${LAND_COLOR},0.06)`;
          ctx.fill();
        }
      }

      for (let i = 0; i < CITIES.length; i++) {
        const { sx, sy, d } = project(CITIES[i][0], CITIES[i][1], rot);
        if (d >= -0.1) {
          const vis = Math.max(0, (d + 0.1) / 1.1);
          const pulse = 0.5 + 0.5 * Math.sin(t * 1.8 + i * 0.7);
          const sz = 2.5 + d * 2;
          const grd = ctx.createRadialGradient(sx, sy, 0, sx, sy, sz * 3.5);
          grd.addColorStop(0, `rgba(${ACCENT_RGB},${(pulse * vis * 0.6).toFixed(2)})`);
          grd.addColorStop(1, `rgba(${ACCENT_RGB},0)`);
          ctx.beginPath();
          ctx.arc(sx, sy, sz * 3.5, 0, Math.PI * 2);
          ctx.fillStyle = grd;
          ctx.fill();
          ctx.beginPath();
          ctx.arc(sx, sy, Math.max(1, sz * 0.65), 0, Math.PI * 2);
          ctx.fillStyle = `rgba(210,238,255,${(pulse * vis * 0.92).toFixed(2)})`;
          ctx.fill();
        }
      }
    };

    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={520}
      height={520}
      style={{ display: 'block', animation: 'floatGlobe 6s ease-in-out infinite' }}
    />
  );
}

// ─── useScramble ──────────────────────────────────────────────────────────
function useScramble(target: string, active: boolean): string {
  const [text, setText] = useState(target);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&';

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!active) { setText(target); return; }
    let frame = 0;
    const total = target.length * 3 + 8;
    timerRef.current = setInterval(() => {
      frame++;
      setText(
        target.split('').map((ch, i) => {
          if (ch === ' ') return ' ';
          if (frame >= i * 3 + 4) return ch;
          return CHARS[Math.floor(Math.random() * CHARS.length)];
        }).join('')
      );
      if (frame > total) { clearInterval(timerRef.current!); setText(target); }
    }, 35);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [active, target]);

  return text;
}

// ─── Auth Page ─────────────────────────────────────────────────────────────
export default function Auth() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const cardRef = useRef<HTMLDivElement>(null);

  const title = useScramble('Aspire Admin Portal', true);

  // --- Rate Limiting ---
  const [attempts, setAttempts] = useState<number>(() => loadLockoutState().attempts);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(() => loadLockoutState().lockoutUntil);
  const [lockoutRemaining, setLockoutRemaining] = useState<number>(0);

  useEffect(() => { saveLockoutState({ attempts, lockoutUntil }); }, [attempts, lockoutUntil]);

  useEffect(() => {
    if (!lockoutUntil) { setLockoutRemaining(0); return; }
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((lockoutUntil - Date.now()) / 1000));
      setLockoutRemaining(remaining);
      if (remaining <= 0) setLockoutUntil(null);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [lockoutUntil]);

  const isLockedOut = lockoutUntil !== null && Date.now() < lockoutUntil;

  const switchMode = (newMode: 'signin' | 'signup') => {
    setMode(newMode);
    setError(null);
    setInfo(null);
  };

  // --- 3D Tilt ---
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = cardRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setTilt({
      x: -((e.clientY - (r.top + r.height / 2)) / (r.height / 2)) * 3.5,
      y: ((e.clientX - (r.left + r.width / 2)) / (r.width / 2)) * 5,
    });
  }, []);

  const handleMouseLeave = useCallback(() => setTilt({ x: 0, y: 0 }), []);

  // --- Sign In ---
  const handleLogin = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (isLockedOut) {
      setError(`Too many login attempts. Please try again in ${lockoutRemaining} seconds.`);
      return;
    }
    const sanitizedEmail = email.trim().toLowerCase();
    const result = loginSchema.safeParse({ email: sanitizedEmail, password });
    if (!result.success) { setError(result.error.errors[0].message); return; }
    setIsLoading(true);
    try {
      const { error: authError } = await signIn(sanitizedEmail, password);
      if (authError) {
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        setError('Invalid email or password.');
        await logAuthEvent('login_failed', { email: sanitizedEmail, attempt_number: newAttempts });
        if (newAttempts >= MAX_ATTEMPTS_TIER2) {
          setLockoutUntil(Date.now() + LOCKOUT_TIER2_MS);
          setError('Too many failed attempts. Your account is locked for 5 minutes.');
        } else if (newAttempts >= MAX_ATTEMPTS_TIER1) {
          setLockoutUntil(Date.now() + LOCKOUT_TIER1_MS);
          setError('Too many failed attempts. Please wait 60 seconds.');
        }
        setIsLoading(false);
        return;
      }
      setAttempts(0);
      setLockoutUntil(null);
      saveLockoutState({ attempts: 0, lockoutUntil: null });
      navigate('/home');
    } catch {
      setError('An unexpected error occurred. Please try again.');
      setIsLoading(false);
    }
  }, [email, password, signIn, navigate, attempts, isLockedOut, lockoutRemaining]);

  // --- Sign Up ---
  const handleSignup = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    const sanitizedEmail = email.trim().toLowerCase();
    const result = signupSchema.safeParse({ email: sanitizedEmail, password, inviteCode: inviteCode.trim() });
    if (!result.success) { setError(result.error.errors[0].message); return; }
    setIsLoading(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('admin-signup', {
        body: { email: sanitizedEmail, password, invite_code: inviteCode.trim() },
      });
      if (fnError) { setError(fnError.message || 'Signup failed. Please try again.'); setIsLoading(false); return; }
      if (data?.error) { setError(data.error); setIsLoading(false); return; }
      if (data?.session?.access_token) {
        const { error: setSessionError } = await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
        if (!setSessionError) {
          await logAuthEvent('signup_success', { email: sanitizedEmail });
          navigate('/home');
          return;
        }
      }
      setInfo('Account created successfully! Please sign in.');
      setMode('signin');
      setIsLoading(false);
    } catch {
      setError('An unexpected error occurred. Please try again.');
      setIsLoading(false);
    }
  }, [email, password, inviteCode, navigate]);

  const onForgotPassword = useCallback(async () => {
    setError(null);
    setInfo(null);
    setForgotPasswordLoading(true);
    const result = await handleForgotPasswordFn(email);
    if (result.success) setInfo(result.message);
    else setError(result.message);
    setForgotPasswordLoading(false);
  }, [email]);

  // --- Input style helper ---
  const inp = (field: string): React.CSSProperties => ({
    width: '100%',
    background: 'rgba(255,255,255,0.07)',
    border: `1px solid ${focused === field ? '#3B82F6' : 'rgba(255,255,255,0.11)'}`,
    borderRadius: 10,
    padding: '13px 15px',
    fontSize: 14,
    color: '#fff',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s',
    fontFamily: 'inherit',
    marginBottom: 14,
  });

  const lbl: React.CSSProperties = {
    display: 'block',
    fontSize: 10,
    fontWeight: 700,
    color: 'rgba(255,255,255,0.42)',
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
    marginBottom: 6,
    fontFamily: 'inherit',
  };

  return (
    <>
      <style>{`
        @keyframes floatGlobe {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-13px); }
        }
        @keyframes floatCard {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        *, *::before, *::after { box-sizing: border-box; }
        .auth-page-root input:-webkit-autofill,
        .auth-page-root input:-webkit-autofill:hover,
        .auth-page-root input:-webkit-autofill:focus {
          -webkit-text-fill-color: #fff !important;
          -webkit-box-shadow: 0 0 0px 1000px rgba(20,26,38,1) inset !important;
          transition: background-color 9999s ease-in-out 0s;
        }
        .auth-page-root ::placeholder { color: rgba(255,255,255,0.24) !important; }
      `}</style>

      <div
        className="auth-page-root"
        style={{
          width: '100vw',
          height: '100vh',
          background: '#000000',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", sans-serif',
        }}
      >
        {/* Floating Aspire Logo */}
        <div style={{ position: 'absolute', top: 0, left: 0, zIndex: 100, pointerEvents: 'none' }}>
          <img
            src="/aspire-logo-full.png"
            alt="Aspire"
            style={{ height: 140, objectFit: 'contain', display: 'block' }}
          />
        </div>

        {/* Card Stage */}
        <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ animation: 'floatCard 6s ease-in-out infinite' }}>
            <div
              ref={cardRef}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              style={{
                transform: `perspective(1600px) rotateY(${tilt.y}deg) rotateX(${tilt.x}deg)`,
                transition: 'transform 0.58s cubic-bezier(0.34,1.12,0.64,1)',
                width: 'clamp(780px, 72vw, 940px)',
                height: 'clamp(460px, 70vh, 580px)',
                display: 'flex',
                flexDirection: 'row',
                borderRadius: 22,
                background: 'rgba(8,12,22,0.94)',
                backdropFilter: 'blur(52px) saturate(180%)',
                WebkitBackdropFilter: 'blur(52px) saturate(180%)',
                border: '1px solid rgba(59,130,246,0.2)',
                boxShadow: '0 0 0 1px rgba(255,255,255,0.035), 0 52px 150px rgba(0,0,0,0.95), inset 0 1px 0 rgba(255,255,255,0.055)',
                overflow: 'hidden',
                userSelect: 'none',
              }}
            >
              {/* ── LEFT: Form ── */}
              <div style={{
                width: '42%',
                padding: '48px 44px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                flexShrink: 0,
                position: 'relative',
                zIndex: 2,
                overflowY: 'auto',
              }}>
                {/* Accent bar + title */}
                <div style={{ marginBottom: 26 }}>
                  <div style={{ width: 28, height: 2, background: '#3B82F6', borderRadius: 2, marginBottom: 14, opacity: 0.85 }} />
                  <h1 style={{
                    fontSize: 24,
                    fontWeight: 800,
                    color: '#fff',
                    letterSpacing: '-0.04em',
                    margin: '0 0 6px 0',
                    lineHeight: 1.1,
                    fontFamily: 'inherit',
                  }}>
                    {title}
                  </h1>
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.36)', margin: 0, letterSpacing: '0.01em', fontFamily: 'inherit' }}>
                    Governed AI execution platform
                  </p>
                </div>

                {/* Sign In / Sign Up Tabs */}
                <div style={{
                  display: 'flex',
                  flexDirection: 'row',
                  borderBottom: '1px solid rgba(255,255,255,0.09)',
                  marginBottom: 22,
                  position: 'relative',
                }}>
                  {(['signin', 'signup'] as const).map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => switchMode(m)}
                      style={{
                        flex: 1,
                        background: 'none',
                        border: 'none',
                        padding: '9px 0 11px',
                        fontSize: 13,
                        fontWeight: 600,
                        color: mode === m ? '#fff' : 'rgba(255,255,255,0.35)',
                        cursor: 'pointer',
                        transition: 'color 0.2s',
                        fontFamily: 'inherit',
                      }}
                    >
                      {m === 'signin' ? 'Sign In' : 'Sign Up'}
                    </button>
                  ))}
                  <div style={{
                    position: 'absolute',
                    bottom: 0,
                    left: mode === 'signin' ? '0%' : '50%',
                    width: '50%',
                    height: 2,
                    background: '#3B82F6',
                    transition: 'left 0.3s cubic-bezier(0.34,1.56,0.64,1)',
                    borderRadius: 2,
                  }} />
                </div>

                {/* Error */}
                {error && (
                  <div style={{
                    background: 'rgba(239,68,68,0.1)',
                    border: '1px solid rgba(239,68,68,0.26)',
                    borderRadius: 8,
                    padding: '10px 14px',
                    marginBottom: 14,
                    fontSize: 13,
                    color: '#F87171',
                    fontFamily: 'inherit',
                  }}>{error}</div>
                )}

                {/* Info */}
                {info && (
                  <div style={{
                    background: 'rgba(59,130,246,0.1)',
                    border: '1px solid rgba(59,130,246,0.26)',
                    borderRadius: 8,
                    padding: '10px 14px',
                    marginBottom: 14,
                    fontSize: 13,
                    color: '#60A5FA',
                    fontFamily: 'inherit',
                  }}>{info}</div>
                )}

                {/* Lockout */}
                {isLockedOut && mode === 'signin' && (
                  <div style={{
                    background: 'rgba(239,68,68,0.1)',
                    border: '1px solid rgba(239,68,68,0.26)',
                    borderRadius: 8,
                    padding: '10px 14px',
                    marginBottom: 14,
                    fontSize: 13,
                    color: '#F87171',
                    fontFamily: 'inherit',
                    textAlign: 'center',
                  }}>
                    Account locked — {lockoutRemaining}s remaining
                    <div style={{
                      marginTop: 8,
                      height: 3,
                      borderRadius: 2,
                      background: 'rgba(239,68,68,0.15)',
                      overflow: 'hidden',
                    }}>
                      <div style={{
                        height: '100%',
                        borderRadius: 2,
                        background: '#F87171',
                        width: `${lockoutUntil ? ((lockoutUntil - Date.now()) / (attempts >= MAX_ATTEMPTS_TIER2 ? LOCKOUT_TIER2_MS : LOCKOUT_TIER1_MS)) * 100 : 0}%`,
                        transition: 'width 1s linear',
                      }} />
                    </div>
                  </div>
                )}

                {/* Sign In Form */}
                {mode === 'signin' && (
                  <form onSubmit={handleLogin}>
                    <label style={lbl}>Email</label>
                    <input
                      type="email"
                      placeholder="admin@aspire.ai"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onFocus={() => setFocused('email')}
                      onBlur={() => setFocused(null)}
                      disabled={isLoading || isLockedOut}
                      required
                      autoComplete="email"
                      style={inp('email')}
                    />

                    <label style={lbl}>Password</label>
                    <input
                      type="password"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onFocus={() => setFocused('password')}
                      onBlur={() => setFocused(null)}
                      disabled={isLoading || isLockedOut}
                      required
                      autoComplete="current-password"
                      style={inp('password')}
                    />

                    <button
                      type="submit"
                      disabled={isLoading || isLockedOut}
                      style={{
                        width: '100%',
                        background: isLoading
                          ? 'rgba(59,130,246,0.48)'
                          : 'linear-gradient(135deg, #3B82F6 0%, #60A5FA 40%, #06B6D4 100%)',
                        border: 'none',
                        borderRadius: 10,
                        padding: '14px 0',
                        fontSize: 14,
                        fontWeight: 700,
                        color: '#fff',
                        cursor: isLoading || isLockedOut ? 'not-allowed' : 'pointer',
                        marginTop: 4,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        transition: 'opacity 0.2s, background 0.2s',
                        fontFamily: 'inherit',
                        letterSpacing: '0.01em',
                        opacity: isLockedOut ? 0.5 : 1,
                      }}
                      onMouseEnter={(e) => { if (!isLoading && !isLockedOut) e.currentTarget.style.opacity = '0.84'; }}
                      onMouseLeave={(e) => { if (!isLoading && !isLockedOut) e.currentTarget.style.opacity = '1'; }}
                    >
                      {isLoading ? 'Please wait…' : 'Sign In'}
                    </button>

                    <div style={{ textAlign: 'center', marginTop: 14 }}>
                      <button
                        type="button"
                        onClick={onForgotPassword}
                        disabled={forgotPasswordLoading || isLockedOut}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'rgba(255,255,255,0.35)',
                          fontSize: 12,
                          cursor: forgotPasswordLoading || isLockedOut ? 'not-allowed' : 'pointer',
                          textDecoration: 'underline',
                          textUnderlineOffset: 3,
                          fontFamily: 'inherit',
                          transition: 'color 0.2s',
                          opacity: isLockedOut ? 0.5 : 1,
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = '#60A5FA'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.35)'; }}
                      >
                        {forgotPasswordLoading ? 'Sending...' : 'Forgot your password?'}
                      </button>
                    </div>
                  </form>
                )}

                {/* Sign Up Form */}
                {mode === 'signup' && (
                  <form onSubmit={handleSignup}>
                    <label style={lbl}>Invite Code</label>
                    <input
                      type="text"
                      placeholder="Private beta invite code"
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value)}
                      onFocus={() => setFocused('invite')}
                      onBlur={() => setFocused(null)}
                      disabled={isLoading}
                      required
                      autoComplete="off"
                      style={inp('invite')}
                    />

                    <label style={lbl}>Email</label>
                    <input
                      type="email"
                      placeholder="you@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onFocus={() => setFocused('signup-email')}
                      onBlur={() => setFocused(null)}
                      disabled={isLoading}
                      required
                      autoComplete="email"
                      style={inp('signup-email')}
                    />

                    <label style={lbl}>Password</label>
                    <input
                      type="password"
                      placeholder="Min. 8 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onFocus={() => setFocused('signup-password')}
                      onBlur={() => setFocused(null)}
                      disabled={isLoading}
                      required
                      minLength={8}
                      autoComplete="new-password"
                      style={inp('signup-password')}
                    />

                    <button
                      type="submit"
                      disabled={isLoading}
                      style={{
                        width: '100%',
                        background: isLoading
                          ? 'rgba(59,130,246,0.48)'
                          : 'linear-gradient(135deg, #3B82F6 0%, #60A5FA 40%, #06B6D4 100%)',
                        border: 'none',
                        borderRadius: 10,
                        padding: '14px 0',
                        fontSize: 14,
                        fontWeight: 700,
                        color: '#fff',
                        cursor: isLoading ? 'not-allowed' : 'pointer',
                        marginTop: 4,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        transition: 'opacity 0.2s, background 0.2s',
                        fontFamily: 'inherit',
                        letterSpacing: '0.01em',
                      }}
                      onMouseEnter={(e) => { if (!isLoading) e.currentTarget.style.opacity = '0.84'; }}
                      onMouseLeave={(e) => { if (!isLoading) e.currentTarget.style.opacity = '1'; }}
                    >
                      {isLoading ? 'Please wait…' : 'Create Account'}
                    </button>
                  </form>
                )}
              </div>

              {/* ── RIGHT: Globe ── */}
              <div style={{
                flex: 1,
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderLeft: '1px solid rgba(255,255,255,0.055)',
                overflow: 'hidden',
              }}>
                {/* Ambient glow */}
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  pointerEvents: 'none',
                  background: 'radial-gradient(ellipse 80% 80% at 55% 55%, rgba(59,130,246,0.08) 0%, transparent 68%)',
                }} />

                {/* Manifesto */}
                <div style={{ position: 'absolute', top: 30, left: 28, zIndex: 10, maxWidth: 240, pointerEvents: 'none' }}>
                  <span style={{
                    display: 'block',
                    fontSize: 46,
                    lineHeight: 1,
                    marginBottom: -2,
                    color: '#3B82F6',
                    opacity: 0.88,
                    fontFamily: 'Georgia, "Times New Roman", serif',
                  }}>&#10077;</span>
                  <span style={{
                    display: 'block',
                    fontSize: 20,
                    fontWeight: 800,
                    color: '#fff',
                    letterSpacing: '-0.035em',
                    lineHeight: 1.15,
                    fontFamily: 'inherit',
                  }}>Creating Freedom</span>
                  <span style={{
                    display: 'block',
                    fontSize: 16,
                    fontWeight: 400,
                    color: 'rgba(255,255,255,0.65)',
                    letterSpacing: '-0.01em',
                    lineHeight: 1.35,
                    marginTop: 5,
                    fontFamily: 'inherit',
                  }}>One Step at a Time.</span>
                  <div style={{ width: 34, height: 2, background: '#3B82F6', borderRadius: 2, marginTop: 14, opacity: 0.6 }} />
                </div>

                {/* Globe */}
                <GlobeCanvas />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          position: 'absolute',
          bottom: 18,
          left: '50%',
          transform: 'translateX(-50%)',
          textAlign: 'center',
          zIndex: 5,
          pointerEvents: 'none',
        }}>
          <div style={{
            fontSize: 18,
            fontWeight: 800,
            color: '#fff',
            letterSpacing: '-0.03em',
            lineHeight: 1.1,
            fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", sans-serif',
          }}>
            Aspire Admin Portal
          </div>
          <div style={{
            fontSize: 12,
            fontWeight: 500,
            color: '#3B82F6',
            marginTop: 4,
            fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", sans-serif',
          }}>
            Governed AI execution platform
          </div>
        </div>

        <div style={{
          position: 'absolute',
          bottom: 18,
          right: 28,
          fontSize: 11,
          color: 'rgba(255,255,255,0.16)',
          letterSpacing: '0.04em',
          zIndex: 5,
          fontFamily: 'inherit',
          pointerEvents: 'none',
        }}>
          Aspire — Private Beta
        </div>
      </div>
    </>
  );
}
