import type { Stock } from "@/data/mockData";

/** NSE cash lot / tick size for quantity validation (+/− step). Defaults to 1. */
export function getEquityLotSize(stock: Pick<Stock, "sector" | "lotSize">): number {
  if (stock.sector === "Index") return 1;
  const n = stock.lotSize;
  if (typeof n === "number" && n > 0 && Number.isFinite(n)) return Math.floor(n);
  return 1;
}

export function isValidEquityQty(qty: number, lotSize: number): boolean {
  if (!Number.isFinite(qty) || qty <= 0) return false;
  if (lotSize <= 0) return Number.isInteger(qty);
  return qty >= lotSize && qty % lotSize === 0;
}
