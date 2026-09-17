import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import EmptyState from "../components/ui/anthropic/EmptyState";

describe("EmptyState", () => {
  it("shows the title, AU estimating copy, and a primary Upload plan CTA", async () => {
    const onCta = vi.fn();
    render(
      <EmptyState
        title="No scans yet"
        body="Upload your first plan to start a scan and generate an estimate."
        ctaLabel="Upload plan"
        onCta={onCta}
      />,
    );

    expect(screen.getByText("No scans yet")).toBeInTheDocument();
    expect(screen.getByText(/upload your first plan/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Upload plan" }));
    expect(onCta).toHaveBeenCalledTimes(1);
  });
});
