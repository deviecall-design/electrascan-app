import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Footer from "../components/ui/anthropic/Footer";

describe("Footer", () => {
  it("does not mention Groundplan", () => {
    render(<Footer />);
    expect(screen.queryByText(/groundplan/i)).not.toBeInTheDocument();
    expect(screen.getByText(/electrascan reads the plan/i)).toBeInTheDocument();
  });
});
