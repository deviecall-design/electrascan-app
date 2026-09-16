import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import DashboardScreen from "../screens/DashboardScreen";

vi.mock("../hooks/useSupabaseQuery", () => ({
  default: () => ({ data: [], loading: false, isLive: true, error: false }),
}));

describe("Dashboard empty pipeline", () => {
  it("shows Upload plan CTAs instead of a dead italic empty row", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route path="/dashboard" element={<DashboardScreen />} />
          <Route path="/detection/new" element={<div>Upload flow</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText(/welcome back, vesh/i)).toBeInTheDocument();
    expect(screen.getAllByText("No scans yet").length).toBeGreaterThan(0);
    expect(screen.getByText("No estimates yet")).toBeInTheDocument();
    const ctas = screen.getAllByRole("button", { name: /upload plan/i });
    expect(ctas.length).toBeGreaterThan(0);
    await user.click(ctas[0]);
    expect(screen.getByText("Upload flow")).toBeInTheDocument();
  });
});
