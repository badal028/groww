/** Display label for F&O underlying (positions / orders / trade header). */
export function formatFoUnderlyingDisplay(symbol: string): string {
  const n = String(symbol || "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
  if (n === "NIFTY 50") return "NIFTY";
  return String(symbol || "").trim();
}
