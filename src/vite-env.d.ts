/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TWELVE_DATA_API_KEY?: string;
  readonly VITE_MARKET_DATA_PROVIDER?: "mock" | "twelve-data" | "kite-backend";
  readonly VITE_MARKET_DATA_API_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
