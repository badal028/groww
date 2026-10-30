import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { InstrumentName, fallbackInstrument } from "@/components/InstrumentName";
import { InstrumentSheet } from "@/components/InstrumentSheet";
import { IconAnalyze, IconList, IconPnl, IconSearch, IconSliders } from "@/components/Icons";
import { EmptyState, Fab, IndexStrip } from "@/components/Shell";
import { useLiveQuotes } from "@/lib/market";
import { fmt, fmtSigned, toneClass } from "@/lib/format";
import type { Instrument, Position } from "@/lib/types";
import { useApp } from "@/state/AppContext";

export const positionKey = (p: Position) => p.kiteSymbol || (p.instrumentType === "EQ" ? `NSE:${p.symbol}` : "");

export default function Portfolio() {
  const loc = useLocation();
  const { positions, refreshPositions, instruments, resolveInstruments, privacy } = useApp();
  const [tab, setTab] = useState<"holdings" | "positions">(() => {
    const s = (loc.state as { tab?: string } | null)?.tab;
    if (s === "positions" || s === "holdings") return s;
    return (localStorage.getItem("pro_pf_tab") as "holdings" | "positions") || "positions";
  });
  const [sel, setSel] = useState<Position | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem("pro_pf_tab", tab);
  }, [tab]);

  useEffect(() => {
    void refreshPositions().catch(() => undefined);
    const t = setInterval(() => void refreshPositions().catch(() => undefined), 15000);
    return () => clearInterval(t);
  }, [refreshPositions]);

  const sorted = useMemo(() => {
    const ts = (s?: string) => (s ? new Date(s).getTime() || 0 : 0);
    const openPos = positions
      .filter((p) => !p.exited && p.quantity > 0)
      .sort((a, b) => ts(b.openedAt) - ts(a.openedAt));
    const closed = positions.filter((p) => p.exited).sort((a, b) => ts(b.exitedAt) - ts(a.exitedAt));
    return [...openPos, ...closed];
  }, [positions]);

  const keys = useMemo(() => sorted.map(positionKey).filter(Boolean), [sorted]);
  useEffect(() => resolveInstruments(keys), [keys, resolveInstruments]);
  const q = useLiveQuotes(keys);

  const instOf = (p: Position): Instrument => instruments[positionKey(p)] || fallbackInstrument(p);
  const pnlOf = (p: Position) => {
    if (p.exited) return Number(p.realizedPnlInr || 0);
    const ltp = q(positionKey(p))?.last;
    if (!ltp) return 0;
    return (ltp - p.avgPrice) * p.quantity;
  };
  const total = sorted.reduce((a, p) => a + pnlOf(p), 0);
  const hasOpen = sorted.some((p) => !p.exited);

  return (
    <div className="screen">
      <IndexStrip />
      <div className="top-tabs">
        <button type="button" className={`top-tab${tab === "holdings" ? " active" : ""}`} onClick={() => setTab("holdings")}>
          Holdings <span className="count">0</span>
        </button>
        <button type="button" className={`top-tab${tab === "positions" ? " active" : ""}`} onClick={() => setTab("positions")}>
          Positions <span className="count">{sorted.length}</span>
        </button>
      </div>

      <div className="screen-body">
        {tab === "holdings" && <EmptyState title="No holdings" sub="Buy equities from your watchlist" />}

        {tab === "positions" && sorted.length === 0 && (
          <>
            <div className="toolbar">
              <IconSearch size={17} />
              <span className="tb-link light">
                <IconList size={15} /> Group
              </span>
              <span className="grow" />
              <span className="tb-link">
                <IconPnl size={14} /> P&amp;L
              </span>
            </div>
            <EmptyState title="No positions" sub="Place an order from your watchlist" />
          </>
        )}

        {tab === "positions" && sorted.length > 0 && (
          <>
            <div className="pnl-card">
              <div className="pnl-label">Total P&amp;L</div>
              <div className={`pnl-value ${toneClass(Number(total.toFixed(2)))}${privacy ? " pv" : ""}`}>
                {privacy ? "•••" : fmtSigned(Number(total.toFixed(2))).replace(/^\+0\.00$/, "0.00")}
              </div>
            </div>
            <div className="toolbar">
              <IconSearch size={17} />
              <IconSliders size={17} />
              <span className="tb-link">
                <IconList size={15} /> Group
              </span>
              <span className="grow" />
              {hasOpen && (
                <span className="tb-link">
                  <IconAnalyze size={14} /> Analyze
                </span>
              )}
              <span className="tb-link">
                <IconPnl size={14} /> P&amp;L
              </span>
            </div>
            {sorted.map((p) => {
              const inst = instOf(p);
              const pnl = Number(pnlOf(p).toFixed(2));
              const ltp = q(positionKey(p))?.last;
              return (
                <div
                  key={p.instrumentKey}
                  className={`pos-row${p.exited ? " closed" : ""}`}
                  onClick={() => {
                    setSel(p);
                    setOpen(true);
                  }}
                >
                  <div className="pos-line">
                    <span className="pos-qty">
                      <span className="c-light">Qty.</span> <span className={p.exited ? "" : "c-blue"}>{p.exited ? 0 : p.quantity}</span>
                      <span className="c-light">&nbsp;&nbsp;Avg.</span> <span>{fmt(p.exited ? 0 : p.avgPrice)}</span>
                    </span>
                    <span className="tag-product">{p.product || (inst.expiry || p.instrumentType === "FO" ? "NRML" : "CNC")}</span>
                  </div>
                  <div className="pos-line">
                    <span className="pos-sym">
                      <InstrumentName inst={inst} />
                    </span>
                    <span className={`pos-pnl ${toneClass(pnl)}`}>{pnl === 0 ? "0.00" : fmtSigned(pnl)}</span>
                  </div>
                  <div className="pos-line small">
                    <span className="c-light">{inst.tag}</span>
                    <span>
                      <span className="c-light">LTP</span> {fmt(ltp)}
                    </span>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
      <Fab />
      <InstrumentSheet inst={sel ? instOf(sel) : null} position={sel} open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
