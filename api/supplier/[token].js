// Public supplier page API. The token is the credential.
// Prices are written onto this link only. No supplier catalogue is stored.

import { firstRow, readVesh, updateVesh } from "../_lib/veshAdmin.js";

function tokenFrom(req) {
  const header = req.headers?.["x-supplier-token"];
  if (header) return String(Array.isArray(header) ? header[0] : header);
  try {
    const url = new URL(req.url || "/", "http://localhost");
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts[0] === "api" && parts[1] === "supplier" && parts[2]) {
      return decodeURIComponent(parts[2]);
    }
  } catch {
    return "";
  }
  return "";
}

function submittedLines(value) {
  if (!Array.isArray(value)) return [];
  return value.map(line => ({
    product: String(line?.product || "").slice(0, 200),
    qty: Math.max(0, Number(line?.qty) || 0),
    unitPrice: Math.max(0, Number(line?.unitPrice ?? line?.unit_price) || 0),
    availability: String(line?.availability || "").slice(0, 80),
  })).filter(line => line.product);
}

function applyPrices(lines, submitted) {
  return (Array.isArray(lines) ? lines : []).map(line => {
    const hit = submitted.find(row => row.product.trim().toLowerCase() === String(line.product || "").trim().toLowerCase());
    if (!hit) return { product: line.product, qty: line.qty, unit: line.unit || "ea" };
    return {
      product: line.product,
      qty: line.qty,
      unit: line.unit || "ea",
      supplierUnitPrice: hit.unitPrice,
      availability: hit.availability,
    };
  });
}

async function findLink(token) {
  const result = await readVesh("supplier_price_links", {
    filters: { token: `eq.${token}` },
    limit: 1,
  });
  return { result, row: firstRow(result) };
}

export default async function handler(req, res) {
  const token = tokenFrom(req);
  if (!/^[a-f0-9]{32,64}$/.test(token)) {
    res.status(404).json({ error: "This supplier link is not valid." });
    return;
  }
  const found = await findLink(token);
  if (!found.result.ok && /does not exist|PGRST205|42P01/i.test(`${found.result.error} ${found.result.bodyText}`)) {
    res.status(503).json({ error: "Supplier links are not available until the migration is applied." });
    return;
  }
  if (!found.row) {
    res.status(404).json({ error: "This supplier link was not found." });
    return;
  }

  if (req.method === "GET") {
    res.status(200).json({
      data: {
        jobName: found.row.job_name,
        supplierName: found.row.supplier_name,
        status: found.row.status,
        lines: found.row.lines || [],
      },
    });
    return;
  }

  if (req.method === "POST") {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const lines = applyPrices(found.row.lines, submittedLines(body.lines));
    const saved = await updateVesh("supplier_price_links", found.row.id, {
      lines,
      status: "priced",
      submitted_at: new Date().toISOString(),
    });
    if (!saved.ok) {
      res.status(400).json({ error: saved.error || "Those prices could not be saved." });
      return;
    }
    res.status(200).json({ data: { status: "priced", lines } });
    return;
  }

  res.setHeader("Allow", "GET, POST");
  res.status(405).json({ error: "Method not allowed" });
}
