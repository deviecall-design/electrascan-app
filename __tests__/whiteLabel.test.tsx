import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { readFileSync } from "fs";

const detectElectricalComponents = vi.hoisted(() => vi.fn());

vi.mock("../analyze_pdf", () => ({
  detectElectricalComponents,
}));

vi.mock("../services/supabaseData", () => ({
  fetchScanById: vi.fn(),
  fetchScans: vi.fn().mockResolvedValue({ data: [], error: null }),
  insertScan: vi.fn(),
  updateScan: vi.fn(),
}));

import ScanDetailScreen from "../screens/ScanDetailScreen";
import DetectionScreen from "../screens/DetectionScreen";

describe("ElectraScan AI wording", () => {
  it("does not name the model on the scan list or the upload step", () => {
    render(
      <MemoryRouter>
        <DetectionScreen />
      </MemoryRouter>,
    );
    expect(screen.getByText(/ElectraScan AI will turn it into a costed estimate/)).toBeInTheDocument();
    expect(screen.queryByText(/claude|anthropic/i)).not.toBeInTheDocument();
  });

  it("says ElectraScan is analysing while a plan is being read", async () => {
    detectElectricalComponents.mockReturnValue(new Promise(() => {}));
    render(
      <MemoryRouter initialEntries={["/detection/new"]}>
        <Routes>
          <Route path="/detection/:id" element={<ScanDetailScreen />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText(/ElectraScan AI will detect symbols/)).toBeInTheDocument();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["%PDF"], "Mark Arnesen Quoted Plans.pdf", { type: "application/pdf" });
    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByRole("heading", { name: "ElectraScan is analysing" })).toBeInTheDocument();
    expect(screen.getByText(/Reading the legend|Rendering drawing pages/)).toBeInTheDocument();
    expect(screen.queryByText(/claude|anthropic/i)).not.toBeInTheDocument();
  });

  it("shows a neutral message when detection fails with a provider error", async () => {
    detectElectricalComponents.mockRejectedValue(new Error("Model not permitted: claude-sonnet-5"));
    render(
      <MemoryRouter initialEntries={["/detection/new"]}>
        <Routes>
          <Route path="/detection/:id" element={<ScanDetailScreen />} />
        </Routes>
      </MemoryRouter>,
    );
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["x"], "plan.pdf", { type: "application/pdf" })] } });
    expect(await screen.findByText("ElectraScan AI could not read this plan.")).toBeInTheDocument();
    expect(screen.queryByText(/claude|anthropic/i)).not.toBeInTheDocument();
  });

  it("keeps provider names out of the mounted copy and the quote PDF helper", () => {
    const files = [
      "screens/ScanDetailScreen.tsx",
      "screens/DetectionScreen.tsx",
      "app/mockup/page.jsx",
      "utils/estimatePdf.ts",
      "utils/pdfExport.ts",
      "components/PdfLetterhead.ts",
    ];
    for (const file of files) {
      const visible = readFileSync(file, "utf8")
        .replace(/from ["'][^"']+["']/g, "")
        .split("\n")
        .filter(line => {
          const trimmed = line.trim();
          return !trimmed.startsWith("import ")
            && !trimmed.startsWith("//")
            && !trimmed.startsWith("*")
            && !trimmed.startsWith("/*");
        })
        .join("\n");
      expect(visible, file).not.toMatch(/claude|anthropic/i);
    }
  });
});
