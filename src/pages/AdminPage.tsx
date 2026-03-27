import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Trophy } from "lucide-react";

const apiBase = import.meta.env.VITE_MARKET_DATA_API_BASE || "http://127.0.0.1:3001";
const adminEmail = String(import.meta.env.VITE_ADMIN_EMAIL || "pbadal392@gmail.com").trim().toLowerCase();

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

type TodaySignup = { id: string; email: string; createdAt: string };
type AdminSummary = { today: string; signupsTodayCount: number; signupsToday: TodaySignup[] };

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
  realWalletInr?: number;
  realizedPnlInr: number;
  openPnlInr: number;
  totalPnlInr: number;
  hiddenFromLeaderboard?: boolean;
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
  kiteSymbol?: string;
};

export default function AdminPage() {
  const { user, token, loading: authLoading } = useAuth();
  const isAdmin = useMemo(() => {
    if (!adminEmail) return false;
    return String(user?.email || "").trim().toLowerCase() === adminEmail;
  }, [user?.email]);

  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [dailyRows, setDailyRows] = useState<DailySignupRow[]>([]);
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
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [adminTab, setAdminTab] = useState<"overview" | "signups" | "users">("overview");
  const [signupRange, setSignupRange] = useState<"today" | "14days">("today");
  const [userRange, setUserRange] = useState<"all" | "today">("all");
  const [detailsRange, setDetailsRange] = useState<"today" | "7d" | "14d" | "1m" | "1y">("today");
  const [marketBanner, setMarketBanner] = useState<{ enabled: boolean; closedOn: string; opensAt: string }>({
    enabled: false,
    closedOn: "",
    opensAt: "",
  });

  const authHeaders = useMemo(() => {
    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
  }, [token]);
  const usersByProfit = useMemo(
    () => [...users].sort((a, b) => Number(b.totalPnlInr || 0) - Number(a.totalPnlInr || 0)),
    [users],
  );

  const istTodayISO = isoDateInIST(new Date().toISOString());
  const visibleUsersByProfit = useMemo(() => {
    if (userRange === "today") {
      return usersByProfit.filter((u) => isoDateInIST(u.createdAt) === istTodayISO);
    }
    return usersByProfit;
  }, [userRange, usersByProfit, istTodayISO]);

  const contestJoinedAtByUserId = useMemo(() => {
    const m = new Map<string, string>();
    const parts = contest?.participants || [];
    for (const p of parts) {
      if (p.userId) m.set(String(p.userId), p.joinedAt);
    }
    return m;
  }, [contest]);

  const ordersFiltered = useMemo(() => {
    const now = Date.now();
    const startMs = (() => {
      if (detailsRange === "7d") return now - 7 * 86400000;
      if (detailsRange === "14d") return now - 14 * 86400000;
      if (detailsRange === "1m") return now - 30 * 86400000;
      if (detailsRange === "1y") return now - 365 * 86400000;
      return 0;
    })();

    if (detailsRange === "today") {
      return orders.filter((o) => {
        const ts = o.filledAt || (o as any).createdAt || (o as any).updatedAt;
        return isoDateInIST(ts) === istTodayISO;
      });
    }

    return orders.filter((o) => {
      const ts = o.filledAt || (o as any).createdAt || (o as any).updatedAt;
      const t = Date.parse(ts || "");
      return Number.isFinite(t) && t >= startMs && t <= now;
    });
  }, [orders, detailsRange, istTodayISO]);

  const positionsFiltered = useMemo(() => {
    const now = Date.now();
    const startMs = (() => {
      if (detailsRange === "7d") return now - 7 * 86400000;
      if (detailsRange === "14d") return now - 14 * 86400000;
      if (detailsRange === "1m") return now - 30 * 86400000;
      if (detailsRange === "1y") return now - 365 * 86400000;
      return 0;
    })();

    if (detailsRange === "today") {
      return positions.filter((p) => {
        const ts = p.exited ? p.exitedAt : (p.lastTradedAt || p.openedAt || (p as any).createdAt);
        return isoDateInIST(ts) === istTodayISO;
      });
    }

    return positions.filter((p) => {
      const ts = p.exited ? p.exitedAt : (p.lastTradedAt || p.openedAt || (p as any).createdAt);
      const t = Date.parse(ts || "");
      return Number.isFinite(t) && t >= startMs && t <= now;
    });
  }, [positions, detailsRange, istTodayISO]);

  const toggleUserSelect = useCallback((userId: string) => {
    setSelectedUserIds((prev) => (prev.includes(userId) ? prev.filter((x) => x !== userId) : [...prev, userId]));
  }, []);
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
        const [sRes, dRes, uRes, cRes, wRes, bRes, winRes] = await Promise.all([
          fetch(`${apiBase}/admin/summary/today`, { headers: authHeaders }),
          fetch(`${apiBase}/admin/signups/daily?days=14`, { headers: authHeaders }),
          fetch(`${apiBase}/admin/users/pnl`, { headers: authHeaders }),
          fetch(`${apiBase}/admin/contest/current`, { headers: authHeaders }),
          fetch(`${apiBase}/admin/withdrawals`, { headers: authHeaders }),
          fetch(`${apiBase}/admin/market-banner`, { headers: authHeaders }),
          fetch(`${apiBase}/admin/contest/winners`, { headers: authHeaders }),
        ]);

        if (!sRes.ok) throw new Error(await sRes.text().catch(() => "Summary fetch failed"));
        if (!dRes.ok) throw new Error(await dRes.text().catch(() => "Daily signups fetch failed"));
        if (!uRes.ok) throw new Error(await uRes.text().catch(() => "Users fetch failed"));
        if (!cRes.ok) throw new Error(await cRes.text().catch(() => "Contest fetch failed"));
        if (!wRes.ok) throw new Error(await wRes.text().catch(() => "Withdrawals fetch failed"));
        if (!bRes.ok) throw new Error(await bRes.text().catch(() => "Market banner fetch failed"));
        if (!winRes.ok) throw new Error(await winRes.text().catch(() => "Winners fetch failed"));

        const sData = await sRes.json();
        const dData = await dRes.json();
        const uData = await uRes.json();
        const cData = await cRes.json();
        const wData = await wRes.json();
        const bData = await bRes.json();
        const winData = await winRes.json();

        if (cancelled) return;
        setSummary(sData?.signupsTodayCount != null ? sData : null);
        setDailyRows(Array.isArray(dData?.rows) ? dData.rows : []);
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
        setDailyWinners({
          prizeTop3: Array.isArray(winData?.prizeTop3) ? winData.prizeTop3 : [],
          practiceTop3: Array.isArray(winData?.practiceTop3) ? winData.practiceTop3 : [],
          prizeFinalized: Boolean(winData?.prizeFinalized),
        });
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
        const [oRes, pRes] = await Promise.all([
          fetch(`${apiBase}/admin/users/${selectedUserId}/orders`, { headers: authHeaders }),
          fetch(`${apiBase}/admin/users/${selectedUserId}/positions`, { headers: authHeaders }),
        ]);

        if (!oRes.ok) throw new Error(await oRes.text().catch(() => "Orders fetch failed"));
        if (!pRes.ok) throw new Error(await pRes.text().catch(() => "Positions fetch failed"));

        const oData = await oRes.json();
        const pData = await pRes.json();

        if (cancelled) return;
        setOrders(Array.isArray(oData?.orders) ? oData.orders : []);
        setPositions(Array.isArray(pData?.positions) ? pData.positions : []);
      } catch (e) {
        if (cancelled) return;
        setErr(e instanceof Error ? e.message : "Admin details failed");
      } finally {
        if (!cancelled) setDetailsLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [token, isAdmin, selectedUserId, authHeaders]);

  useEffect(() => {
    if (!isAdmin) return;
    if (!selectedUserId) return;
    if (adminTab !== "users") return;
    if (visibleUsersByProfit.some((u) => u.id === selectedUserId)) return;
    const next = visibleUsersByProfit[0]?.id || null;
    setSelectedUserId(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userRange, visibleUsersByProfit, adminTab]);

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
    <div className="p-4 lg:p-8">
      <h1 className="mb-4 text-xl font-semibold text-foreground">Admin</h1>

      <div className="mb-4 flex flex-wrap gap-2 rounded-xl border border-border bg-card p-2">
        {(
          [
            { id: "overview", label: "Overview" },
            { id: "signups", label: "Signups" },
            { id: "users", label: "Users" },
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

      {loading && !hasLoadedData ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : (
        <>
          {(adminTab === "overview" || (adminTab === "signups" && signupRange === "today")) && (
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

          {adminTab === "overview" ? (
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

          {adminTab === "overview" && contest && (
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

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded bg-primary px-3 py-1 text-[11px] text-primary-foreground disabled:opacity-50"
                  onClick={async () => {
                    const r = await fetch(`${apiBase}/admin/contest/seed-dummy`, {
                      method: "POST",
                      headers: { ...authHeaders, "Content-Type": "application/json" },
                      body: JSON.stringify({ count: 250 }),
                    });
                    const d = await r.json().catch(() => ({}));
                    if (!r.ok) return setErr(d?.message || "Seed failed");
                    setContest(d?.contest || null);
                    toast.success(`Seeded ${d?.added ?? 0} dummy users`);
                    // Refresh signups + users so admin counters update too.
                    const [sRes, dRes, uRes, cRes] = await Promise.all([
                      fetch(`${apiBase}/admin/summary/today`, { headers: authHeaders }),
                      fetch(`${apiBase}/admin/signups/daily?days=14`, { headers: authHeaders }),
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
                    if (uRes.ok) {
                      const uData = await uRes.json().catch(() => null);
                      if (uData?.users) setUsers(uData.users);
                    }
                    if (cRes.ok) {
                      const cData = await cRes.json().catch(() => null);
                      if (cData?.contest) setContest(cData.contest);
                    }
                  }}
                >
                  Feed 250 users
                </button>
                <button
                  type="button"
                  className="rounded border border-border px-3 py-1 text-[11px] hover:bg-muted/30"
                  onClick={async () => {
                    const r = await fetch(`${apiBase}/admin/contest/seed-dummy`, {
                      method: "POST",
                      headers: { ...authHeaders, "Content-Type": "application/json" },
                      body: JSON.stringify({ count: 300 }),
                    });
                    const d = await r.json().catch(() => ({}));
                    if (!r.ok) return setErr(d?.message || "Seed failed");
                    setContest(d?.contest || null);
                    toast.success(`Seeded ${d?.added ?? 0} dummy users`);
                    const [sRes, dRes, uRes, cRes] = await Promise.all([
                      fetch(`${apiBase}/admin/summary/today`, { headers: authHeaders }),
                      fetch(`${apiBase}/admin/signups/daily?days=14`, { headers: authHeaders }),
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
                    if (uRes.ok) {
                      const uData = await uRes.json().catch(() => null);
                      if (uData?.users) setUsers(uData.users);
                    }
                    if (cRes.ok) {
                      const cData = await cRes.json().catch(() => null);
                      if (cData?.contest) setContest(cData.contest);
                    }
                  }}
                >
                  Feed 300 users
                </button>
                <button
                  type="button"
                  className="rounded border border-loss/40 px-3 py-1 text-[11px] text-loss hover:bg-loss/10"
                  onClick={async () => {
                    const r = await fetch(`${apiBase}/admin/contest/unseed-dummy`, {
                      method: "POST",
                      headers: authHeaders,
                    });
                    const d = await r.json().catch(() => ({}));
                    if (!r.ok) return setErr(d?.message || "Unseed failed");
                    setContest(d?.contest || null);
                    toast.success(`Removed ${d?.removed ?? 0} seeded users`);
                    const [sRes, dRes, uRes, cRes] = await Promise.all([
                      fetch(`${apiBase}/admin/summary/today`, { headers: authHeaders }),
                      fetch(`${apiBase}/admin/signups/daily?days=14`, { headers: authHeaders }),
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
                    if (uRes.ok) {
                      const uData = await uRes.json().catch(() => null);
                      if (uData?.users) setUsers(uData.users);
                    }
                    if (cRes.ok) {
                      const cData = await cRes.json().catch(() => null);
                      if (cData?.contest) setContest(cData.contest);
                    }
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

          {adminTab === "overview" ? (
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

          {adminTab === "overview" ? (
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
            <div className="lg:col-span-5">
              <div className="rounded-xl border border-border bg-card p-3">
                <div className="text-sm font-semibold">Users</div>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setUserRange("all")}
                    className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                      userRange === "all"
                        ? "bg-primary text-primary-foreground"
                        : "bg-background text-muted-foreground hover:bg-muted/50"
                    }`}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    onClick={() => setUserRange("today")}
                    className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                      userRange === "today"
                        ? "bg-primary text-primary-foreground"
                        : "bg-background text-muted-foreground hover:bg-muted/50"
                    }`}
                  >
                    Signed up today
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={selectedUserIds.length === 0}
                    className="rounded bg-loss px-3 py-1 text-[11px] font-semibold text-white disabled:opacity-50"
                    onClick={async () => {
                      const ok = window.confirm(`Delete ${selectedUserIds.length} selected users? This cannot be undone.`);
                      if (!ok) return;
                      const res = await fetch(`${apiBase}/admin/users/delete`, {
                        method: "POST",
                        headers: { ...authHeaders, "Content-Type": "application/json" },
                        body: JSON.stringify({ userIds: selectedUserIds }),
                      });
                      const d = await res.json().catch(() => ({}));
                      if (!res.ok) return setErr(d?.message || "Delete users failed");
                      const removed = new Set(selectedUserIds);
                      setUsers((prev) => prev.filter((u) => !removed.has(u.id)));
                      if (selectedUserId && removed.has(selectedUserId)) {
                        const next = visibleUsersByProfit.find((u) => !removed.has(u.id))?.id || null;
                        setSelectedUserId(next);
                      }
                      setSelectedUserIds([]);
                      toast.success(`Deleted ${d?.deleted ?? 0} users`);
                    }}
                  >
                    Delete selected
                  </button>
                  <button
                    type="button"
                    disabled={selectedUserIds.length === 0}
                    className="rounded border border-border px-3 py-1 text-[11px] font-semibold disabled:opacity-50"
                    onClick={async () => {
                      const res = await fetch(`${apiBase}/admin/leaderboard/remove-users`, {
                        method: "POST",
                        headers: { ...authHeaders, "Content-Type": "application/json" },
                        body: JSON.stringify({ userIds: selectedUserIds }),
                      });
                      const d = await res.json().catch(() => ({}));
                      if (!res.ok) return setErr(d?.message || "Remove from leaderboard failed");
                      const hidden = new Set(selectedUserIds);
                      setUsers((prev) => prev.map((u) => (hidden.has(u.id) ? { ...u, hiddenFromLeaderboard: true } : u)));
                      setSelectedUserIds([]);
                      toast.success("Removed selected users from Practice + Prize leaderboards");
                    }}
                  >
                    Remove from leaderboard
                  </button>
                </div>
                <div className="mt-2 max-h-[50vh] overflow-auto">
                  {visibleUsersByProfit.map((u) => (
                    <div
                      key={u.id}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors",
                        selectedUserId === u.id ? "bg-muted" : "hover:bg-muted/40",
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={selectedUserIds.includes(u.id)}
                        onChange={() => toggleUserSelect(u.id)}
                        className="h-4 w-4 rounded border-border"
                      />
                      <button
                        type="button"
                        onClick={() => setSelectedUserId(u.id)}
                        className="flex min-w-0 flex-1 items-center justify-between gap-2"
                      >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">{u.name}</div>
                        <div className="truncate text-xs text-muted-foreground">{u.email}</div>
                          <div className="truncate text-[11px] text-muted-foreground">
                            Joined: {formatDateTimeIST(u.createdAt)}
                          </div>
                          <div className="truncate text-[11px] text-muted-foreground">
                            Contest joined: {formatDateTimeIST(contestJoinedAtByUserId.get(u.id))}
                          </div>
                        <div className="truncate text-[11px] text-muted-foreground">Real ₹{Number(u.realWalletInr ?? 0).toFixed(2)}</div>
                        {u.hiddenFromLeaderboard ? (
                          <div className="truncate text-[11px] font-medium text-loss">Hidden from leaderboard</div>
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
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="lg:col-span-7">
              <div className="rounded-xl border border-border bg-card p-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">
                    User details
                    {selectedUserId ? ` · ${selectedUserId.slice(0, 8)}` : ""}
                  </div>
                  {detailsLoading ? <div className="text-xs text-muted-foreground">Loading…</div> : null}
                </div>

                <div className="mt-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Date</div>
                    {(
                      [
                        { id: "today", label: "Today" },
                        { id: "7d", label: "7D" },
                        { id: "14d", label: "14D" },
                        { id: "1m", label: "1M" },
                        { id: "1y", label: "1Y" },
                      ] as const
                    ).map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setDetailsRange(r.id)}
                        className={`rounded-lg px-3 py-2 text-[11px] font-semibold transition-colors ${
                          detailsRange === r.id ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted/50"
                        }`}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>

                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Orders</div>
                  <div className="mt-2 max-h-[26vh] overflow-auto rounded-lg border border-border bg-background">
                    {ordersFiltered.length ? (
                      ordersFiltered.map((o) => (
                        <div key={o.id} className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
                          <div className="min-w-0">
                            <div className="truncate text-xs font-semibold text-foreground">
                              {o.symbol}
                              {o.instrumentType === "FO" && o.optionType ? ` ${o.optionType} ${o.strike}` : ""}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {o.orderMode || "MARKET"} · Qty {o.quantity} · @ ₹{Number(o.price).toFixed(2)}
                            </div>
                            <div className="mt-1 text-[11px] text-muted-foreground">
                              {o.filledAt ? `Filled: ${formatDateTimeIST(o.filledAt)}` : null}
                            </div>
                          </div>
                          <div className={cn("shrink-0 text-xs font-semibold tabular-nums", o.side === "BUY" ? "text-profit" : "text-loss")}>
                            {o.side}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-3 text-sm text-muted-foreground">No orders</div>
                    )}
                  </div>
                </div>

                <div className="mt-4">
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Positions (incl. exited)</div>
                  <div className="mt-2 max-h-[26vh] overflow-auto rounded-lg border border-border bg-background">
                    {positionsFiltered.length ? (
                      positionsFiltered.map((p) => (
                        <div key={p.instrumentKey} className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
                          <div className="min-w-0">
                            <div className="truncate text-xs font-semibold text-foreground">
                              {p.symbol}
                              {p.instrumentType === "FO" && p.optionType ? ` ${p.optionType} ${p.strike}` : ""}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              Qty {p.quantity} · Avg ₹{Number(p.avgPrice).toFixed(2)}{p.exited ? " · Exited" : ""}
                            </div>
                            <div className="mt-1 text-[11px] text-muted-foreground">
                              {p.exited ? `Exited: ${formatDateTimeIST(p.exitedAt)}` : `Opened: ${formatDateTimeIST(p.openedAt)}`}
                            </div>
                            {p.lastTradedAt ? (
                              <div className="mt-0.5 text-[11px] text-muted-foreground">
                                Last trade: {formatDateTimeIST(p.lastTradedAt)}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-3 text-sm text-muted-foreground">No positions</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
          ) : null}
        </>
      )}
    </div>
  );
}

