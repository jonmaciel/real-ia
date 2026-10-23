import "server-only";
import { createHash, createHmac } from "node:crypto";
import { isIP } from "node:net";
// Vercel overwrites this header. Outside Vercel no incoming IP header is trusted.
export function questionProxyHeaders(headers: Headers, path: string, body: string): Record<string, string> {
  if (process.env.VERCEL !== "1") return {};
  let ip = headers.get("x-vercel-forwarded-for")?.trim();
  const secret = process.env.LISTINGS_BFF_SHARED_SECRET;
  if (!ip || !isIP(ip) || !secret || secret.length < 32) throw new Error("proxy_not_configured");
  if (isIP(ip) === 6) ip = new URL(`http://[${ip}]`).hostname.slice(1, -1);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const message = ["POST", path, timestamp, ip, createHash("sha256").update(body).digest("hex")].join("\n");
  return { "X-Morada-Client-IP": ip, "X-Morada-Timestamp": timestamp, "X-Morada-Signature": createHmac("sha256", secret).update(message).digest("hex") };
}
