/**
 * Aries copy must be scoped to the job on screen.
 *
 * Live bug (Sep 2026): ScanDetailScreen StepQuote hardcoded
 * "Bondi Tower's last 3 quotes closed at 15–22% margin" on every quote,
 * including unrelated jobs such as the Sirius scan. That made a new
 * estimate look like it had inherited Bondi Towers history.
 */

const BONDI_RE = /\bbondi\b/i;

export interface AriesMarginContext {
  /** Client / project name for the job being quoted. Empty = unknown. */
  clientName?: string;
  marginPct: number;
  typicalLowPct?: number;
  typicalHighPct?: number;
}

/**
 * Margin commentary for the Quote sidebar. Never names another project
 * unless that project is the one currently being quoted.
 */
export function ariesMarginSuggestion(ctx: AriesMarginContext): string {
  const low = ctx.typicalLowPct ?? 15;
  const high = ctx.typicalHighPct ?? 20;
  const pct = ctx.marginPct;
  const client = (ctx.clientName ?? "").trim();
  const inBand = pct >= low && pct <= high;
  const band = `${low}–${high}%`;

  const aboutThisJob = inBand
    ? `Your current ${pct}% margin sits in the typical ${band} band for Vesh electrical quotes.`
    : pct < low
      ? `Your current ${pct}% margin is below the typical ${band} band for Vesh electrical quotes.`
      : `Your current ${pct}% margin is above the typical ${band} band for Vesh electrical quotes.`;

  if (client && BONDI_RE.test(client)) {
    return `Bondi Tower jobs have historically closed around ${band}. ${aboutThisJob}`;
  }

  if (client) {
    return `${aboutThisJob} This quote is for ${client} — not another project's history.`;
  }

  return aboutThisJob;
}

/** True when copy would leak a named job that isn't the current client. */
export function suggestionLeaksOtherProject(text: string, clientName?: string): boolean {
  const client = (clientName ?? "").trim();
  if (!BONDI_RE.test(text)) return false;
  if (client && BONDI_RE.test(client)) return false;
  return true;
}
