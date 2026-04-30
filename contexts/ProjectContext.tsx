import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

// ─── Types ──────────────────────────────────────────────────
export type ProjectStatus = "Active" | "Won" | "Lost" | "On Hold";

export interface ProjectScan {
  id: string;
  fileName: string;
  scannedAt: string; // ISO
  versionNumber: number;
  componentCount: number;
  subtotal: number;
  detectionResult?: unknown; // DetectionResult; kept opaque to avoid circular deps
}

export interface EstimateLineItem {
  id: string;
  description: string;
  category: string;
  room?: string;
  qty: number;
  unitPrice: number;
  unit?: string;
}

export interface CableRun {
  id: string;
  cableType: string;
  lengthMeters: number;
  wasteFactorPct: number; // 10 default
  totalLength: number;
  approvedUnitPrice?: number; // $/m — set when TLE quote is applied
}

export type BomStatus = "draft" | "sent" | "quote_received" | "ordered";

export interface EstimateVersionSnapshot {
  lineItems: EstimateLineItem[];
  margin: number;
  categoryMargins: Record<string, number>;
  cableRuns: CableRun[];
  bomStatus?: BomStatus;
}

export interface EstimateVersion {
  id: string;
  savedAt: string; // ISO
  label: string;
  snapshot: EstimateVersionSnapshot;
}

export interface ProjectEstimate {
  id: string;
  number: string;
  reference?: string; // EST-YYMM-XXXX, monthly per-tenant sequence
  createdAt: string;
  updatedAt: string;
  margin: number; // global margin %
  categoryMargins: Record<string, number>;
  gstRate: number; // typically 10
  locked: boolean;
  lockedAt?: string;
  lineItems: EstimateLineItem[];
  cableRuns: CableRun[];
  versions: EstimateVersion[];
  wholesaleQuoteSentAt?: string;
  wholesaleQuoteSentTo?: string;
  wholesaleQuoteStatus?: "sent" | "received" | "ordered";
  wholesaleQuoteReceivedAt?: string;
  wholesaleQuoteOrderedAt?: string;
  bomStatus?: BomStatus;
}

export interface ProjectDocument {
  id: string;
  name: string;
  addedAt: string;
  url?: string;
  kind?: "drawing" | "quote" | "other";
}

export type ApprovalStatus = "pending" | "approved" | "rejected";

export interface Project {
  id: string;
  name: string;
  status: ProjectStatus;
  address: string;
  clientName: string;
  createdAt: string;
  updatedAt: string;
  scans: ProjectScan[];
  estimates: ProjectEstimate[];
  documents: ProjectDocument[];
  approvalStatus?: ApprovalStatus;
  approvalUpdatedAt?: string;
}

// ─── Persistence ────────────────────────────────────────────
const STORAGE_KEY = "electrascan_projects";

const VALID_STATUSES: ProjectStatus[] = ["Active", "Won", "Lost", "On Hold"];

function isValidProject(p: unknown): p is Project {
  if (!p || typeof p !== "object") return false;
  const o = p as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.name === "string" &&
    typeof o.clientName === "string" &&
    VALID_STATUSES.includes(o.status as ProjectStatus) &&
    Array.isArray(o.scans) &&
    Array.isArray(o.estimates)
  );
}

function safeLoad(): Project[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return (parsed as unknown[]).filter(isValidProject);
  } catch {
    return [];
  }
}

function safeSave(projects: Project[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  } catch {
    // storage disabled / quota
  }
}

const uid = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

// ─── Context ────────────────────────────────────────────────
interface CreateProjectInput {
  name: string;
  clientName?: string;
  address?: string;
  status?: ProjectStatus;
}

interface ProjectContextValue {
  projects: Project[];
  createProject: (input: CreateProjectInput) => Project;
  updateProject: (id: string, patch: Partial<Project>) => void;
  deleteProject: (id: string) => void;
  getProject: (id: string) => Project | undefined;
  addScanToProject: (
    id: string,
    scan: Omit<ProjectScan, "id" | "scannedAt" | "versionNumber">,
  ) => ProjectScan | undefined;
  saveEstimate: (projectId: string, estimate: ProjectEstimate) => void;
  newEstimateId: () => string;
}

const ProjectContext = createContext<ProjectContextValue | undefined>(undefined);

export const ProjectProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [projects, setProjects] = useState<Project[]>(() => safeLoad());

  useEffect(() => {
    safeSave(projects);
  }, [projects]);

  const createProject = useCallback((input: CreateProjectInput): Project => {
    const now = new Date().toISOString();
    const p: Project = {
      id: uid(),
      name: input.name.trim(),
      clientName: input.clientName?.trim() ?? "",
      address: input.address?.trim() ?? "",
      status: input.status ?? "Active",
      createdAt: now,
      updatedAt: now,
      scans: [],
      estimates: [],
      documents: [],
    };
    setProjects(prev => [p, ...prev]);
    return p;
  }, []);

  const updateProject = useCallback((id: string, patch: Partial<Project>) => {
    setProjects(prev =>
      prev.map(p =>
        p.id === id ? { ...p, ...patch, updatedAt: new Date().toISOString() } : p,
      ),
    );
  }, []);

  const deleteProject = useCallback((id: string) => {
    setProjects(prev => prev.filter(p => p.id !== id));
  }, []);

  const getProject = useCallback(
    (id: string) => projects.find(p => p.id === id),
    [projects],
  );

  const addScanToProject = useCallback<ProjectContextValue["addScanToProject"]>(
    (id, scanInput) => {
      let created: ProjectScan | undefined;
      setProjects(prev =>
        prev.map(p => {
          if (p.id !== id) return p;
          const versionNumber = p.scans.length + 1;
          const scan: ProjectScan = {
            ...scanInput,
            id: uid(),
            scannedAt: new Date().toISOString(),
            versionNumber,
          };
          created = scan;
          return {
            ...p,
            scans: [...p.scans, scan],
            updatedAt: new Date().toISOString(),
          };
        }),
      );
      return created;
    },
    [],
  );

  const saveEstimate = useCallback((projectId: string, estimate: ProjectEstimate) => {
    setProjects(prev =>
      prev.map(p => {
        if (p.id !== projectId) return p;
        const idx = p.estimates.findIndex(e => e.id === estimate.id);
        const next = [...p.estimates];
        if (idx >= 0) next[idx] = estimate;
        else next.push(estimate);
        return { ...p, estimates: next, updatedAt: new Date().toISOString() };
      }),
    );
  }, []);

  const value = useMemo<ProjectContextValue>(
    () => ({
      projects,
      createProject,
      updateProject,
      deleteProject,
      getProject,
      addScanToProject,
      saveEstimate,
      newEstimateId: uid,
    }),
    [projects, createProject, updateProject, deleteProject, getProject, addScanToProject, saveEstimate],
  );

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
};

export function useProjects(): ProjectContextValue {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error("useProjects must be used within a ProjectProvider");
  return ctx;
}

// ─── Helpers (exported for screens) ─────────────────────────
export function statusPalette(status: ProjectStatus): { bg: string; fg: string; label: string } {
  switch (status) {
    case "Active":   return { bg: "#10B981", fg: "#FFFFFF", label: "Active" };
    case "Won":      return { bg: "#059669", fg: "#FFFFFF", label: "Won" };
    case "Lost":     return { bg: "#EF4444", fg: "#FFFFFF", label: "Lost" };
    case "On Hold":  return { bg: "#F59E0B", fg: "#FFFFFF", label: "On Hold" };
  }
}

export function estimateTotals(est: ProjectEstimate): {
  subtotal: number;
  marginAmount: number;
  materialsCost: number;
  subtotalWithMargin: number;
  gst: number;
  total: number;
} {
  const subtotal = est.lineItems.reduce((s, li) => {
    const catMargin = est.categoryMargins[li.category];
    const effectiveMargin = typeof catMargin === "number" ? catMargin : est.margin;
    const lineBase = li.qty * li.unitPrice;
    const lineWithMargin = lineBase * (1 + effectiveMargin / 100);
    return s + lineWithMargin;
  }, 0);
  const baseSubtotal = est.lineItems.reduce((s, li) => s + li.qty * li.unitPrice, 0);
  const marginAmount = subtotal - baseSubtotal;
  const materialsCost = est.cableRuns.reduce((s, r) => {
    const price = r.approvedUnitPrice;
    if (typeof price !== "number" || price <= 0) return s;
    return s + r.totalLength * price * (1 + est.margin / 100);
  }, 0);
  const subtotalWithMargin = subtotal + materialsCost;
  const gst = subtotalWithMargin * (est.gstRate / 100);
  const total = subtotalWithMargin + gst;
  return {
    subtotal: baseSubtotal,
    marginAmount,
    materialsCost,
    subtotalWithMargin,
    gst,
    total,
  };
}

export { uid as makeId };
