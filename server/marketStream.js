/**
 * Browser WebSocket → Kite Ticker bridge for sub-second quote updates (REST polling is too slow for “Groww-like” UX).
 */
import jwt from "jsonwebtoken";
import { WebSocketServer } from "ws";
import { KiteTicker } from "kiteconnect";

/** Called after Kite OAuth completes so an already-open WS can subscribe (was no token before). */
let bumpResync = () => {};
export function bumpMarketStreamResync() {
  bumpResync();
}

/**
 * @param {import("node:http").Server} httpServer
 * @param {{
 *   jwtSecret: string;
 *   getUserById: (id: string) => unknown;
 *   getKiteAuth: () => { apiKey: string | undefined; accessToken: string | null };
 *   loadKiteInstruments: () => Promise<Array<Record<string, unknown>>>;
 * }} deps
 */
export function attachMarketStream(httpServer, { jwtSecret, getUserById, getKiteAuth, loadKiteInstruments }) {
  const wss = new WebSocketServer({ noServer: true });

  /** @type {Map<import("ws").WebSocket, Set<string>>} */
  const clients = new Map();

  /** @type {Map<string, number>} */
  let keyToToken = new Map();
  /** @type {Map<number, string>} */
  let tokenToKey = new Map();

  /** @type {Set<number>} */
  let subscribedInstrumentTokens = new Set();
  /** @type {KiteTicker | null} */
  let tickerInstance = null;

  let lookupPromise = null;
  async function refreshLookup() {
    if (lookupPromise) return lookupPromise;
    lookupPromise = (async () => {
      const rows = await loadKiteInstruments();
      const next = new Map();
      for (const r of rows) {
        const t = r.instrument_token;
        if (t == null || !Number.isFinite(Number(t))) continue;
        const ex = String(r.exchange || "").trim();
        const sym = String(r.tradingsymbol || "").trim();
        if (!ex || !sym) continue;
        const key = `${ex}:${sym}`;
        next.set(key, Number(t));
      }
      keyToToken = next;
      tokenToKey = new Map([...next.entries()].map(([k, v]) => [v, k]));
    })();
    try {
      await lookupPromise;
    } finally {
      lookupPromise = null;
    }
  }

  function broadcastTick(key, payload) {
    const msg = JSON.stringify(payload);
    for (const [ws, keys] of clients) {
      if (ws.readyState !== 1) continue;
      if (keys.has(key)) ws.send(msg);
    }
  }

  function handleTicks(ticks) {
    if (!Array.isArray(ticks)) return;
    for (const tick of ticks) {
      const key = tokenToKey.get(tick.instrument_token);
      if (!key) continue;
      const ohlc = tick.ohlc;
      const last = tick.last_price;
      let change = null;
      let changePercent = null;
      if (ohlc && Number(ohlc.close) > 0) {
        change = Number((last - ohlc.close).toFixed(2));
        changePercent = Number((((last - ohlc.close) / ohlc.close) * 100).toFixed(2));
      }
      broadcastTick(key, {
        type: "tick",
        key,
        last_price: last,
        change,
        changePercent,
        ohlc:
          ohlc && ohlc.open != null
            ? {
                open: ohlc.open,
                high: ohlc.high,
                low: ohlc.low,
                close: ohlc.close,
              }
            : undefined,
      });
    }
  }

  async function syncTickerToClients() {
    await refreshLookup();
    const { apiKey, accessToken } = getKiteAuth();
    if (!apiKey || !accessToken) return;

    ensureTicker();

    if (!tickerInstance || !tickerInstance.connected()) return;

    const wantedKeys = new Set();
    for (const set of clients.values()) {
      for (const k of set) wantedKeys.add(k);
    }

    const wantedTokens = new Set();
    for (const k of wantedKeys) {
      const t = keyToToken.get(k);
      if (t != null) wantedTokens.add(t);
    }

    const prev = subscribedInstrumentTokens;
    const toRemove = [...prev].filter((t) => !wantedTokens.has(t));
    const toAdd = [...wantedTokens].filter((t) => !prev.has(t));

    if (toRemove.length) {
      tickerInstance.unsubscribe(toRemove);
      for (const t of toRemove) prev.delete(t);
    }

    const chunk = 250;
    for (let i = 0; i < toAdd.length; i += chunk) {
      const part = toAdd.slice(i, i + chunk);
      tickerInstance.subscribe(part);
      tickerInstance.setMode(tickerInstance.modeQuote, part);
      for (const t of part) prev.add(t);
    }
  }

  let syncTimer = null;
  function scheduleSync() {
    if (syncTimer) return;
    syncTimer = setTimeout(async () => {
      syncTimer = null;
      try {
        await syncTickerToClients();
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn("market stream sync failed:", e?.message || e);
      }
    }, 40);
  }

  bumpResync = () => scheduleSync();

  function handleTickerConnect() {
    subscribedInstrumentTokens.clear();
    scheduleSync();
  }

  function ensureTicker() {
    const { apiKey, accessToken } = getKiteAuth();
    if (!apiKey || !accessToken) return null;

    if (!tickerInstance) {
      tickerInstance = new KiteTicker({
        api_key: apiKey,
        access_token: accessToken,
        reconnect: true,
        max_retry: 300,
        max_delay: 120,
      });
      tickerInstance.on("ticks", handleTicks);
      tickerInstance.on("connect", handleTickerConnect);
      tickerInstance.connect();
    } else if (tickerInstance.access_token !== accessToken) {
      tickerInstance.access_token = accessToken;
      tickerInstance.disconnect();
      tickerInstance.autoReconnect(true, 300, 120);
      tickerInstance.connect();
    }

    return tickerInstance;
  }

  httpServer.on("upgrade", (request, socket, head) => {
    try {
      const host = request.headers.host || "127.0.0.1";
      const url = new URL(request.url || "/", `http://${host}`);
      if (url.pathname !== "/ws/market") {
        socket.destroy();
        return;
      }
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    } catch {
      socket.destroy();
    }
  });

  wss.on("connection", (ws, req) => {
    const host = req.headers.host || "127.0.0.1";
    const parsed = new URL(req.url || "/", `http://${host}`);
    const token = parsed.searchParams.get("token");
    if (!token) {
      ws.close(4001, "missing token");
      return;
    }
    try {
      const payload = jwt.verify(token, jwtSecret);
      const user = getUserById(payload.sub);
      if (!user) {
        ws.close(4002, "invalid user");
        return;
      }
    } catch {
      ws.close(4003, "invalid token");
      return;
    }

    clients.set(ws, new Set());

    ws.on("message", (raw) => {
      let j;
      try {
        j = JSON.parse(raw.toString());
      } catch {
        return;
      }
      if (j.type === "subscribe" && Array.isArray(j.symbols)) {
        const next = new Set(j.symbols.map((s) => String(s || "").trim()).filter(Boolean));
        clients.set(ws, next);
        scheduleSync();
      }
    });

    ws.on("close", () => {
      clients.delete(ws);
      scheduleSync();
    });
  });
}
