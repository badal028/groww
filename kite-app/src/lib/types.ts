export type Instrument = {
  key: string;
  exchange: string;
  tradingsymbol: string;
  name: string;
  tag: string;
  type: "CE" | "PE" | "FUT" | "EQ" | "INDEX";
  expiry: string | null;
  strike: number | null;
  lotSize: number;
  weekly: boolean;
  base: string;
  day: string | null;
  mon: string | null;
  subtitle: string;
  suffix: string;
  underlying: string;
};

export type DepthLevel = { price: number; quantity: number; orders: number };

export type Quote = {
  last: number;
  change: number;
  changePct: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
  avgPrice?: number;
  lastQty?: number;
  lastTradeTime?: string;
  lowerCircuit?: number;
  upperCircuit?: number;
  oi?: number;
  buyQty?: number;
  sellQty?: number;
  depth?: { buy: DepthLevel[]; sell: DepthLevel[] };
};

export type Position = {
  instrumentKey: string;
  baseInstrumentKey?: string;
  symbol: string;
  instrumentType: string;
  optionType?: string | null;
  strike?: number | null;
  expiry?: string | null;
  quantity: number;
  avgPrice: number;
  kiteSymbol?: string;
  product?: string;
  exited?: boolean;
  exitedAt?: string;
  exitPrice?: number;
  realizedPnlInr?: number;
  openedAt?: string;
  lastTradedAt?: string;
};

export type Order = {
  id: string;
  symbol: string;
  side: "BUY" | "SELL";
  quantity: number;
  filledQuantity?: number;
  price: number;
  orderMode: string;
  instrumentType: string;
  optionType?: string | null;
  strike?: number | null;
  expiry?: string | null;
  product?: string;
  kiteSymbol?: string;
  notional?: number;
  status: string;
  rejectReason?: string;
  placedAt?: string;
  filledAt?: string | null;
};

export type User = {
  id: string;
  name: string;
  email: string;
  walletInr: number;
  realizedPnlInr: number;
  canAdjustWallet?: boolean;
  canClearPositions?: boolean;
};

export type Profile = { clientId: string; name: string; email: string };
