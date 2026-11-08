import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const { fetchScanById, fetchEstimates } = vi.hoisted(() => ({
  fetchScanById: vi.fn(),
  fetchEstimates: vi.fn(),
}));

vi.mock("../analyze_pdf", () => ({
  detectElectricalComponents: vi.fn(),
}));

vi.mock("../services/supabaseClient", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        like: () => ({
          order: () => ({
            limit: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
        }),
      }),
    }),
  },
}));

vi.mock("../services/supabaseData", () => ({
  fetchScanById: (...args: unknown[]) => fetchScanById(...args),
  fetchScans: vi.fn().mockResolvedValue({ data: [], error: null }),
  fetchEstimates: (...args: unknown[]) => fetchEstimates(...args),
  insertScan: vi.fn(),
  updateScan: vi.fn(),
}));

import ScanDetailScreen from "../screens/ScanDetailScreen";

const card = [{
  id: "tradesman",
  name: "Tradesman",
  rate: 140,
  chargeType: "hourly" as const,
  overtimeMultiplier: null,
  isDefault: true,
}];

describe("Price & send labour breakdown", () => {
  beforeEach(() => {
    localStorage.removeItem("es-labour-rates-v1");
    fetchScanById.mockResolvedValue({
      data: {
        id: "scan-0003",
        file_name: "Mark Arnesen Quoted Plans 6.03.2026 copy.pdf",
        stage: "review",
        estimate_ref: "EST-2611-0001",
        detected_items: [{
          id: 1,
          symbol: "GPO",
          qty: 10,
          desc: "Double GPO",
          rateCode: "",
          conf: 1,
          x: 0,
          y: 0,
          unitPrice: 120,
          status: "confirmed",
        }],
      },
      error: null,
    });
    fetchEstimates.mockResolvedValue({
      data: [{
        id: "est-0003",
        reference: "EST-2611-0003",
        margin_pct: 25,
        subtotal: 23134,
        value: 31809.25,
      }],
      error: null,
    });
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo) => {
      const url = String(input);
      if (url.includes("kind=labour")) {
        return { ok: true, json: async () => ({ data: [{ roles: card }] }) };
      }
      return { ok: true, json: async () => ({ defaultMarginPct: 15, supplierName: "TLE" }) };
    }));
  });

  it("prices EST-2611-0003 labour from the saved rate card, not a zero labour unit", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/detection/scan-0003?estimate=EST-2611-0003"]}>
        <Routes>
          <Route path="/detection/:id" element={<ScanDetailScreen />} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(await screen.findByRole("button", { name: "Price & send" }));
    expect(await screen.findByText("Labour $630.00")).toBeInTheDocument();
    expect(screen.getByText("Materials $570.00")).toBeInTheDocument();
    expect(screen.getByText("Labour by role")).toBeInTheDocument();
    expect(screen.getAllByText("EST-2611-0003").length).toBeGreaterThan(0);
    expect(screen.getByText("$1,650.00")).toBeInTheDocument();
    expect(screen.queryByText("Labour $0.00")).not.toBeInTheDocument();
    expect(screen.queryByText("Materials $1,200.00")).not.toBeInTheDocument();
  });
});
