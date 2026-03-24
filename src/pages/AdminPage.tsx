import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const apiBase = import.meta.env.VITE_MARKET_DATA_API_BASE || "http://127.0.0.1:3001";
const adminEmail = String(import.meta.env.VITE_ADMIN_EMAIL || "").trim().toLowerCase();

function formatInr(n: number): string {
  const v = Number(n || 0);
  return `${v >= 0 ? "+" : ""}₹${v.toLocaleString("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
}

type TodaySignup = { id: string; email: string };
type AdminSummary = { today: string; signupsTodayCount: number; signupsToday: TodaySignup[] };

type DailySignupRow = {
  date: string;
  count: number;
  signups: { id: string; email: string }[];
};

type Contest = {
  id: string;
  contestDateISO: string;
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
  walletInr: number;
  realWalletInr?: number;
  realizedPnlInr: number;
  openPnlInr: number;
  totalPnlInr: number;
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
  kiteSymbol?: string;
};

export default function AdminPage() {
  const { user, token } = useAuth();
  const isAdmin = useMemo(() => {
    if (!adminEmail) return false;
    return String(user?.email || "").trim().toLowerCase() === adminEmail;
  }, [user?.email]);

  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [dailyRows, setDailyRows] = useState<DailySignupRow[]>([]);
  const [users, setUsers] = useState<AdminUserPnl[]>([]);
  const [contest, setContest] = useState<Contest | null>(null);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [orders, setOrders] = useState<PaperOrder[]>([]);
  const [positions, setPositions] = useState<PaperPosition[]>([]);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const authHeaders = useMemo(() => {
    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
  }, [token]);

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
        setLoading(true);
        setErr(null);
        const [sRes, dRes, uRes, cRes, wRes] = await Promise.all([
          fetch(`${apiBase}/admin/summary/today`, { headers: authHeaders }),
          fetch(`${apiBase}/admin/signups/daily?days=14`, { headers: authHeaders }),
          fetch(`${apiBase}/admin/users/pnl`, { headers: authHeaders }),
          fetch(`${apiBase}/admin/contest/current`, { headers: authHeaders }),
          fetch(`${apiBase}/admin/withdrawals`, { headers: authHeaders }),
        ]);

        if (!sRes.ok) throw new Error(await sRes.text().catch(() => "Summary fetch failed"));
        if (!dRes.ok) throw new Error(await dRes.text().catch(() => "Daily signups fetch failed"));
        if (!uRes.ok) throw new Error(await uRes.text().catch(() => "Users fetch failed"));
        if (!cRes.ok) throw new Error(await cRes.text().catch(() => "Contest fetch failed"));
        if (!wRes.ok) throw new Error(await wRes.text().catch(() => "Withdrawals fetch failed"));

        const sData = await sRes.json();
        const dData = await dRes.json();
        const uData = await uRes.json();
        const cData = await cRes.json();
        const wData = await wRes.json();

        if (cancelled) return;
        setSummary(sData?.signupsTodayCount != null ? sData : null);
        setDailyRows(Array.isArray(dData?.rows) ? dData.rows : []);
        setUsers(Array.isArray(uData?.users) ? uData.users : []);
        setContest(cData?.contest || null);
        setWithdrawals(Array.isArray(wData?.withdrawals) ? wData.withdrawals : []);
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
  }, [token, isAdmin]);

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

  if (!token) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Login required.
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8">
      <h1 className="mb-4 text-xl font-semibold text-foreground">Admin</h1>

      {err && <div className="mb-4 rounded border border-loss/30 bg-loss/10 p-3 text-sm text-loss">{err}</div>}

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : (
        <>
          <div className="mb-4 rounded-xl border border-border bg-card p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Today signups</div>
            <div className="mt-1 text-lg font-bold text-foreground">
              {summary?.signupsTodayCount ?? 0} users
            </div>
            {summary?.signupsToday?.length ? (
              <div className="mt-2 text-sm text-muted-foreground">
                {summary.signupsToday.map((s) => s.email).join(", ")}
              </div>
            ) : (
              <div className="mt-2 text-sm text-muted-foreground">No signups today</div>
            )}
          </div>

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
                        {row.signups.length ? row.signups.map((s) => s.email).join(", ") : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {contest && (
            <div className="mb-4 rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold">Pro-League control</div>
                  <div className="text-xs text-muted-foreground">
                    {contest.contestDateISO} · {contest.status} · {contest.participants?.length || 0}/{contest.maxParticipants}
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

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <div className="rounded-xl border border-border bg-card p-3">
                <div className="text-sm font-semibold">Users</div>
                <div className="mt-2 max-h-[50vh] overflow-auto">
                  {users.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => setSelectedUserId(u.id)}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 text-left transition-colors",
                        selectedUserId === u.id ? "bg-muted" : "hover:bg-muted/40",
                      )}
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">{u.name}</div>
                        <div className="truncate text-xs text-muted-foreground">{u.email}</div>
                        <div className="truncate text-[11px] text-muted-foreground">Real ₹{Number(u.realWalletInr ?? 0).toFixed(2)}</div>
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
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Orders</div>
                  <div className="mt-2 max-h-[26vh] overflow-auto rounded-lg border border-border bg-background">
                    {orders.length ? (
                      orders.map((o) => (
                        <div key={o.id} className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
                          <div className="min-w-0">
                            <div className="truncate text-xs font-semibold text-foreground">
                              {o.symbol}
                              {o.instrumentType === "FO" && o.optionType ? ` ${o.optionType} ${o.strike}` : ""}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {o.orderMode || "MARKET"} · Qty {o.quantity} · @ ₹{Number(o.price).toFixed(2)}
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
                    {positions.length ? (
                      positions.map((p) => (
                        <div key={p.instrumentKey} className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
                          <div className="min-w-0">
                            <div className="truncate text-xs font-semibold text-foreground">
                              {p.symbol}
                              {p.instrumentType === "FO" && p.optionType ? ` ${p.optionType} ${p.strike}` : ""}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              Qty {p.quantity} · Avg ₹{Number(p.avgPrice).toFixed(2)}{p.exited ? " · Exited" : ""}
                            </div>
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
        </>
      )}
    </div>
  );
}

