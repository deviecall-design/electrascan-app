import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { publicScanFailure } from "../lib/scanFailure";

const fetchScans = vi.hoisted(() => vi.fn());
const fetchScanById = vi.hoisted(() => vi.fn());

vi.mock("../analyze_pdf", () => ({
  detectElectricalComponents: vi.fn(),
}));

vi.mock("../services/supabaseData", () => ({
  fetchScans: (...args: unknown[]) => fetchScans(...args),
  fetchScanById: (...args: unknown[]) => fetchScanById(...args),
  insertScan: vi.fn(),
  updateScan: vi.fn(),
}));

import DetectionScreen from "../screens/DetectionScreen";
import ScanDetailScreen from "../screens/ScanDetailScreen";

describe("public scan failures", () => {
  it("hides setup secrets and keeps a plain reason", () => {
    expect(publicScanFailure(
      "Saved data needs SUPABASE_SERVICE_ROLE_KEY on the server.",
      "Scans could not be loaded.",
    )).toBe("Scans could not be loaded.");
    expect(publicScanFailure("Upload a PDF or PNG floor plan.", "fallback")).toBe(
      "Upload a PDF or PNG floor plan.",
    );
  });
});

describe("scan failure state", () => {
  it("shows a retry panel instead of an empty scan list", async () => {
    const user = userEvent.setup();
    fetchScans
      .mockResolvedValueOnce({
        data: null,
        error: { message: "Saved data needs SUPABASE_SERVICE_ROLE_KEY on the server." },
      })
      .mockResolvedValueOnce({
        data: [{
          id: "scan-1",
          file_name: "level-1.pdf",
          client: "Harbour",
          items_detected: 2,
          started_at: "2026-10-01T00:00:00.000Z",
          stage: "review",
          detected_items: [],
        }],
        error: null,
      });

    render(
      <MemoryRouter>
        <DetectionScreen />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("Scans could not be loaded");
    expect(screen.getByText(/Nothing on this page is sample data/)).toBeInTheDocument();
    expect(screen.queryByText("No scans yet")).not.toBeInTheDocument();
    expect(screen.queryByText(/SUPABASE_SERVICE_ROLE_KEY/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("level-1.pdf")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows a retry panel when a saved scan cannot be opened", async () => {
    const user = userEvent.setup();
    fetchScanById
      .mockResolvedValueOnce({ data: null, error: { message: "Could not reach saved data." } })
      .mockResolvedValueOnce({
        data: {
          id: "scan-1",
          file_name: "kitchen-plan.pdf",
          stage: "review",
          detected_items: [],
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

    expect(await screen.findByRole("alert")).toHaveTextContent("This scan could not be opened");
    expect(screen.getByText("Could not reach saved data.")).toBeInTheDocument();
    expect(screen.queryByText("Untitled scan")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("heading", { name: "kitchen-plan.pdf" })).toBeInTheDocument();
    expect(fetchScanById).toHaveBeenCalledTimes(2);
  });
});
