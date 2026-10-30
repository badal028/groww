import { useNavigate } from "react-router-dom";
import { useLiveQuotes } from "@/lib/market";
import { dateTimeIST, fmt, fmtInt, fmtSigned } from "@/lib/format";
import type { Instrument, Position } from "@/lib/types";
import { BottomSheet } from "./BottomSheet";
import { InstrumentName } from "./InstrumentName";
import { IconBell, IconBolt, IconChart, IconExit, IconGtt, IconNotes, IconOptionChain } from "./Icons";

const UNDERLYING_KEY: Record<string, string> = {
  NIFTY: "NSE:NIFTY 50",
  BANKNIFTY: "NSE:NIFTY BANK",
  FINNIFTY: "NSE:NIFTY FIN SERVICE",
  MIDCPNIFTY: "NSE:NIFTY MID SELECT",
  SENSEX: "BSE:SENSEX",
  BANKEX: "BSE:BANKEX",
};
const UNDERLYING_LABEL: Record<string, string> = {
  NIFTY: "NIFTY 50",
  BANKNIFTY: "NIFTY BANK",
  FINNIFTY: "NIFTY FIN SERVICE",
  MIDCPNIFTY: "NIFTY MID SELECT",
};

type Props = {
  inst: Instrument | null;
  open: boolean;
  onClose: () => void;
  position?: Position | null;
};

export function InstrumentSheet({ inst, open, onClose, position }: Props) {
  const nav = useNavigate();
  const isDeriv = Boolean(inst?.expiry);
  const underKey = inst && isDeriv ? UNDERLYING_KEY[inst.underlying] || `NSE:${inst.underlying}` : "";
  const q = useLiveQuotes(open && inst ? [inst.key, underKey] : [], { pollMs: open ? 2000 : undefined });
  const v = inst ? q(inst.key) : undefined;
  const u = underKey ? q(underKey) : undefined;
  const ch = v?.change ?? 0;

  const go = (side: "BUY" | "SELL") => {
    if (!inst) return;
    const from = position ? "/portfolio" : "/watchlist";
    const qty = side === "SELL" && position && !position.exited ? position.quantity : undefined;
    onClose();
    nav(`/order/${side.toLowerCase()}`, {
      state: { inst, qty, from, exitMax: qty, position: position && !position.exited ? position : null },
    });
  };

  const buy = v?.depth?.buy || [];
  const sell = v?.depth?.sell || [];
  const rows = Array.from({ length: 5 }, (_, i) => ({ b: buy[i], s: sell[i] }));
  const totalBid = v?.buyQty ?? buy.reduce((a, d) => a + d.quantity, 0);
  const totalAsk = v?.sellQty ?? sell.reduce((a, d) => a + d.quantity, 0);

  const low = v?.low || 0;
  const high = v?.high || 0;
  const span = high - low;
  const pctOf = (x: number | undefined) => (span > 0 && x ? Math.max(0, Math.min(100, ((x - low) / span) * 100)) : 0);
  const pOpen = pctOf(v?.open);
  const pLast = pctOf(v?.last);
  const exited = Boolean(position?.exited);

  return (
    <BottomSheet open={open} onClose={onClose} peek={position ? 330 : 380}>
      {inst && (
        <div className="isheet">
          <div className="is-head">
            <div className="is-title">
              <InstrumentName inst={inst} />
            </div>
            <div className="is-sub">
              <span className="is-tag">{inst.tag}</span>
              <span className={ch < 0 ? "c-loss" : "c-green"}>{fmt(v?.last)}</span>
              <span className="c-light">
                {fmtSigned(ch)} ({fmtSigned(v?.changePct)}%)
              </span>
              {position && <span className="tag-product">{position.product || (isDeriv ? "NRML" : "CNC")}</span>}
            </div>
          </div>

          <div className="is-actions">
            {position ? (
              <>
                <button type="button" className="btn btn-blue" onClick={() => go("BUY")}>
                  ADD
                </button>
                <button type="button" className="btn btn-red btn-exit" disabled={exited} onClick={() => go("SELL")}>
                  <span>EXIT</span>
                  <span className="btn-exit-ico">
                    <IconExit size={16} />
                  </span>
                </button>
              </>
            ) : (
              <>
                <button type="button" className="btn btn-blue" onClick={() => go("BUY")}>
                  BUY
                </button>
                <button type="button" className="btn btn-red" onClick={() => go("SELL")}>
                  SELL
                </button>
              </>
            )}
          </div>

          <div className="is-links">
            <button type="button" className="lnk">
              <IconChart size={16} /> View chart
            </button>
            {isDeriv && (
              <button type="button" className="lnk">
                <IconOptionChain size={16} /> Option chain
              </button>
            )}
          </div>

          <div className="is-links three">
            <button type="button" className="lnk">
              <IconBell size={16} /> Set alert
            </button>
            {!position && (
              <button type="button" className="lnk">
                <IconNotes size={16} /> Add notes
              </button>
            )}
            <button type="button" className="lnk">
              <IconGtt size={16} /> Create GTT
            </button>
          </div>

          <table className="depth">
            <thead>
              <tr>
                <th>Bid</th>
                <th>Orders</th>
                <th className="r">Qty.</th>
                <th className="gap">Offer</th>
                <th>Orders</th>
                <th className="r">Qty.</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td className="c-blue">{fmt(r.b?.price)}</td>
                  <td className="c-blue">{r.b?.orders ?? 0}</td>
                  <td className="c-blue r">{fmtInt(r.b?.quantity)}</td>
                  <td className="c-red gap">{fmt(r.s?.price)}</td>
                  <td className="c-red">{r.s?.orders ?? 0}</td>
                  <td className="c-red r">{fmtInt(r.s?.quantity)}</td>
                </tr>
              ))}
              <tr className="total">
                <td>Total</td>
                <td />
                <td className="r">{fmtInt(totalBid)}</td>
                <td className="gap">Total</td>
                <td />
                <td className="r">{fmtInt(totalAsk)}</td>
              </tr>
            </tbody>
          </table>

          <div className="is-section">
            <div className="is-sec-title">Day's range</div>
            <div className="range-labels">
              <span>Low</span>
              <span>High</span>
            </div>
            <div className="range-vals">
              <span>{fmt(low)}</span>
              <span>{fmt(high)}</span>
            </div>
            <div className="range-bar">
              <div
                className={`range-fill ${(v?.last || 0) < (v?.open || 0) ? "neg" : "pos"}`}
                style={{ left: `${Math.min(pOpen, pLast)}%`, width: `${Math.abs(pLast - pOpen)}%` }}
              />
              <span className="range-mark" style={{ left: `${pOpen}%` }} />
              <span className="range-mark" style={{ left: `${pLast}%` }} />
            </div>
          </div>

          <div className="is-kv">
            <Kv k="Open" v={fmt(v?.open)} />
            <Kv k="Prev. close" v={fmt(v?.close)} />
            <Kv k="Volume" v={fmtInt(v?.volume)} />
            <Kv k="Avg. trade price" v={fmt(v?.avgPrice)} />
            <Kv k="Last traded quantity" v={fmtInt(v?.lastQty)} />
            <Kv k="Last traded at" v={v?.lastTradeTime ? dateTimeIST(v.lastTradeTime) : "-"} />
            <Kv k="Lower circuit" v={fmt(v?.lowerCircuit)} />
            <Kv k="Upper circuit" v={fmt(v?.upperCircuit)} />
            {isDeriv && <Kv k="Open interest" v={fmtInt(v?.oi)} />}
            {isDeriv && <Kv k="Expiry" v={inst.expiry || ""} />}
            {isDeriv && <Kv k={UNDERLYING_LABEL[inst.underlying] || inst.underlying} v={fmt(u?.last)} />}
          </div>

          <div className="is-section">
            <div className="is-sec-title big">Apps</div>
            <div className="is-app">
              <IconBolt size={16} className="c-blue" /> Technicals
            </div>
          </div>

          <div className="is-pin">
            <span>Pin to overview</span>
            <div>
              <button type="button" className="btn-outline-sm">
                Spot 1
              </button>
              <button type="button" className="btn-outline-sm">
                Spot 2
              </button>
            </div>
          </div>
        </div>
      )}
    </BottomSheet>
  );
}

function Kv({ k, v }: { k: string; v: string }) {
  return (
    <div className="kv">
      <span>{k}</span>
      <span>{v}</span>
    </div>
  );
}
