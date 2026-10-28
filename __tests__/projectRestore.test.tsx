import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

const { scan } = vi.hoisted(() => ({
  scan: {
    id: "scan-1",
    file_name: "Mark Arnesen plan.pdf",
    client: "Mark Arnesen",
    stage: "review",
    estimate_ref: null,
    detected_items: [
      { id: 1, symbol: "LT", qty: 3, desc: "Recessed downlight", rateCode: "", conf: 0.9, x: 10, y: 10, unitPrice: 200 },
    ],
  },
}));

vi.mock("../services/supabaseData", () => ({
  fetchEstimates: vi.fn().mockResolvedValue({ data: [], error: null }),
  fetchScans: vi.fn().mockResolvedValue({ data: [scan], error: null }),
  fetchMilestoneClaimsForProject: vi.fn().mockResolvedValue({ data: [], error: null }),
  submitMilestoneClaim: vi.fn(),
  insertScan: vi.fn().mockResolvedValue({ data: { id: "scan-2" }, error: null }),
}));

vi.mock("../analyze_pdf", () => ({
  detectElectricalComponents: vi.fn().mockResolvedValue({
    components: [
      { type: "GPO_DOUBLE", quantity: 2, catalogue_item_name: "Double GPO", unit_price: 120, confidence: 90 },
    ],
  }),
}));

import VariationReportScreen from "../screens/VariationReportScreen";
import ProjectReportsScreen from "../screens/ProjectReportsScreen";

describe("restored project surfaces", () => {
  it("shows the saved takeoff on the project report with progress payments", async () => {
    render(
      <MemoryRouter>
        <ProjectReportsScreen />
      </MemoryRouter>,
    );
    expect(await screen.findByRole("heading", { name: "Mark Arnesen plan.pdf" })).toBeInTheDocument();
    expect(screen.getByText("Progress payments")).toBeInTheDocument();
    expect(screen.getByText("Deposit on signing")).toBeInTheDocument();
    expect(screen.getByText("Retention holdback")).toBeInTheDocument();
    expect(screen.getByText("Resources")).toBeInTheDocument();
    expect(screen.getByText("Project breakdown")).toBeInTheDocument();
    expect(screen.getByText("Recessed downlight")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Connect" }).length).toBe(2);
  });

  it("diffs a revised plan into added and removed materials", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <VariationReportScreen />
      </MemoryRouter>,
    );
    expect(await screen.findByText(/Mark Arnesen plan.pdf/)).toBeInTheDocument();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, new File(["%PDF"], "revised.pdf", { type: "application/pdf" }));
    expect(await screen.findByText("Added")).toBeInTheDocument();
    expect(screen.getByText("Removed")).toBeInTheDocument();
    expect(screen.getByText(/Double gpo/i)).toBeInTheDocument();
    expect(screen.getByText("Recessed downlight")).toBeInTheDocument();
    expect(screen.getAllByText(/materials/).length).toBeGreaterThan(0);
  });
});
