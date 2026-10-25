import sharp from "sharp";
import { isIP } from "node:net";

const maxBytes = 5_000_000;
export function previewPhotoUrl(value?: string | null, hosts = ["ik.imagekit.io", ...(process.env.MEDIA_ALLOWED_HOSTS ?? "").split(",").map(h => h.trim()).filter(Boolean)]) {
  try {
    const url = new URL(value ?? "");
    if (url.protocol !== "https:" || url.username || url.password || url.port || isIP(url.hostname) || url.hostname === "localhost" || url.hostname.endsWith(".local") || !hosts.includes(url.hostname)) return null;
    return url.href;
  } catch { return null; }
}
/** Only published API covers from reviewed image hosts; never a URL supplied in a query string. */
export async function previewPhoto(value?: string | null, fetcher: typeof fetch = fetch) {
  const url = previewPhotoUrl(value);
  if (!url) return null;
  try {
    const response = await fetcher(url, { redirect: "error", signal: AbortSignal.timeout(5000), next: { revalidate: 60 } });
    const type = response.headers.get("content-type")?.split(";")[0];
    if (!response.ok || !response.body || !["image/jpeg", "image/png", "image/webp"].includes(type ?? "") || Number(response.headers.get("content-length")) > maxBytes) { await response.body?.cancel(); return null; }
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    while (true) {
      const { done, value: chunk } = await reader.read();
      if (done) break;
      bytes += chunk.byteLength;
      if (bytes > maxBytes) { await reader.cancel(); return null; }
      chunks.push(chunk);
    }
    const photo = await sharp(Buffer.concat(chunks), { limitInputPixels: 25_000_000, animated: false }).rotate().resize(720, 630, { fit: "cover" }).jpeg({ quality: 82 }).toBuffer();
    return `data:image/jpeg;base64,${photo.toString("base64")}`;
  } catch { return null; }
}
