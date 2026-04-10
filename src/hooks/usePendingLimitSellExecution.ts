import { useCallback, useEffect, useMemo, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import type { PaperOrder } from "@/hooks/usePaperOrders";
import { subscribeKiteMarket } from "@/services/kiteMarketWsHub";
import { detectProvider } from "@/services/marketData";
import { PAPER_POSITIONS_REFRESH_EVENT } from "@/hooks/usePaperTrading";

const TOUCH_EPS = 0.02;
const apiBase = import.meta.env.VITE_MARKET_DATA_API_BASE || "http://127.0.0.1:3001";

export function usePendingLimitSellExecution(orders: PaperOrder[]) {
  const { token, refreshMe } = useAuth();
  const pending = useMemo(
    () =>
      orders.filter(
        (o) =>
          String(o.status || "").toUpperCase() === "PENDING" &&
          o.side === "SELL" &&
          String(o.orderMode || "").toUpperCase() === "LIMIT" &&
          o.instrumentType === "FO" &&
          Boolean(String(o.kiteSymbol || "").trim()),
      ),
    [orders],
  );

  const keysStr = useMemo(
    () =>
      [...new Set(pending.map((o) => String(o.kiteSymbol || "").trim()))]
        .filter(Boolean)
        .sort()
        .join("|"),
    [pending],
  );

  const pendingRef = useRef(pending);
  pendingRef.current = pending;

  const modeRef = useRef<Record<string, "rise" | "fall" | "flat">>({});
  const prevLtpRef = useRef<Record<string, number>>({});
  const inflightRef = useRef<Set<string>>(new Set());

  const fillPending = useCallback(
    async (orderId: string) => {
      if (!token || inflightRef.current.has(orderId)) return;
      inflightRef.current.add(orderId);
      try {
        const res = await fetch(`${apiBase}/paper/order/execute-pending`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ orderId }),
        });
        await res.json().catch(() => ({}));
        if (!res.ok) return;
        await refreshMe();
        window.dispatchEvent(new Event(PAPER_POSITIONS_REFRESH_EVENT));
      } finally {
        inflightRef.current.delete(orderId);
      }
    },
    [token, refreshMe],
  );

  useEffect(() => {
    const activeIds = new Set(pending.map((o) => o.id));
    for (const id of Object.keys(modeRef.current)) {
      if (!activeIds.has(id)) delete modeRef.current[id];
    }
    for (const id of Object.keys(prevLtpRef.current)) {
      if (!activeIds.has(id)) delete prevLtpRef.current[id];
    }
  }, [pending]);

  useEffect(() => {
    if (detectProvider() !== "kite-backend" || !token || !keysStr) return;
    const keys = keysStr.split("|").filter(Boolean);

    return subscribeKiteMarket(keys, (msg) => {
      const ltp = Number(Number(msg.last_price).toFixed(2));
      if (!Number.isFinite(ltp) || ltp < 0) return;
      const key = msg.key;
      const list = pendingRef.current.filter((o) => String(o.kiteSymbol || "").trim() === key);
      for (const o of list) {
        if (inflightRef.current.has(o.id)) continue;
        const lim = Number(o.price);
        if (!Number.isFinite(lim) || lim <= 0) continue;

        let mode = modeRef.current[o.id];
        if (mode === undefined) {
          if (Math.abs(lim - ltp) <= TOUCH_EPS) mode = "flat";
          else if (lim > ltp) mode = "rise";
          else mode = "fall";
          modeRef.current[o.id] = mode;
        }

        const prev = prevLtpRef.current[o.id];
        if (prev === undefined) {
          prevLtpRef.current[o.id] = ltp;
          if (mode === "flat") void fillPending(o.id);
          continue;
        }

        let crossed = false;
        if (mode === "flat") crossed = Math.abs(lim - ltp) <= TOUCH_EPS;
        if (mode === "rise") crossed = prev < lim - TOUCH_EPS && ltp >= lim - TOUCH_EPS;
        if (mode === "fall") crossed = prev > lim + TOUCH_EPS && ltp <= lim + TOUCH_EPS;

        prevLtpRef.current[o.id] = ltp;
        if (crossed) void fillPending(o.id);
      }
    });
  }, [token, keysStr, fillPending]);
}
