import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
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
  updateScan: vi.fn(),
}));

import ScanDetailScreen from "../screens/ScanDetailScreen";

describe("saved scan review", () => {
  beforeEach(() => {
    fetchScanById.mockReset();
  });

  it("renders detected items stored on the scan, not a sample takeoff", async () => {
    fetchScanById.mockResolvedValue({
      data: {
        id: "scan-1",
        file_name: "kitchen-plan.pdf",
        stage: "review",
        detected_items: [
          {
            id: 1,
            symbol: "GPO",
            qty: 4,
            desc: "Kitchen double GPO",
            rateCode: "GPO-D",
            conf: 0.72,
            x: 10,
            y: 20,
            unitPrice: 120,
          },
        ],
      },
      error: null,
    });

    render(
      <MemoryRouter initialEntries={["/detection/scan-1"]}>
        <Routes>
          <Route path="/detection/:id" element={<ScanDetailScreen />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Kitchen double GPO")).toBeInTheDocument();
    expect(screen.getByText(/GPO-D/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Reject/ })).toBeInTheDocument();
    expect(screen.getByText("Takeoff subtotal (ex GST)")).toBeInTheDocument();
    expect(screen.getAllByText(/Takeoff 0% verified/).length).toBeGreaterThan(0);
    expect(screen.getAllByText("$480").length).toBeGreaterThan(0);
    expect(screen.queryByText(/Mark Arnesen|Toorak|Bondi/i)).not.toBeInTheDocument();
    await waitFor(() => expect(fetchScanById).toHaveBeenCalledWith("scan-1"));
  });
});
