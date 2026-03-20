import { useEffect, useMemo, useRef, useState } from "react";
import type { Stock } from "@/data/mockData";
import {
  detectProvider,
  getKiteInstrumentKeysForStocks,
  getLiveStocks,
  KITE_LIVE_POLL_MS,
  KITE_SYMBOL_MAP,
  type LiveStatus,
} from "@/services/marketData";
import { subscribeKiteConnection, subscribeKiteMarket } from "@/services/kiteMarketWsHub";

const REFRESH_MS = 15000;
const TWELVE_DATA_REFRESH_MS = 65000;
/** When Kite WebSocket is up, REST is only a slow safety net. */
const KITE_REST_FALLBACK_MS = 90_000;

export const useLiveStocks = (baseStocks: Stock[]) => {
  const [stocks, setStocks] = useState<Stock[]>(baseStocks);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<LiveStatus>("simulated");
  const [kiteWsConnected, setKiteWsConnected] = useState(false);

  const provider = useMemo(() => detectProvider(), []);
  const stockSymbolsKey = useMemo(() => baseStocks.map((s) => s.symbol).join(","), [baseStocks]);
  const baseStocksRef = useRef(baseStocks);
  baseStocksRef.current = baseStocks;

  useEffect(() => subscribeKiteConnection(setKiteWsConnected), []);

  useEffect(() => {
    setStocks(baseStocksRef.current);
  }, [stockSymbolsKey]);

  /** Kite Ticker → instant list updates (Groww-like). */
  useEffect(() => {
    if (provider !== "kite-backend") return;
    const keys = getKiteInstrumentKeysForStocks(baseStocksRef.current);
    if (keys.length === 0) return;

    return subscribeKiteMarket(keys, (msg) => {
      setStocks((prev) =>
        prev.map((s) => {
          const k = KITE_SYMBOL_MAP[s.symbol];
          if (k !== msg.key) return s;
          const change = msg.change != null ? msg.change : s.change;
          const changePercent = msg.changePercent != null ? msg.changePercent : s.changePercent;
          return {
            ...s,
            price: Number(Number(msg.last_price).toFixed(2)),
            change,
            changePercent,
          };
        }),
      );
      setStatus("live");
    });
  }, [provider, stockSymbolsKey]);

  useEffect(() => {
    let active = true;

    const refresh = async () => {
      setIsLoading(true);
      try {
        const result = await getLiveStocks(baseStocksRef.current);
        if (active) {
          setStocks(result.stocks);
          setStatus(result.status);
        }
      } finally {
        if (active) setIsLoading(false);
      }
    };

    refresh();
    const interval =
      provider === "kite-backend"
        ? kiteWsConnected
          ? KITE_REST_FALLBACK_MS
          : KITE_LIVE_POLL_MS
        : provider === "twelve-data"
          ? TWELVE_DATA_REFRESH_MS
          : REFRESH_MS;
    const timer = window.setInterval(refresh, interval);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [stockSymbolsKey, provider, kiteWsConnected]);

  return { stocks, isLoading, provider, status };
};
