import { useEffect, useMemo, useRef, useState } from "react";
import type { Stock } from "@/data/mockData";
import {
  detectProvider,
  getLiveStockSnapshot,
  KITE_LIVE_POLL_MS,
  resolveKiteKeyForStock,
  type LiveStatus,
} from "@/services/marketData";
import { subscribeKiteConnection, subscribeKiteMarket } from "@/services/kiteMarketWsHub";

/** Poll interval for live LTP + 1D chart (Kite REST; same cadence as list/indices when on kite-backend). */
const POLL_MS_KITE = KITE_LIVE_POLL_MS;
const POLL_MS_MOCK = 2500;
const MAX_LIVE_POINTS = 120;
/** Avoid hammering Recharts on every tick (~ms); still feels instant in header. */
const CHART_APPEND_THROTTLE_MS = 120;
const KITE_REST_FALLBACK_MS = 90_000;

export type ChartPoint = { t: number; price: number };

/** Synthetic intraday path from session open → last LTP (seed before live ticks append). */
function seed1dFromOhlc(
  ohlc: { open: number; high: number; low: number; close: number },
  last: number,
  segments = 52,
): ChartPoint[] {
  const now = Date.now();
  const sessionMs = 6.5 * 60 * 60 * 1000;
  const { open, high, low } = ohlc;
  const pts: ChartPoint[] = [];
  for (let i = 0; i < segments; i++) {
    const frac = i / (segments - 1);
    const t = now - sessionMs * (1 - frac);
    let p = open + (last - open) * frac;
    p += Math.sin(frac * Math.PI * 5) * (high - low) * 0.05;
    p = Math.max(low * 0.998, Math.min(high * 1.002, p));
    pts.push({ t, price: Number(p.toFixed(2)) });
  }
  pts[segments - 1] = { t: now, price: last };
  return pts;
}

export function useLiveStockDetail(baseStock: Stock, activeRange: string) {
  const [displayStock, setDisplayStock] = useState(baseStock);
  const [series1d, setSeries1d] = useState<ChartPoint[]>([]);
  const [status, setStatus] = useState<LiveStatus>("simulated");
  const [liveOhlc, setLiveOhlc] = useState<{
    open: number;
    high: number;
    low: number;
    close: number;
  } | null>(null);
  const seededRef = useRef(false);
  const lastChartPushRef = useRef(0);
  const [kiteWsConnected, setKiteWsConnected] = useState(false);
  const provider = useMemo(() => detectProvider(), []);
  const pollMs =
    provider === "kite-backend"
      ? kiteWsConnected
        ? KITE_REST_FALLBACK_MS
        : POLL_MS_KITE
      : provider === "mock"
        ? POLL_MS_MOCK
        : 10_000;

  useEffect(() => subscribeKiteConnection(setKiteWsConnected), []);

  useEffect(() => {
    setDisplayStock(baseStock);
  }, [baseStock]);

  useEffect(() => {
    setSeries1d([]);
    seededRef.current = false;
    lastChartPushRef.current = 0;
    setLiveOhlc(null);
  }, [baseStock.id]);

  useEffect(() => {
    if (activeRange !== "1D") {
      setSeries1d([]);
      seededRef.current = false;
    }
  }, [activeRange]);

  /** Kite WebSocket: sub-second LTP (header + 1D line). */
  useEffect(() => {
    if (provider !== "kite-backend") return;
    const key = resolveKiteKeyForStock(baseStock);
    if (!key) return;

    return subscribeKiteMarket([key], (msg) => {
      const price = Number(Number(msg.last_price).toFixed(2));

      setStatus("live");
      setDisplayStock((prev) => ({
        ...prev,
        price,
        change: msg.change != null ? msg.change : prev.change,
        changePercent: msg.changePercent != null ? msg.changePercent : prev.changePercent,
      }));

      if (msg.ohlc) {
        setLiveOhlc({
          open: msg.ohlc.open,
          high: msg.ohlc.high,
          low: msg.ohlc.low,
          close: msg.ohlc.close,
        });
      }

      if (activeRange !== "1D") return;

      const now = Date.now();
      if (now - lastChartPushRef.current < CHART_APPEND_THROTTLE_MS) return;
      lastChartPushRef.current = now;

      const ohlc = msg.ohlc;
      const open = ohlc?.open ?? price;
      const high = ohlc?.high ?? Math.max(open, price) * 1.002;
      const low = ohlc?.low ?? Math.min(open, price) * 0.998;
      const close = ohlc?.close ?? open;

      setSeries1d((prev) => {
        if (!ohlc) return prev;
        if (!seededRef.current) {
          seededRef.current = true;
          return seed1dFromOhlc({ open, high, low, close }, price);
        }
        const next = [...prev, { t: Date.now(), price }];
        return next.slice(-MAX_LIVE_POINTS);
      });
    });
  }, [provider, baseStock.id, baseStock.symbol, baseStock.sector, activeRange]);

  useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      const { snapshot, status: st } = await getLiveStockSnapshot(baseStock);
      if (cancelled) return;
      setStatus(st);

      if (!snapshot || snapshot.price <= 0) return;

      if (snapshot.ohlc) setLiveOhlc(snapshot.ohlc);

      setDisplayStock((prev) => ({
        ...prev,
        price: snapshot.price,
        change: snapshot.change,
        changePercent: snapshot.changePercent,
      }));

      if (activeRange !== "1D") return;

      const open = snapshot.ohlc?.open ?? snapshot.price - snapshot.change;
      const high = snapshot.ohlc?.high ?? Math.max(open, snapshot.price) * 1.002;
      const low = snapshot.ohlc?.low ?? Math.min(open, snapshot.price) * 0.998;
      const last = snapshot.price;
      const close = snapshot.ohlc?.close ?? open;

      setSeries1d((prev) => {
        if (!seededRef.current) {
          seededRef.current = true;
          return seed1dFromOhlc({ open, high, low, close }, last);
        }
        const next = [...prev, { t: Date.now(), price: last }];
        return next.slice(-MAX_LIVE_POINTS);
      });
    };

    tick();
    const timer = window.setInterval(tick, pollMs);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [baseStock.id, baseStock.symbol, baseStock.sector, activeRange, pollMs]);

  return { displayStock, series1d, status, liveOhlc };
}
