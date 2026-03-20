const TOKEN_KEY = "paper_auth_token";

export type KiteWsTick = {
  type: "tick";
  key: string;
  last_price: number;
  change: number | null;
  changePercent: number | null;
  ohlc?: { open: number; high: number; low: number; close: number };
};

type Entry = { keys: Set<string>; onTick: (t: KiteWsTick) => void };

let socket: WebSocket | null = null;
let entries: Entry[] = [];
const connectionListeners = new Set<(c: boolean) => void>();

let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

function notifyConn(c: boolean) {
  for (const f of connectionListeners) f(c);
}

function httpToWsBase(): string {
  const b = import.meta.env.VITE_MARKET_DATA_API_BASE || "http://127.0.0.1:3001";
  if (b.startsWith("https://")) return `wss://${b.slice(8)}`;
  if (b.startsWith("http://")) return `ws://${b.slice(7)}`;
  return b;
}

function rebuildUnion(): string[] {
  const u = new Set<string>();
  for (const e of entries) {
    for (const k of e.keys) u.add(k);
  }
  return [...u];
}

function sendSubscribe() {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  const symbols = rebuildUnion();
  socket.send(JSON.stringify({ type: "subscribe", symbols }));
}

function handleMessage(ev: MessageEvent) {
  try {
    const j = JSON.parse(String(ev.data)) as KiteWsTick & { type?: string };
    if (j.type !== "tick" || !j.key) return;
    for (const e of entries) {
      if (e.keys.has(j.key)) e.onTick(j as KiteWsTick);
    }
  } catch {
    /* ignore */
  }
}

function scheduleReconnect() {
  if (entries.length === 0) return;
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    if (entries.length === 0) return;
    openSocketIfNeeded();
  }, 1800);
}

function openSocketIfNeeded() {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token || entries.length === 0) return;

  if (socket?.readyState === WebSocket.OPEN || socket?.readyState === WebSocket.CONNECTING) return;

  const url = `${httpToWsBase()}/ws/market?token=${encodeURIComponent(token)}`;
  const s = new WebSocket(url);
  socket = s;

  s.onopen = () => {
    notifyConn(true);
    sendSubscribe();
  };
  s.onmessage = handleMessage;
  s.onerror = () => {
    notifyConn(false);
  };
  s.onclose = () => {
    notifyConn(false);
    socket = null;
    scheduleReconnect();
  };
}

/**
 * Subscribe to live ticks for the given Kite instrument keys (e.g. NSE:RELIANCE).
 * One shared WebSocket; union of all subscriber keys is sent to the server.
 */
export function subscribeKiteMarket(keys: string[], onTick: (t: KiteWsTick) => void): () => void {
  const keySet = new Set(keys.filter(Boolean));
  const entry: Entry = { keys: keySet, onTick };
  entries.push(entry);
  openSocketIfNeeded();
  sendSubscribe();

  return () => {
    entries = entries.filter((e) => e !== entry);
    sendSubscribe();
    if (entries.length === 0 && socket) {
      socket.close();
      socket = null;
      notifyConn(false);
    }
  };
}

export function subscribeKiteConnection(listener: (connected: boolean) => void): () => void {
  connectionListeners.add(listener);
  listener(socket?.readyState === WebSocket.OPEN);
  return () => connectionListeners.delete(listener);
}
