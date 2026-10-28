import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SignOrderStep from "../components/desktop/SignOrderStep";

vi.mock("../services/supabaseData", () => ({
  fetchRateLibrary: vi.fn().mockResolvedValue({
    data: [{ code: "LT-1", description: "LED downlight", rate: 80, labour: 45 }],
    error: null,
  }),
}));

vi.mock("../services/persistQuote", () => ({
  persistQuoteFromScan: vi.fn().mockResolvedValue({ ok: true, reference: "EST-2610-0009" }),
}));

const items = [{
  id: 1,
  symbol: "LT",
  qty: 3,
  desc: "Recessed downlight",
  rateCode: "LT-1",
  conf: 0.9,
  x: 10,
  y: 10,
  unitPrice: 200,
  status: "confirmed" as const,
  category: "Downlights",
}];

describe("Sign and order", () => {
  it("shows the breakdown and saves the quote without leaving the step", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    render(
      <SignOrderStep
        items={items}
        jobName="Mark Arnesen"
        siteAddress="1 Test St"
        marginPct={15}
        minVerifiedPct={null}
        onBack={() => undefined}
        onSaved={onSaved}
      />,
    );
    expect((await screen.findAllByText("Recessed downlight")).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Takeoff 100% verified/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Labour 135/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Materials 240/).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Save quote" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send for signature" })).toBeDisabled();
    expect(screen.getByText(/DOCUSIGN_PRIVATE_KEY/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send materials to supplier" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download quote PDF" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back to price & send" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save quote" }));
    expect(onSaved).toHaveBeenCalledWith("EST-2610-0009");
    expect(await screen.findByText(/EST-2610-0009/)).toBeInTheDocument();
  });
});
