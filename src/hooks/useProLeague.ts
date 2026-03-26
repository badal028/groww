import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";

const apiBase = import.meta.env.VITE_MARKET_DATA_API_BASE || "http://127.0.0.1:3001";

export type LeagueContest = {
  id: string;
  title: string;
  contestDateISO: string;
  /** IST calendar day for this session (from server; fixes stale contestDateISO when contest carries over). */
  activeContestDayISO?: string;
  entryFeeInr: number;
  minParticipants: number;
  maxParticipants: number;
  participants: { userId: string; joinedAt: string }[];
  status: "OPEN" | "FINALIZED";
  prizePoolInr: { first: number; second: number; third: number };
  leagueType?: "practice" | "prize";
  payouts?: { userId: string; rank: number; amountInr: number; status: string }[];
};

export type LeaderboardRow = {
  userId: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  totalPnlInr: number;
  rank: number | null;
};

export function useProLeague() {
  const { token, refreshMe } = useAuth();
  const [contest, setContest] = useState<LeagueContest | null>(null); // prize (backward-compatible)
  const [practiceContest, setPracticeContest] = useState<LeagueContest | null>(null);
  const [prizeContest, setPrizeContest] = useState<LeagueContest | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]); // prize (backward-compatible)
  const [practiceLeaderboard, setPracticeLeaderboard] = useState<LeaderboardRow[]>([]);
  const [prizeLeaderboard, setPrizeLeaderboard] = useState<LeaderboardRow[]>([]);
  const [joined, setJoined] = useState(false); // joined prize
  const [joinedPractice, setJoinedPractice] = useState(true);
  const [myRank, setMyRank] = useState<number | null>(null); // prize rank
  const [myPracticeRank, setMyPracticeRank] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const headers = useMemo(
    () => ({
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }),
    [token],
  );

  const load = useCallback(async (silent = false) => {
    if (!token) {
      setContest(null);
      setLeaderboard([]);
      setPracticeContest(null);
      setPrizeContest(null);
      setPracticeLeaderboard([]);
      setPrizeLeaderboard([]);
      setJoined(false);
      setJoinedPractice(true);
      setMyRank(null);
      setMyPracticeRank(null);
      return;
    }
    if (!silent) setLoading(true);
    setError(null);
    try {
      const [cRes, lRes] = await Promise.all([
        fetch(`${apiBase}/contest/current`, { headers }),
        fetch(`${apiBase}/contest/leaderboard`, { headers }),
      ]);
      const cData = await cRes.json().catch(() => ({}));
      const lData = await lRes.json().catch(() => ({}));
      if (!cRes.ok) throw new Error(cData?.message || "Failed to load contest");
      if (!lRes.ok) throw new Error(lData?.message || "Failed to load leaderboard");
      const prize = (cData?.prizeContest || cData?.contest || lData?.prizeContest || lData?.contest || null) as LeagueContest | null;
      const practice = (cData?.practiceContest || lData?.practiceContest || null) as LeagueContest | null;
      const prizeBoard = Array.isArray(lData?.prizeLeaderboard)
        ? lData.prizeLeaderboard
        : Array.isArray(lData?.leaderboard)
          ? lData.leaderboard
          : [];
      const practiceBoard = Array.isArray(lData?.practiceLeaderboard) ? lData.practiceLeaderboard : [];
      setContest(prize);
      setPrizeContest(prize);
      setPracticeContest(practice);
      setJoined(Boolean(cData?.joinedPrize ?? cData?.joined));
      setJoinedPractice(Boolean(cData?.joinedPractice ?? true));
      setLeaderboard(prizeBoard);
      setPrizeLeaderboard(prizeBoard);
      setPracticeLeaderboard(practiceBoard);
      setMyRank(Number.isFinite(lData?.myPrizeRank) ? Number(lData.myPrizeRank) : Number.isFinite(lData?.myRank) ? Number(lData.myRank) : null);
      setMyPracticeRank(Number.isFinite(lData?.myPracticeRank) ? Number(lData.myPracticeRank) : null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load Pro-League");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [token, headers]);

  const join = useCallback(async () => {
    if (!token) return { ok: false, message: "Login required" };
    setJoining(true);
    try {
      const res = await fetch(`${apiBase}/contest/join`, {
        method: "POST",
        headers,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, message: data?.message || "Could not join contest" };
      await refreshMe();
      await load(true);
      return { ok: true };
    } catch {
      return { ok: false, message: "Unable to connect backend" };
    } finally {
      setJoining(false);
    }
  }, [token, headers, load, refreshMe]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!token) return;
    const timer = window.setInterval(() => {
      void load(true);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [token, load]);

  return {
    contest,
    prizeContest,
    practiceContest,
    leaderboard,
    prizeLeaderboard,
    practiceLeaderboard,
    joined,
    joinedPractice,
    myRank,
    myPracticeRank,
    loading,
    joining,
    error,
    refetch: load,
    join,
  };
}

