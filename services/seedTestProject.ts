import { type Project, type ProjectEstimate, type Timesheet, type Milestone, type CostOverrun } from "../contexts/ProjectContext";

/**
 * Seed function to create a test Vesh project with labour, timesheets, milestones, and overruns
 * Used for demo and validation
 */

const uid = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

export function createVeshTestProject(): Project {
  const now = new Date().toISOString();
  const projectId = uid();

  // Create estimate with BOM + labour
  const estimate: ProjectEstimate = {
    id: uid(),
    number: "EST-2026-001",
    reference: "EST-2026-001",
    createdAt: now,
    updatedAt: now,
    margin: 12,
    categoryMargins: {},
    gstRate: 10,
    locked: true,
    lockedAt: now,
    lineItems: [
      {
        id: uid(),
        description: "Electrical conduit & fittings",
        category: "Conduit",
        qty: 250,
        unitPrice: 4.50,
      },
      {
        id: uid(),
        description: "Copper cable (4mm twin)",
        category: "Cable",
        qty: 500,
        unitPrice: 1.20,
      },
      {
        id: uid(),
        description: "Outlets & switches",
        category: "Fittings",
        qty: 24,
        unitPrice: 15.00,
      },
    ],
    cableRuns: [],
    versions: [],
    bomStatus: "ordered",
    // Labour estimation
    estimatedLabourHours: 40,
    labourRatePerHour: 85,
    estimatedLabourCost: 40 * 85,
  };

  // BOM + Labour = $5,900 total estimate
  // Materials: ~$2,500 | Labour: $3,400

  // Timesheets for 4 weeks
  const timesheets: Timesheet[] = [
    {
      id: uid(),
      week: "W1 · 10 Mar",
      electrician: "John Smith",
      plannedHours: 10,
      actualHours: 9,
      labourCost: 9 * 85,
      materialsUsed: 500,
      submitted: true,
      submittedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
      approvedAt: new Date(Date.now() - 13 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: uid(),
      week: "W2 · 17 Mar",
      electrician: "John Smith",
      plannedHours: 10,
      actualHours: 12,
      labourCost: 12 * 85,
      materialsUsed: 600,
      submitted: true,
      submittedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      approvedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
      note: "Additional work on rough-in conduit runs",
    },
    {
      id: uid(),
      week: "W3 · 24 Mar",
      electrician: "John Smith",
      plannedHours: 10,
      actualHours: 10,
      labourCost: 10 * 85,
      materialsUsed: 400,
      submitted: true,
      submittedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      approvedAt: new Date().toISOString(),
    },
    {
      id: uid(),
      week: "W4 · 31 Mar",
      electrician: "John Smith",
      plannedHours: 10,
      actualHours: 7,
      labourCost: 7 * 85,
      materialsUsed: 300,
      submitted: false,
    },
  ];

  // Milestones: 20% deposit + standard schedule
  const budgetTotal = 5900;
  const milestones: Milestone[] = [
    {
      id: uid(),
      label: "Deposit on Signing",
      percentage: 20,
      amount: 1180,
      status: "received",
      claimedAt: "10 Mar 2026",
      receivedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
      retention: false,
    },
    {
      id: uid(),
      label: "Rough-in Complete",
      percentage: 25,
      amount: 1475,
      status: "invoiced",
      claimedAt: "17 Mar 2026",
      invoiceRef: "INV-2026-012",
      retention: false,
    },
    {
      id: uid(),
      label: "First Fix Complete",
      percentage: 25,
      amount: 1475,
      status: "ready",
      retention: false,
    },
    {
      id: uid(),
      label: "Second Fix Complete",
      percentage: 25,
      amount: 1475,
      status: "pending",
      retention: false,
    },
    {
      id: uid(),
      label: "Retention Holdback",
      percentage: 100,
      amount: 590,
      status: "pending",
      retention: true,
    },
  ];

  // Overruns: copper cable surcharge
  const overruns: CostOverrun[] = [
    {
      id: uid(),
      item: "Copper cable surcharge",
      category: "Materials",
      amount: 420,
      severity: "high",
      reason: "Spot market +8.2% since estimate locked",
      detectedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      acknowledged: false,
    },
  ];

  const project: Project = {
    id: projectId,
    name: "Vesh Commercial Fitout — Test",
    status: "Active",
    address: "123 Commercial Ave, Sydney NSW 2000",
    clientName: "Vesh Electrical",
    createdAt: now,
    updatedAt: now,
    scans: [],
    estimates: [estimate],
    documents: [],
    // Vesh POC fields
    budgetTotal,
    labourRatePerHour: 85,
    estimatedLabourHours: 40,
    varianceThreshold: 0.05, // 5%
    timesheets,
    milestones,
    overruns,
  };

  return project;
}
