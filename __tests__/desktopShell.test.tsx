import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import DesktopShell from "../components/desktop/DesktopShell";

vi.mock("../services/supabaseData", () => ({
  fetchScans: vi.fn().mockResolvedValue({ data: [], error: null }),
  fetchEstimates: vi.fn().mockResolvedValue({ data: [], error: null }),
}));

vi.mock("../services/supabaseClient", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
  },
}));

function renderShell(path = "/dashboard") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<DesktopShell />}>
          <Route path="/dashboard" element={<div>Dashboard page</div>} />
          <Route path="/detection" element={<div>Scans page</div>} />
          <Route path="/detection/new" element={<div>New scan page</div>} />
          <Route path="/estimate" element={<div>Estimates page</div>} />
          <Route path="/pricing-schedule" element={<div>Rates page</div>} />
          <Route path="/approvals" element={<div>Approvals page</div>} />
          <Route path="/variation-report" element={<div>Variation page</div>} />
          <Route path="/projects" element={<div>Projects page</div>} />
          <Route path="/settings" element={<div>Settings page</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("DesktopShell V1 navy chrome", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses V1 nav labels and tenant brand, without fake vision credits", () => {
    renderShell();
    expect(screen.getByText("ElectraScan")).toBeInTheDocument();
    expect(screen.getAllByText(/vesh/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /scans/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /estimates/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^rates$/i })).toBeInTheDocument();
    expect(screen.queryByText("Vision credits")).not.toBeInTheDocument();
    expect(screen.queryByText(/847/)).not.toBeInTheDocument();
    expect(screen.queryByText(/aries online/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Damien C.")).not.toBeInTheDocument();
    expect(screen.queryByText("Admin")).not.toBeInTheDocument();
    expect(screen.queryByText(/groundplan/i)).not.toBeInTheDocument();
  });

  it("opens a real search palette from the header control", async () => {
    const user = userEvent.setup();
    renderShell();
    await user.click(screen.getByRole("button", { name: /search scans, estimates, plans/i }));
    expect(screen.getByRole("dialog", { name: /search scans, estimates, and pages/i })).toBeInTheDocument();
    expect(screen.getByText("Upload plan")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/search scans, estimates, plans/i)).toBeInTheDocument();
  });

  it("navigates from the palette to New scan", async () => {
    const user = userEvent.setup();
    renderShell();
    await user.click(screen.getByRole("button", { name: /search scans, estimates, plans/i }));
    await user.click(screen.getByRole("button", { name: /upload plan/i }));
    expect(screen.getByText("New scan page")).toBeInTheDocument();
  });

  it("keeps the bell honest — no unread badge, empty copy only", async () => {
    const user = userEvent.setup();
    renderShell();
    expect(screen.queryByTestId("notification-unread")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /notifications/i }));
    expect(screen.getByRole("dialog", { name: /notifications/i })).toBeInTheDocument();
    expect(screen.getByText(/you.re all caught up/i)).toBeInTheDocument();
  });

  it("routes New scan to the upload flow", async () => {
    const user = userEvent.setup();
    renderShell();
    await user.click(screen.getByRole("button", { name: /new scan/i }));
    expect(screen.getByText("New scan page")).toBeInTheDocument();
  });
});
