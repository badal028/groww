import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import GrowwLogo from '@/components/GrowwLogo';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

const apiBase = import.meta.env.VITE_MARKET_DATA_API_BASE || 'http://127.0.0.1:3001';

const LoginPage: React.FC = () => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const { login, signup, applyAuthToken } = useAuth();
  const googleHandledRef = useRef(false);

  const googleAuthUrl = useMemo(() => `${apiBase.replace(/\/$/, '')}/auth/google`, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get('error');
    if (!err) return;
    const map: Record<string, string> = {
      google_auth_failed: 'Google sign-in failed. Please try again.',
      invalid_state: 'Sign-in expired. Please try again.',
      oauth_not_configured: 'Google sign-in is not configured on the server.',
      access_denied: 'Google sign-in was cancelled.',
    };
    setError(map[err] ?? `Error: ${err}`);
    window.history.replaceState(null, '', window.location.pathname);
  }, []);

  useEffect(() => {
    if (googleHandledRef.current) return;
    const hash = window.location.hash;
    if (!hash.startsWith('#token=')) return;
    googleHandledRef.current = true;
    const jwt = decodeURIComponent(hash.slice('#token='.length));
    if (!jwt) return;
    void (async () => {
      const r = await applyAuthToken(jwt);
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
      if (r.ok) {
        toast.success('Signed in with Google');
        navigate('/stocks', { replace: true });
      } else {
        googleHandledRef.current = false;
        setError(r.message || 'Could not complete Google sign-in');
      }
    })();
  }, [applyAuthToken, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    const result =
      mode === 'login'
        ? await login({ email, password })
        : await signup({ name, email, password });
    setSubmitting(false);
    if (!result.ok) {
      const msg = result.message || 'Authentication failed';
      if (mode === 'signup' && /already registered/i.test(msg)) {
        setError('This email is already registered. Use Login below.');
      } else {
        setError(msg);
      }
      return;
    }
    if (mode === 'signup') {
      toast.success('Account created. Welcome!');
      navigate('/stocks');
      return;
    }
    navigate('/stocks');
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6">
        <div className="mb-6 flex items-center justify-between">
          <GrowwLogo size={32} />
          <span className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">Paper Trading</span>
        </div>

        <h1 className="mb-1 text-2xl font-semibold text-foreground">
          {mode === 'login' ? 'Welcome back' : 'Create account'}
        </h1>
        <p className="mb-6 text-sm text-muted-foreground">
          {mode === 'login'
            ? 'Login to continue paper trading'
            : 'Get ₹1,00,00,000 virtual balance on signup'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === 'signup' && (
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              className="h-11 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground"
              required
            />
          )}
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            type="email"
            className="h-11 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground"
            required
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            type="password"
            className="h-11 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground"
            required
          />

          {error && <p className="text-sm text-loss">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="h-11 w-full rounded-lg bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-70"
          >
            {submitting ? 'Please wait...' : mode === 'login' ? 'Login' : 'Create account'}
          </button>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-background px-3 text-muted-foreground">or</span>
          </div>
        </div>

        <a
          href={googleAuthUrl}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-border bg-card text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden>
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Continue with Google
        </a>

        <button
          type="button"
          onClick={() => setMode((m) => (m === 'login' ? 'signup' : 'login'))}
          className="mt-6 text-sm text-primary"
        >
          {mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Login'}
        </button>
      </div>
    </div>
  );
};

export default LoginPage;
