/**
 * Copy a person can see when a scan request fails.
 * Service-role setup text, provider names, and tokens stay off the screen.
 */

const LEAK = /service_role|supabase|anthropic|claude|sonnet|opus|haiku|api[_ -]?key|bearer |eyJ|sb_secret_/i;

export function publicScanFailure(reason: string | null | undefined, fallback: string): string {
  const text = String(reason || "").replace(/\s+/g, " ").trim();
  if (!text || LEAK.test(text)) return fallback;
  return text.slice(0, 240);
}
