import React, { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import type { Stock } from "@/data/mockData";
import { toast } from "sonner";
import { detectProvider } from "@/services/marketData";
import { subscribeKiteMarket } from "@/services/kiteMarketWsHub";

export type FoContract = {
  id: string;
  underlyingSymbol: string;
  expiry: string; // YYYY-MM-DD
  optionType: "CE" | "PE";
  strike: number;
  label: string; // e.g. "SENSEX 19 Mar 73400 Call"
  tradingSymbol: string;
  lastPrice: number;
  /** Exchange lot (qty step); default 25 in trade UI if omitted */
  lotSize?: number;
};

type ExpiryOption = { iso: string; label: string };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  underlying: Stock;
  expiryLabel: string; // fallback label before first load
  onSelect: (contract: FoContract) => void;
};

export default function FoOptionChainModal({
  open,
  onOpenChange,
  underlying,
  expiryLabel,
  onSelect,
}: Props) {
  const [isDesktop, setIsDesktop] = useState<boolean>(() =>
    typeof window !== "undefined" ? window.matchMedia("(min-width: 1024px)").matches : false,
  );
  const apiBase = import.meta.env.VITE_MARKET_DATA_API_BASE || "http://127.0.0.1:3001";
  const [rows, setRows] = useState<
    Array<{
      strike: number;
      CE: FoContract | null;
      PE: FoContract | null;
    }>
  >([]);
  const [loading, setLoading] = useState(false);
  const [apiExpiryLabel, setApiExpiryLabel] = useState(expiryLabel);
  /** null = let server pick default expiry (omit query param) */
  const [expiryOverride, setExpiryOverride] = useState<string | null>(null);
  /** Current chain expiry from last successful response (for Select display when override is null) */
  const [activeExpiryISO, setActiveExpiryISO] = useState("");
  const [expiries, setExpiries] = useState<ExpiryOption[]>([]);

  const requestUnderlying = underlying.symbol;
  const provider = useMemo(() => detectProvider(), []);

  // Reset when sheet closes so reopening doesn’t reuse a stale expiry (avoids wrong first fetch).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(min-width: 1024px)");
    const onChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    setIsDesktop(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (open) return;
    setExpiryOverride(null);
    setActiveExpiryISO("");
    setExpiries([]);
    setRows([]);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        const qs = new URLSearchParams({
          underlying: requestUnderlying,
          strikeCount: "7",
        });
        if (expiryOverride) qs.set("expiryISO", expiryOverride);

        const res = await fetch(`${apiBase}/api/options-chain?${qs.toString()}`);
        if (res.status === 401) {
          toast.error("Kite not authenticated. Connect Kite first.");
          onOpenChange(false);
          return;
        }
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.message || "Options chain failed");
        }
        const data = await res.json();
        if (cancelled) return;

        setApiExpiryLabel(String(data?.expiryLabel || expiryLabel));
        setActiveExpiryISO(String(data?.expiryISO || ""));
        setExpiries(Array.isArray(data?.expiries) ? data.expiries : []);

        const mappedRows = (data?.rows || []).map((r: any) => ({
          strike: Number(r.strike),
          CE: r.CE
            ? {
                id: `${r.CE.strike}-CE-${data.expiryISO}`,
                underlyingSymbol: requestUnderlying,
                expiry: r.CE.expiryISO,
                optionType: "CE" as const,
                strike: Number(r.CE.strike),
                label: `${requestUnderlying} ${data.expiryLabel} ${r.CE.strike} Call`,
                tradingSymbol: r.CE.tradingSymbol,
                kiteSymbol: String(r.CE.kiteSymbol || ""),
                lastPrice: Number(r.CE.lastPrice ?? 0),
              }
            : null,
          PE: r.PE
            ? {
                id: `${r.PE.strike}-PE-${data.expiryISO}`,
                underlyingSymbol: requestUnderlying,
                expiry: r.PE.expiryISO,
                optionType: "PE" as const,
                strike: Number(r.PE.strike),
                label: `${requestUnderlying} ${data.expiryLabel} ${r.PE.strike} Put`,
                tradingSymbol: r.PE.tradingSymbol,
                kiteSymbol: String(r.PE.kiteSymbol || ""),
                lastPrice: Number(r.PE.lastPrice ?? 0),
              }
            : null,
        }));
        setRows(mappedRows);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Failed to load options chain";
        toast.error(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  // `onOpenChange` is an inline function from the parent and changes identity on every re-render.
  // If we keep it in deps, the effect re-runs and repeatedly fetches options-chain (causing flicker).
  }, [open, requestUnderlying, expiryOverride, apiBase, expiryLabel]);

  /** Stable instrument set for WS (must not depend on row identity / price-only updates). */
  const optionStreamKeysSig = useMemo(() => {
    if (!rows.length) return "";
    const keys = new Set<string>();
    for (const row of rows) {
      if (row.CE?.kiteSymbol) keys.add(row.CE.kiteSymbol);
      if (row.PE?.kiteSymbol) keys.add(row.PE.kiteSymbol);
    }
    const list = [...keys].filter(Boolean).sort();
    return list.length ? JSON.stringify(list) : "";
  }, [rows]);

  /** Live CE/PE premiums via same Kite ticker bridge as equities. */
  useEffect(() => {
    if (!open || provider !== "kite-backend" || loading || !optionStreamKeysSig) return;
    let list: string[] = [];
    try {
      list = JSON.parse(optionStreamKeysSig) as string[];
    } catch {
      return;
    }
    if (!Array.isArray(list) || list.length === 0) return;

    return subscribeKiteMarket(list, (msg) => {
      const k = msg.key;
      const px = Number(Number(msg.last_price).toFixed(2));
      if (!Number.isFinite(px) || px < 0) return;

      setRows((prev) =>
        prev.map((row) => {
          let next = row;
          if (row.CE?.kiteSymbol === k) {
            next = {
              ...next,
              CE: next.CE ? { ...next.CE, lastPrice: px } : null,
            };
          }
          if (row.PE?.kiteSymbol === k) {
            next = {
              ...next,
              PE: next.PE ? { ...next.PE, lastPrice: px } : null,
            };
          }
          return next;
        }),
      );
    });
  }, [open, provider, loading, optionStreamKeysSig]);

  /** Value shown in dropdown; must match an option `value` (YYYY-MM-DD). */
  const selectValue = (expiryOverride ?? activeExpiryISO).slice(0, 10);
  const currentIso = activeExpiryISO.slice(0, 10);
  const nextExpiryIso =
    expiries
      .filter((e) => currentIso && e.iso > currentIso)
      .sort((a, b) => a.iso.localeCompare(b.iso))[0]?.iso ?? "";

  const expiryDropdown = (
    <div className="mt-2 w-full max-w-[280px]">
      <label className="mb-1 block text-xs font-medium text-muted-foreground">
        Switch expiry (next &amp; upcoming)
      </label>
      <select
        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        value={expiries.some((e) => e.iso === selectValue) ? selectValue : ""}
        onChange={(e) => {
          const v = e.target.value;
          if (v) setExpiryOverride(v);
        }}
        disabled={loading || expiries.length === 0}
      >
        {(loading || !expiries.some((e) => e.iso === selectValue)) && (
          <option value="" disabled>
            {loading ? "Loading expiries…" : expiries.length === 0 ? "No expiries" : "Choose expiry"}
          </option>
        )}
        {expiries.map((e) => (
          <option key={e.iso} value={e.iso}>
            {e.label}
            {e.iso === currentIso ? " (current)" : ""}
            {e.iso === nextExpiryIso ? " (next)" : ""}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <>
      {/* Desktop modal */}
      {isDesktop && (
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogContent
            className="max-h-[90vh] max-w-3xl overflow-y-auto"
            overlayClassName="bg-black/45"
            showCloseButton={false}
          >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-muted-foreground">Options</p>
              <h2 className="text-lg font-semibold text-foreground">
                {underlying.symbol} {apiExpiryLabel}
              </h2>
              {expiryDropdown}
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="shrink-0 rounded-md border border-border bg-card px-3 py-1 text-sm text-foreground"
            >
              Close
            </button>
          </div>

          <div className="mt-4 overflow-auto rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between px-4 py-3 text-xs text-muted-foreground">
              <span>Call</span>
              <span className="font-semibold text-foreground">Strike</span>
              <span>Put</span>
            </div>

            <div className="divide-y divide-border">
              {loading ? (
                <div className="px-4 py-6 text-sm text-muted-foreground">Loading options...</div>
              ) : (
                rows.map((row) => (
                  <div key={row.strike} className="grid grid-cols-3 items-center px-4 py-3">
                    <button
                      type="button"
                      className="text-left text-sm text-profit disabled:opacity-50"
                      disabled={!row.CE}
                      onClick={() => row.CE && onSelect(row.CE)}
                    >
                      {row.CE ? `₹${row.CE.lastPrice.toFixed(2)}` : "—"}
                    </button>
                    <div className="text-center text-sm font-semibold text-foreground">{row.strike}</div>
                    <button
                      type="button"
                      className="text-right text-sm text-loss disabled:opacity-50"
                      disabled={!row.PE}
                      onClick={() => row.PE && onSelect(row.PE)}
                    >
                      {row.PE ? `₹${row.PE.lastPrice.toFixed(2)}` : "—"}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Mobile bottom sheet */}
      {!isDesktop && (
        <Sheet open={open} onOpenChange={onOpenChange}>
          <SheetContent side="bottom" showCloseButton={false}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-muted-foreground">Options</p>
              <h2 className="text-lg font-semibold text-foreground">
                {underlying.symbol} {apiExpiryLabel}
              </h2>
              {expiryDropdown}
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="shrink-0 rounded-md border border-border bg-card px-3 py-1 text-sm text-foreground"
            >
              Close
            </button>
          </div>

          <div className="mt-4 max-h-[65vh] overflow-auto rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between px-4 py-3 text-xs text-muted-foreground">
              <span>Call</span>
              <span className="font-semibold text-foreground">Strike</span>
              <span>Put</span>
            </div>
            <div className="divide-y divide-border">
              {loading ? (
                <div className="px-4 py-6 text-sm text-muted-foreground">Loading options...</div>
              ) : (
                rows.map((row) => (
                  <div key={row.strike} className="grid grid-cols-3 items-center px-4 py-3">
                    <button
                      type="button"
                      className="text-left text-sm text-profit disabled:opacity-50"
                      disabled={!row.CE}
                      onClick={() => row.CE && onSelect(row.CE)}
                    >
                      {row.CE ? `₹${row.CE.lastPrice.toFixed(2)}` : "—"}
                    </button>
                    <div className="text-center text-sm font-semibold text-foreground">{row.strike}</div>
                    <button
                      type="button"
                      className="text-right text-sm text-loss disabled:opacity-50"
                      disabled={!row.PE}
                      onClick={() => row.PE && onSelect(row.PE)}
                    >
                      {row.PE ? `₹${row.PE.lastPrice.toFixed(2)}` : "—"}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
          </SheetContent>
        </Sheet>
      )}
    </>
  );
}
