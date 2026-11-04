import { describe, expect, it } from "vitest";
import { DEFAULT_ASSEMBLIES } from "../lib/assemblies";
import { acceptedPrices, parsePriceFile, reviewPriceRows } from "../lib/priceFile";

const csv = `Product Code,Description,UOM,Nett Price
CLIPSAL-3025,"Double powerpoint 10A",EA,8.40
UNKNOWN-1,Special bronze antique fitting,EA,440.00
`;

const xml = `<?xml version="1.0"?>
<PriceList>
  <Item>
    <Code>DL-90</Code>
    <Description>Recessed downlight</Description>
    <Unit>EA</Unit>
    <Cost>18.00</Cost>
  </Item>
</PriceList>`;

describe("supplier price file", () => {
  it("reads CSV and XML into code, description, unit, and cost", () => {
    const parsed = parsePriceFile(csv, "lh-customer.csv");
    expect(parsed.error).toBeNull();
    expect(parsed.rows).toEqual([
      { code: "CLIPSAL-3025", description: "Double powerpoint 10A", unit: "EA", cost: 8.4 },
      { code: "UNKNOWN-1", description: "Special bronze antique fitting", unit: "EA", cost: 440 },
    ]);
    expect(parsePriceFile(xml, "prices.xml").rows[0]).toMatchObject({ code: "DL-90", cost: 18, unit: "EA" });
    expect(parsePriceFile("Code\tDescription\tUnit\tCost\nSW-1\tLight switch\tea\t7.10", "prices.txt").rows[0].cost).toBe(7.1);
  });

  it("matches assemblies and leaves a weak line for review", () => {
    const reviewed = reviewPriceRows(parsePriceFile(csv).rows, DEFAULT_ASSEMBLIES, ["CLIPSAL-3025"]);
    expect(reviewed[0].band).toBe("matched");
    expect(reviewed[0].assemblyId).toBe("gpo-double");
    expect(reviewed[1].band).toBe("review");
    const kept = acceptedPrices(reviewed.map((row, index) => index === 1 ? { ...row, decision: "skip" } : row));
    expect(kept).toHaveLength(1);
    expect(kept[0].code).toBe("CLIPSAL-3025");
    expect(kept[0].assemblyId).toBe("gpo-double");
  });
});
