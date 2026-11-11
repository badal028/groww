import type { Instrument } from "./types";

const index = (exchange: string, symbol: string): Instrument => ({
  key: `${exchange}:${symbol}`,
  exchange,
  tradingsymbol: symbol,
  name: symbol,
  tag: "INDICES",
  type: "INDEX",
  expiry: null,
  strike: null,
  lotSize: 1,
  weekly: false,
  base: symbol,
  day: null,
  mon: null,
  subtitle: symbol,
  suffix: "",
  underlying: symbol,
});

export const NIFTY_50 = index("NSE", "NIFTY 50");
export const NIFTY_BANK = index("NSE", "NIFTY BANK");
export const SENSEX = index("BSE", "SENSEX");
