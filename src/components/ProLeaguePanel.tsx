import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useProLeague } from "@/hooks/useProLeague";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Trophy } from "lucide-react";

function inr(n: number) {
  return `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function trophyClass(rank: number | null) {
  if (rank === 1) return "text-amber-500";
  if (rank === 2) return "text-slate-400";
  if (rank === 3) return "text-orange-600";
  return "text-muted-foreground";
}

export default function ProLeaguePanel({ compact }: { compact?: boolean }) {
  const { user } = useAuth();
  const {
    prizeContest,
    practiceContest,
    prizeLeaderboard,
    practiceLeaderboard,
    joined,
    myRank,
    myPracticeRank,
    loading,
    joining,
    join,
  } = useProLeague();
  const [rulesOpen, setRulesOpen] = useState(false);
  const [leagueTab, setLeagueTab] = useState<"practice" | "prize">("practice");
  const [visibleCount, setVisibleCount] = useState(20);
  const [offerNowMs, setOfferNowMs] = useState<number>(Date.now());
  const contest = leagueTab === "practice" ? practiceContest : prizeContest;
  const leaderboard = leagueTab === "practice" ? practiceLeaderboard : prizeLeaderboard;
  const contestDateISO = contest?.activeContestDayISO || contest?.contestDateISO || "";
  const seats = contest?.participants?.length ?? 0;
  const contestStarted = leagueTab === "practice" ? true : seats >= (contest?.minParticipants ?? 500);
  const leaderboardSorted = useMemo(() => {
    if (!contestStarted) return leaderboard;
    return [...leaderboard].sort((a, b) => {
      const av = Number(a.totalPnlInr || 0);
      const bv = Number(b.totalPnlInr || 0);
      const bucket = (v: number) => (v > 0 ? 0 : v < 0 ? 1 : 2); // positive first, then negative, zeros last
      const ba = bucket(av);
      const bb = bucket(bv);
      if (ba !== bb) return ba - bb;
      return bv - av;
    });
  }, [leaderboard, contestStarted]);
  const visibleRows = useMemo(() => leaderboardSorted.slice(0, visibleCount), [leaderboardSorted, visibleCount]);

  useEffect(() => {
    setVisibleCount(20);
  }, [leaderboard.length, contestDateISO]);

  useEffect(() => {
    const t = window.setInterval(() => setOfferNowMs(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  if (loading) return <div className="py-6 text-sm text-muted-foreground">Loading Pro-League...</div>;
  if (!contest) return <div className="py-6 text-sm text-muted-foreground">Contest is not available.</div>;

  const canJoin = leagueTab === "prize" && !joined && contest.status === "OPEN";
  const yourRankText = contestStarted ? `${leagueTab === "practice" ? (myPracticeRank ?? "-") : (myRank ?? "-")}` : "-";
  const offer = contest?.pricing?.offer;
  const effectiveFee = Number(contest?.pricing?.effectiveEntryFeeInr ?? contest?.entryFeeInr ?? 0);
  const offerEndsMs = offer?.endsAtISO ? Date.parse(offer.endsAtISO) : Number.NaN;
  const offerCountdown =
    Number.isFinite(offerEndsMs) && offerEndsMs > offerNowMs
      ? (() => {
          const s = Math.floor((offerEndsMs - offerNowMs) / 1000);
          const hh = String(Math.floor(s / 3600)).padStart(2, "0");
          const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
          const ss = String(s % 60).padStart(2, "0");
          return `${hh}:${mm}:${ss}`;
        })()
      : null;

  return (
    <div className={cn("space-y-4", compact ? "px-0" : "")}>
      <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-card via-card to-emerald-500/5 p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="mb-2 inline-flex rounded-lg border border-border bg-background p-1">
              <button
                type="button"
                className={cn("rounded-md px-3 py-1 text-xs font-semibold", leagueTab === "practice" ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
                onClick={() => setLeagueTab("practice")}
              >
                Practice (Free)
              </button>
              <button
                type="button"
                className={cn("rounded-md px-3 py-1 text-xs font-semibold", leagueTab === "prize" ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
                onClick={() => setLeagueTab("prize")}
              >
                Prize League
              </button>
            </div>
            <div className="flex w-full items-center justify-between gap-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{contest.title}</p>
              <button
                type="button"
                aria-label="How Pro-League works"
                onClick={() => setRulesOpen(true)}
                className="shrink-0 rounded-full border border-border bg-muted/40 px-3 py-1 text-[11px] font-semibold text-foreground hover:bg-muted/60"
              >
                How it works
              </button>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground sm:text-xs">
              Session date (IST): {contestDateISO}. Ends at 3:30 PM IST.
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

        {leagueTab === "prize" ? <>
        {offer?.enabled ? (
          <div className="mt-3 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold">{offer.label || "Limited time offer"}</span>
              {offerCountdown ? <span className="font-semibold">Ends in {offerCountdown}</span> : null}
            </div>
            <div className="mt-1 text-[11px]">
              {offer.active
                ? `Only ${offer.seatLimit} seats offer valid. Left: ${offer.seatsRemaining}.`
                : "Offer inactive. Real entry fee is applied."}
            </div>
          </div>
        ) : null}
        <div className="mt-3 grid grid-cols-1 gap-2 text-xs">
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-emerald-600 dark:text-emerald-400">
            <div className="flex items-center justify-between">
              <span className="font-medium">#1 Winner</span>
              <span className="font-semibold">{inr(contest.prizePoolInr.first)} CASH</span>
            </div>
          </div>
          <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/5 px-3 py-2 text-emerald-600 dark:text-emerald-400">
            <div className="flex items-center justify-between">
              <span className="font-medium">#2 Winner</span>
              <span className="font-semibold">{inr(contest.prizePoolInr.second)} CASH</span>
            </div>
          </div>
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-emerald-600 dark:text-emerald-400">
            <div className="flex items-center justify-between">
              <span className="font-medium">#3 Winner</span>
              <span className="font-semibold">{inr(contest.prizePoolInr.third)} CASH</span>
            </div>
          </div>
        </div></> : (
          <div className="mt-3 rounded-lg border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
            Practice League is free for all users. Trade with virtual balance and track your rank live.
          </div>
        )}

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          {leagueTab === "prize" ? (
            <>
              <p className="text-xs text-muted-foreground">
                Wallet balance: <span className="font-semibold text-foreground">{inr(user?.realWalletInr || 0)}</span>
                {offer?.enabled ? (
                  <span className="ml-2">
                    {offer.active ? (
                      <span className="font-medium text-amber-600 dark:text-amber-300">
                        ✓ <span className="line-through opacity-70">{inr(offer.originalFeeInr)}</span> {inr(effectiveFee)}
                      </span>
                    ) : (
                      <span className="font-medium text-muted-foreground">Real fee: {inr(offer.originalFeeInr)}</span>
                    )}
                  </span>
                ) : null}
              </p>
              <button
                type="button"
                disabled={!canJoin || joining}
                onClick={async () => {
                  const r = await join();
                  if (!r.ok) toast.error(r.message || "Join failed");
                  else toast.success("Joined Prize League");
                }}
                className="w-full rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50 sm:w-auto"
              >
                {joined ? "Joined Prize League" : joining ? "Joining..." : `Upgrade for ${inr(effectiveFee)}`}
              </button>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">You are auto-enrolled in Practice League after signup.</p>
          )}
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
                          ? leagueTab === "prize" ? "Winning ₹10,000 CASH" : "Top performer"
                          : displayRank === 2
                            ? leagueTab === "prize" ? "Winning ₹5,000 CASH" : "Top performer"
                            : displayRank === 3
                              ? leagueTab === "prize" ? "Winning ₹2,000 CASH" : "Top performer"
                              : "Joined"
                        : "Joined"}
                    </p>
                  </div>
                </div>
                <p
                  className={cn(
                    "shrink-0 text-sm font-semibold tabular-nums flex items-center gap-1",
                    contestStarted ? (row.totalPnlInr >= 0 ? "text-profit" : "text-loss") : "text-muted-foreground",
                  )}
                >
                  {contestStarted && displayRank != null && displayRank <= 3 ? (
                    <Trophy className={cn("h-4 w-4", trophyClass(displayRank))} />
                  ) : null}
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
            <li>You trade Stocks and F&amp;O with your virtual balance during market hours.</li>
            <li>Whoever earns the most on the live dashboard (total P&amp;L) wins the contest.</li>
            <li>Ranking is based only on today's IST trading session P&amp;L (previous-day P&amp;L is not counted).</li>
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

