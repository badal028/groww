import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { toast } from "sonner";
import { showOrderExecutedToast } from "@/utils/tradingToasts";
import { usePaperTrading } from "@/hooks/usePaperTrading";
import { useAuth } from "@/hooks/useAuth";
import { isValidEquityQty } from "@/utils/equityLots";
import type { FoContract } from "@/components/fo/FoOptionChainModal";
import { cn } from "@/lib/utils";
import { detectProvider } from "@/services/marketData";
import { subscribeKiteMarket } from "@/services/kiteMarketWsHub";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contract: FoContract | null;
};

function defaultFoLotSize(contract: FoContract | null): number {
  if (!contract) return 25;
  const n = contract.lotSize;
  if (typeof n === "number" && n > 0 && Number.isFinite(n)) return Math.floor(n);
  // UI fallback when API contract doesn't include `lotSize`
  const u = String(contract.underlyingSymbol || "")
    .toUpperCase()
    .replace(/\s+/g, "")
    .trim();
  if (u.includes("NIFTY")) return 65;
  return 25;
}

/** How LTP must move vs limit to auto-fill (paper). */
type TouchMode = "rise" | "fall" | "flat" | null;

const TOUCH_EPS = 0.02;

export default function FoTradeModal({ open, onOpenChange, contract }: Props) {
  const [isDesktop, setIsDesktop] = useState<boolean>(() =>
    typeof window !== "undefined" ? window.matchMedia("(min-width: 1024px)").matches : false,
  );
  const navigate = useNavigate();
  const { placeOrder, placing } = usePaperTrading();
  const { user } = useAuth();
  const [qtyInput, setQtyInput] = useState("25");
  /** Empty string = buy/sell at current market (LTP); otherwise limit price. */
  const [priceField, setPriceField] = useState("");
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  /** Live LTP for “Current” line (limit field stays user-controlled). */
  const [liveLtp, setLiveLtp] = useState<number | null>(null);
  const [touchHint, setTouchHint] = useState<"rise" | "fall" | "flat" | null>(null);
  const provider = useMemo(() => detectProvider(), []);

  const ltpForSnapRef = useRef(0);
  const ltpRef = useRef(0);
  const touchModeRef = useRef<TouchMode>(null);
  const prevLtpRef = useRef<number | null>(null);
  const autoFilledRef = useRef(false);
  const placeOrderRef = useRef(placeOrder);
  placeOrderRef.current = placeOrder;

  const lotSize = useMemo(() => defaultFoLotSize(contract), [contract]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(min-width: 1024px)");
    const onChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    setIsDesktop(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!contract) return;
    setPriceField("");
    setQtyInput(String(defaultFoLotSize(contract)));
    setSide("BUY");
  }, [contract]);

  useEffect(() => {
    if (!open || !contract) {
      setLiveLtp(null);
      return;
    }
    setLiveLtp(Number(contract.lastPrice || 0));
  }, [open, contract?.id]);

  useEffect(() => {
    if (!open || provider !== "kite-backend" || !contract?.kiteSymbol?.trim()) return;
    const key = contract.kiteSymbol.trim();
    return subscribeKiteMarket([key], (msg) => {
      if (msg.key !== key) return;
      const px = Number(Number(msg.last_price).toFixed(2));
      if (Number.isFinite(px) && px >= 0) setLiveLtp(px);
    });
  }, [open, provider, contract?.kiteSymbol]);

  const displayCurrentLtp = contract
    ? Number((liveLtp ?? contract.lastPrice ?? 0).toFixed(2))
    : 0;

  ltpForSnapRef.current = displayCurrentLtp;
  ltpRef.current = displayCurrentLtp;

  const isMarketOrder = priceField.trim() === "";

  /** Limit-only: auto-fill when LTP crosses typed price. */
  useEffect(() => {
    if (!open || !contract) {
      touchModeRef.current = null;
      setTouchHint(null);
      prevLtpRef.current = null;
      autoFilledRef.current = false;
      return;
    }
    if (isMarketOrder) {
      touchModeRef.current = null;
      setTouchHint(null);
      prevLtpRef.current = null;
      autoFilledRef.current = false;
      return;
    }
    const lim = Number(priceField);
    if (!Number.isFinite(lim) || lim <= 0) {
      touchModeRef.current = null;
      setTouchHint(null);
      return;
    }
    const ltp0 = ltpForSnapRef.current;
    if (Math.abs(lim - ltp0) <= TOUCH_EPS) {
      touchModeRef.current = "flat";
      setTouchHint("flat");
    } else if (lim > ltp0) {
      touchModeRef.current = "rise";
      setTouchHint("rise");
    } else {
      touchModeRef.current = "fall";
      setTouchHint("fall");
    }
    prevLtpRef.current = null;
    autoFilledRef.current = false;
  }, [open, contract?.id, side, priceField, isMarketOrder]);

  const isExpired = useMemo(() => {
    if (!contract) return false;
    const exp = new Date(contract.expiry).getTime();
    return exp < Date.now();
  }, [contract]);

  const headerTitle = contract
    ? `${contract.underlyingSymbol} ${new Date(contract.expiry).toDateString()} ${contract.strike} ${contract.optionType}`
    : "";

  const qtyNum = useMemo(() => {
    const n = parseInt(qtyInput.replace(/\D/g, ""), 10);
    return Number.isFinite(n) ? n : 0;
  }, [qtyInput]);

  const qtyValid = isValidEquityQty(qtyNum, lotSize);
  const showLotError =
    qtyInput.trim() !== "" && qtyNum > 0 && !qtyValid && !isExpired;

  /** At live premium: qty × current (e.g. 65 × LTP, 130 × LTP for 2 lots). */
  const approxAtCurrent =
    qtyValid && displayCurrentLtp > 0 ? qtyNum * displayCurrentLtp : 0;
  const committedUnitPx = isMarketOrder ? displayCurrentLtp : Number(priceField);
  /** BUY check: market uses LTP; limit uses typed price. */
  const maxBuyCommit =
    qtyValid && Number.isFinite(committedUnitPx) && committedUnitPx > 0
      ? qtyNum * committedUnitPx
      : 0;
  const balance = Number(user?.walletInr ?? 0);
  const insufficientBuy = side === "BUY" && qtyValid && maxBuyCommit > balance;

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
    setQtyInput(raw.replace(/\D/g, ""));
  };

  const submitOrder = useCallback(async (): Promise<boolean> => {
    if (!contract) return false;
    if (isExpired) {
      toast.error("Trading is not allowed for expired contracts");
      return false;
    }
    if (!qtyValid) {
      toast.error(`Quantity must be in multiples of ${lotSize}`);
      return false;
    }
    const hasLimit = priceField.trim() !== "";
    const limitPx = hasLimit ? Number(priceField) : NaN;
    const ltpNow = ltpRef.current;

    // Limit-order behavior:
    // BUY: only execute immediately if limit >= current LTP (marketable)
    // SELL: only execute immediately if limit <= current LTP (marketable)
    // Otherwise keep waiting for touch/cross via the auto-trigger effect.
    if (hasLimit) {
      if (!Number.isFinite(limitPx) || limitPx <= 0) {
        toast.error("Invalid limit price");
        return false;
      }
      const marketable =
        side === "BUY" ? limitPx >= ltpNow - TOUCH_EPS : limitPx <= ltpNow + TOUCH_EPS;
      if (!marketable) {
        toast.message(
          side === "BUY"
            ? `Limit BUY placed at ₹${limitPx.toFixed(2)} (waiting for price to fall)`
            : `Limit SELL placed at ₹${limitPx.toFixed(2)} (waiting for price to rise)`,
        );
        return false;
      }
    }

    const execPx = hasLimit ? limitPx : ltpNow;
    if (!Number.isFinite(execPx) || execPx <= 0) {
      toast.error("Invalid price — leave empty for market or enter a limit");
      return false;
    }
    const result = await placeOrderRef.current({
      symbol: contract.underlyingSymbol,
      side,
      quantity: qtyNum,
      price: Number(execPx.toFixed(2)),
      orderMode: priceField.trim() === "" ? "MARKET" : "LIMIT",
      instrumentType: "FO",
      optionType: contract.optionType,
      strike: contract.strike,
      expiry: contract.expiry,
      product: "NRML",
      kiteSymbol: contract.kiteSymbol?.trim() || undefined,
    });

    if (!result.ok) {
      toast.error(result.message || "Order failed");
      return false;
    }
    showOrderExecutedToast(side);
    onOpenChange(false);
    navigate("/stocks?tab=Positions");
    return true;
  }, [
    contract,
    isExpired,
    qtyValid,
    lotSize,
    side,
    qtyNum,
    priceField,
    onOpenChange,
    navigate,
  ]);

  const onTrade = () => void submitOrder();

  /** Auto BUY/SELL when live LTP crosses your limit (paper). Skipped for At market. */
  useEffect(() => {
    if (!open || !contract || placing || isExpired || !qtyValid) return;
    if (priceField.trim() === "") return;
    if (side === "BUY" && insufficientBuy) return;

    const mode = touchModeRef.current;
    if (mode === null || mode === "flat") return;

    const lim = Number(priceField);
    if (!Number.isFinite(lim) || lim <= 0) return;
    const ltp = displayCurrentLtp;
    const prev = prevLtpRef.current;

    if (prev === null) {
      prevLtpRef.current = ltp;
      return;
    }
    if (autoFilledRef.current) {
      prevLtpRef.current = ltp;
      return;
    }

    let crossed = false;
    if (mode === "rise") crossed = prev < lim - TOUCH_EPS && ltp >= lim - TOUCH_EPS;
    if (mode === "fall") crossed = prev > lim + TOUCH_EPS && ltp <= lim + TOUCH_EPS;

    prevLtpRef.current = ltp;
    if (!crossed) return;

    autoFilledRef.current = true;
    void submitOrder().then((ok) => {
      if (!ok) autoFilledRef.current = false;
    });
  }, [
    open,
    contract,
    placing,
    isExpired,
    qtyValid,
    insufficientBuy,
    side,
    priceField,
    displayCurrentLtp,
    qtyNum,
    lotSize,
    submitOrder,
  ]);

  const tradeForm = (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 text-sm text-muted-foreground">Side</div>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          className={cn(
            "rounded-lg py-3 text-sm font-semibold",
            side === "SELL" ? "bg-loss text-primary-foreground" : "bg-muted text-foreground",
          )}
          onClick={() => setSide("SELL")}
          disabled={placing}
        >
          Sell
        </button>
        <button
          type="button"
          className={cn(
            "rounded-lg py-3 text-sm font-semibold",
            side === "BUY" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
          )}
          onClick={() => setSide("BUY")}
          disabled={placing}
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
            className="h-9 w-16 rounded-md border border-border bg-background px-2 text-center text-sm text-foreground"
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

      <div className="mt-4">
        <div className="mb-2 text-sm text-muted-foreground">Price</div>
        <input
          value={priceField}
          onChange={(e) => setPriceField(e.target.value.replace(/[^\d.]/g, ""))}
          className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground"
          type="text"
          inputMode="decimal"
          placeholder="At market"
          autoComplete="off"
        />
        {contract && (
          <>
            <div className="mt-2 text-xs text-muted-foreground">
              Current: ₹{displayCurrentLtp.toFixed(2)}
              {isMarketOrder && (
                <span className="ml-2 text-[11px]">· order will use this LTP when you tap Buy/Sell</span>
              )}
            </div>
            {!isMarketOrder && touchHint && (
              <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                Auto-{side === "BUY" ? "buy" : "sell"} when price{" "}
                {touchHint === "rise" ? "rises to" : touchHint === "fall" ? "falls to" : "matches"}{" "}
                your limit (editing price resets the trigger). If limit ≈ current, tap {side}.
              </p>
            )}
          </>
        )}
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

      {isExpired && (
        <div className="mt-3 rounded-lg border border-loss/30 bg-loss/10 p-3 text-sm font-medium text-loss">
          Trading is not allowed for expired contracts
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
            {qtyValid && approxAtCurrent > 0
              ? `₹${approxAtCurrent.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`
              : "—"}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={onTrade}
        disabled={
          placing || isExpired || !qtyValid || (side === "BUY" && insufficientBuy)
        }
        className={cn(
          "mt-4 h-11 w-full rounded-lg font-semibold text-primary-foreground disabled:opacity-60",
          side === "BUY" ? "bg-primary" : "bg-loss",
        )}
      >
        {placing ? "Placing..." : side === "BUY" ? "Buy" : "Sell"}
      </button>
    </div>
  );

  return (
    <>
      {isDesktop && (
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogContent
            className="max-h-[90vh] max-w-lg overflow-y-auto"
            overlayClassName="bg-black/45"
          >
          <div>
            <p className="text-xs font-medium text-muted-foreground">Trade</p>
            <h3 className="mt-1 text-lg font-semibold text-foreground">{headerTitle}</h3>
          </div>
          {tradeForm}
          </DialogContent>
        </Dialog>
      )}

      {!isDesktop && (
        <Sheet open={open} onOpenChange={onOpenChange}>
          <SheetContent side="bottom" showCloseButton={false}>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Trade</p>
            <h3 className="mt-1 text-lg font-semibold text-foreground">{headerTitle}</h3>
          </div>
          {tradeForm}
          </SheetContent>
        </Sheet>
      )}
    </>
  );
}
