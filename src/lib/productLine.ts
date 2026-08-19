function normalizeSymbol(symbol: string): string {
  return String(symbol || "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

/** Static exchange labels for index underlyings (positions + orders). */
const INDEX_EXCHANGE: Record<string, "NSE" | "BSE"> = {
  "NIFTY 50": "NSE",
  NIFTY50: "NSE",
  NIFTY: "NSE",
  "BANK NIFTY": "NSE",
  BANKNIFTY: "NSE",
  SENSEX: "BSE",
};

/** NSE indices vs BSE Sensex for delivery product labels. */
export function resolveEquityExchange(symbol: string): "NSE" | "BSE" {
  return INDEX_EXCHANGE[normalizeSymbol(symbol)] ?? "NSE";
}

export function formatDeliveryProductLine(instrumentType: string, symbol: string): string {
  const indexExchange = INDEX_EXCHANGE[normalizeSymbol(symbol)];
  if (indexExchange) return `Delivery · ${indexExchange}`;

  if (String(instrumentType).toUpperCase() === "FO") return "NRML · NFO";
  return `Delivery · ${resolveEquityExchange(symbol)}`;
}
