import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import EmptyState from "./EmptyState";
import userEvent from "@testing-library/user-event";

describe("EmptyState", () => {
  it("renders title, description and invokes the primary CTA", async () => {
    const onClick = vi.fn();
    render(
      <EmptyState
        title="No estimates yet"
        description="Create a project and run a scan."
        actions={[{ label: "Start a scan", onClick }]}
      />,
    );
    expect(screen.getByText("No estimates yet")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Start a scan" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
