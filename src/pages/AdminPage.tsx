import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Trophy, RefreshCw } from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { isAdminEmail } from "@/lib/accountLabels";

const apiBase = import.meta.env.VITE_MARKET_DATA_API_BASE || "http://127.0.0.1:3001";

function formatInr(n: number): string {
  const v = Number(n || 0);
  return `${v >= 0 ? "+" : ""}₹${v.toLocaleString("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
}

function formatDateTimeIST(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function isoDateInIST(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** `datetime-local` must use the user's local calendar clock — never `iso.slice(0,16)` on UTC strings. */
function isoToDatetimeLocalInputValue(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function datetimeLocalInputToISO(localStr: string): string {
  const d = new Date(localStr);
  if (!Number.isFinite(d.getTime())) return "";
  return d.toISOString();
}

type TodaySignup = { id: string; email: string; createdAt: string };
type AdminSummary = {
  today: string;
  totalUsersCount?: number;
  signupsTodayCount: number;
  signupsToday: TodaySignup[];
  loginsTodayCount?: number;
  uniqueLoginsTodayCount?: number;
  loginsToday?: { userId: string; email: string; at: string }[];
};

type DailyLoginRow = {
  date: string;
  count: number;
  uniqueCount: number;
  logins: { userId: string; email: string; at: string }[];
};

type UserDetail = {
  id: string;
  name: string;
  email: string;
  createdAt?: string;
  lastLoginAt?: string | null;
  walletInr: number;
  realWalletInr?: number;
  realizedPnlInr: number;
  openPnlInr: number;
  totalPnlInr: number;
  hiddenFromLeaderboard?: boolean;
};

type DailySignupRow = {
  date: string;
  count: number;
  signups: { id: string; email: string; createdAt: string }[];
};

type Contest = {
  id: string;
  contestDateISO: string;
  activeContestDayISO?: string;
  entryFeeInr: number;
  minParticipants: number;
  maxParticipants: number;
  status: string;
  participants: { userId: string; joinedAt: string }[];
  prizePoolInr: { first: number; second: number; third: number };
  payouts?: { userId: string; rank: number; amountInr: number; status: string }[];
};

type AdminUserPnl = {
  id: string;
  name: string;
  email: string;
  createdAt?: string;
  walletInr: number;
  realizedPnlInr: number;
  openPnlInr: number;
  totalPnlInr: number;
  openPositionCount?: number;
};

type WithdrawalRow = {
  userId: string;
  userEmail: string;
  userName: string;
  id: string;
  amountInr: number;
  status: string;
  requestedAt: string;
};

type WinnerRow = {
  rank: number;
  userId: string;
  name: string;
  email: string;
  totalPnlInr: number;
  amountInr?: number;
  payoutStatus?: string;
};

type PaperOrder = {
  id: string;
  symbol: string;
  side: "BUY" | "SELL";
  quantity: number;
  price: number;
  orderMode?: "MARKET" | "LIMIT";
  instrumentType: "EQ" | "FO";
  optionType?: "CE" | "PE" | null;
  strike?: number | null;
  expiry?: string | null;
  product?: string;
  notional?: number;
  status?: string;
  filledAt?: string;
};

type PaperPosition = {
  instrumentKey: string;
  symbol: string;
  instrumentType: string;
  optionType: "CE" | "PE" | null;
  strike: number | null;
  expiry: string | null;
  quantity: number;
  avgPrice: number;
  exited?: boolean;
  exitedAt?: string;
  openedAt?: string;
  lastTradedAt?: string;
  realizedPnlInr?: number;
  mktPrice?: number | null;
  pnlInr?: number | null;
};

export default function AdminPage() {
  const { user, token, loading: authLoading } = useAuth();
  const isAdmin = useMemo(() => isAdminEmail(user?.email), [user?.email]);

  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [dailyRows, setDailyRows] = useState<DailySignupRow[]>([]);
  const [loginDailyRows, setLoginDailyRows] = useState<DailyLoginRow[]>([]);
  const [users, setUsers] = useState<AdminUserPnl[]>([]);
  const [contest, setContest] = useState<Contest | null>(null);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRow[]>([]);
  const [dailyWinners, setDailyWinners] = useState<{ prizeTop3: WinnerRow[]; practiceTop3: WinnerRow[]; prizeFinalized: boolean }>({
    prizeTop3: [],
    practiceTop3: [],
    prizeFinalized: false,
  });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [orders, setOrders] = useState<PaperOrder[]>([]);
  const [positions, setPositions] = useState<PaperPosition[]>([]);
  const [userDetail, setUserDetail] = useState<UserDetail | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [adminTab, setAdminTab] = useState<"dashboard" | "signups" | "users" | "settings">("dashboard");
  const [userSearch, setUserSearch] = useState("");
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  const [signupRange, setSignupRange] = useState<"today" | "14days">("today");
  const [marketBanner, setMarketBanner] = useState<{ enabled: boolean; closedOn: string; opensAt: string }>({
    enabled: false,
    closedOn: "",
    opensAt: "",
  });
  const [contestOffer, setContestOffer] = useState<{
    enabled: boolean;
    label: string;
    originalFeeInr: number;
    promoFeeInr: number;
    seatLimit: number;
    endsAtISO: string;
  }>({
    enabled: false,
    label: "Weekend offer",
    originalFeeInr: 79,
    promoFeeInr: 19,
    seatLimit: 250,
    endsAtISO: "",
  });
  const [seedDummyCount, setSeedDummyCount] = useState("250");
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserWallet, setNewUserWallet] = useState("1000000");
  const [creatingUser, setCreatingUser] = useState(false);

  const authHeaders = useMemo(() => {
    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
  }, [token]);

  const refreshAdminListsAfterContestChange = useCallback(async () => {
    const [sRes, dRes, lRes, uRes, cRes] = await Promise.all([
      fetch(`${apiBase}/admin/summary/today`, { headers: authHeaders }),
      fetch(`${apiBase}/admin/signups/daily?days=14`, { headers: authHeaders }),
      fetch(`${apiBase}/admin/logins/daily?days=14`, { headers: authHeaders }),
      fetch(`${apiBase}/admin/users/pnl`, { headers: authHeaders }),
      fetch(`${apiBase}/admin/contest/current`, { headers: authHeaders }),
    ]);
    if (sRes.ok) {
      const sData = await sRes.json().catch(() => null);
      if (sData) setSummary(sData);
    }
    if (dRes.ok) {
      const dData = await dRes.json().catch(() => null);
      if (dData?.rows) setDailyRows(dData.rows);
    }
    if (lRes.ok) {
      const lData = await lRes.json().catch(() => null);
      if (lData?.rows) setLoginDailyRows(lData.rows);
    }
    if (uRes.ok) {
      const uData = await uRes.json().catch(() => null);
      if (uData?.users) setUsers(uData.users);
    }
    if (cRes.ok) {
      const cData = await cRes.json().catch(() => null);
      if (cData?.contest) setContest(cData.contest);
    }
    setLastRefreshedAt(new Date());
  }, [authHeaders]);

  const usersByProfit = useMemo(
    () => [...users].sort((a, b) => Number(b.totalPnlInr || 0) - Number(a.totalPnlInr || 0)),
    [users],
  );

  const visibleUsersByProfit = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    let list = usersByProfit;
    if (q) {
      list = list.filter((u) => u.email.toLowerCase().includes(q) || u.name.toLowerCase().includes(q));
    }
    return [...list].sort((a, b) => {
      const openA = Number(a.openPositionCount ?? 0);
      const openB = Number(b.openPositionCount ?? 0);
      if (openB !== openA) return openB - openA;
      return Number(b.totalPnlInr || 0) - Number(a.totalPnlInr || 0);
    });
  }, [usersByProfit, userSearch]);

  const openPositions = useMemo(() => positions.filter((p) => !p.exited), [positions]);
  const pastPositions = useMemo(() => positions.filter((p) => p.exited), [positions]);
  const sortedOrders = useMemo(
    () => [...orders].sort((a, b) => Date.parse(b.filledAt || "") - Date.parse(a.filledAt || "")),
    [orders],
  );

  const signupChartData = useMemo(
    () => dailyRows.map((r) => ({ date: r.date.slice(5), signups: r.count })),
    [dailyRows],
  );

  const loginChartData = useMemo(
    () => loginDailyRows.map((r) => ({ date: r.date.slice(5), logins: r.count, unique: r.uniqueCount })),
    [loginDailyRows],
  );

  const deleteUserById = useCallback(
    async (userId: string) => {
      const target = users.find((u) => u.id === userId);
      const ok = window.confirm(`Delete ${target?.email || "this user"}? This cannot be undone.`);
      if (!ok) return;
      const res = await fetch(`${apiBase}/admin/users/delete`, {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: [userId] }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(d?.message || "Delete user failed");
        return;
      }
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      if (selectedUserId === userId) {
        setSelectedUserId(visibleUsersByProfit.find((u) => u.id !== userId)?.id || null);
        setUserDetail(null);
        setPositions([]);
        setOrders([]);
      }
      toast.success("User deleted");
    },
    [authHeaders, users, selectedUserId, visibleUsersByProfit],
  );
  const hasLoadedData = Boolean(summary || dailyRows.length || users.length || contest || withdrawals.length);

  useEffect(() => {
    if (!token) return;
    if (!isAdmin) {
      setErr("Not authorized");
      setLoading(false);
      return;
    }

    let cancelled = false;
    const run = async () => {
      try {
        setLoading((prev) => (hasLoadedData ? prev : true));
        setErr(null);
        const [sRes, dRes, lRes, uRes, cRes, wRes, bRes, offerRes, winRes] = await Promise.all([
          fetch(`${apiBase}/admin/summary/today`, { headers: authHeaders }),
          fetch(`${apiBase}/admin/signups/daily?days=14`, { headers: authHeaders }),
          fetch(`${apiBase}/admin/logins/daily?days=14`, { headers: authHeaders }),
          fetch(`${apiBase}/admin/users/pnl`, { headers: authHeaders }),
          fetch(`${apiBase}/admin/contest/current`, { headers: authHeaders }),
          fetch(`${apiBase}/admin/withdrawals`, { headers: authHeaders }),
          fetch(`${apiBase}/admin/market-banner`, { headers: authHeaders }),
          fetch(`${apiBase}/admin/contest/offer`, { headers: authHeaders }),
          fetch(`${apiBase}/admin/contest/winners`, { headers: authHeaders }),
        ]);

        if (!sRes.ok) throw new Error(await sRes.text().catch(() => "Summary fetch failed"));
        if (!dRes.ok) throw new Error(await dRes.text().catch(() => "Daily signups fetch failed"));
        if (!lRes.ok) throw new Error(await lRes.text().catch(() => "Daily logins fetch failed"));
        if (!uRes.ok) throw new Error(await uRes.text().catch(() => "Users fetch failed"));
        if (!cRes.ok) throw new Error(await cRes.text().catch(() => "Contest fetch failed"));
        if (!wRes.ok) throw new Error(await wRes.text().catch(() => "Withdrawals fetch failed"));
        if (!bRes.ok) throw new Error(await bRes.text().catch(() => "Market banner fetch failed"));
        if (!offerRes.ok) throw new Error(await offerRes.text().catch(() => "Contest offer fetch failed"));
        if (!winRes.ok) throw new Error(await winRes.text().catch(() => "Winners fetch failed"));

        const sData = await sRes.json();
        const dData = await dRes.json();
        const lData = await lRes.json();
        const uData = await uRes.json();
        const cData = await cRes.json();
        const wData = await wRes.json();
        const bData = await bRes.json();
        const offerData = await offerRes.json();
        const winData = await winRes.json();

        if (cancelled) return;
        setSummary(sData?.signupsTodayCount != null ? sData : null);
        setDailyRows(Array.isArray(dData?.rows) ? dData.rows : []);
        setLoginDailyRows(Array.isArray(lData?.rows) ? lData.rows : []);
        setUsers(Array.isArray(uData?.users) ? uData.users : []);
        setContest(cData?.contest || null);
        setWithdrawals(Array.isArray(wData?.withdrawals) ? wData.withdrawals : []);
        if (bData?.marketBanner) {
          setMarketBanner({
            enabled: Boolean(bData.marketBanner.enabled),
            closedOn: String(bData.marketBanner.closedOn || ""),
            opensAt: String(bData.marketBanner.opensAt || ""),
          });
        }
        if (offerData?.contestOffer) {
          setContestOffer({
            enabled: Boolean(offerData.contestOffer.enabled),
            label: String(offerData.contestOffer.label || "Weekend offer"),
            originalFeeInr: Number(offerData.contestOffer.originalFeeInr || 79),
            promoFeeInr: Number(offerData.contestOffer.promoFeeInr || 19),
            seatLimit: Number(offerData.contestOffer.seatLimit || 250),
            endsAtISO: String(offerData.contestOffer.endsAtISO || ""),
          });
        }
        setDailyWinners({
          prizeTop3: Array.isArray(winData?.prizeTop3) ? winData.prizeTop3 : [],
          practiceTop3: Array.isArray(winData?.practiceTop3) ? winData.practiceTop3 : [],
          prizeFinalized: Boolean(winData?.prizeFinalized),
        });
        setLastRefreshedAt(new Date());
        if (!selectedUserId && Array.isArray(uData?.users) && uData.users.length > 0) {
          setSelectedUserId(uData.users[0].id);
        }
      } catch (e) {
        if (cancelled) return;
        setErr(e instanceof Error ? e.message : "Admin load failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, isAdmin, hasLoadedData]);

  useEffect(() => {
    if (!token) return;
    if (!isAdmin) return;
    if (!selectedUserId) return;

    let cancelled = false;
    const run = async () => {
      try {
        setDetailsLoading(true);
        const [dRes, oRes] = await Promise.all([
          fetch(`${apiBase}/admin/users/${selectedUserId}/detail`, { headers: authHeaders }),
          fetch(`${apiBase}/admin/users/${selectedUserId}/orders`, { headers: authHeaders }),
        ]);

        if (!dRes.ok) throw new Error(await dRes.text().catch(() => "User detail fetch failed"));

        const dData = await dRes.json();
        const oData = oRes.ok ? await oRes.json().catch(() => ({})) : {};

        if (cancelled) return;
        setUserDetail(dData?.user || null);
        setPositions(Array.isArray(dData?.positions) ? dData.positions : []);
        setOrders(Array.isArray(oData?.orders) ? oData.orders : []);
      } catch (e) {
        if (cancelled) return;
        setErr(e instanceof Error ? e.message : "Admin details failed");
      } finally {
        if (!cancelled) setDetailsLoading(false);
      }
    };

    void run();
    const timer = window.setInterval(() => {
      void run();
    }, 30000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [token, isAdmin, selectedUserId, authHeaders]);

  useEffect(() => {
    if (!token || !isAdmin) return;
    if (adminTab !== "dashboard" && adminTab !== "users") return;
    const timer = window.setInterval(() => {
      void refreshAdminListsAfterContestChange();
    }, 30000);
    return () => window.clearInterval(timer);
  }, [token, isAdmin, adminTab, refreshAdminListsAfterContestChange]);

  useEffect(() => {
    if (!isAdmin) return;
    if (!selectedUserId) return;
    if (adminTab !== "users") return;
    if (visibleUsersByProfit.some((u) => u.id === selectedUserId)) return;
    setSelectedUserId(visibleUsersByProfit[0]?.id || null);
  }, [visibleUsersByProfit, adminTab, isAdmin, selectedUserId]);

  if (!token) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Login required.
      </div>
    );
  }

  if (authLoading) {
    return <div className="p-4 text-sm text-muted-foreground">Checking access…</div>;
  }

  if (!isAdmin) {
    return <Navigate to="/stocks" replace />;
  }

  return (
    <div className="p-4 pb-24 lg:pb-8 lg:p-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-foreground">Admin</h1>
        <div className="flex items-center gap-2">
          {lastRefreshedAt ? (
            <span className="text-[11px] text-muted-foreground">
              Updated {formatDateTimeIST(lastRefreshedAt.toISOString())}
            </span>
          ) : null}
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
            onClick={() => void refreshAdminListsAfterContestChange()}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2 rounded-xl border border-border bg-card p-2">
        {(
          [
            { id: "dashboard", label: "Dashboard" },
            { id: "users", label: "Users" },
            { id: "signups", label: "Signups" },
            { id: "settings", label: "Settings" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setAdminTab(t.id)}
            className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
              adminTab === t.id ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted/50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {err && <div className="mb-4 rounded border border-loss/30 bg-loss/10 p-3 text-sm text-loss">{err}</div>}

      {adminTab === "settings" || adminTab === "users" ? (
        <div className="mb-4 rounded-xl border border-border bg-card p-4">
          <div className="text-sm font-semibold">Create user account (admin only)</div>
          <p className="mt-1 text-xs text-muted-foreground">
            Public signup stays invite-only. Create email + password + starting paper wallet here — that user can log in immediately.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <input
              className="rounded-md border border-border bg-background px-3 py-2 text-sm"
              placeholder="Full name"
              value={newUserName}
              onChange={(e) => setNewUserName(e.target.value)}
            />
            <input
              className="rounded-md border border-border bg-background px-3 py-2 text-sm"
              placeholder="Email"
              value={newUserEmail}
              onChange={(e) => setNewUserEmail(e.target.value)}
            />
            <input
              className="rounded-md border border-border bg-background px-3 py-2 text-sm"
              placeholder="Password (min 6)"
              type="text"
              value={newUserPassword}
              onChange={(e) => setNewUserPassword(e.target.value)}
            />
            <input
              className="rounded-md border border-border bg-background px-3 py-2 text-sm tabular-nums"
              placeholder="Default wallet (INR)"
              inputMode="numeric"
              value={newUserWallet}
              onChange={(e) => setNewUserWallet(e.target.value.replace(/[^\d.]/g, ""))}
            />
          </div>
          <button
            type="button"
            className="mt-3 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-60"
            disabled={creatingUser}
            onClick={async () => {
              if (!newUserName.trim() || !newUserEmail.trim() || !newUserPassword.trim()) {
                toast.error("Name, email and password are required");
                return;
              }
              const walletNum = Number(newUserWallet);
              if (!Number.isFinite(walletNum) || walletNum < 0) {
                toast.error("Enter a valid wallet amount (0 or more)");
                return;
              }
              setCreatingUser(true);
              try {
                const r = await fetch(`${apiBase}/admin/users/create`, {
                  method: "POST",
                  headers: { ...authHeaders, "Content-Type": "application/json" },
                  body: JSON.stringify({
                    name: newUserName.trim(),
                    email: newUserEmail.trim(),
                    password: newUserPassword,
                    walletInr: walletNum,
                  }),
                });
                const d = await r.json().catch(() => ({}));
                if (!r.ok) throw new Error(d?.message || "Could not create user");
                const u = d?.user;
                toast.success(
                  u?.id
                    ? `Created ${u.email} · id ${u.id} · ₹${Number(u.walletInr || 0).toLocaleString("en-IN")} — they can log in now`
                    : "User account created — they can log in now",
                );
                setNewUserName("");
                setNewUserEmail("");
                setNewUserPassword("");
                setNewUserWallet("1000000");
                await refreshAdminListsAfterContestChange();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Could not create user");
              } finally {
                setCreatingUser(false);
              }
            }}
          >
            {creatingUser ? "Creating..." : "Create user"}
          </button>
        </div>
      ) : null}

      {loading && !hasLoadedData ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : (
        <>
          {adminTab === "dashboard" ? (
            <>
              <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[
                  { label: "Total users", value: summary?.totalUsersCount ?? users.length },
                  { label: "Signups today", value: summary?.signupsTodayCount ?? 0 },
                  { label: "Logins today", value: summary?.loginsTodayCount ?? 0 },
                  { label: "Unique logins today", value: summary?.uniqueLoginsTodayCount ?? 0 },
                ].map((card) => (
                  <div key={card.label} className="rounded-xl border border-border bg-card p-4">
                    <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{card.label}</div>
                    <div className="mt-1 text-2xl font-bold tabular-nums text-foreground">{card.value}</div>
                  </div>
                ))}
              </div>

              <div className="mb-4 grid gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-border bg-card p-4">
                  <div className="text-sm font-semibold">Daily signups (14 days)</div>
                  <ChartContainer
                    config={{ signups: { label: "Signups", color: "hsl(var(--primary))" } }}
                    className="mt-3 h-[220px] w-full"
                  >
                    <BarChart data={signupChartData}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="date" tickLine={false} axisLine={false} fontSize={10} />
                      <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} fontSize={10} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="signups" fill="var(--color-signups)" radius={4} />
                    </BarChart>
                  </ChartContainer>
                </div>

                <div className="rounded-xl border border-border bg-card p-4">
                  <div className="text-sm font-semibold">Daily logins (14 days)</div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">Login events are tracked from now on.</p>
                  <ChartContainer
                    config={{
                      logins: { label: "Logins", color: "hsl(var(--primary))" },
                      unique: { label: "Unique users", color: "hsl(142 76% 36%)" },
                    }}
                    className="mt-3 h-[220px] w-full"
                  >
                    <BarChart data={loginChartData}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="date" tickLine={false} axisLine={false} fontSize={10} />
                      <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} fontSize={10} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="logins" fill="var(--color-logins)" radius={4} />
                      <Bar dataKey="unique" fill="var(--color-unique)" radius={4} />
                    </BarChart>
                  </ChartContainer>
                </div>
              </div>

              <div className="mb-4 rounded-xl border border-border bg-card p-4">
                <div className="text-sm font-semibold">Today activity</div>
                <div className="mt-3 grid gap-4 lg:grid-cols-2">
                  <div>
                    <div className="text-xs font-medium text-muted-foreground">Signups</div>
                    {summary?.signupsToday?.length ? (
                      <div className="mt-1 space-y-1 text-sm text-foreground">
                        {summary.signupsToday.map((s) => (
                          <div key={s.id}>{s.email} · {formatDateTimeIST(s.createdAt)}</div>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-1 text-sm text-muted-foreground">No signups today</div>
                    )}
                  </div>
                  <div>
                    <div className="text-xs font-medium text-muted-foreground">Logins</div>
                    {summary?.loginsToday?.length ? (
                      <div className="mt-1 max-h-40 space-y-1 overflow-auto text-sm text-foreground">
                        {summary.loginsToday.map((l, i) => (
                          <div key={`${l.userId}-${l.at}-${i}`}>{l.email} · {formatDateTimeIST(l.at)}</div>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-1 text-sm text-muted-foreground">No logins recorded today yet</div>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  className="mt-4 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
                  onClick={() => setAdminTab("users")}
                >
                  View all users
                </button>
              </div>
            </>
          ) : null}

          {(adminTab === "signups" && signupRange === "today") && (
          <div className="mb-4 rounded-xl border border-border bg-card p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Today signups</div>
            <div className="mt-1 text-lg font-bold text-foreground">
              {summary?.signupsTodayCount ?? 0} users
            </div>
            {summary?.signupsToday?.length ? (
              <div className="mt-2 text-sm text-muted-foreground">
                {summary.signupsToday.map((s) => `${s.email} (${formatDateTimeIST(s.createdAt)})`).join(", ")}
              </div>
            ) : (
              <div className="mt-2 text-sm text-muted-foreground">No signups today</div>
            )}
          </div>
          )}

          {adminTab === "settings" ? (
            <div className="mb-4 rounded-xl border border-border bg-card p-4">
              <div className="text-sm font-semibold">Market notice banner</div>
              <p className="mt-1 text-xs text-muted-foreground">
                When enabled, users see this below NIFTY/BANK NIFTY/SENSEX and above Explore / Positions tabs on Stocks.
              </p>
              <label className="mt-3 flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-border"
                  checked={marketBanner.enabled}
                  onChange={(e) => setMarketBanner((p) => ({ ...p, enabled: e.target.checked }))}
                />
                Show banner on site
              </label>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div>
                  <div className="text-[11px] font-medium text-muted-foreground">Markets closed on (text)</div>
                  <input
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    placeholder="e.g. 26 Mar"
                    value={marketBanner.closedOn}
                    onChange={(e) => setMarketBanner((p) => ({ ...p, closedOn: e.target.value }))}
                  />
                </div>
                <div>
                  <div className="text-[11px] font-medium text-muted-foreground">Will open at (text)</div>
                  <input
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    placeholder="e.g. 9:15 AM on 27 Mar"
                    value={marketBanner.opensAt}
                    onChange={(e) => setMarketBanner((p) => ({ ...p, opensAt: e.target.value }))}
                  />
                </div>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Preview:{" "}
                {marketBanner.closedOn && marketBanner.opensAt
                  ? `Please note that markets are closed on ${marketBanner.closedOn} and will open at ${marketBanner.opensAt}.`
                  : "Fill both fields for the full sentence."}
              </p>
              <button
                type="button"
                className="mt-3 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
                onClick={async () => {
                  const r = await fetch(`${apiBase}/admin/market-banner`, {
                    method: "POST",
                    headers: { ...authHeaders, "Content-Type": "application/json" },
                    body: JSON.stringify({
                      enabled: marketBanner.enabled,
                      closedOn: marketBanner.closedOn,
                      opensAt: marketBanner.opensAt,
                    }),
                  });
                  const d = await r.json().catch(() => ({}));
                  if (!r.ok) return setErr(d?.message || "Save banner failed");
                  toast.success("Market banner saved");
                  if (d?.marketBanner) {
                    setMarketBanner({
                      enabled: Boolean(d.marketBanner.enabled),
                      closedOn: String(d.marketBanner.closedOn || ""),
                      opensAt: String(d.marketBanner.opensAt || ""),
                    });
                  }
                }}
              >
                Save banner
              </button>
            </div>
          ) : null}

          {adminTab === "settings" ? (
            <div className="mb-4 rounded-xl border border-border bg-card p-4">
              <div className="text-sm font-semibold">Prize League offer</div>
              <p className="mt-1 text-xs text-muted-foreground">
                While enabled and before “Offer ends”, every user gets the discounted fee (not limited to first N joiners).
              </p>
              <label className="mt-3 flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-border"
                  checked={contestOffer.enabled}
                  onChange={(e) => setContestOffer((p) => ({ ...p, enabled: e.target.checked }))}
                />
                Enable offer checkmark + discounted fee
              </label>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <div className="text-[11px] font-medium text-muted-foreground">Offer label</div>
                  <input
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    value={contestOffer.label}
                    onChange={(e) => setContestOffer((p) => ({ ...p, label: e.target.value }))}
                    placeholder="Weekend offer"
                  />
                </div>
                <div>
                  <div className="text-[11px] font-medium text-muted-foreground">Real fee (shown crossed)</div>
                  <input
                    type="number"
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    value={contestOffer.originalFeeInr}
                    onChange={(e) => setContestOffer((p) => ({ ...p, originalFeeInr: Number(e.target.value || 79) }))}
                  />
                </div>
                <div>
                  <div className="text-[11px] font-medium text-muted-foreground">Offer fee (shown live)</div>
                  <input
                    type="number"
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    value={contestOffer.promoFeeInr}
                    onChange={(e) => setContestOffer((p) => ({ ...p, promoFeeInr: Number(e.target.value || 19) }))}
                  />
                </div>
                <div>
                  <div className="text-[11px] font-medium text-muted-foreground">Offer seats (legacy)</div>
                  <input
                    type="number"
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    value={contestOffer.seatLimit}
                    onChange={(e) => setContestOffer((p) => ({ ...p, seatLimit: Number(e.target.value || 250) }))}
                  />
                  <p className="mt-0.5 text-[10px] text-muted-foreground">Not used for pricing; promo applies to all until end time.</p>
                </div>
                <div className="sm:col-span-2">
                  <div className="text-[11px] font-medium text-muted-foreground">Offer ends at (local time)</div>
                  <input
                    type="datetime-local"
                    step={1}
                    className="mt-1 w-full max-w-md rounded-md border border-border bg-background px-3 py-2 text-sm"
                    value={contestOffer.endsAtISO ? isoToDatetimeLocalInputValue(contestOffer.endsAtISO) : ""}
                    onChange={(e) =>
                      setContestOffer((p) => ({
                        ...p,
                        endsAtISO: e.target.value ? datetimeLocalInputToISO(e.target.value) : "",
                      }))
                    }
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Picker uses your device timezone; saved value is UTC ISO for the server (e.g. end of 29 Mar → set 23:59:59).
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="mt-3 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
                onClick={async () => {
                  const r = await fetch(`${apiBase}/admin/contest/offer`, {
                    method: "POST",
                    headers: { ...authHeaders, "Content-Type": "application/json" },
                    body: JSON.stringify(contestOffer),
                  });
                  const d = await r.json().catch(() => ({}));
                  if (!r.ok) return setErr(d?.message || "Save offer failed");
                  toast.success("Contest offer saved");
                }}
              >
                Save offer
              </button>
            </div>
          ) : null}

          {adminTab === "signups" ? (
            <div className="mb-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSignupRange("today")}
                className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                  signupRange === "today"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground hover:bg-muted/50"
                }`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setSignupRange("14days")}
                className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                  signupRange === "14days"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground hover:bg-muted/50"
                }`}
              >
                Last 14 days
              </button>
            </div>
          ) : null}

          {adminTab === "signups" && signupRange === "14days" ? (
          <div className="mb-4 overflow-x-auto rounded-xl border border-border bg-card">
            <div className="border-b border-border px-4 py-3 text-sm font-semibold">Signups by date (last 14 days)</div>
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-xs text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Date (IST)</th>
                  <th className="px-4 py-2 font-medium">Count</th>
                  <th className="px-4 py-2 font-medium">Emails</th>
                </tr>
              </thead>
              <tbody>
                {dailyRows.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-3 text-muted-foreground">
                      No data
                    </td>
                  </tr>
                ) : (
                  dailyRows.map((row) => (
                    <tr key={row.date} className="border-b border-border last:border-0">
                      <td className="whitespace-nowrap px-4 py-2 tabular-nums text-foreground">{row.date}</td>
                      <td className="px-4 py-2 tabular-nums">{row.count}</td>
                      <td className="max-w-[min(100vw,28rem)] break-words px-4 py-2 text-xs text-muted-foreground">
                        {row.signups.length ? row.signups.map((s) => `${s.email} (${formatDateTimeIST(s.createdAt)})`).join(", ") : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          ) : null}

          {adminTab === "settings" && contest && (
            <div className="mb-4 rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold">Pro-League control</div>
                  <div className="text-xs text-muted-foreground">
                    {contest.activeContestDayISO || contest.contestDateISO} · {contest.status} ·{" "}
                    {contest.participants?.length || 0}/{contest.maxParticipants}
                  </div>
                </div>
                <button
                  type="button"
                  className="rounded-md border border-border px-3 py-1 text-xs"
                  onClick={async () => {
                    const r = await fetch(`${apiBase}/admin/contest/finalize`, { method: "POST", headers: authHeaders });
                    const d = await r.json().catch(() => ({}));
                    if (!r.ok) return setErr(d?.message || "Finalize failed");
                    setContest(d?.contest || null);
                  }}
                >
                  Finalize winners
                </button>
              </div>

              <div className="mt-3 flex flex-wrap items-end gap-2">
                <div className="min-w-[7rem]">
                  <div className="text-[11px] font-medium text-muted-foreground">Seed dummy count</div>
                  <input
                    type="number"
                    min={1}
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm tabular-nums"
                    value={seedDummyCount}
                    onChange={(e) => setSeedDummyCount(e.target.value)}
                    placeholder="250"
                  />
                </div>
                <button
                  type="button"
                  className="rounded bg-primary px-3 py-2 text-[11px] font-semibold text-primary-foreground disabled:opacity-50"
                  onClick={async () => {
                    const n = Math.floor(Number(seedDummyCount));
                    if (!Number.isFinite(n) || n < 1) {
                      toast.error("Enter a valid number (1 or more)");
                      return;
                    }
                    const r = await fetch(`${apiBase}/admin/contest/seed-dummy`, {
                      method: "POST",
                      headers: { ...authHeaders, "Content-Type": "application/json" },
                      body: JSON.stringify({ count: n }),
                    });
                    const d = await r.json().catch(() => ({}));
                    if (!r.ok) return setErr(d?.message || "Seed failed");
                    setContest(d?.contest || null);
                    toast.success(`Seeded ${d?.added ?? 0} dummy users`);
                    await refreshAdminListsAfterContestChange();
                  }}
                >
                  Seed users
                </button>
                <button
                  type="button"
                  className="rounded border border-loss/40 px-3 py-2 text-[11px] text-loss hover:bg-loss/10"
                  onClick={async () => {
                    const r = await fetch(`${apiBase}/admin/contest/unseed-dummy`, {
                      method: "POST",
                      headers: authHeaders,
                    });
                    const d = await r.json().catch(() => ({}));
                    if (!r.ok) return setErr(d?.message || "Unseed failed");
                    setContest(d?.contest || null);
                    toast.success(`Removed ${d?.removed ?? 0} seeded users`);
                    await refreshAdminListsAfterContestChange();
                  }}
                >
                  Unseed users
                </button>
              </div>

              {!!contest.payouts?.length && (
                <div className="mt-3 space-y-2">
                  {contest.payouts.map((p) => (
                    <div key={`${p.userId}-${p.rank}`} className="flex items-center justify-between rounded border border-border px-3 py-2 text-xs">
                      <span>Rank #{p.rank} · {p.userId.slice(0, 8)} · ₹{p.amountInr}</span>
                      {p.status === "RELEASED" ? (
                        <span className="text-profit">Released</span>
                      ) : (
                        <button
                          type="button"
                          className="rounded bg-primary px-2 py-1 text-primary-foreground"
                          onClick={async () => {
                            const r = await fetch(`${apiBase}/admin/contest/release`, {
                              method: "POST",
                              headers: { ...authHeaders, "Content-Type": "application/json" },
                              body: JSON.stringify({ userId: p.userId }),
                            });
                            const d = await r.json().catch(() => ({}));
                            if (!r.ok) return setErr(d?.message || "Release failed");
                            setContest(d?.contest || null);
                          }}
                        >
                          Release
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {adminTab === "settings" ? (
            <div className="mb-4 rounded-xl border border-border bg-card p-4">
              <div className="text-sm font-semibold">Daily winners</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Trophy icons show top 3 in both Practice and Prize leagues.
              </div>
              <div className="mt-3 grid gap-4 lg:grid-cols-2">
                <div className="rounded-lg border border-border p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Practice top 3</div>
                  <div className="mt-2 space-y-2">
                    {dailyWinners.practiceTop3.length === 0 ? (
                      <div className="text-xs text-muted-foreground">No practice winners yet.</div>
                    ) : dailyWinners.practiceTop3.map((w) => (
                      <div key={`practice-${w.userId}-${w.rank}`} className="flex items-center justify-between rounded border border-border px-2 py-1.5">
                        <div className="min-w-0">
                          <div className="truncate text-xs font-semibold text-foreground">{w.name}</div>
                          <div className="truncate text-[11px] text-muted-foreground">{w.email}</div>
                        </div>
                        <div className="flex items-center gap-1 text-xs font-semibold">
                          <Trophy className={cn("h-4 w-4", w.rank === 1 ? "text-amber-500" : w.rank === 2 ? "text-slate-400" : "text-orange-600")} />
                          <span>#{w.rank}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Prize top 3</div>
                    <span className={cn("text-[11px] font-medium", dailyWinners.prizeFinalized ? "text-profit" : "text-muted-foreground")}>
                      {dailyWinners.prizeFinalized ? "Finalized" : "Live"}
                    </span>
                  </div>
                  <div className="mt-2 space-y-2">
                    {dailyWinners.prizeTop3.length === 0 ? (
                      <div className="text-xs text-muted-foreground">No prize winners yet.</div>
                    ) : dailyWinners.prizeTop3.map((w) => (
                      <div key={`prize-${w.userId}-${w.rank}`} className="flex items-center justify-between rounded border border-border px-2 py-1.5">
                        <div className="min-w-0">
                          <div className="truncate text-xs font-semibold text-foreground">{w.name}</div>
                          <div className="truncate text-[11px] text-muted-foreground">
                            {w.email}{w.amountInr ? ` · ₹${Number(w.amountInr).toLocaleString("en-IN")}` : ""}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 text-xs font-semibold">
                          <Trophy className={cn("h-4 w-4", w.rank === 1 ? "text-amber-500" : w.rank === 2 ? "text-slate-400" : "text-orange-600")} />
                          <span>#{w.rank}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {adminTab === "settings" ? (
            <div className="mb-4 rounded-xl border border-border bg-card p-4">
              <div className="text-sm font-semibold">Withdrawal requests</div>
              <div className="mt-3 space-y-2">
                {withdrawals.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No requests</div>
                ) : withdrawals.map((w) => (
                  <div key={`${w.userId}-${w.id}`} className="flex items-center justify-between rounded border border-border px-3 py-2">
                    <div className="min-w-0">
                      <div className="truncate text-xs font-semibold text-foreground">{w.userName} · {w.userEmail}</div>
                      <div className="text-[11px] text-muted-foreground">₹{Number(w.amountInr).toFixed(2)} · {w.status}</div>
                    </div>
                    {w.status === "PENDING" ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="rounded bg-primary px-2 py-1 text-[11px] text-primary-foreground"
                          onClick={async () => {
                            const res = await fetch(`${apiBase}/admin/withdrawals/${w.userId}/${w.id}/approve`, {
                              method: "POST",
                              headers: authHeaders,
                            });
                            const d = await res.json().catch(() => ({}));
                            if (!res.ok) return setErr(d?.message || "Approve failed");
                            setWithdrawals((prev) =>
                              prev.map((x) => (x.id === w.id && x.userId === w.userId ? { ...x, status: "APPROVED" } : x)),
                            );
                          }}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          className="rounded border border-border px-2 py-1 text-[11px]"
                          onClick={async () => {
                            const res = await fetch(`${apiBase}/admin/withdrawals/${w.userId}/${w.id}/reject`, {
                              method: "POST",
                              headers: authHeaders,
                            });
                            const d = await res.json().catch(() => ({}));
                            if (!res.ok) return setErr(d?.message || "Reject failed");
                            setWithdrawals((prev) =>
                              prev.map((x) => (x.id === w.id && x.userId === w.userId ? { ...x, status: "REJECTED" } : x)),
                            );
                          }}
                        >
                          Reject
                        </button>
                      </div>
                    ) : (
                      <span className={cn("text-xs font-medium", w.status === "APPROVED" ? "text-profit" : "text-muted-foreground")}>
                        {w.status}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {adminTab === "users" ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <div className="rounded-xl border border-border bg-card p-3">
                <div className="text-sm font-semibold">Users ({visibleUsersByProfit.length})</div>
                <p className="mt-0.5 text-[11px] text-muted-foreground">Users with open positions appear first.</p>
                <input
                  className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  placeholder="Search email or name"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                />
                <div className="mt-2 max-h-[70vh] overflow-auto">
                  {visibleUsersByProfit.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => setSelectedUserId(u.id)}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2.5 text-left transition-colors",
                        selectedUserId === u.id ? "bg-muted" : "hover:bg-muted/40",
                      )}
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-foreground">{u.email}</div>
                        <div className="truncate text-xs text-muted-foreground">{u.name}</div>
                        {Number(u.openPositionCount) > 0 ? (
                          <div className="mt-0.5 text-[11px] font-medium text-primary">
                            {u.openPositionCount} open position{Number(u.openPositionCount) > 1 ? "s" : ""}
                          </div>
                        ) : null}
                      </div>
                      <div
                        className={cn(
                          "shrink-0 text-xs font-semibold tabular-nums",
                          u.totalPnlInr >= 0 ? "text-profit" : "text-loss",
                        )}
                      >
                        {formatInr(u.totalPnlInr)}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="lg:col-span-8">
              <div className="rounded-xl border border-border bg-card p-4">
                {!userDetail ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">Select a user</div>
                ) : (
                  <>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-base font-semibold text-foreground">{userDetail.email}</div>
                        <div className="text-sm text-muted-foreground">{userDetail.name}</div>
                        <div className="mt-2 flex flex-wrap gap-3 text-sm">
                          <span>Wallet ₹{Number(userDetail.walletInr).toLocaleString("en-IN")}</span>
                          <span className={cn("font-semibold", userDetail.totalPnlInr >= 0 ? "text-profit" : "text-loss")}>
                            P&L {formatInr(userDetail.totalPnlInr)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {detailsLoading ? <span className="text-xs text-muted-foreground">Updating…</span> : null}
                        <button
                          type="button"
                          className="rounded-md bg-loss px-3 py-1.5 text-xs font-semibold text-white"
                          onClick={() => void deleteUserById(userDetail.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    <div className="mt-5">
                      <div className="text-sm font-semibold text-foreground">
                        Open positions {openPositions.length ? `(${openPositions.length})` : ""}
                      </div>
                      <div className="mt-2 space-y-2">
                        {openPositions.length === 0 ? (
                          <div className="rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
                            No open positions
                          </div>
                        ) : (
                          openPositions.map((p) => (
                            <div key={p.instrumentKey} className="rounded-lg border border-border bg-background px-3 py-2.5">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="text-sm font-semibold text-foreground">
                                    {p.symbol}
                                    {p.instrumentType === "FO" && p.optionType ? ` ${p.optionType} ${p.strike}` : ""}
                                  </div>
                                  <div className="mt-1 text-xs text-muted-foreground">
                                    Buy {Math.round(p.quantity)} @ ₹{Number(p.avgPrice).toFixed(2)}
                                    {p.mktPrice != null ? ` · Mkt ₹${Number(p.mktPrice).toFixed(2)}` : ""}
                                  </div>
                                </div>
                                {p.pnlInr != null ? (
                                  <div className={cn("shrink-0 text-sm font-semibold tabular-nums", p.pnlInr >= 0 ? "text-profit" : "text-loss")}>
                                    {formatInr(p.pnlInr)}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="mt-5">
                      <div className="text-sm font-semibold text-foreground">
                        Past positions {pastPositions.length ? `(${pastPositions.length})` : ""}
                      </div>
                      <div className="mt-2 space-y-2">
                        {pastPositions.length === 0 ? (
                          <div className="rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
                            No closed positions
                          </div>
                        ) : (
                          pastPositions.map((p) => (
                            <div key={p.instrumentKey} className="rounded-lg border border-border bg-background px-3 py-2.5">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="text-sm font-semibold text-foreground">
                                    {p.symbol}
                                    {p.instrumentType === "FO" && p.optionType ? ` ${p.optionType} ${p.strike}` : ""}
                                  </div>
                                  <div className="mt-1 text-xs text-muted-foreground">
                                    Bought {Math.round(p.quantity)} @ ₹{Number(p.avgPrice).toFixed(2)}
                                    {p.exitedAt ? ` · Closed ${formatDateTimeIST(p.exitedAt)}` : ""}
                                  </div>
                                </div>
                                {p.pnlInr != null ? (
                                  <div className={cn("shrink-0 text-sm font-semibold tabular-nums", p.pnlInr >= 0 ? "text-profit" : "text-loss")}>
                                    {formatInr(p.pnlInr)}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="mt-5">
                      <div className="text-sm font-semibold text-foreground">
                        Trades {sortedOrders.length ? `(${sortedOrders.length})` : ""}
                      </div>
                      <div className="mt-2 max-h-[36vh] space-y-2 overflow-auto">
                        {sortedOrders.length === 0 ? (
                          <div className="rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
                            No trades yet
                          </div>
                        ) : (
                          sortedOrders.map((o) => (
                            <div key={o.id} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2">
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-foreground">
                                  {o.side} · {o.symbol}
                                  {o.instrumentType === "FO" && o.optionType ? ` ${o.optionType} ${o.strike}` : ""}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  Qty {o.quantity} @ ₹{Number(o.price).toFixed(2)}
                                  {o.filledAt ? ` · ${formatDateTimeIST(o.filledAt)}` : ""}
                                </div>
                              </div>
                              <span className={cn("shrink-0 text-xs font-bold", o.side === "BUY" ? "text-profit" : "text-loss")}>
                                {o.side}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
          ) : null}
        </>
      )}
    </div>
  );
}

