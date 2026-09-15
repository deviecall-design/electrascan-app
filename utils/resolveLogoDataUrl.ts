/**
 * jsPDF can embed PNG/JPEG data URLs (and some HTTP images via addImage),
 * but remote Supabase logo URLs often fail CORS and SVGs are unsupported.
 * Resolve a tenant logo into a PNG/JPEG data URL when possible.
 */
export async function resolveLogoDataUrl(
  logoUrl: string | null | undefined,
): Promise<string | null> {
  if (!logoUrl) return null;
  if (logoUrl.startsWith("data:image/svg")) return null;
  if (logoUrl.startsWith("data:image/png") || logoUrl.startsWith("data:image/jpeg") || logoUrl.startsWith("data:image/jpg")) {
    return logoUrl;
  }
  if (!/^https?:\/\//i.test(logoUrl)) return null;

  try {
    const res = await fetch(logoUrl, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!/^image\/(png|jpeg|jpg)$/i.test(blob.type)) return null;
    return await blobToDataUrl(blob);
  } catch {
    return null;
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
