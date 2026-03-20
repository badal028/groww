/**
 * Best-effort public logo URLs for NSE symbols. Falls back to initials in UI if all fail.
 * Groww CDN paths are commonly used by their web app; availability is not guaranteed for every symbol.
 */
const SYMBOL_ALIASES: Record<string, string> = {
  TRIVENI: "TRITURBINE",
  ETERNAL: "ZOMATO",
};

function normalizeForCdn(symbol: string): string {
  const u = symbol.trim().toUpperCase();
  return SYMBOL_ALIASES[u] ?? u;
}

/** Ordered list of image URLs to try (first working wins). */
export function getStockLogoUrlCandidates(symbol: string, sector: string): string[] {
  if (sector === "Index") return [];
  const sym = normalizeForCdn(symbol);
  const enc = encodeURIComponent(sym);
  return [
    `https://assets-netstorage.groww.in/stock-assets/logos/${enc}.png`,
    `https://assets-netstorage.groww.in/stock-assets/logos/${enc}.svg`,
  ];
}
