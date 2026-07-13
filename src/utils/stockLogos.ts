/**
 * Stock logo URLs — try CloudTradeIn AMC bucket (first word of company name), then Groww CDN, then initials in UI.
 */
const SYMBOL_ALIASES: Record<string, string> = {
  TRIVENI: "TRITURBINE",
  ETERNAL: "ZOMATO",
};

/** e.g. https://cloudtradein.s3.ap-south-1.amazonaws.com/amc/kotak.png */
const AMC_LOGO_BASE =
  (import.meta.env.VITE_STOCK_LOGO_AMC_BASE as string | undefined)?.trim() ||
  "https://cloudtradein.s3.ap-south-1.amazonaws.com/amc";

function normalizeForCdn(symbol: string): string {
  const u = symbol.trim().toUpperCase();
  return SYMBOL_ALIASES[u] ?? u;
}

/** "Kotak Mahindra Bank" → kotak, "HDFC Bank" → hdfc */
export function stockLogoAmcKey(name: string, symbol: string): string {
  const first = String(name || "")
    .trim()
    .split(/\s+/)[0]
    ?.toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  if (first) return first;

  const sym = symbol.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  if (sym.endsWith("bank") && sym.length > 4) return sym.slice(0, -4);
  return sym;
}

export function stockLogoInitial(name: string, symbol: string): string {
  const key = stockLogoAmcKey(name, symbol);
  return (key[0] || symbol.replace(/[^A-Za-z0-9]/g, "")[0] || "?").toUpperCase();
}

/** Ordered list of image URLs to try (first working wins). */
export function getStockLogoUrlCandidates(
  symbol: string,
  sector: string,
  name = "",
): string[] {
  if (sector === "Index") return [];

  const amcKey = stockLogoAmcKey(name, symbol);
  const sym = normalizeForCdn(symbol);
  const enc = encodeURIComponent(sym);

  const urls: string[] = [];
  if (amcKey) {
    urls.push(`${AMC_LOGO_BASE}/${encodeURIComponent(amcKey)}.png`);
  }
  urls.push(
    `https://assets-netstorage.groww.in/stock-assets/logos/${enc}.png`,
    `https://assets-netstorage.groww.in/stock-assets/logos/${enc}.svg`,
  );
  return urls;
}
