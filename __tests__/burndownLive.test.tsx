import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom";

vi.mock("../services/supabaseData", () => ({
  fetchScans: async () => ({
    data: [{
      id: "scan-1",
      estimate_ref: "EST-2611-0003",
      file_name: "Mark Arnesen.pdf",
      client: "Mark Arnesen",
      detected_items: [{
        id: 1,
        symbol: "GPO",
        qty: 10,
        desc: "Double GPO",
        rateCode: "",
        conf: 1,
        x: 0,
        y: 0,
        unitPrice: 100,
        status: "confirmed",
      }],
    }],
    error: null,
  }),
  fetchEstimates: async () => ({
    data: [{
      id: "est-1",
      reference: "EST-2611-0003",
      ref: "EST-2611-0003",
      client: "Mark Arnesen",
      project_name: "Mark Arnesen",
      margin_pct: 25,
      subtotal: 1000,
      status: "approved",
      approval_status: "approved",
    }],
    error: null,
  }),
  fetchMilestoneClaimsForProject: async () => ({
    data: [{ milestone_id: "deposit", status: "received", inv_ref: "INV-1" }],
    error: null,
  }),
  claimWriteContext: async () => ({ tenantId: "tenant-1", ownerId: "user-1" }),
}));

import JobBurndownScreen from "../screens/JobBurndownScreen";

function records(url: string) {
  if (url.includes("kind=labour")) {
    return {
      data: [{
        roles: [{ id: "tradesman", name: "Tradesman", rate: 140, chargeType: "hourly", overtimeMultiplier: null, isDefault: true }],
      }],
    };
  }
  if (url.includes("kind=costs")) {
    return {
      data: [{
        id: "cost-1",
        job_ref: "EST-2611-0003",
        spent_on: "2026-11-03",
        kind: "supplier",
        amount: 200,
        supplier: "TLE",
        reference: "TLE-44",
        note: "Cable",
      }],
    };
  }
  if (url.includes("kind=schedules")) {
    return { data: [{ job_id: "EST-2611-0003", start_on: "2026-11-02", end_on: "2026-11-16" }] };
  }
  return { data: [] };
}

describe("burndown with a saved rate card and job costs", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo) => {
      const url = String(input);
      return { ok: true, json: async () => records(url) };
    }));
  });

  it("loads the tenant card, hides the empty cost banner, and opens the week lines", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/jobs/EST-2611-0003/burndown"]}>
        <Routes>
          <Route element={<Outlet context={{ embedded: true }} />}>
            <Route path="/jobs/:jobKey/burndown" element={<JobBurndownScreen />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Paid to date")).toBeInTheDocument();
    expect(screen.getByText("Margin to date")).toBeInTheDocument();
    expect(screen.getByText("Forecast at completion")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/630\.00/)).toBeInTheDocument());
    expect(screen.queryByText(/495\.00/)).not.toBeInTheDocument();
    expect(screen.queryByText("No dated costs recorded yet.")).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /Burndown/ }));
    await user.click(await screen.findByRole("button", { name: "2026-11-02 lines" }));
    expect(screen.getByText(/Cable/)).toBeInTheDocument();
    expect(screen.getByText(/TLE-44/)).toBeInTheDocument();
    expect(screen.getAllByText(/Ahead/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/\$21,116/)).not.toBeInTheDocument();
  });
});
