import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { InstrumentName, fallbackInstrument } from "@/components/InstrumentName";
import { InstrumentSheet } from "@/components/InstrumentSheet";
import {
  IconAnalyze,
  IconChevronDown,
  IconList,
  IconLock,
  IconPnl,
  IconSearch,
  IconSliders,
  IconUserPlus,
} from "@/components/Icons";
import { EmptyState, Fab, IndexStrip } from "@/components/Shell";
import { SwipeClear } from "@/components/SwipeClear";
import { api } from "@/lib/api";
import { useLiveQuotes } from "@/lib/market";
import { fmt, fmtPct, fmtSigned, toneClass } from "@/lib/format";
import type { Instrument, Position } from "@/lib/types";
import { useApp } from "@/state/AppContext";

export const positionKey = (p: Position) => p.kiteSymbol || (p.instrumentType === "EQ" ? `NSE:${p.symbol}` : "");

type Holding = { key: string; symbol: string; qty: number; avg: number };

const HOLDINGS: Holding[] = [
  { key: "NSE:JPL", symbol: "JPL", qty: 12, avg: 1119.0 },
  { key: "NSE:INFY", symbol: "INFY", qty: 10, avg: 1092.4 },
  { key: "NSE:TATASTEEL", symbol: "TATASTEEL", qty: 40, avg: 151.25 },
  { key: "NSE:ITC", symbol: "ITC", qty: 25, avg: 248.6 },
];
const HOLDING_KEYS = HOLDINGS.map((h) => h.key);

const holdingInstrument = (h: Holding): Instrument =>
  fallbackInstrument({ symbol: h.symbol, instrumentType: "EQ", kiteSymbol: h.key });

export default function Portfolio() {
  const loc = useLocation();
  const { user, positions, refreshPositions, refreshUser, instruments, resolveInstruments, privacy, toast } = useApp();
  const [tab, setTab] = useState<"holdings" | "positions">(() => {
    const s = (loc.state as { tab?: string } | null)?.tab;
    if (s === "positions" || s === "holdings") return s;
    return (localStorage.getItem("pro_pf_tab") as "holdings" | "positions") || "positions";
  });
  const [sel, setSel] = useState<{ inst: Instrument; position: Position | null } | null>(null);
  const [open, setOpen] = useState(false);
  const [clearing, setClearing] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem("pro_pf_tab", tab);
  }, [tab]);

  useEffect(() => {
    void refreshPositions().catch(() => undefined);
    void refreshUser().catch(() => undefined);
    const t = setInterval(() => void refreshPositions().catch(() => undefined), 15000);
    return () => clearInterval(t);
  }, [refreshPositions, refreshUser]);

  const sorted = useMemo(() => {
    const ts = (s?: string) => (s ? new Date(s).getTime() || 0 : 0);
    const openPos = positions
      .filter((p) => !p.exited && p.quantity > 0)
      .sort((a, b) => ts(b.openedAt) - ts(a.openedAt));
    const closed = positions.filter((p) => p.exited).sort((a, b) => ts(b.exitedAt) - ts(a.exitedAt));
    return [...openPos, ...closed];
  }, [positions]);

  const keys = useMemo(() => [...sorted.map(positionKey).filter(Boolean), ...HOLDING_KEYS], [sorted]);
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
  const canClear = Boolean(user?.canClearPositions);

  const clearPosition = async (p: Position) => {
    setClearing(p.instrumentKey);
    try {
      await api("/paper/position/dismiss", { method: "POST", json: { instrumentKey: p.instrumentKey } });
      await Promise.all([refreshPositions(), refreshUser()]);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Clear failed", "error");
    } finally {
      setClearing(null);
    }
  };

  const mask = (s: string) => (privacy ? "•••" : s);

  return (
    <div className="screen">
      <IndexStrip />
      <div className="top-tabs">
        <button type="button" className={`top-tab${tab === "holdings" ? " active" : ""}`} onClick={() => setTab("holdings")}>
          Holdings <span className="count">{HOLDINGS.length}</span>
        </button>
        <button type="button" className={`top-tab${tab === "positions" ? " active" : ""}`} onClick={() => setTab("positions")}>
          Positions <span className="count">{sorted.length}</span>
        </button>
      </div>

      <div className="screen-body">
        {tab === "holdings" && (
          <Holdings
            q={q}
            mask={mask}
            onOpen={(h) => {
              setSel({ inst: instruments[h.key] || holdingInstrument(h), position: null });
              setOpen(true);
            }}
          />
        )}

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
              <div className={`pnl-value ${toneClass(Number(total.toFixed(2)))}`}>
                {mask(fmtSigned(Number(total.toFixed(2))).replace(/^\+0\.00$/, "0.00"))}
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
                <SwipeClear
                  key={p.instrumentKey}
                  onClear={p.exited && canClear ? () => void clearPosition(p) : undefined}
                  busy={clearing === p.instrumentKey}
                >
                  <div
                    className={`pos-row${p.exited ? " closed" : ""}`}
                    onClick={() => {
                      setSel({ inst, position: p });
                      setOpen(true);
                    }}
                  >
                    <div className="pos-line">
                      <span className="pos-qty">
                        <span className="c-light">Qty.</span>{" "}
                        <span className={p.exited ? "" : "c-blue"}>{p.exited ? 0 : p.quantity}</span>
                        <span className="c-light">&nbsp;&nbsp;Avg.</span> <span>{fmt(p.exited ? 0 : p.avgPrice)}</span>
                      </span>
                      <span className="tag-product">
                        {p.product || (inst.expiry || p.instrumentType === "FO" ? "NRML" : "CNC")}
                      </span>
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
                </SwipeClear>
              );
            })}
          </>
        )}
      </div>
      <Fab style={tab === "holdings" ? { bottom: 56 } : undefined} />
      {tab === "holdings" && <HoldingsDayPnl q={q} mask={mask} />}
      <InstrumentSheet inst={sel?.inst || null} position={sel?.position} open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

type QFn = ReturnType<typeof useLiveQuotes>;

function Holdings({ q, mask, onOpen }: { q: QFn; mask: (s: string) => string; onOpen: (h: Holding) => void }) {
  const rows = HOLDINGS.map((h) => {
    const v = q(h.key);
    const ltp = v?.last || 0;
    const invested = h.qty * h.avg;
    const current = ltp ? h.qty * ltp : invested;
    const pnl = current - invested;
    return { h, v, ltp, invested, current, pnl, pct: invested ? (pnl / invested) * 100 : 0 };
  });
  const invested = rows.reduce((a, r) => a + r.invested, 0);
  const current = rows.reduce((a, r) => a + r.current, 0);
  const pnl = current - invested;
  const pct = invested ? (pnl / invested) * 100 : 0;

  return (
    <>
      <div className="hold-card">
        <div className="hold-top">
          <div>
            <div className="hold-label">Invested</div>
            <div className="hold-val">{mask(fmt(invested))}</div>
          </div>
          <div className="r">
            <div className="hold-label">Current</div>
            <div className="hold-val">{mask(fmt(current))}</div>
          </div>
        </div>
        <div className="hold-pnl">
          <span className="hold-label">P&amp;L</span>
          <span>
            <span className={`hold-pnl-val ${toneClass(pnl)}`}>{mask(fmtSigned(pnl))}</span>
            <span className={`hold-pill ${pnl < 0 ? "neg" : "pos"}`}>{fmtPct(pct)}</span>
          </span>
        </div>
      </div>
      <div className="toolbar">
        <IconSearch size={17} />
        <IconSliders size={17} />
        <span className="hold-equity">
          Equity <IconChevronDown size={12} />
        </span>
        <span className="grow" />
        <span className="tb-link">
          <IconUserPlus size={15} /> Family
        </span>
        <span className="tb-link">
          <IconPnl size={14} /> Analytics
        </span>
      </div>
      {rows.map((r) => (
        <div key={r.h.key} className="pos-row" onClick={() => onOpen(r.h)}>
          <div className="pos-line">
            <span className="pos-qty">
              <span className="c-light">Qty.</span> {r.h.qty} <span className="c-light">&nbsp;•&nbsp; Avg.</span> {fmt(r.h.avg)}
            </span>
            <span className={`hold-rowpct ${toneClass(r.pct)}`}>{fmtPct(r.pct)}</span>
          </div>
          <div className="pos-line">
            <span className="pos-sym">{r.h.symbol}</span>
            <span className={`pos-pnl ${toneClass(r.pnl)}`}>{mask(fmtSigned(r.pnl))}</span>
          </div>
          <div className="pos-line small">
            <span>
              <span className="c-light">Invested</span> {mask(fmt(r.invested))}
            </span>
            <span>
              <span className="c-light">LTP</span> {fmt(r.ltp)}{" "}
              <span className={toneClass(r.v?.changePct)}>({fmtPct(r.v?.changePct).replace("+", "")})</span>
            </span>
          </div>
        </div>
      ))}
      <div className="hold-auth">
        <IconLock size={15} /> Authorisation
      </div>
      <div style={{ height: 60 }} />
    </>
  );
}

function HoldingsDayPnl({ q, mask }: { q: QFn; mask: (s: string) => string }) {
  const day = HOLDINGS.reduce((a, h) => {
    const v = q(h.key);
    if (!v?.last || !v.close) return a;
    return a + (v.last - v.close) * h.qty;
  }, 0);
  return (
    <div className="hold-day">
      <span>Day's P&amp;L</span>
      <span className={toneClass(Number(day.toFixed(2)))}>{mask(fmtSigned(day))}</span>
    </div>
  );
}
