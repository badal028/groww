import React, { useEffect, useMemo, useState } from "react";
import type { Stock } from "@/data/mockData";
import { useAuth } from "@/hooks/useAuth";
import { getEquityLotSize, isValidEquityQty } from "@/utils/equityLots";
import { cn } from "@/lib/utils";
import { isWithinMarketHoursIST } from "@/utils/marketHours";

type Props = {
  stock: Stock;
  price: number;
  placing: boolean;
  onSubmit: (side: "BUY" | "SELL", quantity: number) => void;
  className?: string;
  /** e.g. fixed bottom bar on mobile */
  variant?: "card" | "bar";
};

const EquityTradeBlock: React.FC<Props> = ({
  stock,
  price,
  placing,
  onSubmit,
  className,
  variant = "card",
}) => {
  const { user } = useAuth();
  const lotSize = useMemo(() => getEquityLotSize(stock), [stock.sector, stock.lotSize]);
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [qtyInput, setQtyInput] = useState(String(lotSize));

  useEffect(() => {
    setQtyInput(String(lotSize));
    setSide("BUY");
  }, [stock.id, stock.symbol, lotSize]);

  const qtyNum = useMemo(() => {
    const n = parseInt(qtyInput.replace(/\D/g, ""), 10);
    return Number.isFinite(n) ? n : 0;
  }, [qtyInput]);

  const qtyValid = isValidEquityQty(qtyNum, lotSize);
  const showLotError =
    qtyInput.trim() !== "" && qtyNum > 0 && !qtyValid && stock.sector !== "Index";

  const approxAmount = qtyValid && price > 0 ? qtyNum * price : 0;
  const balance = Number(user?.walletInr ?? 0);
  const insufficientBuy = side === "BUY" && qtyValid && approxAmount > balance;
  const marketOpen = isWithinMarketHoursIST();

  const bumpDown = () => {
    const n = qtyNum || 0;
    const snapped = (() => {
      if (!Number.isFinite(n) || n <= 0) return lotSize;
      const floored = Math.floor(n / lotSize) * lotSize;
      return Math.max(lotSize, floored);
    })();
    setQtyInput(String(Math.max(lotSize, snapped - lotSize)));
  };

  const bumpUp = () => {
    const n = qtyNum || 0;
    const snapped = (() => {
      if (!Number.isFinite(n) || n <= 0) return lotSize;
      const floored = Math.floor(n / lotSize) * lotSize;
      return Math.max(lotSize, floored);
    })();
    setQtyInput(String(snapped + lotSize));
  };

  const onQtyChange = (raw: string) => {
    const digits = raw.replace(/\D/g, "");
    setQtyInput(digits);
  };

  const indexBlock = stock.sector === "Index";

  if (indexBlock) {
    return null;
  }

  const bar = variant === "bar";

  return (
    <div
      className={cn(
        bar
          ? "border-t border-border bg-card p-4"
          : "rounded-xl border border-border bg-card p-4",
        className,
      )}
    >
      <div className="mb-3 text-xs font-medium text-muted-foreground">Order</div>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setSide("SELL")}
          disabled={placing}
          className={cn(
            "rounded-lg py-2.5 text-sm font-semibold transition-colors",
            side === "SELL"
              ? "bg-loss text-primary-foreground"
              : "bg-muted text-foreground hover:bg-muted/80",
          )}
        >
          Sell
        </button>
        <button
          type="button"
          onClick={() => setSide("BUY")}
          disabled={placing}
          className={cn(
            "rounded-lg py-2.5 text-sm font-semibold transition-colors",
            side === "BUY"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-foreground hover:bg-muted/80",
          )}
        >
          Buy
        </button>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div>
          <div className="text-sm text-muted-foreground">Quantity</div>
          <div className="text-[11px] text-muted-foreground">Lot size: {lotSize}</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background text-lg font-medium"
            onClick={bumpDown}
            disabled={placing}
            aria-label="Decrease quantity by lot"
          >
            −
          </button>
          <input
            value={qtyInput}
            onChange={(e) => onQtyChange(e.target.value)}
            inputMode="numeric"
            className="h-9 w-20 rounded-md border border-border bg-background px-2 text-center text-sm text-foreground"
            aria-invalid={showLotError}
          />
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background text-lg font-medium"
            onClick={bumpUp}
            disabled={placing}
            aria-label="Increase quantity by lot"
          >
            +
          </button>
        </div>
      </div>

      {showLotError && (
        <div className="mt-3 rounded-lg border border-loss/35 bg-loss/10 px-3 py-2.5 text-center text-sm font-medium text-loss">
          Quantity should be in multiples of {lotSize}
        </div>
      )}

      {insufficientBuy && !showLotError && (
        <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-center text-xs text-amber-700 dark:text-amber-400">
          Insufficient balance for this order
        </div>
      )}
      {!marketOpen && !showLotError && (
        <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-center text-xs text-amber-700 dark:text-amber-400">
          Order not allowed outside market hours (9:15 AM - 3:30 PM IST)
        </div>
      )}

      <div className="mt-4 flex items-start justify-between gap-3 text-xs">
        <div>
          <p className="text-muted-foreground">Balance</p>
          <p className="mt-0.5 font-semibold text-foreground">
            ₹{balance.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="text-right">
          <p className="text-muted-foreground">
            {side === "BUY" ? "Approx. required" : "Approx. value"}
          </p>
          <p className="mt-0.5 font-semibold text-foreground">
            {qtyValid && approxAmount > 0
              ? `₹${approxAmount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`
              : "—"}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => qtyValid && onSubmit(side, qtyNum)}
        disabled={
          placing || !marketOpen || !qtyValid || (side === "BUY" && insufficientBuy)
        }
        className={cn(
          "mt-3 h-11 w-full rounded-lg font-semibold text-primary-foreground disabled:opacity-60",
          side === "BUY" ? "bg-primary" : "bg-loss",
        )}
      >
        {placing ? "Placing..." : side === "BUY" ? "Buy" : "Sell"}
      </button>
    </div>
  );
};

export default EquityTradeBlock;
