/**
 * DocuSign send gate.
 *
 * The Approvals screen is a sample envelope. Sending it would email a real
 * person a placeholder PDF. A request also has to come from a signed-in user
 * and, on the server, from an estimate that account actually saved.
 */

/** Retired mock refs from Project Reports / the old AppShell counter. */
const FIXTURE_ESTIMATE_REFS = new Set([
  "EST-2026-497",
  "EST-2026-497-001",
  "EST-26-001-v3",
]);

/**
 * First bytes of the placeholder PDF shipped with the sample Approvals screen.
 * A real estimate PDF is generated from reviewed lines and will not match.
 */
const PLACEHOLDER_PDF_PREFIX =
  "JVBERi0xLjQKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwovUGFnZXMgMiAwIFIK";

export function isFixtureEstimateRef(ref: string | null | undefined): boolean {
  const value = (ref ?? "").trim();
  return FIXTURE_ESTIMATE_REFS.has(value);
}

export function isPlaceholderEstimatePdf(documentBase64: string | null | undefined): boolean {
  const value = (documentBase64 ?? "").replace(/\s/g, "");
  return value.length > 0 && value.startsWith(PLACEHOLDER_PDF_PREFIX);
}

export interface EnvelopeSendCheck {
  signedIn: boolean;
  /**
   * The sample Approvals screen must pass true. A future saved-estimate
   * send passes false. Omitted is treated as sample so a client cannot
   * skip the check by leaving the field out.
   */
  sample?: boolean;
  estimateRef?: string | null;
  documentBase64?: string | null;
}

export function envelopeSendBlockReason(input: EnvelopeSendCheck): string | null {
  if (!input.signedIn) {
    return "Sign in before sending a DocuSign envelope.";
  }
  if (input.sample !== false || isFixtureEstimateRef(input.estimateRef)) {
    return "Sample data — DocuSign send is disabled until a saved estimate is attached.";
  }
  if (!input.documentBase64 || isPlaceholderEstimatePdf(input.documentBase64)) {
    return "DocuSign send needs the saved estimate PDF. Sample and placeholder documents are not sent.";
  }
  return null;
}
