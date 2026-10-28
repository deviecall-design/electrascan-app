// GET /api/config
// Tells the browser whether the Vesh beta (login off) is on.
// AUTH_DISABLED is read only on the server. Unset means beta on.

import { isAuthDisabled } from "./_lib/authMode.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({ authDisabled: isAuthDisabled() });
}
