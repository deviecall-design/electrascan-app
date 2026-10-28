/**
 * User-facing detection errors. Provider names, model ids, and secret
 * env var names stay on the server and in the console.
 */
export function publicDetectionFailure(reason: string): string {
  const text = String(reason || "").replace(/\s+/g, " ").trim();
  const leaked = /claude|anthropic|sonnet|opus|haiku|api[_ -]?key/i.test(text);
  if (!text || leaked) return "ElectraScan AI could not read this plan.";
  if (/^ElectraScan AI could not read this plan\.?$/i.test(text)) {
    return "ElectraScan AI could not read this plan.";
  }
  if (text.startsWith("ElectraScan AI could not read this plan.")) {
    return text.slice(0, 220);
  }
  return `ElectraScan AI could not read this plan. ${text}`.slice(0, 220);
}
