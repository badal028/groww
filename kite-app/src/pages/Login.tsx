import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { IconEye, IconEyeOff, KiteLogo } from "@/components/Icons";
import { useApp } from "@/state/AppContext";

export default function Login() {
  const { login } = useApp();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError(!email.trim() ? "User ID should be minimum 6 characters." : "Password should be minimum 6 characters.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await login(email.trim(), password);
      nav("/watchlist", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={submit} noValidate>
        <div className="login-logo">
          <KiteLogo size={46} />
        </div>
        <h2 className="login-title">Login to Kite</h2>

        <div className="login-field">
          <input
            className="login-input"
            type="text"
            inputMode="email"
            autoComplete="username"
            autoCapitalize="none"
            placeholder="Phone number or User ID"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="login-field">
          <input
            className="login-input"
            type={show ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button type="button" className="login-eye" onClick={() => setShow((s) => !s)} aria-label="Toggle password">
            {show ? <IconEyeOff size={18} /> : <IconEye size={18} />}
          </button>
        </div>

        {error && <div className="login-error">{error}</div>}

        <button type="submit" className="login-btn" disabled={busy}>
          {busy ? <span className="spinner small" /> : "Login"}
        </button>

        <div className="login-forgot">Forgot user ID or password?</div>
      </form>

      <div className="login-footer">
        <div className="login-zerodha">ZERODHA</div>
        <p>Paper trading interface for practice only. No real orders are placed.</p>
      </div>
    </div>
  );
}
