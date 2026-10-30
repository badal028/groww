import { useEffect, useMemo, useSyncExternalStore } from "react";
import { API_BASE, api, getToken } from "./api";
import type { DepthLevel, Quote } from "./types";

/* ---------------- quote store ---------------- */

const quotes = new Map<string, Quote>();
const listeners = new Set<() => void>();
let version = 0;
let notifyScheduled = false;

function notify() {
  if (notifyScheduled) return;
  notifyScheduled = true;
  requestAnimationFrame(() => {
    notifyScheduled = false;
    version++;
    for (const l of listeners) l();
  });
}

function patchQuote(key: string, patch: Partial<Quote>) {
  const prev = quotes.get(key) || { last: 0, change: 0, changePct: 0 };
  const next: Quote = { ...prev, ...patch };
  const close = next.close;
  if (close && close > 0 && patch.last != null) {
    next.change = Number((next.last - close).toFixed(2));
    next.changePct = Number((((next.last - close) / close) * 100).toFixed(2));
  }
  quotes.set(key, next);
  notify();
}

export const getQuote = (key: string | null | undefined): Quote | undefined => (key ? quotes.get(key) : undefined);

const subscribeStore = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const getVersion = () => version;

/* ---------------- REST snapshots ---------------- */

const mapDepth = (arr: any[] | undefined): DepthLevel[] =>
  (Array.isArray(arr) ? arr : []).slice(0, 5).map((d) => ({
    price: Number(d?.price || 0),
    quantity: Number(d?.quantity || 0),
    orders: Number(d?.orders || 0),
  }));

function applyRestQuote(key: string, q: any) {
  if (!q) return;
  const last = Number(q.last_price ?? 0);
  const ohlc = q.ohlc || {};
  patchQuote(key, {
    last,
    open: Number(ohlc.open ?? 0),
    high: Number(ohlc.high ?? 0),
    low: Number(ohlc.low ?? 0),
    close: Number(ohlc.close ?? 0),
    volume: q.volume != null ? Number(q.volume) : undefined,
    avgPrice: q.average_price != null ? Number(q.average_price) : undefined,
    lastQty: q.last_quantity != null ? Number(q.last_quantity) : undefined,
    lastTradeTime: q.last_trade_time ? String(q.last_trade_time) : undefined,
    lowerCircuit: q.lower_circuit_limit != null ? Number(q.lower_circuit_limit) : undefined,
    upperCircuit: q.upper_circuit_limit != null ? Number(q.upper_circuit_limit) : undefined,
    oi: q.oi != null ? Number(q.oi) : undefined,
    buyQty: q.buy_quantity != null ? Number(q.buy_quantity) : undefined,
    sellQty: q.sell_quantity != null ? Number(q.sell_quantity) : undefined,
    depth: q.depth ? { buy: mapDepth(q.depth.buy), sell: mapDepth(q.depth.sell) } : undefined,
  });
}

export async function fetchQuotes(keys: string[]) {
  const uniq = [...new Set(keys.filter(Boolean))];
  for (let i = 0; i < uniq.length; i += 150) {
    const part = uniq.slice(i, i + 150);
    try {
      const res = await api<{ quotes: Record<string, any> }>(
        `/api/quotes?symbols=${encodeURIComponent(part.join(","))}`,
      );
      for (const k of part) applyRestQuote(k, res.quotes?.[k]);
    } catch {
      /* keep previous values */
    }
  }
}

/* ---------------- WebSocket ---------------- */

type Entry = { keys: Set<string> };
let socket: WebSocket | null = null;
let entries: Entry[] = [];
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

const wsBase = () => {
  if (API_BASE.startsWith("https://")) return `wss://${API_BASE.slice(8)}`;
  if (API_BASE.startsWith("http://")) return `ws://${API_BASE.slice(7)}`;
  return API_BASE;
};

const unionKeys = () => {
  const u = new Set<string>();
  for (const e of entries) for (const k of e.keys) u.add(k);
  return [...u];
};

function sendSubscribe() {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify({ type: "subscribe", symbols: unionKeys() }));
}

function openSocket() {
  const token = getToken();
  if (!token || entries.length === 0) return;
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return;
  const s = new WebSocket(`${wsBase()}/ws/market?token=${encodeURIComponent(token)}`);
  socket = s;
  s.onopen = () => sendSubscribe();
  s.onmessage = (ev) => {
    try {
      const j = JSON.parse(String(ev.data));
      if (j?.type !== "tick" || !j.key) return;
      const patch: Partial<Quote> = { last: Number(j.last_price) };
      if (j.ohlc) {
        patch.open = Number(j.ohlc.open);
        patch.high = Number(j.ohlc.high);
        patch.low = Number(j.ohlc.low);
        patch.close = Number(j.ohlc.close);
      }
      patchQuote(j.key, patch);
    } catch {
      /* ignore */
    }
  };
  s.onclose = () => {
    if (socket === s) socket = null;
    if (entries.length && !reconnectTimer) {
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        openSocket();
      }, 1800);
    }
  };
}

function subscribeKeys(keys: string[]) {
  const entry: Entry = { keys: new Set(keys.filter(Boolean)) };
  entries.push(entry);
  openSocket();
  sendSubscribe();
  return () => {
    entries = entries.filter((e) => e !== entry);
    sendSubscribe();
  };
}

export function closeMarketSocket() {
  entries = [];
  if (socket) socket.close();
  socket = null;
}

/* ---------------- hooks ---------------- */

/** Live quotes for keys: REST snapshot on change + WebSocket ticks. */
export function useLiveQuotes(keys: string[], opts: { pollMs?: number } = {}) {
  const sig = useMemo(() => [...new Set(keys.filter(Boolean))].sort().join("|"), [keys]);
  useSyncExternalStore(subscribeStore, getVersion);
  useEffect(() => {
    const list = sig ? sig.split("|") : [];
    if (!list.length) return;
    void fetchQuotes(list);
    const unsub = subscribeKeys(list);
    let timer: ReturnType<typeof setInterval> | null = null;
    if (opts.pollMs) timer = setInterval(() => void fetchQuotes(list), opts.pollMs);
    return () => {
      unsub();
      if (timer) clearInterval(timer);
    };
  }, [sig, opts.pollMs]);
  return getQuote;
}
