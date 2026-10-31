import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
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
          {
            id: 2,
            symbol: "FN",
            qty: 1,
            desc: "Exhaust fan",
            rateCode: "",
            conf: 0.8,
            x: 30,
            y: 40,
            unitPrice: 215,
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
    expect(screen.getAllByRole("button", { name: "Confirm" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /Reject/ }).length).toBeGreaterThan(0);
    expect(screen.getByText("Takeoff subtotal (ex GST)")).toBeInTheDocument();
    expect(screen.getAllByText(/Takeoff 0% verified/).length).toBeGreaterThan(0);
    expect(screen.getAllByText("$480").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Unpriced").length).toBeGreaterThan(0);
    expect(screen.getAllByText("1 item unpriced: add rates to include").length).toBeGreaterThan(0);
    expect(screen.queryByText(/\$215/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Include" })).toBeDisabled();
    expect(screen.queryByText(/Mark Arnesen|Toorak|Bondi/i)).not.toBeInTheDocument();
    await waitFor(() => expect(fetchScanById).toHaveBeenCalledWith("scan-1"));

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Price for Exhaust fan"), "180");
    await user.click(screen.getByRole("button", { name: "Include" }));
    expect(await screen.findByText("$660")).toBeInTheDocument();
    expect(screen.queryByText("1 item unpriced: add rates to include")).not.toBeInTheDocument();
  });
});
