import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { VESH_ELECTRICAL_CONFIG, type TenantConfig } from "../types/tenant";

export type { TenantConfig, AccountingProvider } from "../types/tenant";
export { VESH_ELECTRICAL_CONFIG } from "../types/tenant";

export const DEFAULT_TENANT: TenantConfig = VESH_ELECTRICAL_CONFIG;

const STORAGE_KEY = "electrascan.tenantConfig.v1";

function loadTenant(): TenantConfig {
  if (typeof window === "undefined") return VESH_ELECTRICAL_CONFIG;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return VESH_ELECTRICAL_CONFIG;
    const parsed = JSON.parse(raw) as Partial<TenantConfig>;
    return { ...VESH_ELECTRICAL_CONFIG, ...parsed };
  } catch {
    return VESH_ELECTRICAL_CONFIG;
  }
}

interface TenantContextValue {
  tenant: TenantConfig;
  setTenant: (next: TenantConfig) => void;
  updateTenant: (patch: Partial<TenantConfig>) => void;
  resetTenant: () => void;
}

const TenantContext = createContext<TenantContextValue | undefined>(undefined);

export const TenantProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [tenant, setTenantState] = useState<TenantConfig>(() => loadTenant());

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tenant));
    } catch {
      // storage disabled — ignore
    }
  }, [tenant]);

  const setTenant = useCallback((next: TenantConfig) => setTenantState(next), []);
  const updateTenant = useCallback(
    (patch: Partial<TenantConfig>) => setTenantState(prev => ({ ...prev, ...patch })),
    [],
  );
  const resetTenant = useCallback(() => setTenantState(VESH_ELECTRICAL_CONFIG), []);

  const value = useMemo(
    () => ({ tenant, setTenant, updateTenant, resetTenant }),
    [tenant, setTenant, updateTenant, resetTenant],
  );

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
};

export function useTenant(): TenantContextValue {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error("useTenant must be used within a TenantProvider");
  return ctx;
}
