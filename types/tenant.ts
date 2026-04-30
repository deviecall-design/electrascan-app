export type AccountingProvider = "myob" | "xero" | "quickbooks" | null;

export interface Wholesaler {
  id: string;
  name: string;
  address: string;
  email: string;
  isDefault?: boolean;
}

export interface TenantConfig {
  id: string;
  name: string;
  logoUrl: string | null;
  primaryColour: string;
  accentColour: string;
  contactEmail: string;
  contactPhone: string;
  emailReplyTo: string;
  address: string;
  abn: string;
  accountingProvider: AccountingProvider;
  brandingHidden: boolean;
  wholesalers: Wholesaler[];
}

export const DEFAULT_WHOLESALERS: Wholesaler[] = [
  {
    id: "tle-brookvale",
    name: "TLE Brookvale",
    address: "3/192 Harbord Rd, Brookvale NSW 2100",
    email: "",
    isDefault: true,
  },
];

export const VESH_ELECTRICAL_CONFIG: TenantConfig = {
  id: "vesh",
  name: "Vesh Electrical",
  logoUrl: null,
  primaryColour: "#F59E0B",
  accentColour: "#1F2937",
  contactEmail: "admin@veshelectrical.com.au",
  contactPhone: "0400 000 000",
  emailReplyTo: "admin@veshelectrical.com.au",
  address: "123 Example St, Brisbane QLD 4000",
  abn: "00 000 000 000",
  accountingProvider: "myob",
  brandingHidden: true,
  wholesalers: DEFAULT_WHOLESALERS,
};
