import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import PdfPreviewModal from "./PdfPreviewModal";

describe("PdfPreviewModal", () => {
  it("renders nothing when closed", () => {
    const { container } = render(
      <PdfPreviewModal open={false} title="Quote PDF preview" blob={null} filename="x.pdf" onClose={() => {}} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("opens a visible dialog with download and iframe when a blob is ready", () => {
    const blob = new Blob(["%PDF-1.4 test"], { type: "application/pdf" });
    const { getByRole, getByTitle } = render(
      <PdfPreviewModal
        open
        title="Quote PDF preview"
        blob={blob}
        filename="EST-2604-0007.pdf"
        onClose={() => {}}
      />,
    );
    expect(getByRole("dialog", { name: "Quote PDF preview" })).toBeInTheDocument();
    expect(getByRole("button", { name: "Download PDF" })).toBeEnabled();
    expect(getByTitle("Quote PDF preview")).toBeInTheDocument();
  });
});
