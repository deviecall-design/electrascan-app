export type AssetClass = "crypto" | "us_equity" | "asx";
export type Direction = "long" | "short";
export type Confidence = "LOW" | "MED" | "HIGH";

export interface WatchlistRow {
  ticker: string;
  name: string;
  asset_class: AssetClass;
  theme: string | null;
  active: boolean;
  last_price: number | null;
  last_checked: string | null;
}

export interface Quote {
  ticker: string;
  price: number;
  previousClose: number;
  changePct: number;
  asOf: string;
}

export interface TradePlan {
  ticker: string;
  direction: Direction;
  timeframe: string;
  thesis: string;
  entry_price: number;
  stop_price: number;
  tp1: number;
  tp2: number;
  tp3: number;
  size_units: number;
  risk_pct: number;
  rr_ratio: number;
  confidence: Confidence;
  mirofish_score: number;
  mirofish_prediction: string;
}
