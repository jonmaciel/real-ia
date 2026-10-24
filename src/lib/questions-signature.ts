import { createHash, createHmac } from "node:crypto";
// Shared wire protocol. Hash the original payload, including multipart boundaries.
export function questionSignature(secret: string, path: string, timestamp: string, ip: string, body: string | Uint8Array) {
  const message = ["POST", path, timestamp, ip, createHash("sha256").update(body).digest("hex")].join("\n");
  return createHmac("sha256", secret).update(message).digest("hex");
}
