import type { PaperPosition } from "@/hooks/usePaperPositions";
import { KITE_SYMBOL_MAP } from "@/services/marketData";

/** Resolve Kite quote/stream key for a paper position (stored kiteSymbol wins). */
export function resolveKiteKeyForPaperPosition(p: PaperPosition): string | null {
  if (p.kiteSymbol?.trim()) return p.kiteSymbol.trim();
  if (p.instrumentType === "EQ") {
    const mapped = KITE_SYMBOL_MAP[p.symbol];
    if (mapped) return mapped;
    return `NSE:${p.symbol.replace(/\s+/g, "").toUpperCase()}`;
  }
  return null;
}
