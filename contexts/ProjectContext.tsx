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
  unitRate: number; // $/m — stored per run so it can be amended as copper/freight prices move
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
  // Labour estimation (added for Vesh POC)
  estimatedLabourHours?: number; // e.g., 40 hours
  labourRatePerHour?: number; // e.g., $85/hr
  estimatedLabourCost?: number; // calculated: hours × rate
}

export interface ProjectDocument {
  id: string;
  name: string;
  addedAt: string;
  url?: string;
  kind?: "drawing" | "quote" | "other";
}

export type ApprovalStatus = "pending" | "approved" | "rejected";

// ─── Labour & Financial Types (Vesh POC) ─────────────────────
export interface Timesheet {
  id: string;
  week: string; // "W1", "W2", etc.
  electrician: string;
  plannedHours: number;
  actualHours: number;
  labourCost: number; // calculated: actualHours × labourRatePerHour
  materialsUsed: number; // $ materials used this week
  submitted: boolean;
  submittedAt?: string;
  approvedAt?: string;
  note?: string;
}

export interface Milestone {
  id: string;
  label: string; // "Rough-in Complete", "First Fix Complete", etc.
  percentage: number; // 25, 50, 75, 100
  amount: number; // $ amount for this milestone
  status: "pending" | "ready" | "invoiced-draft" | "invoiced" | "received";
  claimedAt?: string;
  invoiceRef?: string;
  receivedAt?: string;
  retention?: boolean; // true for retention holdback line
}

export interface CostOverrun {
  id: string;
  item: string; // "Copper cable surcharge"
  category: string; // "Materials", "Labour", "Admin"
  amount: number; // $
  severity: "high" | "medium" | "low";
  reason: string;
  detectedAt: string;
  acknowledged: boolean;
}

export interface DepositSchedule {
  id: string;
  label: string; // "Deposit on Signing", "Rough-in Milestone (25%)", etc.
  percentage: number;
  amount: number; // $
  status: "pending" | "invoiced" | "received";
  dueDate?: string;
  receivedDate?: string;
}

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

  // Vesh POC labour & financial fields
  budgetTotal?: number; // locked estimate: BOM + labour combined
  labourRatePerHour?: number; // e.g., $85/hr
  estimatedLabourHours?: number; // from estimate
  varianceThreshold?: number; // default 0.05 = 5%
  timesheets?: Timesheet[];
  milestones?: Milestone[];
  overruns?: CostOverrun[];
  deposits?: DepositSchedule[];
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
  // Labour & financial CRUD (Vesh POC)
  addTimesheet: (projectId: string, timesheet: Omit<Timesheet, "id">) => void;
  updateTimesheet: (projectId: string, timesheetId: string, patch: Partial<Timesheet>) => void;
  deleteTimesheet: (projectId: string, timesheetId: string) => void;
  addMilestone: (projectId: string, milestone: Omit<Milestone, "id">) => void;
  updateMilestone: (projectId: string, milestoneId: string, patch: Partial<Milestone>) => void;
  deleteMilestone: (projectId: string, milestoneId: string) => void;
  addOverrun: (projectId: string, overrun: Omit<CostOverrun, "id">) => void;
  updateOverrun: (projectId: string, overrunId: string, patch: Partial<CostOverrun>) => void;
  deleteOverrun: (projectId: string, overrunId: string) => void;
  addDeposit: (projectId: string, deposit: Omit<DepositSchedule, "id">) => void;
  updateDeposit: (projectId: string, depositId: string, patch: Partial<DepositSchedule>) => void;
  deleteDeposit: (projectId: string, depositId: string) => void;
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

  // Timesheet CRUD
  const addTimesheet = useCallback((projectId: string, timesheet: Omit<Timesheet, "id">) => {
    setProjects(prev =>
      prev.map(p =>
        p.id === projectId
          ? {
              ...p,
              timesheets: [...(p.timesheets ?? []), { ...timesheet, id: uid() }],
              updatedAt: new Date().toISOString(),
            }
          : p,
      ),
    );
  }, []);

  const updateTimesheet = useCallback((projectId: string, timesheetId: string, patch: Partial<Timesheet>) => {
    setProjects(prev =>
      prev.map(p =>
        p.id === projectId
          ? {
              ...p,
              timesheets: (p.timesheets ?? []).map(t => (t.id === timesheetId ? { ...t, ...patch } : t)),
              updatedAt: new Date().toISOString(),
            }
          : p,
      ),
    );
  }, []);

  const deleteTimesheet = useCallback((projectId: string, timesheetId: string) => {
    setProjects(prev =>
      prev.map(p =>
        p.id === projectId
          ? {
              ...p,
              timesheets: (p.timesheets ?? []).filter(t => t.id !== timesheetId),
              updatedAt: new Date().toISOString(),
            }
          : p,
      ),
    );
  }, []);

  // Milestone CRUD
  const addMilestone = useCallback((projectId: string, milestone: Omit<Milestone, "id">) => {
    setProjects(prev =>
      prev.map(p =>
        p.id === projectId
          ? {
              ...p,
              milestones: [...(p.milestones ?? []), { ...milestone, id: uid() }],
              updatedAt: new Date().toISOString(),
            }
          : p,
      ),
    );
  }, []);

  const updateMilestone = useCallback((projectId: string, milestoneId: string, patch: Partial<Milestone>) => {
    setProjects(prev =>
      prev.map(p =>
        p.id === projectId
          ? {
              ...p,
              milestones: (p.milestones ?? []).map(m => (m.id === milestoneId ? { ...m, ...patch } : m)),
              updatedAt: new Date().toISOString(),
            }
          : p,
      ),
    );
  }, []);

  const deleteMilestone = useCallback((projectId: string, milestoneId: string) => {
    setProjects(prev =>
      prev.map(p =>
        p.id === projectId
          ? {
              ...p,
              milestones: (p.milestones ?? []).filter(m => m.id !== milestoneId),
              updatedAt: new Date().toISOString(),
            }
          : p,
      ),
    );
  }, []);

  // Overrun CRUD
  const addOverrun = useCallback((projectId: string, overrun: Omit<CostOverrun, "id">) => {
    setProjects(prev =>
      prev.map(p =>
        p.id === projectId
          ? {
              ...p,
              overruns: [...(p.overruns ?? []), { ...overrun, id: uid() }],
              updatedAt: new Date().toISOString(),
            }
          : p,
      ),
    );
  }, []);

  const updateOverrun = useCallback((projectId: string, overrunId: string, patch: Partial<CostOverrun>) => {
    setProjects(prev =>
      prev.map(p =>
        p.id === projectId
          ? {
              ...p,
              overruns: (p.overruns ?? []).map(o => (o.id === overrunId ? { ...o, ...patch } : o)),
              updatedAt: new Date().toISOString(),
            }
          : p,
      ),
    );
  }, []);

  const deleteOverrun = useCallback((projectId: string, overrunId: string) => {
    setProjects(prev =>
      prev.map(p =>
        p.id === projectId
          ? {
              ...p,
              overruns: (p.overruns ?? []).filter(o => o.id !== overrunId),
              updatedAt: new Date().toISOString(),
            }
          : p,
      ),
    );
  }, []);

  // Deposit CRUD
  const addDeposit = useCallback((projectId: string, deposit: Omit<DepositSchedule, "id">) => {
    setProjects(prev =>
      prev.map(p =>
        p.id === projectId
          ? {
              ...p,
              deposits: [...(p.deposits ?? []), { ...deposit, id: uid() }],
              updatedAt: new Date().toISOString(),
            }
          : p,
      ),
    );
  }, []);

  const updateDeposit = useCallback((projectId: string, depositId: string, patch: Partial<DepositSchedule>) => {
    setProjects(prev =>
      prev.map(p =>
        p.id === projectId
          ? {
              ...p,
              deposits: (p.deposits ?? []).map(d => (d.id === depositId ? { ...d, ...patch } : d)),
              updatedAt: new Date().toISOString(),
            }
          : p,
      ),
    );
  }, []);

  const deleteDeposit = useCallback((projectId: string, depositId: string) => {
    setProjects(prev =>
      prev.map(p =>
        p.id === projectId
          ? {
              ...p,
              deposits: (p.deposits ?? []).filter(d => d.id !== depositId),
              updatedAt: new Date().toISOString(),
            }
          : p,
      ),
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
      addTimesheet,
      updateTimesheet,
      deleteTimesheet,
      addMilestone,
      updateMilestone,
      deleteMilestone,
      addOverrun,
      updateOverrun,
      deleteOverrun,
      addDeposit,
      updateDeposit,
      deleteDeposit,
    }),
    [
      projects,
      createProject,
      updateProject,
      deleteProject,
      getProject,
      addScanToProject,
      saveEstimate,
      addTimesheet,
      updateTimesheet,
      deleteTimesheet,
      addMilestone,
      updateMilestone,
      deleteMilestone,
      addOverrun,
      updateOverrun,
      deleteOverrun,
      addDeposit,
      updateDeposit,
      deleteDeposit,
    ],
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
