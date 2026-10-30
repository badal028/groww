import type { Instrument } from "@/lib/types";
import { WeeklyBadge } from "./Icons";

const ordSuffix = (n: number) => {
  const s = n % 100;
  if (s >= 11 && s <= 13) return "th";
  return n % 10 === 1 ? "st" : n % 10 === 2 ? "nd" : n % 10 === 3 ? "rd" : "th";
};

export const expiryDay = (inst: Instrument) => {
  if (!inst.weekly || !inst.expiry) return null;
  const dd = inst.expiry.slice(8, 10);
  return { dd, suf: ordSuffix(Number(dd)) };
};

/** Plain text label, e.g. "NIFTY 03rd NOV 21000 PE". */
export const instrumentText = (inst: Instrument | undefined, fallback = "") => {
  if (!inst) return fallback;
  if (!inst.expiry) return inst.base;
  const d = expiryDay(inst);
  return [inst.base, d ? `${d.dd}${d.suf}` : null, inst.mon, inst.suffix].filter(Boolean).join(" ");
};

export function InstrumentName({ inst, fallback = "" }: { inst?: Instrument; fallback?: string }) {
  if (!inst) return <span className="iname">{fallback}</span>;
  if (!inst.expiry) return <span className="iname">{inst.base}</span>;
  const d = expiryDay(inst);
  return (
    <span className="iname">
      {inst.base}{" "}
      {d && (
        <>
          {d.dd}
          <sup>{d.suf}</sup> <WeeklyBadge />{" "}
        </>
      )}
      {inst.mon} {inst.suffix}
    </span>
  );
}

/** Fallback instrument built from a paper position/order when the backend lookup is unavailable. */
export const fallbackInstrument = (o: {
  symbol: string;
  instrumentType?: string;
  optionType?: string | null;
  strike?: number | null;
  expiry?: string | null;
  kiteSymbol?: string;
}): Instrument => {
  const key = o.kiteSymbol || `NSE:${o.symbol}`;
  const exchange = key.split(":")[0] || "NSE";
  const isFo = String(o.instrumentType || "").toUpperCase() === "FO";
  return {
    key,
    exchange,
    tradingsymbol: key.split(":").slice(1).join(":") || o.symbol,
    name: o.symbol,
    tag: exchange,
    type: isFo ? ((o.optionType as "CE" | "PE") || "CE") : "EQ",
    expiry: null,
    strike: o.strike ?? null,
    lotSize: 1,
    weekly: false,
    base: isFo ? `${o.symbol}${o.strike ? ` ${o.strike}` : ""}${o.optionType ? ` ${o.optionType}` : ""}` : o.symbol,
    day: null,
    mon: null,
    subtitle: "",
    suffix: "",
    underlying: o.symbol,
  };
};
