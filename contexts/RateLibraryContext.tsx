import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { LibraryItem, RateCategory } from "../services/rateLibraryService";

export type { LibraryItem, RateCategory };

export interface CustomLibraryItem extends LibraryItem {
  custom?: boolean;
  marginPct?: number;
}

const STORAGE_KEY = "electrascan_rate_library";

function safeLoad(): CustomLibraryItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CustomLibraryItem[]) : [];
  } catch {
    return [];
  }
}

function safeSave(items: CustomLibraryItem[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // storage disabled / quota
  }
}

interface RateLibraryValue {
  items: CustomLibraryItem[];
  addItem: (item: CustomLibraryItem) => void;
  updateItem: (productId: string, patch: Partial<CustomLibraryItem>) => void;
  removeItem: (productId: string) => void;
  hasItem: (productId: string) => boolean;
}

const RateLibraryContext = createContext<RateLibraryValue | undefined>(undefined);

export const RateLibraryProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CustomLibraryItem[]>(() => safeLoad());

  useEffect(() => {
    safeSave(items);
  }, [items]);

  const addItem = useCallback((item: CustomLibraryItem) => {
    setItems(prev => [...prev.filter(x => x.productId !== item.productId), item]);
  }, []);

  const updateItem = useCallback((productId: string, patch: Partial<CustomLibraryItem>) => {
    setItems(prev => prev.map(x => (x.productId === productId ? { ...x, ...patch } : x)));
  }, []);

  const removeItem = useCallback((productId: string) => {
    setItems(prev => prev.filter(x => x.productId !== productId));
  }, []);

  const hasItem = useCallback(
    (productId: string) => items.some(x => x.productId === productId),
    [items],
  );

  const value = useMemo<RateLibraryValue>(
    () => ({ items, addItem, updateItem, removeItem, hasItem }),
    [items, addItem, updateItem, removeItem, hasItem],
  );

  return (
    <RateLibraryContext.Provider value={value}>{children}</RateLibraryContext.Provider>
  );
};

export function useRateLibrary(): RateLibraryValue {
  const ctx = useContext(RateLibraryContext);
  if (!ctx) throw new Error("useRateLibrary must be used within a RateLibraryProvider");
  return ctx;
}
