import { type Milestone } from "../contexts/ProjectContext";

/**
 * Milestones and payment schedule service for Vesh POC
 */

/**
 * Create default milestone schedule for Vesh projects
 * Standard: 20% deposit + Rough-in 25% + First Fix 50% + Second Fix 75% + PC 100% + 10% retention
 */
export function createDefaultMilestones(budgetTotal: number): Milestone[] {
  const percentages = [20, 25, 50, 75, 100, 100]; // Last 100 is for retention
  const labels = [
    "Deposit on Signing",
    "Rough-in Complete",
    "First Fix Complete",
    "Second Fix Complete",
    "Practical Completion",
    "Retention Holdback",
  ];
  const retentionPct = 10;

  const milestones: Milestone[] = [];

  // Deposit + progress milestones
  for (let i = 0; i < 5; i++) {
    const pct = percentages[i];
    const amount = (pct / 100) * budgetTotal;
    milestones.push({
      id: `milestone-${i}`,
      label: labels[i],
      percentage: pct,
      amount,
      status: i === 0 ? "pending" : "pending",
      retention: false,
    });
  }

  // Retention holdback (10% of total)
  const retentionAmount = (retentionPct / 100) * budgetTotal;
  milestones.push({
    id: `milestone-retention`,
    label: labels[5],
    percentage: 100,
    amount: retentionAmount,
    status: "pending",
    retention: true,
  });

  return milestones;
}

export function claimMilestone(milestone: Milestone): Milestone {
  if (milestone.status !== "pending") {
    return milestone;
  }
  return {
    ...milestone,
    status: "ready",
    claimedAt: new Date().toISOString(),
  };
}

export function invoiceMilestone(milestone: Milestone, invoiceRef: string): Milestone {
  if (milestone.status !== "ready") {
    return milestone;
  }
  return {
    ...milestone,
    status: "invoiced-draft",
    invoiceRef,
  };
}

export function confirmInvoice(milestone: Milestone): Milestone {
  if (milestone.status !== "invoiced-draft") {
    return milestone;
  }
  return {
    ...milestone,
    status: "invoiced",
  };
}

export function receivePayment(milestone: Milestone): Milestone {
  if (milestone.status !== "invoiced") {
    return milestone;
  }
  return {
    ...milestone,
    status: "received",
    receivedAt: new Date().toISOString(),
  };
}

export interface PaymentSummary {
  claimed: number;
  invoiced: number;
  received: number;
  outstanding: number;
  retained: number;
}

export function paymentSummary(milestones: Milestone[]): PaymentSummary {
  const claimed = milestones
    .filter(m => (m.status === "ready" || m.status === "invoiced-draft" || m.status === "invoiced" || m.status === "received") && !m.retention)
    .reduce((s, m) => s + m.amount, 0);

  const invoiced = milestones
    .filter(m => (m.status === "invoiced-draft" || m.status === "invoiced" || m.status === "received") && !m.retention)
    .reduce((s, m) => s + m.amount, 0);

  const received = milestones
    .filter(m => m.status === "received" && !m.retention)
    .reduce((s, m) => s + m.amount, 0);

  const retained = milestones
    .filter(m => m.retention)
    .reduce((s, m) => s + m.amount, 0);

  const outstanding = milestones
    .filter(m => m.status === "pending" && !m.retention)
    .reduce((s, m) => s + m.amount, 0);

  return {
    claimed,
    invoiced,
    received,
    outstanding,
    retained,
  };
}
