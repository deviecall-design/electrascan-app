import { describe, expect, it } from "vitest";
import { variationChain, variationProjectKey } from "../lib/variationDiff";

describe("variation job matching", () => {
  it("does not pair Mark Arnesen with Sirius", () => {
    const mark = variationProjectKey({ client: "Client not set", file_name: "Mark Arnesen Quoted Plans 6.03.2026 copy.pdf" });
    const sirius = variationProjectKey({ client: null, file_name: "05. 4 Sirius - Electrical Plans (19.12.25).pdf" });
    expect(mark).not.toBe(sirius);
    const chain = variationChain([
      { client: "Client not set", file_name: "Mark Arnesen Quoted Plans 6.03.2026.pdf", started_at: "2026-11-01", detected_items: [] },
      { client: null, file_name: "05. 4 Sirius - Electrical Plans (19.12.25).pdf", started_at: "2026-11-02", detected_items: [] },
    ], mark);
    expect(chain).toHaveLength(1);
    expect(chain[0].scan.file_name).toContain("Mark Arnesen");
  });

  it("keeps a revised upload on the job it was compared with", () => {
    const base = { client: null, file_name: "Mark Arnesen Quoted Plans.pdf", started_at: "2026-11-01", detected_items: [] };
    const key = variationProjectKey(base);
    const revised = { client: null, file_name: "revised.pdf", revision_of: key, started_at: "2026-11-05", detected_items: [] };
    expect(variationProjectKey(revised)).toBe(key);
    expect(variationChain([base, revised], key)).toHaveLength(2);
  });
});
