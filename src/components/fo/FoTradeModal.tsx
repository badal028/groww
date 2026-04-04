import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { toast } from "sonner";
import { usePaperTrading } from "@/hooks/usePaperTrading";
import { useAuth } from "@/hooks/useAuth";
import { isValidEquityQty } from "@/utils/equityLots";
import type { FoContract } from "@/components/fo/FoOptionChainModal";
import { cn } from "@/lib/utils";
import { detectProvider } from "@/services/marketData";
import { subscribeKiteMarket } from "@/services/kiteMarketWsHub";
import { ArrowLeft, ChevronDown, RefreshCw, Settings } from "lucide-react";
import { formatInrCompact } from "@/utils/inrCompact";
import { usePaperPositions } from "@/hooks/usePaperPositions";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contract: FoContract | null;
  /** Open sheet with Buy/Sell pinned (e.g. position quick actions). */
  openWithSide?: "BUY" | "SELL";
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
const MARKET_HOURS_BYPASS_EMAILS = new Set(["badal@gmail.com"]);

export default function FoTradeModal({ open, onOpenChange, contract, openWithSide }: Props) {
  const [isDesktop, setIsDesktop] = useState<boolean>(() =>
    typeof window !== "undefined" ? window.matchMedia("(min-width: 1024px)").matches : false,
  );
  const navigate = useNavigate();
  const { placeOrder, placing } = usePaperTrading();
  const { user } = useAuth();
  const { positions } = usePaperPositions();
  const [qtyInput, setQtyInput] = useState("25");
  /** Empty string = buy/sell at current market (LTP); otherwise limit price. */
  const [priceField, setPriceField] = useState("");
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  /** Live LTP for “Current” line (limit field stays user-controlled). */
  const [liveLtp, setLiveLtp] = useState<number | null>(null);
  const [approxRefreshing, setApproxRefreshing] = useState(false);
  const [viewportBottomInset, setViewportBottomInset] = useState(0);
  const provider = useMemo(() => detectProvider(), []);

  const ltpForSnapRef = useRef(0);
  const ltpRef = useRef(0);
  const touchModeRef = useRef<TouchMode>(null);
  const prevLtpRef = useRef<number | null>(null);
  const autoFilledRef = useRef(false);
  const placeOrderRef = useRef(placeOrder);
  placeOrderRef.current = placeOrder;

  const lotSize = useMemo(() => defaultFoLotSize(contract), [contract]);
  const hasOpenPositionForContract = useMemo(() => {
    if (!contract) return false;
    return positions.some((p) => {
      if (p.exited) return false;
      if (Number(p.quantity || 0) <= 0) return false;
      const sameSymbol = String(p.symbol || "").toUpperCase() === String(contract.underlyingSymbol || "").toUpperCase();
      const sameType = String(p.optionType || "") === String(contract.optionType || "");
      const sameStrike = Number(p.strike || 0) === Number(contract.strike || 0);
      const sameExpiry = String(p.expiry || "").slice(0, 10) === String(contract.expiry || "").slice(0, 10);
      return sameSymbol && sameType && sameStrike && sameExpiry;
    });
  }, [positions, contract]);

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
  }, [contract]);

  useEffect(() => {
    if (!open || !contract) return;
    if (openWithSide) {
      setSide(openWithSide);
      return;
    }
    setSide(hasOpenPositionForContract ? "SELL" : "BUY");
  }, [open, contract, hasOpenPositionForContract, openWithSide]);

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
      prevLtpRef.current = null;
      autoFilledRef.current = false;
      return;
    }
    if (isMarketOrder) {
      touchModeRef.current = null;
      prevLtpRef.current = null;
      autoFilledRef.current = false;
      return;
    }
    const lim = Number(priceField);
    if (!Number.isFinite(lim) || lim <= 0) {
      touchModeRef.current = null;
      return;
    }
    const ltp0 = ltpForSnapRef.current;
    if (Math.abs(lim - ltp0) <= TOUCH_EPS) {
      touchModeRef.current = "flat";
    } else if (lim > ltp0) {
      touchModeRef.current = "rise";
    } else {
      touchModeRef.current = "fall";
    }
    prevLtpRef.current = null;
    autoFilledRef.current = false;
  }, [open, contract?.id, side, priceField, isMarketOrder]);

  const nowIstMeta = useMemo(() => {
    const now = new Date();
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(now);
    const get = (t: string) => parts.find((p) => p.type === t)?.value || "00";
    const dayIso = `${get("year")}-${get("month")}-${get("day")}`;
    const minutes = Number(get("hour")) * 60 + Number(get("minute"));
    return { dayIso, minutes };
  }, [open, contract?.id, liveLtp, priceField]);

  const isMarketHours = useMemo(() => {
    const mins = nowIstMeta.minutes;
    return mins >= 9 * 60 + 15 && mins <= 15 * 60 + 30;
  }, [nowIstMeta.minutes]);
  const bypassMarketHours = MARKET_HOURS_BYPASS_EMAILS.has(String(user?.email || "").trim().toLowerCase());

  const isExpired = useMemo(() => {
    if (!contract) return false;
    // Contract expires only after market close on expiry day (IST), not at 00:00.
    const exp = String(contract.expiry || "").slice(0, 10);
    if (!exp) return false;
    if (nowIstMeta.dayIso > exp) return true;
    if (nowIstMeta.dayIso < exp) return false;
    return nowIstMeta.minutes > 15 * 60 + 30;
  }, [contract, nowIstMeta]);

  const headerTitle = useMemo(() => {
    if (!contract) return "";
    const d = new Date(contract.expiry);
    const dateLabel = Number.isFinite(d.getTime())
      ? new Intl.DateTimeFormat("en-US", {
          month: "short",
          day: "2-digit",
          timeZone: "Asia/Kolkata",
        }).format(d)
      : "";
    const optLabel = contract.optionType === "CE" ? "Call" : "Put";
    return `${contract.underlyingSymbol} ${dateLabel} ${contract.strike} ${optLabel}`.trim();
  }, [contract]);

  const qtyNum = useMemo(() => {
    const n = parseInt(qtyInput.replace(/\D/g, ""), 10);
    return Number.isFinite(n) ? n : 0;
  }, [qtyInput]);

  const qtyValid = isValidEquityQty(qtyNum, lotSize);
  const lotCount = Math.max(1, Math.floor((qtyNum || lotSize) / lotSize));
  const quickQtyValues = useMemo(() => [lotSize * 10, lotSize * 20, lotSize * 30], [lotSize]);
  const showLotError =
    qtyInput.trim() !== "" && qtyNum > 0 && !qtyValid && !isExpired;

  /** Shown in footer: market → qty×LTP; limit → qty×limit when valid. */
  const approxDisplayed = useMemo(() => {
    if (!qtyValid || qtyNum <= 0) return 0;
    if (isMarketOrder) {
      return displayCurrentLtp > 0 ? qtyNum * displayCurrentLtp : 0;
    }
    const lim = Number(priceField);
    if (Number.isFinite(lim) && lim > 0) return qtyNum * lim;
    return 0;
  }, [qtyValid, qtyNum, isMarketOrder, priceField, displayCurrentLtp]);
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
    if (!isMarketHours && !bypassMarketHours) {
      toast.error("Order not allowed outside market hours (9:15 AM - 3:30 PM IST)");
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
    onOpenChange(false);
    navigate("/stocks?tab=Positions");
    return true;
  }, [
    contract,
    isExpired,
    qtyValid,
    lotSize,
    side,
    isMarketHours,
    bypassMarketHours,
    qtyNum,
    priceField,
    onOpenChange,
    navigate,
    openWithSide,
  ]);

  useEffect(() => {
    if (typeof window === "undefined" || isDesktop || !open) {
      setViewportBottomInset(0);
      return;
    }
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const inset = Math.max(0, window.innerHeight - vv.height - (vv.offsetTop || 0));
      setViewportBottomInset(inset);
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, [isDesktop, open]);

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
    <div className="flex min-h-full flex-col bg-zinc-100 text-zinc-950 dark:bg-black dark:text-white">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-full border border-zinc-400 bg-transparent px-4 py-1.5 text-xs font-medium text-zinc-900 dark:border-white dark:text-white"
          >
            Delivery
          </button>
          <button
            type="button"
            className="rounded-full border border-zinc-300 bg-transparent px-4 py-1.5 text-xs font-medium text-zinc-700 dark:border-white/30 dark:text-white/90"
          >
            Intraday
          </button>
          <button
            type="button"
            className="rounded-full border border-zinc-300 p-2 text-zinc-700 dark:border-white/20 dark:text-white/90"
          >
            <Settings className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="relative rounded-md border border-border bg-white px-1.5 py-1 text-[11px] text-black whitespace-nowrap dark:border-border">
          {quickQtyValues.map((v, idx) => (
            <button
              key={`chip-${v}`}
              type="button"
              className={cn("px-2 whitespace-nowrap", idx < quickQtyValues.length - 1 && "border-r border-black/20")}
              onClick={() => setQtyInput(String(v))}
              disabled={placing}
            >
              {v}
            </button>
          ))}
          <span className="absolute -bottom-1.5 left-1/2 h-0 w-0 -translate-x-1/2 border-l-[6px] border-r-[6px] border-t-[6px] border-l-transparent border-r-transparent border-t-white" />
        </div>
      </div>

      <div className="mt-1 flex items-center justify-between gap-3">
        <div className="text-sm text-zinc-900 dark:text-white">
          Qty <span className="text-zinc-600 dark:text-white/65">{lotCount} lot x {lotSize}</span>
        </div>
        <div className="grid w-[40%] min-w-[130px] grid-cols-[38px,1fr,38px] items-center gap-2">
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-300 bg-white text-base font-medium text-zinc-900 dark:border-white/40 dark:bg-transparent dark:text-white"
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
            className="h-9 w-full rounded-lg border border-zinc-300 bg-white px-2 text-center text-sm font-medium text-zinc-900 dark:border-white/40 dark:bg-transparent dark:text-white"
            aria-invalid={showLotError}
          />
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-300 bg-white text-base font-medium text-zinc-900 dark:border-white/40 dark:bg-transparent dark:text-white"
            onClick={bumpUp}
            disabled={placing}
            aria-label="Increase quantity by lot"
          >
            +
          </button>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-1 text-sm text-zinc-900 dark:text-white">
          Price <span>{isMarketOrder ? "Market" : "Limit"}</span> <ChevronDown className="h-4 w-4" />
        </div>
        <input
          value={priceField}
          onChange={(e) => setPriceField(e.target.value.replace(/[^\d.]/g, ""))}
          className="h-9 w-[40%] min-w-[130px] rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 dark:border-white/20 dark:bg-white/10 dark:text-white dark:placeholder:text-white/45"
          type="text"
          inputMode="decimal"
          placeholder="At market"
          autoComplete="off"
        />
      </div>
      <div className="mt-2 flex justify-end">
        <button
          type="button"
          className="inline-flex w-fit border-b border-dashed border-zinc-500 text-sm text-zinc-800 dark:border-white/50 dark:text-white"
        >
          Add stoploss/target
        </button>
      </div>

      <div className="mt-auto">
      {showLotError && (
        <div className="mt-3 rounded-lg border border-loss/35 bg-loss/10 px-3 py-2.5 text-center text-sm font-medium text-loss">
          Quantity should be in multiples of {lotSize}
        </div>
      )}

      {insufficientBuy && !showLotError && (
        <div className="mt-3 rounded-lg border border-amber-500/40 bg-amber-50 px-3 py-2 text-center text-xs text-amber-900 dark:border-amber-500/25 dark:bg-amber-900/30 dark:text-amber-300">
          Available balance is not enough
        </div>
      )}

      {isExpired && (
        <div className="mt-3 rounded-lg border border-loss/30 bg-loss/10 p-3 text-sm font-medium text-loss">
          Trading is not allowed for expired contracts
        </div>
      )}
      {!isExpired && !isMarketHours && !bypassMarketHours && (
        <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm font-medium text-amber-700 dark:text-amber-400">
          Order not allowed outside market hours (9:15 AM - 3:30 PM IST)
        </div>
      )}

      <div className="mt-4 flex items-center justify-between gap-2 text-[13px] text-zinc-800 dark:text-white">
        <span className="min-w-0 shrink truncate tabular-nums text-zinc-700 dark:text-white/90">
          Balance : <span className="font-semibold text-zinc-950 dark:text-white">{formatInrCompact(balance)}</span>
        </span>
        <div className="flex min-w-0 max-w-[58%] items-center justify-end gap-1.5 tabular-nums">
          <span className="inline-flex shrink-0 border-b border-dashed border-zinc-400 pb-px text-[13px] text-zinc-600 dark:border-white/50 dark:text-white/70">
            {side === "BUY" ? "Approx req :" : "Approx val :"}
          </span>
          <span className="min-w-0 truncate text-[13px] font-semibold text-zinc-950 dark:text-white">
            {qtyValid && approxDisplayed > 0
              ? `₹${approxDisplayed.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`
              : "—"}
          </span>
          <button
            type="button"
            aria-label="Refresh estimate"
            className="shrink-0 rounded p-0.5 text-zinc-600 hover:bg-zinc-200 dark:text-white/75 dark:hover:bg-white/10 dark:hover:text-white"
            onClick={() => {
              setApproxRefreshing(true);
              window.setTimeout(() => setApproxRefreshing(false), 450);
            }}
          >
            <RefreshCw className={cn("h-4 w-4", approxRefreshing && "animate-spin")} />
          </button>
        </div>
      </div>

      {side === "BUY" && insufficientBuy ? (
        <button
          type="button"
          onClick={() => {
            onOpenChange(false);
            navigate("/profile");
          }}
          disabled={placing || isExpired || (!isMarketHours && !bypassMarketHours) || !qtyValid}
          className="mt-4 h-11 w-full rounded-lg bg-primary font-semibold text-primary-foreground disabled:opacity-60"
        >
          Add money
        </button>
      ) : (
        <button
          type="button"
          onClick={onTrade}
          disabled={placing || isExpired || (!isMarketHours && !bypassMarketHours) || !qtyValid}
          className={cn(
            "mt-4 h-11 w-full rounded-lg text-sm font-semibold text-primary-foreground disabled:opacity-60",
            side === "BUY" ? "bg-primary" : "bg-loss",
          )}
        >
          {side === "BUY" ? "Buy" : "Sell"}
        </button>
      )}
      </div>
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
          <SheetContent
            side="bottom"
            showCloseButton={false}
            className="h-screen rounded-none border-0 bg-zinc-100 p-0 dark:bg-black"
          >
            <div className="flex h-full flex-col">
              <div className="flex items-center gap-2 bg-zinc-100 px-4 py-3 dark:bg-black">
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className="rounded-md p-1 text-zinc-900 hover:bg-zinc-200 dark:text-foreground dark:hover:bg-muted"
                  aria-label="Back"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <div className="min-w-0">
                  <h3 className="truncate text-[15px] font-semibold text-zinc-950 dark:text-white">{headerTitle}</h3>
                  {contract ? (
                    <p className="mt-0.5 text-[11px] text-zinc-600 dark:text-white/65">
                      ₹{displayCurrentLtp.toFixed(2)}{" "}
                      {Number.isFinite(Number(contract.netChange))
                        ? (() => {
                            const net = Number(contract.netChange || 0);
                            const prev = displayCurrentLtp - net;
                            const pct = prev > 0 ? (net / prev) * 100 : 0;
                            const sign = net >= 0 ? "+" : "";
                            return `(${sign}${pct.toFixed(2)}%)`;
                          })()
                        : ""}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="ml-auto border-b border-dashed border-zinc-500 text-xs text-zinc-700 dark:border-white/70 dark:text-white/90"
                >
                  Depth
                </button>
              </div>
              <div
                className="flex-1 overflow-y-auto bg-zinc-100 p-4 dark:bg-black"
                style={{ paddingBottom: Math.max(12, viewportBottomInset) }}
              >
                {tradeForm}
              </div>
            </div>
          </SheetContent>
        </Sheet>
      )}
    </>
  );
}
