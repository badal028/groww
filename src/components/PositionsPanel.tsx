import React, { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  additionalSearchStocks,
  etfStocks,
  holdingsData,
  marketIndices,
  popularStocks,
  type Stock,
} from "@/data/mockData";
import type { PaperPosition } from "@/hooks/usePaperPositions";
import { usePositionMktPrices } from "@/hooks/usePositionMktPrices";
import { ListFilter, LineChart, SquareArrowUpRight, LayoutList } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { PAPER_POSITIONS_REFRESH_EVENT } from "@/hooks/usePaperTrading";
import { toast } from "sonner";
import SwipeRevealExit from "@/components/SwipeRevealExit";
import PositionActionSheet from "@/components/PositionActionSheet";
import FoTradeModal from "@/components/fo/FoTradeModal";
import FoOptionChainModal, { type FoContract } from "@/components/fo/FoOptionChainModal";

const apiBase = import.meta.env.VITE_MARKET_DATA_API_BASE || "http://127.0.0.1:3001";

function normSym(x: string): string {
  return x.replace(/\s+/g, " ").trim().toUpperCase();
}

/** Map equity symbol or index name (e.g. NIFTY 50) to `/stock/:id` route id. */
function resolveStockIdFromPosition(p: PaperPosition): string | null {
  const sym = normSym(p.symbol);
  const lists = [...popularStocks, ...holdingsData, ...etfStocks, ...additionalSearchStocks];
  const eq = lists.find((s) => normSym(s.symbol) === sym);
  if (eq) return eq.id;
  const idx = marketIndices.find((i) => normSym(i.name) === sym);
  if (idx) return idx.name;
  return null;
}

function formatPositionTitle(p: PaperPosition): string {
  if (p.instrumentType === "FO" && p.expiry && p.strike != null && p.optionType) {
    const d = new Date(`${p.expiry}T00:00:00Z`);
    const day = d.getUTCDate();
    const mon = d.toLocaleString("en-IN", { month: "short", timeZone: "UTC" });
    const opt = p.optionType === "CE" ? "Call" : "Put";
    return `${p.symbol} ${day} ${mon} ${p.strike} ${opt}`;
  }
  return p.symbol;
}

function productLine(p: PaperPosition): string {
  return String(p.instrumentType).toUpperCase() === "FO" ? "NRML · NFO" : "Delivery · NSE";
}

function positionToFoContract(p: PaperPosition, mkt: number): FoContract | null {
  if (String(p.instrumentType).toUpperCase() !== "FO" || !p.expiry || p.strike == null || !p.optionType) {
    return null;
  }
  const exp = String(p.expiry).slice(0, 10);
  const d = new Date(`${exp}T00:00:00Z`);
  const day = d.getUTCDate();
  const mon = d.toLocaleString("en-IN", { month: "short", timeZone: "UTC" });
  const opt = p.optionType === "CE" ? "Call" : "Put";
  const label = `${p.symbol} ${day} ${mon} ${p.strike} ${opt}`;
  return {
    id: p.instrumentKey,
    underlyingSymbol: p.symbol,
    expiry: exp,
    optionType: p.optionType,
    strike: p.strike,
    label,
    tradingSymbol: p.kiteSymbol || p.instrumentKey,
    kiteSymbol: p.kiteSymbol,
    lastPrice: mkt,
  };
}

function buildUnderlyingStock(p: PaperPosition, mkt: number): Stock | null {
  const id = resolveStockIdFromPosition(p);
  if (!id) return null;
  const sym = normSym(p.symbol);
  const idx = marketIndices.find((i) => normSym(i.name) === sym);
  if (idx) {
    return {
      id: idx.name,
      name: idx.name,
      symbol: idx.name,
      price: mkt,
      change: idx.change,
      changePercent: idx.changePercent,
      sector: "Index",
      exchange: idx.name === "SENSEX" ? "BSE" : "NSE",
    };
  }
  const lists = [...popularStocks, ...holdingsData, ...etfStocks, ...additionalSearchStocks];
  const eq = lists.find((s) => normSym(s.symbol) === sym);
  return eq ? { ...eq, price: mkt } : null;
}

function formatPnl(n: number): string {
  const s = `${n >= 0 ? "+" : ""}₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return s;
}

type Props = {
  positions: PaperPosition[];
  loading: boolean;
  className?: string;
  /** Tighter paddings / toolbar for mobile */
  compact?: boolean;
};

const PositionsPanel: React.FC<Props> = ({ positions, loading, className, compact }) => {
  const navigate = useNavigate();
  const { token, refreshMe } = useAuth();
  const [exitingKey, setExitingKey] = useState<string | null>(null);
  const { mktByInstrumentKey } = usePositionMktPrices(positions);
  const [sheetCtx, setSheetCtx] = useState<{ p: PaperPosition; mkt: number; pnl: number } | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [foTradeOpen, setFoTradeOpen] = useState(false);
  const [foContract, setFoContract] = useState<FoContract | null>(null);
  const [foOpenWithSide, setFoOpenWithSide] = useState<"BUY" | "SELL">("BUY");
  const [ocOpen, setOcOpen] = useState(false);
  const [ocStock, setOcStock] = useState<Stock | null>(null);

  const rows = useMemo(() => {
    return positions
      .map((p, idx) => {
        const mkt = mktByInstrumentKey[p.instrumentKey] ?? p.avgPrice;
        const pnl = p.exited ? Number(p.realizedPnlInr ?? 0) : (mkt - p.avgPrice) * p.quantity;
        return { p, mkt, pnl, idx };
      })
      .sort((a, b) => {
        // Keep open positions on top, closed positions at the bottom.
        if (Boolean(a.p.exited) !== Boolean(b.p.exited)) return a.p.exited ? 1 : -1;

        // Newest open positions first (latest appended row appears at top).
        if (!a.p.exited) return b.idx - a.idx;

        // For closed positions, prefer latest exit first; fallback to original order.
        const aExitedAt = a.p.exitedAt ? Date.parse(a.p.exitedAt) : Number.NaN;
        const bExitedAt = b.p.exitedAt ? Date.parse(b.p.exitedAt) : Number.NaN;
        if (Number.isFinite(aExitedAt) && Number.isFinite(bExitedAt) && aExitedAt !== bExitedAt) {
          return bExitedAt - aExitedAt;
        }
        return b.idx - a.idx;
      });
  }, [positions, mktByInstrumentKey]);

  // Total P&L in Positions should reflect visible rows only:
  // open MTM + today's exited realized rows. Old exited rows are pruned by backend.
  const totalPnl = useMemo(() => rows.reduce((s, r) => s + r.pnl, 0), [rows]);

  const exitPositionAt = useCallback(
    async (instrumentKey: string, exitPrice: number, p: PaperPosition) => {
      if (!token) {
        toast.error("Sign in to exit positions");
        return;
      }
      setExitingKey(instrumentKey);
      try {
        const res = await fetch(`${apiBase}/paper/position/close`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            instrumentKey,
            exitPrice: Number(exitPrice.toFixed(4)),
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.message || "Could not exit position");
        await refreshMe();
        window.dispatchEvent(new Event(PAPER_POSITIONS_REFRESH_EVENT));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Exit failed");
      } finally {
        setExitingKey(null);
      }
    },
    [token, refreshMe],
  );

  const openDetail = (p: PaperPosition) => {
    const id = resolveStockIdFromPosition(p);
    if (id) {
      navigate(`/stock/${encodeURIComponent(id)}`);
      return;
    }
    toast.message("Open the underlying on Explore", {
      description: "Index / F&O legs open the index or symbol page when available.",
    });
  };

  const closeSheet = () => setSheetOpen(false);

  const openPositionSheet = (ctx: { p: PaperPosition; mkt: number; pnl: number }) => {
    setSheetCtx(ctx);
    setSheetOpen(true);
  };

  const openFoTradeFromSheet = (side: "BUY" | "SELL") => {
    if (!sheetCtx) return;
    const c = positionToFoContract(sheetCtx.p, sheetCtx.mkt);
    if (!c) return;
    setFoOpenWithSide(side);
    setFoContract(c);
    setFoTradeOpen(true);
    closeSheet();
  };

  const goStockFromSheet = (query: string) => {
    if (!sheetCtx) return;
    const id = resolveStockIdFromPosition(sheetCtx.p);
    closeSheet();
    if (id) navigate(`/stock/${encodeURIComponent(id)}${query}`);
  };

  const pnlCard = (
    <div className="flex items-center justify-between gap-3 rounded-2xl border-0 bg-card px-4 py-4 dark:bg-[#232425]">
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Total P&amp;L
        </p>
        <p
          className={cn(
            "mt-1 text-[13px] font-bold tabular-nums leading-none tracking-tight lg:text-[1.75rem]",
            totalPnl >= 0 ? "text-profit" : "text-loss",
          )}
        >
          {formatPnl(totalPnl)}
        </p>
      </div>
      <button
        type="button"
        className="flex shrink-0 items-center gap-1 text-xs font-medium text-profit hover:underline"
      >
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-profit/15 text-[10px]">
          ₹
        </span>
        Set Safe Exit
      </button>
    </div>
  );

  if (!loading && positions.length === 0) {
    return (
      <div className={cn("py-8 text-sm text-muted-foreground", className)}>
        No positions yet. Place a trade to see them here.
      </div>
    );
  }

  if (loading && positions.length === 0) {
    return <div className={cn(className)} aria-busy="true" />;
  }

  return (
    <>
    <div className={cn("space-y-4", className)}>
      {pnlCard}

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          className="rounded-lg p-2 pl-0 text-muted-foreground hover:bg-muted"
          aria-label="Filter"
        >
          <ListFilter className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="rounded-lg p-2 text-muted-foreground hover:bg-muted"
            aria-label="Analytics"
          >
            <LineChart className="h-5 w-5" />
          </button>
          <button
            type="button"
            className="rounded-lg p-2 text-muted-foreground hover:bg-muted"
            aria-label="Exit"
          >
            <SquareArrowUpRight className="h-5 w-5" />
          </button>
          <button
            type="button"
            className="rounded-lg bg-primary p-2 text-primary-foreground"
            aria-label="List view"
          >
            <LayoutList className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* List */}
      <div
        className={cn(
          "overflow-hidden rounded-2xl border-0 bg-card dark:bg-[#0F1012]",
          compact && "rounded-xl",
        )}
      >
        {rows.map(({ p, mkt, pnl }) => {
          const rowInner = (
            <>
              <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                <span>{productLine(p)}</span>
                <div className="flex shrink-0 items-center gap-1.5">
                  {!p.exited && (
                    <button
                      type="button"
                      title="Exit at current market (paper)"
                      disabled={!token || exitingKey === p.instrumentKey}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        void exitPositionAt(p.instrumentKey, mkt, p);
                      }}
                      className="hidden rounded-md border border-border bg-muted/40 px-2 py-0.5 text-[10px] font-semibold text-foreground hover:bg-muted disabled:opacity-40 lg:inline-flex"
                    >
                      {exitingKey === p.instrumentKey ? "…" : "Exit"}
                    </button>
                  )}
                  <span className="rounded bg-profit/20 px-1.5 py-0.5 text-[10px] font-semibold text-profit">
                    B &gt;
                  </span>
                </div>
              </div>
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 flex-1 text-[12px] font-semibold leading-snug text-foreground">
                  {formatPositionTitle(p)}
                </p>
                <p
                  className={cn(
                    "shrink-0 text-[12px] font-semibold tabular-nums leading-none lg:text-lg",
                    pnl >= 0 ? "text-profit" : "text-loss",
                  )}
                >
                  {pnl >= 0 ? "+" : ""}₹{pnl.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                </p>
              </div>
              <div className="flex items-center justify-between text-[12px] text-muted-foreground">
                <span>Avg ₹{Number(p.avgPrice || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                <span>Mkt ₹{mkt.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              </div>
            </>
          );

          return (
            <SwipeRevealExit
              key={p.instrumentKey}
              enabled={Boolean(compact) && !p.exited}
              disabled={!token || exitingKey === p.instrumentKey}
              onExit={() => void exitPositionAt(p.instrumentKey, mkt, p)}
              className="border-b border-border last:border-b-0"
            >
              <div
                role="button"
                tabIndex={0}
                onClick={() => {
                  if (p.exited) return;
                  if (compact) openPositionSheet({ p, mkt, pnl });
                  else openDetail(p);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    if (p.exited) return;
                    if (compact) openPositionSheet({ p, mkt, pnl });
                    else openDetail(p);
                  }
                }}
                className={cn(
                  "flex w-full flex-col gap-2 py-3 text-left",
                  p.exited ? "opacity-70" : "",
                )}
              >
                {rowInner}
              </div>
            </SwipeRevealExit>
          );
        })}
      </div>
    </div>

    <PositionActionSheet
      open={sheetOpen}
      onOpenChange={(o) => {
        setSheetOpen(o);
        if (!o) window.setTimeout(() => setSheetCtx(null), 320);
      }}
      position={sheetCtx?.p ?? null}
      mkt={sheetCtx?.mkt ?? 0}
      pnl={sheetCtx?.pnl ?? 0}
      onChart={() => goStockFromSheet("")}
      onOptionChain={() => {
        if (!sheetCtx) return;
        const st = buildUnderlyingStock(sheetCtx.p, sheetCtx.mkt);
        closeSheet();
        if (st) {
          setOcStock(st);
          setOcOpen(true);
        }
      }}
      onPositionDetails={() => goStockFromSheet("")}
      onSell={() => {
        if (!sheetCtx) return;
        if (positionToFoContract(sheetCtx.p, sheetCtx.mkt)) openFoTradeFromSheet("SELL");
        else {
          const id = resolveStockIdFromPosition(sheetCtx.p);
          closeSheet();
          if (id) navigate(`/stock/${encodeURIComponent(id)}?orderSide=SELL`);
        }
      }}
      onBuy={() => {
        if (!sheetCtx) return;
        if (positionToFoContract(sheetCtx.p, sheetCtx.mkt)) openFoTradeFromSheet("BUY");
        else {
          const id = resolveStockIdFromPosition(sheetCtx.p);
          closeSheet();
          if (id) navigate(`/stock/${encodeURIComponent(id)}?orderSide=BUY`);
        }
      }}
    />

    <FoTradeModal
      open={foTradeOpen}
      onOpenChange={(o) => {
        setFoTradeOpen(o);
        if (!o) setFoContract(null);
      }}
      contract={foContract}
      openWithSide={foOpenWithSide}
    />

    {ocStock ? (
      <FoOptionChainModal
        open={ocOpen}
        onOpenChange={(o) => {
          setOcOpen(o);
          if (!o) setOcStock(null);
        }}
        underlying={ocStock}
        expiryLabel="—"
        onSelect={(contract) => {
          setFoContract(contract);
          setFoOpenWithSide("BUY");
          setFoTradeOpen(true);
          setOcOpen(false);
          setOcStock(null);
        }}
      />
    ) : null}
    </>
  );
};

export default PositionsPanel;
