import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";

const apiBase = import.meta.env.VITE_MARKET_DATA_API_BASE || "http://127.0.0.1:3001";

export type LeagueContest = {
  id: string;
  title: string;
  contestDateISO: string;
  entryFeeInr: number;
  minParticipants: number;
  maxParticipants: number;
  participants: { userId: string; joinedAt: string }[];
  status: "OPEN" | "FINALIZED";
  prizePoolInr: { first: number; second: number; third: number };
  payouts?: { userId: string; rank: number; amountInr: number; status: string }[];
};

export type LeaderboardRow = {
  userId: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  totalPnlInr: number;
  rank: number;
};

export function useProLeague() {
  const { token, refreshMe } = useAuth();
  const [contest, setContest] = useState<LeagueContest | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [joined, setJoined] = useState(false);
  const [myRank, setMyRank] = useState<number | null>(null);
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

  const load = useCallback(async () => {
    if (!token) {
      setContest(null);
      setLeaderboard([]);
      setJoined(false);
      setMyRank(null);
      return;
    }
    setLoading(true);
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
      setContest(cData?.contest || null);
      setJoined(Boolean(cData?.joined));
      setLeaderboard(Array.isArray(lData?.leaderboard) ? lData.leaderboard : []);
      setMyRank(Number.isFinite(lData?.myRank) ? Number(lData.myRank) : null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load Pro-League");
    } finally {
      setLoading(false);
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
      await load();
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

  return { contest, leaderboard, joined, myRank, loading, joining, error, refetch: load, join };
}

