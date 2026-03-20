export interface Stock {
  id: string;
  name: string;
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  logo?: string;
  sector: string;
  exchange: string;
  /** NSE cash lot size; +/- and validation use multiples (default 1). */
  lotSize?: number;
}

export interface MutualFund {
  id: string;
  name: string;
  type: string;
  currentValue: number;
  investedValue: number;
  returns: number;
  returnsPercent: number;
  xirr?: number;
}

export interface MarketIndex {
  name: string;
  value: number;
  change: number;
  changePercent: number;
}

export const marketIndices: MarketIndex[] = [
  { name: "NIFTY 50", value: 24194.50, change: -27.40, changePercent: -0.11 },
  { name: "BANK NIFTY", value: 52191.50, change: -16.00, changePercent: -0.03 },
  { name: "SENSEX", value: 79486.32, change: -100.20, changePercent: -0.13 },
];

export const popularStocks: Stock[] = [
  { id: "1", name: "Triveni Turbine", symbol: "TRIVENI", price: 823.96, change: 59.80, changePercent: 7.83, sector: "Electrical Equip.", exchange: "NSE", lotSize: 65 },
  { id: "2", name: "BSE", symbol: "BSE", price: 4431.10, change: -255.70, changePercent: -5.46, sector: "Financial Services", exchange: "NSE" },
  { id: "3", name: "Zomato", symbol: "ZOMATO", price: 280.11, change: 6.80, changePercent: 2.49, sector: "Consumer Services", exchange: "NSE" },
  { id: "4", name: "Swiggy", symbol: "SWIGGY", price: 461.90, change: 31.20, changePercent: 7.24, sector: "Consumer Services", exchange: "NSE" },
  { id: "5", name: "Tata Motors", symbol: "TATAMOTORS", price: 785.40, change: 12.30, changePercent: 1.59, sector: "Automobile", exchange: "NSE" },
  { id: "6", name: "Reliance Industries", symbol: "RELIANCE", price: 2945.80, change: -18.50, changePercent: -0.62, sector: "Oil & Gas", exchange: "NSE" },
  { id: "7", name: "Infosys", symbol: "INFY", price: 1876.25, change: 23.40, changePercent: 1.26, sector: "IT", exchange: "NSE" },
  { id: "8", name: "HDFC Bank", symbol: "HDFCBANK", price: 1742.30, change: -8.90, changePercent: -0.51, sector: "Banking", exchange: "NSE", lotSize: 1 },
  { id: "9", name: "TCS", symbol: "TCS", price: 4230.50, change: 45.20, changePercent: 1.08, sector: "IT", exchange: "NSE" },
  { id: "10", name: "ITC", symbol: "ITC", price: 465.80, change: 3.20, changePercent: 0.69, sector: "FMCG", exchange: "NSE" },
];

export const etfStocks: Stock[] = [
  { id: "e1", name: "Nippon India ETF Nifty 50", symbol: "NIFTYBEES", price: 242.50, change: 1.20, changePercent: 0.50, sector: "ETF", exchange: "NSE" },
  { id: "e2", name: "SBI ETF Nifty 50", symbol: "SETFNIF50", price: 245.30, change: -0.80, changePercent: -0.33, sector: "ETF", exchange: "NSE" },
  { id: "e3", name: "ICICI Pru Nifty ETF", symbol: "ICICINIFTY", price: 243.10, change: 0.90, changePercent: 0.37, sector: "ETF", exchange: "NSE" },
];

export const holdingsData: Stock[] = [
  { id: "h1", name: "Reliance Industries", symbol: "RELIANCE", price: 2945.80, change: -18.50, changePercent: -0.62, sector: "Oil & Gas", exchange: "NSE" },
  { id: "h2", name: "Infosys", symbol: "INFY", price: 1876.25, change: 23.40, changePercent: 1.26, sector: "IT", exchange: "NSE" },
  { id: "h3", name: "TCS", symbol: "TCS", price: 4230.50, change: 45.20, changePercent: 1.08, sector: "IT", exchange: "NSE" },
];

/** Extra liquid names for search (logos best-effort via CDN). Extend this list anytime. */
export const additionalSearchStocks: Stock[] = [
  { id: "s-bharti", name: "Bharti Airtel", symbol: "BHARTIARTL", price: 0, change: 0, changePercent: 0, sector: "Telecom", exchange: "NSE" },
  { id: "s-sbin", name: "State Bank of India", symbol: "SBIN", price: 0, change: 0, changePercent: 0, sector: "Banking", exchange: "NSE" },
  { id: "s-icici", name: "ICICI Bank", symbol: "ICICIBANK", price: 0, change: 0, changePercent: 0, sector: "Banking", exchange: "NSE" },
  { id: "s-kotak", name: "Kotak Mahindra Bank", symbol: "KOTAKBANK", price: 0, change: 0, changePercent: 0, sector: "Banking", exchange: "NSE" },
  { id: "s-axis", name: "Axis Bank", symbol: "AXISBANK", price: 0, change: 0, changePercent: 0, sector: "Banking", exchange: "NSE" },
  { id: "s-lt", name: "Larsen & Toubro", symbol: "LT", price: 0, change: 0, changePercent: 0, sector: "Infra", exchange: "NSE" },
  { id: "s-hind", name: "Hindustan Unilever", symbol: "HINDUNILVR", price: 0, change: 0, changePercent: 0, sector: "FMCG", exchange: "NSE" },
  { id: "s-nestle", name: "Nestle India", symbol: "NESTLEIND", price: 0, change: 0, changePercent: 0, sector: "FMCG", exchange: "NSE" },
  { id: "s-maruti", name: "Maruti Suzuki", symbol: "MARUTI", price: 0, change: 0, changePercent: 0, sector: "Automobile", exchange: "NSE" },
  { id: "s-mnm", name: "Mahindra & Mahindra", symbol: "M&M", price: 0, change: 0, changePercent: 0, sector: "Automobile", exchange: "NSE" },
  { id: "s-sun", name: "Sun Pharma", symbol: "SUNPHARMA", price: 0, change: 0, changePercent: 0, sector: "Pharma", exchange: "NSE" },
  { id: "s-wipro", name: "Wipro", symbol: "WIPRO", price: 0, change: 0, changePercent: 0, sector: "IT", exchange: "NSE" },
  { id: "s-hcl", name: "HCL Technologies", symbol: "HCLTECH", price: 0, change: 0, changePercent: 0, sector: "IT", exchange: "NSE" },
  { id: "s-ongc", name: "ONGC", symbol: "ONGC", price: 0, change: 0, changePercent: 0, sector: "Oil & Gas", exchange: "NSE" },
  { id: "s-adani", name: "Adani Enterprises", symbol: "ADANIENT", price: 0, change: 0, changePercent: 0, sector: "Diversified", exchange: "NSE" },
  { id: "s-asian", name: "Asian Paints", symbol: "ASIANPAINT", price: 0, change: 0, changePercent: 0, sector: "Chemicals", exchange: "NSE" },
  { id: "s-ultra", name: "UltraTech Cement", symbol: "ULTRACEMCO", price: 0, change: 0, changePercent: 0, sector: "Cement", exchange: "NSE" },
  { id: "s-titan", name: "Titan Company", symbol: "TITAN", price: 0, change: 0, changePercent: 0, sector: "Consumer", exchange: "NSE" },
];

export const mutualFunds: MutualFund[] = [
  { id: "mf1", name: "Motilal Oswal Midcap Fund Direct Growth", type: "SIP", currentValue: 52129, investedValue: 46998, returns: 5131, returnsPercent: 10.92 },
  { id: "mf2", name: "ICICI Prudential Commodities Fund Direct Growth", type: "SIP", currentValue: 52129, investedValue: 46998, returns: 5131, returnsPercent: 10.92 },
  { id: "mf3", name: "Quant Small Cap Fund Direct Plan Growth", type: "SIP", currentValue: 52129, investedValue: 46998, returns: 5131, returnsPercent: 10.92 },
];

export const stockCategories = ["Explore", "Holdings", "ETF", "Road Const.", "IT", "Banking", "FMCG"];

// Generate mock chart data
export const generateChartData = (days: number, basePrice: number) => {
  const data = [];
  let price = basePrice;
  const now = Date.now();
  for (let i = days; i >= 0; i--) {
    price = price + (Math.random() - 0.48) * (basePrice * 0.02);
    price = Math.max(price * 0.7, Math.min(price * 1.3, price));
    data.push({
      time: new Date(now - i * 86400000).toISOString().split('T')[0],
      price: parseFloat(price.toFixed(2)),
    });
  }
  return data;
};

export const profileMenuItems = [
  { icon: "wallet", label: "$0.00", sublabel: "Stocks, F&O balance", action: "Add money" },
  { icon: "package", label: "Orders", sublabel: "" },
  { icon: "user", label: "Account Details", sublabel: "" },
  { icon: "building", label: "Banks & Autopay", sublabel: "" },
  { icon: "share2", label: "Refer", action: "Invite" },
  { icon: "headphones", label: "Customer Support 24x7", sublabel: "" },
  { icon: "fileText", label: "Reports", sublabel: "" },
];
