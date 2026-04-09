import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import GrowwLogo from '@/components/GrowwLogo';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { isAdminEmail, isSignupAllowedEmail } from '@/lib/accountLabels';

const LoginPage: React.FC = () => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const { login, signup } = useAuth();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get('error');
    if (!err) return;
    const map: Record<string, string> = {
      google_auth_failed: 'Google sign-in failed. Please try again.',
      invalid_state: 'Sign-in expired. Please try again.',
      oauth_not_configured: 'Google sign-in is not configured on the server.',
      access_denied: 'Google sign-in was cancelled.',
      signup_closed:
        'New Google accounts are not open for this email. Use Login if you already have an account, or an authorized test email.',
    };
    setError(map[err] ?? `Error: ${err}`);
    window.history.replaceState(null, '', window.location.pathname);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (mode === 'signup' && !isSignupAllowedEmail(email)) {
      setError('Registration is closed.');
      return;
    }
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
      const u = result.user;
      navigate(u && isAdminEmail(u.email) ? '/admin' : '/stocks');
      return;
    }
    const u = result.user;
    navigate(u && isAdminEmail(u.email) ? '/admin' : '/stocks');
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6">
        <div className="mb-6 flex items-center justify-between">
          <GrowwLogo size={32} />
        </div>

        <h1 className="mb-1 text-2xl font-semibold text-foreground">
          {mode === 'login' ? 'Welcome back' : 'Create account'}
        </h1>
        <p className="mb-6 text-sm text-muted-foreground">
          {mode === 'login'
            ? 'Login to continue earning'
            : 'New sign-ups are limited. Please contact support for application access on instagram @optixtrade'}
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
