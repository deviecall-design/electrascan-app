import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("../services/supabaseData", () => ({
  fetchEstimateByRef: vi.fn().mockResolvedValue({ data: null, error: null }),
  fetchMilestoneClaimsForProject: vi.fn().mockResolvedValue({ data: null, error: null }),
  submitMilestoneClaim: vi.fn(),
}));

import ProjectReportsScreen from "../screens/ProjectReportsScreen";

describe("Project Reports sample banner", () => {
  it("labels the Mark Arnesen page as sample data", () => {
    render(<ProjectReportsScreen />);
    const banner = screen.getByRole("status");
    expect(banner).toHaveTextContent(/sample data/i);
    expect(banner).toHaveTextContent(/Mark Arnesen/);
    expect(banner).toHaveTextContent(/not a saved Vesh job/i);
    expect(screen.getByRole("heading", { name: "Mark Arnesen" })).toBeInTheDocument();
  });
});
