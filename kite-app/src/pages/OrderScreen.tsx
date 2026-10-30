import { useEffect, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { InstrumentName, instrumentText } from "@/components/InstrumentName";
import { IconBack, IconChevronDown, IconInfo, IconKebab, IconMinus, IconPlus, IconRefresh, IconShield, IconSwap } from "@/components/Icons";
import { Fab } from "@/components/Shell";
import { SwipeButton } from "@/components/SwipeButton";
import { api } from "@/lib/api";
import { estimateCharges, fmt, fmtSigned } from "@/lib/format";
import { getQuote, useLiveQuotes } from "@/lib/market";
import type { Instrument, Position } from "@/lib/types";
import { useApp } from "@/state/AppContext";

type NavState = { inst: Instrument; qty?: number; from?: string; exitMax?: number; position?: Position | null };

export default function OrderScreen() {
  const { side: sideParam } = useParams();
  const loc = useLocation();
  const st = (loc.state || null) as NavState | null;
  if (!st?.inst) return <Navigate to="/watchlist" replace />;
  return <OrderForm key={loc.key} side={sideParam === "sell" ? "SELL" : "BUY"} {...st} />;
}

function OrderForm({ side, inst, qty: initialQty, from = "/watchlist", exitMax, position }: NavState & { side: "BUY" | "SELL" }) {
  const nav = useNavigate();
  const { user, refreshUser, refreshOrders, refreshPositions, setOrdersDot, toast } = useApp();
  const lot = Math.max(1, inst.lotSize || 1);
  const [qtyStr, setQtyStr] = useState(String(initialQty ?? lot));
  const [tab, setTab] = useState<"Regular" | "Iceberg">("Regular");
  const [legs, setLegs] = useState("2");
  const [overnight, setOvernight] = useState(true);
  const [qtyFocus, setQtyFocus] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const qtyRef = useRef<HTMLInputElement>(null);

  const q = useLiveQuotes([inst.key]);
  const v = q(inst.key);
  const ch = v?.change ?? 0;
  const ltp = v?.last || 0;
  const qty = Number(qtyStr) || 0;
  const lots = qty / lot;
  const isDeriv = Boolean(inst.expiry);
  const sell = side === "SELL";
  const turnover = qty * ltp;
  const margin = sell ? 0 : turnover;
  const charges = estimateCharges(inst.exchange, inst.type, side, turnover);
  const avail = user?.walletInr ?? 0;

  useEffect(() => {
    void refreshUser().catch(() => undefined);
  }, [refreshUser]);

  const setQtyClamped = (n: number) => {
    let next = Math.max(0, Math.round(n));
    if (exitMax && next > exitMax) next = exitMax;
    setQtyStr(String(next));
  };

  const stepQty = (dir: 1 | -1) => {
    const base = Math.round(qty / lot) * lot;
    setQtyClamped(Math.max(lot, base + dir * lot));
  };

  const doRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshUser();
    } catch {
      /* ignore */
    }
    setRefreshing(false);
  };

  const orderBody = (price: number) => {
    const p = position;
    if (p) {
      return {
        symbol: p.symbol,
        instrumentType: p.instrumentType,
        optionType: p.optionType ?? null,
        strike: p.strike ?? null,
        expiry: p.expiry ?? null,
        kiteSymbol: p.kiteSymbol || inst.key,
        side,
        quantity: qty,
        price,
        orderMode: "MARKET",
        product: p.product || (overnight ? (isDeriv ? "NRML" : "CNC") : "MIS"),
      };
    }
    return {
      symbol: isDeriv ? inst.underlying : inst.tradingsymbol,
      instrumentType: isDeriv ? "FO" : "EQ",
      optionType: isDeriv ? inst.type : null,
      strike: inst.strike ?? null,
      expiry: inst.expiry ?? null,
      kiteSymbol: inst.key,
      side,
      quantity: qty,
      price,
      orderMode: "MARKET",
      product: overnight ? (isDeriv ? "NRML" : "CNC") : "MIS",
    };
  };

  const fail = (msg: string) => {
    toast(msg, "error");
    setLoading(false);
  };

  const submit = async () => {
    setLoading(true);
    qtyRef.current?.blur();
    if (!qty || qty <= 0) return fail("Quantity should be greater than 0.");
    if (qty % lot !== 0) return fail(`Quantity should be a multiple of lot size (${lot}).`);
    const price = Number((getQuote(inst.key)?.last || ltp).toFixed(2));
    if (!price || price <= 0) return fail("Price is not available for this instrument right now.");
    const body = orderBody(price);

    if (side === "BUY") {
      let wallet = avail;
      try {
        const me = await api<{ user: { walletInr: number } }>("/auth/me");
        wallet = Number(me.user.walletInr || 0);
      } catch {
        /* use cached */
      }
      const required = Number((qty * price).toFixed(2));
      if (required > wallet) {
        try {
          await api("/kite-app/order/reject", { method: "POST", json: body });
        } catch {
          /* still show rejection */
        }
        setOrdersDot("red");
        void refreshOrders().catch(() => undefined);
        void refreshUser().catch(() => undefined);
        return fail(
          `Insufficient funds. Margin required: ${required.toFixed(2)}. Margin available: ${wallet.toFixed(2)}. Add ${(
            required - wallet
          ).toFixed(2)} to place this order.`,
        );
      }
    }

    try {
      await api("/paper/order", { method: "POST", json: body });
    } catch (e) {
      return fail(e instanceof Error ? e.message : "Order failed");
    }
    setOrdersDot("green");
    await Promise.all([
      refreshUser().catch(() => undefined),
      refreshPositions().catch(() => undefined),
      refreshOrders().catch(() => undefined),
    ]);
    nav("/completed", { replace: true, state: { text: `${qty} x ${instrumentText(inst)}`, from } });
  };

  const accent = sell ? "sell" : "buy";

  return (
    <div className={`screen order-screen ${accent}`}>
      <div className="os-head">
        <button type="button" className="icon-btn" onClick={() => nav(-1)} aria-label="Back">
          <IconBack size={20} />
        </button>
        <div className="os-title">
          <InstrumentName inst={inst} />
        </div>
        <button type="button" className="icon-btn" aria-label="More">
          <IconKebab size={18} />
        </button>
      </div>
      <div className="os-strip">
        <span className="c-light">{inst.tag}</span>
        <span className={ch < 0 ? "c-loss" : "c-green"}>₹{fmt(ltp)}</span>
        <span className="c-light">{fmtSigned(ch)}</span>
        <span className="c-light">{fmtSigned(v?.changePct)}%</span>
      </div>

      <div className="os-body">
        <div className="os-tabs">
          {(["Regular", "Iceberg"] as const).map((t) => (
            <button key={t} type="button" className={`os-tab${tab === t ? " active" : ""}`} onClick={() => setTab(t)}>
              {t}
            </button>
          ))}
        </div>

        <div className="os-card">
          <div className="os-label-row">
            <span className="os-label">Quantity</span>
            <span className="os-lots">
              {Number.isInteger(lots) ? lots : lots.toFixed(2)} {lots === 1 ? "lot" : "lots"}
            </span>
          </div>
          <div className="os-input-row">
            <input
              ref={qtyRef}
              className="os-input"
              inputMode="numeric"
              pattern="[0-9]*"
              value={qtyStr}
              onFocus={() => setQtyFocus(true)}
              onBlur={() => setTimeout(() => setQtyFocus(false), 120)}
              onChange={(e) => {
                const digits = e.target.value.replace(/[^0-9]/g, "").slice(0, 7);
                if (exitMax && Number(digits) > exitMax) setQtyStr(String(exitMax));
                else setQtyStr(digits);
              }}
            />
            <button type="button" className="os-swap" aria-label="Switch">
              <IconSwap size={18} />
            </button>
          </div>

          <div className="os-label-row">
            <span className="os-label">
              Market <IconShield size={13} className="c-dark" />
            </span>
          </div>
          <div className="os-input-row">
            <input className="os-input hatched" value="0.00" disabled readOnly />
            <button type="button" className="os-swap" aria-label="Switch">
              <IconSwap size={18} />
            </button>
          </div>

          <div className="os-radios">
            <label className="radio" onClick={() => setOvernight(false)}>
              <span className={`radio-dot${!overnight ? " on" : ""}`} /> Intraday
            </label>
            <label className="radio" onClick={() => setOvernight(true)}>
              <span className={`radio-dot${overnight ? " on" : ""}`} /> Overnight
            </label>
          </div>
        </div>

        {tab === "Iceberg" && (
          <div className="os-card">
            <div className="os-label-row">
              <span className="os-label">Number of legs</span>
              <IconInfo size={15} className="c-accent" />
            </div>
            <div className="os-input-row">
              <input
                className="os-input"
                inputMode="numeric"
                value={legs}
                onChange={(e) => setLegs(e.target.value.replace(/[^0-9]/g, "").slice(0, 2))}
              />
            </div>
            <div className="os-hint">{Math.floor(qty / Math.max(1, Number(legs) || 1))} qty. per leg</div>
          </div>
        )}

        {!qtyFocus && (
          <div className="os-more">
            More
            <IconChevronDown size={14} />
          </div>
        )}
      </div>

      <div className="os-foot">
        <div className="os-margin">
          <span>
            Margin <span className="c-accent">₹{fmt(margin)}</span> + <span className="c-accent">₹{fmt(charges)}</span>
          </span>
          <span>
            Avail. <span className="c-accent">₹{fmt(avail)}</span>
          </span>
          <button type="button" className={`icon-btn sm${refreshing ? " spin" : ""}`} onClick={doRefresh} aria-label="Refresh">
            <IconRefresh size={15} />
          </button>
        </div>
        <div className="os-swipe-row">
          <SwipeButton side={side} loading={loading} onSwipe={submit} />
          <Fab style={{ position: "static" }} />
        </div>
        {qtyFocus && (
          <div className="os-lotrow">
            <span>Lot size {lot}</span>
            <button type="button" className="lot-btn" onMouseDown={(e) => e.preventDefault()} onClick={() => stepQty(-1)}>
              <IconMinus size={16} />
            </button>
            <button type="button" className="lot-btn" onMouseDown={(e) => e.preventDefault()} onClick={() => stepQty(1)}>
              <IconPlus size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
