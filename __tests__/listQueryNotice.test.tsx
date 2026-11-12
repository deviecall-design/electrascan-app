import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ListQueryNotice, { noticeForLedger } from "../components/ListQueryNotice";
import { fetchRecordList } from "../lib/recordList";

describe("ListQueryNotice", () => {
  it("says the list is empty when the query succeeded with no rows", () => {
    render(
      <ListQueryNotice status="empty" noun="draft invoices" emptyText="No draft invoices yet." onRetry={() => undefined} listKey="invoices" />,
    );
    expect(screen.getByRole("status").textContent).toBe("No draft invoices yet.");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
  });

  it("shows a fixed message and Retry when the query failed", async () => {
    const onRetry = vi.fn();
    render(
      <ListQueryNotice status="error" noun="job costs" emptyText="No job costs recorded yet." onRetry={onRetry} listKey="costs" />,
    );
    expect(screen.getByRole("alert").textContent).toMatch(/Could not load job costs/);
    expect(screen.getByRole("alert").textContent).not.toMatch(/42703|updated_at|PGRST/);
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("hides the dated-cost empty state once the ledger has lines", () => {
    expect(noticeForLedger("empty", 3)).toBe("ready");
    expect(noticeForLedger("empty", 0)).toBe("empty");
    expect(noticeForLedger("error", 3)).toBe("error");
    render(
      <ListQueryNotice status={noticeForLedger("empty", 2)} noun="dated costs" emptyText="No dated costs recorded yet." onRetry={() => undefined} />,
    );
    expect(screen.queryByText("No dated costs recorded yet.")).not.toBeInTheDocument();
  });

  it("renders nothing while loading or after a list with rows", () => {
    const { rerender } = render(
      <ListQueryNotice status="loading" noun="dated costs" emptyText="No dated costs recorded yet." onRetry={() => undefined} />,
    );
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    rerender(
      <ListQueryNotice status="ready" noun="dated costs" emptyText="No dated costs recorded yet." onRetry={() => undefined} />,
    );
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});

describe("fetchRecordList", () => {
  it("logs the server detail and does not return it to the caller", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      error: "column job_costs.updated_at does not exist",
    }), { status: 400 })));
    await expect(fetchRecordList("/api/beta/records?kind=costs")).resolves.toEqual({ ok: false });
    expect(error).toHaveBeenCalled();
    expect(String(error.mock.calls)).toMatch(/updated_at/);
    error.mockRestore();
    vi.unstubAllGlobals();
  });

  it("treats a 200 with an empty data array as a successful empty list", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ data: [] }), { status: 200 })));
    await expect(fetchRecordList("/api/beta/records?kind=invoices")).resolves.toEqual({
      ok: true,
      rows: [],
      migration: null,
    });
    vi.unstubAllGlobals();
  });
});
