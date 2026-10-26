/**
 * Review edits must change Quote totals and the PDF.
 *
 * On the old screen, Classify and Not in scope only updated StepReview
 * state. Quote still summed the raw Detect list ($1,519 here). This test
 * fails if that wiring comes back.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { C } from "../components/desktop/tokens";

const downloadEstimatePDF = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock("../analyze_pdf", () => ({
  detectElectricalComponents: vi.fn(),
}));

vi.mock("../utils/estimatePdf", () => ({
  downloadEstimatePDF,
}));

vi.mock("../services/estimateReferenceService", () => ({
  peekNextReference: vi.fn().mockResolvedValue("EST-2610-0099"),
}));

vi.mock("../services/persistQuote", () => ({
  persistQuoteFromScan: vi.fn(),
}));

vi.mock("../services/supabaseData", () => ({
  fetchScanById: vi.fn().mockResolvedValue({ data: null, error: null }),
}));

vi.mock("../components/SourcePlanPreview", () => ({
  default: () => null,
}));

vi.mock("../services/supabaseClient", () => ({
  supabase: { from: vi.fn() },
}));

import ScanDetailScreen from "../screens/ScanDetailScreen";

const FIXTURE = [
  {
    id: 1,
    symbol: "GPO",
    qty: 2,
    desc: "Double power outlet",
    rateCode: "",
    conf: 0.96,
    x: 0,
    y: 0,
    unitPrice: 260,
    category: "Power outlets",
  },
  {
    id: 2,
    symbol: "DC",
    qty: 1,
    desc: "Electrical: data point as spec.",
    rateCode: "",
    conf: 0.8,
    x: 0,
    y: 0,
    unitPrice: 999,
    category: "Data & comms",
  },
  {
    id: 3,
    symbol: "LT",
    qty: 1,
    desc: "Edb: electrical distribution board",
    rateCode: "",
    conf: 0.4,
    x: 0,
    y: 0,
    unitPrice: 0,
    category: "Lighting",
  },
];

function renderReview() {
  return render(
    <MemoryRouter initialEntries={["/detection/fixture"]}>
      <Routes>
        <Route
          path="/detection/:id"
          element={<ScanDetailScreen initialStep={3} initialItems={FIXTURE} />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("Review edits are the quote and PDF source of truth", () => {
  beforeEach(() => {
    downloadEstimatePDF.mockClear();
  });

  it("classifying a $0 board and dropping a data point changes the quoted total and the PDF", async () => {
    const user = userEvent.setup();
    renderReview();

    expect(screen.getByRole("button", { name: /blocked — 1 unresolved/i })).toBeInTheDocument();

    const board = screen.getByText("Electrical Distribution Board").closest("[data-review-id]");
    const dataPoint = screen.getByText("Data Point").closest("[data-review-id]");
    expect(board).toBeTruthy();
    expect(dataPoint).toBeTruthy();

    await user.click(within(board as HTMLElement).getByRole("button", { name: "Classify & Add" }));
    await user.click(within(dataPoint as HTMLElement).getByRole("button", { name: "Not In Scope" }));
    await user.click(screen.getByRole("button", { name: /generate quote/i }));

    // Raw detect money was 2×$260 + $999 = $1,519 → $1,922 inc GST at 15%.
    // Reviewed money is 2×$260 + $1,800 = $2,320 → $2,935 inc GST.
    expect(screen.getByTestId("quoted-total")).toHaveTextContent("$2,935");
    expect(screen.getByText(/1 removed in review/i)).toBeInTheDocument();
    expect(screen.queryByText("$1,519.00")).not.toBeInTheDocument();
    expect(screen.queryByText("$1,922")).not.toBeInTheDocument();
    expect(screen.queryByText(/data point/i)).not.toBeInTheDocument();
    expect(screen.getByText("Electrical Distribution Board")).toBeInTheDocument();

    const subtotal = screen.getByText("$2,320.00");
    expect(subtotal).toHaveStyle({ color: C.paperText });
    expect(subtotal).not.toHaveStyle({ color: C.text });

    const paper = screen.getByTestId("quote-paper");
    expect(paper).toHaveStyle({ color: C.paperText });
    expect(paper).not.toHaveStyle({ color: C.text });

    await user.click(screen.getByRole("button", { name: /download pdf/i }));
    expect(downloadEstimatePDF).toHaveBeenCalledTimes(1);
    const pdf = downloadEstimatePDF.mock.calls[0][0] as {
      items: { description: string; qty: number; unitPrice: number }[];
    };
    const pdfSubtotal = pdf.items.reduce((sum, item) => sum + item.qty * item.unitPrice, 0);
    expect(pdfSubtotal).toBe(2320);
    expect(pdf.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ description: "Electrical Distribution Board", qty: 1, unitPrice: 1800 }),
        expect.objectContaining({ description: "Double power outlet", qty: 2, unitPrice: 260 }),
      ]),
    );
    expect(pdf.items.some(item => /data point/i.test(item.description))).toBe(false);
  });
});
