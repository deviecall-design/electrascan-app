// GET /api/integrations/status
// Reports whether accounting OAuth credentials are present. No secrets are returned.

function missing(names) {
  return names.filter(name => !process.env[name]);
}

export default function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  const xeroMissing = missing(["XERO_CLIENT_ID", "XERO_CLIENT_SECRET", "XERO_REDIRECT_URI"]);
  const myobMissing = missing(["MYOB_CLIENT_ID", "MYOB_CLIENT_SECRET", "MYOB_REDIRECT_URI"]);
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({
    xero: { configured: xeroMissing.length === 0, missing: xeroMissing },
    myob: { configured: myobMissing.length === 0, missing: myobMissing },
  });
}
