import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useProLeague } from "@/hooks/useProLeague";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Info } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";

function inr(n: number) {
  return `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export default function ProLeaguePanel({ compact }: { compact?: boolean }) {
  const { user } = useAuth();
  const { contest, leaderboard, joined, myRank, loading, joining, join } = useProLeague();
  const [rulesOpen, setRulesOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(20);
  const contestDateISO = contest?.contestDateISO ?? "";
  const seats = contest?.participants?.length ?? 0;
  const contestStarted = seats >= (contest?.minParticipants ?? 500);
  const leaderboardSorted = useMemo(() => {
    if (!contestStarted) return leaderboard;
    return [...leaderboard].sort((a, b) => Number(b.totalPnlInr || 0) - Number(a.totalPnlInr || 0));
  }, [leaderboard, contestStarted]);
  const visibleRows = useMemo(() => leaderboardSorted.slice(0, visibleCount), [leaderboardSorted, visibleCount]);

  useEffect(() => {
    setVisibleCount(20);
  }, [leaderboard.length, contestDateISO]);

  if (loading) return <div className="py-6 text-sm text-muted-foreground">Loading Pro-League...</div>;
  if (!contest) return <div className="py-6 text-sm text-muted-foreground">Contest is not available.</div>;

  const canJoin = !joined && contest.status === "OPEN";
  const yourRankText = contestStarted ? `${myRank ?? "-"}` : "-";

  return (
    <div className={cn("space-y-4", compact ? "px-0" : "")}>
      <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-card via-card to-emerald-500/5 p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex w-full items-center justify-between gap-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{contest.title}</p>
              <button
                type="button"
                aria-label="How Pro-League works"
                onClick={() => setRulesOpen(true)}
                className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-muted/30 border border-border text-foreground hover:bg-muted/50"
              >
                <Info className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground sm:text-xs">
              It will start on {contest.contestDateISO}. Ends at 3:30 PM IST.
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
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
            <p className="font-semibold text-foreground">{yourRankText}</p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2 text-xs">
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-emerald-600 dark:text-emerald-400">
            <div className="flex items-center justify-between">
              <span className="font-medium">#1 Winner</span>
              <span className="font-semibold">{inr(contest.prizePoolInr.first)}</span>
            </div>
          </div>
          <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/5 px-3 py-2 text-emerald-600 dark:text-emerald-400">
            <div className="flex items-center justify-between">
              <span className="font-medium">#2 Winner</span>
              <span className="font-semibold">{inr(contest.prizePoolInr.second)}</span>
            </div>
          </div>
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-emerald-600 dark:text-emerald-400">
            <div className="flex items-center justify-between">
              <span className="font-medium">#3 Winner</span>
              <span className="font-semibold">{inr(contest.prizePoolInr.third)}</span>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Wallet balance: <span className="font-semibold text-foreground">{inr(user?.realWalletInr || 0)}</span>
          </p>
          <button
            type="button"
            disabled={!canJoin || joining}
            onClick={async () => {
              const r = await join();
              if (!r.ok) toast.error(r.message || "Join failed");
              else toast.success("Joined Pro-League");
            }}
            className="w-full rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50 sm:w-auto"
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
          <div
            className="max-h-[420px] overflow-y-auto"
            onScroll={(e) => {
              const el = e.currentTarget;
              const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 48;
              if (nearBottom && visibleCount < leaderboardSorted.length) {
                setVisibleCount((prev) => Math.min(prev + 20, leaderboardSorted.length));
              }
            }}
          >
            <div className="divide-y divide-border">
            {visibleRows.map((row, idx) => {
              const displayRank = contestStarted ? idx + 1 : null;
              return (
              <div
                key={row.userId}
                className={cn(
                  "flex items-center justify-between gap-3 px-4 py-3 transition-colors",
                  contestStarted && displayRank != null && displayRank <= 3 ? "bg-emerald-500/10" : "hover:bg-muted/30",
                )}
              >
                <div className="min-w-0 flex items-center gap-3">
                  <div className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    contestStarted && displayRank != null && displayRank <= 3
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "bg-muted text-muted-foreground",
                  )}>
                    {displayRank ?? "—"}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{row.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {contestStarted
                        ? displayRank === 1
                          ? "Winning ₹10,000"
                          : displayRank === 2
                            ? "Winning ₹5,000"
                            : displayRank === 3
                              ? "Winning ₹2,000"
                              : "Joined"
                        : "Joined"}
                    </p>
                  </div>
                </div>
                <p
                  className={cn(
                    "shrink-0 text-sm font-semibold tabular-nums",
                    contestStarted ? (row.totalPnlInr >= 0 ? "text-profit" : "text-loss") : "text-muted-foreground",
                  )}
                >
                  {contestStarted ? `${row.totalPnlInr >= 0 ? "+" : ""}${inr(row.totalPnlInr)}` : "—"}
                </p>
              </div>
            )})}
            {visibleCount < leaderboardSorted.length ? (
              <div className="px-4 py-3 text-center text-xs text-muted-foreground">Scroll for more users...</div>
            ) : null}
            </div>
          </div>
        )}
      </div>

      <Dialog open={rulesOpen} onOpenChange={setRulesOpen}>
        <DialogContent className="max-w-md">
          <h3 className="text-base font-semibold text-foreground">How Pro-League works</h3>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
            <li>You trade with virtual balance during market hours.</li>
            <li>Live leaderboard ranks users by total P&amp;L in real time.</li>
            <li>Top 3 users at contest close are winners.</li>
            <li>Prize pool: #1 ₹10,000, #2 ₹5,000, #3 ₹2,000.</li>
            <li>Contest starts only after minimum participants join.</li>
            <li>Admin finalizes and releases rewards after market close.</li>
          </ul>
        </DialogContent>
      </Dialog>
    </div>
  );
}

