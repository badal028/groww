import { useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";

type OrderPayload = {
  symbol: string;
  side: "BUY" | "SELL";
  quantity: number;
  price: number;
  orderMode?: "MARKET" | "LIMIT";
  instrumentType: "EQ" | "FO";
  optionType?: "CE" | "PE";
  strike?: number;
  expiry?: string;
  product?: "NRML" | "MIS";
  /** Kite stream key (e.g. NFO:NIFTY25MAR23050PE) for live P&amp;L on positions */
  kiteSymbol?: string;
};

const apiBase = import.meta.env.VITE_MARKET_DATA_API_BASE || "http://127.0.0.1:3001";

export const PAPER_POSITIONS_REFRESH_EVENT = "paper-positions-refresh";

export const usePaperTrading = () => {
  const { token, refreshMe } = useAuth();
  const [placing, setPlacing] = useState(false);

  const headers = useMemo(
    () => ({
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }),
    [token],
  );

  const placeOrder = async (payload: OrderPayload) => {
    if (!token) return { ok: false, message: "Login required" };
    setPlacing(true);
    try {
      const res = await fetch(`${apiBase}/paper/order`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) return { ok: false, message: data?.message || "Order failed" };
      await refreshMe();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event(PAPER_POSITIONS_REFRESH_EVENT));
      }
      return { ok: true, data };
    } catch {
      return { ok: false, message: "Unable to connect backend" };
    } finally {
      setPlacing(false);
    }
  };

  return { placeOrder, placing };
};
