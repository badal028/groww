import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

type AuthUser = {
  id: string;
  name: string;
  email: string;
  walletInr: number;
  /** Cumulative realized P&L from exited paper positions (server). */
  realizedPnlInr: number;
};

type LoginPayload = { email: string; password: string };
type SignupPayload = { name: string; email: string; password: string };

type AuthContextType = {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (payload: LoginPayload) => Promise<{ ok: boolean; message?: string }>;
  signup: (payload: SignupPayload) => Promise<{ ok: boolean; message?: string }>;
  logout: () => void;
  refreshMe: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);
const TOKEN_KEY = "paper_auth_token";

const apiBase = import.meta.env.VITE_MARKET_DATA_API_BASE || "http://127.0.0.1:3001";

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [loading, setLoading] = useState(true);

  const refreshMe = useCallback(async () => {
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`${apiBase}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Session expired");
      const data = await res.json();
      const u = data.user;
      if (u && typeof u === "object") {
        setUser({
          ...u,
          walletInr: Number(u.walletInr ?? 0),
          realizedPnlInr: Number(u.realizedPnlInr ?? 0),
        });
      } else {
        setUser(null);
      }
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void refreshMe();
  }, [token, refreshMe]);

  const login = useCallback(async (payload: LoginPayload) => {
    try {
      const res = await fetch(`${apiBase}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) return { ok: false, message: data?.message || "Login failed" };

      localStorage.setItem(TOKEN_KEY, data.token);
      setToken(data.token);
      const u = data.user;
      setUser(
        u
          ? {
              ...u,
              walletInr: Number(u.walletInr ?? 0),
              realizedPnlInr: Number(u.realizedPnlInr ?? 0),
            }
          : null,
      );
      return { ok: true };
    } catch {
      return { ok: false, message: "Unable to connect backend" };
    }
  }, []);

  const signup = useCallback(async (payload: SignupPayload) => {
    try {
      const res = await fetch(`${apiBase}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) return { ok: false, message: data?.message || "Signup failed" };
      return { ok: true };
    } catch {
      return { ok: false, message: "Unable to connect backend" };
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, token, loading, login, signup, logout, refreshMe }),
    [user, token, loading, login, signup, logout, refreshMe],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
