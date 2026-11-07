import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const { fetchScanById } = vi.hoisted(() => ({
  fetchScanById: vi.fn(),
}));

vi.mock("../analyze_pdf", () => ({
  detectElectricalComponents: vi.fn(),
}));

vi.mock("../services/supabaseData", () => ({
  fetchScanById: (...args: unknown[]) => fetchScanById(...args),
  insertScan: vi.fn(),
  updateScan: vi.fn().mockResolvedValue({ data: null, error: null }),
  fetchRateLibrary: vi.fn().mockResolvedValue({ data: [], error: null }),
}));

vi.mock("../services/workspaceSettings", () => ({
  fetchWorkspaceSettings: vi.fn().mockResolvedValue({
    minVerifiedPct: 80,
    supplierName: "TLE",
    supplierEmail: "",
  }),
}));

vi.mock("../services/estimateReferenceService", () => ({
  peekNextReference: vi.fn().mockResolvedValue("EST-2611-0004"),
}));

import ScanDetailScreen from "../screens/ScanDetailScreen";

function renderScan(id: string) {
  return render(
    <MemoryRouter initialEntries={[`/detection/${id}`]}>
      <Routes>
        <Route path="/detection/:id" element={<ScanDetailScreen />} />
      </Routes>
    </MemoryRouter>,
  );
}

const gpo = {
  id: 1,
  symbol: "GPO",
  qty: 2,
  desc: "Kitchen double GPO",
  rateCode: "GPO-D",
  conf: 0.7,
  x: 20,
  y: 30,
  unitPrice: 85,
  status: "ai" as const,
};

describe("takeoff, verification, and quote accessibility", () => {
  beforeEach(() => {
    fetchScanById.mockReset();
  });

  it("shows a loading state instead of an empty takeoff while the scan is in flight", async () => {
    let resolveScan: (value: unknown) => void = () => undefined;
    fetchScanById.mockReturnValue(new Promise(resolve => { resolveScan = resolve; }));
    renderScan("scan-slow");

    expect(screen.getByRole("status").textContent).toMatch(/Loading this takeoff/);
    expect(screen.queryByText(/No detected items/)).not.toBeInTheDocument();

    resolveScan({
      data: {
        id: "scan-slow",
        file_name: "Level-2-power.pdf",
        stage: "review",
        detected_items: [gpo],
      },
      error: null,
    });
    expect(await screen.findByRole("region", { name: "Takeoff" })).toBeInTheDocument();
    expect(screen.queryByText(/No detected items/)).not.toBeInTheDocument();
  });

  it("names an empty takeoff and lets Escape cancel add-symbol mode", async () => {
    const user = userEvent.setup();
    fetchScanById.mockResolvedValue({
      data: {
        id: "scan-empty",
        file_name: "Level-2-power.pdf",
        client: "Harbour St fit-out",
        stage: "review",
        detected_items: [],
      },
      error: null,
    });
    renderScan("scan-empty");

    expect(await screen.findByRole("status", { name: /No detected items on this scan yet/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Review takeoff, current step" })).toHaveAttribute("aria-current", "step");

    await user.click(screen.getByRole("button", { name: "Add GPOs" }));
    expect(screen.getByRole("button", { name: "Add GPOs" })).toHaveAttribute("aria-pressed", "true");
    const plan = screen.getByRole("group", { name: /placing GPOs/i });
    fireEvent.keyDown(plan, { key: "Enter" });
    expect(await screen.findByRole("button", { name: "Confirm GPO" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "View on plan" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add Downlights" }));
    expect(screen.getByRole("button", { name: "Add Downlights" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.keyDown(screen.getByRole("region", { name: "Takeoff" }), { key: "Escape" });
    expect(screen.getByRole("button", { name: "Add Downlights" })).toHaveAttribute("aria-pressed", "false");
  });

  it("explains why a quote cannot be saved and exposes the estimate number", async () => {
    fetchScanById.mockResolvedValue({
      data: {
        id: "scan-quote",
        file_name: "Level-2-power.pdf",
        client: "Harbour St fit-out",
        stage: "quote",
        detected_items: [gpo],
      },
      error: null,
    });
    renderScan("scan-quote");

    const reason = await screen.findByRole("status", { name: /requires 80% of the takeoff to be verified/ });
    const save = screen.getByRole("button", { name: "Save for approval" });
    expect(save).toBeDisabled();
    expect(save).toHaveAttribute("aria-describedby", reason.id);
    expect(await screen.findByText("EST-2611-0004.pdf")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Quote" })).toBeInTheDocument();
  });

  it("shows an empty quote when nothing is billable", async () => {
    fetchScanById.mockResolvedValue({
      data: {
        id: "scan-empty-quote",
        file_name: "Level-2-power.pdf",
        stage: "quote",
        detected_items: [],
      },
      error: null,
    });
    renderScan("scan-empty-quote");

    expect(await screen.findByRole("status", { name: /No priced lines yet/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save for approval" })).toBeDisabled();
    expect(screen.getByRole("status", { name: /No billable lines on this quote yet/ })).toBeInTheDocument();
  });
});
