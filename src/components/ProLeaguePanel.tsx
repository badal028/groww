import React from "react";
import { useAuth } from "@/hooks/useAuth";
import { useProLeague } from "@/hooks/useProLeague";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function inr(n: number) {
  return `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export default function ProLeaguePanel({ compact }: { compact?: boolean }) {
  const { user } = useAuth();
  const { contest, leaderboard, joined, myRank, loading, joining, join } = useProLeague();

  if (loading) return <div className="py-6 text-sm text-muted-foreground">Loading Pro-League...</div>;
  if (!contest) return <div className="py-6 text-sm text-muted-foreground">Contest is not available.</div>;

  const seats = contest.participants?.length || 0;
  const canJoin = !joined && contest.status === "OPEN";

  return (
    <div className={cn("space-y-4", compact ? "px-0" : "")}>
      <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-card via-card to-emerald-500/5 p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{contest.title}</p>
            <h3 className="mt-1 text-lg font-semibold text-foreground">
              Daily Contest · {contest.contestDateISO}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Starts next day. Ends at 3:30 PM IST.
            </p>
          </div>
          <div className="rounded-lg bg-muted px-3 py-2 text-right">
            <p className="text-[11px] text-muted-foreground">Entry fee</p>
            <p className="text-sm font-semibold text-foreground">{inr(contest.entryFeeInr)}</p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-lg border border-border bg-background px-2 py-2">
            <p className="text-muted-foreground">Seats</p>
            <p className="font-semibold text-foreground">{seats}/{contest.maxParticipants}</p>
          </div>
          <div className="rounded-lg border border-border bg-background px-2 py-2">
            <p className="text-muted-foreground">Min users</p>
            <p className="font-semibold text-foreground">{contest.minParticipants}</p>
          </div>
          <div className="rounded-lg border border-border bg-background px-2 py-2">
            <p className="text-muted-foreground">Your rank</p>
            <p className="font-semibold text-foreground">{myRank ?? "-"}</p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-2 text-emerald-600 dark:text-emerald-400">#1 {inr(contest.prizePoolInr.first)}</div>
          <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/5 px-2 py-2 text-emerald-600 dark:text-emerald-400">#2 {inr(contest.prizePoolInr.second)}</div>
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-2 py-2 text-emerald-600 dark:text-emerald-400">#3 {inr(contest.prizePoolInr.third)}</div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            Real balance: <span className="font-semibold text-foreground">{inr(user?.realWalletInr || 0)}</span>
          </p>
          <button
            type="button"
            disabled={!canJoin || joining}
            onClick={async () => {
              const r = await join();
              if (!r.ok) toast.error(r.message || "Join failed");
              else toast.success("Joined Pro-League");
            }}
            className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
          >
            {joined ? "Joined" : joining ? "Joining..." : `Join for ${inr(contest.entryFeeInr)}`}
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-4 py-3 text-sm font-semibold">Live leaderboard</div>
        {leaderboard.length === 0 ? (
          <div className="px-4 py-6 text-sm text-muted-foreground">No joined users yet.</div>
        ) : (
          <div className="divide-y divide-border">
            {leaderboard.map((row) => (
              <div
                key={row.userId}
                className={cn(
                  "flex items-center justify-between gap-3 px-4 py-3 transition-colors",
                  row.rank <= 3 ? "bg-emerald-500/10" : "hover:bg-muted/30",
                )}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">
                    #{row.rank} {row.name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{row.email}</p>
                </div>
                <p className={cn("shrink-0 text-sm font-semibold tabular-nums", row.totalPnlInr >= 0 ? "text-profit" : "text-loss")}>
                  {row.totalPnlInr >= 0 ? "+" : ""}{inr(row.totalPnlInr)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

