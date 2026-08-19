import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { PAPER_POSITIONS_REFRESH_EVENT } from "@/hooks/usePaperTrading";

const apiBase = import.meta.env.VITE_MARKET_DATA_API_BASE || "http://127.0.0.1:3001";

export type PaperPosition = {
  instrumentKey: string;
  baseInstrumentKey?: string;
  symbol: string;
  instrumentType: string;
  optionType: "CE" | "PE" | null;
  strike: number | null;
  expiry: string | null;
  quantity: number;
  avgPrice: number;
  kiteSymbol?: string;
  exited?: boolean;
  exitedAt?: string;
  exitPrice?: number;
  realizedPnlInr?: number;
};

export function usePaperPositions() {
  const { token } = useAuth();
  const [positions, setPositions] = useState<PaperPosition[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const headers = useMemo(() => {
    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }, [token]);

  const loadPositions = useCallback(async () => {
    if (!token) {
      setPositions([]);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/paper/positions`, { headers });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Failed to load positions");
      setPositions(Array.isArray(data?.positions) ? data.positions : []);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to load positions";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [token, headers]);

  useEffect(() => {
    void loadPositions();
  }, [loadPositions]);

  useEffect(() => {
    const onRefresh = () => void loadPositions();
    window.addEventListener(PAPER_POSITIONS_REFRESH_EVENT, onRefresh);
    return () => window.removeEventListener(PAPER_POSITIONS_REFRESH_EVENT, onRefresh);
  }, [loadPositions]);

  return { positions, loading, error, refetch: loadPositions };
}

