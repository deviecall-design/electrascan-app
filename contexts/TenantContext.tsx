import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export interface TenantConfig {
  tradingName: string;
  logoUrl: string;
  abn: string;
  address: string;
  contactEmail: string;
  contactPhone: string;
  replyToEmail: string;
}

export const DEFAULT_TENANT: TenantConfig = {
  tradingName: "Vesh Electrical Services",
  logoUrl: "",
  abn: "XX XXX XXX XXX",
  address: "",
  contactEmail: "",
  contactPhone: "",
  replyToEmail: "",
};

const STORAGE_KEY = "electrascan.tenantConfig.v1";

function loadTenant(): TenantConfig {
  if (typeof window === "undefined") return DEFAULT_TENANT;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_TENANT;
    const parsed = JSON.parse(raw) as Partial<TenantConfig>;
    return { ...DEFAULT_TENANT, ...parsed };
  } catch {
    return DEFAULT_TENANT;
  }
}

interface TenantContextValue {
  tenant: TenantConfig;
  updateTenant: (patch: Partial<TenantConfig>) => void;
  resetTenant: () => void;
}

const TenantContext = createContext<TenantContextValue | undefined>(undefined);

export const TenantProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [tenant, setTenant] = useState<TenantConfig>(() => loadTenant());

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tenant));
    } catch {
      // storage disabled — ignore
    }
  }, [tenant]);

  const updateTenant = useCallback((patch: Partial<TenantConfig>) => {
    setTenant(prev => ({ ...prev, ...patch }));
  }, []);

  const resetTenant = useCallback(() => setTenant(DEFAULT_TENANT), []);

  const value = useMemo(() => ({ tenant, updateTenant, resetTenant }), [tenant, updateTenant, resetTenant]);

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
};

export function useTenant(): TenantContextValue {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error("useTenant must be used within a TenantProvider");
  return ctx;
}
