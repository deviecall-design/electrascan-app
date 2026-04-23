export type AccountingProvider = "myob" | "xero" | "quickbooks" | null;

export interface TenantConfig {
  id: string;
  name: string;
  logoUrl: string | null;
  primaryColour: string;
  accentColour: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  abn: string;
  accountingProvider: AccountingProvider;
  brandingHidden: boolean;
}

export const VESH_ELECTRICAL_CONFIG: TenantConfig = {
  id: "vesh",
  name: "Vesh Electrical",
  logoUrl: null,
  primaryColour: "#F59E0B",
  accentColour: "#1F2937",
  contactEmail: "admin@veshelectrical.com.au",
  contactPhone: "0400 000 000",
  address: "123 Example St, Brisbane QLD 4000",
  abn: "00 000 000 000",
  accountingProvider: "myob",
  brandingHidden: true,
};
