import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProjectProvider } from "../contexts/ProjectContext";
import EstimatesIndexScreen from "./EstimatesIndexScreen";
import ScansIndexScreen from "./ScansIndexScreen";

const STORAGE_KEY = "electrascan_projects";

beforeEach(() => {
  window.localStorage.removeItem(STORAGE_KEY);
});

describe("EstimatesIndexScreen", () => {
  it("shows an intentional empty state with scan and project CTAs", async () => {
    const onNewScan = vi.fn();
    const onNewProject = vi.fn();
    render(
      <ProjectProvider>
        <EstimatesIndexScreen
          onOpenEstimate={() => {}}
          onNewScan={onNewScan}
          onNewProject={onNewProject}
        />
      </ProjectProvider>,
    );
    expect(screen.getByText("No estimates yet")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Start a scan" }));
    expect(onNewScan).toHaveBeenCalledTimes(1);
  });

  it("lists persisted estimates so the editor remains reachable", async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        {
          id: "p1",
          name: "Bondi Tower",
          clientName: "Allen Build",
          address: "Bondi",
          status: "Active",
          createdAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-02T00:00:00.000Z",
          scans: [],
          estimates: [
            {
              id: "e1",
              number: "EST-2026-001-001",
              reference: "EST-2604-0007",
              createdAt: "2026-04-01T00:00:00.000Z",
              updatedAt: "2026-04-02T00:00:00.000Z",
              margin: 15,
              categoryMargins: {},
              gstRate: 10,
              locked: false,
              lineItems: [],
              cableRuns: [],
              versions: [],
            },
          ],
          documents: [],
        },
      ]),
    );
    const onOpen = vi.fn();
    render(
      <ProjectProvider>
        <EstimatesIndexScreen onOpenEstimate={onOpen} onNewScan={() => {}} onNewProject={() => {}} />
      </ProjectProvider>,
    );
    expect(screen.getByText("EST-2604-0007")).toBeInTheDocument();
    expect(screen.getByText("Bondi Tower")).toBeInTheDocument();
    await userEvent.click(screen.getByText("EST-2604-0007"));
    expect(onOpen).toHaveBeenCalledWith("p1", "e1");
  });
});

describe("ScansIndexScreen", () => {
  it("shows Start a scan when there are no scans", () => {
    render(
      <ProjectProvider>
        <ScansIndexScreen onOpenProject={() => {}} onNewScan={() => {}} />
      </ProjectProvider>,
    );
    expect(screen.getByText("No scans yet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start a scan" })).toBeInTheDocument();
  });
});
