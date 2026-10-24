import "server-only";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, baseUrl, demo } from "./api";
import { manualError } from "./manual-contracts";

export class ManualApiError extends ApiError {
  constructor(status: number, code: string, retryAfter?: string, public missing: string[] = []) { super(status, code, retryAfter); }
}
export const manualHeaders = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };
export function manualBodyLimit() {
  // Vercel Functions reject >4.5 MB before Next runs. Keep multipart overhead below that ingress limit.
  return process.env.VERCEL ? 4 * 1024 * 1024 + 65536 : 24 * 1024 * 1024;
}
export async function manualToken() {
  if (demo) throw new ManualApiError(503, "ai_unavailable");
  const token = (await cookies()).get("morada_session")?.value;
  if (!token) throw new ManualApiError(401, "unauthorized");
  return token;
}
export function manualOrigin(req: Request) {
  if (req.headers.get("origin") !== new URL(process.env.APP_URL ?? "http://localhost:3001").origin || req.headers.get("sec-fetch-site") === "cross-site") throw new ManualApiError(403, "origin_forbidden");
}
export async function manualBytes(req: Request, max: number) {
  if (Number(req.headers.get("content-length")) > max) throw new ManualApiError(413, "request_too_large");
  const reader = req.body?.getReader(); if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) { const next = await reader.read(); if (next.done) break; size += next.value.length; if (size > max) { await reader.cancel(); throw new ManualApiError(413, "request_too_large"); } chunks.push(next.value); }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}
export async function manualJson<T>(req: Request, schema: z.ZodType<T>) {
  if (!req.headers.get("content-type")?.startsWith("application/json")) throw new ManualApiError(400, "invalid_request");
  const bytes = await manualBytes(req, 65536);
  let value: unknown;
  try { value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); } catch { throw new ManualApiError(400, "invalid_request"); }
  const parsed = schema.safeParse(value); if (!parsed.success) throw new ManualApiError(400, "invalid_request");
  return parsed.data;
}
export async function manualRequest<T>(path: string, schema: z.ZodType<T>, init: RequestInit = {}, token?: string, afterSuccess?: () => void) {
  const bearer = token ?? await manualToken();
  let response: Response;
  try { response = await fetch(`${baseUrl()}${path}`, { ...init, headers: { ...Object.fromEntries(new Headers(init.headers)), Authorization: `Bearer ${bearer}` }, cache: "no-store", redirect: "error", signal: init.signal ?? AbortSignal.timeout(135000) }); }
  catch { throw new ManualApiError(504, "ai_timeout"); }
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const code = typeof body?.error?.code === "string" && /^[a-z_]{1,80}$/.test(body.error.code) ? body.error.code : "unavailable";
    const missing = z.array(z.string().max(100)).max(30).safeParse(body?.error?.missing_fields);
    throw new ManualApiError(response.status, code, response.headers.get("Retry-After") ?? undefined, missing.success ? missing.data : []);
  }
  afterSuccess?.();
  const parsed = schema.safeParse(body); if (!parsed.success) throw new ManualApiError(502, "invalid_response");
  return { body: parsed.data, status: response.status };
}
export async function manualFailure(error: unknown) {
  const status = error instanceof ApiError ? error.status : 502;
  const code = error instanceof ApiError ? error.code : "invalid_response";
  if (status === 401) (await cookies()).delete("morada_session");
  const headers: Record<string, string> = { ...manualHeaders };
  if (error instanceof ApiError && error.retryAfter) headers["Retry-After"] = error.retryAfter;
  return NextResponse.json({ code, message: manualError(status, code), missing_fields: error instanceof ManualApiError ? error.missing : [] }, { status, headers });
}
