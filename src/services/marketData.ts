import type { MarketIndex, Stock } from "@/data/mockData";

type Quote = {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
};

type ProviderName = "mock" | "twelve-data" | "kite-backend";
export type LiveStatus = "simulated" | "live" | "rate-limited" | "auth-required" | "error";

/**
 * How often the UI refetches Kite quotes over REST. There is no Kite WebSocket (Ticker) in this app yet —
 * lower = snappier, but more API calls (batched per screen: one request per stocks list, one per indices).
 */
export const KITE_LIVE_POLL_MS = 3500;

/** Kite `EXCHANGE:SYMBOL` keys for the stocks list (WebSocket + REST). */
export const getKiteInstrumentKeysForStocks = (baseStocks: Stock[]): string[] =>
  baseStocks.map((s) => KITE_SYMBOL_MAP[s.symbol]).filter((x): x is string => Boolean(x));

/** Kite keys for index strip. */
export const getKiteInstrumentKeysForIndices = (baseIndices: MarketIndex[]): string[] =>
  baseIndices.map((i) => KITE_INDEX_SYMBOL_MAP[i.name]).filter((x): x is string => Boolean(x));
export type LiveStocksResult = { stocks: Stock[]; status: LiveStatus };
export type LiveIndicesResult = { indices: MarketIndex[]; status: LiveStatus };

const STOCK_SYMBOL_MAP: Record<string, string> = {
  TRIVENI: "NSE:TRITURBINE",
  BSE: "NSE:BSE",
  ZOMATO: "NSE:ZOMATO",
  SWIGGY: "NSE:SWIGGY",
  TATAMOTORS: "NSE:TATAMOTORS",
  RELIANCE: "NSE:RELIANCE",
  INFY: "NSE:INFY",
  HDFCBANK: "NSE:HDFCBANK",
  TCS: "NSE:TCS",
  ITC: "NSE:ITC",
  NIFTYBEES: "NSE:NIFTYBEES",
  SETFNIF50: "NSE:SETFNIF50",
  ICICINIFTY: "NSE:ICICINIFTY",
  BHARTIARTL: "NSE:BHARTIARTL",
  SBIN: "NSE:SBIN",
  ICICIBANK: "NSE:ICICIBANK",
  KOTAKBANK: "NSE:KOTAKBANK",
  AXISBANK: "NSE:AXISBANK",
  LT: "NSE:LT",
  HINDUNILVR: "NSE:HINDUNILVR",
  NESTLEIND: "NSE:NESTLEIND",
  MARUTI: "NSE:MARUTI",
  "M&M": "NSE:M&M",
  SUNPHARMA: "NSE:SUNPHARMA",
  WIPRO: "NSE:WIPRO",
  HCLTECH: "NSE:HCLTECH",
  ONGC: "NSE:ONGC",
  ADANIENT: "NSE:ADANIENT",
  ASIANPAINT: "NSE:ASIANPAINT",
  ULTRACEMCO: "NSE:ULTRACEMCO",
  TITAN: "NSE:TITAN",
};

export const KITE_SYMBOL_MAP: Record<string, string> = {
  TRIVENI: "NSE:TRITURBINE",
  BSE: "NSE:BSE",
  ZOMATO: "NSE:ZOMATO",
  SWIGGY: "NSE:SWIGGY",
  TATAMOTORS: "NSE:TATAMOTORS",
  RELIANCE: "NSE:RELIANCE",
  INFY: "NSE:INFY",
  HDFCBANK: "NSE:HDFCBANK",
  TCS: "NSE:TCS",
  ITC: "NSE:ITC",
  NIFTYBEES: "NSE:NIFTYBEES",
  SETFNIF50: "NSE:SETFNIF50",
  ICICINIFTY: "NSE:ICICINIFTY",
  BHARTIARTL: "NSE:BHARTIARTL",
  SBIN: "NSE:SBIN",
  ICICIBANK: "NSE:ICICIBANK",
  KOTAKBANK: "NSE:KOTAKBANK",
  AXISBANK: "NSE:AXISBANK",
  LT: "NSE:LT",
  HINDUNILVR: "NSE:HINDUNILVR",
  NESTLEIND: "NSE:NESTLEIND",
  MARUTI: "NSE:MARUTI",
  "M&M": "NSE:M&M",
  SUNPHARMA: "NSE:SUNPHARMA",
  WIPRO: "NSE:WIPRO",
  HCLTECH: "NSE:HCLTECH",
  ONGC: "NSE:ONGC",
  ADANIENT: "NSE:ADANIENT",
  ASIANPAINT: "NSE:ASIANPAINT",
  ULTRACEMCO: "NSE:ULTRACEMCO",
  TITAN: "NSE:TITAN",
};

export const KITE_INDEX_SYMBOL_MAP: Record<string, string> = {
  "NIFTY 50": "NSE:NIFTY 50",
  "BANK NIFTY": "NSE:NIFTY BANK",
  SENSEX: "BSE:SENSEX",
};

const parseNumber = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const zeroStocks = (baseStocks: Stock[]): Stock[] =>
  baseStocks.map((stock) => ({ ...stock, price: 0, change: 0, changePercent: 0 }));
const zeroIndices = (baseIndices: MarketIndex[]): MarketIndex[] =>
  baseIndices.map((index) => ({ ...index, value: 0, change: 0, changePercent: 0 }));

const createMockQuote = (stock: Stock): Quote => {
  const drift = (Math.random() - 0.5) * (stock.price * 0.003);
  const price = Math.max(0.01, stock.price + drift);
  const change = price - (stock.price - stock.change);
  const changePercent = (change / (price - change || 1)) * 100;

  return {
    symbol: stock.symbol,
    price: Number(price.toFixed(2)),
    change: Number(change.toFixed(2)),
    changePercent: Number(changePercent.toFixed(2)),
  };
};

const toQuote = (symbol: string, data: Record<string, unknown>): Quote | null => {
  const price = parseNumber(data?.close);
  if (price <= 0) return null;

  return {
    symbol,
    price,
    change: parseNumber(data?.change),
    changePercent: parseNumber(String(data?.percent_change ?? "").replace("%", "")),
  };
};

const fetchQuotesFromTwelveData = async (apiSymbols: string[], apiKey: string) => {
  if (apiSymbols.length === 0) return { quotesBySymbol: {} as Record<string, Quote>, rateLimited: false };

  const url = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(apiSymbols.join(","))}&apikey=${encodeURIComponent(apiKey)}`;
  const response = await fetch(url);
  if (!response.ok) return { quotesBySymbol: {} as Record<string, Quote>, rateLimited: false };

  const data = await response.json();
  if (data?.status === "error") {
    return {
      quotesBySymbol: {} as Record<string, Quote>,
      rateLimited: Number(data?.code) === 429,
    };
  }

  // Single symbol response
  if (data?.close !== undefined) {
    const single = toQuote(apiSymbols[0], data as Record<string, unknown>);
    return {
      quotesBySymbol: single ? { [apiSymbols[0]]: single } : {},
      rateLimited: false,
    };
  }

  // Multi symbol response keyed by api symbol
  const quotesBySymbol: Record<string, Quote> = {};
  for (const symbol of apiSymbols) {
    const raw = data?.[symbol];
    if (!raw || typeof raw !== "object") continue;
    const q = toQuote(symbol, raw as Record<string, unknown>);
    if (q) quotesBySymbol[symbol] = q;
  }
  return { quotesBySymbol, rateLimited: false };
};

export const detectProvider = (): ProviderName =>
  (import.meta.env.VITE_MARKET_DATA_PROVIDER as ProviderName | undefined) ||
  (import.meta.env.VITE_TWELVE_DATA_API_KEY ? "twelve-data" : "mock");

const getKiteBackendQuotes = async (baseStocks: Stock[]): Promise<LiveStocksResult> => {
  const apiBase = import.meta.env.VITE_MARKET_DATA_API_BASE || "http://127.0.0.1:3001";
  const instruments = baseStocks
    .map((stock) => KITE_SYMBOL_MAP[stock.symbol])
    .filter((s): s is string => Boolean(s));

  if (instruments.length === 0) return { stocks: zeroStocks(baseStocks), status: "error" };

  const url = `${apiBase}/api/quotes?symbols=${encodeURIComponent(instruments.join(","))}`;
  const response = await fetch(url);

  if (response.status === 401) return { stocks: zeroStocks(baseStocks), status: "auth-required" };
  if (!response.ok) return { stocks: zeroStocks(baseStocks), status: "error" };

  const data = await response.json();
  const quotes = data?.quotes ?? {};

  let updatedCount = 0;
  const stocks = baseStocks.map((stock) => {
    const key = KITE_SYMBOL_MAP[stock.symbol];
    const quote = quotes[key];
    if (!quote) return stock;

    const lastPrice = parseNumber(quote.last_price);
    const ohlcClose = parseNumber(quote?.ohlc?.close, 0);
    const derivedChange = ohlcClose > 0 ? lastPrice - ohlcClose : 0;
    const apiNetChange = parseNumber(quote.net_change, Number.NaN);
    // Kite can return 0 for net_change even when close-based move exists.
    const finalChange = Number.isFinite(apiNetChange) && Math.abs(apiNetChange) > 0 ? apiNetChange : derivedChange;
    const changePercent = ohlcClose > 0 ? Number(((finalChange / ohlcClose) * 100).toFixed(2)) : stock.changePercent;

    if (lastPrice <= 0) return stock;
    updatedCount += 1;

    return {
      ...stock,
      price: Number(lastPrice.toFixed(2)),
      change: Number(finalChange.toFixed(2)),
      changePercent,
    };
  });

  return { stocks, status: updatedCount > 0 ? "live" : "error" };
};

const getKiteBackendIndices = async (baseIndices: MarketIndex[]): Promise<LiveIndicesResult> => {
  const apiBase = import.meta.env.VITE_MARKET_DATA_API_BASE || "http://127.0.0.1:3001";
  const instruments = baseIndices
    .map((index) => KITE_INDEX_SYMBOL_MAP[index.name])
    .filter((s): s is string => Boolean(s));

  if (instruments.length === 0) return { indices: zeroIndices(baseIndices), status: "error" };

  const url = `${apiBase}/api/quotes?symbols=${encodeURIComponent(instruments.join(","))}`;
  const response = await fetch(url);

  if (response.status === 401) return { indices: zeroIndices(baseIndices), status: "auth-required" };
  if (!response.ok) return { indices: zeroIndices(baseIndices), status: "error" };

  const data = await response.json();
  const quotes = data?.quotes ?? {};

  let updatedCount = 0;
  const indices = baseIndices.map((index) => {
    const key = KITE_INDEX_SYMBOL_MAP[index.name];
    const quote = key ? quotes[key] : null;
    if (!quote) return index;

    const lastPrice = parseNumber(quote.last_price);
    const close = parseNumber(quote?.ohlc?.close, 0);
    if (lastPrice <= 0 || close <= 0) return index;

    const change = Number((lastPrice - close).toFixed(2));
    const changePercent = Number(((change / close) * 100).toFixed(2));
    updatedCount += 1;

    return {
      ...index,
      value: Number(lastPrice.toFixed(2)),
      change,
      changePercent,
    };
  });

  return { indices, status: updatedCount > 0 ? "live" : "error" };
};

export const getLiveStocks = async (baseStocks: Stock[]): Promise<LiveStocksResult> => {
  const provider = detectProvider();

  if (provider === "kite-backend") {
    return getKiteBackendQuotes(baseStocks);
  }

  if (provider === "mock") {
    return {
      status: "simulated",
      stocks: baseStocks.map((stock) => {
      const q = createMockQuote(stock);
      return { ...stock, price: q.price, change: q.change, changePercent: q.changePercent };
      }),
    };
  }

  const apiKey = import.meta.env.VITE_TWELVE_DATA_API_KEY as string;
  const apiSymbols = baseStocks
    .map((stock) => STOCK_SYMBOL_MAP[stock.symbol])
    .filter((symbol): symbol is string => Boolean(symbol));

  const { quotesBySymbol, rateLimited } = await fetchQuotesFromTwelveData(apiSymbols, apiKey);

  let updatedCount = 0;
  const stocks = baseStocks.map((stock) => {
    const apiSymbol = STOCK_SYMBOL_MAP[stock.symbol];
    if (!apiSymbol) return stock;
    const quote = quotesBySymbol[apiSymbol];
    if (!quote) return stock;
    updatedCount += 1;
    return {
      ...stock,
      price: quote.price,
      change: quote.change,
      changePercent: quote.changePercent,
    };
  });

  return {
    stocks,
    status: updatedCount > 0 ? "live" : rateLimited ? "rate-limited" : "simulated",
  };
};

export const getLiveIndices = async (baseIndices: MarketIndex[]): Promise<LiveIndicesResult> => {
  const provider = detectProvider();

  if (provider === "kite-backend") {
    return getKiteBackendIndices(baseIndices);
  }

  return { indices: baseIndices, status: "simulated" };
};

/** Kite instrument key for a single stock or index (detail page). */
export const resolveKiteKeyForStock = (stock: Stock): string | null => {
  if (stock.sector === "Index") {
    return KITE_INDEX_SYMBOL_MAP[stock.symbol] ?? null;
  }
  return KITE_SYMBOL_MAP[stock.symbol] ?? null;
};

export type StockQuoteSnapshot = {
  price: number;
  change: number;
  changePercent: number;
  ohlc?: { open: number; high: number; low: number; close: number };
};

/** One-shot live quote for stock detail header + intraday chart seeding. */
export const getLiveStockSnapshot = async (
  stock: Stock,
): Promise<{ snapshot: StockQuoteSnapshot | null; status: LiveStatus }> => {
  const provider = detectProvider();
  const key = resolveKiteKeyForStock(stock);

  if (provider === "kite-backend" && key) {
    const apiBase = import.meta.env.VITE_MARKET_DATA_API_BASE || "http://127.0.0.1:3001";
    const url = `${apiBase}/api/quotes?symbols=${encodeURIComponent(key)}`;
    const response = await fetch(url);
    if (response.status === 401) return { snapshot: null, status: "auth-required" };
    if (!response.ok) return { snapshot: null, status: "error" };

    const data = await response.json();
    const quote = data?.quotes?.[key];
    if (!quote) return { snapshot: null, status: "error" };

    const lastPrice = parseNumber(quote.last_price);
    const ohlcClose = parseNumber(quote?.ohlc?.close, 0);
    const derivedChange = ohlcClose > 0 ? lastPrice - ohlcClose : 0;
    const apiNetChange = parseNumber(quote.net_change, Number.NaN);
    const finalChange =
      Number.isFinite(apiNetChange) && Math.abs(apiNetChange) > 0 ? apiNetChange : derivedChange;
    const changePercent =
      ohlcClose > 0 ? Number(((finalChange / ohlcClose) * 100).toFixed(2)) : stock.changePercent;

    if (lastPrice <= 0) return { snapshot: null, status: "error" };

    const open = parseNumber(quote?.ohlc?.open, 0);
    const high = parseNumber(quote?.ohlc?.high, 0);
    const low = parseNumber(quote?.ohlc?.low, 0);
    const prevClose = ohlcClose > 0 ? ohlcClose : lastPrice - finalChange;

    const ohlc =
      open > 0 && high > 0 && low > 0
        ? { open, high, low, close: prevClose }
        : {
            open: prevClose,
            high: Math.max(prevClose, lastPrice),
            low: Math.min(prevClose, lastPrice),
            close: prevClose,
          };

    return {
      snapshot: {
        price: Number(lastPrice.toFixed(2)),
        change: Number(finalChange.toFixed(2)),
        changePercent,
        ohlc,
      },
      status: "live",
    };
  }

  if (provider === "mock") {
    const q = createMockQuote(stock);
    const prev = q.price - q.change;
    return {
      snapshot: {
        price: q.price,
        change: q.change,
        changePercent: q.changePercent,
        ohlc: {
          open: prev,
          high: Math.max(prev, q.price) * 1.002,
          low: Math.min(prev, q.price) * 0.998,
          close: prev,
        },
      },
      status: "simulated",
    };
  }

  return { snapshot: null, status: "simulated" };
};
