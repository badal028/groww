import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import GrowwLogo from '@/components/GrowwLogo';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

const LoginPage: React.FC = () => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const { login, signup } = useAuth();

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
      setError(result.message || 'Authentication failed');
      return;
    }
    if (mode === 'signup') {
      setMode('login');
      setName('');
      setPassword('');
      toast.success('Registration successful. Please login.');
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

        <button
          onClick={() => setMode((m) => (m === 'login' ? 'signup' : 'login'))}
          className="mt-4 text-sm text-primary"
        >
          {mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Login'}
        </button>
      </div>
    </div>
  );
};

export default LoginPage;
