const nf2 = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nf0 = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

export const fmt = (n: number | null | undefined) => (n == null || !Number.isFinite(n) ? "0.00" : nf2.format(n));
export const fmtInt = (n: number | null | undefined) => (n == null || !Number.isFinite(n) ? "0" : nf0.format(n));
export const fmtSigned = (n: number | null | undefined) => {
  const v = n == null || !Number.isFinite(n) ? 0 : n;
  return `${v > 0 ? "+" : ""}${nf2.format(v)}`;
};
export const fmtPct = (n: number | null | undefined) => {
  const v = n == null || !Number.isFinite(n) ? 0 : n;
  return `${v > 0 ? "+" : ""}${v.toFixed(2)}%`;
};

export const toneClass = (n: number | null | undefined) =>
  n == null || !Number.isFinite(n) || n === 0 ? "" : n > 0 ? "c-green" : "c-loss";

export const timeHMS = (iso?: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-GB", { hour12: false, timeZone: "Asia/Kolkata" });
};

export const dateTimeIST = (iso?: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const date = d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  return `${date} ${timeHMS(iso)}`;
};

/** Approximate Zerodha charges for a single F&O/equity order leg. */
export const estimateCharges = (exchange: string, type: string, side: "BUY" | "SELL", turnover: number) => {
  if (!Number.isFinite(turnover) || turnover <= 0) return 0;
  const isOpt = type === "CE" || type === "PE";
  const isFut = type === "FUT";
  const brokerage = isOpt ? 20 : Math.min(20, turnover * 0.0003);
  const txnRate = isOpt ? (exchange === "BFO" ? 0.000325 : 0.0003503) : isFut ? 0.0000173 : 0.0000297;
  const txn = turnover * txnRate;
  const sebi = turnover * 0.000001;
  const stamp = side === "BUY" ? turnover * (isOpt ? 0.00003 : isFut ? 0.00002 : 0.00003) : 0;
  const stt = side === "SELL" ? turnover * (isOpt ? 0.001 : isFut ? 0.0002 : 0.00025) : 0;
  const gst = 0.18 * (brokerage + txn + sebi);
  return brokerage + txn + sebi + stamp + stt + gst;
};
