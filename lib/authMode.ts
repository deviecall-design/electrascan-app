/**
 * Runtime switch for the Vesh beta.
 *
 * Login and tenant invites stay in the repo. While this is true they are
 * not used: the app opens in the Vesh Electrical workspace and reads and
 * writes go through /api/beta/* with the service role.
 *
 * The source of truth is GET /api/config (AUTH_DISABLED on the server).
 * Unset means beta on. Tests stay on the signed-in Supabase path.
 */

let resolved = false;
let disabled = false;

export function authIsDisabled(): boolean {
  return disabled;
}

export async function loadAuthMode(): Promise<boolean> {
  if (resolved) return disabled;
  if (import.meta.env.MODE === "test") {
    resolved = true;
    disabled = false;
    return false;
  }
  try {
    const res = await fetch("/api/config");
    if (res.ok) {
      const json = await res.json();
      disabled = json?.authDisabled !== false;
    } else {
      disabled = true;
    }
  } catch {
    disabled = true;
  }
  resolved = true;
  return disabled;
}
