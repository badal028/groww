import React from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import type { PaperPosition } from "@/hooks/usePaperPositions";
import { ChartCandlestick, Link2, ListOrdered } from "lucide-react";
import { cn } from "@/lib/utils";

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

function formatPnl(n: number): string {
  return `${n >= 0 ? "+" : ""}₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  position: PaperPosition | null;
  mkt: number;
  pnl: number;
  onChart: () => void;
  onOptionChain: () => void;
  onPositionDetails: () => void;
  onSell: () => void;
  onBuy: () => void;
};

/** px-4 (16) + icon w-5 (20) + gap-4 (16) — divider aligns with text start */
const MENU_DIVIDER_INSET = "ml-[52px] mr-0 h-px shrink-0 bg-border";

const rowBtn =
  "flex w-full items-center gap-4 border-0 px-4 py-[18px] text-left text-[15px] font-normal text-foreground transition-colors hover:bg-muted/60";

export default function PositionActionSheet({
  open,
  onOpenChange,
  position,
  mkt,
  pnl,
  onChart,
  onOptionChain,
  onPositionDetails,
  onSell,
  onBuy,
}: Props) {
  if (!position) return null;

  const title = formatPositionTitle(position);
  const isFo = String(position.instrumentType).toUpperCase() === "FO";
  const topLeft = isFo ? "F&O · NRML" : "Delivery";
  const topRight = String(Math.round(position.quantity || 0));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className={cn(
          "flex max-h-[88vh] flex-col gap-0 rounded-t-2xl rounded-b-none border-0 bg-background p-0",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
        )}
      >
        <div className="mx-4 mt-3 h-1 w-10 shrink-0 self-center rounded-full bg-muted-foreground/40" aria-hidden />

        <div className="mx-4 mt-4 rounded-xl border border-border bg-card px-4 py-3">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{topLeft}</span>
            <span className="font-semibold text-[#5b8cff]">{topRight}</span>
          </div>
          <div className="mt-2 flex items-start justify-between gap-3">
            <p className="min-w-0 flex-1 text-[15px] font-normal leading-snug text-foreground">{title}</p>
            <p className={cn("shrink-0 text-[15px] font-semibold tabular-nums", pnl >= 0 ? "text-[#00d09c]" : "text-[#ff5c43]")}>
              {formatPnl(pnl)}
            </p>
          </div>
          <div className="mt-2 flex items-center justify-between text-[12px] text-muted-foreground">
            <span>Avg ₹{Number(position.avgPrice || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
            <span>Mkt ₹{mkt.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
          </div>
        </div>

        <div className="mt-1 min-h-0 shrink-0 overflow-y-auto py-3">
          <button type="button" className={rowBtn} onClick={onChart}>
            <ChartCandlestick className="h-5 w-5 shrink-0 text-foreground" strokeWidth={2} />
            <span>{position.symbol} Chart</span>
          </button>
          <div className={MENU_DIVIDER_INSET} aria-hidden />
          {isFo ? (
            <>
              <button type="button" className={rowBtn} onClick={onOptionChain}>
                <Link2 className="h-5 w-5 shrink-0 text-foreground" strokeWidth={2} />
                <span>{position.symbol} option chain</span>
              </button>
              <div className={MENU_DIVIDER_INSET} aria-hidden />
            </>
          ) : null}
          <button type="button" className={rowBtn} onClick={onPositionDetails}>
            <ListOrdered className="h-5 w-5 shrink-0 text-foreground" strokeWidth={2} />
            <span>Position details</span>
          </button>
          <div className={MENU_DIVIDER_INSET} aria-hidden />
        </div>

        <div className="shrink-0 bg-background px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-0">
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={onSell}
              className="h-11 rounded-xl bg-[#ff5c43] text-[14px] font-semibold text-white"
            >
              Sell
            </button>
            <button
              type="button"
              onClick={onBuy}
              className="h-11 rounded-xl bg-[#00b386] text-[14px] font-semibold text-white"
            >
              Buy
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
