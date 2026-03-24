import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

type AuthUser = {
  id: string;
  name: string;
  email: string;
  walletInr: number;
  realWalletInr: number;
  avatarUrl?: string | null;
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
  /** After Google OAuth redirect with JWT in URL hash. */
  applyAuthToken: (jwt: string) => Promise<{ ok: boolean; message?: string }>;
  updateProfile: (payload: { name?: string; avatarUrl?: string }) => Promise<{ ok: boolean; message?: string }>;
  addRealBalance: (amount: number) => Promise<{ ok: boolean; message?: string }>;
  logout: () => void;
  refreshMe: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);
const TOKEN_KEY = "paper_auth_token";

const apiBase = import.meta.env.VITE_MARKET_DATA_API_BASE || "http://127.0.0.1:3001";

const normalizeUser = (u: any): AuthUser => ({
  ...u,
  walletInr: Number(u?.walletInr ?? 0),
  realWalletInr: Number(u?.realWalletInr ?? 0),
  realizedPnlInr: Number(u?.realizedPnlInr ?? 0),
  avatarUrl: u?.avatarUrl || null,
});

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
        setUser(normalizeUser(u));
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
      setUser(u ? normalizeUser(u) : null);
      return { ok: true };
    } catch {
      return { ok: false, message: "Unable to connect backend" };
    }
  }, []);

  const applyAuthToken = useCallback(async (jwt: string) => {
    try {
      const res = await fetch(`${apiBase}/auth/me`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      if (!res.ok) {
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setUser(null);
        return { ok: false, message: "Invalid or expired session" };
      }
      const data = await res.json();
      const u = data.user;
      localStorage.setItem(TOKEN_KEY, jwt);
      setToken(jwt);
      if (u && typeof u === "object") {
        setUser(normalizeUser(u));
      }
      return { ok: true };
    } catch {
      return { ok: false, message: "Unable to verify session" };
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
      // Server returns JWT + user on signup — log in immediately (same as login).
      if (data.token) {
        localStorage.setItem(TOKEN_KEY, data.token);
        setToken(data.token);
        const u = data.user;
        setUser(u ? normalizeUser(u) : null);
      }
      return { ok: true };
    } catch {
      return { ok: false, message: "Unable to connect backend" };
    }
  }, []);

  const updateProfile = useCallback(async (payload: { name?: string; avatarUrl?: string }) => {
    if (!token) return { ok: false, message: "Login required" };
    try {
      const res = await fetch(`${apiBase}/auth/profile`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, message: data?.message || "Profile update failed" };
      if (data?.user) setUser(normalizeUser(data.user));
      return { ok: true };
    } catch {
      return { ok: false, message: "Unable to connect backend" };
    }
  }, [token]);

  const addRealBalance = useCallback(async (amount: number) => {
    if (!token) return { ok: false, message: "Login required" };
    try {
      const res = await fetch(`${apiBase}/wallet/real/add`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ amount }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, message: data?.message || "Add money failed" };
      await refreshMe();
      return { ok: true };
    } catch {
      return { ok: false, message: "Unable to connect backend" };
    }
  }, [token, refreshMe]);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, token, loading, login, signup, applyAuthToken, updateProfile, addRealBalance, logout, refreshMe }),
    [user, token, loading, login, signup, applyAuthToken, updateProfile, addRealBalance, logout, refreshMe],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
