import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api, getToken, setToken } from "@/lib/api";
import { closeMarketSocket } from "@/lib/market";
import type { Instrument, Order, Position, Profile, User } from "@/lib/types";

type Toast = { id: number; kind: "snack" | "error"; text: string };
type Groups = Record<number, Instrument[]>;

type Ctx = {
  ready: boolean;
  user: User | null;
  profile: Profile | null;
  positions: Position[];
  orders: Order[];
  groups: Groups;
  activeGroup: number;
  setActiveGroup: (g: number) => void;
  instruments: Record<string, Instrument>;
  ordersDot: "green" | "red" | null;
  setOrdersDot: (d: "green" | "red" | null) => void;
  privacy: boolean;
  setPrivacy: (v: boolean) => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  refreshPositions: () => Promise<void>;
  refreshOrders: () => Promise<void>;
  addToWatchlist: (inst: Instrument) => void;
  removeFromWatchlist: (key: string) => void;
  rememberInstruments: (list: Instrument[]) => void;
  resolveInstruments: (keys: string[]) => void;
  toast: (text: string, kind?: Toast["kind"]) => void;
  toasts: Toast[];
};

const AppCtx = createContext<Ctx | null>(null);

const emptyGroups = (): Groups => ({ 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] });

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [groups, setGroups] = useState<Groups>(emptyGroups);
  const [activeGroup, setActiveGroupState] = useState<number>(() => Number(localStorage.getItem("pro_wl_group")) || 1);
  const [instruments, setInstruments] = useState<Record<string, Instrument>>({});
  const [ordersDot, setOrdersDotState] = useState<"green" | "red" | null>(
    () => (localStorage.getItem("pro_orders_dot") as "green" | "red" | null) || null,
  );
  const [privacy, setPrivacyState] = useState(() => localStorage.getItem("pro_privacy") === "1");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);
  const pendingResolve = useRef(new Set<string>());
  const groupsRef = useRef(groups);
  groupsRef.current = groups;
  const instRef = useRef(instruments);
  instRef.current = instruments;

  const toast = useCallback((text: string, kind: Toast["kind"] = "snack") => {
    const id = ++toastId.current;
    setToasts((t) => [...t.filter((x) => x.kind !== kind), { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === "error" ? 4000 : 2500);
  }, []);

  const rememberInstruments = useCallback((list: Instrument[]) => {
    if (!list.length) return;
    setInstruments((prev) => {
      const next = { ...prev };
      for (const i of list) next[i.key] = i;
      return next;
    });
  }, []);

  const resolveInstruments = useCallback(
    (keys: string[]) => {
      const missing = keys.filter((k) => k && !instRef.current[k] && !pendingResolve.current.has(k));
      if (!missing.length) return;
      missing.forEach((k) => pendingResolve.current.add(k));
      api<{ instruments: Record<string, Instrument> }>(`/kite-app/instruments?keys=${encodeURIComponent(missing.join(","))}`)
        .then((r) => rememberInstruments(Object.values(r.instruments || {})))
        .catch(() => missing.forEach((k) => pendingResolve.current.delete(k)));
    },
    [rememberInstruments],
  );

  const refreshUser = useCallback(async () => {
    const r = await api<{ user: User }>("/auth/me");
    setUser(r.user);
  }, []);

  const refreshPositions = useCallback(async () => {
    const r = await api<{ positions: Position[] }>("/paper/positions");
    setPositions(Array.isArray(r.positions) ? r.positions : []);
  }, []);

  const refreshOrders = useCallback(async () => {
    const r = await api<{ orders: Order[] }>("/paper/orders");
    setOrders(Array.isArray(r.orders) ? r.orders : []);
  }, []);

  const loadAll = useCallback(async () => {
    const [me, prof, wl] = await Promise.all([
      api<{ user: User }>("/auth/me"),
      api<{ profile: Profile }>("/kite-app/profile").catch(() => null),
      api<{ groups: Groups }>("/kite-app/watchlists").catch(() => null),
    ]);
    setUser(me.user);
    if (prof) setProfile(prof.profile);
    if (wl?.groups) {
      const g = emptyGroups();
      for (let i = 1; i <= 7; i++) g[i] = Array.isArray(wl.groups[i]) ? wl.groups[i] : [];
      setGroups(g);
      rememberInstruments(Object.values(g).flat());
    }
    void refreshPositions().catch(() => undefined);
    void refreshOrders().catch(() => undefined);
  }, [refreshOrders, refreshPositions, rememberInstruments]);

  const logout = useCallback(() => {
    setToken(null);
    closeMarketSocket();
    setUser(null);
    setProfile(null);
    setPositions([]);
    setOrders([]);
    setGroups(emptyGroups());
  }, []);

  useEffect(() => {
    if (!getToken()) {
      setReady(true);
      return;
    }
    loadAll()
      .catch(() => logout())
      .finally(() => setReady(true));
  }, [loadAll, logout]);

  useEffect(() => {
    const onExpired = () => logout();
    window.addEventListener("pro-auth-expired", onExpired);
    return () => window.removeEventListener("pro-auth-expired", onExpired);
  }, [logout]);

  const login = useCallback(
    async (email: string, password: string) => {
      const r = await api<{ token: string; user: User }>("/auth/login", { method: "POST", json: { email, password } });
      setToken(r.token);
      await loadAll();
    },
    [loadAll],
  );

  const saveGroup = useCallback((g: number, list: Instrument[]) => {
    void api(`/kite-app/watchlists/${g}`, { method: "PUT", json: { keys: list.map((i) => i.key) } }).catch(() => undefined);
  }, []);

  const addToWatchlist = useCallback(
    (inst: Instrument) => {
      const g = activeGroup;
      const cur = groupsRef.current[g] || [];
      if (cur.some((i) => i.key === inst.key) || cur.length >= 250) return;
      const list = [...cur, inst];
      setGroups((prev) => ({ ...prev, [g]: list }));
      rememberInstruments([inst]);
      saveGroup(g, list);
    },
    [activeGroup, rememberInstruments, saveGroup],
  );

  const removeFromWatchlist = useCallback(
    (key: string) => {
      const g = activeGroup;
      const list = (groupsRef.current[g] || []).filter((i) => i.key !== key);
      setGroups((prev) => ({ ...prev, [g]: list }));
      saveGroup(g, list);
    },
    [activeGroup, saveGroup],
  );

  const setActiveGroup = useCallback((g: number) => {
    setActiveGroupState(g);
    localStorage.setItem("pro_wl_group", String(g));
  }, []);

  const setOrdersDot = useCallback((d: "green" | "red" | null) => {
    setOrdersDotState(d);
    if (d) localStorage.setItem("pro_orders_dot", d);
    else localStorage.removeItem("pro_orders_dot");
  }, []);

  const setPrivacy = useCallback((v: boolean) => {
    setPrivacyState(v);
    localStorage.setItem("pro_privacy", v ? "1" : "0");
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      ready,
      user,
      profile,
      positions,
      orders,
      groups,
      activeGroup,
      setActiveGroup,
      instruments,
      ordersDot,
      setOrdersDot,
      privacy,
      setPrivacy,
      login,
      logout,
      refreshUser,
      refreshPositions,
      refreshOrders,
      addToWatchlist,
      removeFromWatchlist,
      rememberInstruments,
      resolveInstruments,
      toast,
      toasts,
    }),
    [
      ready,
      user,
      profile,
      positions,
      orders,
      groups,
      activeGroup,
      setActiveGroup,
      instruments,
      ordersDot,
      setOrdersDot,
      privacy,
      setPrivacy,
      login,
      logout,
      refreshUser,
      refreshPositions,
      refreshOrders,
      addToWatchlist,
      removeFromWatchlist,
      rememberInstruments,
      resolveInstruments,
      toast,
      toasts,
    ],
  );

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp() {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp outside provider");
  return c;
}
