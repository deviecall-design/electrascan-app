/**
 * AUTH_DISABLED is the single switch for the Vesh beta.
 * Unset, empty, or anything other than false/0/off/no means login is off.
 */
export function isAuthDisabled() {
  const raw = process.env.AUTH_DISABLED;
  if (raw == null || String(raw).trim() === "") return true;
  return !/^(false|0|off|no)$/i.test(String(raw).trim());
}
