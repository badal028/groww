import React from "react";
import { cn } from "@/lib/utils";
import type { PaperOrder } from "@/hooks/usePaperOrders";
import { formatFoUnderlyingDisplay } from "@/lib/foDisplaySymbol";

function formatOrderTitle(o: PaperOrder): string {
  if (o.instrumentType === "FO" && o.expiry && o.strike != null && o.optionType) {
    const d = new Date(`${o.expiry}T00:00:00Z`);
    const day = d.getUTCDate();
    const mon = d.toLocaleString("en-IN", { month: "short", timeZone: "UTC" });
    const opt = o.optionType === "CE" ? "Call" : "Put";
    return `${formatFoUnderlyingDisplay(o.symbol)} ${day} ${mon} ${o.strike} ${opt}`;
  }
  return o.symbol;
}

type Props = {
  orders: PaperOrder[];
  loading: boolean;
  className?: string;
};

const OrdersPanel: React.FC<Props> = ({ orders, loading, className }) => {
  if (loading) return <div className={cn("py-8 text-sm text-muted-foreground", className)}>Loading orders…</div>;
  if (orders.length === 0) {
    return <div className={cn("py-8 text-sm text-muted-foreground", className)}>No orders yet.</div>;
  }

  return (
    <div className={cn("space-y-0 divide-y divide-border rounded-2xl border border-border bg-card", className)}>
      {orders.map((o) => (
        <div key={o.id} className="px-4 py-3">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{o.instrumentType === "FO" ? "NRML · NFO" : "Delivery · NSE"}</span>
            <span
              className={cn(
                "rounded px-1.5 py-0.5 text-[10px] font-semibold",
                o.side === "BUY" ? "bg-profit/20 text-profit" : "bg-loss/20 text-loss",
              )}
            >
              {o.side}
            </span>
          </div>
          <div className="mt-1 flex items-start justify-between gap-3">
            <p className="min-w-0 flex-1 text-sm font-semibold text-foreground">{formatOrderTitle(o)}</p>
            <p className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
              ₹{Number(o.notional || o.price * o.quantity).toLocaleString("en-IN", { maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {o.orderMode || "MARKET"} · Qty {o.quantity} @ ₹
              {o.price.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
            <span>{o.status}</span>
          </div>
        </div>
      ))}
    </div>
  );
};

export default OrdersPanel;
