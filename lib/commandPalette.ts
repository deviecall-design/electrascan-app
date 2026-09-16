/**
 * Lightweight command-palette model for the navy AppShell.
 *
 * Search is honest: it only lists real navigation, live scans, and live
 * estimates. No sample jobs, no unread counts, no invented metrics.
 */

export type PaletteGroup = "Actions" | "Navigate" | "Scans" | "Estimates";

export interface PaletteItem {
  id: string;
  group: PaletteGroup;
  label: string;
  hint?: string;
  to: string;
  keywords?: string[];
}

export const STATIC_PALETTE_ITEMS: PaletteItem[] = [
  {
    id: "action-upload-plan",
    group: "Actions",
    label: "Upload plan",
    hint: "Start a new scan",
    to: "/detection/new",
    keywords: ["new scan", "upload", "plan", "drawing", "pdf"],
  },
  {
    id: "nav-dashboard",
    group: "Navigate",
    label: "Dashboard",
    to: "/dashboard",
    keywords: ["home", "pipeline"],
  },
  {
    id: "nav-scans",
    group: "Navigate",
    label: "Scans",
    to: "/detection",
    keywords: ["detection", "plans", "drawings"],
  },
  {
    id: "nav-estimates",
    group: "Navigate",
    label: "Estimates",
    to: "/estimate",
    keywords: ["quotes", "pipeline"],
  },
  {
    id: "nav-rates",
    group: "Navigate",
    label: "Rates",
    to: "/pricing-schedule",
    keywords: ["pricing", "rate library", "catalogue"],
  },
  {
    id: "nav-approvals",
    group: "Navigate",
    label: "Approvals",
    to: "/approvals",
    keywords: ["docusign", "sign"],
  },
  {
    id: "nav-settings",
    group: "Navigate",
    label: "Settings",
    to: "/settings",
    keywords: ["company", "profile", "abn"],
  },
  {
    id: "nav-variation",
    group: "Navigate",
    label: "Variation Report",
    to: "/variation-report",
    keywords: ["diff", "variation"],
  },
  {
    id: "nav-projects",
    group: "Navigate",
    label: "Project Reports",
    to: "/projects",
    keywords: ["reports", "budget"],
  },
];

export interface PaletteScan {
  id?: string;
  file_name?: string;
  client?: string | null;
}

export interface PaletteEstimate {
  id?: string;
  reference?: string | null;
  ref?: string;
  client?: string | null;
}

export function scanToPaletteItem(scan: PaletteScan, index: number): PaletteItem {
  const file = (scan.file_name ?? "Untitled plan").trim() || "Untitled plan";
  const id = scan.id ?? `scan-${index}`;
  return {
    id: `scan-${id}`,
    group: "Scans",
    label: file,
    hint: scan.client?.trim() || "Scan",
    to: `/detection/${id}`,
    keywords: [file, scan.client ?? "", "scan", "plan"],
  };
}

export function estimateToPaletteItem(estimate: PaletteEstimate, index: number): PaletteItem {
  const ref = (estimate.reference || estimate.ref || `Estimate ${index + 1}`).trim();
  const id = estimate.id ?? `estimate-${index}`;
  return {
    id: `estimate-${id}`,
    group: "Estimates",
    label: ref,
    hint: estimate.client?.trim() || "Estimate",
    to: "/estimate",
    keywords: [ref, estimate.client ?? "", "quote", "estimate"],
  };
}

export function buildPaletteItems(
  scans: PaletteScan[] = [],
  estimates: PaletteEstimate[] = [],
): PaletteItem[] {
  return [
    ...STATIC_PALETTE_ITEMS,
    ...scans.map(scanToPaletteItem),
    ...estimates.map(estimateToPaletteItem),
  ];
}

function haystack(item: PaletteItem): string {
  return [item.label, item.hint ?? "", item.group, ...(item.keywords ?? [])]
    .join(" ")
    .toLowerCase();
}

export function filterPaletteItems(items: PaletteItem[], query: string): PaletteItem[] {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    const scans = items.filter(i => i.group === "Scans").slice(0, 6);
    const estimates = items.filter(i => i.group === "Estimates").slice(0, 6);
    return [
      ...items.filter(i => i.group === "Actions" || i.group === "Navigate"),
      ...scans,
      ...estimates,
    ];
  }
  return items.filter(item => {
    const hay = haystack(item);
    return tokens.every(token => hay.includes(token));
  });
}

export const PALETTE_GROUP_ORDER: PaletteGroup[] = [
  "Actions",
  "Navigate",
  "Scans",
  "Estimates",
];
