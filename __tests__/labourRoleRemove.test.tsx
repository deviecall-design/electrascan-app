import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../lib/labourRates", async () => {
  const actual = await vi.importActual<typeof import("../lib/labourRates")>("../lib/labourRates");
  return {
    ...actual,
    fetchLabourCard: vi.fn(async () => ({
      roles: [{
        id: "r1",
        name: "Tradesman",
        rate: 140,
        chargeType: "hourly" as const,
        overtimeMultiplier: null,
        isDefault: true,
      }],
      migration: false,
    })),
  };
});

import LabourRatesCard from "../components/desktop/LabourRatesCard";

describe("LabourRatesCard remove", () => {
  it("asks before a role leaves the card", async () => {
    render(<LabourRatesCard />);
    expect(await screen.findByDisplayValue("Tradesman")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Remove Tradesman" }));
    expect(screen.getByText("Remove Tradesman?")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Tradesman")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Confirm remove" }));
    expect(screen.queryByDisplayValue("Tradesman")).not.toBeInTheDocument();
    expect(screen.getByText("No labour roles yet.")).toBeInTheDocument();
  });
});
