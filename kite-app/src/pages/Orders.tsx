import { useEffect, useMemo, useState } from "react";
import { BottomSheet } from "@/components/BottomSheet";
import { InstrumentName, fallbackInstrument } from "@/components/InstrumentName";
import { IconClock, IconDoc, IconSearch, IconSliders, IconTradebook } from "@/components/Icons";
import { EmptyState, Fab, IndexStrip } from "@/components/Shell";
import { dateTimeIST, fmt, timeHMS } from "@/lib/format";
import type { Instrument, Order } from "@/lib/types";
import { useApp } from "@/state/AppContext";

const TABS = ["Open", "Executed", "GTT", "Baskets", "SIP", "Alerts"] as const;
type Tab = (typeof TABS)[number];

export const orderKey = (o: Order) => o.kiteSymbol || (o.instrumentType === "EQ" ? `NSE:${o.symbol}` : "");

const statusOf = (o: Order) => {
  const s = String(o.status || "").toUpperCase();
  if (s === "FILLED" || s === "COMPLETE") return "COMPLETE";
  if (s === "PENDING" || s === "OPEN") return "OPEN";
  if (s === "CANCELLED") return "CANCELLED";
  return s || "COMPLETE";
};

export default function Orders() {
  const { orders, refreshOrders, setOrdersDot, instruments, resolveInstruments } = useApp();
  const [tab, setTab] = useState<Tab>("Executed");
  const [sel, setSel] = useState<Order | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOrdersDot(null);
    void refreshOrders().catch(() => undefined);
  }, [refreshOrders, setOrdersDot]);

  useEffect(() => {
    resolveInstruments(orders.map(orderKey).filter(Boolean));
  }, [orders, resolveInstruments]);

  const todays = useMemo(() => {
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    return orders.filter((o) => {
      const t = o.filledAt || o.placedAt;
      if (!t) return false;
      return new Date(t).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }) === today;
    });
  }, [orders]);

  const openOrders = todays.filter((o) => statusOf(o) === "OPEN");
  const executed = todays.filter((o) => statusOf(o) !== "OPEN");
  const list = tab === "Open" ? openOrders : tab === "Executed" ? executed : [];
  const instOf = (o: Order): Instrument => instruments[orderKey(o)] || fallbackInstrument(o);

  return (
    <div className="screen">
      <IndexStrip />
      <div className="top-tabs scroll">
        {TABS.map((t) => {
          const count = t === "Open" ? openOrders.length : t === "Executed" ? executed.length : 0;
          return (
            <button key={t} type="button" className={`top-tab${t === tab ? " active" : ""}`} onClick={() => setTab(t)}>
              {t}
              {count > 0 && <span className="count">{count}</span>}
            </button>
          );
        })}
      </div>
      <div className="screen-body">
        {(tab === "Open" || tab === "Executed") && list.length > 0 && (
          <div className="toolbar">
            <IconSearch size={17} />
            <IconSliders size={17} />
            <span className="grow" />
            <span className="tb-link light">
              <IconDoc size={15} /> Contract note
            </span>
            <span className="tb-link">
              <IconTradebook size={15} /> Tradebook
            </span>
          </div>
        )}
        {list.map((o) => {
          const st = statusOf(o);
          const filled = st === "COMPLETE" ? o.filledQuantity ?? o.quantity : o.filledQuantity ?? 0;
          const inst = instOf(o);
          return (
            <div
              key={o.id}
              className="ord-row"
              onClick={() => {
                setSel(o);
                setOpen(true);
              }}
            >
              <div className="ord-line">
                <span className="ord-l">
                  <span className={`side-tag ${o.side === "BUY" ? "buy" : "sell"}`}>{o.side}</span>
                  <span className="c-light">
                    {filled}/{o.quantity}
                  </span>
                </span>
                <span className="ord-r">
                  <IconClock size={13} className="c-light" />
                  <span className="c-light">{timeHMS(o.filledAt || o.placedAt)}</span>
                  <span className={`st-tag ${st.toLowerCase()}`}>{st}</span>
                </span>
              </div>
              <div className="ord-line">
                <span className="ord-sym">
                  <InstrumentName inst={inst} />
                </span>
                <span className="ord-px">{st === "COMPLETE" ? `Avg. ${fmt(o.price)}` : fmt(0)}</span>
              </div>
              <div className="ord-line small">
                <span className="c-light">{inst.tag}</span>
                <span className="c-light">
                  {o.product || "NRML"}&nbsp;&nbsp;{o.orderMode || "MARKET"}
                </span>
              </div>
            </div>
          );
        })}
        {list.length === 0 && tab === "Open" && <EmptyState title="No pending orders" sub="Place an order from your watchlist" />}
        {list.length === 0 && tab === "Executed" && <EmptyState title="No orders" sub="Place an order from your watchlist" />}
        {tab === "GTT" && <EmptyState title="No GTTs" sub="Create a GTT from your watchlist" />}
        {tab === "Baskets" && <EmptyState title="No baskets" sub="Create a basket to place multiple orders" />}
        {tab === "SIP" && <EmptyState title="No SIPs" sub="Create a stock SIP from your watchlist" />}
        {tab === "Alerts" && <EmptyState title="No alerts" sub="Set an alert from your watchlist" />}
      </div>
      <Fab />

      <BottomSheet open={open} onClose={() => setOpen(false)} peek={460}>
        {sel && <OrderDetail o={sel} inst={instOf(sel)} />}
      </BottomSheet>
    </div>
  );
}

function OrderDetail({ o, inst }: { o: Order; inst: Instrument }) {
  const st = statusOf(o);
  const filled = st === "COMPLETE" ? o.filledQuantity ?? o.quantity : o.filledQuantity ?? 0;
  const rows: [string, string][] = [
    ["Quantity", `${filled} / ${o.quantity}`],
    ["Price", fmt(st === "COMPLETE" ? o.price : 0)],
    ["Avg. price", fmt(st === "COMPLETE" ? o.price : 0)],
    ["Trigger price", "0.00"],
    ["Order type", o.orderMode || "MARKET"],
    ["Product", o.product || "NRML"],
    ["Validity", "DAY"],
    ["Order ID", o.id.replace(/-/g, "").slice(0, 16)],
    ["Exchange order ID", st === "COMPLETE" ? o.id.replace(/\D/g, "").slice(0, 16).padEnd(16, "0") : "-"],
    ["Time", dateTimeIST(o.filledAt || o.placedAt)],
    ["Placed by", "Kite"],
  ];
  return (
    <div className="odetail">
      <div className="od-head">
        <div className="od-title">
          <InstrumentName inst={inst} />
        </div>
        <div className="od-sub">
          <span className="is-tag">{inst.tag}</span>
          <span className={`side-tag ${o.side === "BUY" ? "buy" : "sell"}`}>{o.side}</span>
          <span className={`st-tag ${st.toLowerCase()}`}>{st}</span>
        </div>
      </div>
      {st === "REJECTED" && (
        <div className="od-reason">
          <div className="od-reason-title">Rejection reason</div>
          <div>{o.rejectReason || "Insufficient funds"}</div>
        </div>
      )}
      <div className="is-kv">
        {rows.map(([k, v]) => (
          <div className="kv" key={k}>
            <span>{k}</span>
            <span>{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
