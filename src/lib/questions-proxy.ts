import "server-only";
import { isIP } from "node:net";
import { questionSignature } from "./questions-signature";
// Vercel overwrites this header. Outside Vercel no incoming IP header is trusted.
export function questionProxyHeaders(headers: Headers, path: string, body: string | Uint8Array): Record<string, string> {
  if (process.env.VERCEL !== "1") return {};
  let ip = headers.get("x-vercel-forwarded-for")?.trim();
  const secret = process.env.LISTINGS_BFF_SHARED_SECRET;
  if (!ip || !isIP(ip) || !secret || secret.length < 32) throw new Error("proxy_not_configured");
  if (isIP(ip) === 6) ip = new URL(`http://[${ip}]`).hostname.slice(1, -1);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  return { "X-Morada-Client-IP": ip, "X-Morada-Timestamp": timestamp, "X-Morada-Signature": questionSignature(secret, path, timestamp, ip, body) };
}
