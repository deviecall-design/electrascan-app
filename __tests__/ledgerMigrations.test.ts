import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function sql(name: string): string {
  return readFileSync(`supabase/migrations/${name}`, "utf8");
}

describe("ledger migrations", () => {
  it("adds milestone_claims.project_id without opening null-tenant access", () => {
    const text = sql("20261108040000_milestone_claims_project_id.sql");
    expect(text).toContain("ADD COLUMN IF NOT EXISTS project_id");
    expect(text).toContain("tenant_id IS NOT NULL AND tenant_id = public.get_tenant_id()");
    expect(text).not.toMatch(/DELETE FROM/i);
  });

  it("requires a tenant on every job cost", () => {
    const text = sql("20261108050000_job_costs.sql");
    expect(text).toContain("tenant_id uuid NOT NULL");
    expect(text).toContain("tenant_id = public.get_tenant_id()");
    expect(text).not.toMatch(/tenant_id IS NULL/);
  });

  it("stops authenticated reads of labour rates with a null tenant", () => {
    const text = sql("20261108060000_labour_rate_cards_tenant_rls.sql");
    expect(text).toContain("tenant_id IS NOT NULL AND tenant_id = public.get_tenant_id()");
    expect(text).not.toMatch(/tenant_id IS NULL OR/);
  });
});
