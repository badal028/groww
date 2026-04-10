import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { PAPER_POSITIONS_REFRESH_EVENT } from "@/hooks/usePaperTrading";

const apiBase = import.meta.env.VITE_MARKET_DATA_API_BASE || "http://127.0.0.1:3001";

export type PaperOrder = {
  id: string;
  symbol: string;
  side: "BUY" | "SELL";
  quantity: number;
  price: number;
  orderMode?: "MARKET" | "LIMIT";
  instrumentType: "EQ" | "FO";
  optionType: "CE" | "PE" | null;
  strike: number | null;
  expiry: string | null;
  product: string;
  notional: number;
  status: string;
  filledAt: string | null;
  kiteSymbol?: string;
};

export function usePaperOrders() {
  const { token } = useAuth();
  const [orders, setOrders] = useState<PaperOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const headers = useMemo(
    () => ({
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }),
    [token],
  );

  const loadOrders = useCallback(async () => {
    if (!token) {
      setOrders([]);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/paper/orders`, { headers });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Failed to load orders");
      setOrders(Array.isArray(data?.orders) ? data.orders : []);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to load orders";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [token, headers]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    const onRefresh = () => void loadOrders();
    window.addEventListener(PAPER_POSITIONS_REFRESH_EVENT, onRefresh);
    return () => window.removeEventListener(PAPER_POSITIONS_REFRESH_EVENT, onRefresh);
  }, [loadOrders]);

  return { orders, loading, error, refetch: loadOrders };
}
