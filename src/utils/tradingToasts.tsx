import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";

const toastShell =
  "pointer-events-auto flex w-[min(100vw-2rem,22rem)] items-center gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-neutral-900 shadow-lg dark:border-neutral-200 dark:bg-white dark:text-neutral-900";

const titleClass = "text-[15px] font-semibold leading-none text-neutral-900";

export function formatFoOrderDescriptionLine(
  symbol: string,
  expiryIso: string | undefined,
  strike: number | undefined,
  optionType: "CE" | "PE" | undefined,
  qty: number,
  /** e.g. "qty executed." (orders) or "qty closed." (exits) */
  closing: string = "qty executed.",
): string {
  let label = symbol;
  if (expiryIso && strike != null && optionType) {
    const d = new Date(`${expiryIso}T00:00:00Z`);
    const day = d.getUTCDate();
    const mon = d.toLocaleString("en-IN", { month: "short", timeZone: "UTC" });
    const opt = optionType === "CE" ? "Call" : "Put";
    label = `${symbol} ${day} ${mon} ${strike} ${opt}`;
  }
  const q = Math.round(qty);
  return `${label} · ${q} / ${q} ${closing}`;
}

export function formatEquityOrderDescriptionLine(symbol: string, qty: number): string {
  const q = Math.round(qty);
  return `${symbol} · ${q} / ${q} qty executed.`;
}

function SimpleTradeToast({ title }: { title: string }) {
  return (
    <div className={toastShell}>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500">
        <CheckCircle2 className="h-5 w-5 text-white" strokeWidth={2.5} />
      </span>
      <div className="min-w-0 flex h-10 flex-1 items-center">
        <p className={titleClass}>{title}</p>
      </div>
    </div>
  );
}

export function showOrderExecutedToast(side: "BUY" | "SELL"): void {
  const title = side === "SELL" ? "Sell order executed" : "Buy order executed";
  toast.custom(() => <SimpleTradeToast title={title} />, {
    duration: 4500,
    position: "bottom-center",
    className: "!bg-transparent !border-0 !p-0 !shadow-none",
  });
}

export function showPositionExitToast(): void {
  toast.custom(() => <SimpleTradeToast title="Position exited" />, {
    duration: 4500,
    position: "bottom-center",
    className: "!bg-transparent !border-0 !p-0 !shadow-none",
  });
}
