import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";

const toastShell =
  "pointer-events-auto flex w-[min(100vw-2rem,22rem)] items-start gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-neutral-900 shadow-lg dark:border-neutral-200 dark:bg-white dark:text-neutral-900";

const titleClass = "text-[15px] font-semibold leading-tight text-neutral-900";
const descClass = "mt-0.5 text-[13px] leading-snug text-neutral-600";

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

function TradeToastBody({ title, description }: { title: string; description: string }) {
  return (
    <div className={toastShell}>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500">
        <CheckCircle2 className="h-5 w-5 text-white" strokeWidth={2.5} />
      </span>
      <div className="min-w-0 flex-1">
        <p className={titleClass}>{title}</p>
        <p className={descClass}>{description}</p>
      </div>
    </div>
  );
}

export function showOrderExecutedToast(descriptionLine: string): void {
  toast.custom(() => <TradeToastBody title="Order executed" description={descriptionLine} />, {
    duration: 4500,
    position: "bottom-center",
    className: "!bg-transparent !border-0 !p-0 !shadow-none",
  });
}

export function showPositionExitToast(descriptionLine: string, pnlLine: string): void {
  toast.custom(() => <TradeToastBody title="Position exited" description={`${descriptionLine} ${pnlLine}`} />, {
    duration: 4500,
    position: "bottom-center",
    className: "!bg-transparent !border-0 !p-0 !shadow-none",
  });
}

/** Groww-like compact toast shown on swipe-to-exit success. */
export function showSellOrderExecutedToast(): void {
  toast.custom(
    () => (
      <div className="pointer-events-auto mx-[max(0.5rem,env(safe-area-inset-left))] mr-[max(0.5rem,env(safe-area-inset-right))] flex items-center gap-2.5 rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-neutral-900 shadow-md sm:mx-auto sm:w-[min(100vw-1rem,28rem)]">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500">
          <CheckCircle2 className="h-4 w-4 text-white" strokeWidth={2.5} />
        </span>
        <div className="min-w-0">
          <p className="text-[13px] font-medium leading-tight text-neutral-900">Sell order executed</p>
          <p className="mt-0.5 text-[11px] leading-tight text-neutral-500">in 0.02 seconds ⚡</p>
        </div>
      </div>
    ),
    {
      duration: 2000,
      position: "bottom-center",
      className: "!bg-transparent !border-0 !p-0 !shadow-none",
    },
  );
}
