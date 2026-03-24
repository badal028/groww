import { useEffect, useMemo, useState } from "react";
import type { MarketIndex } from "@/data/mockData";
import {
  detectProvider,
  getKiteInstrumentKeysForIndices,
  getLiveIndices,
  KITE_INDEX_SYMBOL_MAP,
  KITE_LIVE_POLL_MS,
  type LiveStatus,
} from "@/services/marketData";
import { subscribeKiteConnection, subscribeKiteMarket } from "@/services/kiteMarketWsHub";

const REFRESH_MS_FALLBACK = 30000;
const KITE_REST_FALLBACK_MS = 90_000;
const zeroIndices = (arr: MarketIndex[]): MarketIndex[] =>
  arr.map((i) => ({ ...i, value: 0, change: 0, changePercent: 0 }));

export const useLiveIndices = (baseIndices: MarketIndex[]) => {
  const [indices, setIndices] = useState<MarketIndex[]>(() => zeroIndices(baseIndices));
  const [status, setStatus] = useState<LiveStatus>("simulated");
  const [kiteWsConnected, setKiteWsConnected] = useState(false);
  const provider = useMemo(() => detectProvider(), []);
  const indexNamesKey = useMemo(() => baseIndices.map((i) => i.name).join(","), [baseIndices]);

  useEffect(() => subscribeKiteConnection(setKiteWsConnected), []);

  useEffect(() => {
    setIndices(zeroIndices(baseIndices));
  }, [baseIndices]);

  useEffect(() => {
    if (provider !== "kite-backend") return;
    const keys = getKiteInstrumentKeysForIndices(baseIndices);
    if (keys.length === 0) return;

    return subscribeKiteMarket(keys, (msg) => {
      setIndices((prev) =>
        prev.map((i) => {
          const k = KITE_INDEX_SYMBOL_MAP[i.name];
          if (k !== msg.key) return i;
          const change = msg.change != null ? msg.change : i.change;
          const changePercent = msg.changePercent != null ? msg.changePercent : i.changePercent;
          return {
            ...i,
            value: Number(Number(msg.last_price).toFixed(2)),
            change,
            changePercent,
          };
        }),
      );
      setStatus("live");
    });
  }, [provider, indexNamesKey, baseIndices]);

  useEffect(() => {
    let active = true;

    const refresh = async () => {
      const result = await getLiveIndices(baseIndices);
      if (!active) return;
      setIndices(result.indices);
      setStatus(result.status);
    };

    refresh();
    const interval =
      provider === "kite-backend"
        ? kiteWsConnected
          ? KITE_REST_FALLBACK_MS
          : KITE_LIVE_POLL_MS
        : REFRESH_MS_FALLBACK;
    const timer = window.setInterval(refresh, interval);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [baseIndices, provider, kiteWsConnected]);

  return { indices, status };
};
