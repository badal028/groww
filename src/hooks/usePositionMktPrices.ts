import { useEffect, useMemo, useRef, useState } from "react";
import type { PaperPosition } from "@/hooks/usePaperPositions";
import { detectProvider } from "@/services/marketData";
import { subscribeKiteMarket } from "@/services/kiteMarketWsHub";
import { resolveKiteKeyForPaperPosition } from "@/utils/positionKiteKeys";

const apiBase = import.meta.env.VITE_MARKET_DATA_API_BASE || "http://127.0.0.1:3001";

/**
 * Live last prices per `instrumentKey` (Kite REST seed + WebSocket ticks).
 */
export function usePositionMktPrices(positions: PaperPosition[]) {
  const [mktByInstrumentKey, setMktByInstrumentKey] = useState<Record<string, number>>({});
  const provider = useMemo(() => detectProvider(), []);
  const positionsRef = useRef(positions);
  positionsRef.current = positions;

  const keysSig = useMemo(() => {
    const keys = new Set<string>();
    for (const p of positions) {
      const k = resolveKiteKeyForPaperPosition(p);
      if (k) keys.add(k);
    }
    const arr = [...keys].sort();
    return arr.length ? JSON.stringify(arr) : "";
  }, [positions]);

  useEffect(() => {
    if (provider !== "kite-backend" || !keysSig) return;
    const keys = JSON.parse(keysSig) as string[];
    const kiteToInstruments = new Map<string, string[]>();
    for (const p of positionsRef.current) {
      const k = resolveKiteKeyForPaperPosition(p);
      if (!k) continue;
      const arr = kiteToInstruments.get(k) || [];
      arr.push(p.instrumentKey);
      kiteToInstruments.set(k, arr);
    }

    let cancelled = false;
    const seedOnce = async () => {
      try {
        const url = `${apiBase}/api/quotes?symbols=${encodeURIComponent(keys.join(","))}`;
        const res = await fetch(url);
        if (res.status === 401 || res.status === 403) {
          if (cancelled) return;
          setMktByInstrumentKey({});
          return;
        }
        if (!res.ok) return;
        const data = await res.json();
        const quotes = data?.quotes ?? {};
        if (cancelled) return;
        const next: Record<string, number> = {};
        for (const k of keys) {
          const instArr = kiteToInstruments.get(k) || [];
          const q = quotes[k];
          const lp = q?.last_price != null ? Number(q.last_price) : NaN;
          if (!Number.isFinite(lp)) continue;
          for (const inst of instArr) next[inst] = lp;
        }
        setMktByInstrumentKey((prev) => ({ ...prev, ...next }));
      } catch {
        /* Kite may be logged out */
      }
    };

    void seedOnce();

    return () => {
      cancelled = true;
    };
  }, [provider, keysSig]);

  // Poll quotes periodically so next-day open P&L doesn't get stuck with stale LTP.
  useEffect(() => {
    if (provider !== "kite-backend" || !keysSig) return;
    const keys = JSON.parse(keysSig) as string[];
    let stopped = false;

    const poll = async () => {
      try {
        const url = `${apiBase}/api/quotes?symbols=${encodeURIComponent(keys.join(","))}`;
        const res = await fetch(url);
        if (stopped) return;
        if (res.status === 401 || res.status === 403) {
          setMktByInstrumentKey({});
          return;
        }
        if (!res.ok) return;
        const data = await res.json();
        const quotes = data?.quotes ?? {};
        if (stopped) return;

        // For polling we just update mkt state for instrument keys that exist right now.
        // (If symbols map changes later, keysSig will rerun effects anyway.)
        const positionsNow = positionsRef.current;
        const next: Record<string, number> = {};
        for (const p of positionsNow) {
          const instKey = p.instrumentKey;
          const kiteKey = resolveKiteKeyForPaperPosition(p);
          if (!kiteKey) continue;
          const q = quotes[kiteKey];
          const lp = q?.last_price != null ? Number(q.last_price) : NaN;
          if (!Number.isFinite(lp)) continue;
          next[instKey] = lp;
        }
        setMktByInstrumentKey((prev) => ({ ...prev, ...next }));
      } catch {
        /* ignore */
      }
    };

    const t = window.setInterval(poll, 25000);
    return () => {
      stopped = true;
      window.clearInterval(t);
    };
  }, [provider, keysSig]);

  useEffect(() => {
    if (provider !== "kite-backend" || !keysSig) return;
    const keys = JSON.parse(keysSig) as string[];
    const kiteToInstruments = new Map<string, string[]>();
    for (const p of positionsRef.current) {
      const k = resolveKiteKeyForPaperPosition(p);
      if (!k) continue;
      const arr = kiteToInstruments.get(k) || [];
      arr.push(p.instrumentKey);
      kiteToInstruments.set(k, arr);
    }

    return subscribeKiteMarket(keys, (msg) => {
      const instArr = kiteToInstruments.get(msg.key) || [];
      if (instArr.length === 0) return;
      const px = Number(Number(msg.last_price).toFixed(2));
      if (!Number.isFinite(px)) return;
      setMktByInstrumentKey((prev) => {
        const next = { ...prev };
        for (const inst of instArr) next[inst] = px;
        return next;
      });
    });
  }, [provider, keysSig]);

  return { mktByInstrumentKey };
}
