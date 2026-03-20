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
    (async () => {
      try {
        const url = `${apiBase}/api/quotes?symbols=${encodeURIComponent(keys.join(","))}`;
        const res = await fetch(url);
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
    })();

    return () => {
      cancelled = true;
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
