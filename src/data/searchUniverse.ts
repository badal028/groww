import type { Stock } from "@/data/mockData";
import {
  additionalSearchStocks,
  etfStocks,
  holdingsData,
  marketIndices,
  popularStocks,
} from "@/data/mockData";

/** All stocks + indices users can open from search (deduped by `id`). */
export function getSearchUniverse(): Stock[] {
  const indexRows: Stock[] = marketIndices.map((idx) => ({
    id: idx.name,
    name: idx.name,
    symbol: idx.name.replace(/\s+/g, ""),
    price: idx.value,
    change: idx.change,
    changePercent: idx.changePercent,
    sector: "Index",
    exchange: "INDEX",
  }));

  const merged = [
    ...indexRows,
    ...popularStocks,
    ...holdingsData,
    ...etfStocks,
    ...additionalSearchStocks,
  ];

  const seen = new Set<string>();
  const out: Stock[] = [];
  for (const row of merged) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
  }
  return out;
}
