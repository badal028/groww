import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import GrowwLogo from '@/components/GrowwLogo';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/hooks/useAuth';
import { isAdminEmail } from '@/lib/accountLabels';
import { ArrowLeft, CheckCircle2, Eye, EyeOff } from 'lucide-react';

const apiBase = import.meta.env.VITE_MARKET_DATA_API_BASE || 'http://127.0.0.1:3001';

const OTP_RESEND_SECONDS = 60;

type SignupStep = 'details' | 'otp';

function parseWaitSeconds(message: string): number | null {
  const m = String(message).match(/wait (\d+)s/i);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function formatAuthError(message: string, context: 'login' | 'signup' | 'otp') {
  const raw = String(message || '').trim();
  if (/invite-only|@optixadmin|telegram for access/i.test(raw)) {
    return {
      text: 'Access is invite-only. Kindly contact @optixadmin on Telegram for access.',
      hintLogin: false,
    };
  }
  if (/already registered/i.test(raw)) {
    return {
      text: 'This email is already registered. Log in with your password instead.',
      hintLogin: true,
    };
  }
  if (/invalid credentials/i.test(raw)) {
    return { text: 'Incorrect email or password. Please try again.', hintLogin: false };
  }
  if (/not configured|BREVO_API_KEY|BREVO_FROM_EMAIL/i.test(raw)) {
    return {
      text: 'Email verification is not set up on the server. Add BREVO_API_KEY and BREVO_FROM_EMAIL to .env.server and restart npm run server.',
      hintLogin: false,
    };
  }
  if (/verify your email/i.test(raw)) {
    return { text: raw, hintLogin: false };
  }
  if (/expired/i.test(raw) && context !== 'login') {
    return { text: raw, hintLogin: false };
  }
  return { text: raw || 'Something went wrong. Please try again.', hintLogin: false };
}

const LoginPage: React.FC = () => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [signupStep, setSignupStep] = useState<SignupStep>('details');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [hintLogin, setHintLogin] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [emailOtpConfigured, setEmailOtpConfigured] = useState(false);
  const [signupOtpBypass, setSignupOtpBypass] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpSentMessage, setOtpSentMessage] = useState('');
  const [resendSecondsLeft, setResendSecondsLeft] = useState(0);
  const [signupSuccessOpen, setSignupSuccessOpen] = useState(false);
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigate = useNavigate();
  const { login, signup, logout } = useAuth();

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (resendSecondsLeft <= 0) return;
    const timer = window.setInterval(() => {
      setResendSecondsLeft((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendSecondsLeft]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${apiBase}/auth/config`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) {
          setEmailOtpConfigured(Boolean(data?.emailOtpConfigured));
          setSignupOtpBypass(Boolean(data?.signupOtpBypass));
        }
      } catch {
        /* dev server may be offline */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get('error');
    if (!err) return;
    const map: Record<string, string> = {
      google_auth_failed: 'Google sign-in failed. Please try again.',
      invalid_state: 'Sign-in expired. Please try again.',
      oauth_not_configured: 'Google sign-in is not configured on the server.',
      access_denied: 'Google sign-in was cancelled.',
      access_closed: 'Access is invite-only. Kindly contact @optixadmin on Telegram for access.',
    };
    setError(map[err] ?? `Error: ${err}`);
    setHintLogin(false);
    window.history.replaceState(null, '', window.location.pathname);
  }, []);

  const clearError = () => {
    setError('');
    setHintLogin(false);
  };

  const clearOtpFeedback = () => {
    setOtpSentMessage('');
  };

  const startResendCooldown = (seconds: number) => {
    setResendSecondsLeft(Math.max(1, Math.floor(seconds)));
  };

  const setAuthError = (message: string, context: 'login' | 'signup' | 'otp') => {
    const formatted = formatAuthError(message, context);
    setError(formatted.text);
    setHintLogin(formatted.hintLogin);
  };

  const resetSignupFlow = () => {
    setSignupStep('details');
    setOtp('');
    setOtpSentMessage('');
    setResendSecondsLeft(0);
  };

  const switchToLogin = (opts?: { prefillEmail?: string; keepPassword?: boolean }) => {
    if (redirectTimerRef.current) {
      clearTimeout(redirectTimerRef.current);
      redirectTimerRef.current = null;
    }
    setSignupSuccessOpen(false);
    setMode('login');
    resetSignupFlow();
    setName('');
    if (!opts?.keepPassword) setPassword('');
    if (opts?.prefillEmail) setEmail(opts.prefillEmail);
    clearError();
  };

  const switchToSignup = () => {
    if (redirectTimerRef.current) {
      clearTimeout(redirectTimerRef.current);
      redirectTimerRef.current = null;
    }
    setSignupSuccessOpen(false);
    logout();
    setMode('signup');
    resetSignupFlow();
    clearError();
  };

  const finishSignupToLogin = (registeredEmail: string) => {
    logout();
    setSignupSuccessOpen(true);
    redirectTimerRef.current = setTimeout(() => {
      redirectTimerRef.current = null;
      setSignupSuccessOpen(false);
      switchToLogin({ prefillEmail: registeredEmail });
    }, 2500);
  };

  const createAccount = async (emailVerificationToken?: string) => {
    const result = await signup({
      name,
      email,
      password,
      emailVerificationToken,
    });
    if (!result.ok) {
      setAuthError(result.message || 'Signup failed', signupStep === 'otp' ? 'otp' : 'signup');
      return false;
    }
    finishSignupToLogin(email.trim().toLowerCase());
    return true;
  };

  const sendOtp = async (context: 'signup' | 'otp' = 'signup') => {
    clearError();
    setOtpSending(true);
    try {
      const res = await fetch(`${apiBase}/auth/email-otp/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, purpose: 'signup' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const waitSec = parseWaitSeconds(data?.message || '');
        if (waitSec) startResendCooldown(waitSec);
        setAuthError(data?.message || 'Could not send verification code', context);
        return false;
      }
      setOtp('');
      setOtpSentMessage(
        data?.message || 'Verification code sent. Check your inbox (and spam folder).',
      );
      startResendCooldown(OTP_RESEND_SECONDS);
      setSignupStep('otp');
      return true;
    } catch {
      setAuthError('Unable to connect to server', context);
      return false;
    } finally {
      setOtpSending(false);
    }
  };

  const handleSignupDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    if (String(password).length < 6) {
      setError('Password should be at least 6 characters');
      setHintLogin(false);
      return;
    }
    setSubmitting(true);
    try {
      if (signupOtpBypass) {
        await createAccount();
        return;
      }
      if (!emailOtpConfigured) {
        setAuthError(
          'Email verification is not set up on the server. Add BREVO_API_KEY and BREVO_FROM_EMAIL to .env.server and restart npm run server.',
          'signup',
        );
        return;
      }
      const sent = await sendOtp();
      if (!sent) setSignupStep('details');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyOtpAndSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    if (otp.length !== 6) {
      setError('Enter the 6-digit code');
      setHintLogin(false);
      return;
    }
    setOtpVerifying(true);
    try {
      const res = await fetch(`${apiBase}/auth/email-otp/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp, purpose: 'signup' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAuthError(data?.message || 'Invalid code', 'otp');
        return;
      }
      setSubmitting(true);
      await createAccount(data.emailVerificationToken);
    } catch {
      setAuthError('Unable to connect to server', 'otp');
    } finally {
      setOtpVerifying(false);
      setSubmitting(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setSubmitting(true);
    const result = await login({ email, password });
    setSubmitting(false);
    if (!result.ok) {
      setAuthError(result.message || 'Login failed', 'login');
      return;
    }
    const u = result.user;
    navigate(u && isAdminEmail(u.email) ? '/admin' : '/stocks');
  };

  const errorBlock = (context: 'login' | 'signup' | 'otp') =>
    error || hintLogin ? (
      <div className="space-y-2">
        {error && <p className="text-sm text-loss">{error}</p>}
        {hintLogin && (
          <button
            type="button"
            onClick={() => switchToLogin({ prefillEmail: email.trim().toLowerCase() })}
            className="text-sm font-medium text-primary hover:underline"
          >
            Go to login
          </button>
        )}
      </div>
    ) : null;

  if (mode === 'signup' && signupStep === 'otp') {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6">
          <button
            type="button"
            onClick={() => {
              setSignupStep('details');
              setOtp('');
              clearError();
              clearOtpFeedback();
              setResendSecondsLeft(0);
            }}
            className="mb-6 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>

          <div className="mb-6">
            <GrowwLogo size={32} />
          </div>

          <h1 className="mb-1 text-2xl font-semibold text-foreground">Verify your email</h1>
          <p className="mb-3 text-sm text-muted-foreground">
            Enter the 6-digit code sent to <span className="font-medium text-foreground">{email}</span>
          </p>

          {otpSentMessage && (
            <p className="mb-4 rounded-lg border border-gain/30 bg-gain/5 px-3 py-2 text-sm text-gain">
              {otpSentMessage}
            </p>
          )}

          <form onSubmit={handleVerifyOtpAndSignup} className="space-y-4">
            <InputOTP maxLength={6} value={otp} onChange={setOtp}>
              <InputOTPGroup className="w-full justify-center">
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>

            {errorBlock('otp')}

            <button
              type="submit"
              disabled={otpVerifying || submitting || otp.length !== 6}
              className="h-11 w-full rounded-lg bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-70"
            >
              {otpVerifying || submitting ? 'Please wait...' : 'Verify & create account'}
            </button>

            <button
              type="button"
              onClick={() => void sendOtp('otp')}
              disabled={otpSending || resendSecondsLeft > 0}
              className="h-10 w-full text-sm text-primary disabled:opacity-60"
            >
              {otpSending
                ? 'Sending…'
                : resendSecondsLeft > 0
                  ? `Resend code in ${resendSecondsLeft}s`
                  : 'Resend code'}
            </button>
          </form>

          <button
            type="button"
            onClick={() => switchToLogin({ prefillEmail: email.trim().toLowerCase() })}
            className="mt-6 text-sm text-primary"
          >
            Already have an account? Login
          </button>
        </div>

        <Dialog open={signupSuccessOpen} onOpenChange={setSignupSuccessOpen}>
          <DialogContent showCloseButton={false} className="max-w-sm text-center">
            <DialogHeader className="items-center">
              <CheckCircle2 className="mb-2 h-12 w-12 text-gain" />
              <DialogTitle>Account created</DialogTitle>
              <DialogDescription>
                Email verified successfully. Taking you to login…
              </DialogDescription>
            </DialogHeader>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6">
        <div className="mb-6 flex items-center justify-between">
          <GrowwLogo size={32} />
        </div>

        <h1 className="mb-6 text-2xl font-semibold text-foreground">
          {mode === 'login' ? 'Welcome back' : 'Create account'}
        </h1>

        <p className="mb-4 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          Access is invite-only. Kindly contact{' '}
          <a
            href="https://t.me/optixadmin"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-primary underline"
          >
            @optixadmin
          </a>{' '}
          on Telegram for access.
        </p>

        {mode === 'signup' && !signupOtpBypass && !emailOtpConfigured && (
          <p className="mb-4 rounded-lg border border-loss/30 bg-loss/5 px-3 py-2 text-sm text-loss">
            Email OTP is required but Brevo is not configured on the server. Add{' '}
            <code className="text-xs">BREVO_API_KEY</code> and{' '}
            <code className="text-xs">BREVO_FROM_EMAIL</code> to <code className="text-xs">.env.server</code> and restart{' '}
            <code className="text-xs">npm run server</code>.
          </p>
        )}

        {mode === 'signup' && !signupOtpBypass && emailOtpConfigured && (
          <p className="mb-4 text-sm text-muted-foreground">
            Step 1 of 2 — enter your details, then verify your email with a code.
          </p>
        )}

        {mode === 'login' ? (
          <form onSubmit={handleLogin} className="space-y-3">
            <input
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) clearError();
              }}
              placeholder="Email"
              type="email"
              className="h-11 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground"
              required
            />
            <div className="relative">
              <input
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) clearError();
                }}
                placeholder="Password"
                type={showPassword ? 'text' : 'password'}
                className="h-11 w-full rounded-lg border border-border bg-card py-0 pr-11 pl-3 text-sm text-foreground"
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            {errorBlock('login')}

            <button
              type="submit"
              disabled={submitting}
              className="h-11 w-full rounded-lg bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-70"
            >
              {submitting ? 'Please wait...' : 'Login'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleSignupDetails} className="space-y-3">
            <input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) clearError();
              }}
              placeholder="Full name"
              className="h-11 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground"
              required
            />
            <input
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) clearError();
              }}
              placeholder="Email"
              type="email"
              className="h-11 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground"
              required
            />
            <div className="relative">
              <input
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) clearError();
                }}
                placeholder="Password"
                type={showPassword ? 'text' : 'password'}
                className="h-11 w-full rounded-lg border border-border bg-card py-0 pr-11 pl-3 text-sm text-foreground"
                required
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            {errorBlock('signup')}

            <button
              type="submit"
              disabled={submitting || otpSending || (!signupOtpBypass && !emailOtpConfigured)}
              className="h-11 w-full rounded-lg bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-70"
            >
              {submitting || otpSending
                ? 'Please wait...'
                : signupOtpBypass
                  ? 'Create account'
                  : 'Continue to email verification'}
            </button>
          </form>
        )}

        <button
          type="button"
          onClick={() => (mode === 'login' ? switchToSignup() : switchToLogin())}
          className="mt-6 text-sm text-primary"
        >
          {mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Login'}
        </button>
      </div>

      <Dialog open={signupSuccessOpen} onOpenChange={setSignupSuccessOpen}>
        <DialogContent showCloseButton={false} className="max-w-sm text-center">
          <DialogHeader className="items-center">
            <CheckCircle2 className="mb-2 h-12 w-12 text-gain" />
            <DialogTitle>Account created</DialogTitle>
            <DialogDescription>
              Email verified successfully. Taking you to login…
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LoginPage;
