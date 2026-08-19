import { useEffect, useMemo, useState } from "react";
import { detectProvider } from "@/services/marketData";

const apiBase = import.meta.env.VITE_MARKET_DATA_API_BASE || "http://127.0.0.1:3001";

/** True when today (IST) is the nearest F&O expiry for that index (NIFTY 50, BANK NIFTY, SENSEX). */
export function useIndexFoExpiryTags(indexNames: string[]): Record<string, boolean> {
  const [tags, setTags] = useState<Record<string, boolean>>({});
  const provider = useMemo(() => detectProvider(), []);
  const namesKey = useMemo(() => indexNames.join(","), [indexNames]);

  useEffect(() => {
    if (provider !== "kite-backend") return;

    let active = true;
    const load = async () => {
      try {
        const res = await fetch(`${apiBase}/api/index-fo-expiry-tags`);
        const data = await res.json().catch(() => ({}));
        if (!active || !res.ok || data?.status !== "ok") return;
        setTags(typeof data.tags === "object" && data.tags ? data.tags : {});
      } catch {
        // Kite not ready or offline — no expiry tags
      }
    };

    void load();
    const timer = window.setInterval(load, 5 * 60 * 1000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [provider, namesKey]);

  return tags;
}
