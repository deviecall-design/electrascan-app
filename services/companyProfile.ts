/**
 * Company Profile — the sender identity on every estimate/variation PDF.
 *
 * Multi-tenant design: each electrical trade gets its own CompanyProfile row.
 * This is the white-label layer — every PDF is branded with the tenant's
 * logo, ABN, address, and contact details rather than ElectraScan's.
 *
 * Current: Vesh is hardcoded as tenant #0 (seed data).
 * Next: move to Supabase `companies` table (see TODO below).
 */

export interface CompanyProfile {
  id: string;              // tenant id (uuid in prod)
  name: string;            // e.g. "Vesh Electrical Services Pty Ltd"
  abn: string;             // Australian Business Number
  licence: string;         // Electrical licence number (e.g. "EC-204857")
  address: string;         // Full street address
  phone: string;           // Primary contact phone
  email: string;           // Primary email for outbound quotes
  website?: string;        // Optional marketing website
  logoUrl?: string;        // URL to company logo (PNG/JPG/SVG). Falls back to placeholder if empty.
  accentColor?: string;    // Optional brand accent (defaults to ElectraScan blue)
  defaultMargin?: number;  // Default markup % for new estimates
  validityDays?: number;   // Quote validity period (days)
  termsText?: string;      // Custom terms & conditions block for PDF footer
}

// TODO: Supabase schema for `companies` table:
//   id: uuid (PK)
//   name, abn, licence, address, phone, email, website: text
//   logo_url: text (reference to public URL in `company-logos` Storage bucket)
//   accent_color: text (hex)
//   default_margin: numeric (default 15)
//   validity_days: integer (default 30)
//   terms_text: text
//   created_at, updated_at: timestamptz
//   owner_user_id: uuid (FK to auth.users)
// RLS: users can read/write only their own company row.
// Storage bucket `company-logos`: public read, authenticated write, path {owner_user_id}/logo.{ext}.

/**
 * Vesh Electrical — tenant #0 seed data.
 * Sourced from the prototype's SettingsScreen defaults.
 */
export const VESH_PROFILE: CompanyProfile = {
  id: "vesh-electrical-0",
  name: "Vesh Electrical Services Pty Ltd",
  abn: "51 234 567 891",
  licence: "EC-204857",
  address: "7/108 Old Pittwater Road, Brookvale NSW 2100",
  phone: "02 9938 4200",
  email: "quotes@veshelectrical.com.au",
  website: "veshelectrical.com.au",
  logoUrl: undefined, // Will fall back to /logo-placeholder.svg until a real logo is uploaded
  accentColor: "#1D6EFD",
  defaultMargin: 15,
  validityDays: 30,
  termsText:
    "This estimate is valid for 30 days from the date of issue. Prices are in Australian Dollars (AUD) and include GST where stated. Scope is limited to the items listed above. Any variations to scope will be quoted separately. Payment terms: 14 days from invoice.",
};

/**
 * Returns the active company profile for the signed-in user.
 * TODO: replace with Supabase fetch of the user's company row.
 */
export function getActiveCompanyProfile(): CompanyProfile {
  return VESH_PROFILE;
}

/**
 * Increments the trailing revision number on an estimate ID.
 * Examples:
 *   "EST-2026-497-001" → "EST-2026-497-002"
 *   "EST-2026-497-009" → "EST-2026-497-010"
 *   "EST-2026-497"     → "EST-2026-497-002" (assumes -001 if no suffix)
 */
export function incrementEstimateNumber(estimateNumber: string): string {
  const match = estimateNumber.match(/^(.+)-(\d+)$/);
  if (!match) return `${estimateNumber}-002`;
  const [, prefix, rev] = match;
  const nextRev = String(parseInt(rev, 10) + 1).padStart(rev.length, "0");
  return `${prefix}-${nextRev}`;
}
